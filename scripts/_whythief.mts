// WHY DO THIEVES WIN (analysis only): per game, where the Stones were at the end and how they got to thieves;
// what each side did on its turns. Run with and without BOT_FLAGS=old-brain.
import { SKILLS } from "@/server/belief";
import { PERSONALITIES, personalised } from "@/server/personality";
import { playTable } from "@/server/simtable";
import { isStone, type Card } from "@/engine/types";
let seed = 21; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const SK = [SKILLS.average, SKILLS.casual, SKILLS.sharp], PS = Object.keys(PERSONALITIES);
const n = Number(process.argv[2] ?? 8), G = Number(process.argv[3] ?? 120);
const c = { vWin: 0, stoneStartT: 0, hpStoneToT: 0, hpStoneToV: 0, bhuStoneToT: 0, passStoneToT: 0, elimStoneToT: 0, faislaOutT: 0, faislaOutV: 0, finalOutT: 0, finalOutV: 0, finalOutHolder: 0,
  turnsV: 0, playsV: 0, turnsT: 0, playsT: 0, tkV: 0, tkHitV: 0, kundliV: 0, talashiT: 0, hpT: 0, hpV: 0, endThiefHolds: 0 };
for (let g = 0; g < G; g++) {
  const s = playTable(n, 400_000 + 1000 * n + g, rnd, { skillOf: (x) => personalised(SK[(x + g) % 3], PS[(x + 3 * g) % 4]) });
  if (s.phase.kind === "over" && s.phase.winner === "V") c.vWin++;
  const side = (x: number) => s.players[x].side;
  const deal = s.events.find((e) => e.type === "analytics_deal");
  let hp: { seat: number; target: number } | null = null;
  for (const e of s.events) {
    const d = e.data;
    if (e.type === "pass") { if (side(d!.seat as number) === "V") c.turnsV++; else c.turnsT++; }
    if (e.type === "play") { const x = d!.seat as number; if (side(x) === "V") { c.turnsV++; c.playsV++; if (d!.card === "KUNDLI") c.kundliV++; if (d!.card === "HERA_PHERI") c.hpV++; } else { c.turnsT++; c.playsT++; if (d!.card === "TALASHI") c.talashiT++; if (d!.card === "HERA_PHERI") c.hpT++; } }
    if (e.type === "teer_kaman" && side(d!.seat as number) === "V") { c.tkV++; if (d!.hit) c.tkHitV++; }
    if (e.type === "hera_pheri") hp = { seat: d!.seat as number, target: d!.target as number };
    if (e.type === "hera_pheri_private" && hp && ((d!.taken as Card[]) ?? []).some(isStone)) { if (side(hp.seat) === "T") c.hpStoneToT++; else c.hpStoneToV++; }
    if (e.type === "batwara_private" && isStone(d!.card as Card) && side(d!.to as number) === "T" && side(d!.from as number) === "V") c.bhuStoneToT++;
    if (e.type === "pickup_private" && ((d!.cards as Card[]) ?? []).some(isStone) && side((e.to as number[])[0]) === "T") c.passStoneToT++;
    if (e.type === "handoff_private" && ((d!.cards as Card[]) ?? []).some(isStone) && side(d!.target as number) === "T") c.elimStoneToT++;
    if (e.type === "vote_result" && typeof d?.out === "number") {
      const final = s.events.slice(0, e.n).some((x) => x.type === "final_vote");
      const out = d.out as number;
      if (final) { if (side(out) === "T") c.finalOutT++; else c.finalOutV++; } else { if (side(out) === "T") c.faislaOutT++; else c.faislaOutV++; }
    }
  }
  if (s.phase.kind === "over" && s.phase.winner === "T") c.endThiefHolds++;
  void deal;
}
const pct = (a: number, b: number) => `${Math.round((100 * a) / Math.max(1, b))}%`;
console.log(`${n}p ${G} games — village wins ${pct(c.vWin, G)}`);
console.log(`turns with a pair played: villagers ${pct(c.playsV, c.turnsV)} · thieves ${pct(c.playsT, c.turnsT)}`);
console.log(`Stones reaching a thief: picked up from the pass ${c.passStoneToT} · Hera Pheri ${c.hpStoneToT} (villagers took back ${c.hpStoneToV}) · Bhukamp ${c.bhuStoneToT} · cards of an out player ${c.elimStoneToT}`);
console.log(`thief plays per game: Talashi ${(c.talashiT / G).toFixed(1)} · Hera Pheri ${(c.hpT / G).toFixed(1)} | villager: Kundli ${(c.kundliV / G).toFixed(1)} · Hera Pheri ${(c.hpV / G).toFixed(1)} · Teer Kaman ${c.tkV} (hit ${c.tkHitV})`);
console.log(`Faisla put out: thieves ${c.faislaOutT} · villagers ${c.faislaOutV} | mandatory vote put out: thieves ${c.finalOutT} · villagers ${c.finalOutV}`);
