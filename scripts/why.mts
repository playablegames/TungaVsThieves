// WHY do thieves win? where the Stones end, what the final vote does (average bots, Dal Badal A)
import { playGame, SKILLS } from "../src/rules/brain";
const G = Number(process.argv[2] ?? 200);
for (const n of [4, 5, 6, 7, 8, 9, 10, 11, 12]) {
  const c: Record<string, number> = {}; let v = 0, vStones = 0;
  for (let g = 0; g < G; g++) {
    const st = playGame(n, 5000000 + n * 1000 + g, SKILLS.average);
    if (st.winner === "V") v++;
    for (const k of st.end) c[k] = (c[k] ?? 0) + 1;
    // both stones with villager hands (not voted out) or pile
    const s = st.end.filter((k) => k.startsWith("stone:"));
    if (s.length === 2 && s.every((k) => k === "stone:V" || k === "stone:pile" || k === "stone:T_votedout")) vStones++;
  }
  const f = (k: string) => `${Math.round((100 * (c[k] ?? 0)) / G)}%`;
  const st = (k: string) => `${Math.round((100 * (c[k] ?? 0)) / (2 * G))}%`;
  console.log(`${String(n).padStart(2)}p village ${f("__")}${Math.round(100 * v / G)}% | final vote: thief out ${f("final:out_T")} · villager out ${f("final:out_V")} · tie ${f("final:tie")} · wipe V ${f("wipe:V")} T ${f("wipe:T")} | each Stone ends: villager ${st("stone:V")} · thief ${st("stone:T")} · pile ${st("stone:pile")} · voted-out thief ${st("stone:T_votedout")} · voted-out villager ${st("stone:V_votedout")}`);
}
