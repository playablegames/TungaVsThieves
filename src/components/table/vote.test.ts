// The Faisla vote (open vote, rule 3.4): the live count on every screen, and out vs tie when it closes.
import { describe, expect, it } from "vitest";
import { readTally } from "./VoteResult";
import { liveCount } from "./VoteSheet";

const ev = (tally: Record<number, number>) => ({ n: 7, to: "all" as const, type: "tally", msg: "", data: { tally } });
const vote = (ballots: Record<number, { for: number | null; extra: boolean }>) =>
  ({ kind: "vote" as const, final: false, caller: 0, after: null, opened: 1, ballots });

describe("Faisla vote", () => {
  it("the live count: 1 a ballot, 2 for the extra vote only if you really hold it, no vote counts nothing", () => {
    const ph = vote({ 0: { for: 2, extra: false }, 1: { for: 2, extra: true }, 3: { for: null, extra: false }, 4: { for: 1, extra: true } });
    expect(liveCount(ph as never, 1)).toEqual({ 2: 3, 1: 1 });
  });
  it("most votes is out", () => {
    expect(readTally(ev({ 2: 3, 1: 1 })).out).toBe(2);
  });
  it("a tie at the top: nobody is out", () => {
    expect(readTally(ev({ 1: 2, 2: 2, 3: 1 })).out).toBeNull();
  });
  it("nobody voted: nobody is out", () => {
    expect(readTally(ev({})).out).toBeNull();
  });
});
