import { describe, expect, it } from "vitest";
import { apply, start, waitingOn } from "@/engine/engine";
import { randomAction } from "@/engine/decisions";
import type { GameState } from "@/engine/types";
import { botTalk, botVote, debateLine, mindOf } from "./botmind";

let a = 11;
const rnd = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
const fixed = (seed: number) => { let x = seed; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; };

/** play a whole game, recording the bots' lines after every move as the server would */
function game(n: number, seed: number) {
  let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), seed);
  const bots = Array.from({ length: n }, (_, i) => i).filter((i) => i % 2 === 0);
  const batches = [botTalk(s, 0, bots, seed, rnd)];
  for (let k = 0; k < 4000 && s.phase.kind !== "over"; k++) {
    const seat = waitingOn(s)[0];
    const from = s.events.length;
    s = apply(s, seat, randomAction(s, seat, rnd));
    batches.push(botTalk(s, from, bots, seed, rnd));
  }
  return { s, bots, batches };
}

describe("bot minds", () => {
  const games = Array.from({ length: 80 }, (_, i) => game(5 + (i % 9), 500 + i));

  it("talk through whole games without failing: only bots speak, at most 3 lines and one per bot per move", () => {
    let lines = 0;
    for (const g of games) for (const b of g.batches) {
      expect(b.length).toBeLessThanOrEqual(3);
      expect(new Set(b.map((l) => l.seat)).size).toBe(b.length);
      for (const l of b) { expect(g.bots).toContain(l.seat); expect(l.text.length).toBeGreaterThan(3); expect(l.text).not.toMatch(/undefined|null|NaN|\?\?/); }
      lines += b.length;
    }
    expect(lines).toBeGreaterThan(200);
  });

  it("speak at the moments that matter: a Faisla, an elimination, the end", () => {
    const texts = games.flatMap((g) => g.batches.flat().map((l) => l.text));
    expect(texts.some((t) => /Faisla bulaya/.test(t))).toBe(true);
    expect(texts.some((t) => /gaon wala tha|main chor tha/i.test(t))).toBe(true);
    expect(texts.some((t) => /jeet gaye|jeet gaya/.test(t))).toBe(true);
  });

  it("a villager bot that saw a thief in its Kundli says so and votes for them", () => {
    let checked = 0;
    for (const g of games) {
      // replay to the moment after the first Kundli read by a villager on a thief
      const e = g.s.events.find((x) => x.type === "kundli_private" && x.data?.side === "T" && Array.isArray(x.to) && g.s.players[x.to[0]].side === "V");
      if (!e) continue;
      const reader = (e.to as number[])[0], thief = e.data!.target as number;
      const s: GameState = { ...g.s, events: g.s.events.slice(0, e.n + 1), players: g.s.players.map((p) => ({ ...p, alive: true })) };
      expect(botVote(s, reader, 1, fixed(3))).toBe(thief);
      expect(debateLine(mindOf(s, reader, 1), false, fixed(3))).toMatch(new RegExp(`${g.s.players[thief].name}.*(CHOR|chor)`));
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });

  it("never cheat: a bot's words and vote don't change when OTHER players' hidden roles and cards change", () => {
    let checked = 0;
    for (const g of games.slice(0, 40)) {
      const s = g.s.phase.kind === "over" ? { ...g.s, phase: { kind: "turn" as const, seat: 0 } } : g.s;
      for (const bot of g.bots) {
        // shuffle everyone else's secret role/side/hand; keep public facts (alive, revealed roles, votes) and this bot
        const scrambled: GameState = { ...s, players: s.players.map((p) => p.seat === bot || !p.alive ? p : { ...p, role: "X", side: p.side === "V" ? "T" : "V", hand: [] }) };
        const m1 = mindOf(s, bot, 7), m2 = mindOf(scrambled, bot, 7);
        expect([...m2.reads.entries()]).toEqual([...m1.reads.entries()]);
        expect(debateLine(m2, false, fixed(9))).toBe(debateLine(m1, false, fixed(9)));
        expect(botVote(scrambled, bot, 7, fixed(5))).toBe(botVote(s, bot, 7, fixed(5)));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("Dal Badal shuffles: everything any bot 'knows' stays true, and nobody keeps a stale read on a shuffled seat", () => {
    let shuffles = 0, facts = 0;
    for (let i = 0; i < 400; i++) {
      const { s } = i < games.length ? games[i] : game(6 + (i % 7), 9000 + i);
      const here = s.events.filter((e) => e.type === "dal_badal");
      shuffles += here.length;
      const moments = [...here.map((e) => e.n + 8), s.events.length];
      for (const end of moments) {
        const at: GameState = { ...s, events: s.events.slice(0, end) };
        // sides as they stood at that moment: the deal, then every secret "role" line since
        const side = (s.events.find((e) => e.type === "analytics_deal")!.data!.players as { side: "V" | "T" }[]).map((p) => p.side);
        for (const e of at.events) if (e.type === "role" && e.data?.swapped && Array.isArray(e.to)) side[e.to[0]] = e.data.side as "V" | "T";
        for (let seat = 0; seat < s.players.length; seat++) {
          const view = { ...at, players: at.players.map((p, k) => ({ ...p, side: side[k] })) };
          const m = mindOf(view, seat, 1);
          for (const [x, k] of m.known) { expect(k.side).toBe(side[x]); facts++; }
        }
      }
    }
    expect(shuffles).toBeGreaterThan(3);
    expect(facts).toBeGreaterThan(50);
  });

  it("thief bots hide a Stone; villager bots with a Stone ask to be trusted", () => {
    let villager = 0, thief = 0;
    for (const g of games) for (const bot of g.bots) {
      const s: GameState = { ...g.s, players: g.s.players.map((p) => (p.seat === bot ? { ...p, alive: true, hand: ["STONE_1", "FAISLA", "TALASHI"] } : p)) };
      const line = debateLine(mindOf(s, bot, 3), true, fixed(2));
      if (/CHOR hai|chor hai, Kundli|Mujh pe shak\?|Galat aadmi/.test(line)) continue; // a stronger priority spoke first
      if (s.players[bot].side === "T") { expect(line).not.toMatch(/Stone mere paas hai|Ek Stone mere paas/); thief++; }
      else { expect(line).toMatch(/Stone mere paas/); villager++; }
    }
    expect(villager).toBeGreaterThan(5);
    expect(thief).toBeGreaterThan(2);
  });
});

describe("claims out loud", () => {
  // playtest 2026-10-07: a player read a thief's Kundli and had no way to tell the bots
  const claim = (s: GameState, seat: number, target: number, side: "T" | "V", kind = "kundli") =>
    s.events.push({ n: s.events.length, type: "claim", to: "all", msg: "claim", data: { seat, kind, target, role: s.players[target].role, side } });

  it("a villager bot votes the thief a player says they read in a Kundli; the accused thief votes the speaker", () => {
    let votedThief = 0, total = 0, thiefHitsBack = 0, thiefTotal = 0;
    for (let g = 0; g < 60; g++) {
      const s = start(Array.from({ length: 8 }, (_, i) => `P${i}`), 7000 + g);
      const thief = s.players.find((p) => p.side === "T")!.seat;
      const speaker = s.players.find((p) => p.side === "V")!.seat;
      claim(s, speaker, thief, "T");
      for (const p of s.players) {
        if (p.seat === speaker || p.seat === thief) continue;
        if (p.side === "V") { total++; if (botVote(s, p.seat, s.seed, fixed(g + p.seat)) === thief) votedThief++; }
      }
      thiefTotal++;
      if (botVote(s, thief, s.seed, fixed(g)) === speaker) thiefHitsBack++;
    }
    expect(votedThief / total).toBeGreaterThan(0.7);
    expect(thiefHitsBack / thiefTotal).toBeGreaterThan(0.5);
  });

  it("the accused bot answers the claim", () => {
    const s = start(Array.from({ length: 6 }, (_, i) => `P${i}`), 42);
    const from = s.events.length;
    claim(s, 1, 2, "T", "accuse");
    const lines = botTalk(s, from, [2], s.seed, fixed(3));
    expect(lines.map((l) => l.seat)).toEqual([2]);
  });
});
