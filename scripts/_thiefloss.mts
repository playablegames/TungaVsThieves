// WHERE DO THIEVES LOSE? (designer 2026-10-14: "can't we model thief skills into the game?") — end reasons, how thieves
// went out, whether a thief ever held a Stone, how the mandatory vote went. One table size, many games.
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";
let seed = 21; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp], PS = Object.keys(PERSONALITIES);
const G = Number(process.argv[2] ?? 500), n = Number(process.argv[3] ?? 7);
const c: Record<string, number> = {};
const inc = (k: string, by = 1) => (c[k] = (c[k] ?? 0) + by);
for (let g = 0; g < G; g++) {
  const s = playTable(n, 900_000 + g, rnd, { skillOf: (x) => personalised(SK[(x + g) % 3], PS[(x + 3 * g) % 4]) });
  if (s.phase.kind !== "over") { inc("unfinished"); continue; }
  inc(`${s.phase.winner === "V" ? "VILLAGE" : "THIEVES"}: ${s.phase.reason}`);
  const T = new Set(s.players.filter((p) => p.side === "T").map((p) => p.seat));
  // how each thief went out
  for (const e of s.events) {
    if (e.type === "teer_kaman") { const t = e.data!.target as number, a = e.data!.seat as number;
      if (e.data!.hit && T.has(t)) inc(T.has(a) ? "thief out: shot by a PARTNER" : "thief out: Teer Kaman hit"); if (!e.data!.hit && T.has(a)) inc("thief out: own Teer Kaman missed"); }
    if (e.type === "vote_result" && typeof e.data?.out === "number" && T.has(e.data.out as number)) inc(`thief out: ${e.data.reason === "final" ? "MANDATORY vote" : "Faisla vote"}`);
    if (e.type === "vote_result" && typeof e.data?.out === "number" && !T.has(e.data.out as number)) inc(`villager out: ${e.data.reason === "final" ? "MANDATORY vote" : "Faisla vote"}`);
  }
  // did any thief ever hold a Stone? (pickups, steals, Bhukamp, hand-offs seen in private events)
  const touched = s.events.some((e) => Array.isArray(e.to) && e.to.some((x) => T.has(x)) && JSON.stringify(e.data ?? {}).includes("STONE") &&
    ["pickup_private", "hera_pheri_private", "batwara_private", "handoff_private"].includes(e.type) && (e.type !== "batwara_private" || T.has(e.data?.to as number)) && (e.type !== "hera_pheri_private" || T.has(e.to[0] as number)));
  inc(touched ? "a thief held a Stone at some point" : "no thief ever held a Stone");
  // at the end of round 3 (the mandatory vote's start): Stones in living thief hands
  const fv = s.events.find((e) => e.type === "final_vote");
  if (fv) inc("reached the mandatory vote");
  const deal = s.events.find((e) => e.type === "analytics_deal")!.data!.players as { seat: number; hand: string[] }[];
  if (deal.some((p) => T.has(p.seat) && p.hand.some((x) => x.startsWith("STONE")))) inc("a thief was DEALT a Stone");
  // talk: how many thieves blamed (the tell) vs defended
  for (const e of s.events) if (e.data?.answer === true && T.has(e.data.seat as number)) inc(e.data.kind === "accuse" ? "thief answered by BLAMING" : "thief answered by DEFENDING");
}
for (const [k, v] of Object.entries(c).sort()) console.log(String(v).padStart(6), " ", k);
