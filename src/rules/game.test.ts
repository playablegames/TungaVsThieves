// One test per rule in docs/RULES_ABSOLUTE.md — the test name starts with the rule number.
import { describe, expect, it } from "vitest";
import {
  ACTIONS, type Card, legalMoves, living, move, newGame, nextLiving, RuleError, type State, TABLE, timeoutMove, tkRoles, view, waitingOn,
} from "./game";
import { int } from "./rng";

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);
const turnSeat = (s: State) => (s.phase.kind === "turn" ? s.phase.seat : -1);
/** a state at the start of someone's turn, with their 5 cards set by hand */
function at(n: number, hand: Card[], seed = 1) {
  const s = newGame(names(n), seed);
  const me = turnSeat(s);
  s.players[me].hand = [...hand];
  return { s, me };
}
const total = (s: State) => s.deck.length + s.discard.length + s.pile.length + s.players.reduce((a, p) => a + p.hand.length, 0);
const others = (s: State, me: number) => living(s).filter((p) => p.seat !== me).map((p) => p.seat);

describe("1 · setup", () => {
  it("1.1 only 4 to 12 players", () => {
    expect(() => newGame(names(3), 1)).toThrow(RuleError);
    expect(() => newGame(names(13), 1)).toThrow(RuleError);
    for (let n = 4; n <= 12; n++) expect(() => newGame(names(n), 1)).not.toThrow();
  });
  it("1.2 1.3 teams and rounds by player count", () => {
    for (let n = 4; n <= 12; n++) {
      const s = newGame(names(n), n);
      const [v, t, r] = TABLE[n];
      expect(s.players.filter((p) => p.side === "V").length).toBe(v);
      expect(s.players.filter((p) => p.side === "T").length).toBe(t);
      expect(s.rounds).toBe(r);
    }
    expect(TABLE[4][2]).toBe(2); expect(TABLE[5][2]).toBe(2); expect(TABLE[6][2]).toBe(3); expect(TABLE[9][2]).toBe(3); expect(TABLE[10][2]).toBe(4); expect(TABLE[12][2]).toBe(4);
  });
  it("1.6 1.7 the deal: 2 each + 3 in the pile (picked up by the first player), 63 cards in all, both Stones and Dal Badal dealt", () => {
    for (let n = 4; n <= 12; n++) {
      const s = newGame(names(n), 7 * n);
      expect(total(s)).toBe(63);
      const first = turnSeat(s);
      for (const p of s.players) expect(p.hand.length).toBe(p.seat === first ? 5 : 2);
      const dealt = s.players.flatMap((p) => p.hand);
      for (const c of ["TUNGA_STONE", "BHADRA_STONE", "DAL_BADAL"] as Card[]) expect(dealt).toContain(c);
      expect(s.deck.length).toBe(60 - 2 * n);
      expect(s.deck.every((c) => (ACTIONS as Card[]).includes(c))).toBe(true);
    }
  });
  it("1.8 a random player starts", () => {
    const firsts = new Set(Array.from({ length: 60 }, (_, i) => turnSeat(newGame(names(6), i + 1))));
    expect(firsts.size).toBeGreaterThan(3);
  });
  it("1.9 play goes clockwise to the next seat", () => {
    const { s, me } = at(6, ["FAISLA", "TALASHI", "KUNDLI", "TUNGA_STONE", "BHADRA_STONE"]);
    let t = move(s, me, { kind: "pass" });
    t = move(t, me, { kind: "give", cards: ["FAISLA", "TALASHI", "KUNDLI"] });
    expect(turnSeat(t)).toBe((me + 1) % 6);
  });
});

