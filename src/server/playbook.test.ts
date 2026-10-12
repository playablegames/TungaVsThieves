// THE PLAYBOOK (2026-10-12, belief.ts): beginners gamble, skilled players hold — each line a measured finding.
import { describe, expect, it } from "vitest";
import { apply, start, waitingOn } from "@/engine/engine";
import type { Card, GameState } from "@/engine/types";
import { beliefOf, keptMyStone, skilledAction, SKILLS, stoneOdds } from "./belief";
import { defaultAction } from "@/engine/decisions";
import { rig } from "@/engine/__tests__/helpers";

const NAMES = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);
const counter = () => { let x = 0; return () => { x = (x + 0.6180339887) % 1; return x; }; };
/** a 6-player table at seat 0's turn, with the given sides and hands */
function table(sides: ("V" | "T")[], hands: Card[][]): GameState {
  const s = start(NAMES(sides.length), 5);
  const v = s.rolesInPlay.filter((r) => s.players.find((p) => p.role === r)!.side === "V");
  const t = s.rolesInPlay.filter((r) => s.players.find((p) => p.role === r)!.side === "T");
  let vi = 0, ti = 0;
  sides.forEach((side, seat) => { const p = s.players[seat]; p.side = side; p.role = side === "V" ? v[vi++] ?? `V${vi}` : t[ti++] ?? `T${ti}`; });
  s.rolesInPlay = s.players.map((p) => p.role).sort();
  s.players.forEach((p, i) => (p.hand = [...(hands[i] ?? [])]));
  s.pile = [];
  return s;
}
const SIDES: ("V" | "T")[] = ["T", "V", "V", "T", "V", "V"];
const runs = (s: GameState, skill = SKILLS.sharp, n = 40) => { const r = counter(); return Array.from({ length: n }, () => skilledAction(s, 0, s.seed, r, skill)); };

