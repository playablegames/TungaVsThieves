// Balance probe: whole games where every seat is a bot (the same minds the server runs), per player count, under
// different rule sets and role tables. Prints Tunga's win rate. Bots play like the server's: botVote for ballots
// (reads Kundli, claims, votes, eliminations), botAction for everything else (keeps Stones, random pairs).
//   npx tsx scripts/balance.mts [games per count=300] [counts=4-16]
// ⚠ It prices the MECHANICS with bot players, not real tables. Use it to compare options, not as the final word.
import { apply, RULES, start, waitingOn } from "@/engine/engine";
import { botAction } from "@/engine/decisions";
import { ROLE_TABLE } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { botVote } from "@/server/botmind";

const GAMES = Number(process.argv[2] ?? 300);
const [lo, hi] = (process.argv[3] ?? "4-16").split("-").map(Number);
const COUNTS = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

const BASE = Object.fromEntries(Object.entries(ROLE_TABLE).map(([n, r]) => [n, [...r] as [number, number, number]]));
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

function play(n: number, gameSeed: number, table: typeof ROLE_TABLE): { winner: "V" | "T"; reason: string } {
  let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), gameSeed, table);
  for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
    const seat = waitingOn(s)[0];
    const ph = s.phase;
    const a = ph.kind === "vote" && !ph.debate ? { type: "vote" as const, target: botVote(s, seat, s.seed, rnd) } : botAction(s, seat, rnd);
    s = apply(s, seat, a);
  }
  if (s.phase.kind !== "over") throw new Error(`game ${n}p seed ${gameSeed} did not end`);
  return { winner: s.phase.winner, reason: s.phase.reason };
}

interface Config { name: string; village: boolean; thieves: (n: number, base: number) => number }
const CONFIGS: Config[] = [
  { name: "A old rules, today's table", village: false, thieves: (_, t) => t },
  { name: "B mandatory vote → village", village: true, thieves: (_, t) => t },
  { name: "C B + one thief fewer", village: true, thieves: (_, t) => Math.max(1, t - 1) },
  { name: "D B + two fewer from 10p", village: true, thieves: (n, t) => Math.max(1, n >= 10 ? t - 2 : t - 1) },
];

const rows: string[][] = [["players", ...CONFIGS.map((c) => c.name)]];
const t0 = Date.now();
for (const n of COUNTS) {
  const row = [`${n}`];
  for (const c of CONFIGS) {
    RULES.finalVoteToVillage = c.village;
    const [v, t, r] = BASE[n];
    const thieves = c.thieves(n, t);
    const table = { ...BASE, [n]: [v + (t - thieves), thieves, r] as [number, number, number] };
    let wins = 0;
    for (let g = 0; g < GAMES; g++) if (play(n, 100_000 * n + g, table).winner === "V") wins++;
    row.push(`${Math.round((100 * wins) / GAMES)}% (${thieves}T)`);
  }
  rows.push(row);
  console.error(`${n}p done (${Math.round((Date.now() - t0) / 1000)}s)`);
}
RULES.finalVoteToVillage = true;
const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
for (const r of rows) console.log(r.map((x, i) => x.padEnd(w[i])).join(" | "));
console.log(`\nTunga win rate, ${GAMES} bot games per cell. Rounds as today's table.`);
