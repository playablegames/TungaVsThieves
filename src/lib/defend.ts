// DEFEND YOURSELF (designer 2026-10-13 evening: "no option to defend when blaming" → both): a player accused out loud —
// a thief role named, or "has a Stone" — gets an answer on their phone: the floor to speak for 15 s, or a quick line
// ("I am Kisaan" · "I have no Stone" · "Raju is lying"). Pure: the server checks it, the phone shows it.
import type { GameEvent } from "@/engine/types";

export type DefendKind = "floor" | "role" | "nostone" | "liar";
export interface Accusation { n: number; accuser: number; stone: boolean; role: string | null }

/** the newest loud accusation against `seat` they haven't answered yet — anything they said since, or the vote
 *  opening, closes it (the same "answer" the bots wait for: server/deduce.ts unanswered) */
export function openAccusation(events: GameEvent[], seat: number): Accusation | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i], d = e.data;
    if (e.type === "ballots_open" || e.type === "over") return null;
    if ((e.type === "claim" || e.type === "defend" || e.type === "floor") && d?.seat === seat) return null;
    if (e.type === "claim" && e.to === "all" && d?.target === seat && d?.seat !== seat) {
      const stone = d?.kind === "stone";
      if (stone ? d?.has === true : d?.side === "T") return { n: e.n, accuser: d?.seat as number, stone, role: stone ? null : String(d?.role ?? "") || null };
    }
  }
  return null;
}
