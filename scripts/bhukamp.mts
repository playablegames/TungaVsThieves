// BHUKAMP PROBE (designer 2026-10-12): the printed rule (everyone passes 1 card left + 1 right) against the designer's
// idea — everyone passes BOTH cards ANTICLOCKWISE, to the player before them in turn order, whose pile then comes
// back to them on their next turn ("did my Stone come back or not?").
// ANALYSIS ONLY — the online game never sets probeBhukamp. The same games are played both ways (same seeds and deals).
//   npx tsx scripts/bhukamp.mts [counts=6,8,10,12] [games=1000]
import { apply, start, waitingOn } from "@/engine/engine";
import { DEAL_HAND, ROLE_TABLE } from "@/engine/setup";
import { isStone, type Card, type GameState, type Side } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS, stoneOdds, type Skill } from "@/server/belief";

const COUNTS = (process.argv[2] ?? "6,8,10,12").split(",").map(Number);
const GAMES = Number(process.argv[3] ?? 1000);
const TABLE: Record<number, [number, number, number]> = { ...ROLE_TABLE, 6: [4, 2, 3] };
const MIX: Skill[] = [SKILLS.casual, SKILLS.average, SKILLS.sharp];

interface Stats {
  village: number; bhukamps: number; toThief: number; toThiefR3: number; stoneMoves: number;
  trackHit: number; trackN: number;
  // the "did it come back?" check (anticlockwise only): a villager's Stone handed to the neighbour by a Bhukamp
  handed: number; cameBack: number; keptByThief: number; keptByVillager: number; keptByThiefRecovered: number;
}
const zero = (): Stats => ({ village: 0, bhukamps: 0, toThief: 0, toThiefR3: 0, stoneMoves: 0, trackHit: 0, trackN: 0, handed: 0, cameBack: 0, keptByThief: 0, keptByVillager: 0, keptByThiefRecovered: 0 });

function play(n: number, g: number, anti: boolean, st: Stats) {
  let seed = 1 + g * 7919 + n * 104729;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const t = TABLE[n][1];
  let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), 900_000 * n + 1000 * t + g, TABLE, DEAL_HAND);
  if (anti) s.probeBhukamp = "anti";
  const skill = (x: number) => MIX[(x + g) % 3];
  let seen = s.events.length, finalDone = false;
  // a villager's Stone a Bhukamp handed on, waiting for the neighbour's next turn
  const watch: { c: Card; to: number }[] = [];
  const keptByThief: Card[] = [];
  for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
    if (!finalDone && s.phase.kind === "vote" && s.phase.reason === "final") {
      finalDone = true;
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
    if (s.phase.kind === "vote" && s.phase.debate) pushBotClaim(s, seat, s.seed, r, skill(seat));
    s = apply(s, seat, skilledAction(s, seat, s.seed, r, skill(seat)));
    for (; seen < s.events.length; seen++) {
      const e = s.events[seen];
      const d = e.data ?? {};
      if (e.type === "batwara") st.bhukamps++;
      if (e.type === "batwara_private" && isStone(d.card as Card)) {
        st.stoneMoves++;
        const from = s.players[d.from as number], to = s.players[d.to as number];
        if (from.side === "V" && to.side === "T") { st.toThief++; if (s.round >= s.rounds) st.toThiefR3++; }
        if (anti && from.side === "V") { st.handed++; watch.push({ c: d.card as Card, to: to.seat }); }
      }
      // the neighbour's next turn ended: kept it, or did it come back down the pile?
      if ((e.type === "pass" || e.type === "play") && typeof d.seat === "number") {
        for (let i = watch.length - 1; i >= 0; i--) {
          const w = watch[i];
          if (w.to !== d.seat) continue;
          watch.splice(i, 1);
          const nb = s.players[w.to];
          if (nb.hand.includes(w.c)) { if (nb.side === "T") { st.keptByThief++; keptByThief.push(w.c); } else st.keptByVillager++; }
          else st.cameBack++;
        }
      }
    }
  }
  if (s.phase.kind !== "over") throw new Error(`${n}p game ${g} did not end`);
  const won = (s.phase as { winner: Side }).winner === "V";
  if (won) st.village++;
  // a Stone a thief kept from the hand-off: did the village get it back by the end?
  for (const c of keptByThief) {
    const holder = s.players.find((p) => p.alive && p.hand.includes(c));
    const toThieves = (s.thiefPot ?? []).includes(c);
    if (!toThieves && (!holder || holder.side === "V")) st.keptByThiefRecovered++;
  }
}

const P = (x: number, d: number) => (d ? `${(100 * x / d).toFixed(1)}%` : "-");
const t0 = Date.now();
console.log(`BHUKAMP: printed rule (1 left + 1 right) vs ALL ANTICLOCKWISE — ${GAMES} paired games per count, mixed skills\n`);
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
  const z = onlyA + onlyB ? (onlyB - onlyA) / Math.sqrt(onlyA + onlyB) : 0;
  console.log(`${n}p  village wins ${P(a.village, GAMES)} → ${P(b.village, GAMES)}  (${(100 * (b.village - a.village) / GAMES).toFixed(1)} pts · ${onlyA + onlyB} games flipped · z=${z.toFixed(2)})`);
  console.log(`     Bhukamps/game ${(a.bhukamps / GAMES).toFixed(2)} → ${(b.bhukamps / GAMES).toFixed(2)} · Stone moves/game ${(a.stoneMoves / GAMES).toFixed(2)} → ${(b.stoneMoves / GAMES).toFixed(2)}`);
  console.log(`     villager → thief by Bhukamp: ${(a.toThief / GAMES).toFixed(3)} → ${(b.toThief / GAMES).toFixed(3)} per game (in round 3: ${(a.toThiefR3 / GAMES).toFixed(3)} → ${(b.toThiefR3 / GAMES).toFixed(3)})`);
  console.log(`     villagers' Stone guesses right at the final vote: ${P(a.trackHit, a.trackN)} → ${P(b.trackHit, b.trackN)}`);
  console.log(`     came back? of ${b.handed} villager Stones handed on: back ${P(b.cameBack, b.handed)} · kept by a villager ${P(b.keptByVillager, b.handed)} · kept by a thief ${P(b.keptByThief, b.handed)} (village got ${P(b.keptByThiefRecovered, b.keptByThief)} of those back)`);
  for (const k of Object.keys(a) as (keyof Stats)[]) { tot.a[k] += a[k]; tot.b[k] += b[k]; }
  tot.g += GAMES;
}
console.log(`\nALL  village wins ${P(tot.a.village, tot.g)} → ${P(tot.b.village, tot.g)} · Stone guesses ${P(tot.a.trackHit, tot.a.trackN)} → ${P(tot.b.trackHit, tot.b.trackN)} · villager→thief by Bhukamp ${(tot.a.toThief / tot.g).toFixed(3)} → ${(tot.b.toThief / tot.g).toFixed(3)}/game`);
console.log(`(${Math.round((Date.now() - t0) / 1000)} s)`);
