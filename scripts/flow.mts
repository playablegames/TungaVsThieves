// How a game FLOWS (2026-10-12): who gets to act, who sits out and for how long, which cards get played, how games
// end. Bot games, average skill with exact deduction — it prices the STRUCTURE, not real tables.
//   npx tsx scripts/flow.mts [games=200] [counts=5-12]
import { apply, start, waitingOn } from "@/engine/engine";
import { DEAL_HAND, ROLE_TABLE } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS } from "@/server/belief";

const GAMES = Number(process.argv[2] ?? 200);
const [lo, hi] = (process.argv[3] ?? "5-12").split("-").map(Number);
const skill = { ...SKILLS.average, exact: true };
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pc = (x: number, d: number) => `${Math.round((100 * x) / Math.max(1, d))}%`;
const avg = (x: number, d: number) => (x / Math.max(1, d)).toFixed(1);

console.log("players | turns each | pair played | out before final vote | turns sat out (of all) | Faisla/game | Faisla outs a thief | TK hit/miss per game | Dal Badal used | end: wipe / final vote");
for (let n = lo; n <= hi; n++) {
  let turns = 0, plays = 0, outBefore = 0, satOut = 0, seatTurns = 0, faisla = 0, faislaThief = 0, faislaOut = 0;
  let tkHit = 0, tkMiss = 0, dal = 0, wipe = 0, finalEnd = 0;
  const cards: Record<string, number> = {};
  for (let g = 0; g < GAMES; g++) {
    let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), 100_000 * n + g, ROLE_TABLE, DEAL_HAND);
    for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
      const seat = waitingOn(s)[0];
      const ph = s.phase;
      if (ph.kind === "vote" && ph.debate) pushBotClaim(s, seat, s.seed, rnd, skill);
      s = apply(s, seat, skilledAction(s, seat, s.seed, rnd, skill));
    }
    let finalSeen = false, pendingFaisla = false;
    for (const e of s.events) {
      const d = e.data;
      switch (e.type) {
        case "play": plays++; cards[String(d?.card)] = (cards[String(d?.card)] ?? 0) + 1; break;
        case "faisla": faisla++; pendingFaisla = true; break;
        case "eliminated": {
          const p = s.players[d!.seat as number];
          if (!finalSeen) outBefore++;
          if (pendingFaisla) { faislaOut++; if (p.side === "T") faislaThief++; }
          break;
        }
        case "pickup": case "conduit": pendingFaisla = false; break; // the Faisla's eliminations come after its vote_result
        case "teer_kaman": if (d?.hit) tkHit++; else tkMiss++; break;
        case "dal_badal": dal++; break;
        case "final_vote": finalSeen = true; break;
      }
    }
    // every seat-turn: a living seat picks up; a seat that is out passes the pile straight on (a "conduit")
    const tk = s.events.filter((e) => e.type === "pickup").length, co = s.events.filter((e) => e.type === "conduit").length;
    turns += tk; satOut += co; seatTurns += tk + co;
    if (s.events.some((e) => e.type === "final_vote")) finalEnd++; else wipe++;
  }
  const top = Object.entries(cards).sort((a, b) => b[1] - a[1]).map(([c, k]) => `${c.replace("_", " ").toLowerCase()} ${avg(k, GAMES)}`).join(", ");
  console.log(`${n}p | ${avg(turns, GAMES * n)} | ${pc(plays, turns)} | ${avg(outBefore, GAMES)} of ${n} | ${pc(satOut, seatTurns)} | ${avg(faisla, GAMES)} | ${pc(faislaThief, faislaOut)} | ${avg(tkHit, GAMES)}/${avg(tkMiss, GAMES)} | ${pc(dal, GAMES)} | ${pc(wipe, GAMES)} / ${pc(finalEnd, GAMES)}`);
  console.log(`      pairs played per game: ${top}`);
}
