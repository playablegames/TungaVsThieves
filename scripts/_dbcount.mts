// How often Dal Badal is used, and when, with and without the shield (analysis only)
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";
let seed = 21; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp], PS = Object.keys(PERSONALITIES);
const n = Number(process.argv[2] ?? 7), G = Number(process.argv[3] ?? 150);
for (const shield of [false, true]) {
  const when: Record<string, number> = {}; let thiefHeld = 0, reacts = 0;
  for (let g = 0; g < G; g++) {
    const s = playTable(n, 400_000 + 1000 * n + g, rnd, { skillOf: (x) => personalised(SK[(x + g) % 3], PS[(x + 3 * g) % 4]), dbShield: shield });
    for (const e of s.events) if (e.type === "dal_badal") when[String(e.data?.when)] = (when[String(e.data?.when)] ?? 0) + 1;
    if (s.events.some((e) => e.type === "dal_badal")) thiefHeld++;
    reacts += s.events.filter((e) => e.type === "bot_why" && String(e.data?.why).includes("shield")).length;
  }
  console.log(`${n}p ${G} games, shield ${shield ? "ON " : "off"} — Dal Badal used in ${thiefHeld} games:`, when);
}
