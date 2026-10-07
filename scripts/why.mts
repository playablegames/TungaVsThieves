// Why does each side win? Ending reasons for all-bot games (same bots as scripts/balance.mts).
//   npx tsx scripts/why.mts <players> <thieves> [games=1000]
import { apply, start, waitingOn } from "@/engine/engine";
import { botAction } from "@/engine/decisions";
import { ROLE_TABLE } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { botVote } from "@/server/botmind";

const [n, t, G = 1000] = process.argv.slice(2).map(Number);
const [v0, t0, r] = ROLE_TABLE[n];
const table = { ...ROLE_TABLE, [n]: [v0 + t0 - t, t, r] as [number, number, number] };
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const why = new Map<string, number>();
let thievesCaught = 0;
for (let g = 0; g < G; g++) {
  let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), 500_000 + g, table);
  while (s.phase.kind !== "over") {
    const seat = waitingOn(s)[0];
    const ph = s.phase;
    s = apply(s, seat, ph.kind === "vote" && !ph.debate ? { type: "vote", target: botVote(s, seat, s.seed, rnd) } : botAction(s, seat, rnd));
  }
  const k = `${s.phase.winner === "V" ? "TUNGA" : "THIEVES"}: ${s.phase.reason}`;
  why.set(k, (why.get(k) ?? 0) + 1);
  thievesCaught += s.players.filter((p) => !p.alive && p.revealedRole && s.rolesInPlay.length && p.side === "T").length;
}
const dealt = start(Array.from({ length: n }, (_, i) => `P${i}`), 1, table).players.filter((p) => p.side === "T").length;
console.log(`${n} players, ${t} thieves (dealt ${dealt}), ${G} games — thieves caught per game: ${(thievesCaught / G).toFixed(2)}`);
for (const [k, c] of [...why].sort((a, b) => b[1] - a[1])) console.log(`  ${String(Math.round((100 * c) / G)).padStart(3)}%  ${k}`);
