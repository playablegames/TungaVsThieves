// Invariant fuzzing: random-legal players at every count 4-30, the suite_v15.py audit checks after EVERY action,
// plus redaction checks on every player's view. Zero violations required.
import { describe, expect, it } from "vitest";
import { apply, start, waitingOn } from "../engine";
import { randomAction, defaultAction } from "../decisions";
import { isStone, type GameState } from "../types";
import { viewFor } from "../view";
import { NAMES, totalCards } from "./helpers";

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function check(s: GameState, thieves: number, roles: string, firstPickupDone: boolean, bad: Map<string, number>) {
  const hit = (k: string) => bad.set(k, (bad.get(k) ?? 0) + 1);
  if (totalCards(s) !== 66) hit("card total != 66");
  const inPlay = [...s.pile, ...s.players.flatMap((p) => p.hand)].filter(isStone).length;
  if (inPlay !== 2) hit(`Stones in hands+pile = ${inPlay}`);
  if ([...s.deck, ...s.discard].some(isStone)) hit("Stone in deck/discard");
  if (s.players.filter((p) => p.side === "T").length !== thieves) hit("thief count changed");
  if (s.players.map((p) => p.role).sort().join() !== roles) hit("role set changed");
  const elimSeat = s.phase.kind === "elim" ? s.phase.seat : -1;
  const queued = new Set(s.elimQueue.map((q) => q.seat));
  for (const p of s.players) {
    // a wipe ends the game AT ONCE (rulebook), so the last one out may still hold cards when it's over
    if (!p.alive && p.hand.length && p.seat !== elimSeat && !queued.has(p.seat) && s.phase.kind !== "over") hit("dead player holds cards");
    if (p.votes < 0) hit("negative votes");
  }
  if ([...s.deck, ...s.discard, ...s.pile, ...s.players.flatMap((p) => p.hand)].filter((c) => c === "DAL_BADAL").length > 1) hit("more than one Dal Badal");
  if (s.phase.kind !== "over" && waitingOn(s).length === 0) hit("nobody can act but the game is not over");
}

function redaction(s: GameState, bad: Map<string, number>) {
  const hit = (k: string) => bad.set(k, (bad.get(k) ?? 0) + 1);
  const over = s.phase.kind === "over";
  for (const p of s.players) {
    const v = viewFor(s, p.seat);
    if (!over && v.events.some((e) => e.to !== "all" && !e.to.includes(p.seat))) hit("view leaks a private event");
    if (v.events.some((e) => Array.isArray(e.to) && e.to.length === 0)) hit("view shows analytics");
    if (over && v.events.length !== s.events.filter((e) => !(Array.isArray(e.to) && e.to.length === 0)).length) hit("the end doesn't open the whole story");
    if (!over && v.finalReveal) hit("final reveal before the end");
    for (const q of v.players) {
      if ("role" in q || "hand" in q) hit("public player row carries role/hand");
      if (!over && q.revealedRole && s.players[q.seat].revealedRole === null) hit("unrevealed role in view");
    }
  }
}

const GAMES_PER_COUNT = Number(process.env.FUZZ_GAMES ?? 400);
describe("fuzz: random legal games, every count 4-30", () => {
  it.each(Array.from({ length: 27 }, (_, i) => i + 4))("%i players: every invariant holds, no secret leaks", (n) => {
    const bad = new Map<string, number>();
    const ends = new Map<string, number>();
    let games = 0, actions = 0;
    {
      for (let g = 0; g < GAMES_PER_COUNT; g++) {
        const r = mulberry(n * 100003 + g);
        let s = start(NAMES(n), n * 7919 + g);
        const thieves = s.players.filter((p) => p.side === "T").length;
        const roles = s.players.map((p) => p.role).sort().join();
        const activity = [0.2, 0.6, 0.95][g % 3];
        let steps = 0, firstPickupDone = false;
        while (s.phase.kind !== "over" && steps < 20000) {
          const seat = waitingOn(s)[0];
          // occasionally a phone times out: the default must always be legal
          const a = r() < 0.1 ? defaultAction(s, seat) : randomAction(s, seat, r, activity);
          s = apply(s, seat, a);
          if (s.turnSeat !== 0 || s.round > 1) firstPickupDone = true;
          check(s, thieves, roles, firstPickupDone, bad);
          if (steps % 7 === 0) redaction(s, bad);
          steps++; actions++;
        }
        if (s.phase.kind !== "over") bad.set("game did not finish", (bad.get("game did not finish") ?? 0) + 1);
        else ends.set(s.phase.reason, (ends.get(s.phase.reason) ?? 0) + 1);
        games++;
      }
    }
    console.log(`fuzz ${n}p: ${games} games, ${actions} actions — endings:`, Object.fromEntries(ends));
    expect(Object.fromEntries(bad)).toEqual({});
  });
});
