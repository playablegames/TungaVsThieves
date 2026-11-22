// TEAM SIZES (owner 2026-11-22: "increase thief counts too to balance"): village win % per candidate split, full bots.
//   npx tsx scripts/teams.mts [games=300] [size=all]
import { BOT_TABLE as TABLE, playGame, SKILLS } from "../src/rules/brain";
const G = Number(process.argv[2] ?? 300), only = process.argv[3] ? Number(process.argv[3]) : null;
const CAND: Record<number, [number, number, number][]> = {
  4: [[3, 1, 1], [3, 1, 3]], 5: [[3, 2, 3]], 6: [[4, 2, 2]], 8: [[5, 3, 2]], 9: [[5, 4, 4]], 11: [[7, 4, 3]], 12: [[7, 5, 5]],
};
for (const n of Object.keys(CAND).map(Number)) {
  if (only && n !== only) continue;
  const row: string[] = [];
  for (const c of CAND[n]) {
    TABLE[n] = c;
    let v = 0;
    for (let g = 0; g < G; g++) if (playGame(n, 1000003 * n + g * 7919, SKILLS.average).winner === "V") v++;
    row.push(`${c[0]}+${c[1]} ${c[2]}r: ${((100 * v) / G).toFixed(0)}%`);
  }
  console.log(`${n}p  ${row.join("   ")}`);
}
