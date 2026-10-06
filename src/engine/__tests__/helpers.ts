import { start } from "../engine";
import type { Card, GameState, Side } from "../types";

export const NAMES = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);

/** A started game with roles, hands and pile overridden for a precise scenario. */
export function rig(
  n: number,
  opts: { sides?: Side[]; hands?: Card[][]; pile?: Card[]; seed?: number } = {},
): GameState {
  const s = start(NAMES(n), opts.seed ?? 1);
  if (opts.sides) {
    const v = s.rolesInPlay.filter((r) => s.players.find((p) => p.role === r)!.side === "V");
    const t = s.rolesInPlay.filter((r) => s.players.find((p) => p.role === r)!.side === "T");
    let vi = 0, ti = 0;
    opts.sides.forEach((side, seat) => {
      const p = s.players[seat];
      p.side = side;
      p.role = side === "V" ? v[vi++] ?? `V${vi}` : t[ti++] ?? `T${ti}`;
    });
    s.rolesInPlay = s.players.map((p) => p.role).sort();
  }
  if (opts.hands) {
    // put the cards we take back into the deck so the card total stays 66
    const pool = [...s.deck, ...s.discard, ...s.pile, ...s.players.flatMap((p) => p.hand)];
    s.discard = [];
    s.players.forEach((p, i) => (p.hand = [...(opts.hands![i] ?? [])]));
    s.pile = [...(opts.pile ?? [])];
    const used = [...s.pile, ...s.players.flatMap((p) => p.hand)];
    for (const c of used) { const i = pool.indexOf(c); if (i >= 0) pool.splice(i, 1); }
    s.deck = pool.filter((c) => c !== "STONE_1" && c !== "STONE_2");
  }
  return s;
}

export const totalCards = (s: GameState) =>
  s.deck.length + s.discard.length + s.pile.length + s.players.reduce((k, p) => k + p.hand.length, 0);
