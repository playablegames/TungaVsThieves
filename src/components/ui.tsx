"use client";
// Shared pieces of the Haveli table: card faces (the printed cards), card backs, buttons, the timer ring, sheets.
import { useEffect, useState } from "react";
import type { Card } from "@/engine/types";
import { CARD, VOICE, type Voice } from "@/lib/cards";

type Size = "sm" | "md" | "lg";
const SIZE: Record<Size, string> = {
  sm: "w-14 h-[78px] rounded-[10px] text-[11px]",
  md: "w-[68px] h-[96px] rounded-xl text-[12px]",
  lg: "w-24 h-[134px] rounded-2xl text-[15px]",
};

/** A card face as printed: cream stock, a band in the card's voice, the name and its subtitle. */
export function CardFace({ c, size = "md", selected, dim, onClick, label }: {
  c: Card; size?: Size; selected?: boolean; dim?: boolean; onClick?: () => void; label?: string;
}) {
  const k = CARD[c];
  const v = VOICE[k.voice];
  const stone = k.voice === "bhadra" || k.voice === "tunga";
  const body = (
    <>
      <span className={`absolute inset-x-0 top-0 h-1.5 ${v.band}`} aria-hidden />
      <span className={`font-display font-black uppercase leading-[1.05] ${stone ? v.text : v.text}`}>{k.name}</span>
      {size !== "sm" && <span className="text-[9px] font-extrabold uppercase leading-tight tracking-wide opacity-80">{k.sub}</span>}
      {label && <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-jade px-1.5 text-[10px] font-extrabold text-card-ink">{label}</span>}
    </>
  );
  const cls = `relative flex shrink-0 flex-col items-center justify-center gap-1 overflow-visible border px-1 text-center shadow-[0_8px_24px_-4px_rgba(0,0,0,.65)] transition-transform duration-150 ${SIZE[size]} ${
    stone ? "border-gold bg-paper-2 text-ink shadow-[0_0_18px_2px_#2ecc7140]" : "border-edge bg-stock text-card-ink"
  } ${selected ? "-translate-y-2 ring-[3px] ring-jade" : ""} ${dim ? "opacity-35" : ""}`;
  if (!onClick) return <div className={cls} role="img" aria-label={`${k.name} — ${k.sub}`}>{body}</div>;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} aria-label={`${k.name} — ${k.sub}`} className={`${cls} active:translate-y-px`}>{body}</button>
  );
}

/** Face down: the back of every action card (and the Stones — nobody can tell them from behind). */
export function CardBack({ size = "sm", className = "" }: { size?: Size; className?: string }) {
  return (
    <div aria-hidden className={`shrink-0 border border-gold bg-[repeating-linear-gradient(45deg,var(--color-paper-2)_0_6px,var(--color-paper-3)_6px_12px)] shadow-[0_4px_12px_rgba(0,0,0,.5)] ${SIZE[size]} ${className}`} />
  );
}

/** Buttons in the four DESIGN.md voices. Pill, ≥ 48px tall, one line, never wraps. */
export function Btn({ voice = "pass", className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { voice?: Voice | "pass" | "ghost" }) {
  const fill = voice === "pass" ? "bg-paper-2/80 text-ink ring-1 ring-gold" : voice === "ghost" ? "bg-transparent text-ink-2 ring-1 ring-raise-2" : VOICE[voice].fill;
  return (
    <button {...p} className={`inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-[13px] font-extrabold uppercase tracking-wide transition-transform duration-100 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 ${fill} ${className}`} />
  );
}

const FULL = new Map<number, number>();

/** The decision clock as a ring — every phone shows the same deadline. */
export function TimerRing({ deadline, now, size = 40, brass = false }: { deadline: number | null; now: () => number; size?: number; brass?: boolean }) {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 250); return () => clearInterval(t); }, []);
  if (!deadline) return <span style={{ width: size }} aria-hidden />;
  const left = Math.max(0, deadline - now());
  if (!FULL.has(deadline)) FULL.set(deadline, Math.max(left, 1)); // the ring is full when this deadline first appears
  const frac = Math.min(1, left / FULL.get(deadline)!);
  const r = size / 2 - 3, c = 2 * Math.PI * r;
  const secs = Math.ceil(left / 1000);
  const low = secs <= 10;
  return (
    <span className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="timer" aria-label={`${secs} seconds left`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" className={brass ? "fill-[#160b04] stroke-[#4a3220]" : "stroke-raise-2"} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="3" strokeLinecap="round"
          className={low ? "stroke-crimson" : brass ? "stroke-[#f0a32e]" : "stroke-jade"} strokeDasharray={c} strokeDashoffset={c * (1 - frac)} />
      </svg>
      <span className={`absolute font-extrabold tabular-nums ${brass ? "font-display text-[20px] font-bold" : "text-[12px]"} ${low ? "text-crimson-soft" : "text-ink"}`}>{secs}</span>
    </span>
  );
}

/** A bottom sheet over the table (talk, the story so far). */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end bg-paper/60" onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="stage-in mx-auto flex max-h-[80dvh] w-full max-w-md flex-col gap-3 rounded-t-2xl border-t border-rim bg-paper-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-ink-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
