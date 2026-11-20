#!/usr/bin/env bash
#
# The tests of scripts/run-lanes.sh, on throwaway lanes in a throwaway git checkout: no test of the
# workspace runs here, and no port of the workspace's map is used.
#
# Usage: ./scripts/run-lanes.test.sh
#
#   RUN_LANES=<file>   the runner to test (default: the run-lanes.sh beside this script). Point it at
#                      a copy with one check removed to see the matching test fail.
#
# Needs git, node (for a process that listens on a port) and bash, like the runner itself.
#
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
runner="${RUN_LANES:-${here}/run-lanes.sh}"

# Outside the workspace's map (8545-8799), and unlikely to be taken.
readonly PORT_A=47311
readonly PORT_B=47312

work="$(mktemp -d "${TMPDIR:-/tmp}/run-lanes-test.XXXXXX")"
work="$(cd "${work}" && pwd -P)"
# The runner keeps its lock and its default logs under TMPDIR: the tests give it one of their own.
mkdir "${work}/tmp"
started_pids=""

cleanup() {
  local pid
  for pid in ${started_pids}; do kill -KILL "${pid}" 2>/dev/null; done
  rm -rf "${work}"
}
trap cleanup EXIT

passed=0
failures=0
current=""

fail() {
  echo "    ✖ $*"
  case_failed=1
}

check() {
  local description="$1"
  shift
  "$@" || fail "${description}"
}

# A fresh checkout with a port map and a lane file read from stdin. Sets `repo`, `out` and `logs`.
new_repo() {
  repo="${work}/${current}/repo"
  out="${work}/${current}/out"
  logs="${work}/${current}/logs"
  mkdir -p "${repo}/scripts" "${repo}/pkg" "${out}"
  echo '{ "groups": { "test": { "range": ['"${PORT_A}"', '"${PORT_B}"'], "ports": { "a": '"${PORT_A}"', "b": '"${PORT_B}"' } } } }' \
    > "${repo}/test-ports.config.json"
  cat > "${repo}/scripts/ci-lanes.sh"
  git -C "${repo}" init -q
  git -C "${repo}" add -A
  git -C "${repo}" -c user.name=test -c user.email=test@example.invalid commit -q -m init
}

# Runs the runner on `repo`. Sets `status` and `output`.
run() {
  output="$(OUT="${out}" TMPDIR="${work}/tmp" "${runner}" --root "${repo}" --log-dir "${logs}" "$@" 2>&1)"
  status=$?
}

# The same in the background. Sets `runner_pid`; its output goes to `out`/output. A shell starts a
# background command with SIGINT ignored, and a program cannot trap a signal it was started ignoring, so
# perl puts the default back before it becomes the runner.
run_in_background() {
  OUT="${out}" TMPDIR="${work}/tmp" perl -e '$SIG{INT} = "DEFAULT"; exec @ARGV' \
    "${runner}" --root "${repo}" --log-dir "${logs}" "$@" > "${out}/output" 2>&1 &
  runner_pid=$!
  started_pids="${started_pids} ${runner_pid}"
}

wait_for_file() {
  local tries=0
  until [ -s "$1" ]; do
    tries=$((tries + 1))
    [ "${tries}" -lt 100 ] || return 1
    sleep 0.1
  done
}

alive() {
  kill -0 "$1" 2>/dev/null
}

port_answers() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# Starts a process that listens on a port, and waits until it answers. Sets `listener_pid`.
listen_on() {
  node -e 'require("node:net").createServer().listen(Number(process.argv[1]), "127.0.0.1")' "$1" &
  listener_pid=$!
  started_pids="${started_pids} ${listener_pid}"
  local tries=0
  until port_answers "$1"; do
    tries=$((tries + 1))
    [ "${tries}" -lt 100 ] || return 1
    sleep 0.1
  done
}

it() {
  current="case-$((passed + failures + 1))"
  case_failed=0
  echo "• $1"
  "$2"
  if [ "${case_failed}" -eq 0 ]; then
    passed=$((passed + 1))
  else
    failures=$((failures + 1))
    echo "    output of the last run:"
    printf '%s\n' "${output:-}" | sed 's/^/      /'
  fi
}

# ---- The cases ------------------------------------------------------------------------------------

