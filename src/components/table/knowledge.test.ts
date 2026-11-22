import { describe, expect, it } from "vitest";
import { move, newGame, view, type State } from "@/rules/game";
import { notes, secrets } from "./knowledge";

const NAMES = ["Moon", "Pappu", "Babu", "Shyam", "Raju", "Munna"];

/** a seed where the player on turn holds a pair of `card` */
function withPair(card: string): State {
  for (let seed = 1; seed < 3000; seed++) {
    const s = newGame(NAMES, seed);
    if (s.phase.kind === "turn" && s.players[s.phase.seat].hand.filter((c) => c === card).length >= 2) return s;
  }
  throw new Error("no seed");
}

describe("what you know (owner 2026-11-22: 'I can't see the effects of the card played')", () => {
  it("Kundli: BOTH players get the other's role as a secret card and a seat tag", () => {
    const s0 = withPair("KUNDLI");
    const me = (s0.phase as { seat: number }).seat, them = (me + 2) % 6;
    const s = move(s0, me, { kind: "play", card: "KUNDLI", target: them });
    const mine = view(s, me), theirs = view(s, them);
    expect(secrets(mine.events, me, NAMES).at(-1)).toMatchObject({ title: "Kundli", role: s.players[them].role, line: `${NAMES[them]} is` });
    expect(secrets(theirs.events, them, NAMES).at(-1)).toMatchObject({ title: "Kundli", role: s.players[me].role });
    expect(notes(mine.events, me)[them]?.role).toBe(s.players[them].role);
    expect(notes(theirs.events, them)[me]?.role).toBe(s.players[me].role);
    // a third player learns nothing
    expect(notes(view(s, (me + 1) % 6).events, (me + 1) % 6)[them]).toBeUndefined();
  });

  it("Talashi shows the cards they held", () => {
    const s0 = withPair("TALASHI");
    const me = (s0.phase as { seat: number }).seat, them = (me + 1) % 6;
    const held = [...s0.players[them].hand];
    const s = move(s0, me, { kind: "play", card: "TALASHI", target: them });
    expect(secrets(view(s, me).events, me, NAMES).at(-1)?.cards).toEqual(held);
    expect(notes(view(s, me).events, me)[them]?.cards).toMatch(/^held /);
  });

  it("passing a Stone: only the passer knows who got it", () => {
    for (let seed = 1; seed < 3000; seed++) {
      const s0 = newGame(NAMES, seed);
      if (s0.phase.kind !== "turn") continue;
      const me = s0.phase.seat, hand = s0.players[me].hand;
      const st = hand.find((c) => c === "TUNGA_STONE" || c === "BHADRA_STONE");
      if (!st) continue;
      const rest = hand.filter((c, i) => i !== hand.indexOf(st)).slice(0, 2);
      const s = move(s0, me, { kind: "give", cards: [st, ...rest] });
      const next = (me + 1) % 6;
      expect(notes(view(s, me).events, me)[next]?.cards).toMatch(/^got your .*Stone/);
      expect(notes(view(s, next).events, next)[me]).toBeUndefined();
      return;
    }
    throw new Error("no seed");
  });
});
