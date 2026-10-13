// LEARN FROM EVERY REAL GAME (2026-10-13, step 5 of the bot plan). One command after a play session:
//   1. downloads every finished game with a real player in it (analysis/players.json names them — the dev test
//      scripts' made-up players are not people) into analysis/logs/ (git-ignored: real names, real chats)
//   2. re-learns the TELLS with every real player's move counting HUMAN_WEIGHT times a bot's (tells-learn.mts reads
//      analysis/logs/ when it is there)
//   3. prints the scorecard: real players next to the bots, per person and per personality
//   npx tsx scripts/learn-from-games.mts            (needs .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const env = Object.fromEntries(readFileSync(".env.local", "utf8").split(/\r?\n/).filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const players: string[] = JSON.parse(readFileSync("analysis/players.json", "utf8")).map((x: string) => x.toLowerCase());
const LOGS = "analysis/logs";
mkdirSync(LOGS, { recursive: true });

const list = await (await fetch(`${URL}/rest/v1/games?select=code,lobby&status=eq.over&order=created_at.desc&limit=1000`, { headers: H })).json() as { code: string; lobby: { name: string; bot?: boolean }[] }[];
let fresh = 0;
for (const g of list) {
  if (!g.lobby.some((p) => !p.bot && players.includes(p.name.toLowerCase()))) continue;
  const file = join(LOGS, `${g.code}.json`);
  if (existsSync(file)) continue;
  writeFileSync(file, JSON.stringify(await (await fetch(`${URL}/rest/v1/games?code=eq.${g.code}&select=*`, { headers: H })).json()));
  fresh++;
}
console.log(`real-player games: ${list.filter((g) => g.lobby.some((p) => !p.bot && players.includes(p.name.toLowerCase()))).length} (${fresh} new)`);
if (process.argv.includes("--no-learn")) process.exit(0);
console.log("re-learning the tells (real players weigh more)…");
execSync("npx tsx scripts/tells-learn.mts 150", { stdio: "inherit" });
console.log("\nTHE SCORECARD — real players vs bots");
execSync(`npx tsx scripts/scorecard.mts ${LOGS} 60`, { stdio: "inherit" });
