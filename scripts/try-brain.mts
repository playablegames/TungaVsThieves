// quick A/B of village fixes: BRAIN_TRY=<letters> npx tsx scripts/try-brain.mts <n> [games]
import { playGame, SKILLS } from "../src/rules/brain";
const n = Number(process.argv[2]), G = Number(process.argv[3] ?? 200);
let v = 0; for (let g = 0; g < G; g++) if (playGame(n, 1000003 * n + g * 7919, SKILLS.average).winner === "V") v++;
console.log(`${process.env.BRAIN_TRY || "-"} ${n}p ${((100 * v) / G).toFixed(0)}%`);
