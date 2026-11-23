// HUMAN HABITS CHECK (owner 2026-11-23): do the habits show up, and where does balance land?
//   npx tsx scripts/habits.mts <players> [games=200] [table=average|casual|sharp|mixed]
//   BRAIN_HABITS=0 → the clean bots of 2026-11-22 for comparison. "mixed" = beginners and skilled players, seat by seat,
//   given out before the roles are dealt (so neither side is helped).
import { playGame, SKILLS, type Skill } from "../src/rules/brain";
import type { State } from "../src/rules/game";
const n = Number(process.argv[2]), G = Number(process.argv[3] ?? 200), table = process.argv[4] ?? "average";
const skill: Skill | ((seat: number) => Skill) = table === "mixed" ? (seat: number) => (seat % 2 ? SKILLS.sharp : SKILLS.casual) : SKILLS[table as "average"];
let v = 0, last: State | null = null;
const c: Record<string, number> = {};
const add = (k: string, x = 1) => { c[k] = (c[k] ?? 0) + x; };
for (let g = 0; g < G; g++) {
  const st = playGame(n, 1000003 * n + g * 7919, skill, undefined, (s) => { last = s; });
  if (st.winner === "V") v++;
  const s = last!;
  add("teer kaman", st.tkHit + st.tkMiss); add("tk hit", st.tkHit); add("dal badal", st.dalBadal);
  for (const e of s.events) {
    const d = (e.data ?? {}) as { changed?: boolean; talk?: { t: string; emoji?: string } };
    if (e.type === "ballot" && d.changed) add("vote changed");
    if (e.type === "say" && d.talk) add(d.talk.t === "react" ? `react ${d.talk.emoji}` : d.talk.t);
    if (e.type === "whisper_seen") add("whisper");
  }
}
const per = (k: string) => ((c[k] ?? 0) / G).toFixed(1);
console.log(`${process.env.BRAIN_HABITS === "0" ? "clean " : "habits"} ${table.padEnd(7)} ${n}p village ${((100 * v) / G).toFixed(0)}% | per game: accuse ${per("accuse")} vouch ${per("vouch")} claim ${per("claim")} react ${(Object.entries(c).filter(([k]) => k.startsWith("react")).reduce((a, [, x]) => a + x, 0) / G).toFixed(1)} stone ${per("stone")} | votes changed ${per("vote changed")} | TK ${per("teer kaman")} (hit ${per("tk hit")}) DB ${per("dal badal")}`);
