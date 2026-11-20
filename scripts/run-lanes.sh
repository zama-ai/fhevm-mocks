#!/usr/bin/env bash
#
# Runs the test lanes of scripts/ci-lanes.sh at the same time, and says which passed. A lane is a list of
# commands that run one after the other; two lanes never share a node port or a directory they write.
# Keep it dependency-free bash (3.2, the one macOS ships): it must work on a laptop and on a CI runner.
#
# WHY THIS EXISTS. `make ci` runs every suite one after the other and takes about 46 minutes, most of
# them spent waiting on suites that do not depend on each other. Running them at once is only safe when
# something also watches for what goes wrong ONLY then, and each of those is a failure that looks like
# a pass:
#
#   - a suite that finds its port busy SKIPS and exits 0, or talks to the node of another suite;
#   - a lane that fails leaves the other lanes, and their nodes, running;
#   - a step that rewrites tracked files changes what the lanes beside it read.
#
# So this script refuses to start when a port of the map already answers, stops every lane when one
# fails or when it is interrupted, and fails the run on a busy-port skip in a log or on a changed tree.
# It never kills a process it did not start.
#
# Usage: ./scripts/run-lanes.sh [options]
#
#   --only <lane>[,<lane>...]  run these lanes only. A lane they start `after` that is not in the list
#                              is taken as already done: the caller ran it, or chose not to.
#   --except <lane>[,<lane>...]  run every lane but these, under the same rule.
#   --jobs <n>                 at most n lanes at a time (default: no limit).
#   --list                     print the lanes and their steps, and exit.
#   --log-dir <dir>            where each lane writes <lane>.log (default: a folder in $TMPDIR).
#   --root <dir>               the checkout to run in (default: the one that holds this script).
#   --lanes <file>             the lane file (default: <root>/scripts/ci-lanes.sh).
#   --ports <file>             the port map (default: <root>/test-ports.config.json).
#   -h, --help                 print this header and exit.
#
# Exit code: 0 when every lane passed and every check after the run did; 1 when a lane or a check
# failed; 2 when the run was refused before any lane started; 130 or 143 when it was interrupted.
#
# TIMINGS. When FHEVM_TIMINGS_LOG names a file, each step adds a line to it in the format of
# scripts/timed-shell.sh, with the kind `lane` and the name of its lane.
#
# THE LANE FILE is sourced, and calls two functions:
#
#   lane <name> [after <lane>[,<lane>...]]    starts a lane; it runs once the lanes after `after` passed
#   step <directory> <command>                adds a command to that lane, run from <root>/<directory>
#
set -uo pipefail

readonly HOST=127.0.0.1
# What the create2 e2e suites print when they skip because their port is busy.
readonly BUSY_PORT_SKIP='something is already listening on'
readonly STOP_GRACE_SECONDS=10
readonly FAILED_LOG_TAIL=40

die() {
  echo "run-lanes.sh: $*" >&2
  exit 2
}

usage() {
  sed -n '2,/^set -uo pipefail$/p' "${BASH_SOURCE[0]}" | sed -e '$d' -e 's/^# \{0,1\}//'
}

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
lanes_file=""
ports_file=""
log_dir=""
only=""
except=""
jobs=0
list=0

while [ $# -gt 0 ]; do
  case "$1" in
    --only) [ $# -ge 2 ] || die "--only needs a list of lanes"; only="${only:+${only},}$2"; shift 2 ;;
    --except) [ $# -ge 2 ] || die "--except needs a list of lanes"; except="${except:+${except},}$2"; shift 2 ;;
    --jobs) [ $# -ge 2 ] || die "--jobs needs a number"; jobs="$2"; shift 2 ;;
    --list) list=1; shift ;;
    --log-dir) [ $# -ge 2 ] || die "--log-dir needs a directory"; log_dir="$2"; shift 2 ;;
    --root) [ $# -ge 2 ] || die "--root needs a directory"; root="$(cd "$2" 2>/dev/null && pwd)" || die "no such directory: $2"; shift 2 ;;
    --lanes) [ $# -ge 2 ] || die "--lanes needs a file"; lanes_file="$2"; shift 2 ;;
    --ports) [ $# -ge 2 ] || die "--ports needs a file"; ports_file="$2"; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    *) die "unknown argument: $1 (see --help)" ;;
  esac
done

case "${jobs}" in '' | *[!0-9]*) die "--jobs needs a number, got '${jobs}'" ;; esac
lanes_file="${lanes_file:-${root}/scripts/ci-lanes.sh}"
ports_file="${ports_file:-${root}/test-ports.config.json}"
[ -f "${lanes_file}" ] || die "no lane file: ${lanes_file}"

