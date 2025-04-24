export function currentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("en-US", { hour12: true, hour: "numeric", minute: "numeric", second: "numeric" });
}

// Official timestamp in js/ts
// Number of seconds elapsed since midnight, January 1, 1970 Universal Coordinated Time (UTC).
export function timestampNow(): number {
  return Math.floor(Date.now() / 1000);
}
