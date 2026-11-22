import { describe, expect, it } from "vitest";
import { move, newGame, view, type State } from "@/rules/game";
import { notes, publicTags, secrets } from "./knowledge";

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

  it("Talashi: the reveal shows their cards, the seat tag only the Stone (owner 2026-11-22)", () => {
    const s0 = withPair("TALASHI");
    const me = (s0.phase as { seat: number }).seat, them = (me + 1) % 6;
    const held = [...s0.players[them].hand];
    const s = move(s0, me, { kind: "play", card: "TALASHI", target: them });
    const st = held.filter((c) => c === "TUNGA_STONE" || c === "BHADRA_STONE");
    expect(secrets(view(s, me).events, me, NAMES).at(-1)?.cards).toEqual(held);
    expect(notes(view(s, me).events, me)[them]?.cards).toBe(st.length ? `has ${st.map((c) => (c === "TUNGA_STONE" ? "Tunga Stone" : "Bhadra Stone")).join(", ")}` : "no Stone");
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

describe("public tags (owner 2026-11-22: chat is private, tags are public)", () => {
  const say = (n: number, seat: number, talk: object) => ({ n, to: "all" as const, type: "say", msg: "", data: { seat, talk } });
  it("who said what about whom; side tags replace, retract and 'not the Stone' take back", () => {
    const ev = [
      say(0, 2, { t: "vouch", target: 2 }), say(1, 2, { t: "stone", target: 2, has: true, which: "TUNGA_STONE" }),
      say(2, 1, { t: "accuse", target: 2 }), say(3, 3, { t: "accuse", target: 2 }), say(4, 3, { t: "retract", target: 2 }),
      say(5, 2, { t: "accuse", target: 2 }), say(6, 2, { t: "stone", target: 2, has: false, which: "TUNGA_STONE" }),
      say(7, 4, { t: "claim", role: "Daku" }), say(8, 1, { t: "stone", target: 4, has: true, which: "BHADRA_STONE" }),
    ];
    expect(publicTags(ev as never)).toEqual({ 2: { Thief: [1, 2] }, 4: { Thief: [4], Bhadra: [1] } });
  });
});
