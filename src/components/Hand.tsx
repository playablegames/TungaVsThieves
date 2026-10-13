"use client";
// "Your Cards" (designer's mockup 2026-10-07): parchment tiles in a row — number, name, one short line.
// Tap a card (or long-press while picking) for its full rules. A playable pair glows together; you never play one card alone.
import { useRef, useState } from "react";
import type { Card } from "@/engine/types";
import { CARD, SHORT, isStoneCard } from "@/lib/cards";
import { CARD_FACE, CardIcon, CardTitle } from "./CardIcon";

const LONG_PRESS_MS = 450;
/** one card's place in the fan: a fixed card width; with many cards they overlap more so the fan always fits */
const CARD_W = "min(30vw, 128px)";
function fan(i: number, n: number): React.CSSProperties {
  const mid = (n - 1) / 2, off = i - mid;
  const overlap = n <= 1 ? "0px" : `max(0px, calc((${CARD_W} * ${n} - (100vw - 40px)) / ${n - 1}))`;
  return {
    width: CARD_W, flex: "none",
    marginLeft: i === 0 ? 0 : `calc(-1 * ${overlap} - ${n > 3 ? 8 : 0}px)`,
    transform: `translateY(${Math.abs(off) * Math.abs(off) * 2.2}px) rotate(${off * (n > 4 ? 4 : 5)}deg)`,
    zIndex: i,
  };
}

/** NEW CARDS (designer 2026-10-13): the hand this phone has acknowledged. Cards beyond it (picked up, stolen, handed
 *  over, drawn) wear a green NEW until you touch your hand; a hand that only shrank needs no acknowledging. */
class Acked {
  private cards: Card[] | null = null;
  /** the cards beyond what this phone has acknowledged (a hand that only shrank is acknowledged at once) */
  fresh(cards: Card[]): number[] {
    if (this.cards === null) { this.cards = [...cards]; return []; }
    const left = [...this.cards];
    const out: number[] = [];
    cards.forEach((c, i) => { const k = left.indexOf(c); if (k >= 0) left.splice(k, 1); else out.push(i); });
    if (!out.length) this.cards = [...cards];
    return out;
  }
  ack(cards: Card[]) { this.cards = [...cards]; }
}
const ACKED = new Acked();

