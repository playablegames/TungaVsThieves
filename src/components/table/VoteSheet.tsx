"use client";
// THE FAISLA VOTE PANEL (owner 2026-11-20): opens over the cards on every living player's phone while a vote is on. OPEN VOTE
// (rule 3.4): every vote shows live — a red count on each name, a ✓ on who has voted, and who voted whom — and you
// can tap another name to change your vote until it closes. Name buttons only, never card backs. No tile for
// yourself (no self vote). No X: you vote, or the clock runs out (no vote in time = no vote).
import type { Move } from "@/rules/game";
import type { TableView } from "@/server/game";
import { HAND_TOP } from "./layout";

type VotePhase = Extract<TableView["phase"], { kind: "vote" }>;
type Ballot = { for: number | null; extra?: boolean };

/** the open count so far: each ballot is 1, the extra vote 2 (rule 5.6) */
export function liveCount(ph: VotePhase, extraVote: number | null): Record<number, number> {
  const out: Record<number, number> = {};
  for (const [v, b] of Object.entries(ph.ballots as Record<string, Ballot>)) {
    if (b.for === null) continue;
    out[b.for] = (out[b.for] ?? 0) + (b.extra && extraVote === Number(v) ? 2 : 1);
  }
  return out;
}

export function VoteSheet({ view, onMove }: { view: TableView; onMove: (m: Move) => void }) {
  const ph = view.phase as VotePhase;
  const you = view.you;
  const ballots = ph.ballots as Record<string, Ballot>;
  const mine = ballots[you];
  const count = liveCount(ph, view.extraVote);
  const others = view.players.filter((p) => p.alive && p.seat !== you);
  const hasExtra = view.extraVote === you;
  const cast = (to: number | null, extra = mine?.extra ?? false) => {
    if (mine && mine.for === to && Boolean(mine.extra) === extra) return;
    onMove({ kind: "vote", for: to, ...(extra && to !== null ? { extra: true } : {}) });
  };

  return (
    // a PANEL over your cards (owner 2026-11-20: keep the table in view) — the courtyard above stays live: red bubbles on
    // the seats, the latest vote in the centre, the clock top right
    <div className="absolute inset-x-0 bottom-0 z-[4] flex flex-col px-3 pb-4 pt-6" style={{ top: HAND_TOP + 14 }} role="group" aria-label={ph.final ? "Final vote" : "Faisla vote"}>
      <div className="flex items-baseline justify-center gap-2">
        <h3 className="text-[17px] font-bold text-white">{ph.final ? "Final vote — who goes out?" : "Who goes out?"}</h3>
        {/* you have no button (no self vote), so the votes on YOU show here */}
        <span className="text-[12px]" style={{ color: (count[you] ?? 0) > 0 ? "#ff8a8a" : "#ffe7a680" }}>
          {(count[you] ?? 0) > 0 ? `· ${count[you]} on you` : ""}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {others.map((p) => {
          const on = mine?.for === p.seat;
          const n = count[p.seat] ?? 0;
          const voted = String(p.seat) in ballots;
          return (
            <button key={p.seat} onClick={() => cast(p.seat)} aria-pressed={on}
              aria-label={`${p.name}, ${n} vote${n === 1 ? "" : "s"}${on ? ", your vote" : ""}${voted ? ", has voted" : ""}`}
              className="relative flex h-11 items-center justify-center gap-1 rounded-xl px-2 text-[14px] font-semibold transition-transform active:scale-95"
              style={on
                ? { background: "linear-gradient(#3a2a08, #241804)", color: "#ffe7a6", boxShadow: "inset 0 0 0 2px #f7bb1f, 0 0 16px rgba(247,187,31,.45)" }
                : { background: "linear-gradient(#0d1f4a, #061538)", color: "#fff", boxShadow: "inset 0 0 0 1px rgba(247,187,31,.5)" }}>
              <span className="truncate">{p.name}</span>
              {voted && <span className="text-[12px] text-[#7fd18a]" aria-hidden>✓</span>}
              {n > 0 && (
                <span key={n} className="tt-pop absolute -right-1.5 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[#e8434b] px-1 text-[11.5px] font-bold text-white shadow-[0_0_0_2px_#010818]" aria-hidden>{n}</span>
              )}
            </button>
          );
        })}
        <button onClick={() => cast(null)} aria-pressed={mine?.for === null}
          className="h-11 rounded-xl border-2 border-dashed text-[12.5px] font-semibold uppercase tracking-wide"
          style={mine?.for === null ? { borderColor: "#f7bb1f", color: "#ffe7a6" } : { borderColor: "rgba(247,187,31,.45)", color: "#ffe7a6b3" }}>
          No vote
        </button>
      </div>

      {hasExtra && (
        <button onClick={() => cast(mine?.for ?? null, !mine?.extra)} disabled={!mine || mine.for === null}
          className="mx-auto mt-3 rounded-full px-4 py-1.5 text-[12.5px] font-semibold disabled:opacity-40"
          style={mine?.extra ? { background: "#f7bb1f", color: "#2a1404" } : { color: "#ffe7a6", boxShadow: "inset 0 0 0 1.5px rgba(247,187,31,.7)" }}>
          {mine?.extra ? "Extra vote ON — counts 2" : "Use my extra vote (counts 2)"}
        </button>
      )}
      <p className="mt-auto text-center text-[12px] text-[#ffe7a699]">{mine === undefined ? "Tap a player to vote" : "Tap another player to change your vote"}</p>
    </div>
  );
}
