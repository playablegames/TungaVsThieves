// Learn the TELLS (src/server/tells.ts) from whole bot games: for every public action, how often a thief takes it
// against a villager. Writes src/server/tells.json.   npx tsx scripts/tells-learn.mts [games per count=600]
import { writeFileSync } from "node:fs";
import { apply, start, waitingOn } from "@/engine/engine";
import { ROLE_TABLE } from "@/engine/setup";
import type { GameState } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS } from "@/server/belief";
import { tellsOf, type TellOdds } from "@/server/tells";

const G = Number(process.argv[2] ?? 600);
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const MIX = [SKILLS.average, SKILLS.casual, SKILLS.sharp];
const cnt: Record<string, Record<string, [number, number]>> = {};       // group → key → [thief, villager]
const aims: Record<string, { T: [number, number][]; V: [number, number][] }> = {}; // card → side → [hitThief, q]
for (const n of [5, 6, 7, 8, 9, 10, 11, 12]) for (let g = 0; g < G; g++) {
  let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), 31_000 + 1000 * n + g, ROLE_TABLE);
  for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
    const seat = waitingOn(s)[0]; const ph = s.phase; const sk = MIX[(seat + g) % 3];
    if (ph.kind === "vote" && ph.debate) pushBotClaim(s, seat, s.seed, rnd, sk);
    s = apply(s, seat, skilledAction(s, seat, s.seed, rnd, sk));
  }
  // sides as dealt (a Dal Badal moves them — rare enough to ignore here)
  const side = (x: number) => s.players[x].side;
  for (const t of tellsOf(s.events, n)) {
    if (t.kind === "outcome") {
      const g2 = (cnt[t.group] ??= {}); const c = (g2[t.key] ??= [0, 0]);
      c[side(t.actor) === "T" ? 0 : 1]++;
    } else {
      const thieves = t.cands.filter((x) => side(x) === "T").length;
      if (!thieves || thieves === t.cands.length) continue;
      const a = (aims[t.card] ??= { T: [], V: [] });
      a[side(t.actor)].push([side(t.target) === "T" ? 1 : 0, thieves / t.cands.length]);
    }
  }
}
// outcome odds per group, Laplace-smoothed
const out: TellOdds = { outcome: {}, aim: {} };
for (const [group, keys] of Object.entries(cnt)) {
  const totT = Object.values(keys).reduce((a, c) => a + c[0], 0), totV = Object.values(keys).reduce((a, c) => a + c[1], 0);
  const k = Object.keys(keys).length;
  out.outcome[group] = {};
  for (const [key, [t, v]] of Object.entries(keys)) {
    if (t + v < 40) continue; // too rare to trust
    out.outcome[group][key] = [+((t + 1) / (totT + k)).toFixed(4), +((v + 1) / (totV + k)).toFixed(4)];
  }
}
// aim lean: P(pick a thief) = q·l / (q·l + 1 − q); solve for l (maximum likelihood, by bisection)
const lean = (xs: [number, number][]) => {
  if (xs.length < 40) return 1;
  const hits = xs.reduce((a, [h]) => a + h, 0);
  let lo = 0.05, hi = 20;
  for (let i = 0; i < 60; i++) {
    const l = Math.sqrt(lo * hi);
    const exp = xs.reduce((a, [, q]) => a + (q * l) / (q * l + 1 - q), 0);
    if (exp > hits) hi = l; else lo = l;
  }
  return +Math.sqrt(lo * hi).toFixed(3);
};
for (const [card, a] of Object.entries(aims)) out.aim[card] = [lean(a.T), lean(a.V)];
writeFileSync("src/server/tells.json", JSON.stringify(out, null, 1) + "\n");
for (const [group, keys] of Object.entries(out.outcome)) for (const [key, [t, v]] of Object.entries(keys))
  console.log(`${group.padEnd(14)} ${key.padEnd(26)} thief ${(100 * t).toFixed(1).padStart(5)}%  villager ${(100 * v).toFixed(1).padStart(5)}%  LR ${(t / v).toFixed(2)}`);
for (const [card, [lt, lv]] of Object.entries(out.aim)) console.log(`aim ${card.padEnd(12)} thief lean ${lt}  villager lean ${lv}`);
