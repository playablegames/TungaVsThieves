// PERSONALITIES (2026-10-13, from 39 real games — Aditya, Chilyy, Vj, Pallavi): people don't differ only in how well
// they play but in HOW — Aditya sits on a Stone (skipped 6 of 8 pairs holding one), keeps his Kundli reads to himself
// and votes villagers out as a thief 10 times in 11; Chilyy plays nearly every pair and says what she saw. So a bot is
// a SKILL (casual · average · sharp: how well it reads the table) and a PERSONALITY (how it behaves), set apart:
//   open      — the Open Book: plays every pair, says what it saw, trusts readily
//   quiet     — the Quiet One: sits on a Stone, says less, bluffs — even as a villager
//   hothead   — accuses first, calls Faislas, follows the loudest voice, wrong out loud
//   detective — slow and careful: acts on evidence, holds back its vote's anger
// Each one only moves knobs the bots already have (belief.ts Skill), so every skill × personality is a legal bot.
import type { Skill } from "./belief";

export type Personality = "open" | "quiet" | "hothead" | "detective";

export const PERSONALITIES: Record<Personality, Partial<Skill>> = {
  open: { activity: 0.95, stoneSit: 0.3, claimRate: 1, lie: 0.5, bluff: 0.05, hunchTalk: 0.2, memory: 0.85, temper: 0.08, tkConfidence: 0.75 },
  quiet: { activity: 0.9, stoneSit: 0.75, claimRate: 0.6, lie: 0.85, bluff: 0.35, hunchTalk: 0.1, memory: 0.9, temper: 0.06, tkConfidence: 0.88 },
  hothead: { activity: 1, stoneSit: 0.25, claimRate: 1, lie: 0.7, bluff: 0.15, hunchTalk: 0.6, followAnyAccusation: true, faislaDiscipline: 0.4, memory: 0.7, temper: 0.15, tkConfidence: 0.65 },
  detective: { activity: 0.92, stoneSit: 0.5, claimRate: 0.9, lie: 0.6, bluff: 0.1, hunchTalk: 0.05, followAnyAccusation: false, faislaDiscipline: 1, memory: 1, temper: 0.03, tkConfidence: 0.88 },
};

/** a skill played with a personality (the skill's name stays — it still decides what the bot can read) */
export function personalised(skill: Skill, p: Personality | string | undefined): Skill {
  const traits = p && p in PERSONALITIES ? PERSONALITIES[p as Personality] : {};
  return { ...skill, ...traits, personality: (p as Personality) ?? undefined, name: skill.name };
}

/** a bot's personality is fixed by its name (Babu Rao is always the same Babu Rao) */
export function personalityOf(name: string): Personality {
  let h = 0;
  for (const ch of name.replace(/\s*🤖$/, "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (["open", "quiet", "hothead", "detective"] as const)[h % 4];
}
