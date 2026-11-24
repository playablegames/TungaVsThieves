// (owner 2026-11-24) DO BOTS KNOW WHERE THE STONES ARE at the final vote? For each living bot: its top Stone guess among
// the others — does that player really hold a Stone? Compared with chance (Stones held by others / others).
//   npx tsx scripts/stone-sense.mts <players> [games=300]      BRAIN_EXP=... to compare with/without W
import { playGame, SKILLS } from "../src/rules/brain";
import { isStone } from "../src/rules/game";
const n = Number(process.argv[2]), G = Number(process.argv[3] ?? 300);
let hit = 0, chance = 0, asked = 0, blank = 0;
for (let g = 0; g < G; g++) {
  let done = false;
  playGame(n, 1000003 * n + g * 7919, (seat) => (seat % 2 ? SKILLS.sharp : SKILLS.casual), (s, bots) => {
    if (done || s.phase.kind !== "vote" || !(s.phase as { final?: boolean }).final) return;
    done = true;
    for (const b of bots) {
      const me = s.players[b.seat]; if (!me.alive) continue;
      const o = s.players.filter((p) => p.alive && p.seat !== b.seat);
      const holds = o.filter((p) => p.hand.some(isStone));
      if (!holds.length) continue;
      asked++; chance += holds.length / o.length;
      const top = o.reduce((a, p) => ((b.stone[p.seat] ?? 0) > (b.stone[a.seat] ?? 0) ? p : a), o[0]);
      if ((b.stone[top.seat] ?? 0) === 0) { blank++; chance -= holds.length / o.length; asked--; continue; }
      if (top.hand.some(isStone)) hit++;
    }
  });
}
console.log(`${n}p  top Stone guess right ${(100 * hit / asked).toFixed(0)}%  (chance ${(100 * chance / asked).toFixed(0)}%)  no guess at all ${(100 * blank / (asked + blank)).toFixed(0)}%`);
