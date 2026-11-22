// one table size, the current rules: village win % (run several sizes in parallel). npx tsx scripts/bal-size.mts <n> [games=300] [skill=average]
import { playGame, SKILLS, type SkillName } from "../src/rules/brain";
const n = Number(process.argv[2]), G = Number(process.argv[3] ?? 300), sk = (process.argv[4] ?? "average") as SkillName;
let v = 0, why: Record<string, number> = {};
for (let g = 0; g < G; g++) { const st = playGame(n, 1000003 * n + g * 7919, SKILLS[sk]); if (st.winner === "V") v++; for (const e of st.end) why[e] = (why[e] ?? 0) + 1; }
console.log(`${n}p ${((100 * v) / G).toFixed(0)}%  ${Object.entries(why).sort().map(([k, c]) => `${k}:${c}`).join(" ")}`);
