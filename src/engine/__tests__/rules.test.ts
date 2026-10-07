// Unit tests written from Tunga_vs_Thieves_Rulebook_v15.md, one block per rule.
import { describe, expect, it } from "vitest";
import { apply, canPlay, closeVote, start, waitingOn } from "../engine";
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
  it("a Stone CAN be passed into the pile — the next seat picks it up", () => {
    const s = rig(5, { hands: [[F, T, K, S1, M], [], [], [], []] });
    const n = apply(s, 0, { type: "pass", pass: [F, T, S1] });
    expect(n.players[1].hand).toContain(S1);
  });
  it("power or Stone: a Stone holder with a normal hand plays a pair only by passing the Stone", () => {
    const s = rig(5, { hands: [[K, K, F, T, S1], [B, B], [F], [T], [K]] });
    expect(canPlay(s, 0, "KUNDLI")).toBe(true);
    expect(() => apply(s, 0, { type: "play", card: "KUNDLI", pass: [F, T], target: 1 })).toThrow(RuleError);
    const n = apply(s, 0, { type: "play", card: "KUNDLI", pass: [F, T, S1], target: 1 });
    expect(n.players[0].hand).not.toContain(S1);
    expect(n.players[1].hand).toContain(S1);
  });
  it("a pair needs 3 other cards of any kind to pass first", () => {
    expect(canPlay(rig(5, { hands: [[K, K, S2, S1], [B, B], [F], [T], [K]] }), 0, "KUNDLI")).toBe(false);
    expect(canPlay(rig(5, { hands: [[K, K, S2, T, S1], [B, B], [F], [T], [K]] }), 0, "KUNDLI")).toBe(true);
  });
  it("a Stone is never discarded with the played pair", () => {
    const s = rig(5, { hands: [[K, K, F, T, S1], [B, B], [F], [T], [K]] });
    const n = apply(s, 0, { type: "play", card: "KUNDLI", pass: [F, T, S1], target: 1 });
    expect(n.discard).not.toContain(S1);
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
  it("BHUKAMP: everyone splits FIRST — the player too, from their own 3 — then the player draws 2 and those plus their last card are the pile", () => {
    const s = rig(4, { hands: [[B, B, F, K, M], [S1, T], [F, K], [T, M]] });
    expect(() => apply(s, 0, { type: "play", card: "BATWARA", pass: [F, K, M], target: undefined })).toThrow(RuleError); // nothing passes before the split
    let n = apply(s, 0, { type: "play", card: "BATWARA", pass: [], target: undefined });
    expect(n.phase.kind).toBe("batwara");
    expect(n.players[0].hand.sort()).toEqual([F, K, M].sort()); // the pair is gone, the 3 stay for the split
    expect(waitingOn(n).sort()).toEqual([0, 1, 2, 3]);
    n = apply(n, 0, { type: "batwara", left: F, right: K }); // the player chooses what each neighbour gets
    n = apply(n, 1, { type: "batwara", left: S1, right: T }); // a Stone CAN move by Bhukamp
    n = apply(n, 2, { type: "batwara", left: F, right: K });
    n = apply(n, 3, { type: "batwara", left: T, right: M });
    // the player keeps what the neighbours sent; their last own card and 2 drawn went on as the pile
    expect(n.players[0].hand.sort()).toEqual([S1, M].sort());
    const pile = n.events.find((e) => e.type === "batwara_pile")!;
    expect(pile.to).toEqual([0]);
    expect((pile.data!.cards as Card[])[0]).toBe(M);
    expect(pile.data!.cards).toHaveLength(3);
    // nobody's hand shrinks; seat 1, who is next, has also picked up the 3
    expect(n.players[2].hand).toHaveLength(2);
    expect(n.players[3].hand).toHaveLength(2);
    expect(n.players[1].hand).toHaveLength(2 + 3);
  });
  it("BHUKAMP with cards to spare: the player picks which own card joins the 2 they draw", () => {
    const s = rig(4, { hands: [[B, B, F, K, M, T, F], [S1, T], [F, K], [T, M]] });
    let n = apply(s, 0, { type: "play", card: "BATWARA", pass: [], target: undefined });
    expect(() => apply(n, 0, { type: "batwara", left: F, right: K })).toThrow(RuleError); // 3 left: which one goes on?
    n = apply(n, 0, { type: "batwara", left: F, right: K, pile: M });
    for (const seat of [1, 2, 3]) n = apply(n, seat, { type: "batwara", left: n.players[seat].hand[0], right: n.players[seat].hand[1] });
    expect((n.events.find((e) => e.type === "batwara_pile")!.data!.cards as Card[])[0]).toBe(M);
    expect(n.players[0].hand).toHaveLength(2 + 2); // T and F kept, plus one from each neighbour
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
    expect(n.phase).toMatchObject({ kind: "vote", debate: true });       // the open floor comes first
    expect(() => apply(n, 1, { type: "vote", target: 4 })).toThrow(RuleError); // no ballots during the debate
    for (const v of [0, 1, 2, 3, 4]) n = apply(n, v, { type: "ready" });
    expect(n.events.at(-1)!.type).toBe("ballots_open");
    for (const v of [0, 1, 2, 3, 4]) n = apply(n, v, { type: "vote", target: v < 3 ? 4 : 0 });
    expect(n.players[4].alive).toBe(false); // 3 votes beat 2
    const tie = rig(4, { hands: [[F, F, T, K, M], [B], [F], [T]] });
    let m = apply(tie, 0, { type: "play", card: "FAISLA", pass: [T, K, M] });
    for (const v of [0, 1, 2, 3]) m = apply(m, v, { type: "ready" });
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
  it("DAL BADAL (2026-10-07): the dying thief picks 3; their roles are shuffled; each picks one back face down, in seat order", () => {
    const s = rig(6, { sides: ["V", "T", "V", "V", "T", "V"], hands: [[TK, TK, F, K, M], [DB, B], [F], [T], [K], [B]] });
    let n = kill(s, 1);
    expect(n.phase).toMatchObject({ kind: "elim", seat: 1, step: "dal_badal" });
    expect(() => apply(n, 1, { type: "dal_badal", seats: [2, 4] })).toThrow(); // 3 when 3 or more are alive
    const before = [5, 2, 4].map((x) => role(n, x)).sort();
    n = apply(n, 1, { type: "dal_badal", seats: [5, 2, 4] });
    expect(n.players[1].hand).not.toContain(DB);
    // picking goes round from the seat after the dying thief: 2, then 4, then 5 takes what is left
    expect(n.phase).toMatchObject({ kind: "elim", seat: 1, step: "dal_pick", pickers: [2, 4, 5] });
    expect(waitingOn(n)).toEqual([2]);
    n = apply(n, 2, { type: "dal_pick", index: 2 });
    expect(waitingOn(n)).toEqual([4]);
    expect(() => apply(n, 4, { type: "dal_pick", index: 2 })).toThrow(); // only 2 cards are left
    n = apply(n, 4, { type: "dal_pick", index: 0 });
    // the last one got the remaining card without being asked; the dying thief goes on to the last shot
    expect(n.phase).toMatchObject({ kind: "elim", seat: 1, step: "dying" });
    expect([5, 2, 4].map((x) => role(n, x)).sort()).toEqual(before);
    expect(n.players.filter((p) => p.side === "T")).toHaveLength(2);
    // each of the 3 learns the new role in secret; the table only sees who was in it
    for (const x of [2, 4, 5]) expect(n.events.some((e) => e.type === "role" && Array.isArray(e.to) && e.to[0] === x && e.data?.swapped)).toBe(true);
    const pub = n.events.find((e) => e.type === "dal_badal")!;
    expect(pub.to).toBe("all");
    expect(JSON.stringify(pub)).not.toMatch(/Kisaan|Sarpanch|Baba|Teacher|Police|Chor|Lootera|Mastikhor/);
  });
  it("DAL BADAL with only 2 left alive shuffles those 2", () => {
    const s = rig(4, { sides: ["V", "T", "V", "T"], hands: [[TK, TK, F, K, M], [DB, B], [F], [T]] });
    let n = kill(s, 1);
    n = apply(n, 1, { type: "dal_badal", seats: [0, 2, 3].filter((x) => n.players[x].alive).slice(0, Math.min(3, n.players.filter((p) => p.alive).length)) });
    expect(n.phase).toMatchObject({ step: "dal_pick" });
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
  /** rig the end: the given seats hold the Stones (nobody else, not the leftover cards), then the holders decide */
  function rigSurrender(n: GameState, holders: number[]): GameState {
    for (const p of n.players) p.hand = p.hand.filter((c) => !c.startsWith("STONE"));
    n.pile = n.pile.filter((c) => !c.startsWith("STONE"));
    holders.forEach((seat, i) => n.players[seat].hand.push(i === 0 ? "STONE_1" : "STONE_2"));
    n.phase = { kind: "surrender", holders: [...new Set(holders)], choices: {} };
    return n;
  }
  it("after the last round the Stone holders decide — SURRENDER comes before any vote (designer 2026-10-07)", () => {
    const n = toFinal(start(NAMES(5), 11));
    expect(n.phase.kind).toBe("surrender");
    const holders = n.players.filter((p) => p.alive && p.hand.some((c) => c.startsWith("STONE"))).map((p) => p.seat);
    expect(waitingOn(n).sort()).toEqual(holders.sort());
  });
  it("both Stones surrendered -> TUNGA wins at once; none surrendered -> THIEVES win at once", () => {
    let n = rigSurrender(toFinal(start(NAMES(5), 13)), [1, 2]);
    n = apply(n, 1, { type: "surrender", give: true });
    n = apply(n, 2, { type: "surrender", give: true });
    expect(n.phase).toMatchObject({ kind: "over", winner: "V" });
    let m = rigSurrender(toFinal(start(NAMES(5), 13)), [1, 2]);
    m = apply(m, 1, { type: "surrender", give: false });
    m = apply(m, 2, { type: "surrender", give: false });
    expect(m.phase).toMatchObject({ kind: "over", winner: "T" });
  });
  it("one Stone surrendered -> the mandatory vote; the other Stone decides at the reveal (villager: TUNGA, thief: THIEVES)", () => {
    for (const [keeperSide, winner] of [["V", "V"], ["T", "T"]] as const) {
      let n = toFinal(start(NAMES(6), 17));
      const giver = n.players.find((p) => p.alive && p.side === "V")!.seat;
      const keeper = n.players.find((p) => p.alive && p.side === keeperSide && p.seat !== giver)!.seat;
      n = rigSurrender(n, [giver, keeper]);
      n = apply(n, giver, { type: "surrender", give: true });
      n = apply(n, keeper, { type: "surrender", give: false });
      expect(n.phase).toMatchObject({ kind: "vote", reason: "final" });
      for (const p of n.players.filter((x) => x.alive)) n = apply(n, p.seat, { type: "ready" });
      for (const p of n.players.filter((x) => x.alive)) n = apply(n, p.seat, { type: "vote", target: null });
      expect(n.phase).toMatchObject({ kind: "over", winner });
    }
  });
  it("a Stone among the 3 cards left on the table counts as already with the village", () => {
    let n = toFinal(start(NAMES(5), 19));
    for (const p of n.players) p.hand = p.hand.filter((c) => !c.startsWith("STONE"));
    n.pile = [...n.pile.filter((c) => !c.startsWith("STONE")), "STONE_1"];
    const holder = n.players.find((p) => p.alive)!.seat;
    n.players[holder].hand.push("STONE_2");
    n.phase = { kind: "surrender", holders: [holder], choices: {} };
    n = apply(n, holder, { type: "surrender", give: true });
    expect(n.phase).toMatchObject({ kind: "over", winner: "V" });
  });
  it("RULE 2026-10-07: whoever the Mandatory Vote puts out hands nothing on — the cards go to the village, Stones count for it", () => {
    let n = toFinal(start(NAMES(6), 21));
    const villager = n.players.find((p) => p.side === "V" && p.alive)!;
    const thief = n.players.find((p) => p.side === "T" && p.alive)!;
    n = rigSurrender(n, [villager.seat, thief.seat]);
    n = apply(n, villager.seat, { type: "surrender", give: true });
    n = apply(n, thief.seat, { type: "surrender", give: false });   // one with the village: the vote decides
    for (const p of n.players.filter((x) => x.alive)) n = apply(n, p.seat, { type: "ready" });
    for (const p of n.players.filter((x) => x.alive)) n = apply(n, p.seat, { type: "vote", target: thief.seat });
    if (n.phase.kind === "elim" && n.phase.step === "dal_badal") n = apply(n, thief.seat, { type: "dal_badal", seats: n.players.filter((p) => p.alive).slice(0, 3).map((p) => p.seat) });
    while (n.phase.kind === "elim" && n.phase.step === "dal_pick") n = apply(n, waitingOn(n)[0], { type: "dal_pick", index: 0 });
    if (n.phase.kind === "elim") n = apply(n, thief.seat, { type: "shot", target: null });
    expect(n.events.some((e) => e.type === "handoff")).toBe(false);
    expect(n.events.some((e) => e.type === "to_village")).toBe(true);
    expect(n.phase).toMatchObject({ kind: "over" });
    if (!n.events.some((e) => e.type === "dal_badal")) expect(n.phase).toMatchObject({ winner: "V" });
  });
});

describe("OPEN VOTING (2026-10-07) — change your vote until the clock runs out", () => {
  it("a voter may vote again; nothing resolves until closeVote; the last vote counts", () => {
    let n = start(NAMES(5), 31);
    n.voteUntilClock = true;
    // jump straight to an open Faisla ballot
    n.phase = { kind: "vote", reason: "faisla", caller: 0, voters: [0, 1, 2, 3, 4], ballots: {}, debate: false, ready: [] };
    n.after = null;
    for (const x of [0, 1, 2, 3, 4]) n = apply(n, x, { type: "vote", target: 4 });
    expect(n.phase.kind).toBe("vote"); // everyone voted, still open
    n = apply(n, 0, { type: "vote", target: 3 });
    n = apply(n, 1, { type: "vote", target: 3 });
    n = apply(n, 2, { type: "vote", target: 3 }); // three changed their minds
    n = closeVote(n);
    const result = n.events.filter((e) => e.type === "vote_result").at(-1)!;
    expect(result.data!.out).toBe(3);
  });
  it("off (engine default): the vote closes the moment everyone has voted, and nobody can vote twice", () => {
    let n = start(NAMES(5), 31);
    n.phase = { kind: "vote", reason: "faisla", caller: 0, voters: [0, 1, 2, 3, 4], ballots: {}, debate: false, ready: [] };
    n = apply(n, 0, { type: "vote", target: 4 });
    expect(() => apply(n, 0, { type: "vote", target: 3 })).toThrow();
  });
});
