import { apply, start, waitingOn } from "@/engine/engine";
import { ROLE_TABLE } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS } from "@/server/belief";
let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
for (const n of [6, 8, 10, 12]) {
  let games = 0, withDB = 0; const rounds: number[] = [];
  for (let g = 0; g < 300; g++) {
    let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), 4000 + g, ROLE_TABLE);
    for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
      const seat = waitingOn(s)[0];
      if (s.phase.kind === "vote" && s.phase.debate) pushBotClaim(s, seat, s.seed, rnd, SKILLS.average);
      const before = s.round;
      s = apply(s, seat, skilledAction(s, seat, s.seed, rnd, SKILLS.average));
      if (s.events.at(-1)?.type === "dal_badal" || s.events.some((e) => e.type === "dal_badal" && e.n >= s.events.length - 3)) { if (!rounds.length || rounds.length <= withDB) rounds.push(before); }
    }
    games++;
    const db = s.events.find((e) => e.type === "dal_badal");
    if (db) withDB++;
  }
  const r = [1, 2, 3].map((x) => rounds.filter((y) => y === x).length);
  console.log(`${n}p: Dal Badal played in ${Math.round(100 * withDB / games)}% of games · in round 1/2/3: ${r.join("/")}`);
}
