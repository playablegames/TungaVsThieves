// Confirm a role table at volume: average belief bots (main number) plus casual and sharp, roles hidden.
//   npx tsx scripts/confirm.mts [average games=2000] [casual/sharp games=1000] [counts=5-16]
import { apply, start, waitingOn } from "@/engine/engine";
import { ROLE_TABLE } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS, type Skill } from "@/server/belief";

const AVG = Number(process.argv[2] ?? 2000), SIDE = Number(process.argv[3] ?? 1000);
const [lo, hi] = (process.argv[4] ?? "5-16").split("-").map(Number);
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

function rate(n: number, skill: Skill, games: number): number {
  let wins = 0;
  for (let g = 0; g < games; g++) {
    let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), 900_000 * n + g, ROLE_TABLE);
    for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
      const seat = waitingOn(s)[0];
      if (s.phase.kind === "vote" && s.phase.debate) pushBotClaim(s, seat, s.seed, rnd, skill);
      s = apply(s, seat, skilledAction(s, seat, s.seed, rnd, skill));
    }
    if (s.phase.kind !== "over") throw new Error(`${n}p game ${g} did not end`);
    if (s.phase.winner === "V") wins++;
  }
  return Math.round((100 * wins) / games);
}

console.log(`players | thieves | rounds | average (${AVG}) | casual (${SIDE}) | sharp (${SIDE})`);
for (let n = lo; n <= hi; n++) {
  const [, t, r] = ROLE_TABLE[n];
  console.log(`${n}p | ${t}T | ${r}r | ${rate(n, SKILLS.average, AVG)}% | ${rate(n, SKILLS.casual, SIDE)}% | ${rate(n, SKILLS.sharp, SIDE)}%`);
}
