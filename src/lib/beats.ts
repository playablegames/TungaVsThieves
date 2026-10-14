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
  role?: string;          // (2026-10-13) an accusation: the role card it names, shown big
  actor?: number;         // seat that acted (arrow from)
  target?: number;        // seat it hit (arrow to)
  result?: "hit" | "miss" | "out" | "saved" | "none";
  cards?: Card[];         // cards shown face up (Talashi, an eliminated hand)
  /** (designer 2026-10-13 evening: "explanations can be tabular") who → what, one row each */
  rows?: [string, string][];
  /** Dal Badal: the three seats whose role cards were shuffled (the table moment flies a card to each) */
  seats?: number[];
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
// 2026-10-13 (designer, "slow it down a little more so every bit of info is processed — it's unplayable"): 1.5 → 2
// 2026-10-13 evening (designer, "playing is slow, decision is fast, reverse it" · "2 sec for passing, 4 sec for decisions"
// · "every screen skips by itself after 2 s"): back to 1; a pass holds 2 s, a played card 4 s (its moment + 2 s)
// 2026-10-14 (designer, "slow down the game a little, passing 3 secs, decisions 5 secs"): a pass 3 s, a played card 5 s
export const PACE = 1;
const BIG = 5000;
const SMALL = 3000;
/** the most the server holds a clock for the beats of one move */
/** last words (10 s) + the ejection fit inside one hold */
export const HOLD_CAP = Math.round(18000 * PACE);
export const LAST_WORDS_MS = 10_000;

/** events the stage never shows: bookkeeping, analytics, and things the end screen tells better */
const SKIP = new Set(["dal_badal_kept", "setup", "role", "pickup", "pickup_private", "conduit", "reshuffle",
  "reveal", "play", "analytics_deal", "analytics_turn", "batwara_private", "batwara_pile"]);
const cardName = (c: string) => ({ FAISLA: "Faisla", TALASHI: "Talashi", KUNDLI: "Kundli", HERA_PHERI: "Hera Pheri", BATWARA: "Bhukamp",
  TEER_KAMAN: "Teer Kaman", DAL_BADAL: "Dal Badal", MAYA_JAAL: "Maya Jaal" } as Record<string, string>)[c] ?? c;

type D = Record<string, unknown>;
const num = (d: D | undefined, k: string) => (typeof d?.[k] === "number" ? (d[k] as number) : undefined);

/** Voice carries the table; the screen only takes over for the climaxes — and for what only you may see.
 * Every other play is one line in the centre ("last declaration"). */
// (2026-10-09) Talashi is private now: the table sees who was searched, the searcher sees the cards (a private beat)
const STAGE = new Set(["surrender_open", "surrender", "surrender_result", "faisla", "talashi", "ballots_open", "final_vote", "vote_result", "eliminated", "dal_badal", "to_village", "over"]);

/** One event → one beat, or null when the table needn't stop for it. `names[seat]` = player name. */
export function beatFor(e: GameEvent, names: string[], history: GameEvent[] = []): Beat | null {
  const b = rawBeat(e, names, history);
  if (b) b.big = STAGE.has(b.type) || b.private;
  return b;
}