runs_lanes_in_order() {
  new_repo << 'EOF'
lane first
step pkg 'echo one > "$OUT/first"'
step . 'pwd > "$OUT/first-pwd"; cat "$OUT/first" > "$OUT/first-again"'
lane second after first
step pkg 'cat "$OUT/first-again" > "$OUT/second"'
lane beside
step pkg 'echo beside > "$OUT/beside"'
EOF
  run
  check "exit 0, got ${status}" [ "${status}" -eq 0 ]
  check "the lane after 'first' read what it wrote" [ "$(cat "${out}/second" 2>/dev/null)" = one ]
  check "a step runs from its directory" [ "$(cat "${out}/first-pwd" 2>/dev/null)" = "${repo}" ]
  check "the lane beside ran" [ -f "${out}/beside" ]
  check "each lane has a log" [ -f "${logs}/first.log" ] && [ -f "${logs}/second.log" ]
  check "the summary names each lane" grep -q '✅ second' <<< "${output}"
}

a_failing_lane_fails_the_run_and_stops_the_others() {
  new_repo << 'EOF'
lane slow
step pkg 'echo $$ > "$OUT/slow.pid"; sleep 120'
lane broken
step pkg 'while [ ! -s "$OUT/slow.pid" ]; do sleep 0.1; done; echo "the reason it failed"; exit 7'
step pkg 'echo never > "$OUT/after-the-failure"'
lane later after broken
step pkg 'echo never > "$OUT/later"'
EOF
  local before="${SECONDS}"
  run
  check "exit 1, got ${status}" [ "${status}" -eq 1 ]
  # A lane left running would also hold the output of the runner open until its sleep ends.
  check "the run ends when the lane fails, not when the slow lane ends" [ $((SECONDS - before)) -lt 60 ]
  check "the lane beside the failure is stopped" eval '! alive "$(cat "${out}/slow.pid")"'
  check "a lane stops at its first failing step" [ ! -e "${out}/after-the-failure" ]
  check "a lane after a failed one does not start" [ ! -e "${out}/later" ]
  check "the summary says which lane failed" grep -q '❌ broken' <<< "${output}"
  check "the end of the failed log is printed" grep -q 'the reason it failed' <<< "${output}"
}

a_busy_port_refuses_the_run() {
  new_repo << 'EOF'
lane only
step pkg 'echo ran > "$OUT/ran"'
EOF
  listen_on "${PORT_B}" || fail "could not listen on ${PORT_B}"
  run
  check "exit 2, got ${status}" [ "${status}" -eq 2 ]
  check "no lane started" [ ! -e "${out}/ran" ]
  check "the message names the port" grep -q "port(s) ${PORT_B}" <<< "${output}"
  check "the process that holds the port is left alone" alive "${listener_pid}"
  kill "${listener_pid}" 2>/dev/null
  wait "${listener_pid}" 2>/dev/null
}

a_busy_port_skip_in_a_log_fails_the_run() {
  new_repo << 'EOF'
lane skipper
step pkg 'echo "# SKIP something is already listening on http://127.0.0.1:1 — refusing to deploy onto it"'
EOF
  run
  check "exit 1, got ${status}" [ "${status}" -eq 1 ]
  check "the message names the lane" grep -q '❌ skipper: a suite skipped' <<< "${output}"
}

a_changed_tree_fails_the_run() {
  new_repo << 'EOF'
lane writer
step pkg 'echo generated > left-behind.txt'
EOF
  run
  check "exit 1, got ${status}" [ "${status}" -eq 1 ]
  check "the message shows the file" grep -q 'left-behind.txt' <<< "${output}"
}

a_node_that_outlives_its_lane_fails_the_run() {
  new_repo << 'EOF'
lane leaky
step pkg 'perl -MPOSIX -e "POSIX::setsid(); exec @ARGV" node -e "require(\"node:net\").createServer().listen($PORT, \"127.0.0.1\"); console.log(process.pid)" > "$OUT/node.pid" 2>/dev/null & while [ ! -s "$OUT/node.pid" ]; do sleep 0.1; done; sleep 0.5'
EOF
  PORT="${PORT_A}" run
  started_pids="${started_pids} $(cat "${out}/node.pid" 2>/dev/null)"
  check "exit 1, got ${status}" [ "${status}" -eq 1 ]
  check "the message names the port" grep -q "port(s) ${PORT_A} still answer" <<< "${output}"
  kill -KILL "$(cat "${out}/node.pid" 2>/dev/null)" 2>/dev/null
  sleep 0.3
}

