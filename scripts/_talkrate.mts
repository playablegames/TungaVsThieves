// how much do bots talk, per bot per game — to set against the real tables (analysis/logs: 0.27 public claims per
// person per game, ~0 private chats, 43% of Kundli reads ever said)
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";
let seed = 21; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp], PS = Object.keys(PERSONALITIES);
const G = Number(process.argv[2] ?? 200), n = Number(process.argv[3] ?? 7);
let claims = 0, priv = 0, reads = 0, said = 0, seats = 0, ganged = 0, faislas = 0;
for (let g = 0; g < G; g++) {
  const s = playTable(n, 300_000 + g, rnd, { skillOf: (x) => personalised(SK[(x + g) % 3], PS[(x + 3 * g) % 4]) });
  seats += n;
  for (const e of s.events) {
    if (e.type === "claim" && e.to === "all") claims++;
    if (e.type === "whisper_private") priv++;
    if (e.type === "kundli_private" && !e.data?.mutual && Array.isArray(e.to)) { reads++; if (s.events.some((x) => x.n > e.n && x.type === "claim" && x.data?.seat === e.to[0] && x.data?.target === e.data?.target)) said++; }
    if (e.type === "vote_result") { faislas++; const b = Object.values((e.data?.ballots as Record<string, number | null>) ?? {}).filter((x) => x !== null) as number[];
      const top = Math.max(0, ...[...new Set(b)].map((t) => b.filter((x) => x === t).length)); if (b.length && top >= Math.ceil(0.75 * b.length)) ganged++; }
  }
}
console.log(`${n}p bots, per bot per game: public claims ${(claims / seats).toFixed(2)} · private lines ${(priv / seats).toFixed(2)}`);
console.log(`Kundli reads said out loud: ${(100 * said / Math.max(1, reads)).toFixed(0)}% · votes where 3/4+ of ballots went one way: ${(100 * ganged / Math.max(1, faislas)).toFixed(0)}%`);
