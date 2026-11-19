// THE CENTRE of the courtyard (owner 2026-11-19): announcements and results ONLY — who played what on whom, who is
// out, the round, the winner. Never the draw deck or the pile.
/* eslint-disable @next/next/no-img-element */
import { CARD_ART } from "@/components/CardIcon";
import { CARD } from "@/lib/cards";
import { seatColour } from "@/lib/seats";
import type { Card } from "@/rules/game";
import { CY, W } from "./layout";

export interface CentreEvent { n: number; type: string; msg: string; data?: Record<string, unknown> }

/** the events worth announcing in the middle of the table */
export const ANNOUNCE = new Set(["play", "out", "teer_kaman", "dal_badal", "round", "over", "gift"]);

export function Centre({ event, names }: { event: CentreEvent | null; names: string[] }) {
  if (!event) return null;
  const d = event.data ?? {};
  const who = (seat: unknown) => typeof seat === "number" && names[seat] !== undefined
    ? <span style={{ color: seatColour(seat).hex }}>{names[seat]}</span> : null;
  return (
    <div key={event.n} className="tt-pop absolute w-[230px] -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: W / 2, top: CY }} role="status" aria-live="polite">
      {event.type === "play" && typeof d.card === "string" ? (
        <>
          <img src={CARD_ART[d.card as Card]} alt="" className="mx-auto size-[84px] rounded-full object-cover shadow-[0_0_0_3px_#f3e6cc55,0_6px_14px_rgba(0,0,0,.5)]" />
          <div className="mt-1 text-[15px] font-semibold text-white">{who(d.seat)} played</div>
          <div className="font-display text-[30px] font-black uppercase leading-none tracking-wide text-[#ef7a14] [text-shadow:0_2px_0_#5a1e04,0_0_18px_rgba(239,122,20,.35)]">
            {CARD[d.card as Card].name}
          </div>
          {d.target !== undefined && d.target !== null && <div className="mt-1 text-[15px] font-semibold text-white">on {who(d.target)}</div>}
        </>
      ) : (
        <div className="font-display text-[24px] font-black leading-tight text-[#ffe7a6] [text-shadow:0_2px_0_#3a1a04]">{event.msg}</div>
      )}
    </div>
  );
}
