// TELLS (designer 2026-10-13: "every behaviour of a bot must be scored — playing Bhukamp, Hera Pheri, what not —
// every behaviour must generate tells that leak information"). The research behind it:
//   · DeepRole (Avalon, NeurIPS 2019) and the AIWolf agents (Werewolf) weigh EVERY observed action by how likely each
//     side is to take it — a behaviour model learned from game logs, not hand-picked rules.
//   · Mafia players read three families of tell: what you DO on your turn (who stops playing), whom you AIM at (a thief
//     steals from the Stone holder, a villager reads the suspect), and SILENCE where a villager would speak (a read you
//     never talk about). Vote-count analysis (who votes with whom) is in deduce.ts already.
// Every public action becomes a Tell here. The odds for each come from thousands of bot games
// (scripts/tells-learn.mts → tells.json), clamped so one tell never decides a game. deduce.ts and the casual bots'
// belief both read them. Public events only: a tell is something the whole table saw.
import type { GameEvent } from "@/engine/types";
import LEARNED from "./tells.json";

export type Tell =
  /** a choice among outcomes (what this player did on their turn; whether they spoke after a Kundli) */
  | { kind: "outcome"; group: string; key: string; actor: number }
  /** a choice of TARGET among `cands`: does this side aim at thieves or villagers? */
  | { kind: "aim"; card: string; actor: number; target: number; cands: number[] };

const num = (d: Record<string, unknown> | undefined, k: string) => (typeof d?.[k] === "number" ? (d[k] as number) : null);

/** a claim with something the table saw behind it (a Kundli between them, an exit the speaker caused) */
const backed = (events: GameEvent[], a: number, t: number, before: number) => events.some((e) => e.n < before && (
  (e.type === "kundli" && ((e.data?.seat === a && e.data?.target === t) || (e.data?.seat === t && e.data?.target === a)))
  || (e.type === "eliminated" && e.data?.seat === t && e.data?.killer === a)));

/** every tell in a log, as the table saw it. `n` = seats. */
export function tellsOf(events: GameEvent[], n: number): Tell[] {
  const pub = events.filter((e) => e.to === "all");
  const out: Tell[] = [];
  const alive = new Set(Array.from({ length: n }, (_, i) => i));
  const stoneSaid = new Map<number, boolean>(); // the latest public word on who holds a Stone
  const accused = new Set<number>();            // a backed "is a thief" said about them
  const turnOf = new Map<number, number>();     // seat → index of its open turn
  for (let i = 0; i < pub.length; i++) {
    const e = pub[i], d = e.data, a = num(d, "seat"), t = num(d, "target");
    switch (e.type) {
      case "pickup": if (a !== null && alive.has(a)) turnOf.set(a, i); break;
      case "pass": if (a !== null && turnOf.has(a)) { out.push({ kind: "outcome", group: "turn", key: "pass", actor: a }); turnOf.delete(a); } break;
      case "play": {
        if (a === null || !turnOf.has(a)) break;
        turnOf.delete(a);
        const card = String(d?.card);
        let ctx = "";
        if (card === "HERA_PHERI" && t !== null) ctx = stoneSaid.get(t) ? ":stone" : "";
        if (card === "FAISLA") ctx = [...accused].some((x) => alive.has(x) && x !== a) ? ":suspect" : ":nobody";
        if (card === "TEER_KAMAN" && t !== null) ctx = accused.has(t) ? ":backed" : ":blind";
        if (card === "TALASHI" && t !== null) ctx = stoneSaid.has(t) ? ":again" : "";
        out.push({ kind: "outcome", group: "turn", key: `play:${card}${ctx}`, actor: a });
        if (t !== null && ["KUNDLI", "TALASHI", "HERA_PHERI", "TEER_KAMAN"].includes(card))
          out.push({ kind: "aim", card, actor: a, target: t, cands: [...alive].filter((x) => x !== a) });
        break;
      }
      case "kundli": {
        // MUTUAL KUNDLI: both saw a role. Did each of them say anything about the other before their next turn or the
        // next vote? A villager who read a thief nearly always speaks; silence is a choice. (Judged only once the
        // window has closed — an open window says nothing yet.)
        if (a === null || t === null) break;
        for (const [who, other, group] of [[a, t, "kundli_reader"], [t, a, "kundli_read"]] as const) {
          let said = false, closed = false;
          for (let j = i + 1; j < pub.length; j++) {
            const x = pub[j];
            if (x.type === "claim" && x.data?.seat === who && x.data?.target === other) { said = true; break; }
            if ((x.type === "pickup" && x.data?.seat === who) || x.type === "vote_result" || x.type === "over") { closed = true; break; }
          }
          if (said || closed) out.push({ kind: "outcome", group, key: said ? "said" : "silent", actor: who });
        }
        break;
      }
      case "claim":
        if (t === null) break;
        if (d?.kind === "stone") stoneSaid.set(t, d?.has === true);
        else if (d?.side === "T" && a !== null && backed(pub, a, t, e.n)) accused.add(t);
        break;
      case "eliminated": if (a !== null) alive.delete(a); break;
      case "dal_badal": for (const x of (d?.seats as number[]) ?? []) accused.delete(x); break;
    }
  }
  return out;
}

export interface TellOdds {
  /** group → key → [P(key | thief), P(key | villager)] */
  outcome: Record<string, Record<string, [number, number]>>;
  /** card → [lean of a THIEF toward a thief target, lean of a VILLAGER toward a thief target] (1 = no lean) */
  aim: Record<string, [number, number]>;
}
export const TELLS = LEARNED as unknown as TellOdds;

/** one tell can move the odds at most this far either way (bots learned from bots; people differ) */
export const TELL_CAP = 2;
export const clampLR = (x: number) => Math.min(TELL_CAP, Math.max(1 / TELL_CAP, x));
