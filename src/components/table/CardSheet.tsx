// THE CARD SCREEN (owner 2026-11-19): tap a card in your hand and its screen opens over the dimmed table — the big
// real card, ONE short line, and only the choices that make sense now. Every play is a PAIR. X at the top closes;
// tapping anywhere outside the card closes too.
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { Figure } from "@/components/Figure";
import { CARD_FACE } from "@/components/CardIcon";
import { CARD, isStoneCard } from "@/lib/cards";
import { seatColour } from "@/lib/seats";
import type { Card, Move } from "@/rules/game";
import type { SeatInfo } from "./Seats";

export const LINE: Record<Card, string> = {
  FAISLA: "Everyone votes someone out",
  TALASHI: "Secretly see their cards",
  KUNDLI: "See each other's role",
  HERA_PHERI: "Steal both their cards",
  BHUKAMP: "Everyone passes 1 left, 1 right",
  TEER_KAMAN: "Name their role — hit and they're out",
  DAL_BADAL: "Thieves only: show your role, swap roles",
  BHADRA_STONE: "Can be passed, never played",
  TUNGA_STONE: "Can be passed, never played",
};

const NEEDS_TARGET = new Set<Card>(["TALASHI", "KUNDLI", "HERA_PHERI", "TEER_KAMAN"]);

/** the printed card: art in the frame, title, and its line in the space below — like the rules text on the real card */
export function CardFace({ c, width, line }: { c: Card; width: number; line?: string }) {
  return (
    <div className="relative overflow-hidden rounded-[9px] bg-[#fbf0d9]" style={{ width, height: width * 1.4 }}>
      <img src={CARD_FACE[c]} alt="" draggable={false} className="block w-full" />
      <div className="font-display absolute inset-x-[4%] top-[62%] text-center font-black uppercase leading-none text-[#ef7a14] [text-shadow:0_1px_0_#7a2e0a]" style={{ fontSize: width * (CARD[c].name.length > 10 ? 0.092 : CARD[c].name.length > 8 ? 0.105 : 0.14), whiteSpace: "nowrap" }}>
        {CARD[c].name}
      </div>
      {line && <div className="absolute inset-x-[8%] top-[76%] text-center font-semibold leading-tight text-[#5a2a10]" style={{ fontSize: Math.max(10, width * 0.085) }}>{line}</div>}
    </div>
  );
}

/** what this card can do right now, if anything */
function playable(c: Card, hand: Card[], myTurn: boolean) {
  if (isStoneCard(c) || c === "DAL_BADAL") return false;
  return myTurn && hand.filter((x) => x === c).length >= 2;
}

export function CardSheet({ card, hand, myTurn, players, you, onPlay, onClose }: {
  card: Card; hand: Card[]; myTurn: boolean; players: SeatInfo[]; you: number;
  onPlay: (m: Move) => void; onClose: () => void;
}) {
  const [target, setTarget] = useState<number | null>(null);
  const can = playable(card, hand, myTurn);
  const aim = can && NEEDS_TARGET.has(card);
  const others = players.filter((p) => p.alive && p.seat !== you);

  const play = () => {
    if (!can) return;
    if (card === "TEER_KAMAN") { if (target !== null) onPlay({ kind: "teer_kaman", target }); return; }
    if (aim && target === null) return;
    onPlay({ kind: "play", card: card as Exclude<Card, "TEER_KAMAN" | "DAL_BADAL" | "TUNGA_STONE" | "BHADRA_STONE">, ...(aim ? { target: target! } : {}) });
  };

  return (
    <div className="absolute inset-0 z-20 bg-[#010818cc] backdrop-blur-[2px]" onClick={onClose} role="dialog" aria-modal aria-label={CARD[card].name}>
      <button onClick={onClose} aria-label="Close" className="absolute right-3 top-3 grid size-10 place-items-center rounded-xl bg-[#021230e6] text-[#f7bb1f] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
      </button>
      <div className="tt-pop absolute left-1/2 top-[46%] flex -translate-x-1/2 -translate-y-1/2 w-[340px] flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-[10px] shadow-[0_0_0_3px_#f7bb1f,0_18px_40px_rgba(0,0,0,.6)]"><CardFace c={card} width={200} line={LINE[card]} /></div>
        {aim && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {others.map((p) => {
              const on = target === p.seat;
              return (
                <button key={p.seat} onClick={() => setTarget(p.seat)} aria-pressed={on}
                  className="flex w-[70px] flex-col items-center rounded-xl py-1.5 text-[11.5px] font-semibold text-white transition-transform active:scale-95"
                  style={{ background: on ? "rgba(247,187,31,.18)" : "rgba(2,18,48,.7)", boxShadow: on ? "inset 0 0 0 2px #f7bb1f" : `inset 0 0 0 1px ${seatColour(p.seat).hex}66` }}>
                  <Figure colour={seatColour(p.seat).hex} size={30} />
                  {p.name}
                </button>
              );
            })}
          </div>
        )}
        {can && (!aim || target !== null) && (
          <button onClick={play} className="mt-5 rounded-2xl bg-gradient-to-b from-[#f7c94a] to-[#e0a020] px-8 py-3 text-[15px] font-bold text-[#2a1404] shadow-[inset_0_1px_0_#ffe7a6,0_5px_0_#8a5a08] active:translate-y-0.5">
            {aim ? `Play pair on ${players[target!]?.name}` : "Play pair"}
          </button>
        )}
      </div>
    </div>
  );
}
