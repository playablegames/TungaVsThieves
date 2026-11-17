// BALANCE CHECK for the rebuilt rules (src/rules) — Dal Badal (A) own turn only vs (B) any time.
//   npx tsx scripts/balance-rules.mts [games-per-cell=1000]
import { playGame } from "../src/rules/bot";

const G = Number(process.argv[2] ?? 1000);
const sizes = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const rows: string[] = [];
const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(0)}%`.padStart(4);
for (const anytime of [false, true]) {
  const label = anytime ? "B any time    " : "A own turn    ";
  const win: string[] = [], extra: string[] = [];
  for (const n of sizes) {
    let v = 0, wipe = 0, turns = 0, db = 0, hit = 0, miss = 0, says = 0, stuck = 0;
    for (let g = 0; g < G; g++) {
      const st = playGame(n, 1000003 * n + g * 7919 + (anytime ? 17 : 0), { dalBadalAnytime: anytime });
      if (st.winner === "V") v++;
      if (st.reason.startsWith("Every")) wipe++;
      if (st.reason === "stuck") stuck++;
      turns += st.turns; db += st.dalBadal; hit += st.tkHit; miss += st.tkMiss; says += st.says;
    }
    win.push(pct(v, G));
    extra.push(`${n}p: turns ${(turns / G).toFixed(1)} · instant win ${pct(wipe, G)} · Dal Badal/game ${(db / G).toFixed(2)} · TK hit ${hit} miss ${miss} · talk/game ${(says / G).toFixed(1)}${stuck ? ` · STUCK ${stuck}` : ""}`);
    process.stderr.write(".");
  }
  rows.push(`${label}${win.join("  ")}`);
  rows.push(...extra.map((x) => `   ${x}`));
}
console.log(`\nVillage wins %  (${G} games a cell)\n               ${sizes.map((n) => `${n}p`.padStart(4)).join("  ")}`);
console.log(rows.join("\n"));
