// OUT-HAND PROBE (designer 2026-10-12): a player put out by a Faisla or a Teer Kaman hit — should the table SEE the
// cards they hand over, or only the player who takes them?
// ANALYSIS ONLY — the game code is untouched. The engine plays it PRIVATE (the rule); for PUBLIC this script copies
// every private hand-off line to the whole table, so every bot reads the cards.
// The same games are played both ways (same seeds, same deals), so the difference is the rule, not luck.
//   npx tsx scripts/outhand.mts [counts=6,8,10] [games=300]
import { apply, start, waitingOn } from "@/engine/engine";
import { DEAL_HAND, ROLE_TABLE } from "@/engine/setup";
import { isStone, type GameState, type Side } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS, stoneOdds, type Skill } from "@/server/belief";

const COUNTS = (process.argv[2] ?? "6,8,10").split(",").map(Number);
const GAMES = Number(process.argv[3] ?? 300);
const TABLE: Record<number, [number, number, number]> = { ...ROLE_TABLE, 6: [4, 2, 3] };
// a mixed table, as online: casual / average / sharp round the seats
const MIX: Skill[] = [SKILLS.casual, SKILLS.average, SKILLS.sharp];

interface Stats { village: number; outs: number; outStone: number; finalHit: number; finalTheft: number; trackHit: number; trackN: number }
const zero = (): Stats => ({ village: 0, outs: 0, outStone: 0, finalHit: 0, finalTheft: 0, trackHit: 0, trackN: 0 });

function play(n: number, g: number, pub: boolean, st: Stats) {
  let seed = 1 + g * 7919 + n * 104729;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const t = TABLE[n][1];
  let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), 900_000 * n + 1000 * t + g, TABLE, DEAL_HAND);
  const skill = (x: number) => MIX[(x + g) % 3];
  let seen = s.events.length, finalDone = false;
  for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
    if (!finalDone && s.phase.kind === "vote" && s.phase.reason === "final") {
      finalDone = true;
      // how well the living villagers know where the Stones are, as the mandatory vote opens
      const holders = s.players.filter((p) => p.alive && p.hand.some(isStone)).map((p) => p.seat);
      for (const v of s.players.filter((p) => p.alive && p.side === "V")) {
        const truth = holders.filter((x) => x !== v.seat);
        if (!truth.length) continue;
        const odds = stoneOdds(s, v.seat, s.seed, skill(v.seat));
        const others = s.players.filter((p) => p.alive && p.seat !== v.seat).map((p) => p.seat);
        const guess = others.sort((a, b) => (odds.get(b) ?? 0) - (odds.get(a) ?? 0)).slice(0, truth.length);
        st.trackHit += guess.filter((x) => truth.includes(x)).length; st.trackN += truth.length;
      }
    }
    const seat = waitingOn(s)[0];
    const ph = s.phase;
    if (ph.kind === "vote" && ph.debate) pushBotClaim(s, seat, s.seed, r, skill(seat));
    s = apply(s, seat, skilledAction(s, seat, s.seed, r, skill(seat)));
    for (; seen < s.events.length; seen++) {
      const e = s.events[seen];
      if (e.type === "handoff_private") {
        st.outs++;
        if (((e.data?.cards as string[]) ?? []).some((c) => c.startsWith("STONE"))) st.outStone++;
        // PUBLIC: the whole table sees the cards
        if (pub) { s.events.push({ ...e, n: s.events.length, to: "all" }); seen++; }
      }
      if (e.type === "vote_result" && e.data?.reason === "final" && typeof e.data?.out === "number") {
        const out = s.players[e.data.out as number];
        if (out.hand.some(isStone)) { if (out.side === "T") st.finalHit++; else st.finalTheft++; }
      }
    }
  }
  if (s.phase.kind !== "over") throw new Error(`${n}p game ${g} did not end`);
  if ((s.phase as { winner: Side }).winner === "V") st.village++;
}

const P = (x: number, d: number) => (d ? `${(100 * x / d).toFixed(1)}%` : "-");
const t0 = Date.now();
console.log(`OUT-HAND: private (the rule) vs public — ${GAMES} paired games per count, mixed skills\n`);
console.log("players | village wins: private → public (diff) | outs holding a Stone | final vote: thief w/ Stone caught · villager w/ Stone lost | villagers' Stone guesses right");
const tot = { a: zero(), b: zero(), g: 0 };
for (const n of COUNTS) {
  const a = zero(), b = zero();
  let onlyA = 0, onlyB = 0;
  for (let g = 0; g < GAMES; g++) {
    const va = a.village, vb = b.village;
    play(n, g, false, a); play(n, g, true, b);
    const wa = a.village > va, wb = b.village > vb;
    if (wa && !wb) onlyA++; else if (wb && !wa) onlyB++;
  }
  // McNemar on the paired games: only the games whose result changed say anything
  const z = onlyA + onlyB ? (onlyB - onlyA) / Math.sqrt(onlyA + onlyB) : 0;
  console.log(`${String(n).padStart(4)}p  | ${P(a.village, GAMES)} → ${P(b.village, GAMES)} (${((100 * (b.village - a.village)) / GAMES).toFixed(1)} pts; ${onlyA + onlyB} games flipped, z=${z.toFixed(2)}) | ${P(a.outStone, a.outs)} of ${a.outs} outs | ${a.finalHit}·${a.finalTheft} → ${b.finalHit}·${b.finalTheft} | ${P(a.trackHit, a.trackN)} → ${P(b.trackHit, b.trackN)}`);
  for (const k of Object.keys(a) as (keyof Stats)[]) { tot.a[k] += a[k]; tot.b[k] += b[k]; }
  tot.g += GAMES;
}
console.log(`\nall     | ${P(tot.a.village, tot.g)} → ${P(tot.b.village, tot.g)} | Stone guesses ${P(tot.a.trackHit, tot.a.trackN)} → ${P(tot.b.trackHit, tot.b.trackN)}`);
console.log(`(${Math.round((Date.now() - t0) / 1000)} s)`);
