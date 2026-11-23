// A/B: the bot brain before vs after a change, same seeds. npx tsx scripts/ab-brain.mts [games=150] [skill=average]
import * as A from "../src/rules/brain_old";
import * as B from "../src/rules/brain";
const G = Number(process.argv[2] ?? 150), sk = (process.argv[3] ?? "average") as "average";
for (const [name, M] of [["before", A], ["after", B]] as const) {
  const row: string[] = []; let hit = 0, miss = 0, says = 0;
  for (const n of (process.env.SIZES ?? "4,6,8,10,12").split(",").map(Number)) {
    let v = 0;
    for (let g = 0; g < G; g++) { const st = (M.playGame as (n: number, seed: number, sk: unknown) => B.GameStats)(n, 1000003 * n + g * 7919, M.SKILLS[sk]); if (st.winner === "V") v++; hit += st.tkHit; miss += st.tkMiss; says += st.says; }
    row.push(`${n}p ${((100 * v) / G).toFixed(0)}%`);
  }
  console.log(`${name.padEnd(7)} village wins: ${row.join("  ")} | Teer Kaman per game: hit ${(hit / G / 5).toFixed(2)} miss ${(miss / G / 5).toFixed(2)} | talk per game ${(says / G / 5).toFixed(1)}`);
}
