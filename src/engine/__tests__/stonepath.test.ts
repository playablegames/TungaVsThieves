// THE STONE'S PATH (2026-10-12): in every finished game, each Stone's traced journey must end exactly where the Stone
// really is — in a player's hand, on the table (the village), or sent to a team by the mandatory vote. Also: everyone
// holds at most 2 cards between turns (the "everyone holds 2" rule).
import { describe, expect, it } from "vitest";
import { apply, start, waitingOn } from "../engine";
import { randomAction } from "../decisions";
import type { GameState } from "../types";
import { stonePaths, type StoneCard } from "../stonepath";
import { NAMES } from "./helpers";

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function where(s: GameState, c: StoneCard): string {
  if ((s.thiefPot ?? []).includes(c)) return "thieves";
  if ((s.villagePot ?? []).includes(c) || s.pile.includes(c)) return "village";
  const p = s.players.find((x) => x.hand.includes(c));
  return p ? `seat ${p.seat}` : "nowhere";
}

describe("STONE PATH (2026-10-12) — the end screen's journey matches the truth", () => {
  it("ends where each Stone really is, in 400 random games at 5–12 players", () => {
    let over = 0, maxHand = 0;
    for (let g = 0; g < 400; g++) {
      const n = 5 + (g % 8);
      const r = mulberry(g + 1);
      let s = start(NAMES(n), g + 1);
      for (let k = 0; k < 4000 && s.phase.kind !== "over"; k++) {
        if (s.phase.kind === "turn") for (const p of s.players) if (p.alive && p.seat !== s.phase.seat) maxHand = Math.max(maxHand, p.hand.length);
        const seat = waitingOn(s)[0];
        s = apply(s, seat, randomAction(s, seat, r));
      }
      if (s.phase.kind !== "over") continue;
      over++;
      const paths = stonePaths(s);
      for (const c of ["STONE_1", "STONE_2"] as StoneCard[]) {
        const last = paths[c].filter((x) => x.kind !== "seen").at(-1)!;
        const traced = last.kind === "end" ? last.to : last.kind === "holder" ? `seat ${last.seat}` : "?";
        expect(traced, `game ${g} ${c}`).toBe(where(s, c));
      }
    }
    expect(over).toBeGreaterThan(350);
    // between turns nobody holds more than 2 (a Hera Pheri victim short of cards may hold fewer)
    expect(maxHand).toBeLessThanOrEqual(2);
  });
});
