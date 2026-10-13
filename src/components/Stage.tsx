"use client";
// The Table Stage — what every phone shows at the same moment when something big happens (a Faisla, a vote result,
// an elimination, a Dal Badal, the end) or something only you may see (a Kundli read). Same brass frame as the table.
import type { Beat, Tone } from "@/lib/beats";
import type { StageSnapshot } from "@/lib/stage";
import { CARD } from "@/lib/cards";
import { roleArt } from "./CardIcon";
import { CardIcon } from "./CardIcon";
import { PlayedPair } from "./Hand";
import { TapOn } from "./ui";
import { useEffect } from "react";
import { play } from "@/lib/sfx";

const TALLY_STEP = 420;

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

/** `inline`: the big moment plays INSIDE the ring's centre, so the players stay in view (designer 2026-10-07: "the centre
 *  reveal should be contained"); `small` (big tables) leaves out the card art so it fits. Without it: a full-screen overlay. */
export function Stage({ stage, skip, names, inline = false, small = false }: { stage: StageSnapshot; skip: () => void; names: string[]; inline?: boolean; small?: boolean }) {
  const b = stage.current;
  const tally = b?.tally ? Object.entries(b.tally).filter(([, k]) => k > 0).sort((x, y) => y[1] - x[1]) : [];
  // each landing ballot chip rings a note higher than the last
  const landing = b?.n ?? -1, chips = tally.length;
  useEffect(() => {
    if (!chips) return;
    const ts = Array.from({ length: chips }, (_, i) => setTimeout(() => play("vote", i + 1), 300 + i * TALLY_STEP));
    return () => ts.forEach(clearTimeout);
  }, [landing, chips]);
  return (
    <>
      {/* screen readers hear every beat; nobody has to watch the screen to follow the table */}
      <p className="sr-only" aria-live="polite">{b ? `${b.title}. ${b.detail ?? ""}` : ""}</p>
      {b && b.big && (
        <button type="button" onClick={skip} aria-label="Next"
          className={inline ? "block w-full" : "fixed inset-0 z-40 flex items-center justify-center bg-[#0d0703]/80 p-5 backdrop-blur-sm"}>
          <div className={`stage-in relative w-full rounded-2xl border border-brass/70 bg-[#1a0e06] text-center ${inline ? "px-2.5 pb-2.5 pt-4" : "max-w-sm px-5 pb-5 pt-6 shadow-[0_20px_50px_-10px_rgba(0,0,0,.9)]"}`}>
            <svg width="22" height="16" viewBox="0 0 22 16" className="absolute -top-2 left-1/2 -translate-x-1/2" aria-hidden>
              <path d="M11 1l7 7-7 7-7-7z" fill="#1a0e06" stroke="#e0a24a" strokeWidth="1.4" /><path d="M11 5l3 3-3 3-3-3z" fill="#e0a24a" />
            </svg>
            {b.private && <p className="mb-2 font-[family-name:var(--font-engraved)] text-[11px] font-semibold uppercase tracking-[0.2em] text-jade-soft">Only you see this</p>}
            {b.card && !small && !(b.role && roleArt(b.role)) && <div className="mb-2"><PlayedPair c={b.card} /></div>}
            {b.role && roleArt(b.role) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={roleArt(b.role)!} alt="" className={`stage-card mx-auto mb-2 rounded-lg shadow-[0_12px_28px_-8px_rgba(0,0,0,.9)] ${inline ? "w-16" : "w-28"}`} />
            )}
            <p className={`font-display font-bold leading-tight ${inline ? "text-[18px]" : "text-[26px]"} ${TITLE[b.tone]}`}>{b.title}</p>
            {b.rows && b.rows.length > 0 ? (
              <table className={`mx-auto mt-2 w-full max-w-[260px] text-left ${inline ? "text-[12px]" : "text-[14px]"}`}>
                <tbody>{b.rows.map(([k, x], i) => (
                  <tr key={i} className="border-b border-brass/20 last:border-0"><th scope="row" className="py-1 pr-2 font-semibold text-stock/70">{k}</th><td className="py-1 font-bold text-stock">{x}</td></tr>
                ))}</tbody>
              </table>
            ) : b.detail && <p className={`mt-1 font-display leading-snug text-stock/80 ${inline ? "text-[13px]" : "text-[15px]"}`}>{b.detail}</p>}
            {tally.length > 0 && (
              <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
                {/* (2026-10-14, Balatro study: score lands one piece at a time, each a note higher) fewest first, the winner last */}
                {[...tally].reverse().map(([x, k], i) => (
                  <li key={x} className="pop rounded-full border border-brass/50 bg-black/30 px-2.5 py-0.5 text-[13px] text-stock" style={{ animationDelay: `${300 + i * TALLY_STEP}ms` }}><b className="text-[#f3c66b]">{k}</b> {names[Number(x)] ?? "?"}</li>
                ))}
              </ul>
            )}
            {/* Talashi: the searched hand, face up, as cards */}
            {b.type === "talashi_private" && b.cards && b.cards.length > 0 && (
              <ul className="mt-3 flex flex-wrap justify-center gap-2">
                {b.cards.map((c, i) => (
                  <li key={i} className={`stage-card relative flex aspect-[5/8] flex-col ${inline ? "w-[44px]" : "w-[60px]"} items-center rounded-md border border-[#b8863b] bg-[radial-gradient(120%_90%_at_50%_35%,#f5e2bd_0%,#e6c995_100%)] px-1 pb-1 pt-1.5 text-card-ink shadow-[0_8px_18px_-6px_rgba(0,0,0,.9)]`} style={{ animationDelay: `${i * 120}ms` }}>
                    <CardIcon c={c} className="w-[62%]" />
                    <span className="mt-1 text-center font-[family-name:var(--font-engraved)] text-[8px] font-bold uppercase leading-[1.1]">{CARD[c].name}</span>
                  </li>
                ))}
              </ul>
            )}
            {b.type !== "talashi_private" && b.cards && b.cards.length > 0 && (
              <ul className="mt-3 flex flex-wrap justify-center gap-1.5">
                {b.cards.map((c, i) => (
                  <li key={i} className="flex items-center gap-1.5 rounded-full border border-brass/40 bg-black/30 py-0.5 pl-0.5 pr-2.5 text-[12px] text-stock">
                    <CardIcon c={c} className="w-5" />{CARD[c].name}
                  </li>
                ))}
              </ul>
            )}
            {b.result && <p className={`stage-stamp inline-block ${inline ? "mt-2" : "mt-4"} rounded border-2 border-current px-3 py-1 font-[family-name:var(--font-engraved)] text-lg font-bold tracking-[0.2em] ${STAMP[b.result].cls}`}>{STAMP[b.result].text}</p>}
            <div className={inline ? "mt-2" : "mt-4"}><TapOn key={b.n} ms={stage.ms} label={stage.pending > 0 ? `Tap · ${stage.pending} more` : "Tap to continue"} /></div>
          </div>
        </button>
      )}
    </>
  );
}
