// the FINAL VOTE ballots: who abstains, who votes on whom, how split the village is
import { playGame, SKILLS } from "../src/rules/brain";
const G = 150;
for (const n of [5, 8, 12]) {
  const c = { vAb: 0, vT: 0, vV: 0, tAb: 0, tT: 0, tV: 0 }; let distinct = 0, finals = 0;
  for (let g = 0; g < G; g++) {
    playGame(n, 7000000 + n * 1000 + g, SKILLS.average, (s) => {
      const ph = s.phase; if (ph.kind !== "vote" || !ph.final) return;
      const alive = s.players.filter((p) => p.alive);
      if (Object.keys(ph.ballots).length !== alive.length - 1) return; // last ballot about to be cast: count the rest
      finals++;
      const vTargets = new Set<number>();
      for (const [k, b] of Object.entries(ph.ballots)) {
        const me = s.players[+k].side, t = b.for === null ? null : s.players[b.for].side;
        if (me === "V") { if (t === null) c.vAb++; else { vTargets.add(b.for!); t === "T" ? c.vT++ : c.vV++; } }
        else { if (t === null) c.tAb++; else t === "T" ? c.tT++ : c.tV++; }
      }
      distinct += vTargets.size;
    });
  }
  const vt = c.vAb + c.vT + c.vV, tt = c.tAb + c.tT + c.tV;
  console.log(`${n}p villagers: abstain ${Math.round(100 * c.vAb / vt)}% · on a thief ${Math.round(100 * c.vT / vt)}% · on a villager ${Math.round(100 * c.vV / vt)}% · ${(distinct / finals).toFixed(1)} different targets | thieves: abstain ${Math.round(100 * c.tAb / tt)}% · on a villager ${Math.round(100 * c.tV / tt)}% · on a thief ${Math.round(100 * c.tT / tt)}%`);
}
