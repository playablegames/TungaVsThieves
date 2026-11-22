// what the bots DO per game (owner 2026-11-22: "are the bots smarter"). BRAIN_EXP=KT for the old behaviour.
import { playGame, SKILLS } from "../src/rules/brain";
const n = Number(process.argv[2] ?? 7), G = Number(process.argv[3] ?? 200);
const c: Record<string, number> = {};
const add = (k: string, v = 1) => { c[k] = (c[k] ?? 0) + v; };
for (let g = 0; g < G; g++) {
  let last: any = null;
  const st = playGame(n, 1000003 * n + g * 7919, SKILLS.average, (s) => { last = s; });
  const ev = last.events as { type: string; data?: any }[];
  add("vote changes", ev.filter((e) => e.type === "ballot" && e.data?.changed).length);
  add("card asks (whispers)", ev.filter((e) => e.type === "whisper").length);
  add("Faisla played", ev.filter((e) => e.type === "play" && e.data?.card === "FAISLA").length);
  add("Teer Kaman shots", st.tkHit + st.tkMiss);
  add("Hera Pheri", ev.filter((e) => e.type === "play" && e.data?.card === "HERA_PHERI").length);
  add("Stone talk", st.talkKinds.stone ?? 0);
  add("role claims", st.talkKinds.claim ?? 0);
  add("accusations", st.talkKinds.accuse ?? 0);
  add("ties at a vote", ev.filter((e) => e.type === "tie").length);
}
console.log(Object.entries(c).map(([k, v]) => `${k}: ${(v / G).toFixed(2)}`).join(" | "));
