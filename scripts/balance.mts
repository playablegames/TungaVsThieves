// Balance probe: whole games where every seat is a bot, per player count. Prints Tunga's win rate.
// Bots (2026-10-09, src/server/belief.ts): beliefs held to the thief count, claims in every debate (villagers true,
// thieves lie plausibly), trust that moves when a claim meets a role, at three SKILL levels. Columns:
//   floor    — average bots, but the ballots are random (the "random lynch" baseline from the Mafia maths)
//   <skill> hidden / shown — the rules as they are (roles hidden) vs every eliminated role shown to the table
//   npx tsx scripts/balance.mts [games per cell=300] [counts=4-16] [columns=all]
// ⚠ It prices the MECHANICS with bot players, not real tables. Read the band across skills, not one number.
import { apply, start, waitingOn } from "@/engine/engine";
import { DEAL_HAND, ROLE_TABLE } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS, type Skill } from "@/server/belief";

const GAMES = Number(process.argv[2] ?? 300);
const [lo, hi] = (process.argv[3] ?? "4-16").split("-").map(Number);
const COUNTS = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
const HAND = Number(process.env.DEAL_HAND ?? DEAL_HAND);

let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

interface Config { name: string; skill: Skill; publicRoles: boolean; randomVote?: boolean }
const ALL: Config[] = [
  { name: "floor", skill: SKILLS.average, publicRoles: false, randomVote: true },
  ...(["casual", "average", "sharp"] as const).flatMap((k) => [
    { name: `${k} hidden`, skill: SKILLS[k], publicRoles: false },
    { name: `${k} shown`, skill: SKILLS[k], publicRoles: true },
  ]),
];
const pickCols = process.argv[4]?.split(",");
const CONFIGS = pickCols ? ALL.filter((c) => pickCols.includes(c.name)) : ALL;

export interface Tally { winner: "V" | "T"; claims: number; lies: number }
export function play(n: number, gameSeed: number, c: Config): Tally {
  let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), gameSeed, ROLE_TABLE, HAND);
  if (c.publicRoles) s.publicRoles = true;
  for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
    const seat = waitingOn(s)[0];
    const ph = s.phase;
    if (ph.kind === "vote" && ph.debate) pushBotClaim(s, seat, s.seed, rnd, c.skill);
    const others = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat);
    const a = c.randomVote && ph.kind === "vote" && !ph.debate
      ? { type: "vote" as const, target: others.length ? others[Math.floor(rnd() * others.length)] : null }
      : skilledAction(s, seat, s.seed, rnd, c.skill);
    s = apply(s, seat, a);
  }
  if (s.phase.kind !== "over") throw new Error(`game ${n}p seed ${gameSeed} did not end`);
  const claims = s.events.filter((e) => e.type === "claim");
  const lies = claims.filter((e) => {
    const t = s.players[e.data!.target as number];
    return e.data!.kind !== "accuse" && t && t.side !== e.data!.side; // (sides can move under Dal Badal: approximate)
  }).length;
  return { winner: s.phase.winner, claims: claims.length, lies };
}

const rows: string[][] = [["players", ...CONFIGS.map((c) => c.name)]];
const t0 = Date.now();
let claims = 0, lies = 0, games = 0;
for (const n of COUNTS) {
  const row = [`${n}p ${ROLE_TABLE[n][1]}T`];
  for (const c of CONFIGS) {
    let wins = 0;
    for (let g = 0; g < GAMES; g++) {
      const t = play(n, 100_000 * n + g, c);
      if (t.winner === "V") wins++;
      claims += t.claims; lies += t.lies; games++;
    }
    row.push(`${Math.round((100 * wins) / GAMES)}%`);
  }
  rows.push(row);
  console.error(`${n}p done (${Math.round((Date.now() - t0) / 1000)}s)`);
  const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
  console.log(row.map((x, i) => x.padEnd(w[i])).join(" | ")); // each row as it lands
}
const w = rows[0].map((_, i) => Math.max(...rows.map((r) => r[i].length)));
console.log("\n" + rows.map((r) => r.map((x, i) => x.padEnd(w[i])).join(" | ")).join("\n"));
console.log(`\nTunga win rate, ${GAMES} bot games per cell, ${HAND} cards dealt each. Claims per game ${(claims / games).toFixed(1)}, of them false ${Math.round((100 * lies) / Math.max(1, claims))}%.`);
