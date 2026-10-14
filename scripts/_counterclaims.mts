// Counterclaims in bot games (designer 2026-10-14: "most probably the OLD one is lying"): when two players claim the
// same village role, who is the liar — the first claimer or the later one? Plus village win % per table size.
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";
import { ROLE_TABLE } from "@/engine/setup";
// a rule option to measure: BOT_FLAGS="table=7:4/3/3,6:3/3/3" (villagers/thieves/rounds)
const table = { ...ROLE_TABLE };
for (const m of (process.env.BOT_FLAGS ?? "").matchAll(/(\d+):(\d+)\/(\d+)\/(\d+)/g)) table[Number(m[1])] = [Number(m[2]), Number(m[3]), Number(m[4])];
let seed = 21; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp], PS = Object.keys(PERSONALITIES);
const G = Number(process.argv[2] ?? 100);
let firstLiar = 0, laterLiar = 0;
for (const n of (process.argv[3] ?? "5,6,7,8,9,10,12").split(",").map(Number)) {
  let vw = 0, outT = 0, outV = 0;
  for (let g = 0; g < G; g++) {
    const s = playTable(n, 400_000 + 1000 * n + g, rnd, { skillOf: (x) => personalised(SK[(x + g) % 3], PS[(x + 3 * g) % 4]), table });
    if (s.phase.kind === "over" && s.phase.winner === "V") vw++;
    for (const e of s.events) if (e.type === "vote_result" && typeof e.data?.out === "number") s.players[e.data.out as number].side === "T" ? outT++ : outV++;
    // the first moment each player claimed each role
    const firsts = new Map<string, { seat: number; n: number }[]>();
    for (const e of s.events) {
      if (e.data?.kind !== "self" || typeof e.data?.role !== "string" || typeof e.data?.seat !== "number") continue;
      const xs = firsts.get(e.data.role) ?? [];
      if (!xs.some((x) => x.seat === e.data!.seat)) xs.push({ seat: e.data.seat as number, n: e.n });
      firsts.set(e.data.role, xs);
    }
    // the role's true owner at the start (the deal)
    const deal = s.events.find((e) => e.type === "analytics_deal")!.data!.players as { seat: number; role: string }[];
    for (const [role, xs] of firsts) if (xs.length >= 2) {
      const owner = deal.find((p) => p.role === role)?.seat;
      const [a] = [...xs].sort((p, q) => p.n - q.n);
      if (a.seat !== owner) firstLiar++; else laterLiar++;
    }
  }
  console.log(`${n}p ${table[n].join("/")}  village ${Math.round(100 * vw / G)}%  ±${Math.round(100 * 1.96 * Math.sqrt(0.25 / G))}  voted out T${outT}/V${outV}`);
}
console.log(`counterclaims: the FIRST claimer was the liar ${firstLiar} times, a LATER one ${laterLiar} times`);
