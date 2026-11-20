// THE PLAYERS round the courtyard (owner + team 2026-11-19, "classy"): every player is the CARD BACK with a gold
// name plate (no card count — owner 2026-11-20); whoever is up glows gold. YOUR seat shows your own role card face-up.
// No piles or Stones are ever shown — the pile passes player to player clockwise and the Stones pass secretly.
/* eslint-disable @next/next/no-img-element */
import { CARD_BACK, roleArt } from "@/components/CardIcon";
import { seatSpot } from "./layout";

export interface SeatInfo { seat: number; name: string; alive: boolean; cards?: number }

export function Seats({ players, you, myRole, active, votes = {} }: {
  players: SeatInfo[]; you: number; myRole: string | null; active: number[];
  /** [3.4] open vote: the live count on each player, a red bubble */
  votes?: Record<number, number>;
}) {
  return (
    <>
      {players.map((p) => {
        const { x, y } = seatSpot(p.seat, you, players.length);
        const turn = active.includes(p.seat) && p.alive;
        const me = p.seat === you;
        const face = me ? roleArt(myRole) : null;
        const ring = turn ? "0 0 0 2.5px #f7bb1f, 0 0 22px rgba(247,187,31,.8)" : me ? "0 0 0 2px #f7bb1f" : "0 0 0 1.5px rgba(247,187,31,.55)";
        return (
          <div key={p.seat} className="absolute z-[2] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: x, top: y, opacity: p.alive ? 1 : 0.4, filter: p.alive ? undefined : "grayscale(1)" }}>
            <div className="relative">
              <img src={face ?? CARD_BACK} alt={me && myRole ? `You are ${myRole}` : ""} draggable={false}
                className="h-[86px] w-[60px] rounded-[6px] object-cover" style={{ boxShadow: `${ring}, 0 8px 16px rgba(0,0,0,.6)` }} />
              {(votes[p.seat] ?? 0) > 0 && (
                <span key={votes[p.seat]} className="tt-pop absolute -right-[9px] -top-2 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-[#e8434b] px-1 text-[12px] font-bold text-white shadow-[0_0_0_2px_#021230]"
                  aria-label={`${votes[p.seat]} votes`}>{votes[p.seat]}</span>
              )}
            </div>
            <div className="relative -mt-1.5 whitespace-nowrap rounded-full bg-[#021230f0] px-3 py-[3px] text-[12.5px] font-semibold"
              style={{ color: me ? "#f7bb1f" : turn ? "#ffe7a6" : "#fff", boxShadow: `inset 0 0 0 ${me || turn ? 1.5 : 1}px rgba(247,187,31,${me || turn ? 1 : 0.55})` }}>
              {me ? `${p.name} · you` : p.name}
            </div>
          </div>
        );
      })}
    </>
  );
}