# ---- The lanes ------------------------------------------------------------------------------------

# Parallel arrays: bash 3.2 has no associative array. A step names its lane by index.
LANE_NAMES=()
LANE_AFTER=()
STEP_LANE=()
STEP_DIR=()
STEP_CMD=()

lane_index() {
  local i
  for ((i = 0; i < ${#LANE_NAMES[@]}; i++)); do
    if [ "${LANE_NAMES[$i]}" = "$1" ]; then echo "$i"; return 0; fi
  done
  return 1
}

lane() {
  local name="${1:-}" after=""
  case "${name}" in '' | *[!a-z0-9-]*) die "${lanes_file}: a lane name is lowercase letters, digits and '-': '${name}'" ;; esac
  if [ $# -eq 3 ] && [ "$2" = after ]; then
    after="$3"
  elif [ $# -ne 1 ]; then
    die "${lanes_file}: expected 'lane <name> [after <lane>[,<lane>...]]', got 'lane $*'"
  fi
  lane_index "${name}" >/dev/null && die "${lanes_file}: lane '${name}' is declared twice"
  LANE_NAMES+=("${name}")
  LANE_AFTER+=("${after}")
}

step() {
  [ ${#LANE_NAMES[@]} -gt 0 ] || die "${lanes_file}: a step comes after its lane"
  [ $# -ge 2 ] || die "${lanes_file}: expected 'step <directory> <command>', got 'step $*'"
  local directory="$1"
  shift
  [ -d "${root}/${directory}" ] || die "${lanes_file}: lane '${LANE_NAMES[${#LANE_NAMES[@]} - 1]}' has a step in '${directory}', which is not a directory of ${root}"
  STEP_LANE+=($((${#LANE_NAMES[@]} - 1)))
  STEP_DIR+=("${directory}")
  STEP_CMD+=("$*")
}

# shellcheck source=/dev/null
. "${lanes_file}"

lane_count=${#LANE_NAMES[@]}
[ "${lane_count}" -gt 0 ] || die "${lanes_file} declares no lane"

# 1 when the lane runs in this invocation.
SELECTED=()
for ((i = 0; i < lane_count; i++)); do SELECTED+=(1); done

if [ -n "${only}" ]; then
  for ((i = 0; i < lane_count; i++)); do SELECTED[$i]=0; done
  for name in ${only//,/ }; do
    index="$(lane_index "${name}")" || die "--only names '${name}', which is not a lane of ${lanes_file}"
    SELECTED[$index]=1
  done
fi

for name in ${except//,/ }; do
  index="$(lane_index "${name}")" || die "--except names '${name}', which is not a lane of ${lanes_file}"
  SELECTED[$index]=0
done

for ((i = 0; i < lane_count; i++)); do
  steps=0
  for ((j = 0; j < ${#STEP_LANE[@]}; j++)); do
    if [ "${STEP_LANE[$j]}" -eq "$i" ]; then steps=$((steps + 1)); fi
  done
  [ "${steps}" -gt 0 ] || die "${lanes_file}: lane '${LANE_NAMES[$i]}' has no step"
  for name in ${LANE_AFTER[$i]//,/ }; do
    lane_index "${name}" >/dev/null || die "${lanes_file}: lane '${LANE_NAMES[$i]}' starts after '${name}', which is not a lane"
  done
done

if [ "${list}" -eq 1 ]; then
  for ((i = 0; i < lane_count; i++)); do
    [ "${SELECTED[$i]}" -eq 1 ] || continue
    echo "${LANE_NAMES[$i]}${LANE_AFTER[$i]:+  (after ${LANE_AFTER[$i]})}"
    for ((j = 0; j < ${#STEP_LANE[@]}; j++)); do
      if [ "${STEP_LANE[$j]}" -eq "$i" ]; then echo "    ${STEP_DIR[$j]}: ${STEP_CMD[$j]}"; fi
    done
  done
  exit 0
fi

# ---- Before any lane starts -------------------------------------------------------------------------

# One state folder per checkout, outside it: the run must not change the tree it watches.
state_dir="${TMPDIR:-/tmp}/fhevm-run-lanes-$(printf '%s' "${root}" | cksum | cut -d' ' -f1)"
log_dir="${log_dir:-${state_dir}/logs}"
lock_dir="${state_dir}/lock"
mkdir -p "${state_dir}" "${log_dir}" || die "cannot create ${state_dir} and ${log_dir}"
log_dir="$(cd "${log_dir}" && pwd)"

# Two runners in one checkout would start two nodes on every port. `mkdir` is the atomic test-and-set.
if ! mkdir "${lock_dir}" 2>/dev/null; then
  holder="$(cat "${lock_dir}/pid" 2>/dev/null || true)"
  if [ -n "${holder}" ] && kill -0 "${holder}" 2>/dev/null; then
    die "another run-lanes.sh (pid ${holder}) is running in ${root}"
  fi
  # The holder is gone without cleaning up: a kill -9, or a reboot.
  echo "$$" > "${lock_dir}/pid"
fi
echo "$$" > "${lock_dir}/pid"
have_lock=1

release_lock() {
  if [ "${have_lock:-0}" -eq 1 ]; then rm -f "${lock_dir}/pid" && rmdir "${lock_dir}" 2>/dev/null; fi
}
trap release_lock EXIT

refuse() {
  echo "run-lanes.sh: $*" >&2
  exit 2
}

[ -f "${ports_file}" ] || refuse "no port map: ${ports_file}"
ports="$(node -e '
  const groups = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).groups;
  const ports = Object.values(groups).flatMap((group) => Object.values(group.ports));
  if (ports.length === 0 || !ports.every(Number.isInteger)) process.exit(1);
  console.log(ports.join(" "));
' "${ports_file}")" || refuse "cannot read the ports of ${ports_file}"

port_answers() {
  (exec 3<>"/dev/tcp/${HOST}/$1") 2>/dev/null
}

answering_ports() {
  local port found=""
  for port in ${ports}; do
    if port_answers "${port}"; then found="${found} ${port}"; fi
  done
  echo "${found# }"
}

busy="$(answering_ports)"
if [ -n "${busy}" ]; then
  refuse "something already listens on port(s) ${busy} of ${ports_file}: another test run, or a node left behind. Nothing was started, and nothing was stopped."
fi

tree_status() {
  git -C "${root}" status --porcelain 2>/dev/null
}
if git -C "${root}" rev-parse --git-dir >/dev/null 2>&1; then
  watch_tree=1
  tree_before="$(tree_status)"
else
  watch_tree=0
  echo "run-lanes.sh: ${root} is not a git checkout: a step that changes the tree will not be seen" >&2
fi

# Many nodes and many test workers at once: the default limit of 256 open files on macOS is too low.
ulimit -n 65536 2>/dev/null || ulimit -n "$(ulimit -Hn)" 2>/dev/null || true

for ((i = 0; i < lane_count; i++)); do
  rm -f "${log_dir}/${LANE_NAMES[$i]}.log" "${log_dir}/${LANE_NAMES[$i]}.status"
done

# ---- The run --------------------------------------------------------------------------------------

# pending, running, passed, failed, stopped, or off (not selected).
STATE=()
PID=()
SECONDS_TAKEN=()
for ((i = 0; i < lane_count; i++)); do
  if [ "${SELECTED[$i]}" -eq 1 ]; then STATE+=(pending); else STATE+=(off); fi
  PID+=(0)
  SECONDS_TAKEN+=(0)
done

exec 3>&1

# Milliseconds where perl is present, whole seconds otherwise, as in scripts/timed-shell.sh.
now() {
  perl -MTime::HiRes=time -e 'printf "%.3f", time' 2>/dev/null || date +%s
}

timings_log="${FHEVM_TIMINGS_LOG:-}"
timings_depth="${FHEVM_TIMINGS_DEPTH:-0}"
if [ -n "${timings_log}" ]; then
  mkdir -p "$(dirname "${timings_log}")"
  # What a step starts is one level below it, and its npm scripts are timed too.
  export FHEVM_TIMINGS_DEPTH=$((timings_depth + 1))
  export npm_config_script_shell="${root}/scripts/timed-shell.sh"
fi

# $1 lane, $2 command, $3 start, $4 exit code.
log_timing() {
  [ -n "${timings_log}" ] || return 0
  printf '%s\t%s\t%s\t%s\tlane\t%s\t%s\n' \
    "$3" "$(awk -v s="$3" -v e="$(now)" 'BEGIN { printf "%.3f", e - s }')" "$4" "${timings_depth}" "$1" \
    "$(printf '%s' "$2" | tr '\t\n' '  ' | cut -c1-200)" >> "${timings_log}"
}

# Runs the steps of one lane in order, each from its directory, and leaves `<exit code> <seconds>` in
# the lane's status file. Its output goes to the lane's log; fd 3 is the terminal of the runner.
run_lane() {
  local index="$1" name="${LANE_NAMES[$1]}" log="${log_dir}/${LANE_NAMES[$1]}.log"
  local code=0 lane_started step_started step_clock j
  lane_started="$(date +%s)"
  for ((j = 0; j < ${#STEP_LANE[@]}; j++)); do
    [ "${STEP_LANE[$j]}" -eq "${index}" ] || continue
    echo "▶ ${name}: ${STEP_CMD[$j]}" >&3
    echo "===== ${STEP_DIR[$j]}: ${STEP_CMD[$j]}" >> "${log}"
    step_started="$(date +%s)"
    step_clock="$(now)"
    # Without fd 3: a process that outlives its step must not hold the terminal of the runner open, or
    # whoever reads the runner through a pipe waits for that process.
    (cd "${root}/${STEP_DIR[$j]}" && exec bash -c "${STEP_CMD[$j]}") >> "${log}" 2>&1 < /dev/null 3>&- || code=$?
    log_timing "${name}" "${STEP_CMD[$j]}" "${step_clock}" "${code}"
    if [ "${code}" -ne 0 ]; then
      echo "❌ ${name}: ${STEP_CMD[$j]} (exit ${code}, $(($(date +%s) - step_started))s)" >&3
      break
    fi
    echo "✅ ${name}: ${STEP_CMD[$j]} ($(($(date +%s) - step_started))s)" >&3
  done
  echo "${code} $(($(date +%s) - lane_started))" > "${log_dir}/${name}.status.tmp"
  mv "${log_dir}/${name}.status.tmp" "${log_dir}/${name}.status"
}

# Job control gives each lane a process group of its own, which is what lets the runner stop a whole
# lane, its npm, its test runner and its nodes, and nothing else. Inside the lane it is off again, so
# the lane's commands stay in that one group.
start_lane() {
  set -m
  (
    set +m
    run_lane "$1"
  ) &
  PID[$1]=$!
  set +m
  STATE[$1]=running
}

group_alive() {
  kill -0 -- "-$1" 2>/dev/null
}

# Stops every running lane: TERM to its group, a wait, then KILL for what is left.
stop_lanes() {
  local i waited=0 left
  for ((i = 0; i < lane_count; i++)); do
    if [ "${STATE[$i]}" = running ]; then kill -TERM -- "-${PID[$i]}" 2>/dev/null; fi
  done
  while [ "${waited}" -lt $((STOP_GRACE_SECONDS * 5)) ]; do
    left=0
    for ((i = 0; i < lane_count; i++)); do
      if [ "${STATE[$i]}" = running ] && group_alive "${PID[$i]}"; then left=1; fi
    done
    [ "${left}" -eq 1 ] || break
    sleep 0.2
    waited=$((waited + 1))
  done
  for ((i = 0; i < lane_count; i++)); do
    [ "${STATE[$i]}" = running ] || continue
    if group_alive "${PID[$i]}"; then kill -KILL -- "-${PID[$i]}" 2>/dev/null; fi
    wait "${PID[$i]}" 2>/dev/null
    STATE[$i]=stopped
    echo "⏹  ${LANE_NAMES[$i]}: stopped" >&3
  done
}

interrupted=""
trap 'interrupted=INT' INT
trap 'interrupted=TERM' TERM

# 0 when every lane this one starts after has passed, or is not part of this run.
ready() {
  local name index
  for name in ${LANE_AFTER[$1]//,/ }; do
    index="$(lane_index "${name}")"
    case "${STATE[$index]}" in passed | off) ;; *) return 1 ;; esac
  done
  return 0
}

failed=0
run_started="$(date +%s)"
while :; do
  running=0
  pending=0
  for ((i = 0; i < lane_count; i++)); do
    [ "${STATE[$i]}" = running ] || continue
    if [ -f "${log_dir}/${LANE_NAMES[$i]}.status" ]; then
      read -r code seconds < "${log_dir}/${LANE_NAMES[$i]}.status"
      wait "${PID[$i]}" 2>/dev/null
      SECONDS_TAKEN[$i]="${seconds}"
      if [ "${code}" -eq 0 ]; then STATE[$i]=passed; else STATE[$i]=failed; failed=1; fi
    elif ! kill -0 "${PID[$i]}" 2>/dev/null; then
      # Gone without a status: killed from outside.
      wait "${PID[$i]}" 2>/dev/null
      STATE[$i]=failed
      failed=1
      echo "❌ ${LANE_NAMES[$i]}: ended without a result" >&3
    else
      running=$((running + 1))
    fi
  done

  if [ "${failed}" -eq 1 ] || [ -n "${interrupted}" ]; then
    stop_lanes
    break
  fi

  for ((i = 0; i < lane_count; i++)); do
    [ "${STATE[$i]}" = pending ] || continue
    if { [ "${jobs}" -eq 0 ] || [ "${running}" -lt "${jobs}" ]; } && ready "$i"; then
      start_lane "$i"
      running=$((running + 1))
    else
      pending=$((pending + 1))
    fi
  done

  if [ "${running}" -eq 0 ]; then
    if [ "${pending}" -gt 0 ]; then
      echo "run-lanes.sh: some lanes wait for each other and can never start" >&2
      failed=1
    fi
    break
  fi
  sleep 0.2
done

# ---- After the run --------------------------------------------------------------------------------

echo
problems=0
for ((i = 0; i < lane_count; i++)); do
  case "${STATE[$i]}" in
    off) ;;
    passed) printf '✅ %-22s %ss\n' "${LANE_NAMES[$i]}" "${SECONDS_TAKEN[$i]}" ;;
    failed) printf '❌ %-22s %ss\n' "${LANE_NAMES[$i]}" "${SECONDS_TAKEN[$i]}"; problems=1 ;;
    stopped) printf '⏹  %-22s stopped\n' "${LANE_NAMES[$i]}"; problems=1 ;;
    *) printf '⏭  %-22s not started\n' "${LANE_NAMES[$i]}"; problems=1 ;;
  esac
done
echo "total: $(($(date +%s) - run_started))s, logs in ${log_dir}"

for ((i = 0; i < lane_count; i++)); do
  [ "${STATE[$i]}" = failed ] || continue
  echo
  echo "---- the end of ${log_dir}/${LANE_NAMES[$i]}.log"
  tail -n "${FAILED_LOG_TAIL}" "${log_dir}/${LANE_NAMES[$i]}.log" 2>/dev/null
done

# A suite that skipped on a busy port exited 0: only its log says that it tested nothing.
for ((i = 0; i < lane_count; i++)); do
  [ -f "${log_dir}/${LANE_NAMES[$i]}.log" ] || continue
  if grep -q "${BUSY_PORT_SKIP}" "${log_dir}/${LANE_NAMES[$i]}.log"; then
    echo "❌ ${LANE_NAMES[$i]}: a suite skipped because its port was busy (see ${log_dir}/${LANE_NAMES[$i]}.log)" >&2
    problems=1
  fi
done

if [ "${watch_tree}" -eq 1 ]; then
  tree_after="$(tree_status)"
  if [ "${tree_after}" != "${tree_before}" ]; then
    echo "❌ the run changed the tree. git status before and after:" >&2
    diff <(echo "${tree_before}") <(echo "${tree_after}") >&2
    problems=1
  fi
fi

left="$(answering_ports)"
if [ -n "${left}" ]; then
  echo "❌ port(s) ${left} still answer after the run: a node outlived its lane" >&2
  problems=1
fi

case "${interrupted}" in
  INT) echo "run-lanes.sh: interrupted" >&2; exit 130 ;;
  TERM) echo "run-lanes.sh: terminated" >&2; exit 143 ;;
esac
[ "${problems}" -eq 0 ] && [ "${failed}" -eq 0 ]
