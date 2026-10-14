// BALANCE on the faithful table (simtable): every skill x personality, mixed, as online. Village win rate per count.
//   npx tsx scripts/sim-balance.mts [games=200] [counts=6,9,12]   (the cloud runs it per count: .github/workflows/sims.yml)
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";
import { ROLE_TABLE } from "@/engine/setup";
let seed = 21; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp], PS = Object.keys(PERSONALITIES);
const G = Number(process.argv[2] ?? 200);
// a rule option to measure: BOT_FLAGS="table=10:6/4/3" deals 10 players 6 villagers, 4 thieves, 3 rounds
const opt = /table=(\d+):(\d+)\/(\d+)\/(\d+)/.exec(process.env.BOT_FLAGS ?? "");
const table = opt ? { ...ROLE_TABLE, [Number(opt[1])]: [Number(opt[2]), Number(opt[3]), Number(opt[4])] as [number, number, number] } : ROLE_TABLE;
// a rule option: BOT_FLAGS=shield turns on Dal Badal as a shield (designer 2026-10-14)
const SHIELD = (process.env.BOT_FLAGS ?? "").includes("shield");
if (SHIELD) console.log("rule option: Dal Badal as a shield (any debate, shot at, read, voted out by a Faisla)");
if (opt) console.log(`rule option: ${opt[1]} players = ${opt[2]} villagers + ${opt[3]} thieves, ${opt[4]} rounds`);
for (const n of (process.argv[3] ?? "6,9,12").split(",").map(Number)) {
  let vw = 0, outT = 0, outV = 0;
  for (let g = 0; g < G; g++) {
    const s = playTable(n, 400_000 + 1000 * n + g, rnd, { skillOf: (x) => personalised(SK[(x + g) % 3], PS[(x + 3 * g) % 4]), table, dbShield: SHIELD });
    if (s.phase.kind === "over" && s.phase.winner === "V") vw++;
    for (const e of s.events) if (e.type === "vote_result" && typeof e.data?.out === "number") { if (s.players[e.data.out as number].side === "T") outT++; else outV++; }
  }
  console.log(`${n}p  village ${Math.round(100 * vw / G)}%  ±${Math.round(100 * 1.96 * Math.sqrt(0.25 / G))}  voted out T${outT}/V${outV}`);
}
