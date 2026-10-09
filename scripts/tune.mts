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

// (designer 2026-10-09) ROUNDS FIXED AT 3; thieves chosen per count by the mean distance from TARGET across all three
// skills (casual = score-nudging, average and sharp = exact deduction)
const SK = [SKILLS.casual, SKILLS.average, SKILLS.sharp];
const picked: Record<number, [number, number, number]> = {};
console.log("players | today | best (casual / average / sharp) | all options (mean)");
for (let n = lo; n <= hi; n++) {
  const [, t0, r0] = ROLE_TABLE[n];
  const tried: { t: number; ws: number[]; m: number }[] = [];
  for (let t = 1; t <= Math.ceil(n / 2) - 1; t++) {
    const ws = SK.map((k) => rate(n, t, 3, k, GAMES));
    tried.push({ t, ws, m: ws.reduce((a, b) => a + b, 0) / ws.length });
  }
  const dist = (x: { ws: number[] }) => x.ws.reduce((a, w) => a + Math.abs(w - TARGET), 0);
  const best = [...tried].sort((a, b) => dist(a) - dist(b))[0];
  picked[n] = [n - best.t, best.t, 3];
  const f = (x: { t: number; ws: number[] }) => `${x.t}T ${x.ws.map((w) => Math.round(w)).join("/")}`;
  console.log(`${n}p | was ${t0}T ${r0}r | ${f(best)} | ${tried.map((x) => `${x.t}T ${Math.round(x.m)}%`).join(", ")}`);
}
console.log(`
${GAMES} games per option per skill (±${Math.round(100 / Math.sqrt(GAMES))} points), roles hidden, 3 rounds. Target ${TARGET}%.`);
console.log("PICKED", JSON.stringify(picked));
