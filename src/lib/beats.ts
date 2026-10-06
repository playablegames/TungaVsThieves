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
  tone: Tone;
  big: boolean;           // big beats take the stage; small ones are a ticker line
  hold: number;           // ms the table watches it before the next beat / before any clock runs
  private: boolean;       // only this phone sees it (Kundli truth, what Hera Pheri took)
}

const BIG = 2600;
const SMALL = 1100;

/** events the stage never shows: bookkeeping, analytics, and things the end screen tells better */
const SKIP = new Set(["setup", "role", "pickup", "pickup_private", "conduit", "reshuffle", "batwara_done",
  "reveal", "play", "analytics_deal", "analytics_turn", "batwara_private"]);

type D = Record<string, unknown>;
const num = (d: D | undefined, k: string) => (typeof d?.[k] === "number" ? (d[k] as number) : undefined);

/** One event → one beat, or null when the table needn't stop for it. `names[seat]` = player name. */
export function beatFor(e: GameEvent, names: string[]): Beat | null {
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
      return { ...base, card: "KUNDLI", title: `${nm(actor)} reads ${nm(target)}'s Kundli`, detail: "Only they saw it. They may tell you — or lie.", tone: "relic", big: true, hold: BIG };
    case "kundli_private":
      return { ...base, card: "KUNDLI", title: `${nm(target)} is ${String(d?.role)}`, detail: d?.side === "T" ? "A thief. Only you know." : "A villager. Only you know.", tone: "relic", big: true, hold: BIG };
    case "talashi":
      return { ...base, card: "TALASHI", title: `Talashi on ${nm(target)}`, detail: "Every card, face up — never the role.", cards: (d?.hand as Card[]) ?? [], tone: "relic", big: true, hold: BIG + 800 };
    case "hera_pheri":
      return { ...base, card: "HERA_PHERI", title: `${nm(actor)} steals from ${nm(target)}`, detail: `${num(d, "k") ?? 2} cards, face down. ${nm(target)} draws back up.`, tone: "lethal", big: true, hold: BIG };
    case "hera_pheri_private":
      return { ...base, card: "HERA_PHERI", title: "What moved", detail: e.msg, tone: "lethal", big: false, hold: SMALL };
    case "batwara":
      return { ...base, card: "BATWARA", title: `Bhukamp — ${nm(actor)} splits the table`, detail: "Everyone else: one card left, one card right.", tone: "gold", big: true, hold: BIG };
    case "maya_jaal":
      return { ...base, card: "MAYA_JAAL", title: `${nm(target)} is back`, detail: `${nm(actor)} turns back time.`, tone: "relic", big: true, hold: BIG };
    case "teer_kaman": {
      const roles = (d?.roles as string[]) ?? [];
      const hit = d?.hit === true;
      return { ...base, card: "TEER_KAMAN", title: `${nm(actor)} shoots at ${nm(target)}`, detail: `${roles.join(" or ")} — ${hit ? "HIT" : "miss"}`, result: hit ? "hit" : "miss", tone: "lethal", big: true, hold: BIG + 600 };
    }
    case "vote_lost":
      return { ...base, title: `${nm(actor)} loses a vote for good`, tone: "lethal", big: false, hold: SMALL };
    case "faisla":
      return { ...base, card: "FAISLA", title: `${nm(actor)} calls a Faisla`, detail: "The floor is open — accuse, defend, claim. Then everyone votes.", tone: "vote", big: true, hold: BIG };
    case "away":
    case "back":
      return { ...base, title: e.msg, tone: "neutral", big: false, hold: SMALL };
    case "floor_extended":
      return { ...base, title: "30 more seconds", detail: "The host keeps the floor open.", tone: "vote", big: false, hold: 1100 };
    case "ballots_open":
      return { ...base, title: "The floor closes", detail: "Vote now — the seals stay hidden until everyone has voted.", tone: "vote", big: true, hold: 1600 };
    case "final_vote":
      return { ...base, title: "The last round is over", detail: "Mandatory vote — talk, then vote.", tone: "vote", big: true, hold: BIG };
    case "vote_result": {
      const out = num(d, "out");
      return { ...base, target: out, title: out === undefined || d?.out === null ? "Nobody is out" : `${nm(out)} is voted out`, detail: out === undefined || d?.out === null ? "The vote was tied or empty." : undefined, result: d?.out === null ? "none" : "out", tone: "vote", big: true, hold: BIG };
    }
    case "eliminated":
      return { ...base, actor: num(d, "killer") ?? undefined, target: actor, title: `${nm(actor)} was ${String(d?.role)}`, detail: d?.side === "T" ? "A thief." : "A villager.", cards: (d?.hand as Card[]) ?? [], result: "out", tone: d?.side === "T" ? "relic" : "lethal", big: true, hold: BIG + 800 };
    case "dal_badal":
      return { ...base, title: `Dal Badal — ${nm(num(d, "a"))} and ${nm(num(d, "b"))} swap roles`, detail: "They know their new side. You don't.", tone: "lethal", big: true, hold: BIG };
    case "gift":
      return { ...base, title: target === undefined || d?.target === null ? `${nm(actor)} gives the vote to nobody` : `${nm(actor)} gives a vote to ${nm(target)}`, tone: "vote", big: false, hold: SMALL };
    case "last_shot": {
      if (d?.target === null || target === undefined) return { ...base, title: `${nm(actor)} takes no last shot`, tone: "neutral", big: false, hold: SMALL };
      const roles = (d?.roles as string[]) ?? [];
      const hit = d?.hit === true;
      return { ...base, title: `${nm(actor)}'s last shot at ${nm(target)}`, detail: `${roles.join(" or ")} — ${hit ? "HIT" : "miss"}`, result: hit ? "hit" : "miss", tone: "lethal", big: true, hold: BIG };
    }
    case "handoff":
      return { ...base, title: `${nm(actor)} hands everything to ${nm(target)}`, cards: (d?.cards as Card[]) ?? [], tone: "neutral", big: true, hold: BIG - 600 };
    case "timeout":
      return { ...base, title: "Time ran out", detail: "The default was played for anyone still deciding.", tone: "neutral", big: false, hold: SMALL };
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
  return Math.min(total, 9000);
}
