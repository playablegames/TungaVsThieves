// A server call has no memory, so every call rebuilds the bots from the game's log (bots.ts). A rebuilt bot must
// believe exactly what a bot that watched the whole game live believes — or bots would get dumber on the server.
import { describe, expect, it } from "vitest";
import { playGame, SKILLS } from "@/rules/brain";
import { rebuild } from "./bots";

describe("a rebuilt bot", () => {
  for (const n of [5, 8, 12]) it(`believes what the live bot believes (${n} players)`, () => {
    let checks = 0;
    for (let seed = 1; seed <= 6; seed++) {
      let step = 0;
      playGame(n, seed, SKILLS.average, (s, bots) => {
        if (step++ % 9) return;
        for (const live of bots) {
          // compare at the point in the log the live bot has reached (bots who spoke after it are still news to it)
          const at = { ...s, events: s.events.slice(0, live.seen) };
          // the verdicts the live bot reached with its hand at the time travel with the game (bot_note lines on the server)
          const rebuilt = rebuild({ seat: live.seat, name: s.players[live.seat].name, skill: "average" }, at, at.events.length, new Map(live.noted)).p(s);
          live.p(s).forEach((v, i) => expect(rebuilt[i]).toBeCloseTo(v, 9));
          checks++;
        }
      });
    }
    expect(checks).toBeGreaterThan(50);
  });
});