# $1 is the signal, $2 the exit code it must give.
a_signal_stops_every_lane() {
  new_repo << 'EOF'
lane node
step pkg 'node -e "require(\"node:net\").createServer().listen($PORT, \"127.0.0.1\"); console.log(process.pid)" > "$OUT/node.pid" & wait'
lane sleeper
step pkg 'echo $$ > "$OUT/sleeper.pid"; sleep 120'
lane later after sleeper
step pkg 'echo never > "$OUT/later"'
EOF
  PORT="${PORT_A}" run_in_background
  wait_for_file "${out}/node.pid" && wait_for_file "${out}/sleeper.pid" || fail "the lanes did not start"
  local tries=0
  until port_answers "${PORT_A}" || [ "${tries}" -ge 100 ]; do tries=$((tries + 1)); sleep 0.1; done
  kill "-$1" "${runner_pid}"
  wait "${runner_pid}"
  status=$?
  output="$(cat "${out}/output")"
  check "exit $2, got ${status}" [ "${status}" -eq "$2" ]
  check "the sleeping lane is stopped" eval '! alive "$(cat "${out}/sleeper.pid")"'
  check "the node of the other lane is stopped" eval '! alive "$(cat "${out}/node.pid")"'
  check "its port no longer answers" eval '! port_answers "${PORT_A}"'
  check "no lane started afterwards" [ ! -e "${out}/later" ]
}

ctrl_c_stops_every_lane() { a_signal_stops_every_lane INT 130; }
sigterm_stops_every_lane() { a_signal_stops_every_lane TERM 143; }

a_second_runner_in_the_same_checkout_is_refused() {
  new_repo << 'EOF'
lane sleeper
step pkg 'echo $$ > "$OUT/sleeper.pid"; sleep 120'
EOF
  run_in_background
  wait_for_file "${out}/sleeper.pid" || fail "the first runner did not start its lane"
  run
  check "exit 2, got ${status}" [ "${status}" -eq 2 ]
  check "the message names the first runner" grep -q "another run-lanes.sh (pid ${runner_pid})" <<< "${output}"
  check "the first runner is left alone" alive "${runner_pid}"
  kill -TERM "${runner_pid}"
  wait "${runner_pid}" 2>/dev/null
  run --list
  check "the lock is released: a later run is accepted, got ${status}" [ "${status}" -eq 0 ]
  new_lanes_pass
}

# After a stopped run in the same checkout, a plain run must work again.
new_lanes_pass() {
  cat > "${repo}/scripts/ci-lanes.sh" << 'EOF'
lane quick
step pkg 'true'
EOF
  git -C "${repo}" -c user.name=test -c user.email=test@example.invalid commit -q -am lanes
  run
  check "a run after a stopped one passes, got ${status}" [ "${status}" -eq 0 ]
}

only_runs_the_named_lanes() {
  new_repo << 'EOF'
lane prelude
step pkg 'echo ran > "$OUT/prelude"'
lane wanted after prelude
step pkg 'echo ran > "$OUT/wanted"'
lane other
step pkg 'echo ran > "$OUT/other"'
EOF
  run --only wanted
  check "exit 0, got ${status}" [ "${status}" -eq 0 ]
  check "the named lane ran, though the lane before it was not asked for" [ -f "${out}/wanted" ]
  check "no other lane ran" [ ! -e "${out}/prelude" ] && [ ! -e "${out}/other" ]
  run --only missing
  check "an unknown lane is refused with exit 2, got ${status}" [ "${status}" -eq 2 ]
}

except_runs_every_lane_but_the_named_ones() {
  new_repo << 'EOF'
lane left-out
step pkg 'echo ran > "$OUT/left-out"'
lane wanted after left-out
step pkg 'echo ran > "$OUT/wanted"'
EOF
  run --except left-out
  check "exit 0, got ${status}" [ "${status}" -eq 0 ]
  check "the other lane ran, though it starts after the one left out" [ -f "${out}/wanted" ]
  check "the lane left out did not run" [ ! -e "${out}/left-out" ]
  run --except missing
  check "an unknown lane is refused with exit 2, got ${status}" [ "${status}" -eq 2 ]
}

