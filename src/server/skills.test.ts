// THE BOTS' SKILL MIX (owner 2026-11-23, steps 4+5): by table size, then by the least experienced person's games.
import { describe, expect, it } from "vitest";
import { skilledShare } from "./game";

describe("bot skill mix", () => {
  it("follows the table size (measured on human-habit bots)", () => {
    expect(skilledShare(7, 5)).toBe(0.85);
    expect(skilledShare(6, 5)).toBe(0.15);
    expect(skilledShare(8, 5)).toBe(0.15);
    for (const n of [4, 5, 9, 10, 11, 12]) expect(skilledShare(n, 5)).toBe(0.5);
  });
  it("is gentler for a new player and tougher for an old hand, never past 0-1", () => {
    expect(skilledShare(9, 0)).toBeCloseTo(0.2);
    expect(skilledShare(9, 2)).toBeCloseTo(0.2);
    expect(skilledShare(9, 3)).toBe(0.5);
    expect(skilledShare(9, 10)).toBeCloseTo(0.8);
    expect(skilledShare(6, 0)).toBe(0);
    expect(skilledShare(7, 50)).toBe(1);
    expect(skilledShare(9, undefined)).toBe(0.5);
  });
});
