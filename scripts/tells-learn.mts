// Learn the TELLS (src/server/tells.ts) from whole bot games: for every public action, how often a thief takes it
// against a villager. Writes src/server/tells.json.   npx tsx scripts/tells-learn.mts [games per count=600]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "@/engine/types";
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";
import { tellsOf, type TellOdds } from "@/server/tells";

const G = Number(process.argv[2] ?? 600);
let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const MIX = [SKILLS.average, SKILLS.casual, SKILLS.sharp];
const PS = Object.keys(PERSONALITIES);
const cnt: Record<string, Record<string, [number, number]>> = {};       // group → key → [thief, villager]
const aims: Record<string, { T: [number, number][]; V: [number, number][] }> = {}; // card → side → [hitThief, q]
for (const n of [5, 6, 7, 8, 9, 10, 11, 12]) for (let g = 0; g < G; g++) {
  // the table people play against: every skill x personality, played as online (simtable.ts)
  const s = playTable(n, 31_000 + 1000 * n + g, rnd, { skillOf: (x) => personalised(MIX[(x + g) % 3], PS[(x + 2 * g) % PS.length]) });
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
// REAL PLAYERS (scripts/learn-from-games.mts): every move a real person made counts HUMAN_WEIGHT times a bot's — the
// tells are meant to be what PEOPLE give away, and bots only stand in until there are enough real games
const HUMAN_WEIGHT = 5;
if (existsSync("analysis/logs") && existsSync("analysis/players.json")) {
  const people: string[] = JSON.parse(readFileSync("analysis/players.json", "utf8")).map((x: string) => x.toLowerCase());
  let games = 0, moves = 0;
  for (const f of readdirSync("analysis/logs").filter((x) => x.endsWith(".json"))) {
    const s = (JSON.parse(readFileSync(join("analysis/logs", f), "utf8"))[0]?.state ?? null) as GameState | null;
    if (!s || s.phase.kind !== "over") continue;
    const human = new Set(s.players.filter((p) => people.includes(p.name.toLowerCase())).map((p) => p.seat));
    const side = (x: number) => s.players[x].side;
    games++;
    for (const t of tellsOf(s.events, s.players.length)) {
      if (!human.has(t.actor)) continue;
      moves++;
      if (t.kind === "outcome") { const c = ((cnt[t.group] ??= {})[t.key] ??= [0, 0]); c[side(t.actor) === "T" ? 0 : 1] += HUMAN_WEIGHT; }
      else {
        const thieves = t.cands.filter((x) => side(x) === "T").length;
        if (!thieves || thieves === t.cands.length) continue;
        for (let k = 0; k < HUMAN_WEIGHT; k++) (aims[t.card] ??= { T: [], V: [] })[side(t.actor)].push([side(t.target) === "T" ? 1 : 0, thieves / t.cands.length]);
      }
    }
  }
  console.log(`real players: ${moves} moves from ${games} games, each weighing ${HUMAN_WEIGHT}x`);
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
