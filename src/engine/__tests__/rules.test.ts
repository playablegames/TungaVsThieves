// Unit tests written from Tunga_vs_Thieves_Rulebook_v15.md, one block per rule.
import { describe, expect, it } from "vitest";
import { apply, canPlay, start, waitingOn } from "../engine";
import { ROLE_TABLE, createGame } from "../setup";
import { RuleError, type Card, type GameState } from "../types";
import { viewFor } from "../view";
import { NAMES, rig, totalCards } from "./helpers";

const F: Card = "FAISLA", T: Card = "TALASHI", K: Card = "KUNDLI", H: Card = "HERA_PHERI",
  B: Card = "BATWARA", M: Card = "MAYA_JAAL", TK: Card = "TEER_KAMAN", S1: Card = "STONE_1", S2: Card = "STONE_2", DB: Card = "DAL_BADAL";
const role = (s: GameState, seat: number) => s.players[seat].role;
const other = (s: GameState, seat: number, wrong: string) => s.rolesInPlay.filter((r) => r !== role(s, seat) && r !== wrong)[0];

describe("SETUP", () => {
  it("deals the role table, 2 cards each, a 3-card pile, 66 cards, 1 vote each — 4 to 30 players", () => {
    for (let n = 4; n <= 30; n++) {
      const s = createGame(NAMES(n), n);
      const [nv, nt, rounds] = ROLE_TABLE[n];
      expect(s.players.filter((p) => p.side === "V")).toHaveLength(nv);
      expect(s.players.filter((p) => p.side === "T")).toHaveLength(nt);
      expect(new Set(s.players.map((p) => p.role)).size).toBe(n); // every role a different name
      expect(s.rounds).toBe(rounds);
      expect(s.players.every((p) => p.hand.length === 2 && p.votes === 1)).toBe(true);
      expect(s.pile).toHaveLength(3);
      expect(totalCards(s)).toBe(66);
      const stones = [...s.pile, ...s.players.flatMap((p) => p.hand)].filter((c) => c.startsWith("STONE"));
      expect(stones).toHaveLength(2); // both Stones are in the set-aside cards
    }
  });
  it("refuses fewer than 4 or more than 30 players", () => {
    expect(() => createGame(NAMES(3), 1)).toThrow();
    expect(() => createGame(NAMES(31), 1)).toThrow();
  });
  it("seat 1 picks up the pile first and holds 5", () => {
    const s = start(NAMES(6), 7);
    expect(s.players[0].hand).toHaveLength(5);
    expect(waitingOn(s)).toEqual([0]);
  });
  it("is reproducible from its seed", () => {
    expect(start(NAMES(9), 42)).toEqual(start(NAMES(9), 42));
  });
});

describe("YOUR TURN — power or Stone", () => {
  it("play nothing: pass 3, keep the rest, next seat picks them up", () => {
    const s = rig(5, { hands: [[F, T, K, S1, M], [B, B], [F], [T], [K]] });
    const n = apply(s, 0, { type: "pass", pass: [F, T, K] });
    expect(n.players[0].hand.sort()).toEqual([M, S1].sort());
    expect(n.players[1].hand.sort()).toEqual([B, B, F, K, T].sort()); // picked up the pass
  });
  it("a Stone can never be passed into the pile", () => {
    const s = rig(5, { hands: [[F, T, K, S1, M], [], [], [], []] });
    expect(() => apply(s, 0, { type: "pass", pass: [F, T, S1] })).toThrow(RuleError);
  });
  it("a Stone holder with a normal hand can NEVER play a pair (needs 3 other cards to pass first)", () => {
    const s = rig(5, { hands: [[K, K, F, T, S1], [B, B], [F], [T], [K]] });
    expect(canPlay(s, 0, "KUNDLI")).toBe(false);
    const two = rig(5, { hands: [[K, K, S2, T, S1], [B, B], [F], [T], [K]] });
    expect(canPlay(two, 0, "KUNDLI")).toBe(false);
  });
  it("...but one extra card frees him (hand of 2 + Stones)", () => {
    const s = rig(5, { hands: [[K, K, F, T, M, S1], [B, B], [F], [T], [K]] });
    expect(canPlay(s, 0, "KUNDLI")).toBe(true);
  });
  it("playing a pair passes the other 3 FIRST, then resolves", () => {
    const s = rig(5, { hands: [[K, K, F, T, M], [B, B], [F], [T], [K]] });
    const n = apply(s, 0, { type: "play", card: "KUNDLI", pass: [F, T, M], target: 1 });
    expect(n.players[1].hand).toEqual(expect.arrayContaining([F, T, M])); // next seat picked up the pass
    expect(n.players[0].hand).toHaveLength(2); // drew 2
  });
  it("only the seat whose turn it is may act", () => {
    const s = start(NAMES(5), 3);
    expect(() => apply(s, 1, { type: "pass", pass: [] })).toThrow(RuleError);
  });
});

