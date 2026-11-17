// BALANCE CHECK with the bot brain (src/rules/brain.ts), at 3 skill levels.
//   npx tsx scripts/balance-brain.mts [games-per-cell=500] [skills=casual,average,sharp]
import { playGame, SKILLS, type SkillName } from "../src/rules/brain";

const G = Number(process.argv[2] ?? 500);
const skills = (process.argv[3] ?? "casual,average,sharp").split(",") as SkillName[];
const sizes = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(0)}%`.padStart(4);
console.log(`Village wins %  (${G} games a cell)\n         ${sizes.map((n) => `${n}p`.padStart(4)).join("  ")}`);
for (const sk of skills) {
  const row: string[] = [];
  for (const n of sizes) {
    let v = 0;
    for (let g = 0; g < G; g++) if (playGame(n, 1000003 * n + g * 7919, SKILLS[sk]).winner === "V") v++;
    row.push(pct(v, G));
  }
  console.log(`${sk.padEnd(8)} ${row.join("  ")}`);
}
