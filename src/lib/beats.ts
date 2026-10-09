// The Table Stage: every public play becomes a BEAT that every phone shows at the same moment —
// the way a real table sees the pair hit the felt and settles it together. Pure, shared by the
// server (to hold the clock while a beat plays) and the phones (to play the beats in order).
import type { ActionCard, Card, GameEvent } from "@/engine/types";

/** marigold vote · crimson lethal · jade relic · gold Bhukamp · neutral (DESIGN.md button voices) */
export type Tone = "vote" | "lethal" | "relic" | "gold" | "neutral";

export interface Beat {
  n: number;              // the event that made it — beats play in event order
  type: string;           // the engine event type
  title: string;          // the line the whole table reads
  detail?: string;        // a second line (the result, the hand, the private truth)
  card?: ActionCard;      // the pair that was played, face up
  actor?: number;         // seat that acted (arrow from)
  target?: number;        // seat it hit (arrow to)
  result?: "hit" | "miss" | "out" | "saved" | "none";
  cards?: Card[];         // cards shown face up (Talashi, an eliminated hand)
  tally?: Record<string, number>;          // vote_result: votes per seat
  ballots?: Record<string, number | null>; // vote_result: who voted whom (null = abstained)
  lastWords?: boolean;    // eliminated: a human gets 10 s of last words before the ejection
  tone: Tone;
  big: boolean;           // big beats take the stage; small ones are a ticker line
  hold: number;           // ms the table watches it before the next beat / before any clock runs
  private: boolean;       // only this phone sees it (Kundli truth, what Hera Pheri took)
}

/** THE PACE DIAL (designer 2026-10-09, "game is too fast, need to be slow"): every beat, the catch-up and the bots'
 *  turns scale with it. 1 = the 2026-10-07 pace. */
export const PACE = 1.5;
// playtest 2026-10-07 ("the game is running too fast"): every beat held ~50% longer — and again 2026-10-09 (PACE)
const BIG = Math.round(3800 * PACE);
const SMALL = Math.round(1800 * PACE);
/** the most the server holds a clock for the beats of one move */
/** last words (10 s) + the ejection fit inside one hold */
export const HOLD_CAP = Math.round(18000 * PACE);
export const LAST_WORDS_MS = 10_000;

/** events the stage never shows: bookkeeping, analytics, and things the end screen tells better */
const SKIP = new Set(["setup", "role", "pickup", "pickup_private", "conduit", "reshuffle", "batwara_done",
  "reveal", "play", "analytics_deal", "analytics_turn", "batwara_private", "batwara_pile"]);

type D = Record<string, unknown>;
const num = (d: D | undefined, k: string) => (typeof d?.[k] === "number" ? (d[k] as number) : undefined);

/** Voice carries the table; the screen only takes over for the climaxes — and for what only you may see.
 * Every other play is one line in the centre ("last declaration"). */
// (2026-10-09) Talashi is private now: the table sees who was searched, the searcher sees the cards (a private beat)
const STAGE = new Set(["surrender_open", "surrender", "surrender_result", "faisla", "talashi", "ballots_open", "final_vote", "vote_result", "eliminated", "dal_badal", "to_village", "over"]);

/** One event → one beat, or null when the table needn't stop for it. `names[seat]` = player name. */
export function beatFor(e: GameEvent, names: string[]): Beat | null {
  const b = rawBeat(e, names);
  if (b) b.big = STAGE.has(b.type) || b.private;
  return b;
}

