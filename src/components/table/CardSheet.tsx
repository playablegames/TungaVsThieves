// THE CARD SCREEN (owner 2026-11-19): tap a card in your hand and its screen opens over the dimmed table — the big
// real card, ONE short line, and only the choices that make sense now. Every play is a PAIR. X at the top closes;
// tapping anywhere outside the card closes too. Players to pick are shown as the card back, like at the table.
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { CARD_BACK, CARD_FACE } from "@/components/CardIcon";
import { CARD, isStoneCard } from "@/lib/cards";
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
/** the printed face files are 600×513 */
const FACE_RATIO = 513 / 600;

/** the printed card in its own near-square shape: art in the frame, title in the space above the divider */
export function CardFace({ c, width }: { c: Card; width: number }) {
  const long = CARD[c].name.length;
  return (
    <div className="relative overflow-hidden rounded-[8px] bg-[#fbf0d9]" style={{ width, height: width * FACE_RATIO }}>
      <img src={CARD_FACE[c]} alt="" draggable={false} className="block size-full" />
      <div className="font-display absolute inset-x-[4%] top-[61%] text-center font-black uppercase leading-none text-[#ef7a14] [text-shadow:0_1px_0_#7a2e0a]"
        style={{ fontSize: width * (long > 10 ? 0.075 : long > 8 ? 0.095 : 0.13), whiteSpace: "nowrap" }}>
        {CARD[c].name}
      </div>
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
      <div className="tt-pop absolute left-1/2 top-[46%] flex w-[380px] -translate-x-1/2 -translate-y-1/2 flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <div className="rounded-[9px] shadow-[0_0_0_3px_#f7bb1f,0_18px_40px_rgba(0,0,0,.6)]"><CardFace c={card} width={260} /></div>
        <p className="mt-4 text-center text-[16px] font-semibold text-[#ffe7a6]">{LINE[card]}</p>
        {aim && (
          <div className="mt-4 flex flex-wrap justify-center gap-2.5">
            {others.map((p) => {
              const on = target === p.seat;
              return (
                <button key={p.seat} onClick={() => setTarget(p.seat)} aria-pressed={on} className="flex w-[66px] flex-col items-center transition-transform active:scale-95">
                  <img src={CARD_BACK} alt="" className="h-[60px] w-[42px] rounded-[4px] object-cover"
                    style={{ boxShadow: on ? "0 0 0 2.5px #f7bb1f, 0 0 14px rgba(247,187,31,.7)" : "0 0 0 1px rgba(247,187,31,.5)" }} />
                  <span className="relative -mt-1.5 max-w-full truncate rounded-full bg-[#021230f0] px-2 py-px text-[11px] font-semibold"
                    style={{ color: on ? "#ffe7a6" : "#fff", boxShadow: `inset 0 0 0 ${on ? 1.5 : 1}px rgba(247,187,31,${on ? 1 : 0.55})` }}>{p.name}</span>
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
