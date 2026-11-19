"use client";
// THE TABLE (owner + team 2026-11-19, approved sketch "village-classy" with the dusk plum circle): the night
// village, players as the card back round the courtyard (your seat shows your role card), the centre panel with
// whose turn it is and what just happened, the countdown top right, your real cards on the mat. Tap a card → its
// screen opens (CardSheet). Pass is the small button. One fixed design size (layout.ts) scaled to the phone.
import { useEffect, useState, useSyncExternalStore } from "react";
import { play } from "@/lib/sfx";
import type { Card, Move } from "@/rules/game";
import type { TableView } from "@/server/game";
import { Centre } from "./Centre";
import { CardFace, CardSheet } from "./CardSheet";
import { H, HAND_TOP, W } from "./layout";
import { Seats } from "./Seats";
import { useTableSounds } from "./useTableSounds";
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

/** who the game is waiting on — they glow gold */
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

const RING = 2 * Math.PI * 19;

export function Table({ view, deadline, now, total = 20, onMove, initialOpen = null }: {
  view: TableView; deadline: number | null; now: () => number; total?: number; onMove: (m: Move) => void;
  /** dev preview only: start with this card's screen open */
  initialOpen?: Card | null;
}) {
  const scale = useScale();
  const t = useClock(now);
  const [open, setOpen] = useState<Card | null>(initialOpen);
  const you = view.you;
  const me = view.players[you];
  const hand = me?.hand ?? [];
  const myTurn = view.phase.kind === "turn" && view.phase.seat === you;
  const left = deadline && t !== null ? Math.max(0, (deadline - t) / 1000) : null;
  useTableSounds(view, left);

  // your cards in their printed near-square shape: big when you hold 2, smaller and overlapping when you hold 5
  const n = hand.length;
  const cw = n <= 2 ? 150 : n === 3 ? 124 : 100;
  const step = n > 1 ? Math.min(cw + 16, (W - 24 - cw) / (n - 1)) : 0;
  const x0 = (W - (cw + step * (n - 1))) / 2;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#15142c]">
      <div className="absolute left-1/2 top-1/2 origin-center" style={{ width: W, height: H, transform: `translate(-50%,-50%) scale(${scale})`, fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
        <VillageScene />

        <div className="absolute inset-x-3.5 top-3 z-10 flex h-[46px] items-center justify-between">
          <span className="size-10" aria-hidden />
          <div className="rounded-xl bg-[#021230d1] px-3.5 py-[7px] font-[family-name:var(--font-cinzel)] text-[12.5px] font-bold tracking-[2px] text-[#f7bb1f] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)]">
            ROUND {view.round} OF {view.rounds}
          </div>
          <div className="relative grid size-11 place-items-center font-[family-name:var(--font-cinzel)] text-[19px] font-bold text-[#f7bb1f]" aria-label={left !== null ? `${Math.ceil(left)} seconds left` : undefined}>
            {left !== null && (
              <>
                <svg className="absolute inset-0" viewBox="0 0 44 44" aria-hidden>
                  <circle cx={22} cy={22} r={19} fill="#021230" stroke="rgba(247,187,31,.2)" strokeWidth={3} />
                  <circle cx={22} cy={22} r={19} fill="none" stroke="#f7bb1f" strokeWidth={3} strokeLinecap="round" transform="rotate(-90 22 22)"
                    strokeDasharray={`${RING * Math.min(1, left / total)} 999`} />
                </svg>
                <span className="relative">{Math.ceil(left)}</span>
              </>
            )}
          </div>
        </div>

        <Centre view={view} />
        <Seats players={view.players} you={you} myRole={me?.role ?? null} active={activeSeats(view)} />

        <div className="absolute inset-x-0 bottom-0 z-[1]" style={{ top: HAND_TOP }}>
          <div className="absolute inset-0 shadow-[0_-10px_24px_rgba(0,0,0,.5)]" style={{ background: "linear-gradient(rgba(2,10,30,.35), rgba(2,8,24,.9)), repeating-linear-gradient(90deg, rgba(255,231,166,.035) 0 1px, transparent 1px 12px), repeating-linear-gradient(0deg, #0e1a3c 0 6px, #0a1532 6px 12px)" }} />
          <p className="absolute inset-x-0 top-10 text-center text-[12px] text-[#ffe7a6d9]">{myTurn ? "Your turn — tap a card" : "Your cards"}</p>
          <div className="absolute inset-x-0 top-[74px]" style={{ height: cw }}>
            {hand.map((c, i) => {
              const off = i - (n - 1) / 2;
              return (
                <button key={i} onClick={() => { play("tap"); setOpen(c); }} aria-label={c}
                  className="tt-card absolute top-0 rounded-[8px] shadow-[0_10px_18px_rgba(0,0,0,.6)] active:scale-95"
                  style={{ left: x0 + i * step, transform: `rotate(${off * (n <= 2 ? 6 : 4)}deg) translateY(${Math.abs(off) * 4}px)`, transformOrigin: "50% 120%" }}>
                  <CardFace c={c} width={cw} />
                </button>
              );
            })}
          </div>
          {myTurn && (
            <button onClick={() => onMove({ kind: "pass" })} className="absolute bottom-[22px] left-1/2 -translate-x-1/2 rounded-full bg-[#021230e6] px-6 py-[7px] text-[13px] font-semibold text-[#ffe7a6] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)]">
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