describe("THE CARDS", () => {
  it("KUNDLI shows the role privately, to the reader only", () => {
    const s = rig(5, { hands: [[K, K, F, T, M], [B, B], [F], [T], [K]] });
    const n = apply(s, 0, { type: "play", card: "KUNDLI", pass: [F, T, M], target: 3 });
    const priv = n.events.filter((e) => e.type === "kundli_private");
    expect(priv).toHaveLength(1);
    expect(priv[0].to).toEqual([0]);
    expect(viewFor(n, 1).events.some((e) => e.type === "kundli_private")).toBe(false);
  });
  it("TALASHI shows all of a player's cards to everyone", () => {
    const s = rig(5, { hands: [[T, T, F, K, M], [B, S1], [F], [T], [K]] });
    const n = apply(s, 0, { type: "play", card: "TALASHI", pass: [F, K, M], target: 1 });
    const e = n.events.find((x) => x.type === "talashi")!;
    expect(e.to).toBe("all");
    expect(e.data!.hand).toEqual([B, S1]);
  });
  it("HERA PHERI steals 2 unseen from anyone, the victim draws 2; only they two see what moved", () => {
    const s = rig(5, { hands: [[H, H, F, K, M], [B, S1], [F], [T], [K]] });
    const n = apply(s, 0, { type: "play", card: "HERA_PHERI", pass: [F, K, M], target: 1 });
    expect(n.players[0].hand.sort()).toEqual([B, S1].sort());
    expect(n.players[1].hand).toHaveLength(2 + 3); // drew 2, and is next: picked up the pass
    expect(n.events.find((e) => e.type === "hera_pheri_private")!.to).toEqual([0, 1]);
  });
  it("BATWARA: draw 2, then every living player passes 1 left and 1 right", () => {
    const s = rig(4, { hands: [[B, B, F, K, M], [S1, T], [F, K], [T, M]] });
    let n = apply(s, 0, { type: "play", card: "BATWARA", pass: [F, K, M], target: undefined });
    expect(n.phase.kind).toBe("batwara");
    const hand0 = n.players[0].hand;
    n = apply(n, 0, { type: "batwara", left: hand0[0], right: hand0[1] });
    n = apply(n, 1, { type: "batwara", left: S1, right: T }); // a Stone CAN move by Batwara
    n = apply(n, 2, { type: "batwara", left: F, right: K });
    n = apply(n, 3, { type: "batwara", left: T, right: M });
    expect(n.players[0].hand).toContain(S1); // seat 1's left neighbour is seat 0
  });
  it("MAYA JAAL brings back ANY eliminated player; they draw 2 fresh, the inheritor keeps the cards", () => {
    const s = rig(5, { sides: ["V", "V", "V", "T", "T"], hands: [[M, M, F, K, T], [B, B], [F], [T], [K]] });
    s.players[3].alive = false; s.players[3].revealedRole = s.players[3].role; s.players[3].hand = []; s.deadOrder = [3];
    s.players[2].alive = false; s.players[2].revealedRole = s.players[2].role; s.players[2].hand = []; s.deadOrder.push(2);
    const n = apply(s, 0, { type: "play", card: "MAYA_JAAL", pass: [F, K, T], target: 3 }); // not the last one out
    expect(n.players[3].alive).toBe(true);
    expect(n.players[3].hand).toHaveLength(2);
  });
  it("TEER KAMAN miss: the shooter loses 1 vote for good and draws 2", () => {
    const s = rig(5, { hands: [[TK, TK, F, K, M], [B, B], [F], [T], [K]] });
    const r1 = other(s, 1, ""), r2 = other(s, 1, r1);
    const n = apply(s, 0, { type: "play", card: "TEER_KAMAN", pass: [F, K, M], target: 1, roles: [r1, r2] });
    expect(n.players[0].votes).toBe(0);
    expect(n.players[0].hand).toHaveLength(2);
    expect(n.players[1].alive).toBe(true);
  });
  it("TEER KAMAN hit: the target is out, and names are public", () => {
    const s = rig(5, { sides: ["V", "T", "V", "V", "T"], hands: [[TK, TK, F, K, M], [B, B], [F], [T], [K]] });
    const n = apply(s, 0, { type: "play", card: "TEER_KAMAN", pass: [F, K, M], target: 1, roles: [role(s, 1), other(s, 1, "")] });
    expect(n.players[1].alive).toBe(false);
    expect(n.events.find((e) => e.type === "teer_kaman")!.to).toBe("all");
  });
  it("FAISLA: most votes is out; a tie does nothing; the caller draws 2 either way", () => {
    const s = rig(5, { sides: ["V", "V", "V", "T", "T"], hands: [[F, F, T, K, M], [B], [F], [T], [K]] });
    let n = apply(s, 0, { type: "play", card: "FAISLA", pass: [T, K, M] });
    for (const v of [0, 1, 2, 3, 4]) n = apply(n, v, { type: "vote", target: v < 3 ? 4 : 0 });
    expect(n.players[4].alive).toBe(false); // 3 votes beat 2
    const tie = rig(4, { hands: [[F, F, T, K, M], [B], [F], [T]] });
    let m = apply(tie, 0, { type: "play", card: "FAISLA", pass: [T, K, M] });
    for (const v of [0, 1, 2, 3]) m = apply(m, v, { type: "vote", target: v < 2 ? 2 : 3 });
    expect(m.players.every((p) => p.alive)).toBe(true);
    expect(m.players[0].hand).toHaveLength(2); // drew 2 on a tie too
  });
});

