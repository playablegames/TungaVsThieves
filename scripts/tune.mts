// Role-table tuning (designer 2026-10-09: "the balance should be almost equal, 50/50 or 55/45").
// For each player count: every sensible thieves × rounds, average belief bots, roles hidden (the rules as they are).
// Picks the one closest to TARGET, then checks it with casual and sharp bots.
//   npx tsx scripts/tune.mts [games per option=300] [counts=4-16] [target=52.5]
import { apply, start, waitingOn } from "@/engine/engine";
import { ROLE_TABLE } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS, type Skill } from "@/server/belief";

const GAMES = Number(process.argv[2] ?? 300);
const [lo, hi] = (process.argv[3] ?? "4-16").split("-").map(Number);
const TARGET = Number(process.argv[4] ?? 52.5);
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

function rate(n: number, thieves: number, rounds: number, skill: Skill, games: number): number {
  const table = { ...ROLE_TABLE, [n]: [n - thieves, thieves, rounds] as [number, number, number] };
  let wins = 0;
  for (let g = 0; g < games; g++) {
    let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), 300_000 * n + g, table);
    for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
      const seat = waitingOn(s)[0];
      if (s.phase.kind === "vote" && s.phase.debate) pushBotClaim(s, seat, s.seed, rnd, skill);
      s = apply(s, seat, skilledAction(s, seat, s.seed, rnd, skill));
    }
    if (s.phase.kind === "over" && s.phase.winner === "V") wins++;
  }
  return (100 * wins) / games;
}

console.log("players | today (T, rounds → Tunga%) | best (T, rounds → Tunga%) | casual · sharp at best | all options tried");
for (let n = lo; n <= hi; n++) {
  const [, t0, r0] = ROLE_TABLE[n];
  const tried: { t: number; r: number; w: number }[] = [];
  for (let t = 1; t <= Math.ceil(n / 2) - 1; t++) for (const r of [2, 3]) tried.push({ t, r, w: rate(n, t, r, SKILLS.average, GAMES) });
  const today = tried.find((x) => x.t === t0 && x.r === r0);
  const best = [...tried].sort((a, b) => Math.abs(a.w - TARGET) - Math.abs(b.w - TARGET))[0];
  const cas = rate(n, best.t, best.r, SKILLS.casual, GAMES), shp = rate(n, best.t, best.r, SKILLS.sharp, GAMES);
  const f = (x: { t: number; r: number; w: number }) => `${x.t}T ${x.r}r → ${Math.round(x.w)}%`;
  console.log(`${n}p | ${today ? f(today) : `${t0}T ${r0}r → ?`} | ${f(best)} | ${Math.round(cas)}% · ${Math.round(shp)}% | ${tried.map(f).join(", ")}`);
}
console.log(`\n${GAMES} games per option (±${Math.round(100 / Math.sqrt(GAMES))} points), average bots, roles hidden. Target ${TARGET}%.`);
