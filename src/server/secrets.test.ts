// BOTS DON'T CHEAT (release checklist §2 "don't let bots see secrets"; owner 2026-11-23 step 6). A bot must believe and
// decide exactly the same when every secret it may not see is wiped from the game: other players' hands, roles and
// sides, and every private event sent to someone else. If a bot peeked at any of it, the two would differ.
import { describe, expect, it } from "vitest";
import { decide, playGame, SKILLS, type Brain } from "@/rules/brain";
import { waitingOn, type State } from "@/rules/game";
import { rebuild } from "./bots";

function masked(s: State, seat: number): State {
  return {
    ...s,
    players: s.players.map((p) => (p.seat === seat ? p : { ...p, hand: [], role: "?", side: "V" as const })),
    events: s.events.map((e) => (e.to === "all" || e.to.includes(seat) ? e : { ...e, type: "hidden", msg: "", data: {} })),
  };
}

describe("bots see only their own view", () => {
  for (const n of [5, 8, 12]) it(`believes and decides the same with every secret wiped (${n} players)`, () => {
    let checks = 0;
    for (let seed = 1; seed <= 5; seed++) {
      let step = 0;
      playGame(n, 500 + seed, (seat) => (seat % 2 ? SKILLS.sharp : SKILLS.casual), (s, bots: Brain[]) => {
        if (step++ % 7) return;
        const who = waitingOn(s)[0];
        for (const live of bots) {
          const at = { ...s, events: s.events.slice(0, live.seen) };
          const bot = { seat: live.seat, name: s.players[live.seat].name, skill: live.skill.name };
          const full = rebuild(bot, at, at.events.length, new Map(live.noted));
          const blind = rebuild(bot, masked(at, live.seat), at.events.length, new Map(live.noted));
          const pf = full.p(s), pb = blind.p(masked(s, live.seat));
          pf.forEach((v, i) => expect(pb[i]).toBeCloseTo(v, 9));
          if (live.seat === who) {
            const a = decide(full, s, { rng: 12345 }), b = decide(blind, masked(s, live.seat), { rng: 12345 });
            expect(b).toEqual(a);
          }
          checks++;
        }
      });
    }
    expect(checks).toBeGreaterThan(40);
  });
});
