// WHAT YOU KNOW (owner 2026-11-22: "I can't see the effects of the card played", "Kundli is glitching, I can't see the
// other person's role", "reveal the Kundli role permanently", "earlier game had a marker to pin information",
// "whoever loses the Stone knows where it is — leverage"). Built only from the events THIS phone was sent, so it never
// shows anything the rules didn't already tell you.
//   secrets(): the private results, one card each, shown after the card's film
//   notes():   a tag on each seat that stays all game — their role (Kundli / Teer Kaman), the cards you saw or passed them
import type { Card } from "@/rules/game";
import { CARD } from "@/lib/cards";
import type { TableView } from "@/server/game";

type Ev = TableView["events"][number];
const THIEF_ROLES = new Set(["Chor", "Lootera", "Gunda", "Daku"]);
export const isThiefRole = (r: string) => THIEF_ROLES.has(r);
const STONES = new Set<Card>(["TUNGA_STONE", "BHADRA_STONE"]);

export interface Secret { n: number; title: string; line: string; role?: string; cards?: Card[] }

/** the card name in a line, from a raw card id */
const cn = (c: Card) => CARD[c]?.name ?? c;

/** the private results this phone was sent, as cards to show */
export function secrets(events: Ev[], you: number, names: string[]): Secret[] {
  const out: Secret[] = [];
  const name = (x: unknown) => (typeof x === "number" ? names[x] ?? "" : "");
  let lastPlay: { seat: number; card: string; target?: number } | null = null;
  for (const e of events) {
    const d = (e.data ?? {}) as Record<string, unknown>;
    if (e.type === "play") lastPlay = { seat: d.seat as number, card: d.card as string, target: d.target as number | undefined };
    if (e.to === "all") continue;
    switch (e.type) {
      case "talashi": { // (owner 2026-11-22) Talashi talks only about the Stone
        const st = (d.cards as Card[]).filter((c) => STONES.has(c));
        out.push(st.length ? { n: e.n, title: "Talashi", line: `${name(d.target)} has`, cards: st } : { n: e.n, title: "Talashi", line: `${name(d.target)} has no Stone` });
        break;
      }
      case "kundli": {
        const mine = lastPlay?.card === "KUNDLI" && lastPlay.seat === you;
        out.push({ n: e.n, title: "Kundli", role: d.role as string,
          line: mine ? `${name(d.target)} is` : `${name(d.target)} played Kundli on you. ${name(d.target)} is` });
        break;
      }
      case "stole": out.push({ n: e.n, title: "Hera Pheri", line: `You took from ${name(d.target ?? lastPlay?.target)}`, cards: d.cards as Card[] }); break;
      case "robbed": out.push({ n: e.n, title: "Hera Pheri", line: `${name(d.from ?? lastPlay?.seat)} took your cards`, cards: d.cards as Card[] }); break;
      case "teer_kaman_shown": out.push({ n: e.n, title: "Teer Kaman", line: `${name(d.target)} shows you their role`, role: d.role as string }); break;
      case "bhukamp_got": out.push({ n: e.n, title: "Bhukamp", line: d.from !== undefined ? `${name(d.from)} passed you` : "You got", cards: [d.card as Card] }); break;
    }
  }
  return out;
}

export interface Note { role?: string; cards?: string }

/** what you know about each other player, kept all game (cleared for the players whose roles Dal Badal shuffled) */
export function notes(events: Ev[], you: number): Record<number, Note> {
  const n: Record<number, Note> = {};
  const at = (s: number) => (n[s] ??= {});
  for (const e of events) {
    const d = (e.data ?? {}) as Record<string, unknown>;
    switch (e.type) {
      case "kundli": case "teer_kaman_shown":
        if (typeof d.target === "number" && d.target !== you) at(d.target).role = d.role as string;
        break;
      case "dal_badal": // [4.2] the roles were shuffled: what you knew about these players is gone
        for (const s of [d.seat, ...((d.targets as number[]) ?? [])]) if (typeof s === "number" && n[s]) delete n[s].role;
        break;
      case "talashi": { // (owner 2026-11-22) only the Stone matters — never list their other cards
        const st = (d.cards as Card[]).filter((c) => STONES.has(c));
        if (typeof d.target === "number") at(d.target).cards = st.length ? `has ${st.map(cn).join(", ")}` : "no Stone";
        break;
      }
      case "robbed": { // they took your cards: if a Stone went, you know where it is
        const st = (d.cards as Card[]).filter((c) => STONES.has(c));
        if (st.length && typeof d.from === "number") at(d.from).cards = `took your ${st.map(cn).join(", ")}`;
        break;
      }
      case "gave": { // you passed them a Stone: you know where it went
        const st = (d.cards as Card[]).filter((c) => STONES.has(c));
        if (st.length && typeof d.to === "number" && d.to !== you) at(d.to).cards = `got your ${st.map(cn).join(", ")}`;
        break;
      }
    }
  }
  for (const k of Object.keys(n)) if (!n[+k].role && !n[+k].cards) delete n[+k];
  return n;
}
