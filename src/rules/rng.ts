// mulberry32 — tiny seeded RNG. The state lives in GameState so every game replays exactly.

export function next(state: { rng: number }): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function int(state: { rng: number }, n: number): number {
  return Math.floor(next(state) * n);
}

export function shuffle<T>(state: { rng: number }, xs: T[]): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = int(state, i + 1);
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

export function pick<T>(state: { rng: number }, xs: T[]): T {
  return xs[int(state, xs.length)];
}