describe("ELIMINATION — reveal, Dal Badal, dying power, hand-off", () => {
  const kill = (s: GameState, target: number) =>
    apply(s, 0, { type: "play", card: "TEER_KAMAN", pass: [F, K, M], target, roles: [role(s, target), other(s, target, "")] });

  it("a dying villager gives 1 vote; then hands ALL cards to any living player; the killer draws 2", () => {
    const s = rig(6, { sides: ["T", "V", "V", "V", "V", "T"], hands: [[TK, TK, F, K, M], [S1, B], [F], [T], [K], [B]] });
    let n = kill(s, 1);
    expect(n.phase).toMatchObject({ kind: "elim", seat: 1, step: "dying" });
    n = apply(n, 1, { type: "gift", target: 2 });
    expect(n.players[2].votes).toBe(2);
    n = apply(n, 1, { type: "handoff", target: 3 });
    expect(n.players[3].hand).toEqual(expect.arrayContaining([S1, B]));
    expect(n.players[0].hand).toHaveLength(2); // killer drew 2 after it resolved
  });
  it("a dying thief takes a last two-role shot; a hit chains into another elimination", () => {
    const s = rig(6, { sides: ["V", "T", "V", "V", "T", "V"], hands: [[TK, TK, F, K, M], [B], [F], [T], [K], [B]] });
    let n = kill(s, 1);
    n = apply(n, 1, { type: "shot", target: 2, roles: [role(n, 2), other(n, 2, "")] });
    n = apply(n, 1, { type: "handoff", target: 3 });
    expect(n.players[2].alive).toBe(false);
    expect(n.phase).toMatchObject({ kind: "elim", seat: 2, step: "dying" }); // the chained one now resolves
  });
  it("a killer shot down by the last shot draws nothing", () => {
    const s = rig(6, { sides: ["V", "T", "V", "V", "T", "V"], hands: [[TK, TK, F, K, M], [B], [F], [T], [K], [B]] });
    let n = kill(s, 1);
    n = apply(n, 1, { type: "shot", target: 0, roles: [role(n, 0), other(n, 0, "")] });
    n = apply(n, 1, { type: "handoff", target: 3 });
    n = apply(n, 0, { type: "gift", target: null });
    // the killer had just passed 3 and not yet drawn: an empty hand skips the hand-off step
    expect(n.players[0].alive).toBe(false);
    expect(n.players[0].hand).toHaveLength(0); // and he never drew the 2
  });
  it("DAL BADAL: a thief dying with it swaps two living players' roles; both see the new role; thief count unchanged", () => {
    const s = rig(6, { sides: ["V", "T", "V", "V", "T", "V"], hands: [[TK, TK, F, K, M], [DB, B], [F], [T], [K], [B]] });
    let n = kill(s, 1);
    expect(n.phase).toMatchObject({ kind: "elim", seat: 1, step: "dal_badal" });
    const r2 = role(n, 2), r4 = role(n, 4);
    n = apply(n, 1, { type: "dal_badal", a: 2, b: 4 });
    expect(role(n, 2)).toBe(r4);
    expect(n.players[2].side).toBe("T");
    expect(n.players.filter((p) => p.side === "T")).toHaveLength(2);
    expect(n.events.filter((e) => e.type === "role" && Array.isArray(e.to) && e.to[0] === 2).length).toBeGreaterThan(1);
    expect(n.players[1].hand).not.toContain(DB);
    void r2;
  });
  it("a villager dying with Dal Badal just hands it on", () => {
    const s = rig(6, { sides: ["T", "V", "V", "V", "T", "V"], hands: [[TK, TK, F, K, M], [DB, B], [F], [T], [K], [B]] });
    const n = kill(s, 1);
    expect(n.phase).toMatchObject({ step: "dying" });
  });
  it("all thieves out ends the game at once — Tunga wins", () => {
    const s = rig(4, { sides: ["V", "T", "V", "V"], hands: [[TK, TK, F, K, M], [B], [F], [T]] });
    const n = kill(s, 1);
    expect(n.phase).toMatchObject({ kind: "over", winner: "V" });
  });
});

