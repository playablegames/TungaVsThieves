"use client";
// The Table Stage — what every phone shows at the same moment when something is played.
import { CARD } from "@/lib/cards";
import type { Beat, Tone } from "@/lib/beats";
import type { StageSnapshot } from "@/lib/stage";

const TONE: Record<Tone, string> = {
  vote: "ring-amber-500 bg-amber-950/90",
  lethal: "ring-red-600 bg-red-950/90",
  relic: "ring-emerald-500 bg-emerald-950/90",
  gold: "ring-yellow-600 bg-yellow-950/90",
  neutral: "ring-stone-600 bg-stone-900/95",
};

const STAMP: Record<NonNullable<Beat["result"]>, string> = {
  hit: "HIT", miss: "MISS", out: "OUT", saved: "SAVED", none: "NOBODY OUT",
};

export function Stage({ stage, skip }: { stage: StageSnapshot; skip: () => void }) {
  const b = stage.current;
  return (
    <>
      {/* screen readers hear every beat; nobody has to watch the screen to follow the table */}
      <p className="sr-only" aria-live="polite">{b ? `${b.title}. ${b.detail ?? ""}` : ""}</p>
      {b && b.big && (
        <button type="button" onClick={skip} aria-label="Next"
          className="fixed inset-0 z-40 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-sm">
          <div className={`stage-in w-full max-w-sm rounded-2xl p-5 text-left ring-2 ${TONE[b.tone]}`}>
            {b.private && <p className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-300">Only you see this</p>}
            {b.card && (
              <div className="mb-3 flex gap-2">
                {[0, 1].map((i) => (
                  <span key={i} className={`stage-card rounded-lg px-3 py-4 text-sm font-black ${CARD[b.card!].tone}`} style={{ animationDelay: `${i * 90}ms` }}>
                    {CARD[b.card!].name}
                  </span>
                ))}
              </div>
            )}
            <p className="text-2xl font-black leading-tight">{b.title}</p>
            {b.detail && <p className="mt-1 text-base text-stone-200">{b.detail}</p>}
            {b.cards && b.cards.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {b.cards.map((c, i) => <span key={i} className={`rounded px-2 py-1 text-xs font-bold ${CARD[c].tone}`}>{CARD[c].name}</span>)}
              </div>
            )}
            {b.result && <p className="stage-stamp mt-3 inline-block -rotate-3 rounded border-2 border-current px-3 py-1 text-xl font-black tracking-widest">{STAMP[b.result]}</p>}
            {stage.pending > 0 && <p className="mt-3 text-xs text-stone-400">{stage.pending} more · tap to skip</p>}
          </div>
        </button>
      )}
      {b && !b.big && (
        <button type="button" onClick={skip}
          className="stage-in fixed inset-x-3 bottom-4 z-40 rounded-xl bg-stone-800/95 px-4 py-3 text-left text-sm ring-1 ring-stone-600">
          <b>{b.title}</b>{b.detail ? ` — ${b.detail}` : ""}
        </button>
      )}
    </>
  );
}

/** The last big thing that happened — always visible, so a glance away never loses the thread. */
export function LastPlay({ last }: { last: Beat | null }) {
  if (!last) return null;
  return (
    <p className="rounded-lg bg-stone-900 px-3 py-2 text-sm text-stone-300 ring-1 ring-stone-700">
      <span className="text-xs font-bold uppercase tracking-widest text-stone-500">Last play </span>
      {last.title}{last.detail ? ` — ${last.detail}` : ""}
    </p>
  );
}
