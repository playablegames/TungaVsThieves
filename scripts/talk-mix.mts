import { playGame, SKILLS } from "../src/rules/brain";
const n = Number(process.argv[2] ?? 12), k: Record<string, number> = {};
for (let g = 0; g < 20; g++) for (const [a, b] of Object.entries(playGame(n, 777 + g, SKILLS.average).talkKinds)) k[a] = (k[a] ?? 0) + b / 20;
console.log(n + "p", Object.entries(k).sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a} ${b.toFixed(1)}`).join(" · "));