describe("2 · a turn", () => {
  it("2.1 you pick up the pile and hold 5", () => {
    const s = newGame(names(5), 3);
    expect(s.players[turnSeat(s)].hand.length).toBe(5);
  });
  it("2.2 2.3 a pair of an action card only — never a single, never Stones", () => {
    const { s, me } = at(5, ["FAISLA", "TALASHI", "TUNGA_STONE", "BHADRA_STONE", "KUNDLI"]);
    expect(() => move(s, me, { kind: "play", card: "FAISLA" })).toThrow(/pair/);
    expect(legalMoves(s, me).filter((m) => m.kind === "play")).toHaveLength(0);
  });
  it("2.4 PLAY: pass all 3 left, then draw 2", () => {
    const { s, me } = at(5, ["BHUKAMP", "BHUKAMP", "TALASHI", "KUNDLI", "TUNGA_STONE"]);
    let t = move(s, me, { kind: "play", card: "BHUKAMP" });
    for (const p of living(t)) t = move(t, p.seat, { kind: "bhukamp", card: t.players[p.seat].hand[0] });
    expect(t.players[me].hand.length).toBe(2);
    expect(t.pile.length).toBe(0); // the next player has picked it up
    expect(t.players[turnSeat(t)].hand.length).toBe(5);
  });
  it("2.5 2.6 PASS: keep any 2, pass 3 face down — Stones and Dal Badal may go", () => {
    const { s, me } = at(5, ["TUNGA_STONE", "BHADRA_STONE", "DAL_BADAL", "FAISLA", "KUNDLI"]);
    let t = move(s, me, { kind: "pass" });
    expect(() => move(t, me, { kind: "give", cards: ["TUNGA_STONE", "BHADRA_STONE"] })).toThrow(/exactly 3/);
    t = move(t, me, { kind: "give", cards: ["TUNGA_STONE", "BHADRA_STONE", "DAL_BADAL"] });
    expect(t.players[me].hand.sort()).toEqual(["FAISLA", "KUNDLI"]);
    const next = turnSeat(t);
    expect(t.players[next].hand).toEqual(expect.arrayContaining(["TUNGA_STONE", "BHADRA_STONE", "DAL_BADAL"]));
    // face down: nobody else sees it in their view
    const other = others(t, next).find((x) => x !== me)!;
    expect(view(t, other).players[next].hand).toBeNull();
  });
  it("2.7 an empty draw pile is refilled from the discards", () => {
    const { s, me } = at(5, ["KUNDLI", "KUNDLI", "FAISLA", "TALASHI", "TUNGA_STONE"]);
    s.discard.push(...s.deck.splice(0)); // nothing left to draw
    const t0 = others(s, me)[0];
    const t = move(s, me, { kind: "play", card: "KUNDLI", target: t0 });
    expect(t.players[me].hand.length).toBe(2);
    expect(t.events.some((e) => e.type === "reshuffle")).toBe(true);
  });
  it("2.8 time out = PASS (never a pair), keeping 2 at random", () => {
    const { s, me } = at(5, ["FAISLA", "FAISLA", "TALASHI", "KUNDLI", "TUNGA_STONE"]);
    expect(timeoutMove(s, me)).toEqual({ kind: "pass" });
    let t = move(s, me, timeoutMove(s, me));
    t = move(t, me, timeoutMove(t, me));
    expect(t.players[me].hand.length).toBe(2);
  });
  it("2.9 a round ends when every living player has had a turn; after the last round comes the final vote", () => {
    let s = newGame(names(4), 11);
    const turns = s.players.length * s.rounds;
    for (let i = 0; i < turns; i++) {
      const me = turnSeat(s);
      s = move(s, me, { kind: "pass" });
      s = move(s, me, { kind: "give", cards: s.players[me].hand.slice(0, 3) });
    }
    expect(s.phase.kind).toBe("vote");
    expect(s.phase.kind === "vote" && s.phase.final).toBe(true);
  });
});

