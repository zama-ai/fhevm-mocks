import * as picocolors from "picocolors";

import constants from "../constants";

function _log(msg: string, options?: { nocolor?: boolean; out?: "stderr" | "stdout" | "console" }) {
  if (options?.out === "stderr") {
    // use process.sterr.write instead of console.log to escape HH catpure
    // HH colorizes in red all console.error() calls.
    //console.error(msg);
    process.stderr.write(msg + "\n");
  } else if (options?.out === "stdout") {
    process.stdout.write(msg + "\n");
  } else if (options?.out === "console") {
    console.log(msg);
  } else {
    console.log(msg);
  }
}

export function logBox(
  msg: string,
  submsg: string,
  options?: {
    titleColor?: "green" | "red" | "yellow";
    textColor?: "green" | "red" | "yellow";
    nocolor?: boolean;
    out?: "stderr" | "stdout" | "console";
  },
) {
  const left = " ".repeat(1);
  const inner = " ".repeat(2);

  const prefix = constants.HARDHAT_PLUGIN_NAME + ":";

  let len = msg.length + prefix.length + 1;

  const lines = submsg.split("\n");
  for (let i = 0; i < lines.length; ++i) {
    len = lines[i].length > len ? lines[i].length : len;
  }

  const n = len + inner.length * 2;

  let middle = "";
  for (let i = 0; i < lines.length; ++i) {
    const l = `${lines[i]}`;
    const m = left + "║" + inner + l + inner;
    const extra = " ".repeat(len - lines[i].length);

    middle += m + extra + "║\n";
  }

  const top = left + "╔" + "═".repeat(n) + "╗\n";

  let titleMsg = prefix + " " + msg;
  if (options?.nocolor !== true) {
    if (options?.titleColor === "green" || !options?.titleColor) {
      titleMsg = picocolors.greenBright(picocolors.bold(titleMsg));
    } else if (options?.titleColor === "red") {
      titleMsg = picocolors.redBright(picocolors.bold(titleMsg));
    } else if (options?.titleColor === "yellow") {
      titleMsg = picocolors.yellowBright(picocolors.bold(titleMsg));
    }
  }

  const extra = " ".repeat(len - msg.length - prefix.length - 1);
  const title = left + "║" + inner + titleMsg + inner + extra + "║\n";
  const horiz = left + "╠" + "═".repeat(n) + "╣\n";

  const bottom = left + "╚" + "═".repeat(n) + "╝";
  let box = top + title + horiz + middle + bottom;

  if (options?.textColor === "green") {
    box = picocolors.greenBright(box);
  } else if (options?.textColor === "red") {
    box = picocolors.redBright(box);
  } else if (options?.textColor === "yellow") {
    box = picocolors.yellowBright(box);
  }

  _log(picocolors.reset(""), options);
  _log(box, options);
  _log("", options);
}

export function jsonStringifyBigInt(value: any, space?: string | number): string {
  return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v), space);
}
