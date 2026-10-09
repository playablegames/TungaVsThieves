// Tune deduce.ts's behaviour model on bot self-play: which likelihoods put villager ballots on thieves most often.
//   npx tsx scripts/deduce-tune.mts [games=200] [players=8]
import { apply, start, waitingOn } from "@/engine/engine";
import { ROLE_TABLE } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS } from "@/server/belief";
import { MODEL } from "@/server/deduce";

const GAMES = Number(process.argv[2] ?? 200);
const N = Number(process.argv[3] ?? 8);
function score(model: typeof MODEL, exact = true) {
  const skill = { ...SKILLS.sharp, exact, model };
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let b = 0, h = 0, w = 0;
  for (let g = 0; g < GAMES; g++) {
    let s: GameState = start(Array.from({ length: N }, (_, i) => `P${i}`), 1000 + g, ROLE_TABLE);
    for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
      const seat = waitingOn(s)[0];
      if (s.phase.kind === "vote" && s.phase.debate) pushBotClaim(s, seat, s.seed, rnd, skill);
      const a = skilledAction(s, seat, s.seed, rnd, skill);
      if (a.type === "vote" && s.players[seat].side === "V" && a.target !== null) { b++; if (s.players[a.target].side === "T") h++; }
      s = apply(s, seat, a);
    }
    if (s.phase.kind === "over" && s.phase.winner === "V") w++;
  }
  return `${(100 * h / b).toFixed(1)}% ballots on thieves · Tunga ${(100 * w / GAMES).toFixed(1)}%`;
}
const tries: [string, Partial<typeof MODEL>][] = [
  ["liar .35 (shipped)", {}], ["liar .6", { liar: 0.6 }], ["liar .8", { liar: 0.8 }], ["liar 1.0", { liar: 1.0 }],
  ["liar .6 hunch .9", { liar: 0.6, liarHunch: 0.9 }], ["liar .8 hunch 1.0", { liar: 0.8, liarHunch: 1.0 }],
];
console.log("no exact (score-nudging)".padEnd(20), score(MODEL, false));
for (const [name, patch] of tries) console.log(name.padEnd(20), score({ ...MODEL, ...patch }));
