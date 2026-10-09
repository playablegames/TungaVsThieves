// Bots "hear" captions (designer 2026-10-09: build what was left — bots can't hear voice). When a player's live
// caption plainly accuses, vouches for, or names the role of ONE other living player, the bots get the same claim a
// 🫵 / 🤝 / 🔮 tap would give them. Anything unclear — no name, two names, no keyword — is ignored: a bot that
// mishears is worse than a bot that didn't hear. Plain word rules, no AI.
import { THIEF_ROLES } from "@/engine/setup";
import type { Side } from "@/engine/types";

export interface Heard { kind: "accuse" | "trust" | "kundli" | "stone"; target: number; role?: string; side: Side | null; has?: boolean }

const ACCUSE = /\b(thief|thieves|chor|liar|lying|lies|sus|suspicious|fake|don'?t trust|do not trust|can'?t trust)\b/;
const TRUST = /\b(trust|innocent|villager|with the village|clean|not (a |the )?(thief|chor)|is good|vouch)\b/;
const NEGATED_TRUST = /\b(don'?t|do not|can'?t|never) trust\b/;

const firstName = (name: string) => name.replace(/\s*🤖$/, "").trim().split(/\s+/)[0].toLowerCase();
const word = (w: string) => new RegExp(`(^|[^\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}])`, "iu");

/** `players`: name + alive per seat. Returns the one claim the sentence makes, or null. */
export function hear(text: string, speaker: number, players: { name: string; alive: boolean }[], rolesInPlay: string[]): Heard | null {
  const t = text.toLowerCase();
  const named = players
    .map((p, seat) => ({ seat, p }))
    .filter(({ seat, p }) => seat !== speaker && p.alive && firstName(p.name).length > 1 && word(firstName(p.name)).test(t));
  if (named.length !== 1) return null;
  const target = named[0].seat;
  // a role named out loud ("I read Vik — Lootera") — longest names first so "Chhota Chor" wins over "Chor"
  const role = [...rolesInPlay].sort((a, b) => b.length - a.length).find((r) => word(r.toLowerCase()).test(t));
  if (role) return { kind: "kundli", target, role, side: THIEF_ROLES.includes(role) ? "T" : "V" };
  // "Vik has a Stone" / "Vik has no Stone" / "doesn't have a stone"
  if (/\bstones?\b/.test(t)) {
    const none = /\b(no|not|doesn'?t have|does not have|hasn'?t got|without)\b/.test(t);
    if (/\b(has|have|got|holds?|holding|carrying)\b/.test(t) || none) return { kind: "stone", target, side: null, has: !none };
  }
  if (NEGATED_TRUST.test(t)) return { kind: "accuse", target, side: "T" };
  if (/\bnot (a |the )?(thief|chor)\b/.test(t)) return { kind: "trust", target, side: "V" };
  if (ACCUSE.test(t)) return { kind: "accuse", target, side: "T" };
  if (TRUST.test(t)) return { kind: "trust", target, side: "V" };
  return null;
}
