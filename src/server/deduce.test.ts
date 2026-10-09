import { describe, expect, it } from "vitest";
import { start } from "@/engine/engine";
import type { GameEvent, GameState } from "@/engine/types";
import { deduce } from "./deduce";
import { beliefVote, SKILLS } from "./belief";

const push = (s: GameState, e: Omit<GameEvent, "n">) => s.events.push({ ...e, n: s.events.length });
function table(n = 8, seed = 7) {
  const s = start(Array.from({ length: n }, (_, i) => `P${i}`), seed);
  const thieves = s.players.filter((p) => p.side === "T").map((p) => p.seat);
  const villagers = s.players.filter((p) => p.side === "V").map((p) => p.seat);
  return { s, thieves, villagers };
}

describe("a thief revealed — every bot's beliefs follow (exact deduction)", () => {
  it("a Kundli read, the Faisla caller's look, and a Teer Kaman hit each make it certain for that bot — and only that bot", () => {
    for (const type of ["kundli_private", "eliminated_private"] as const) {
      const { s, thieves, villagers } = table();
      const [me, other] = villagers, t = thieves[0];
      push(s, type === "kundli_private"
        ? { type, to: [me], msg: "", data: { target: t, role: s.players[t].role, side: "T" } }
        : { type, to: [me], msg: "", data: { seat: t, role: s.players[t].role, side: "T" } });
      expect(deduce(s, me).p.get(t)).toBeCloseTo(1, 6);
      expect(deduce(s, other).p.get(t)!).toBeLessThan(0.9); // a private look teaches only the one who looked
    }
  });

  it("whoever vouched for that thief now looks worse than someone who said nothing; whoever called it out, better", () => {
    // (thieves don't know their partners, so a vouch is bad judgement more than proof — and one thief found leaves
    // fewer thief places for everyone, so EVERY other seat's odds drop; the test is against a seat that stayed silent)
    const { s, thieves, villagers } = table();
    const me = villagers[0], t = thieves[0];
    const [defender, accuser, silent] = s.players.map((p) => p.seat).filter((x) => x !== me && x !== t);
    push(s, { type: "claim", to: "all", msg: "", data: { seat: defender, kind: "trust", target: t, side: "V" } });
    push(s, { type: "claim", to: "all", msg: "", data: { seat: accuser, kind: "accuse", target: t, side: "T" } });
    push(s, { type: "kundli_private", to: [me], msg: "", data: { target: t, role: s.players[t].role, side: "T" } });
    const p = deduce(s, me).p;
    expect(p.get(defender)!).toBeGreaterThan(p.get(silent)!);
    expect(p.get(accuser)!).toBeLessThan(p.get(silent)!);
  });

  it("a Dal Badal shows a thief to everyone, then the shuffle spreads it over the three seats", () => {
    const { s, thieves, villagers } = table();
    const t = thieves[0], [a, b, me] = villagers;
    push(s, { type: "dal_badal", to: "all", msg: "", data: { seat: t, role: s.players[t].role, seats: [t, a, b] } });
    const p = deduce(s, me).p;
    const three = [t, a, b].map((x) => p.get(x)!);
    // the shown thief card is now in one of the three hands — together they hold more than their fair share
    expect(three.reduce((x, y) => x + y, 0)).toBeGreaterThan(1);
    for (const x of three) expect(x).toBeGreaterThan(0.3);
  });

  it("a bot that knows a living thief votes for it", () => {
    const { s, thieves, villagers } = table();
    const me = villagers[0], t = thieves[0];
    push(s, { type: "kundli_private", to: [me], msg: "", data: { target: t, role: s.players[t].role, side: "T" } });
    expect(beliefVote(s, me, s.seed, () => 0.1, SKILLS.sharp)).toBe(t);
  });
});