describe("3 · action cards", () => {
  it("3.1 Talashi: only you see their 2 cards", () => {
    const { s, me } = at(5, ["TALASHI", "TALASHI", "FAISLA", "KUNDLI", "TUNGA_STONE"]);
    const tg = others(s, me)[0];
    const t = move(s, me, { kind: "play", card: "TALASHI", target: tg });
    const ev = t.events.find((e) => e.type === "talashi")!;
    expect(ev.to).toEqual([me]);
    expect(ev.data!.cards).toEqual(s.players[tg].hand);
  });
  it("3.2 Hera Pheri steals both cards; the robbed player draws 2 at once; you pass 3 and keep 2, no draw", () => {
    const { s, me } = at(5, ["HERA_PHERI", "HERA_PHERI", "FAISLA", "KUNDLI", "TALASHI"]);
    const tg = others(s, me)[0];
    s.players[tg].hand = ["TUNGA_STONE", "BHADRA_STONE"];
    let t = move(s, me, { kind: "play", card: "HERA_PHERI", target: tg });
    expect(t.players[me].hand).toEqual(expect.arrayContaining(["TUNGA_STONE", "BHADRA_STONE"]));
    expect(t.players[me].hand.length).toBe(5);
    expect(t.players[tg].hand.length).toBe(2);
    expect(t.players[tg].hand).not.toContain("TUNGA_STONE");
    const deck = t.deck.length;
    t = move(t, me, { kind: "give", cards: ["FAISLA", "KUNDLI", "TALASHI"] });
    expect(t.players[me].hand.sort()).toEqual(["BHADRA_STONE", "TUNGA_STONE"]);
    expect(t.deck.length).toBe(deck);
  });
  it("3.3 Kundli: you and they see each other's role, nobody else", () => {
    const { s, me } = at(5, ["KUNDLI", "KUNDLI", "FAISLA", "TALASHI", "TUNGA_STONE"]);
    const tg = others(s, me)[0];
    const t = move(s, me, { kind: "play", card: "KUNDLI", target: tg });
    const ks = t.events.filter((e) => e.type === "kundli");
    expect(ks.map((e) => e.to)).toEqual([[me], [tg]]);
    expect(ks[0].data!.role).toBe(s.players[tg].role);
    expect(ks[1].data!.role).toBe(s.players[me].role);
  });
  it("3.4 Faisla: everyone votes, the caller too; no self vote; may abstain; plain most votes is out", () => {
    const { s, me } = at(6, ["FAISLA", "FAISLA", "KUNDLI", "TALASHI", "TUNGA_STONE"]);
    let t = move(s, me, { kind: "play", card: "FAISLA" });
    expect(waitingOn(t)).toContain(me);
    expect(() => move(t, me, { kind: "vote", for: me })).toThrow(/yourself/);
    const [a, b, x, y] = others(t, me);
    // x and y vote a, a votes b, everyone else (the caller too) abstains: a has 2 of 6 votes — no majority, still out
    const plan: Record<number, number | null> = { [x]: a, [y]: a, [a]: b };
    for (const v of living(t).map((p) => p.seat)) t = move(t, v, { kind: "vote", for: plan[v] ?? null });
    expect(t.players[a].alive).toBe(false);
    expect(t.phase.kind).toBe("gift");
  });
  it("3.5 Faisla tie: nobody is out", () => {
    const { s, me } = at(4, ["FAISLA", "FAISLA", "KUNDLI", "TALASHI", "TUNGA_STONE"]);
    let t = move(s, me, { kind: "play", card: "FAISLA" });
    const [a, b] = others(t, me);
    for (const v of living(t).map((p) => p.seat)) t = move(t, v, { kind: "vote", for: v === a ? b : v === b ? a : null });
    expect(living(t).length).toBe(4);
    expect(t.events.some((e) => e.type === "tie")).toBe(true);
  });
  it("3.6 Bhukamp: everyone passes 1 card (any card) to the next player, all at once", () => {
    const { s, me } = at(5, ["BHUKAMP", "BHUKAMP", "DAL_BADAL", "KUNDLI", "TALASHI"]);
    let t = move(s, me, { kind: "play", card: "BHUKAMP" });
    const before = t.players.map((p) => [...p.hand]);
    const picks: Record<number, Card> = {};
    for (const p of living(t)) { picks[p.seat] = p.seat === me ? "DAL_BADAL" : p.hand[0]; }
    for (const p of living(t)) t = move(t, p.seat, { kind: "bhukamp", card: picks[p.seat] });
    for (const p of living(s)) if (p.seat !== me && nextLiving(s, p.seat) !== me && p.seat !== nextLiving(s, me)) {
      expect(t.players[nextLiving(s, p.seat)].hand).toContain(picks[p.seat]);
    }
    expect(before[me].length).toBe(3);
  });
  it("3.7 Teer Kaman: exact role; 1 role at 4–6, 2 at 7–12; hit puts them out, miss puts you out", () => {
    expect(tkRoles(newGame(names(6), 1))).toBe(1);
    expect(tkRoles(newGame(names(7), 1))).toBe(2);
    // hit
    let { s, me } = at(6, ["TEER_KAMAN", "TEER_KAMAN", "FAISLA", "KUNDLI", "TALASHI"]);
    const tg = others(s, me)[0];
    let t = move(move(s, me, { kind: "teer_kaman", target: tg }), me, { kind: "shoot", roles: [s.players[tg].role] });
    expect(t.players[tg].alive).toBe(false);
    expect(t.events.find((e) => e.type === "teer_kaman")!.data!.hit).toBe(true);
    // the role is never announced to the table
    expect(t.events.filter((e) => e.to === "all" && e.type !== "roles_in_play").some((e) => e.msg.includes(s.players[tg].role))).toBe(false);
    // miss — a wrong role of the same side still misses
    ({ s, me } = at(6, ["TEER_KAMAN", "TEER_KAMAN", "FAISLA", "KUNDLI", "TALASHI"], 5));
    const tg2 = others(s, me)[0];
    const wrong = s.rolesInPlay.find((r) => r !== s.players[tg2].role)!;
    t = move(move(s, me, { kind: "teer_kaman", target: tg2 }), me, { kind: "shoot", roles: [wrong] });
    expect(t.players[me].alive).toBe(false);
    expect(t.players[tg2].alive).toBe(true);
  });
});

