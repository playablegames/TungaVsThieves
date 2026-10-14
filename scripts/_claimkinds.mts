// which public claims do bots still make? (by kind, per bot per game)
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";
let seed = 21; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp], PS = Object.keys(PERSONALITIES);
const G = 200, n = 7; const c: Record<string, number> = {};
for (let g = 0; g < G; g++) {
  const s = playTable(n, 300_000 + g, rnd, { skillOf: (x) => personalised(SK[(x + g) % 3], PS[(x + 3 * g) % 4]) });
  for (const e of s.events) if (e.type === "claim" && e.to === "all") {
    const k = `${e.data?.kind}${e.data?.answer ? " (answer)" : ""}${e.data?.counter ? " (counter)" : ""}${e.data?.told ? " (tie/told)" : ""}${s.phase.kind === "over" ? "" : ""}`;
    c[k] = (c[k] ?? 0) + 1;
  }
}
for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1])) console.log((v / (G * n)).toFixed(2), k);
