// Unit tests, one block per rule: Tunga_vs_Thieves_Rulebook_v15.md as changed by the designer on 2026-10-07 and
// 2026-10-09 (private Talashi · Teer Kaman miss = out · no Mayajaal, 6×10 · one dying power for both sides: a vote ·
// roles never shown to the table · Dal Badal is a thief's turn · Bhukamp = 1 card to the next player clockwise · 5-30 players).
import { describe, expect, it } from "vitest";
import { apply, canPlay, closeVote, start, waitingOn } from "../engine";
import { COPIES_PER_ACTION, ROLE_TABLE, createGame, newDeck } from "../setup";
import { ACTION_CARDS, RuleError, type Card, type GameState } from "../types";
import { viewFor } from "../view";
import { NAMES, rig, totalCards } from "./helpers";

const F: Card = "FAISLA", T: Card = "TALASHI", K: Card = "KUNDLI", H: Card = "HERA_PHERI",
  B: Card = "BATWARA", TK: Card = "TEER_KAMAN", S1: Card = "STONE_1", S2: Card = "STONE_2", DB: Card = "DAL_BADAL";
const role = (s: GameState, seat: number) => s.players[seat].role;
const other = (s: GameState, seat: number, wrong: string) => s.rolesInPlay.filter((r) => r !== role(s, seat) && r !== wrong)[0];
/** no role ever reaches the table: not on a public event, not on a seat */
const noPublicRoles = (s: GameState) => {
  for (const e of s.events) if (e.to === "all" && e.type === "eliminated") expect(e.data?.role).toBeUndefined();
  for (const p of viewFor(s, 0).players) expect(p.revealedRole).toBeNull();
};

describe("SETUP", () => {
  it("deals the role table, 2 cards each, a 3-card pile, 63 cards, 1 vote each — 5 to 30 players", () => {
    for (let n = 5; n <= 30; n++) {
      const s = createGame(NAMES(n), n);
      const [nv, nt, rounds] = ROLE_TABLE[n];
      expect(nv + nt).toBe(n);
      expect(s.players.filter((p) => p.side === "V")).toHaveLength(nv);
      expect(s.players.filter((p) => p.side === "T")).toHaveLength(nt);
      expect(new Set(s.players.map((p) => p.role)).size).toBe(n); // every role a different name
      expect(s.rounds).toBe(rounds);
      expect(s.players.every((p) => p.hand.length === 2 && p.votes === 1)).toBe(true);
      expect(s.pile).toHaveLength(3);
      expect(totalCards(s)).toBe(63);
      const stones = [...s.pile, ...s.players.flatMap((p) => p.hand)].filter((c) => c.startsWith("STONE"));
      expect(stones).toHaveLength(2); // both Stones are in the set-aside cards
    }
  });
  it("the deck: 6 action cards × 10 and one Dal Badal — no Mayajaal (2026-10-09)", () => {
    expect(ACTION_CARDS).toHaveLength(6);
    expect(COPIES_PER_ACTION).toBe(10);
    const d = newDeck();
    expect(d).toHaveLength(61);
    expect(d.filter((c) => c === DB)).toHaveLength(1);
    expect(d.some((c) => (c as string) === "MAYA_JAAL")).toBe(false);
  });
  it("refuses fewer than 5 or more than 30 players", () => {
    expect(() => createGame(NAMES(4), 1)).toThrow();
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
    const s = rig(5, { hands: [[F, T, K, S1, H], [B, B], [F], [T], [K]] });
    const n = apply(s, 0, { type: "pass", pass: [F, T, K] });
    expect(n.players[0].hand.sort()).toEqual([H, S1].sort());
    expect(n.players[1].hand.sort()).toEqual([B, B, F, K, T].sort()); // picked up the pass
  });
  it("a Stone CAN be passed into the pile — the next seat picks it up", () => {
    const s = rig(5, { hands: [[F, T, K, S1, H], [], [], [], []] });
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
    const s = rig(5, { hands: [[K, K, F, T, H], [B, B], [F], [T], [K]] });
    const n = apply(s, 0, { type: "play", card: "KUNDLI", pass: [F, T, H], target: 1 });
    expect(n.players[1].hand).toEqual(expect.arrayContaining([F, T, H])); // next seat picked up the pass
    expect(n.players[0].hand).toHaveLength(2); // drew 2
  });
  it("only the seat whose turn it is may act", () => {
    const s = start(NAMES(5), 3);
    expect(() => apply(s, 1, { type: "pass", pass: [] })).toThrow(RuleError);
  });
});

