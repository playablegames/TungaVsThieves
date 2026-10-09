// Card copy — from the printed cards (v7 print = v16 rules), with the designer's 2026-10-09 rule changes. Shared by the UI.
import type { Card } from "@/engine/types";

/** DESIGN.md button voices: marigold vote · crimson lethal · jade relic · gold Bhukamp · stones · neutral */
export type Voice = "vote" | "lethal" | "relic" | "gold" | "neutral" | "bhadra" | "tunga";

export const CARD: Record<Card, { name: string; sub: string; text: string; voice: Voice }> = {
  FAISLA: { name: "Faisla", sub: "Voting begins", text: "Open the floor, then everyone votes. Most votes is out — a tie, nobody. Only you see their role. Draw 2.", voice: "vote" },
  TALASHI: { name: "Talashi", sub: "See action cards", text: "Choose a player and secretly see their cards — never their role. Draw 2.", voice: "relic" },
  KUNDLI: { name: "Kundli", sub: "See role", text: "Secretly see one player's role card. Say anything — or nothing. Draw 2.", voice: "relic" },
  HERA_PHERI: { name: "Hera Pheri", sub: "Swap action cards", text: "Steal 2 cards face down from any one player. They draw 2.", voice: "lethal" },
  BATWARA: { name: "Bhukamp", sub: "Pass clockwise", text: "Draw 2, then everyone — you too — passes 1 card to the next player, clockwise.", voice: "gold" },
  TEER_KAMAN: { name: "Teer Kaman", sub: "Eliminate a player", text: "Pick a player, name two roles. Either is theirs: they're out, and only you see their role. Draw 2. Miss: you're out.", voice: "lethal" },
  DAL_BADAL: { name: "Dal Badal", sub: "Thieves only", text: "A thief's whole turn: pass 3, show your role, and shuffle role cards with 2 players — each picks one back face down. Draw 1. Then it leaves the game.", voice: "neutral" },
  STONE_1: { name: "Bhadra Stone", sub: "Villagers need both · Thieves need one", text: "Can be passed, never discarded.", voice: "bhadra" },
  STONE_2: { name: "Tunga Stone", sub: "Villagers need both · Thieves need one", text: "Can be passed, never discarded.", voice: "tunga" },
};

/** the one line a card tile has room for (Your Cards); long-press shows the full printed text */
export const SHORT: Record<Card, string> = {
  FAISLA: "Everyone votes", TALASHI: "See their cards", KUNDLI: "See a role", HERA_PHERI: "Steal 2 cards",
  BATWARA: "1 card on", TEER_KAMAN: "Shoot a role", DAL_BADAL: "Thief: swap roles",
  STONE_1: "Pass it on", STONE_2: "Pass it on",
};

export const isStoneCard = (c: Card) => c === "STONE_1" || c === "STONE_2";
export const sideName = (s: "V" | "T") => (s === "V" ? "Tunga" : "Thief");

/** Tailwind classes per voice — the band on a card face, a button fill, a ring */
export const VOICE: Record<Voice, { band: string; text: string; fill: string; ring: string }> = {
  vote: { band: "bg-marigold", text: "text-marigold-deep", fill: "bg-marigold text-card-ink", ring: "ring-marigold" },
  lethal: { band: "bg-crimson", text: "text-crimson-deep", fill: "bg-crimson text-ink", ring: "ring-crimson" },
  relic: { band: "bg-jade", text: "text-jade-deep", fill: "bg-jade text-card-ink", ring: "ring-jade" },
  gold: { band: "bg-gold", text: "text-edge", fill: "bg-gold text-card-ink", ring: "ring-gold" },
  neutral: { band: "bg-raise-2", text: "text-card-ink", fill: "bg-raise-2 text-ink", ring: "ring-raise-2" },
  bhadra: { band: "bg-bhadra", text: "text-bhadra", fill: "bg-bhadra text-ink", ring: "ring-bhadra" },
  tunga: { band: "bg-tunga", text: "text-tunga", fill: "bg-tunga text-card-ink", ring: "ring-tunga" },
};
