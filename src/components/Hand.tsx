"use client";
// "Your Cards" (designer's mockup 2026-10-07): parchment tiles in a row — number, name, one short line.
// Long-press any tile for the full printed text. A playable pair glows together; you never play one card alone.
import { useRef, useState } from "react";
import type { Card } from "@/engine/types";
import { CARD, SHORT, isStoneCard } from "@/lib/cards";
import { CardIcon, Corners } from "./CardIcon";

const LONG_PRESS_MS = 450;
/** five tiles fill the row; fewer keep the same size, centred */
const width = (n: number) => { const cols = Math.max(n, 5); return `calc((100% - ${(cols - 1) * 6}px) / ${cols})`; };

export function HandRow({ cards, glow, selected, labels, dim, onTap }: {
  cards: Card[];
  glow?: number[]; selected?: number[]; labels?: Record<number, string>; dim?: number[];
  onTap?: (i: number) => void;
}) {
  const [detail, setDetail] = useState<Card | null>(null);
  if (!cards.length) return <p className="py-6 text-center text-[13px] text-stock/60">No cards in hand.</p>;
  return (
    <>
      <ul className="flex justify-center gap-1.5" aria-label="Your cards">
        {cards.map((c, i) => (
          <li key={i} style={{ width: width(cards.length) }}>
            <Tile c={c} glow={glow?.includes(i)} selected={selected?.includes(i)} label={labels?.[i]} dim={dim?.includes(i)}
              onTap={onTap ? () => onTap(i) : undefined} onDetail={() => setDetail(c)} />
          </li>
        ))}
      </ul>
      {detail && <Detail c={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function Tile({ c, glow, selected, label, dim, onTap, onDetail }: {
  c: Card; glow?: boolean; selected?: boolean; label?: string; dim?: boolean; onTap?: () => void; onDetail: () => void;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const long = useRef(false);
  const k = CARD[c];
  const start = () => { long.current = false; timer.current = setTimeout(() => { long.current = true; onDetail(); }, LONG_PRESS_MS); };
  const stop = () => clearTimeout(timer.current);
  return (
    <button type="button"
      onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => { if (long.current) return; if (onTap) onTap(); else onDetail(); }}
      aria-label={`${k.name}: ${SHORT[c]}${label ? `, ${label}` : ""}. Hold for the full card.`} aria-pressed={onTap ? Boolean(selected) : undefined}
      className={`relative flex aspect-[5/8] w-full select-none flex-col items-center rounded-lg border px-1 pb-2 pt-2.5 text-center transition-transform duration-150 [-webkit-touch-callout:none]
        bg-[radial-gradient(120%_90%_at_50%_35%,#f5e2bd_0%,#e6c995_100%)] text-card-ink shadow-[0_8px_18px_-8px_rgba(0,0,0,.8)]
        ${selected ? "-translate-y-2 border-jade ring-[3px] ring-jade" : glow ? "-translate-y-1 border-[#f0a32e] ring-2 ring-[#f0a32e] shadow-[0_0_16px_2px_rgba(240,163,46,.35)]" : "border-[#b8863b]"}
        ${dim ? "opacity-45" : ""}`}>
      <Corners />
      <CardIcon c={c} className="w-[52%] shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,.35)]" />
      <span className="mt-1.5 font-[family-name:var(--font-engraved)] text-[clamp(9px,2.7vw,12px)] font-bold uppercase leading-[1.1]">{k.name}</span>
      <span className="mt-auto text-[clamp(8px,2.3vw,10px)] leading-tight text-card-ink/70">{SHORT[c]}</span>
      {label && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-jade px-1.5 text-[10px] font-extrabold text-card-ink">{label}</span>}
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
        <p className="text-center font-[family-name:var(--font-engraved)] text-[22px] font-bold uppercase tracking-wide text-[#f3c66b]">{k.name}</p>
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
    <div className={`absolute top-0 flex aspect-[5/8] flex-col items-center rounded-md border border-[#b8863b] bg-[radial-gradient(120%_90%_at_50%_35%,#f5e2bd_0%,#e6c995_100%)] px-1 pb-1 pt-1.5 text-center text-card-ink shadow-[0_8px_18px_-6px_rgba(0,0,0,.9)] ${tilt}`} style={{ width: w, ...side }}>
      <Corners />
      <CardIcon c={c} className="w-[60%]" />
      <span className="mt-1 font-[family-name:var(--font-engraved)] text-[8px] font-bold uppercase leading-[1.1]">{k.name}</span>
    </div>
  );
  return (
    <div className="relative mx-auto" style={{ width: `calc(${w} * 1.7)`, height: `calc(${w} * 1.6 + 4px)` }} role="img" aria-label={`A pair of ${k.name}`}>
      {one("-rotate-[8deg]", { left: 0 })}
      {one("rotate-[8deg]", { right: 0 })}
    </div>
  );
}
