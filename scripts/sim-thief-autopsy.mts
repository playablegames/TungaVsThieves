// WHY DO THIEVES LOSE? (2026-10-13, step 1 of "make the thieves stronger"). Whole games on the faithful table; for every
// game it follows both Stones and every thief chance, then reports where the thieves' games leak.
//   npx tsx scripts/sim-thief-autopsy.mts [games=300] [counts=6,9,12]
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";
import type { GameState } from "@/engine/types";

const G = Number(process.argv[2] ?? 300);
const COUNTS = (process.argv[3] ?? "6,9,12").split(",").map(Number);
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp], PS = Object.keys(PERSONALITIES);
const ST = ["STONE_1", "STONE_2"];
const has = (x: unknown) => Array.isArray(x) && x.some((c) => ST.includes(c as string));

for (const n of COUNTS) {
  let seed = 41; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const t: Record<string, number> = {};
  const inc = (k: string, v = 1) => { t[k] = (t[k] ?? 0) + v; };
  for (let g = 0; g < G; g++) {
    const s: GameState = playTable(n, 1_300_000 + 1000 * n + g, rnd, { skillOf: (x) => personalised(SK[(x + g) % 3], PS[(x + 3 * g) % 4]) });
    const side = (x: number) => s.players[x].side;
    const won = s.phase.kind === "over" ? s.phase.winner : "T";
    inc(won === "V" ? "villageWins" : "thiefWins");
    // follow the Stones
    const holder: Record<string, number | null> = { STONE_1: null, STONE_2: null };
    let thiefEverHeld = false;
    const move = (c: string, to: number, how: string) => {
      const from = holder[c];
      if (from === to) return;
      holder[c] = to;
      if (side(to) === "T") thiefEverHeld = true;
      if (from !== null && side(from) !== side(to)) inc(`${won}:${side(from)}>${side(to)} by ${how}`);
    };
    for (const e of s.events) {
      const d = e.data ?? {};
      if (e.type === "analytics_deal") for (const p of d.players as { seat: number; hand: string[] }[]) for (const c of ST) if (p.hand.includes(c)) { holder[c] = p.seat; if (side(p.seat) === "T") thiefEverHeld = true; }
      if (e.type === "pickup_private" && Array.isArray(e.to)) for (const c of ST) if ((d.cards as string[] | undefined)?.includes(c)) move(c, e.to[0], "the pile");
      if (e.type === "batwara_private" && ST.includes(d.card as string)) move(d.card as string, d.to as number, "Bhukamp");
      if (e.type === "hera_pheri_private" && Array.isArray(e.to)) for (const c of ST) if ((d.taken as string[] | undefined)?.includes(c)) move(c, e.to[0], "Hera Pheri");
      if (e.type === "handoff_private") for (const c of ST) if ((d.cards as string[] | undefined)?.includes(c)) move(c, d.target as number, "an exit's cards");
      // the thieves' chances
      if (e.type === "hera_pheri" && side(d.seat as number) === "T") inc("thiefHP");
      if (e.type === "hera_pheri_private" && Array.isArray(e.to) && side(e.to[0]) === "T" && has(d.taken)) inc("thiefHPgotStone");
      if (e.type === "talashi" && side(d.seat as number) === "T") inc("thiefTalashi");
      if (e.type === "batwara" && side(d.seat as number) === "T") inc("thiefBhukamp");
      if (e.type === "dal_badal") inc("dalBadal");
      if (e.type === "vote_result" && typeof d.out === "number") inc(`votedOut${side(d.out)}${d.reason === "final" ? "final" : "faisla"}`);
      if (e.type === "teer_kaman" && side(d.seat as number) === "T") inc(d.hit ? "thiefTKhit" : "thiefTKmiss");
    }
    if (won === "V") inc(thiefEverHeld ? "V:thieves held a Stone at some point" : "V:a Stone NEVER reached a thief");
  }
  const vw = t.villageWins ?? 0;
  console.log(`\n=== ${n} players, ${G} games — village won ${vw} (${Math.round((100 * vw) / G)}%)`);
  console.log(`  in the village's wins: a Stone never reached a thief ${t["V:a Stone NEVER reached a thief"] ?? 0}× · thieves held one but lost it ${t["V:thieves held a Stone at some point"] ?? 0}×`);
  const lost = Object.entries(t).filter(([k]) => k.startsWith("V:T>V")).sort((a, b) => b[1] - a[1]);
  console.log(`  how the thieves LOST Stones (in the village's wins): ${lost.map(([k, v]) => `${k.slice(6)} ${v}`).join(" · ") || "—"}`);
  const got = Object.entries(t).filter(([k]) => k.includes(":V>T")).sort((a, b) => b[1] - a[1]);
  console.log(`  how thieves GOT Stones (all games): ${got.map(([k, v]) => `${k} ${v}`).join(" · ") || "—"}`);
  console.log(`  thief Hera Pheri: ${t.thiefHP ?? 0}, took a Stone ${t.thiefHPgotStone ?? 0} (${Math.round((100 * (t.thiefHPgotStone ?? 0)) / Math.max(1, t.thiefHP ?? 0))}%) · thief Talashi ${t.thiefTalashi ?? 0} · thief Bhukamp ${t.thiefBhukamp ?? 0} · Dal Badal ${t.dalBadal ?? 0}`);
  console.log(`  voted out — Faisla: thieves ${t.votedOutTfaisla ?? 0} / villagers ${t.votedOutVfaisla ?? 0} · final vote: thieves ${t.votedOutTfinal ?? 0} / villagers ${t.votedOutVfinal ?? 0} · thief Teer Kaman ${t.thiefTKhit ?? 0} hit / ${t.thiefTKmiss ?? 0} miss`);
}