function rawBeat(e: GameEvent, names: string[]): Beat | null {
  if (Array.isArray(e.to) && e.to.length === 0) return null; // analytics: server only
  if (SKIP.has(e.type)) return null;
  const d = e.data;
  const nm = (seat: number | undefined) => (seat === undefined ? "?" : names[seat] ?? "?");
  const actor = num(d, "seat"), target = num(d, "target");
  const priv = e.to !== "all";
  const base = { n: e.n, type: e.type, actor, target, private: priv };
  switch (e.type) {
    case "pass":
      return { ...base, title: `${nm(actor)} plays nothing`, detail: "Three cards go on face down.", tone: "neutral", big: false, hold: SMALL };
    case "kundli":
      return { ...base, card: "KUNDLI", title: `${nm(actor)} reads ${nm(target)}'s Kundli`, tone: "relic", big: true, hold: BIG };
    case "kundli_private":
      return { ...base, card: "KUNDLI", title: `${nm(target)} is ${String(d?.role)}`, detail: d?.side === "T" ? "A thief." : "A villager.", tone: "relic", big: true, hold: BIG };
    case "talashi":
      return { ...base, card: "TALASHI", title: `${nm(actor)} searches ${nm(target)}`, detail: "Only they see the cards.", tone: "relic", big: true, hold: BIG };
    case "talashi_private":
      return { ...base, card: "TALASHI", title: `${nm(target)} holds`, cards: (d?.hand as Card[]) ?? [], tone: "relic", big: true, hold: BIG + 800 };
    case "hera_pheri":
      return { ...base, card: "HERA_PHERI", title: `${nm(actor)} steals from ${nm(target)}`, detail: `${num(d, "k") ?? 2} cards, face down. ${nm(target)} draws back up.`, tone: "lethal", big: true, hold: BIG };
    case "hera_pheri_private":
      return { ...base, card: "HERA_PHERI", title: "What moved", detail: e.msg, tone: "lethal", big: false, hold: SMALL };
    case "batwara":
      return { ...base, card: "BATWARA", title: `Bhukamp — ${nm(actor)} shakes the table`, detail: "Everyone passes one card to the next player, clockwise.", tone: "gold", big: true, hold: BIG };
    case "teer_kaman": {
      const roles = (d?.roles as string[]) ?? [];
      const hit = d?.hit === true;
      return { ...base, card: "TEER_KAMAN", title: `${nm(actor)} shoots at ${nm(target)}`, detail: `${roles.join(" or ")} — ${hit ? "HIT" : "miss"}`, result: hit ? "hit" : "miss", tone: "lethal", big: true, hold: BIG + 600 };
    }
    case "faisla":
      return { ...base, card: "FAISLA", title: `${nm(actor)} calls a Faisla`, tone: "vote", big: true, hold: BIG };
    case "away":
    case "back":
      return { ...base, title: e.msg, tone: "neutral", big: false, hold: SMALL };
    case "floor_extended":
      return { ...base, title: "30 more seconds", detail: "The host keeps the floor open.", tone: "vote", big: false, hold: 1100 };
    case "ballots_open":
      return { ...base, title: "The floor closes", detail: "Vote now — every vote shows on the table as it is cast.", tone: "vote", big: true, hold: 1600 };
    case "final_vote":
      return { ...base, title: "The last round is over", detail: "Mandatory vote — talk, then vote.", tone: "vote", big: true, hold: BIG };
    case "vote_result": {
      const out = num(d, "out");
      return { ...base, target: out, title: out === undefined || d?.out === null ? "Nobody is out" : `${nm(out)} is voted out`, detail: out === undefined || d?.out === null ? "The vote was tied or empty." : undefined, result: d?.out === null ? "none" : "out", tally: (d?.tally as Record<string, number>) ?? {}, ballots: (d?.ballots as Record<string, number | null>) ?? {}, tone: "vote", big: true, hold: BIG + 1500 };
    }
    case "eliminated":
      // (2026-10-09) roles are never shown to the table — only "out", and the hand they held
      if (d?.side === undefined)
        return { ...base, actor: num(d, "killer") ?? undefined, target: actor, title: `${nm(actor)} is out`, detail: "Their role stays hidden.", cards: (d?.hand as Card[]) ?? [], result: "out", tone: "lethal", big: true, hold: BIG + 800 + (d?.lastWords ? LAST_WORDS_MS : 0), lastWords: Boolean(d?.lastWords) };
      return { ...base, actor: num(d, "killer") ?? undefined, target: actor, title: `${nm(actor)} was ${String(d?.role)}`, detail: d?.side === "T" ? "A thief." : "A villager.", cards: (d?.hand as Card[]) ?? [], result: "out", tone: d?.side === "T" ? "relic" : "lethal", big: true, hold: BIG + 800 + (d?.lastWords ? LAST_WORDS_MS : 0), lastWords: Boolean(d?.lastWords) };
    case "eliminated_private":
      // only the Teer Kaman shooter or the Faisla caller sees the role
      return { ...base, target: actor, title: `${nm(actor)} was ${String(d?.role)}`, detail: d?.side === "T" ? "A thief. Only you know." : "A villager. Only you know.", tone: d?.side === "T" ? "relic" : "lethal", big: true, hold: BIG };
    case "dal_badal": {
      const others = ((d?.seats as number[]) ?? []).filter((x) => x !== actor).map((x) => nm(x));
      return { ...base, title: `Dal Badal — ${nm(actor)} is ${String(d?.role)}!`, detail: `A thief. Role cards shuffled with ${others.join(" and ")} — each picks one back, face down.`, tone: "lethal", big: true, hold: BIG + 800 };
    }
    case "dal_badal_done":
      return { ...base, title: `Dal Badal is done — ${nm(actor)} draws 1`, tone: "neutral", big: false, hold: SMALL };
    case "gift":
      return { ...base, title: target === undefined || d?.target === null ? `${nm(actor)} gives the vote to nobody` : `${nm(actor)} gives a vote to ${nm(target)}`, tone: "vote", big: false, hold: SMALL };
    case "handoff":
      return { ...base, title: `${nm(actor)} hands everything to ${nm(target)}`, cards: (d?.cards as Card[]) ?? [], tone: "neutral", big: true, hold: BIG - 600 };
    case "to_village":
      return { ...base, title: `${nm(actor)}'s cards go to the village`, detail: "The mandatory vote is the village's — nothing is handed to anyone. A Stone here counts for Tunga.", cards: (d?.cards as Card[]) ?? [], tone: "vote", big: true, hold: BIG };
    case "floor":
      return { ...base, title: e.msg, tone: "vote", big: false, hold: 600 };
    case "whisper":
      return { ...base, title: e.msg, tone: "neutral", big: false, hold: 900 };
    case "whisper_private":
      return { ...base, title: e.msg, tone: "relic", big: false, hold: 900 };
    case "claim":
      return { ...base, title: e.msg, tone: d?.side === "T" ? "lethal" : "vote", big: false, hold: 2200 };
    case "timeout":
      return { ...base, title: "Time ran out", detail: "The default was played for anyone still deciding.", tone: "neutral", big: false, hold: SMALL };
    case "surrender_open":
      return { ...base, title: "Surrender the Stones?", detail: "Two with the village — Tunga wins. None — Thieves win. One — the vote decides.", tone: "vote", big: true, hold: BIG };
    case "surrender":
      return { ...base, title: e.msg.replace(/\.$/, ""), cards: (d?.cards as Card[]) ?? [], tone: "vote", big: true, hold: BIG };
    case "surrender_result": {
      const k = num(d, "count") ?? 0;
      return { ...base, title: `${k} Stone${k === 1 ? "" : "s"} with the village`, detail: k >= 2 ? "Tunga wins." : k === 0 ? "Thieves win." : "The mandatory vote decides the other.", tone: k === 0 ? "lethal" : "vote", big: true, hold: BIG };
    }
    case "over":
      return { ...base, title: d?.winner === "V" ? "Tunga wins" : "Thieves win", detail: String(d?.reason ?? ""), tone: d?.winner === "V" ? "vote" : "lethal", big: true, hold: BIG };
    default:
      // a new engine event nobody mapped yet: show its text rather than lose it
      return { ...base, title: e.msg, tone: "neutral", big: false, hold: SMALL };
  }
}

/** Beats for a run of events, in order. */
export function beatsFor(events: GameEvent[], names: string[]): Beat[] {
  const out: Beat[] = [];
  for (const e of events) { const b = beatFor(e, names); if (b) out.push(b); }
  return out;
}

/** How long the table needs to watch these events — the server holds every clock this long (capped). */
export function holdFor(events: GameEvent[], names: string[]): number {
  const total = beatsFor(events.filter((e) => e.to === "all"), names).reduce((t, b) => t + b.hold, 0);
  return Math.min(total, HOLD_CAP);
}
