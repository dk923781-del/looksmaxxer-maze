// Tiny event bus between the Phaser scene and the DOM UI.
const map = new Map();
export const bus = {
  on(e, fn) {
    if (!map.has(e)) map.set(e, []);
    map.get(e).push(fn);
  },
  off(e, fn) {
    const a = map.get(e);
    if (a) map.set(e, a.filter((f) => f !== fn));
  },
  emit(e, ...args) {
    for (const f of map.get(e) || []) f(...args);
  },
};
