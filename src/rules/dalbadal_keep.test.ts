// (owner 2026-11-23, "B") Dal Badal is played holding 2 cards: Dal Badal + the one you keep; the other 3 go on by
// themselves and the draw of 1 is automatic — no pass step.
import { describe, expect, it } from "vitest";
import { move, newGame, type Card, type State } from "./game";

function thiefTurn(): { s: State; seat: number } {
  for (let seed = 1; seed < 400; seed++) {
    const s = newGame(["A", "B", "C", "D", "E", "F"], seed);
    const ph = s.phase as { kind: string; seat?: number };
    if (ph.kind !== "turn" || ph.seat === undefined) continue;
    const p = s.players[ph.seat];
    if (p.side !== "T" || p.hand.length !== 5) continue;
    if (!p.hand.includes("DAL_BADAL")) { // arrange it: swap Dal Badal in from wherever it is
      const other = s.players.find((q) => q.hand.includes("DAL_BADAL"));
      if (!other) continue;
      const i = other.hand.indexOf("DAL_BADAL"); other.hand[i] = p.hand[0]; p.hand[0] = "DAL_BADAL";
    }
    return { s, seat: ph.seat };
  }
  throw new Error("no thief turn found");
}

describe("Dal Badal with the card you keep", () => {
  it("passes the other 3 at once and draws 1", () => {
    const { s, seat } = thiefTurn();
    const keep = s.players[seat].hand.find((c) => c !== "DAL_BADAL") as Card;
    const others = s.players.filter((p) => p.seat !== seat).slice(0, 3).map((p) => p.seat);
    const after = move(s, seat, { kind: "dal_badal", targets: others, keep });
    const me = after.players[seat];
    expect(me.hand).toContain(keep);
    expect(me.hand.length).toBe(2);
    const ph = after.phase as { kind: string; seat?: number };
    expect(ph.kind === "pass" && ph.seat === seat).toBe(false);
    const pass = [...after.events].reverse().find((e) => e.type === "pass");
    expect((pass?.data as { auto?: boolean }).auto).toBe(true);
  });
  it("refuses a keep card you don't hold", () => {
    const { s, seat } = thiefTurn();
    const others = s.players.filter((p) => p.seat !== seat).slice(0, 3).map((p) => p.seat);
    const missing = (["KUNDLI", "TALASHI", "FAISLA", "BHUKAMP", "HERA_PHERI", "TEER_KAMAN", "TUNGA_STONE"] as Card[]).find((c) => !s.players[seat].hand.includes(c))!;
    expect(() => move(s, seat, { kind: "dal_badal", targets: others, keep: missing })).toThrow();
  });
});
