// HOW MANY GAMES THIS PHONE HAS FINISHED (owner 2026-11-23, step 5 "the pleasant table"): the server seats more beginner
// bots around a new player and more skilled ones around an old hand. Kept on the phone only; each game counts once.
const KEY = "tunga.games";
const SEEN = "tunga.games.seen";

export function gamesPlayed(): number {
  try { return Math.max(0, Number(localStorage.getItem(KEY) ?? 0) || 0); } catch { return 0; }
}

/** a finished game, counted once per table code */
export function countGame(code: string) {
  try {
    const seen = (JSON.parse(localStorage.getItem(SEEN) ?? "[]") as string[]).slice(-50);
    if (seen.includes(code)) return;
    localStorage.setItem(SEEN, JSON.stringify([...seen, code]));
    localStorage.setItem(KEY, String(gamesPlayed() + 1));
  } catch {}
}