describe("4 · Dal Badal", () => {
  const thiefTurn = (n: number) => {
    for (let seed = 1; seed < 500; seed++) {
      const { s, me } = at(n, ["DAL_BADAL", "FAISLA", "KUNDLI", "TALASHI", "TUNGA_STONE"], seed);
      if (s.players[me].side === "T") return { s, me };
    }
    throw new Error("no thief start");
  };
  it("4.1 4.2 thief + 3 = 4 role cards shuffled; the thief's role is shown to all", () => {
    const { s, me } = thiefTurn(8);
    const tg = others(s, me).slice(0, 3);
    const t = move(s, me, { kind: "dal_badal", targets: tg });
    const ev = t.events.find((e) => e.type === "dal_badal")!;
    expect(ev.to).toBe("all");
    expect(ev.data!.role).toBe(s.players[me].role);
    const before = [me, ...tg].map((x) => s.players[x].role).sort(), after = [me, ...tg].map((x) => t.players[x].role).sort();
    expect(after).toEqual(before);
    for (const x of [me, ...tg]) expect(t.events.some((e) => e.type === "role" && Array.isArray(e.to) && e.to[0] === x && e.n >= ev.n)).toBe(true);
  });
  it("4.3 it is the turn's play: then pass 3, keep 1, draw 1", () => {
    const { s, me } = thiefTurn(6);
    let t = move(s, me, { kind: "dal_badal", targets: others(s, me).slice(0, 3) });
    expect(t.phase.kind === "pass" && t.phase.keep === 1).toBe(true);
    expect(() => move(t, me, { kind: "play", card: "FAISLA" })).toThrow();
    t = move(t, me, { kind: "give", cards: t.players[me].hand.slice(0, 3) });
    expect(t.players[me].hand.length).toBe(2);
  });
  it("4.4 fewer than 3 others alive: pick them all", () => {
    const { s, me } = thiefTurn(5);
    const o = others(s, me);
    s.players[o[0]].alive = false; s.players[o[1]].alive = false; s.players[o[0]].hand = []; s.players[o[1]].hand = [];
    // keep one villager alive so the game isn't over
    expect(() => move(s, me, { kind: "dal_badal", targets: [o[2]] })).toThrow(/Pick 2/);
    expect(() => move(s, me, { kind: "dal_badal", targets: [o[2], o[3]] })).not.toThrow();
  });
  it("4.5 a villager can never use it", () => {
    for (let seed = 1; seed < 200; seed++) {
      const { s, me } = at(6, ["DAL_BADAL", "FAISLA", "KUNDLI", "TALASHI", "TUNGA_STONE"], seed);
      if (s.players[me].side !== "V") continue;
      expect(() => move(s, me, { kind: "dal_badal", targets: others(s, me).slice(0, 3) })).toThrow();
      return;
    }
  });
  it("only on the thief's own turn (owner 2026-11-17)", () => {
    for (let seed = 1; seed < 300; seed++) {
      const s = newGame(names(6), seed);
      const me = turnSeat(s);
      const thief = s.players.find((p) => p.side === "T" && p.seat !== me)!;
      thief.hand = ["DAL_BADAL", "FAISLA"];
      const o = living(s).filter((p) => p.seat !== thief.seat).slice(0, 3).map((p) => p.seat);
      expect(() => move(s, thief.seat, { kind: "dal_badal", targets: o })).toThrow();
      break;
    }
  });
});

