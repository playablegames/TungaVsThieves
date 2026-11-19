"use client";
// THE TABLE (owner 2026-11-19, revamp step 2): the night village, the players round the courtyard, announcements in
// the centre, your real cards on the mat. Tap a card → its screen opens (CardSheet). Pass is the small button.
// One fixed design size (layout.ts) scaled to the phone.
import { useEffect, useState, useSyncExternalStore } from "react";
import { SHORT } from "@/lib/cards";
import type { Card, Move } from "@/rules/game";
import type { TableView } from "@/server/game";
import { ANNOUNCE, Centre } from "./Centre";
import { CardFace, CardSheet } from "./CardSheet";
import { H, HAND_TOP, W } from "./layout";
import { Seats } from "./Seats";
import { MatEdge, VillageScene } from "./VillageScene";
import "./table.css";

const subscribe = (cb: () => void) => { window.addEventListener("resize", cb); return () => window.removeEventListener("resize", cb); };
const fit = () => Math.min(window.innerWidth / W, window.innerHeight / H);
function useScale() { return useSyncExternalStore(subscribe, fit, () => 1); }

/** the clock starts after the first paint, so the server's render and the phone's first render agree */
function useClock(now: () => number) {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => { const id = setInterval(() => setT(now()), 250); return () => clearInterval(id); }, [now]);
  return t;
}

/** who the game is waiting on, for the turn ring */
function activeSeats(v: TableView): number[] {
  const ph = v.phase;
  switch (ph.kind) {
    case "turn": case "pass": case "gift": return [ph.seat];
    case "aim": return [ph.shooter];
    case "bhukamp": return v.players.filter((p) => p.alive && !(p.seat in ph.picks)).map((p) => p.seat);
    case "vote": return v.players.filter((p) => p.alive && !(p.seat in ph.ballots)).map((p) => p.seat);
    default: return [];
  }
}

export function Table({ view, deadline, now, total = 20, onMove, initialOpen = null }: {
  view: TableView; deadline: number | null; now: () => number; total?: number; onMove: (m: Move) => void;
  /** dev preview only: start with this card's screen open */
  initialOpen?: Card | null;
}) {
  const scale = useScale();
  const t = useClock(now);
  const [open, setOpen] = useState<Card | null>(initialOpen);
  const you = view.you;
  const hand = view.players[you]?.hand ?? [];
  const myTurn = view.phase.kind === "turn" && view.phase.seat === you;
  const left = deadline && t !== null ? Math.max(0, (deadline - t) / 1000) : null;
  const last = [...view.events].reverse().find((e) => ANNOUNCE.has(e.type)) ?? null;
  const names = view.players.map((p) => p.name);

  // fan your cards across the mat
  const n = hand.length, cw = 90;
  const step = n > 1 ? Math.min(cw + 6, (W - 60 - cw) / (n - 1)) : 0;
  const x0 = (W - (cw + step * (n - 1))) / 2;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#15142c]">
      <div className="absolute left-1/2 top-1/2 origin-center" style={{ width: W, height: H, transform: `translate(-50%,-50%) scale(${scale})`, fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
        <VillageScene />

        <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-xl bg-[#021230cc] py-1.5 pl-2.5 pr-3 shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6),0_4px_0_rgba(0,0,0,.35)]">
            <b className="font-[family-name:var(--font-cinzel)] text-[13px] font-bold tracking-wider text-[#f7bb1f]">ROUND {view.round}</b>
            {Array.from({ length: view.rounds }, (_, i) => (
              <span key={i} className="size-[9px] rotate-45" style={i < view.round ? { background: "#f7bb1f", boxShadow: "0 0 6px #f7bb1f" } : { boxShadow: "inset 0 0 0 1.5px rgba(247,187,31,.6)" }} />
            ))}
          </div>
        </div>

        <Centre event={last} names={names} />
        <Seats players={view.players} you={you} active={activeSeats(view)} left={left} total={total} />

        <div className="absolute inset-x-0 bottom-0" style={{ top: HAND_TOP }}>
          <div className="absolute inset-0 shadow-[0_-10px_24px_rgba(0,0,0,.5)]" style={{ background: "linear-gradient(rgba(2,10,30,.35), rgba(2,8,24,.9)), repeating-linear-gradient(90deg, rgba(255,231,166,.035) 0 1px, transparent 1px 12px), repeating-linear-gradient(0deg, #0e1a3c 0 6px, #0a1532 6px 12px)" }} />
          <p className="absolute inset-x-0 top-6 text-center text-[12px] text-[#ffe7a6cc]">{myTurn ? "Your turn — tap a card" : "Your cards"}</p>
          <div className="absolute inset-x-0 top-[62px] h-[150px]">
            {hand.map((c, i) => {
              const mid = (n - 1) / 2, off = i - mid;
              return (
                <button key={i} onClick={() => setOpen(c)} aria-label={c}
                  className="tt-card absolute bottom-0 rounded-[9px] shadow-[0_8px_14px_rgba(0,0,0,.6)] active:scale-95"
                  style={{ left: x0 + i * step, transform: `rotate(${off * 5}deg) translateY(${Math.abs(off) * 5}px)`, transformOrigin: "50% 120%" }}>
                  <CardFace c={c} width={cw} line={SHORT[c]} />
                </button>
              );
            })}
          </div>
          {myTurn && (
            <button onClick={() => onMove({ kind: "pass" })} className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-[#021230e6] px-6 py-2 text-[13px] font-semibold text-[#ffe7a6] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6),0_3px_0_#000a1c]">
              Pass
            </button>
          )}
        </div>
        <MatEdge />

        {open && (
          <CardSheet card={open} hand={hand} myTurn={myTurn} players={view.players} you={you}
            onClose={() => setOpen(null)} onPlay={(m) => { setOpen(null); onMove(m); }} />
        )}
      </div>
    </div>
  );
}
