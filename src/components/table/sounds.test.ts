// The table's sounds follow the list the owner approved on the sound board (2026-11-19). Each game event plays its
// sound; this pins the mapping so it can't drift.
import { beforeEach, describe, expect, it, vi } from "vitest";

const played: [string, unknown][] = [];
vi.mock("@/lib/sfx", () => ({ play: (n: string, a?: unknown) => played.push([n, a]), unlockOnFirstTap: () => {} }));
vi.mock("@/lib/music", () => ({ setMood: () => {}, playSting: async () => {}, startMusicOnFirstTap: () => {}, stopMusic: () => {} }));

const { soundFor } = await import("./useTableSounds");
const ev = (type: string, data?: Record<string, unknown>) => ({ n: 1, to: "all" as const, type, msg: "", data });
const names = () => played.map(([n]) => n);

describe("table sounds", () => {
  beforeEach(() => { played.length = 0; vi.useFakeTimers(); });

  it.each([
    ["TALASHI", "flip"], ["KUNDLI", "mystic"], ["HERA_PHERI", "steal"], ["BHUKAMP", "quake"],
  ])("playing a %s pair whooshes, then %s", (card, sound) => {
    soundFor(ev("play", { card }), 0);
    expect(names()).toEqual(["whoosh", sound]);
  });

  it("Faisla's dhol plays when the vote opens, not twice", () => {
    soundFor(ev("play", { card: "FAISLA" }), 0);
    soundFor(ev("vote", { final: false }), 0);
    expect(names()).toEqual(["whoosh", "faisla"]);
  });

  it("passing 3 cards is the quieter whoosh", () => {
    soundFor(ev("pass"), 0);
    expect(played).toEqual([["whoosh", true]]);
  });

  it("Teer Kaman: arrow with a thud on a hit, a clatter on a miss", () => {
    soundFor(ev("teer_kaman", { hit: true }), 0);
    soundFor(ev("teer_kaman", { hit: false }), 0);
    expect(played).toEqual([["arrow", true], ["arrow", false]]);
  });

  it("open vote: each ballot is a note that climbs with the votes cast; the count is a drumroll", () => {
    soundFor(ev("ballot", { cast: 1 }), 0);
    soundFor(ev("ballot", { cast: 3 }), 0);
    soundFor(ev("tally", {}), 0);
    expect(played).toEqual([["vote", 0], ["vote", 2], ["drumroll", undefined]]);
  });

  it("out = gong, Dal Badal = swirl", () => {
    soundFor(ev("out"), 0);
    soundFor(ev("dal_badal"), 0);
    expect(names()).toEqual(["gong", "swirl"]);
  });

  it("the end: fanfare if your side won, wah wah if not — your side as it was at the end", () => {
    const players = [{ seat: 0, side: "V" }, { seat: 1, side: "T" }];
    soundFor(ev("over", { winner: "V", players }), 0);
    soundFor(ev("over", { winner: "V", players }), 1);
    expect(names()).toEqual(["fanfare", "sting"]);
  });

  it("talk and turn hand-offs stay quiet", () => {
    soundFor(ev("say"), 0);
    soundFor(ev("turn"), 0);
    soundFor(ev("round"), 0);
    expect(played).toEqual([]);
  });
});
