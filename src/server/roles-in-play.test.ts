import { describe, expect, it } from "vitest";
import { SKILLS } from "./belief";
import { playTable } from "./simtable";

// (designer 2026-10-14) "guessing and accusations must be done with the roles active in the game" — every role a bot
// names (a claim, a mark, a Teer Kaman guess) is one dealt in THIS game; a suspicion with no role seen names none
describe("bots name only roles dealt in the game", () => {
  it("in 40 all-bot games, every named role is in play", () => {
    let seed = 5; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp];
    let named = 0;
    for (let g = 0; g < 40; g++) {
      const s = playTable(5 + (g % 8), 300 + g, r, { skillOf: (x) => SK[(x + g) % 3] });
      for (const e of s.events) {
        const roles = e.type === "teer_kaman" ? ((e.data?.roles as string[]) ?? []) : e.type === "claim" && typeof e.data?.role === "string" ? [e.data.role] : [];
        for (const role of roles) { named++; expect(s.rolesInPlay).toContain(role); }
        if (e.type === "claim" && e.data?.kind === "accuse") expect(e.data?.role ?? null).toBeNull();
      }
    }
    expect(named).toBeGreaterThan(50);
  });
});
