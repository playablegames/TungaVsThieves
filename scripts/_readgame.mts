// Plays one all-bot game under the bot rulebook and prints it as a story: every public event, and under each bot
// move the reason it gave (bot_why). For reading the bots' logic by eye.  npx tsx scripts/_readgame.mts [players] [seed]
import { SKILLS } from "@/server/belief";
import { playTable } from "@/server/simtable";
let seed = Number(process.argv[3] ?? 7); const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const n = Number(process.argv[2] ?? 7);
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp];
const s = playTable(n, 900_000 + seed, rnd, { skillOf: (x) => SK[x % 3], explain: true });
console.log(s.players.map((p) => `${p.name}=${p.role}(${p.side},${SK[p.seat % 3].name})`).join("  "));
const skip = new Set(["analytics_deal", "analytics_turn", "pickup", "pickup_private", "conduit", "setup", "role", "batwara_private", "reveal", "ballots_open"]);
for (const e of s.events) {
  if (skip.has(e.type)) continue;
  if (e.type === "bot_why") { if (!/^P\d+: (ready|a face-down pick)$/.test(e.msg)) console.log(`      ↳ ${e.msg}`); continue; }
  console.log(`${e.to === "all" ? "" : "  [private] "}${e.msg}`);
}
