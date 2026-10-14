import { describe, expect, it } from "vitest";
import { apply, waitingOn } from "../engine";
import { type Card, type GameState } from "../types";
import { rig } from "./helpers";

// DAL BADAL AS A SHIELD (designer 2026-10-14, behind state.dbShield): a thief holding it may answer a Teer Kaman, a
// Kundli or a Faisla exit before it resolves — and use it in any debate
const F: Card = "FAISLA", T: Card = "TALASHI", K: Card = "KUNDLI", H: Card = "HERA_PHERI", B: Card = "BATWARA", TK: Card = "TEER_KAMAN", DB: Card = "DAL_BADAL";
const shielded = (s: GameState) => { s.dbShield = true; return s; };
const pickAll = (s: GameState) => { while (s.phase.kind === "dal_badal") s = apply(s, waitingOn(s)[0], { type: "dal_pick", index: 0 }); return s; };

describe("Dal Badal as a shield", () => {
  it("off: a Teer Kaman resolves at once", () => {
    const s = rig(5, { sides: ["V", "T", "V", "V", "T"], hands: [[TK, TK, F, K, H], [DB, B], [F], [T], [K]] });
    const n = apply(s, 0, { type: "play", card: "TEER_KAMAN", pass: [F, K, H], target: 1, roles: [s.players[1].role] });
    expect(n.phase.kind).not.toBe("react");
  });
  it("Teer Kaman at a thief holding it: the thief may shuffle first — the shot then hits the seat's NEW role card", () => {
    const s = shielded(rig(5, { sides: ["V", "T", "V", "V", "T"], hands: [[TK, TK, F, K, H], [DB, B], [F], [T], [K]] }));
    const thiefRole = s.players[1].role;
    let n = apply(s, 0, { type: "play", card: "TEER_KAMAN", pass: [F, K, H], target: 1, roles: [thiefRole] });
    expect(n.phase).toMatchObject({ kind: "react", seat: 1 });
    expect(n.events.some((e) => e.type === "teer_kaman")).toBe(false); // not resolved yet
    n = pickAll(apply(n, 1, { type: "dal_badal", seats: [2, 3], pass: [] }));
    const shot = n.events.find((e) => e.type === "teer_kaman")!;
    expect(shot.data!.hit).toBe(n.players[1].role === thiefRole || (shot.data!.roles as string[]).includes(n.players[1].role));
    expect(n.players[1].hand).not.toContain("DAL_BADAL");
  });
  it("letting it happen: the shot resolves as usual", () => {
    const s = shielded(rig(5, { sides: ["V", "T", "V", "V", "T"], hands: [[TK, TK, F, K, H], [DB, B], [F], [T], [K]] }));
    let n = apply(s, 0, { type: "play", card: "TEER_KAMAN", pass: [F, K, H], target: 1, roles: [s.players[1].role] });
    n = apply(n, 1, { type: "ready" });
    expect(n.players[1].alive).toBe(false);
  });
  it("Kundli on a thief holding it: shuffle first, the reader reads the NEW role card", () => {
    const s = shielded(rig(5, { sides: ["V", "T", "V", "V", "T"], hands: [[K, K, F, T, H], [DB, B], [F], [T], [K]] }));
    let n = apply(s, 0, { type: "play", card: "KUNDLI", pass: [F, T, H], target: 1 });
    expect(n.phase).toMatchObject({ kind: "react", seat: 1 });
    n = pickAll(apply(n, 1, { type: "dal_badal", seats: [0, 2], pass: [] }));
    const read = n.events.find((e) => e.type === "kundli_private" && Array.isArray(e.to) && e.to[0] === 0)!;
    expect(read.data!.role).toBe(n.players[1].role);
  });
  it("a Faisla putting a thief out: shuffle first — the seat goes out with the role it picked, the caller sees that one", () => {
    const s = shielded(rig(5, { sides: ["V", "T", "V", "V", "T"], hands: [[F, F, T, K, H], [DB, B], [F], [T], [K]] }));
    let n = apply(s, 0, { type: "play", card: "FAISLA", pass: [T, K, H] });
    for (const v of [0, 1, 2, 3, 4]) n = apply(n, v, { type: "ready" });
    for (const v of [0, 1, 2, 3, 4]) n = apply(n, v, { type: "vote", target: v === 1 ? 0 : 1 });
    expect(n.phase).toMatchObject({ kind: "react", seat: 1 });
    n = pickAll(apply(n, 1, { type: "dal_badal", seats: [2, 3], pass: [] }));
    expect(n.players[1].alive).toBe(false);
    const priv = n.events.find((e) => e.type === "eliminated_private")!;
    expect(priv.to).toEqual([0]);
    expect(priv.data!.role).toBe(n.players[1].role);
  });
  it("any debate: a thief may use it in a Faisla debate", () => {
    const s = shielded(rig(5, { sides: ["V", "T", "V", "V", "T"], hands: [[F, F, T, K, H], [DB, B], [F], [T], [K]] }));
    let n = apply(s, 0, { type: "play", card: "FAISLA", pass: [T, K, H] });
    n = pickAll(apply(n, 1, { type: "dal_badal", seats: [2, 3], pass: [] }));
    expect(n.phase).toMatchObject({ kind: "vote", debate: true });
    expect(n.players[1].hand).toHaveLength(2); // drew back to 2
  });
});
