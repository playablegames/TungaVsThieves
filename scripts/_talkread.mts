// Read one simulated game's talk: who told whom what, counterclaims, votes (bot talk check, 2026-10-14)
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";
let seed = 21; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp], PS = Object.keys(PERSONALITIES);
const n = Number(process.argv[2] ?? 7), g = Number(process.argv[3] ?? 1);
const s = playTable(n, 400_000 + 1000 * n + g, rnd, { skillOf: (x) => personalised(SK[(x + g) % 3], PS[(x + 3 * g) % 4]), explain: true });
const who = (x: number) => `${s.players[x].name}(${s.players[x].role}/${s.players[x].side}${s.players[x].alive ? "" : "†"})`;
console.log(s.players.map((p) => who(p.seat) + ":" + PS[(p.seat + 3 * g) % 4]).join("  "));
for (const e of s.events) {
  if (["whisper_private", "claim", "vote_result", "teer_kaman", "eliminated", "faisla", "final_vote", "over"].includes(e.type) || (e.type === "bot_why" && /vote|shoot/.test(e.msg)))
    console.log(e.n, e.type, Array.isArray(e.to) ? `[${e.to}]` : "", e.msg.slice(0, 150));
}
