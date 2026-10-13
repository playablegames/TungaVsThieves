// THE HUMAN-LIKENESS SCORECARD (2026-10-13): the same numbers for real players and for bots, side by side.
// Real players = every human seat in the downloaded game logs (Aditya, Chilyy, Vj, Pallavi); bots = a mixed table
// played exactly as the online game plays (src/server/simtable.ts).
//   npx tsx scripts/scorecard.mts <dir of game-row .json files> [bot games per count=150]
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "@/engine/types";
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";

const HUMANS: Record<string, string> = { adi: "Aditya", "aditya chainani": "Aditya", chilyy: "Chilyy", chilly: "Chilyy", pallavi: "Pallavi", pallavii: "Pallavi", vj: "Vj" };
const [dir, G = "150"] = process.argv.slice(2);

type Tally = Record<string, number>;
const inc = (t: Tally, k: string, v = 1) => { t[k] = (t[k] ?? 0) + v; };

/** count what `seats` did in one finished game */
export function tally(s: GameState, seats: Set<number>, t: Tally) {
  const ev = s.events, side = (x: number) => s.players[x].side;
  for (const x of seats) { inc(t, "games"); if (s.phase.kind === "over" && s.phase.winner === side(x)) inc(t, "won"); }
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i], d = e.data ?? {}, a = typeof d.seat === "number" ? d.seat : -1;
    if (e.type === "analytics_turn" && seats.has(a)) {
      inc(t, "turns");
      const can = (d.playable as string[] | undefined)?.length;
      const stone = Number(d.stones ?? 0) > 0;
      if (can) { inc(t, stone ? "couldS" : "couldN"); if (d.played == null) inc(t, stone ? "skipS" : "skipN"); }
    }
    if (e.type === "kundli" && seats.has(a)) {
      const said = ev.slice(i + 1).some((x) => x.type === "claim" && x.data?.seat === a && x.data?.target === d.target);
      inc(t, said ? "kSaid" : "kSilent");
    }
    if (e.type === "claim" && seats.has(a) && d.kind !== "stone" && typeof d.target === "number") {
      const ok = d.side === side(d.target);
      inc(t, `claim${side(a)}`); if (ok) inc(t, `claimTrue${side(a)}`);
    }
    if (e.type === "teer_kaman" && seats.has(a)) { inc(t, "tk"); if (d.hit) inc(t, "tkHit"); }
    if (e.type === "faisla" && seats.has(a)) inc(t, "faisla");
    if (e.type === "vote_result") for (const [k, tg] of Object.entries((d.ballots as Record<string, number | null>) ?? {})) {
      const v = Number(k);
      if (!seats.has(v)) continue;
      if (tg === null) { inc(t, "abstain"); continue; }
      inc(t, `ballot${side(v)}`); if (side(tg) !== side(v)) inc(t, `ballotRight${side(v)}`);
    }
  }
}

const pct = (a = 0, b = 0) => (b ? `${Math.round((100 * a) / b)}%`.padStart(5) : "   — ");
const ROWS: [string, (t: Tally) => string][] = [
  ["pairs left unplayed", (t) => pct((t.skipS ?? 0) + (t.skipN ?? 0), (t.couldS ?? 0) + (t.couldN ?? 0))],
  ["  …holding a Stone", (t) => pct(t.skipS, t.couldS)],
  ["  …no Stone", (t) => pct(t.skipN, t.couldN)],
  ["speak after own Kundli", (t) => pct(t.kSaid, (t.kSaid ?? 0) + (t.kSilent ?? 0))],
  ["villager claims true", (t) => pct(t.claimTrueV, t.claimV)],
  ["thief claims true", (t) => pct(t.claimTrueT, t.claimT)],
  ["villager ballots on a thief", (t) => pct(t.ballotRightV, t.ballotV)],
  ["thief ballots on a villager", (t) => pct(t.ballotRightT, t.ballotT)],
  ["Teer Kaman hits", (t) => pct(t.tkHit, t.tk)],
  ["Faisla calls per 10 turns", (t) => (t.turns ? (10 * (t.faisla ?? 0) / t.turns).toFixed(1).padStart(5) : "   — ")],
  ["wins", (t) => pct(t.won, t.games)],
];

// ---- people
const people: Record<string, Tally> = { All: {} };
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const row = JSON.parse(readFileSync(join(dir, f), "utf8"))[0];
  const s = row?.state as GameState | null;
  if (!s || s.phase.kind !== "over") continue;
  for (const p of s.players) {
    const who = HUMANS[p.name.toLowerCase()];
    if (!who) continue;
    tally(s, new Set([p.seat]), (people[who] ??= {}));
    tally(s, new Set([p.seat]), people.All);
  }
}

// ---- bots: a mixed table, each seat a skill and a personality, played as online
let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const bots: Record<string, Tally> = { All: {} };
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp];
const PS = Object.keys(PERSONALITIES);
for (const n of [6, 8, 10, 12]) for (let g = 0; g < Number(G); g++) {
  const who = (x: number) => PS[(x + g) % PS.length];
  const s = playTable(n, 50_000 + 100 * n + g, rnd, { skillOf: (x) => personalised(SK[(x + 2 * g) % 3], who(x)) });
  for (let x = 0; x < n; x++) { tally(s, new Set([x]), (bots[who(x)] ??= {})); tally(s, new Set([x]), bots.All); }
}

const cols = [...Object.keys(people).map((k) => [`${k}`, people[k]] as const), ...Object.keys(bots).map((k) => [`bot:${k}`, bots[k]] as const)];
console.log("".padEnd(30) + cols.map(([k]) => k.slice(0, 11).padStart(12)).join(""));
for (const [label, f] of ROWS) console.log(label.padEnd(30) + cols.map(([, t]) => f(t).padStart(12)).join(""));
console.log("games".padEnd(30) + cols.map(([, t]) => String(t.games ?? 0).padStart(12)).join(""));
