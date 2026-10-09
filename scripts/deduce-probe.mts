// Stage 1 check (2026-10-09): bots with EXACT DEDUCTION (deduce.ts) vs the score-nudging bots, same games.
//   npx tsx scripts/deduce-probe.mts [games=300] [players=8]
// Reports: how often a villager bot's ballot lands on a real thief, how often a vote puts a thief out, Tunga's win
// rate, and time per game. Every seat is a bot; the role table is the shipped one.
import { apply, start, waitingOn } from "@/engine/engine";
import { ROLE_TABLE } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS, type Skill } from "@/server/belief";

const GAMES = Number(process.argv[2] ?? 300);
const N = Number(process.argv[3] ?? 8);

function run(skill: Skill, label: string) {
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let vBallots = 0, vHits = 0, outs = 0, thiefOuts = 0, wins = 0;
  const t0 = Date.now();
  for (let g = 0; g < GAMES; g++) {
    let s: GameState = start(Array.from({ length: N }, (_, i) => `P${i}`), 1000 + g, ROLE_TABLE);
    for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
      const seat = waitingOn(s)[0];
      const ph = s.phase;
      if (ph.kind === "vote" && ph.debate) pushBotClaim(s, seat, s.seed, rnd, skill);
      const a = skilledAction(s, seat, s.seed, rnd, skill);
      if (a.type === "vote" && s.players[seat].side === "V" && a.target !== null) { vBallots++; if (s.players[a.target].side === "T") vHits++; }
      const before = s.players.filter((p) => p.alive).length;
      const wasVote = ph.kind === "vote" && !ph.debate;
      s = apply(s, seat, a);
      if (wasVote && s.phase.kind !== "vote") {
        const gone = s.players.filter((p) => !p.alive).length - (N - before);
        if (gone > 0) { outs++; const last = [...s.events].reverse().find((e) => e.type === "eliminated"); if (last && s.players[last.data!.seat as number].side === "T") thiefOuts++; }
      }
    }
    if (s.phase.kind === "over" && s.phase.winner === "V") wins++;
  }
  const ms = (Date.now() - t0) / GAMES;
  console.log(`${label.padEnd(22)} villager ballots on a thief ${(100 * vHits / vBallots).toFixed(1)}%  ` +
    `vote-outs that were thieves ${(100 * thiefOuts / Math.max(1, outs)).toFixed(1)}%  Tunga wins ${(100 * wins / GAMES).toFixed(1)}%  ${ms.toFixed(0)} ms/game`);
}

console.log(`${GAMES} games · ${N} players · ${ROLE_TABLE[N][1]} thieves`);
for (const k of ["average", "sharp"] as const) {
  run(SKILLS[k], `${k}`);
  run({ ...SKILLS[k], exact: true }, `${k} + exact`);
}