export function HandRow({ cards, glow, selected, labels, dim, onTap }: {
  cards: Card[];
  glow?: number[]; selected?: number[]; labels?: Record<number, string>; dim?: number[];
  onTap?: (i: number) => void;
}) {
  const [detail, setDetail] = useState<Card | null>(null);
  const fresh = ACKED.fresh(cards);
  const ack = () => ACKED.ack(cards);
  if (!cards.length) return <p className="py-6 text-center text-[13px] text-stock/60">No cards in hand.</p>;
  return (
    <>
      {/* (designer 2026-10-13) a FAN, like a hand of real cards: overlapping, turned a little round a point below */}
      {/* (2026-10-14, Balatro study: "cards never sit still") the fan tilts toward your finger, and each card breathes */}
      <ul className="hand-tilt flex justify-center px-2 pt-2" aria-label="Your cards"
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); e.currentTarget.style.setProperty("--tx", `${(((e.clientX - r.left) / r.width) - 0.5) * 10}deg`); e.currentTarget.style.setProperty("--ty", `${(0.5 - (e.clientY - r.top) / r.height) * 8}deg`); }}
        onPointerLeave={(e) => { e.currentTarget.style.setProperty("--tx", "0deg"); e.currentTarget.style.setProperty("--ty", "0deg"); }}>
        {cards.map((c, i) => (
          <li key={i} className="origin-bottom transition-transform duration-200" style={fan(i, cards.length)}>
            <span className="idle-float block" style={{ animationDelay: `${-i * 0.55}s` }}>
            <Tile c={c} glow={glow?.includes(i)} selected={selected?.includes(i)} label={labels?.[i] ?? (fresh.includes(i) ? "NEW" : undefined)} dim={dim?.includes(i)}
              fresh={!labels?.[i] && fresh.includes(i)}
              onTap={onTap ? () => { ack(); onTap(i); } : undefined} onDetail={() => { ack(); setDetail(c); }} />
            </span>
          </li>
        ))}
      </ul>
      {detail && <Detail c={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function Tile({ c, glow, selected, label, dim, fresh, onTap, onDetail }: {
  c: Card; glow?: boolean; selected?: boolean; label?: string; dim?: boolean; fresh?: boolean; onTap?: () => void; onDetail: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const long = useRef(false);
  const k = CARD[c];
  const face = CARD_FACE[c];
  const start = () => { long.current = false; timer.current = setTimeout(() => { long.current = true; onDetail(); }, LONG_PRESS_MS); };
  const stop = () => clearTimeout(timer.current);
  return (
    <button type="button"
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => { if (long.current) return; if (onTap) onTap(); else onDetail(); }}
      aria-label={`${k.name}: ${SHORT[c]}${label ? `, ${label}` : ""}. Hold for the full card.`} aria-pressed={onTap ? Boolean(selected) : undefined}
      className={`lift relative flex aspect-[1060/906] w-full select-none ${fresh ? "card-in" : ""} flex-col items-center rounded-lg border text-center ${face ? "overflow-hidden p-0" : "justify-center px-1 py-1.5"} transition-transform duration-150 [-webkit-touch-callout:none]
        bg-[#fbf3e1] text-card-ink shadow-[0_8px_18px_-8px_rgba(0,0,0,.8)] outline-1 outline-offset-[-4px] outline-dotted outline-[#b4461c]/60
        ${selected ? "-translate-y-2 border-[#f08a1c] ring-[3px] ring-[#f08a1c]" : glow ? "-translate-y-1 border-[#f0a32e] ring-2 ring-[#f0a32e] shadow-[0_0_16px_2px_rgba(240,163,46,.35)]" : "border-[#b4461c]"}
        ${dim ? "opacity-45" : ""}`}>
      {face ? (
        // eslint-disable-next-line @next/next/no-img-element
        <><img src={face} alt="" draggable={false} className="absolute inset-0 h-full w-full rounded-[inherit] object-cover" />
          <CardTitle c={c} name={k.name} className="text-[clamp(10px,3.2vw,15px)]" /></>
      ) : <CardIcon c={c} className="w-[62%] shrink-0" />}
      {!face && <span className="mt-0.5 font-[family-name:var(--font-engraved)] text-[clamp(9px,2.7vw,12px)] font-bold uppercase leading-[1.05] text-[#e8771a]">{k.name}</span>}
      {label && <span className={`absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 text-[10px] font-extrabold ${fresh ? "nudge-dot" : "bg-[#b4461c] text-[#fbf3e1]"}`}>{label}</span>}
    </button>
  );
}

/** the full printed card, from a long-press */
function Detail({ c, onClose }: { c: Card; onClose: () => void }) {
  const k = CARD[c];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div role="dialog" aria-label={k.name} onClick={(e) => e.stopPropagation()}
        className="stage-in w-full max-w-md rounded-t-3xl border-t-2 border-brass/70 bg-ember px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
        {CARD_FACE[c]
          ? <div className="relative mx-auto w-[min(82%,340px)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CARD_FACE[c]} alt={k.name} className="w-full rounded-xl shadow-[0_14px_30px_-8px_rgba(0,0,0,.9)]" />
              <CardTitle c={c} name={k.name} className="text-[clamp(22px,7vw,32px)]" />
            </div>
          : <><CardIcon c={c} className="mx-auto w-28" /><p className="text-center font-[family-name:var(--font-engraved)] text-[22px] font-bold uppercase tracking-wide text-[#f3c66b]">{k.name}</p></>}
        <p className="mt-1 text-center text-[12px] font-bold uppercase tracking-[0.15em] text-stock/60">{k.sub}</p>
        <p className="mt-4 text-center font-display text-[17px] leading-relaxed text-stock">{k.text}</p>
        {!isStoneCard(c) && c !== "DAL_BADAL" && <p className="mt-3 text-center text-[13px] text-stock/60">Played as a pair, on your turn.</p>}
        <button type="button" onClick={onClose} className="mt-5 min-h-12 w-full rounded-full border-2 border-brass/70 text-[14px] font-bold uppercase tracking-wide text-stock">Close</button>
      </div>
    </div>
  );
}

/** the pair just played, face up in the middle of the table — two of the same card, fanned (designer 2026-10-07) */
export function PlayedPair({ c }: { c: Card }) {
  const k = CARD[c];
  const w = "clamp(48px, 13vw, 60px)";
  const one = (tilt: string, side: React.CSSProperties) => (
    <div className={`absolute top-0 flex aspect-[5/8] flex-col items-center rounded-md border border-[#b4461c] bg-[#fbf3e1] px-1 pb-1 pt-1.5 text-center text-card-ink shadow-[0_8px_18px_-6px_rgba(0,0,0,.9)] ${tilt}`} style={{ width: w, ...side }}>
      <CardIcon c={c} className="w-[88%]" />
      <span className="mt-0.5 font-[family-name:var(--font-engraved)] text-[8px] font-bold uppercase leading-[1.1] text-[#e8771a]">{k.name}</span>
    </div>
  );
  return (
    <div className="stage-card relative mx-auto" style={{ width: `calc(${w} * 1.7)`, height: `calc(${w} * 1.6 + 4px)` }} role="img" aria-label={`A pair of ${k.name}`}>
      {one("-rotate-[8deg]", { left: 0 })}
      {one("rotate-[8deg]", { right: 0 })}
    </div>
  );
}