describe("5 · elimination", () => {
  it("5.2 5.4 out by Faisla: their cards go to the caller, who passes 3 and keeps 2 with no draw", () => {
    const { s, me } = at(6, ["FAISLA", "FAISLA", "KUNDLI", "TALASHI", "TUNGA_STONE"]);
    let t = move(s, me, { kind: "play", card: "FAISLA" });
    const tg = others(t, me)[0];
    const theirs = [...t.players[tg].hand];
    for (const v of living(t).map((p) => p.seat)) t = move(t, v, { kind: "vote", for: v === tg ? me : tg });
    expect(t.players[tg].alive).toBe(false);
    expect(t.players[me].hand).toEqual(expect.arrayContaining(theirs));
    t = move(t, tg, { kind: "gift", to: me });
    expect(t.phase.kind === "pass" && t.phase.seat === me && t.phase.keep === 2).toBe(true);
    const deck = t.deck.length;
    t = move(t, me, { kind: "give", cards: t.players[me].hand.slice(0, 3) });
    expect(t.players[me].hand.length).toBe(2);
    expect(t.deck.length).toBe(deck);
  });
  it("5.4 the Faisla caller voted out by their own Faisla: their 3 cards become the next player's pile", () => {
    const { s, me } = at(6, ["FAISLA", "FAISLA", "KUNDLI", "TALASHI", "TUNGA_STONE"]);
    let t = move(s, me, { kind: "play", card: "FAISLA" });
    const tg = others(t, me)[0];
    for (const v of living(t).map((p) => p.seat)) t = move(t, v, { kind: "vote", for: v === me ? tg : me });
    expect(t.players[me].alive).toBe(false);
    t = move(t, me, { kind: "gift", to: tg });
    const next = turnSeat(t);
    expect(next).toBe(nextLiving(t, me));
    expect(t.players[next].hand).toEqual(expect.arrayContaining(["KUNDLI", "TALASHI", "TUNGA_STONE"]));
    expect(t.players[me].hand).toEqual([]);
  });
  it("5.3 5.4 Teer Kaman miss: the shooter is out and their 3 cards become the next player's pile", () => {
    const { s, me } = at(6, ["TEER_KAMAN", "TEER_KAMAN", "FAISLA", "KUNDLI", "TUNGA_STONE"], 9);
    const tg = others(s, me)[0];
    let t = move(move(s, me, { kind: "teer_kaman", target: tg }), me, { kind: "shoot", roles: [s.rolesInPlay.find((r) => r !== s.players[tg].role)!] });
    t = move(t, me, { kind: "gift", to: tg });
    const next = turnSeat(t);
    expect(t.players[next].hand).toEqual(expect.arrayContaining(["FAISLA", "KUNDLI", "TUNGA_STONE"]));
    expect(t.players[next].hand.length).toBe(5);
  });
  it("5.5 5.6 the out player must give the extra vote; it counts 2, once, then it is gone; a newer gift replaces it", () => {
    const { s, me } = at(6, ["FAISLA", "FAISLA", "KUNDLI", "TALASHI", "TUNGA_STONE"]);
    let t = move(s, me, { kind: "play", card: "FAISLA" });
    const [a, b, c] = others(t, me);
    for (const v of living(t).map((p) => p.seat)) t = move(t, v, { kind: "vote", for: v === a ? me : a });
    expect(waitingOn(t)).toEqual([a]);
    expect(() => move(t, a, { kind: "gift", to: a })).toThrow();
    t = move(t, a, { kind: "gift", to: b });
    expect(t.extraVote).toBe(b);
    expect(() => move(t, c, { kind: "vote", for: b, extra: true })).toThrow();
    // a newer gift replaces it
    const u = structuredClone(t); u.extraVote = c; expect(u.extraVote).toBe(c);
  });
  it("5.7 instant win when every thief is out", () => {
    for (let seed = 1; seed < 200; seed++) {
      const { s, me } = at(4, ["TEER_KAMAN", "TEER_KAMAN", "FAISLA", "KUNDLI", "TALASHI"], seed);
      if (s.players[me].side !== "V") continue;
      const thief = s.players.find((p) => p.side === "T")!;
      const t = move(move(s, me, { kind: "teer_kaman", target: thief.seat }), me, { kind: "shoot", roles: [thief.role] });
      expect(t.phase.kind === "over" && t.phase.winner === "V").toBe(true);
      return;
    }
  });
  it("5.8 out players can't move and are skipped", () => {
    const { s, me } = at(6, ["TEER_KAMAN", "TEER_KAMAN", "FAISLA", "KUNDLI", "TALASHI"], 3);
    const tg = nextLiving(s, me);
    let t = move(move(s, me, { kind: "teer_kaman", target: tg }), me, { kind: "shoot", roles: [s.players[tg].role] });
    if (t.phase.kind === "over") return;
    t = move(t, tg, { kind: "gift", to: me });
    expect(() => move(t, tg, { kind: "pass" })).toThrow(/only watch/);
    t = move(t, me, { kind: "give", cards: t.players[me].hand.slice(0, 3) });
    expect(turnSeat(t)).toBe(nextLiving(t, tg));
  });
});

