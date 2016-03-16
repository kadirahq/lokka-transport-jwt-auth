export function wink() {
  return new Promise(fn => process.nextTick(fn));
}

export function sleep(ms) {
  return new Promise(fn => setTimeout(fn, ms));
}
