// HOW SHARP ARE THE BOTS? at the final vote, for each villager bot: P(thief) it gives real thieves vs villagers,
// and how often its top suspect is a real thief (vs random)
import { playGame, SKILLS, type SkillName } from "../src/rules/brain";
const G = Number(process.argv[2] ?? 100), sk = (process.argv[3] ?? "average") as SkillName;
for (const n of [5, 8, 12]) {
  let pt = 0, nt = 0, pv = 0, nv = 0, topT = 0, tops = 0, rnd = 0, abst = 0, votes = 0, votesT = 0;
  for (let g = 0; g < G; g++) {
    let done = false;
    playGame(n, 9000000 + n * 1000 + g, SKILLS[sk], (s, bots) => {
      if (done || s.phase.kind !== "vote" || !s.phase.final) return;
      done = true;
      const alive = s.players.filter((p) => p.alive);
      for (const b of bots) {
        if (!s.players[b.seat].alive || b.side(s) !== "V") continue;
        const p = b.p(s), o = alive.filter((x) => x.seat !== b.seat);
        for (const x of o) if (x.side === "T") { pt += p[x.seat]; nt++; } else { pv += p[x.seat]; nv++; }
        const top = o.reduce((a, c) => (p[c.seat] > p[a.seat] ? c : a), o[0]);
        tops++; if (top.side === "T") topT++;
        rnd += o.filter((x) => x.side === "T").length / o.length;
      }
    });
  }
  console.log(`${n}p: villager bots' P(thief) on real thieves ${(pt / nt).toFixed(2)} vs villagers ${(pv / nv).toFixed(2)} · top suspect is a thief ${Math.round(100 * topT / tops)}% (random ${Math.round(100 * rnd / tops)}%)`);
}