describe("THE PLAYBOOK — beginners gamble, skilled players hold", () => {
  it("a SKILLED thief holding a Stone never plays a pair that sends it on; a BEGINNER sometimes does", () => {
    const s = table(SIDES, [["STONE_1", "TALASHI", "TALASHI", "FAISLA", "KUNDLI"], ["HERA_PHERI", "KUNDLI"], ["FAISLA", "BATWARA"], ["KUNDLI", "FAISLA"], ["TALASHI", "BATWARA"], ["FAISLA", "KUNDLI"]]);
    for (const a of runs(s, SKILLS.sharp)) {
      if (a.type === "pass" || a.type === "play") expect(a.pass).not.toContain("STONE_1");
    }
    const casual = runs(s, SKILLS.casual, 80);
    expect(casual.some((a) => (a.type === "pass" || a.type === "play") && a.pass.includes("STONE_1"))).toBe(true);
  });
  it("a SKILLED villager never passes Dal Badal on — no thief gets it", () => {
    const s = table(["V", "V", "T", "T", "V", "V"], [["DAL_BADAL", "TALASHI", "FAISLA", "KUNDLI", "BATWARA"], ["HERA_PHERI", "KUNDLI"], ["FAISLA", "BATWARA"], ["KUNDLI", "FAISLA"], ["TALASHI", "BATWARA"], ["FAISLA", "KUNDLI"]]);
    for (const a of runs(s, SKILLS.sharp)) if (a.type === "pass" || a.type === "play") expect(a.pass).not.toContain("DAL_BADAL");
  });
  it("a SKILLED thief banks Dal Badal until it is exposed — then shuffles with its accuser", () => {
    const hands: Card[][] = [["DAL_BADAL", "TALASHI", "FAISLA", "KUNDLI", "BATWARA"], ["HERA_PHERI", "KUNDLI"], ["FAISLA", "BATWARA"], ["KUNDLI", "FAISLA"], ["TALASHI", "BATWARA"], ["FAISLA", "KUNDLI"]];
    const quiet = table(SIDES, hands);
    for (const a of runs(quiet, SKILLS.sharp)) {
      expect(a.type).not.toBe("dal_badal");
      if (a.type === "pass" || a.type === "play") expect(a.pass).not.toContain("DAL_BADAL");
    }
    const named = table(SIDES, hands);
    named.events.push({ n: named.events.length, type: "claim", to: "all", msg: "", data: { seat: 4, target: 0, kind: "kundli", role: named.players[0].role, side: "T" } });
    const a = skilledAction(named, 0, named.seed, counter(), SKILLS.sharp);
    expect(a.type).toBe("dal_badal");
    if (a.type === "dal_badal") { expect(a.seats).toContain(4); expect(a.pass).toHaveLength(3); }
  });
  it("a villager with a Teer Kaman pair shoots the player whose role an accusation named, naming that role", () => {
    const s = table(["V", "V", "T", "V", "T", "V"], [["TEER_KAMAN", "TEER_KAMAN", "FAISLA", "KUNDLI", "BATWARA"], ["HERA_PHERI", "KUNDLI"], ["FAISLA", "BATWARA"], ["KUNDLI", "FAISLA"], ["TALASHI", "BATWARA"], ["FAISLA", "KUNDLI"]]);
    s.events.push({ n: s.events.length, type: "claim", to: "all", msg: "", data: { seat: 3, target: 2, kind: "kundli", role: s.players[2].role, side: "T" } });
    const shots = runs(s, SKILLS.casual).filter((a) => a.type === "play" && a.card === "TEER_KAMAN");
    // (a beginner may also fire its own blind shot, naming a random thief role — that is the gamble)
    expect(shots.some((a) => a.type === "play" && a.target === 2 && a.roles?.includes(s.players[2].role))).toBe(true);
  });
  it("WAIT FOR THE ANSWER: an accusation moves a bot less until the accused has answered (or the floor closed)", () => {
    for (const skill of [SKILLS.casual, SKILLS.sharp]) {
      const s = table(["V", "V", "T", "V", "T", "V"], [["FAISLA", "KUNDLI"], ["FAISLA", "KUNDLI"], ["FAISLA", "KUNDLI"], ["FAISLA", "KUNDLI"], ["FAISLA", "KUNDLI"], ["FAISLA", "KUNDLI"]]);
      const before = beliefOf(s, 0, s.seed, skill).p.get(2)!;
      s.events.push({ n: s.events.length, type: "claim", to: "all", msg: "", data: { seat: 4, target: 2, kind: "kundli", role: s.players[2].role, side: "T" } });
      const pending = beliefOf(s, 0, s.seed, skill).p.get(2)!;
      s.events.push({ n: s.events.length, type: "ballots_open", to: "all", msg: "" }); // the floor closed: silence is an answer
      const settled = beliefOf(s, 0, s.seed, skill).p.get(2)!;
      expect(pending).toBeGreaterThan(before);
      expect(settled).toBeGreaterThan(pending);
    }
  });
  it("every move the playbook makes is legal (a quick game per skill)", () => {
    for (const skill of [SKILLS.casual, SKILLS.average, SKILLS.sharp]) {
      let s = start(NAMES(7), 11);
      const r = counter();
      for (let k = 0; k < 3000 && s.phase.kind !== "over"; k++) {
        const seat = waitingOn(s)[0];
        s = apply(s, seat, skilledAction(s, seat, s.seed, r, skill));
      }
      expect(s.phase.kind).toBe("over");
    }
  });
});

describe("DID IT COME BACK? (designer 2026-10-12 — anticlockwise Bhukamp)", () => {
  it("a player whose Stone a Bhukamp handed on, and who gets the next pile without it, knows the neighbour kept it", () => {
    const B: Card = "BATWARA", F: Card = "FAISLA", K: Card = "KUNDLI", H: Card = "HERA_PHERI", T: Card = "TALASHI", S1: Card = "STONE_1";
    let s = rig(5, { hands: [[B, B, F, K, H], [S1, T], [F, K], [T, H], [K, F]] });
    s = apply(s, 0, { type: "play", card: "BATWARA", pass: [F, K, H] });
    expect(s.players[0].hand).toContain(S1); // seat 1's Stone moved one seat back, to seat 0
    // round the table until seat 0 has played its turn (keeping the Stone) and seat 1 picks up seat 0's pile
    for (let k = 0; k < 20 && !(s.phase.kind === "turn" && s.phase.seat === 1 && s.events.some((e) => e.type === "pass" && e.data?.seat === 0)); k++) {
      const seat = waitingOn(s)[0];
      s = apply(s, seat, defaultAction(s, seat));
    }
    const pick = [...s.events].reverse().find((e) => e.type === "pickup_private" && Array.isArray(e.to) && e.to[0] === 1)!;
    expect(s.players[0].hand).toContain(S1);
    expect(keptMyStone(s, 1, pick.n)).toBe(0);
    // and the bots' Stone odds now put it on seat 0
    expect(stoneOdds(s, 1, 1).get(0)!).toBeGreaterThan(0.9);
  });
});
