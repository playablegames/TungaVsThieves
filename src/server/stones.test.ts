import { describe, expect, it } from "vitest";
import { start } from "@/engine/engine";
import type { GameEvent, GameState } from "@/engine/types";
import { stoneOdds } from "./belief";

const names = ["A", "B", "C", "D", "E", "F"];
function table(): GameState {
  const s = start(names, 7);
  // a clean slate for the test: nobody holds a Stone yet in the bot's own hand
  for (const p of s.players) p.hand = p.hand.filter((c) => c !== "STONE_1" && c !== "STONE_2");
  return s;
}
const push = (s: GameState, e: Omit<GameEvent, "n">) => s.events.push({ ...e, n: s.events.length });

describe("bots track where the Stones are", () => {
  it("a Talashi sighting is certain, then fades as the holder passes, and the next pickup inherits it", () => {
    const s = table();
    push(s, { type: "talashi_private", to: [0], msg: "", data: { seat: 0, target: 2, hand: ["STONE_1", "FAISLA"] } });
    expect(stoneOdds(s, 0, 1).get(2)).toBeGreaterThan(0.9);
    push(s, { type: "pass", to: "all", msg: "", data: { seat: 2 } });
    const after = stoneOdds(s, 0, 1);
    expect(after.get(2)).toBeLessThan(0.9);
    push(s, { type: "pickup", to: "all", msg: "", data: { seat: 3 } });
    expect(stoneOdds(s, 0, 1).get(3)!).toBeGreaterThan(after.get(3)!);
  });

  it("other bots only see what they could see: the search is private", () => {
    const s = table();
    const before = stoneOdds(s, 1, 1).get(2)!;
    push(s, { type: "talashi_private", to: [0], msg: "", data: { seat: 0, target: 2, hand: ["STONE_1"] } });
    expect(stoneOdds(s, 1, 1).get(2)).toBeCloseTo(before, 10);
  });

  it("a Stone claim moves it by how far the speaker is trusted; a hand-off and the village are facts", () => {
    const s = table();
    const before = stoneOdds(s, 0, 1).get(4)!;
    push(s, { type: "claim", to: "all", msg: "", data: { seat: 1, kind: "stone", target: 4, has: true, side: null } });
    expect(stoneOdds(s, 0, 1).get(4)!).toBeGreaterThan(before);
    push(s, { type: "handoff", to: "all", msg: "", data: { seat: 4, target: 5, cards: ["STONE_2"] } });
    const o = stoneOdds(s, 0, 1);
    expect(o.get(4)).toBe(0);
    expect(o.get(5)).toBeGreaterThan(0.5);
    push(s, { type: "to_village", to: "all", msg: "", data: { seat: 5, cards: ["STONE_2", "STONE_1"] } });
    const all = stoneOdds(s, 0, 1);
    for (const x of [1, 2, 3, 4, 5]) expect(all.get(x)).toBeCloseTo(0, 6); // both Stones are with the village
  });
});
