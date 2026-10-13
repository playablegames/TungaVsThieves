// BALANCE on the faithful table (simtable): every skill x personality, mixed, as online. Village win rate per count.
//   npx tsx scripts/sim-balance.mts [games=200] [counts=6,9,12]   (the cloud runs it per count: .github/workflows/sims.yml)
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";
let seed = 21; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp], PS = Object.keys(PERSONALITIES);
const G = Number(process.argv[2] ?? 200);
for (const n of (process.argv[3] ?? "6,9,12").split(",").map(Number)) {
  let vw = 0, outT = 0, outV = 0;
  for (let g = 0; g < G; g++) {
    const s = playTable(n, 400_000 + 1000 * n + g, rnd, { skillOf: (x) => personalised(SK[(x + g) % 3], PS[(x + 3 * g) % 4]) });
    if (s.phase.kind === "over" && s.phase.winner === "V") vw++;
    for (const e of s.events) if (e.type === "vote_result" && typeof e.data?.out === "number") { if (s.players[e.data.out as number].side === "T") outT++; else outV++; }
  }
  console.log(`${n}p  village ${Math.round(100 * vw / G)}%  ±${Math.round(100 * 1.96 * Math.sqrt(0.25 / G))}  voted out T${outT}/V${outV}`);
}