describe("THE CARDS", () => {
  it("KUNDLI shows the role privately, to the reader only", () => {
    const s = rig(5, { hands: [[K, K, F, T, H], [B, B], [F], [T], [K]] });
    const n = apply(s, 0, { type: "play", card: "KUNDLI", pass: [F, T, H], target: 3 });
    const priv = n.events.filter((e) => e.type === "kundli_private");
    expect(priv).toHaveLength(1);
    expect(priv[0].to).toEqual([0]);
    expect(viewFor(n, 1).events.some((e) => e.type === "kundli_private")).toBe(false);
  });
  it("TALASHI is a PRIVATE search (2026-10-09): the table sees who, only the searcher sees the cards", () => {
    const s = rig(5, { hands: [[T, T, F, K, H], [B, S1], [F], [T], [K]] });
    const n = apply(s, 0, { type: "play", card: "TALASHI", pass: [F, K, H], target: 1 });
    const pub = n.events.find((x) => x.type === "talashi")!;
    expect(pub.to).toBe("all");
    expect(pub.data!.hand).toBeUndefined();
    const priv = n.events.find((x) => x.type === "talashi_private")!;
    expect(priv.to).toEqual([0]);
    expect(priv.data!.hand).toEqual([B, S1]);
    expect(viewFor(n, 2).events.some((e) => e.type === "talashi_private")).toBe(false);
  });
  it("HERA PHERI steals 2 unseen from anyone, the victim draws 2; only they two see what moved", () => {
    const s = rig(5, { hands: [[H, H, F, K, T], [B, S1], [F], [T], [K]] });
    const n = apply(s, 0, { type: "play", card: "HERA_PHERI", pass: [F, K, T], target: 1 });
    expect(n.players[0].hand.sort()).toEqual([B, S1].sort());
    expect(n.players[1].hand).toHaveLength(2 + 3); // drew 2, and is next: picked up the pass
    expect(n.events.find((e) => e.type === "hera_pheri_private")!.to).toEqual([0, 1]);
  });
  it("BHUKAMP (2026-10-09): pass 3 like any pair, then every living player passes 1 card CLOCKWISE (to the next seat); nobody draws", () => {
    const s = rig(5, { hands: [[B, B, F, K, H, T], [S1, T], [F, K], [T, H], [K, F]] });
    let n = apply(s, 0, { type: "play", card: "BATWARA", pass: [F, K, H] });
    expect(n.phase.kind).toBe("batwara");
    expect(n.players[0].hand).toEqual([T]); // the pair and the pass are gone
    expect(waitingOn(n).sort()).toEqual([0, 1, 2, 3, 4]);
    expect(() => apply(n, 1, { type: "batwara", card: H })).toThrow(RuleError); // only a card you hold
    n = apply(n, 0, { type: "batwara", card: T });
    n = apply(n, 1, { type: "batwara", card: S1 }); // a Stone CAN move by Bhukamp
    n = apply(n, 2, { type: "batwara", card: F });
    n = apply(n, 3, { type: "batwara", card: H });
    n = apply(n, 4, { type: "batwara", card: K });
    // each card went to the next seat clockwise, the way the turn goes (seat x → seat x+1, wrapping)
    expect(n.players[0].hand).toEqual([K]);
    expect(n.players[2].hand.sort()).toEqual([K, S1].sort()); // the Stone moved on
    expect(n.players[3].hand.sort()).toEqual([F, T].sort());
    expect(n.players[4].hand.sort()).toEqual([F, H].sort());
    // seat 1, next, got T from seat 0 and picked up the 3 passed
    expect(n.players[1].hand.sort()).toEqual([F, H, K, T, T].sort());
    expect(totalCards(n)).toBe(totalCards(s)); // nothing drawn, nothing lost
  });
  it("TEER KAMAN miss (2026-10-09): the shooter is OUT, role hidden; the target stays", () => {
    const s = rig(5, { sides: ["V", "T", "V", "T", "V"], hands: [[TK, TK, F, K, H], [B, B], [F], [T], [K]] });
    const r1 = other(s, 1, ""), r2 = other(s, 1, r1);
    let n = apply(s, 0, { type: "play", card: "TEER_KAMAN", pass: [F, K, H], target: 1, roles: [r1, r2] });
    expect(n.players[0].alive).toBe(false);
    expect(n.players[1].alive).toBe(true);
    expect(n.events.some((e) => e.type === "eliminated_private")).toBe(false); // nobody learns the shooter's role
    if (n.phase.kind === "elim") n = apply(n, 0, { type: "gift", target: null });
    noPublicRoles(n);
  });
  it("TEER KAMAN hit: the target is out — only the SHOOTER sees their role", () => {
    const s = rig(5, { sides: ["V", "T", "V", "V", "T"], hands: [[TK, TK, F, K, H], [B, B], [F], [T], [K]] });
    const n = apply(s, 0, { type: "play", card: "TEER_KAMAN", pass: [F, K, H], target: 1, roles: [role(s, 1), other(s, 1, "")] });
    expect(n.players[1].alive).toBe(false);
    expect(n.events.find((e) => e.type === "teer_kaman")!.to).toBe("all");
    const priv = n.events.find((e) => e.type === "eliminated_private")!;
    expect(priv.to).toEqual([0]);
    expect(priv.data!.role).toBe(role(s, 1));
    expect(viewFor(n, 2).events.some((e) => e.type === "eliminated_private")).toBe(false);
    noPublicRoles(n);
  });
  it("FAISLA: most votes is out — only the CALLER sees the role; a tie does nothing; the caller draws 2 either way", () => {
    const s = rig(5, { sides: ["V", "V", "V", "T", "T"], hands: [[F, F, T, K, H], [B], [F], [T], [K]] });
    let n = apply(s, 0, { type: "play", card: "FAISLA", pass: [T, K, H] });
    expect(n.phase).toMatchObject({ kind: "vote", debate: true });       // the open floor comes first
    expect(() => apply(n, 1, { type: "vote", target: 4 })).toThrow(RuleError); // no ballots during the debate
    for (const v of [0, 1, 2, 3, 4]) n = apply(n, v, { type: "ready" });
    expect(n.events.at(-1)!.type).toBe("ballots_open");
    for (const v of [0, 1, 2, 3, 4]) n = apply(n, v, { type: "vote", target: v < 3 ? 4 : 0 });
    expect(n.players[4].alive).toBe(false); // 3 votes beat 2
    expect(n.events.find((e) => e.type === "eliminated_private")!.to).toEqual([0]);
    noPublicRoles(n);
    const tie = rig(5, { hands: [[F, F, T, K, H], [B], [F], [T], [K]] });
    let m = apply(tie, 0, { type: "play", card: "FAISLA", pass: [T, K, H] });
    for (const v of [0, 1, 2, 3, 4]) m = apply(m, v, { type: "ready" });
    for (const v of [0, 1, 2, 3, 4]) m = apply(m, v, { type: "vote", target: v < 2 ? 2 : v < 4 ? 3 : null });
    expect(m.players.every((p) => p.alive)).toBe(true);
    expect(m.players[0].hand).toHaveLength(2); // drew 2 on a tie too
  });
  it("FAISLA that puts out its own caller: nobody sees the role", () => {
    const s = rig(5, { sides: ["V", "V", "V", "T", "T"], hands: [[F, F, T, K, H], [B], [F], [T], [K]] });
    let n = apply(s, 0, { type: "play", card: "FAISLA", pass: [T, K, H] });
    for (const v of [0, 1, 2, 3, 4]) n = apply(n, v, { type: "ready" });
    for (const v of [0, 1, 2, 3, 4]) n = apply(n, v, { type: "vote", target: v === 0 ? 1 : 0 });
    expect(n.players[0].alive).toBe(false);
    expect(n.events.some((e) => e.type === "eliminated_private")).toBe(false);
  });
});

