"use client";
// The Table Stage — what every phone shows at the same moment when something is played.
import type { Beat, Tone } from "@/lib/beats";
import type { StageSnapshot } from "@/lib/stage";
import { CardFace } from "./ui";

const TONE: Record<Tone, { ring: string; title: string }> = {
  vote: { ring: "ring-marigold", title: "text-marigold-soft" },
  lethal: { ring: "ring-crimson", title: "text-crimson-soft" },
  relic: { ring: "ring-jade", title: "text-jade-soft" },
  gold: { ring: "ring-gold", title: "text-marigold-soft" },
  neutral: { ring: "ring-raise-2", title: "text-ink" },
};

const STAMP: Record<NonNullable<Beat["result"]>, { text: string; cls: string }> = {
  hit: { text: "HIT", cls: "text-crimson-soft" },
  miss: { text: "MISS", cls: "text-ink-2" },
  out: { text: "OUT", cls: "text-crimson-soft" },
  saved: { text: "SAVED", cls: "text-jade-soft" },
  none: { text: "NOBODY OUT", cls: "text-ink-2" },
};

export function Stage({ stage, skip }: { stage: StageSnapshot; skip: () => void }) {
  const b = stage.current;
  return (
    <>
      {/* screen readers hear every beat; nobody has to watch the screen to follow the table */}
      <p className="sr-only" aria-live="polite">{b ? `${b.title}. ${b.detail ?? ""}` : ""}</p>
      {b && b.big && (
        <button type="button" onClick={skip} aria-label="Next"
          className="fixed inset-0 z-40 flex items-center justify-center bg-paper/75 p-4 backdrop-blur-sm">
          <div className={`stage-in w-full max-w-sm rounded-2xl bg-paper-2 p-5 text-left ring-2 ${TONE[b.tone].ring}`}>
            {b.private && <p className="mb-2 text-[11px] font-extrabold uppercase tracking-widest text-jade-soft">Only you see this</p>}
            {b.card && (
              <div className="mb-4 flex gap-3">
                {[0, 1].map((i) => (
                  <div key={i} className="stage-card" style={{ animationDelay: `${i * 90}ms` }}><CardFace c={b.card!} size="md" /></div>
                ))}
              </div>
            )}
            <p className={`font-display text-[26px] font-black leading-tight ${TONE[b.tone].title}`}>{b.title}</p>
            {b.detail && <p className="mt-1 text-[15px] leading-snug text-ink-2">{b.detail}</p>}
            {b.cards && b.cards.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">{b.cards.map((c, i) => <CardFace key={i} c={c} size="sm" />)}</div>
            )}
            {b.result && <p className={`stage-stamp mt-3 inline-block rounded border-2 border-current px-3 py-1 font-display text-xl font-black tracking-widest ${STAMP[b.result].cls}`}>{STAMP[b.result].text}</p>}
            <p className="mt-4 text-[12px] text-muted">{stage.pending > 0 ? `${stage.pending} more · ` : ""}tap to continue</p>
          </div>
        </button>
      )}
      {b && !b.big && (
        <button type="button" onClick={skip}
          className="stage-in fixed inset-x-3 top-16 z-40 mx-auto max-w-md rounded-xl bg-paper-2/95 px-4 py-3 text-left text-[14px] ring-1 ring-rim">
          <b>{b.title}</b>{b.detail ? <span className="text-ink-2"> — {b.detail}</span> : null}
        </button>
      )}
    </>
  );
}