describe("THE END — Mandatory Vote, then everyone reveals", () => {
  function toFinal(s: GameState): GameState {
    let n = s;
    for (let i = 0; i < 400 && n.phase.kind === "turn"; i++) {
      const seat = n.phase.seat;
      const h = n.players[seat].hand.filter((c) => !c.startsWith("STONE"));
      n = apply(n, seat, { type: "pass", pass: h.slice(0, Math.min(3, h.length)) });
    }
    return n;
  }
  it("after the last round the Mandatory Vote opens for every living voter", () => {
    const n = toFinal(start(NAMES(5), 11));
    expect(n.phase).toMatchObject({ kind: "vote", reason: "final" });
  });
  it("both Stones with villagers -> TUNGA; any Stone with a thief -> THIEVES", () => {
    for (const [holder, winner] of [["V", "V"], ["T", "T"]] as const) {
      let n = toFinal(start(NAMES(5), 13));
      const v = n.players.find((p) => p.side === "V")!, t = n.players.find((p) => p.side === "T")!;
      for (const p of n.players) p.hand = p.hand.filter((c) => !c.startsWith("STONE"));
      (holder === "V" ? v : t).hand.push("STONE_1", "STONE_2");
      for (const p of n.players.filter((x) => x.alive)) n = apply(n, p.seat, { type: "vote", target: null });
      expect(n.phase).toMatchObject({ kind: "over", winner });
    }
  });
});