describe("ELIMINATION — out, dying power, hand-off", () => {
  const kill = (s: GameState, target: number) =>
    apply(s, 0, { type: "play", card: "TEER_KAMAN", pass: [F, K, H], target, roles: [role(s, target), other(s, target, "")] });

  it("a dying villager gives 1 vote; then hands ALL cards to any living player; the killer draws 2", () => {
    const s = rig(6, { sides: ["T", "V", "V", "V", "V", "T"], hands: [[TK, TK, F, K, H], [S1, B], [F], [T], [K], [B]] });
    let n = kill(s, 1);
    expect(n.phase).toMatchObject({ kind: "elim", seat: 1, step: "dying" });
    n = apply(n, 1, { type: "gift", target: 2 });
    expect(n.players[2].votes).toBe(2);
    n = apply(n, 1, { type: "handoff", target: 3 });
    expect(n.players[3].hand).toEqual(expect.arrayContaining([S1, B]));
    expect(n.players[0].hand).toHaveLength(2); // killer drew 2 after it resolved
  });
  it("a dying THIEF has the same power (2026-10-09): give 1 vote — there is no last shot", () => {
    const s = rig(6, { sides: ["V", "T", "V", "V", "T", "V"], hands: [[TK, TK, F, K, H], [B], [F], [T], [K], [B]] });
    let n = kill(s, 1);
    expect(n.phase).toMatchObject({ kind: "elim", seat: 1, step: "dying" });
    expect(() => apply(n, 1, { type: "shot" as "gift", target: 2 })).toThrow(RuleError);
    n = apply(n, 1, { type: "gift", target: 4 });
    expect(n.players[4].votes).toBe(2);
    expect(n.players.filter((p) => !p.alive)).toHaveLength(1);
  });
  it("all thieves out ends the game at once — Tunga wins", () => {
    const s = rig(5, { sides: ["V", "T", "V", "V", "V"], hands: [[TK, TK, F, K, H], [B], [F], [T], [K]] });
    const n = kill(s, 1);
    expect(n.phase).toMatchObject({ kind: "over", winner: "V" });
  });
});

