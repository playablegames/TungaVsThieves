// THE STONE'S PATH (designer 2026-10-12: "how did the Tunga Stone reach Baba?"). Told only once the game is over, when
// every secret is public: each Stone's journey from the deal to where it ended, and every moment someone SAW it (a
// Talashi) — "where it showed". Read from the full event log, so it needs no extra bookkeeping during play.
import type { Card, GameEvent, GameState } from "./types";

export type StoneCard = "STONE_1" | "STONE_2";
export type StoneStep =
  /** the Stone reached a player: dealt to them, picked up from the pile, passed in a Bhukamp, stolen, or handed over */
  | { kind: "holder"; seat: number; how: "dealt" | "pile" | "bhukamp" | "hera_pheri" | "handoff" }
  /** a player saw it in someone's hand with Talashi */
  | { kind: "seen"; by: number; holder: number }
  /** it left play: the last cards on the table / a voted-out villager's cards → village; a voted-out villager's Stones → thieves */
  | { kind: "end"; to: "village" | "thieves" };

const STONES: StoneCard[] = ["STONE_1", "STONE_2"];
const has = (cards: unknown, c: Card) => Array.isArray(cards) && cards.includes(c);

export function stonePaths(s: GameState): Record<StoneCard, StoneStep[]> {
  const out = {} as Record<StoneCard, StoneStep[]>;
  for (const c of STONES) out[c] = pathOf(s.events, c, s);
  return out;
}

function pathOf(events: GameEvent[], c: StoneCard, s: GameState): StoneStep[] {
  const steps: StoneStep[] = [];
  let holder: number | null = null; // null = in the pile (or out of play)
  const reach = (seat: number, how: Extract<StoneStep, { kind: "holder" }>["how"]) => {
    if (holder === seat) return;
    holder = seat;
    steps.push({ kind: "holder", seat, how });
  };
  for (const e of events) {
    const d = e.data ?? {};
    switch (e.type) {
      case "analytics_deal":
        for (const p of (d.players as { seat: number; hand: Card[] }[]) ?? []) if (p.hand.includes(c)) reach(p.seat, "dealt");
        break;
      case "pickup_private":
        if (has(d.cards, c) && Array.isArray(e.to)) reach(e.to[0], "pile");
        break;
      case "batwara_private":
        if (d.card === c && typeof d.to === "number") reach(d.to, "bhukamp");
        break;
      case "hera_pheri_private":
        if (has(d.taken, c) && Array.isArray(e.to)) reach(e.to[0], "hera_pheri");
        break;
      case "handoff_private":
        if (has(d.cards, c) && typeof d.target === "number") reach(d.target, "handoff");
        break;
      case "talashi_private":
        if (has(d.hand, c) && typeof d.seat === "number" && typeof d.target === "number") steps.push({ kind: "seen", by: d.seat, holder: d.target });
        break;
      case "to_village":
        if (has(d.cards, c)) { steps.push({ kind: "end", to: "village" }); holder = null; }
        break;
      case "to_thieves":
        if (has(d.cards, c)) { steps.push({ kind: "end", to: "thieves" }); holder = null; }
        break;
    }
  }
  // still on the table at the end (the last cards passed): those belong to the village
  if (s.pile.includes(c) && steps.at(-1)?.kind !== "end") steps.push({ kind: "end", to: "village" });
  return steps;
}
