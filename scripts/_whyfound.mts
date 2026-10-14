// WHY ARE THIEVES FOUND? — the reasons in villager bots' ballots that land on a thief (bot_why), counted by kind
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";
let seed = 21; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp], PS = Object.keys(PERSONALITIES);
const G = Number(process.argv[2] ?? 300), n = Number(process.argv[3] ?? 7);
const hitT = new Map<string, number>(), hitV = new Map<string, number>();
let onT = 0, onV = 0;
for (let g = 0; g < G; g++) {
  const s = playTable(n, 700_000 + g, rnd, { skillOf: (x) => personalised(SK[(x + g) % 3], PS[(x + 3 * g) % 4]), explain: true });
  // a ballot's reason: the bot_why logged as the vote is cast — find the vote results and the reasons just before
  for (const e of s.events) {
    if (e.type !== "bot_why" || !/^\S+: /.test(e.msg)) continue;
    const seat = e.data?.seat as number;
    if (s.players[seat]?.side !== "V") continue;
    const m = /\(([^)]*)\)/.exec(e.msg); if (!m) continue;
    // which target? the next vote_result's ballot for this seat
    const vr = s.events.find((x) => x.n > e.n && x.type === "vote_result");
    const tgt = (vr?.data?.ballots as Record<string, number | null> | undefined)?.[seat];
    if (typeof tgt !== "number") continue;
    const into = s.players[tgt].side === "T" ? hitT : hitV;
    s.players[tgt].side === "T" ? onT++ : onV++;
    for (const part of m[1].split(", ")) {
      const kind = part.replace(/^[+-]?[\d.]+ /, "").replace(/P\d+/g, "X").replace(/\b(Kisaan|Sarpanch|Baba|Teacher|Police|Doctor|NRI|Deewani|Chor|Lootera|Gunda|Daku)\b/g, "R");
      into.set(kind, (into.get(kind) ?? 0) + 1);
    }
  }
}
console.log(`villager ballots on a THIEF: ${onT}, on a VILLAGER: ${onV}`);
const keys = [...new Set([...hitT.keys(), ...hitV.keys()])].sort((a, b) => (hitT.get(b) ?? 0) + (hitV.get(b) ?? 0) - (hitT.get(a) ?? 0) - (hitV.get(a) ?? 0));
console.log("reason".padEnd(60), "on T", " on V");
for (const k of keys.slice(0, 25)) console.log(k.slice(0, 60).padEnd(60), String(hitT.get(k) ?? 0).padStart(5), String(hitV.get(k) ?? 0).padStart(5));
