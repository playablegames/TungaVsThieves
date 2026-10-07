"use client";
// The Table Stage — what every phone shows at the same moment when something big happens (a Faisla, a vote result,
// an elimination, a Dal Badal, the end) or something only you may see (a Kundli read). Same brass frame as the table.
import type { Beat, Tone } from "@/lib/beats";
import type { StageSnapshot } from "@/lib/stage";
import { CARD } from "@/lib/cards";
import { CardIcon } from "./CardIcon";
import { PlayedPair } from "./Hand";

const TITLE: Record<Tone, string> = {
  vote: "text-[#f3c66b]", lethal: "text-crimson-soft", relic: "text-jade-soft", gold: "text-[#f3c66b]", neutral: "text-stock",
};

const STAMP: Record<NonNullable<Beat["result"]>, { text: string; cls: string }> = {
  hit: { text: "HIT", cls: "text-crimson-soft" },
  miss: { text: "MISS", cls: "text-stock/70" },
  out: { text: "OUT", cls: "text-crimson-soft" },
  saved: { text: "SAVED", cls: "text-jade-soft" },
  none: { text: "NOBODY OUT", cls: "text-stock/70" },
};

export function Stage({ stage, skip, names }: { stage: StageSnapshot; skip: () => void; names: string[] }) {
  const b = stage.current;
  const tally = b?.tally ? Object.entries(b.tally).filter(([, k]) => k > 0).sort((x, y) => y[1] - x[1]) : [];
  return (
    <>
      {/* screen readers hear every beat; nobody has to watch the screen to follow the table */}
      <p className="sr-only" aria-live="polite">{b ? `${b.title}. ${b.detail ?? ""}` : ""}</p>
      {b && b.big && (
        <button type="button" onClick={skip} aria-label="Next"
          className="fixed inset-0 z-40 flex items-center justify-center bg-[#0d0703]/80 p-5 backdrop-blur-sm">
          <div className="stage-in relative w-full max-w-sm rounded-2xl border border-brass/70 bg-[#1a0e06] px-5 pb-5 pt-6 text-center shadow-[0_20px_50px_-10px_rgba(0,0,0,.9)]">
            <svg width="22" height="16" viewBox="0 0 22 16" className="absolute -top-2 left-1/2 -translate-x-1/2" aria-hidden>
              <path d="M11 1l7 7-7 7-7-7z" fill="#1a0e06" stroke="#e0a24a" strokeWidth="1.4" /><path d="M11 5l3 3-3 3-3-3z" fill="#e0a24a" />
            </svg>
            {b.private && <p className="mb-2 font-[family-name:var(--font-engraved)] text-[11px] font-semibold uppercase tracking-[0.2em] text-jade-soft">Only you see this</p>}
            {b.card && <div className="mb-3"><PlayedPair c={b.card} /></div>}
            <p className={`font-display text-[26px] font-bold leading-tight ${TITLE[b.tone]}`}>{b.title}</p>
            {b.detail && <p className="mt-1.5 font-display text-[15px] leading-snug text-stock/80">{b.detail}</p>}
            {tally.length > 0 && (
              <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
                {tally.map(([x, k]) => (
                  <li key={x} className="rounded-full border border-brass/50 bg-black/30 px-2.5 py-0.5 text-[13px] text-stock"><b className="text-[#f3c66b]">{k}</b> {names[Number(x)] ?? "?"}</li>
                ))}
              </ul>
            )}
            {b.cards && b.cards.length > 0 && (
              <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
                {b.cards.map((c, i) => (
                  <li key={i} className="flex items-center gap-1.5 rounded-full border border-brass/40 bg-black/30 py-0.5 pl-0.5 pr-2.5 text-[12px] text-stock">
                    <CardIcon c={c} className="w-5" />{CARD[c].name}
                  </li>
                ))}
              </ul>
            )}
            {b.result && <p className={`stage-stamp mt-4 inline-block rounded border-2 border-current px-3 py-1 font-[family-name:var(--font-engraved)] text-lg font-bold tracking-[0.2em] ${STAMP[b.result].cls}`}>{STAMP[b.result].text}</p>}
            <p className="mt-4 text-[11px] text-stock/40">{stage.pending > 0 ? `${stage.pending} more · ` : ""}tap to continue</p>
          </div>
        </button>
      )}
    </>
  );
}
