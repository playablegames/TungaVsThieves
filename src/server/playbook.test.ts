// THE PLAYBOOK (2026-10-12, belief.ts): beginners gamble, skilled players hold — each line a measured finding.
import { describe, expect, it } from "vitest";
import { apply, start, waitingOn } from "@/engine/engine";
import type { Card, GameState } from "@/engine/types";
import { beliefOf, skilledAction, SKILLS } from "./belief";

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
  // (designer 2026-10-13: "Teer Kaman only on an open Kundli") — the accusation must have a Kundli the table saw behind it
  const tkTable = () => table(["V", "V", "T", "V", "T", "V"], [["TEER_KAMAN", "TEER_KAMAN", "FAISLA", "KUNDLI", "BATWARA"], ["HERA_PHERI", "KUNDLI"], ["FAISLA", "BATWARA"], ["KUNDLI", "FAISLA"], ["TALASHI", "BATWARA"], ["FAISLA", "KUNDLI"]]);
  it("a villager with a Teer Kaman pair shoots the player an OPEN-KUNDLI accusation named, naming that role", () => {
    const s = tkTable();
    s.events.push({ n: s.events.length, type: "kundli", to: "all", msg: "", data: { seat: 3, target: 2 } });
    s.events.push({ n: s.events.length, type: "claim", to: "all", msg: "", data: { seat: 3, target: 2, kind: "kundli", role: s.players[2].role, side: "T" } });
    const shots = runs(s, SKILLS.casual).filter((a) => a.type === "play" && a.card === "TEER_KAMAN");
    expect(shots.some((a) => a.type === "play" && a.target === 2 && a.roles?.includes(s.players[2].role))).toBe(true);
  });
  it("a bare accusation (no Kundli the table saw) never draws an arrow", () => {
    const s = tkTable();
    s.events.push({ n: s.events.length, type: "claim", to: "all", msg: "", data: { seat: 3, target: 2, kind: "kundli", role: s.players[2].role, side: "T" } });
    for (const skill of [SKILLS.casual, SKILLS.average, SKILLS.sharp])
      expect(runs(s, skill).some((a) => a.type === "play" && a.card === "TEER_KAMAN")).toBe(false);
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
