"use client";
// ☰ → MOTION & COMFORT (designer 2026-10-14: "it shouldn't harm anyone — make the settings accessible"). Three plain
// choices, big targets, the current one marked: screen shake (off · gentle · full), reduce motion, flashes.
import { setMotion, useMotion, type Shake } from "@/lib/motion";

const SHAKES: [Shake, string][] = [[0, "Off"], [0.5, "Gentle"], [1, "Full"]];

export function MotionSettings() {
  const m = useMotion();
  const seg = (on: boolean) => `min-h-11 flex-1 rounded-xl text-[14px] font-bold ${on ? "bg-jade text-card-ink" : "border border-brass/40 text-stock/80"}`;
  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border border-brass/30 p-3">
      <legend className="px-1 text-[13px] font-bold uppercase tracking-wide text-brass">Motion &amp; comfort</legend>
      <div role="radiogroup" aria-label="Screen shake" className="flex flex-col gap-1.5">
        <span className="text-[14px] text-stock">Screen shake</span>
        <div className="flex gap-2">
          {SHAKES.map(([v, label]) => (
            <button key={label} type="button" role="radio" aria-checked={m.shake === v} onClick={() => setMotion({ shake: v })} className={seg(m.shake === v)}>{label}</button>
          ))}
        </div>
      </div>
      <button type="button" role="switch" aria-checked={m.reduced} onClick={() => setMotion({ reduced: !m.reduced })}
        className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-brass/40 px-3 text-left text-[14px] text-stock">
        <span>Reduce motion<span className="block text-[12px] text-stock/60">No shakes, flying cards or moving scenes — the words still tell you everything</span></span>
        <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full ${m.reduced ? "bg-jade" : "bg-black/50 ring-1 ring-brass/40"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-stock transition-all ${m.reduced ? "left-6" : "left-1"}`} /></span>
      </button>
      <button type="button" role="switch" aria-checked={m.flashes} onClick={() => setMotion({ flashes: !m.flashes })}
        className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-brass/40 px-3 text-left text-[14px] text-stock">
        <span>Flashes<span className="block text-[12px] text-stock/60">The white flash when a card is struck</span></span>
        <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-full ${m.flashes ? "bg-jade" : "bg-black/50 ring-1 ring-brass/40"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-stock transition-all ${m.flashes ? "left-6" : "left-1"}`} /></span>
      </button>
    </fieldset>
  );
}