function rawBeat(e: GameEvent, names: string[], history: GameEvent[]): Beat | null {
  if (Array.isArray(e.to) && e.to.length === 0) return null; // analytics: server only
  if (SKIP.has(e.type)) return null;
  const d = e.data;
  // (2026-10-12: short, plain lines) the 🤖 badge belongs on the seat, not in the headline
  const nm = (seat: number | undefined) => (seat === undefined ? "?" : (names[seat] ?? "?").replace(/\s*🤖$/, ""));
  const actor = num(d, "seat"), target = num(d, "target");
  const priv = e.to !== "all";
  const base = { n: e.n, type: e.type, actor, target, private: priv };
  switch (e.type) {
    case "pass":
      return { ...base, title: `${nm(actor)} passed`, detail: "Three cards go on face down.", tone: "neutral", big: false, hold: SMALL };
    // (2026-10-14 play, then pass) the pair's effect is over: the 3 go on, then the player draws back to 2
    case "pass_after":
      return { ...base, title: d?.out ? `${nm(actor)}'s 3 cards go on` : `${nm(actor)} passes 3`, detail: d?.out ? "They go on as the pile." : "Then draws back to 2.", tone: "neutral", big: false, hold: SMALL };
    case "kundli":
      return { ...base, card: "KUNDLI", title: `${nm(actor)} played Kundli on ${nm(target)}`, tone: "relic", big: true, hold: BIG };
    case "kundli_private":
      return { ...base, card: "KUNDLI", role: String(d?.role ?? ""), title: `${nm(target)} is ${String(d?.role)}`, detail: `${d?.side === "T" ? "A thief." : "A villager."} They saw yours too.`, tone: "relic", big: true, hold: BIG };
    case "talashi":
      return { ...base, card: "TALASHI", title: `${nm(actor)} played Talashi on ${nm(target)}`, detail: "Only they see the cards.", tone: "relic", big: true, hold: BIG };
    case "talashi_private":
      return { ...base, card: "TALASHI", title: `${nm(target)} holds`, cards: (d?.hand as Card[]) ?? [], tone: "relic", big: true, hold: BIG };
    case "hera_pheri":
      return { ...base, card: "HERA_PHERI", title: `${nm(actor)} played Hera Pheri on ${nm(target)}`, detail: `${num(d, "k") ?? 2} cards, face down. ${nm(target)} draws back up.`, tone: "lethal", big: true, hold: BIG };
    case "hera_pheri_private":
      return { ...base, card: "HERA_PHERI", title: "What moved", detail: e.msg, tone: "lethal", big: false, hold: SMALL };
    case "batwara":
      return { ...base, card: "BATWARA", title: `${nm(actor)} played Bhukamp`, detail: "Everyone passes one card left and one right.", tone: "gold", big: true, hold: BIG };
    case "teer_kaman": {
      const roles = (d?.roles as string[]) ?? [];
      const hit = d?.hit === true;
      return { ...base, card: "TEER_KAMAN", title: `${nm(actor)} played Teer Kaman on ${nm(target)}`, detail: `${roles.join(" or ")} — ${hit ? "HIT" : "miss"}`, result: hit ? "hit" : "miss", tone: "lethal", big: true, hold: BIG };
    }
    case "faisla":
      return { ...base, card: "FAISLA", title: `${nm(actor)} played Faisla`, tone: "vote", big: true, hold: BIG };
    case "away":
    case "back":
      return { ...base, title: e.msg, tone: "neutral", big: false, hold: SMALL };
    case "floor_extended":
      return { ...base, title: "30 more seconds", detail: "The host keeps the floor open.", tone: "vote", big: false, hold: 1100 };
    case "ballots_open":
      return { ...base, title: "The floor closes", detail: "Vote now — every vote shows on the table as it is cast.", tone: "vote", big: true, hold: 1600 };
    case "final_vote":
      // (designer 2026-10-14) its intro film tells the Stone rules (Cinematic.tsx FinalVote: 180 frames at 0.75 = 8 s)
      return { ...base, title: "The last round is over", detail: "Mandatory vote — talk, then vote.", tone: "vote", big: true, hold: 8400 };
    case "vote_result": {
      const out = num(d, "out");
      return { ...base, target: out, title: out === undefined || d?.out === null ? "Nobody is out" : `${nm(out)} is voted out`, detail: out === undefined || d?.out === null ? "The vote was tied or empty." : undefined, result: d?.out === null ? "none" : "out", tally: (d?.tally as Record<string, number>) ?? {}, ballots: (d?.ballots as Record<string, number | null>) ?? {}, tone: "vote", big: true, hold: BIG };
    }
    case "eliminated":
      // (2026-10-09) roles are never shown to the table — only "out", and the hand they held
      if (d?.side === undefined)
        return { ...base, actor: num(d, "killer") ?? undefined, target: actor, title: `${nm(actor)} is out`, detail: num(d, "killer") !== undefined && d?.killer !== null ? `Who were they, really? Only ${nm(num(d, "killer"))} knows.` : "Who were they, really? Nobody knows.", result: "out", tone: "lethal", big: true, hold: BIG + (d?.lastWords ? LAST_WORDS_MS : 0), lastWords: Boolean(d?.lastWords) };
      return { ...base, actor: num(d, "killer") ?? undefined, target: actor, title: `${nm(actor)} was ${String(d?.role)}`, detail: d?.side === "T" ? "A thief." : "A villager.", result: "out", tone: d?.side === "T" ? "relic" : "lethal", big: true, hold: BIG + (d?.lastWords ? LAST_WORDS_MS : 0), lastWords: Boolean(d?.lastWords) };
    case "eliminated_private":
      // only the Teer Kaman shooter or the Faisla caller sees the role
      return { ...base, target: actor, role: String(d?.role ?? ""), title: `${nm(actor)} was ${String(d?.role)}`, detail: d?.side === "T" ? "A thief. Only you know." : "A villager. Only you know.", tone: d?.side === "T" ? "relic" : "lethal", big: true, hold: BIG };
    case "dal_badal": {
      const others = ((d?.seats as number[]) ?? []).filter((x) => x !== actor).map((x) => nm(x));
      const when = d?.when === "anytime" ? " Out of turn." : d?.when === "voted_out" ? " Voted out — before the reveal." : d?.when === "shot_at" ? " Shot at — before the arrow lands." : d?.when === "read" ? " Read — before the Kundli lands." : "";
      return { ...base, seats: (d?.seats as number[]) ?? [], title: `Dal Badal — ${nm(actor)} is ${String(d?.role)}!`, detail: `A thief. Role cards shuffled with ${others.join(" and ")} — each picks one back, face down.${when}`, tone: "lethal", big: true, hold: BIG };
    }
    case "dal_badal_done":
      return { ...base, title: "Dal Badal done", tone: "neutral", big: false, hold: SMALL };
    case "gift":
      return { ...base, title: target === undefined || d?.target === null ? `${nm(actor)} gives no vote` : `${nm(actor)}'s vote to ${nm(target)}`, tone: "vote", big: false, hold: SMALL };
    case "handoff":
      // (designer 2026-10-12) the table never sees the cards — only that they moved
      return { ...base, title: `${nm(actor)}'s cards go to ${nm(target)}`, tone: "neutral", big: false, hold: SMALL };
    case "handoff_private":
      return { ...base, title: `${nm(actor)}'s cards to ${nm(target)}`, cards: (d?.cards as Card[]) ?? [], tone: "neutral", big: true, hold: BIG - 600, private: true };
    case "to_village":
      // (2026-10-14) only speak of a Stone when one really went
      return { ...base, title: `${nm(actor)}'s cards to the village`, detail: ((d?.cards as Card[]) ?? []).some((c) => c.startsWith("STONE")) ? "A thief's Stone voted out counts for Tunga." : "No Stone among them.", cards: (d?.cards as Card[]) ?? [], tone: "vote", big: true, hold: BIG };
    case "to_thieves":
      return { ...base, title: `${nm(actor)}'s Stone to the thieves`, detail: "A villager voted out — their Stone counts for the thieves.", cards: (d?.cards as Card[]) ?? [], tone: "lethal", big: true, hold: BIG };
    case "defend":
      // (2026-10-13 evening) the accused answers — one line the whole table reads
      return { ...base, actor, target, title: e.msg.replace(/\s*🤖/g, ""), tone: "relic", big: false, hold: SMALL };
    case "floor":
      return { ...base, title: e.msg, tone: "vote", big: false, hold: 600 };
    case "whisper":
      // (2026-10-14) a person's private message shows in the centre from the message itself; a BOT's private word has
      // no message, so its event is the line: "Raju → Adi, privately"
      return d?.bot ? { ...base, title: e.msg.replace(/\s*🤖/g, ""), tone: "neutral", big: false, hold: 900 } : null;
    case "whisper_private":
      return { ...base, title: e.msg, tone: "relic", big: false, hold: 900 };
    case "claim":
      {
        // (designer 2026-10-13) ACCUSATIONS ARE LOUD — a thief role named, or "has a Stone": the whole table stops for it,
        // the named role card big in the middle. CLEARS ARE QUIET — a village role, "no Stone": one line.
        const loud = d?.side === "T" || (d?.kind === "stone" && d?.has === true);
        const who = nm(actor), them = nm(target);
        const why = backing(e, history, nm);
        if (!loud) return { ...base, actor, target, title: e.msg.replace(/\s*🤖/g, ""), detail: why, tone: d?.kind === "stone" ? "gold" : "vote", big: false, hold: 1800 };
        return d?.kind === "stone"
          ? { ...base, actor, target, title: `${who}: ${them} has ${d?.stone === "STONE_1" ? "the Bhadra Stone" : d?.stone === "STONE_2" ? "the Tunga Stone" : "a Stone"}!`, detail: why, tone: "gold", big: true, hold: Math.round(2600 * PACE) }
          : { ...base, actor, target, role: String(d?.role ?? ""), title: d?.role ? `${who}: ${them} ${d?.kind === "was" ? "was" : "is"} ${String(d.role)}!` : `${who} suspects ${them}!`, detail: why, tone: "lethal", big: true, hold: Math.round(2600 * PACE) };
      }
    case "batwara_done": {
      // (playtest 5EQL5, 2026-10-13: "I hardly receive any intel") what YOUR neighbours passed you in the Bhukamp —
      // and what you sent — was never on the centre. One private beat: the seat in every pass this phone saw is you.
      const start = history.findLastIndex((x) => x.type === "batwara" && x.n < e.n);
      const mine = history.filter((x) => x.type === "batwara_private" && x.n < e.n && (start < 0 || x.n > history[start].n));
      const me = mine.length ? [0, 1].map((k) => (mine[0].to as number[])[k]).find((s) => mine.every((x) => Array.isArray(x.to) && x.to.includes(s))) : undefined;
      if (me === undefined) return null;
      const got = mine.filter((x) => x.data?.to === me), gave = mine.filter((x) => x.data?.from === me);
      const label = (c: unknown) => (c === "STONE_1" ? "the Bhadra Stone" : c === "STONE_2" ? "the Tunga Stone" : cardName(String(c)));
      const stoneIn = got.some((x) => String(x.data?.card).startsWith("STONE")), stoneOut = gave.some((x) => String(x.data?.card).startsWith("STONE"));
      return { ...base, private: true, title: stoneIn ? "A Stone came to you" : stoneOut ? "Your Stone moved on" : "Your Bhukamp cards",
        detail: [...got.map((x) => `${nm(num(x.data, "from"))} gave you ${label(x.data?.card)}`), ...gave.map((x) => `you gave ${nm(num(x.data, "to"))} ${label(x.data?.card)}`)].join(" · "),
        rows: [...gave.map((x): [string, string] => [`You → ${nm(num(x.data, "to"))}`, label(x.data?.card)]), ...got.map((x): [string, string] => [`${nm(num(x.data, "from"))} → you`, label(x.data?.card)])],
        tone: "gold", big: true, hold: BIG };
    }
    case "kept_private":
      return { ...base, target: actor, title: "Your Stone didn't come back", detail: e.msg, tone: "gold", big: true, hold: BIG, private: true };
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

/** (playtest 2026-10-13: "I hardly receive any intel") what the TABLE can see behind a claim: did the speaker ever
 *  read that Kundli, search that hand, take those cards, or put that player out? Public facts only — a claim with
 *  nothing behind it is hearsay or a bluff, and the table should see that at a glance. */
function backing(e: GameEvent, history: GameEvent[], nm: (s: number | undefined) => string): string {
  const d = e.data, a = num(d, "seat"), t = num(d, "target");
  if (a === undefined || t === undefined) return "";
  const before = history.filter((x) => x.n < e.n && x.to === "all");
  const pair = (x: GameEvent) => { const s = num(x.data, "seat"), u = num(x.data, "target"); return (s === a && u === t) || (s === t && u === a); };
  if (a === t) return d?.kind === "stone" ? "Their own word — a decoy, a cover, or the truth?" : "Their own last word.";
  if (d?.kind === "stone") {
    if (before.some((x) => x.type === "talashi" && num(x.data, "seat") === a && num(x.data, "target") === t)) return `${nm(a)} searched ${nm(t)} — true or a lie?`;
    if (before.some((x) => x.type === "hera_pheri" && num(x.data, "seat") === t && num(x.data, "target") === a)) return `${nm(t)} stole from ${nm(a)} — true or a lie?`;
    return `${nm(a)} never searched ${nm(t)}.`;
  }
  if (d?.kind === "was") {
    if (a === t) return "Their own last word.";
    if (before.some((x) => x.type === "eliminated" && num(x.data, "seat") === t && num(x.data, "killer") === a)) return `${nm(a)} put ${nm(t)} out and saw the card — true or a lie?`;
  }
  if (before.some((x) => x.type === "kundli" && pair(x))) return `${nm(a)} and ${nm(t)} read each other's Kundli — true or a lie?`;
  return `No Kundli between ${nm(a)} and ${nm(t)} on the table.`;
}

/** Beats for a run of events, in order. `history` = every event this phone has seen (for what a beat needs to look
 *  back at: the Bhukamp passes, what is behind a claim). */
export function beatsFor(events: GameEvent[], names: string[], history: GameEvent[] = events): Beat[] {
  const out: Beat[] = [];
  for (const e of events) { const b = beatFor(e, names, history); if (b) out.push(b); }
  return out;
}

/** How long the table needs to watch these events — the server holds every clock this long (capped). */
export function holdFor(events: GameEvent[], names: string[]): number {
  const total = beatsFor(events.filter((e) => e.to === "all"), names).reduce((t, b) => t + b.hold, 0);
  return Math.min(total, HOLD_CAP);
}
