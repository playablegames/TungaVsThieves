// Does the MANDATORY VOTE decide anything? (2026-10-12) For each game: who would win if the reveal came straight after
// the last round (no vote), against who actually won. Same bots as balance.mts.
//   npx tsx scripts/vote-matters.mts [games=300] [counts=8-8] [skill=average]
import { apply, start, waitingOn } from "@/engine/engine";
import { DEAL_HAND, ROLE_TABLE } from "@/engine/setup";
import { isStone, type GameState } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS } from "@/server/belief";

const GAMES = Number(process.argv[2] ?? 300);
const [lo, hi] = (process.argv[3] ?? "8-8").split("-").map(Number);
const skill = { ...SKILLS[(process.argv[4] ?? "average") as "average"], exact: process.argv[4] !== "casual" };
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

const noVoteWinner = (s: GameState) => {
  const v = s.players.filter((p) => p.alive && p.side === "V").reduce((k, p) => k + p.hand.filter(isStone).length, 0)
    + (s.villagePot ?? []).filter(isStone).length + s.pile.filter(isStone).length;
  return v === 2 ? "V" : "T";
};
for (let n = lo; n <= hi; n++) {
  let reached = 0, flipVT = 0, flipTV = 0, settledV = 0, vWins = 0;
  for (let g = 0; g < GAMES; g++) {
    let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), 100_000 * n + g, ROLE_TABLE, DEAL_HAND);
    let before: "V" | "T" | null = null;
    for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
      const ph = s.phase;
      if (before === null && ph.kind === "vote" && ph.reason === "final") before = noVoteWinner(s);
      const seat = waitingOn(s)[0];
      if (ph.kind === "vote" && ph.debate) pushBotClaim(s, seat, s.seed, rnd, skill);
      s = apply(s, seat, skilledAction(s, seat, s.seed, rnd, skill));
    }
    if (s.phase.kind !== "over") throw new Error("did not end");
    const w = s.phase.winner;
    if (w === "V") vWins++;
    if (before === null) continue; // ended before the vote (a wipe)
    reached++;
    if (before === "V") settledV++;
    if (before === "V" && w === "T") flipVT++;
    if (before === "T" && w === "V") flipTV++;
  }
  const pc = (x: number, d: number) => `${Math.round((100 * x) / Math.max(1, d))}%`;
  console.log(`${n}p: Tunga ${pc(vWins, GAMES)} · reached the vote ${pc(reached, GAMES)} · village already held both Stones ${pc(settledV, reached)}`
    + ` · vote CHANGED the winner ${pc(flipVT + flipTV, reached)} (to thieves ${pc(flipVT, reached)}, to village ${pc(flipTV, reached)})`);
}
