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
  const games = Array.from({ length: 80 }, (_, i) => game(4 + (i % 9), 500 + i));

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

  it("Dal Badal: both swapped bots know each other's role, and everything any bot 'knows' stays true after swaps", () => {
    let swaps = 0, facts = 0;
    for (let i = 0; i < 400; i++) {
      const { s } = i < games.length ? games[i] : game(6 + (i % 7), 9000 + i);
      const swapsHere = s.events.filter((e) => e.type === "dal_badal");
      // check the mind right after each swap, and at the end of the game
      const moments = [...swapsHere.map((e) => e.n + 3), s.events.length];
      for (const end of moments) {
        const at: GameState = { ...s, events: s.events.slice(0, end) };
        // sides as they stood at that moment: replay the swaps up to there
        const side = s.players.map((p) => p.side);
        const orig = s.events.find((e) => e.type === "analytics_deal")!.data!.players as { side: "V" | "T" }[];
        orig.forEach((p, k) => (side[k] = p.side));
        for (const e of at.events) if (e.type === "dal_badal") { const a = e.data!.a as number, b = e.data!.b as number; [side[a], side[b]] = [side[b], side[a]]; }
        for (let seat = 0; seat < s.players.length; seat++) {
          const view = { ...at, players: at.players.map((p, k) => ({ ...p, side: side[k] })) };
          const m = mindOf(view, seat, 1);
          for (const [x, k] of m.known) { expect(k.side).toBe(side[x]); facts++; }
          const last = [...at.events].reverse().find((e) => e.type === "dal_badal");
          if (last && end !== s.events.length && (last.data!.a === seat || last.data!.b === seat)) {
            const partner = last.data!.a === seat ? (last.data!.b as number) : (last.data!.a as number);
            if (view.players[partner].alive) { expect(m.known.get(partner)?.side).toBe(side[partner]); expect(m.known.get(partner)?.how).toBe("swap"); swaps++; }
          }
        }
      }
    }
    expect(swaps).toBeGreaterThan(5);
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