describe("DAL BADAL (2026-10-09) — a thief's whole turn", () => {
  const swapGame = () => rig(6, { sides: ["T", "V", "V", "V", "T", "V"], hands: [[DB, F, K, H, T], [B], [F], [T], [K], [B]] });

  it("only a thief holding it, on their own turn", () => {
    const v = rig(6, { sides: ["V", "T", "V", "V", "T", "V"], hands: [[DB, F, K, H, T], [B], [F], [T], [K], [B]] });
    expect(() => apply(v, 0, { type: "dal_badal", seats: [2, 4], pass: [F, K, H] })).toThrow(RuleError); // a villager can't
    expect(() => apply(swapGame(), 1, { type: "dal_badal", seats: [2, 4], pass: [F, K, H] })).toThrow(RuleError); // not their turn
  });
  it("pass 3, show the role, shuffle with 2 others — each picks one back from the thief on — then draw 1; the card leaves the game", () => {
    const s = swapGame();
    expect(() => apply(s, 0, { type: "dal_badal", seats: [2], pass: [F, K, H] })).toThrow(RuleError); // pick 2
    expect(() => apply(s, 0, { type: "dal_badal", seats: [0, 2], pass: [F, K, H] })).toThrow(RuleError); // 2 OTHERS
    expect(() => apply(s, 0, { type: "dal_badal", seats: [2, 4], pass: [F, K] })).toThrow(RuleError); // pass 3
    const before = [0, 2, 4].map((x) => role(s, x)).sort();
    let n = apply(s, 0, { type: "dal_badal", seats: [4, 2], pass: [F, K, H] });
    const pub = n.events.find((e) => e.type === "dal_badal")!;
    expect(pub.to).toBe("all");
    expect(pub.data!.role).toBe(role(s, 0)); // the thief shows their role
    expect(n.pile.sort()).toEqual([F, H, K].sort()); // the 3 passed first
    expect(n.phase).toMatchObject({ kind: "dal_badal", actor: 0, pickers: [0, 2, 4] });
    expect(waitingOn(n)).toEqual([0]);
    n = apply(n, 0, { type: "dal_pick", index: 1 });
    expect(waitingOn(n)).toEqual([2]);
    n = apply(n, 2, { type: "dal_pick", index: 0 }); // seat 4 takes what is left
    expect([0, 2, 4].map((x) => role(n, x)).sort()).toEqual(before);
    expect(n.players.filter((p) => p.side === "T")).toHaveLength(2);
    for (const x of [0, 2, 4]) expect(n.events.some((e) => e.type === "role" && Array.isArray(e.to) && e.to[0] === x && e.data?.swapped)).toBe(true);
    // the thief drew 1; the turn is over and seat 1 picked up the 3
    expect(n.players[0].hand).toHaveLength(2);
    expect(n.phase).toMatchObject({ kind: "turn", seat: 1 });
    expect(n.players[1].hand).toEqual(expect.arrayContaining([F, K, H]));
    // the card is out of the game: not in any hand, deck or discard
    expect([...n.deck, ...n.discard, ...n.pile, ...n.players.flatMap((p) => p.hand)]).not.toContain(DB);
    expect(totalCards(n)).toBe(totalCards(s) - 1); // Dal Badal left the game
  });
});

describe("THE END — Surrender, Mandatory Vote, then everyone reveals", () => {
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
  it("whoever the Mandatory Vote puts out hands nothing on — the cards go to the village, Stones count for it; the role stays hidden", () => {
    let n = toFinal(start(NAMES(6), 21));
    const villager = n.players.find((p) => p.side === "V" && p.alive)!;
    const thief = n.players.find((p) => p.side === "T" && p.alive)!;
    n = rigSurrender(n, [villager.seat, thief.seat]);
    n = apply(n, villager.seat, { type: "surrender", give: true });
    n = apply(n, thief.seat, { type: "surrender", give: false });   // one with the village: the vote decides
    for (const p of n.players.filter((x) => x.alive)) n = apply(n, p.seat, { type: "ready" });
    for (const p of n.players.filter((x) => x.alive)) n = apply(n, p.seat, { type: "vote", target: thief.seat });
    const out = n.events.find((e) => e.type === "eliminated")!;
    expect(out.data!.role).toBeUndefined();
    if (n.phase.kind === "elim") n = apply(n, thief.seat, { type: "gift", target: null });
    expect(n.events.some((e) => e.type === "handoff")).toBe(false);
    expect(n.events.some((e) => e.type === "to_village")).toBe(true);
    expect(n.phase).toMatchObject({ kind: "over", winner: "V" });
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