timings_are_logged_for_each_step() {
  new_repo << 'EOF'
lane timed
step pkg 'true'
step pkg 'exit 3'
EOF
  FHEVM_TIMINGS_LOG="${out}/timings.tsv" run
  check "exit 1, got ${status}" [ "${status}" -eq 1 ]
  check "one line for each step" [ "$(wc -l < "${out}/timings.tsv" | tr -d ' ')" -eq 2 ]
  check "a line holds the exit code, the kind, the lane and the command" \
    grep -q "$(printf '3\t0\tlane\ttimed\texit 3')\$" "${out}/timings.tsv"
}

jobs_limits_the_lanes_running_at_once() {
  new_repo << 'EOF'
lane a
step pkg 'touch "$OUT/in-a"; sleep 1; test ! -e "$OUT/in-b" || touch "$OUT/overlap"; rm "$OUT/in-a"'
lane b
step pkg 'touch "$OUT/in-b"; sleep 1; test ! -e "$OUT/in-a" || touch "$OUT/overlap"; rm "$OUT/in-b"'
EOF
  run --jobs 1
  check "exit 0, got ${status}" [ "${status}" -eq 0 ]
  check "the two lanes did not overlap" [ ! -e "${out}/overlap" ]
  run
  check "without --jobs they run at the same time" [ -e "${out}/overlap" ]
}

a_wrong_lane_file_is_refused() {
  new_repo << 'EOF'
lane a after nowhere
step pkg 'true'
EOF
  run
  check "a lane after an unknown lane: exit 2, got ${status}" [ "${status}" -eq 2 ]

  current="${current}-b"
  new_repo << 'EOF'
lane a after b
step pkg 'echo ran > "$OUT/a"'
lane b after a
step pkg 'echo ran > "$OUT/b"'
EOF
  run
  check "two lanes that wait for each other: exit 1, got ${status}" [ "${status}" -eq 1 ]

  current="${current}-c"
  new_repo << 'EOF'
lane empty
EOF
  run
  check "a lane without a step: exit 2, got ${status}" [ "${status}" -eq 2 ]

  current="${current}-d"
  new_repo << 'EOF'
lane a
step no-such-directory 'true'
EOF
  run
  check "a step in a missing directory: exit 2, got ${status}" [ "${status}" -eq 2 ]
}

list_prints_the_lanes_and_runs_nothing() {
  new_repo << 'EOF'
lane a
step pkg 'echo ran > "$OUT/a"'
lane b after a
step . 'true'
EOF
  run --list
  check "exit 0, got ${status}" [ "${status}" -eq 0 ]
  check "it prints the lane and what it starts after" grep -q '^b  (after a)$' <<< "${output}"
  check "it prints each step with its directory" grep -q "^    pkg: echo ran" <<< "${output}"
  check "nothing ran" [ ! -e "${out}/a" ]
}

it "runs the steps of a lane in order, and a lane after the lanes it names" runs_lanes_in_order
it "a failing lane fails the run and stops the others" a_failing_lane_fails_the_run_and_stops_the_others
it "a busy port of the map refuses the run, and nothing is stopped" a_busy_port_refuses_the_run
it "a busy-port skip in a log fails the run" a_busy_port_skip_in_a_log_fails_the_run
it "a changed tree fails the run" a_changed_tree_fails_the_run
it "a node that outlives its lane fails the run" a_node_that_outlives_its_lane_fails_the_run
it "Ctrl-C stops every lane and its node" ctrl_c_stops_every_lane
it "SIGTERM stops every lane and its node" sigterm_stops_every_lane
it "a second runner in the same checkout is refused" a_second_runner_in_the_same_checkout_is_refused
it "--only runs the named lanes" only_runs_the_named_lanes
it "--except runs every lane but the named ones" except_runs_every_lane_but_the_named_ones
it "each step is added to the timing log" timings_are_logged_for_each_step
it "--jobs limits the lanes running at once" jobs_limits_the_lanes_running_at_once
it "a wrong lane file is refused" a_wrong_lane_file_is_refused
it "--list prints the lanes and runs nothing" list_prints_the_lanes_and_runs_nothing

echo
echo "run-lanes.test.sh: ${passed} passed, ${failures} failed"
[ "${failures}" -eq 0 ]
