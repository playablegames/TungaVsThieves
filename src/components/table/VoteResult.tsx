"use client";
// FAISLA RESULT on the table (owner 2026-11-20: open vote, the counts were already live on everyone's screen). When a
// NEW "tally" event arrives: the most-voted card glows red, or — on a tie — "NOBODY IS OUT" shows in the courtyard.
// ~2.5 s, then the table carries on ("X is out" comes from the out event). Roles are never shown. Old tallies stay quiet.
import { useEffect, useRef, useState } from "react";
import type { TableView } from "@/server/game";
import { CY, seatSpot } from "./layout";

type Shown = { key: number; out: number | null };
const HOLD = 2500;

/** who the count put out, if anyone (most votes, no tie) */
export function readTally(e: TableView["events"][number]): Shown {
  const t = ((e.data ?? {}) as { tally?: Record<string, number> }).tally ?? {};
  const top = Math.max(0, ...Object.values(t));
  const leaders = Object.keys(t).filter((k) => t[k] === top);
  return { key: e.n, out: top > 0 && leaders.length === 1 ? Number(leaders[0]) : null };
}

export function VoteResult({ view }: { view: TableView }) {
  const seen = useRef<number | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);
  const tally = view.events.findLast((e) => e.type === "tally");
  const tallyN = tally?.n ?? 0;

  useEffect(() => {
    if (seen.current === null) { seen.current = tallyN; return; } // opening the table: old results stay quiet
    if (!tally || tallyN <= seen.current) return;
    seen.current = tallyN;
    setShown(readTally(tally));
    const id = setTimeout(() => setShown(null), HOLD + 500);
    return () => clearTimeout(id);
  }, [tallyN, tally]);

  if (!shown) return null;
  const p = shown.out !== null ? seatSpot(shown.out, view.you, view.players.length) : null;
  return (
    <div key={shown.key} className="tt-vote pointer-events-none absolute inset-0 z-[3]" style={{ animation: `tt-fade-out .45s ease-in ${HOLD}ms forwards` }}>
      {p ? (
        <div className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[8px]"
          style={{ left: p.x, top: p.y - 12, width: 68, height: 92, boxShadow: "0 0 0 3px #e8434b, 0 0 22px 4px rgba(232,67,75,.6)", animation: "tt-red .9s ease-in-out 3" }} />
      ) : (
        <div className="tt-pop absolute left-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-[14px] px-6 py-3 text-center"
          style={{ top: CY, background: "linear-gradient(#0d1f4a, #061538)", boxShadow: "inset 0 0 0 1.5px rgba(247,187,31,.6), 0 10px 30px rgba(0,0,0,.6)" }}>
          <div className="font-[family-name:var(--font-cinzel)] text-[26px] font-bold tracking-[.1em] text-[#c9bc94]" style={{ textShadow: "0 3px 0 #3a3426, 0 6px 18px rgba(0,0,0,.85)" }}>NOBODY IS OUT</div>
          <div className="mt-1 text-[13px] text-[#ffe7a6b3]">It&apos;s a tie</div>
        </div>
      )}
    </div>
  );
}