describe("6 · the end", () => {
  const toFinal = (seed: number, n = 4) => {
    let s = newGame(names(n), seed);
    while (s.phase.kind === "turn") { const me = turnSeat(s); s = move(s, me, { kind: "pass" }); s = move(s, me, { kind: "give", cards: s.players[me].hand.slice(0, 3) }); }
    return s;
  };
  it("6.1 final vote tie: nobody out, Stones counted as they are", () => {
    let s = toFinal(21);
    const l = living(s).map((p) => p.seat);
    for (const v of l) s = move(s, v, { kind: "vote", for: null });
    expect(s.phase.kind).toBe("over");
    expect(living(s).length).toBe(4);
  });
  it("6.2 6.3 a thief voted out with a Stone: it counts for the village", () => {
    for (let seed = 1; seed < 400; seed++) {
      let s = toFinal(seed);
      const thief = living(s).find((p) => p.side === "T")!;
      const v = living(s).filter((p) => p.side === "V");
      // put both Stones with the village except one with the thief
      for (const p of s.players) p.hand = p.hand.filter((c) => c !== "TUNGA_STONE" && c !== "BHADRA_STONE");
      s.pile = s.pile.filter((c) => c !== "TUNGA_STONE" && c !== "BHADRA_STONE");
      thief.hand.push("TUNGA_STONE"); v[0].hand.push("BHADRA_STONE");
      for (const p of living(s)) s = move(s, p.seat, { kind: "vote", for: p.seat === thief.seat ? v[0].seat : thief.seat });
      expect(s.phase.kind === "over" && s.phase.winner === "V").toBe(true);
      return;
    }
  });
  it("6.3 a thief holding a Stone at the end wins", () => {
    let s = toFinal(31);
    const thief = living(s).find((p) => p.side === "T")!;
    for (const p of s.players) p.hand = p.hand.filter((c) => c !== "TUNGA_STONE" && c !== "BHADRA_STONE");
    s.pile = s.pile.filter((c) => c !== "TUNGA_STONE" && c !== "BHADRA_STONE");
    thief.hand.push("TUNGA_STONE"); s.pile.push("BHADRA_STONE");
    for (const p of living(s)) s = move(s, p.seat, { kind: "vote", for: null });
    expect(s.phase.kind === "over" && s.phase.winner === "T").toBe(true);
  });
  it("6.4 a Stone left in the pile counts for the village", () => {
    let s = toFinal(41);
    const vill = living(s).find((p) => p.side === "V")!;
    for (const p of s.players) p.hand = p.hand.filter((c) => c !== "TUNGA_STONE" && c !== "BHADRA_STONE");
    s.pile = s.pile.filter((c) => c !== "TUNGA_STONE" && c !== "BHADRA_STONE");
    vill.hand.push("TUNGA_STONE"); s.pile.push("BHADRA_STONE");
    for (const p of living(s)) s = move(s, p.seat, { kind: "vote", for: null });
    expect(s.phase.kind === "over" && s.phase.winner === "V").toBe(true);
  });
  it("6.5 roles stay hidden until the game is over", () => {
    const s = newGame(names(6), 2);
    const v = view(s, 0);
    expect(v.players.filter((p) => p.role !== null).map((p) => p.seat)).toEqual([0]);
  });
});

describe("talk + Teer Kaman aim", () => {
  it("anyone, out players too, can talk any time; it is never checked for truth", () => {
    const { s, me } = at(6, ["TEER_KAMAN", "TEER_KAMAN", "FAISLA", "KUNDLI", "TALASHI"], 3);
    const o = others(s, me);
    let t = move(s, o[0], { kind: "say", talk: { t: "claim", role: "Nobody-role" } }); // a provable lie is still allowed
    expect(t.events.at(-1)!.type).toBe("say");
    t = move(t, me, { kind: "teer_kaman", target: o[1] });
    expect(t.phase.kind).toBe("aim");
    t = move(t, o[1], { kind: "say", talk: { t: "claim", role: "Kisaan" } }); // the target pleads during the aim
    t = move(t, o[2], { kind: "say", talk: { t: "accuse", target: o[1], role: "Chor" } });
    t = move(t, me, { kind: "shoot", roles: [t.players[o[1]].role] });
    expect(t.players[o[1]].alive).toBe(false);
    t = move(t, o[1], { kind: "say", talk: { t: "react", emoji: "cry" } }); // out, still talks
    expect(t.events.at(-1)!.data!.seat).toBe(o[1]);
  });
});

describe("every game, random moves", () => {
  it("cards are never lost or made; the living hold 2 between turns; every game ends", () => {
    for (let n = 4; n <= 12; n++) for (let g = 0; g < 240; g++) {
      let s = newGame(names(n), g * 31 + n);
      let steps = 0;
      while (s.phase.kind !== "over") {
        expect(total(s)).toBe(63);
        if (s.phase.kind === "turn") for (const p of living(s)) if (p.seat !== s.phase.seat) expect(p.hand.length).toBeLessThanOrEqual(2);
        const who = [...waitingOn(s), ...living(s).map((p) => p.seat)];
        const seat = who[int(s, Math.min(who.length, waitingOn(s).length + 1))];
        const ms = legalMoves(s, seat);
        if (!ms.length) { const w = waitingOn(s)[0]; s = move(s, w, legalMoves(s, w)[int(s, legalMoves(s, w).length)]); }
        else s = move(s, seat, ms[int(s, ms.length)]);
        if (++steps > 5000) throw new Error(`stuck at ${n}p game ${g}`);
      }
    }
  });
});
