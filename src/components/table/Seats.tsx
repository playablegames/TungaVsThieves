// THE PLAYERS round the courtyard (owner 2026-11-19): Warli figure in the seat colour standing on a soft glow, name
// plate under it. The player whose turn it is gets the gold ring that counts down. No piles or stacks are shown —
// the pile passes player to player clockwise and the Stones pass secretly.
import { Figure } from "@/components/Figure";
import { seatColour } from "@/lib/seats";
import { seatSpot } from "./layout";

export interface SeatInfo { seat: number; name: string; alive: boolean }

const GOLD = "#f7bb1f";
const RING = 2 * Math.PI * 33;

export function Seats({ players, you, active, left, total }: {
  players: SeatInfo[]; you: number; active: number[];
  /** seconds left on the active player's clock, and the full clock */
  left: number | null; total: number;
}) {
  return (
    <>
      {players.map((p) => {
        const { x, y } = seatSpot(p.seat, you, players.length);
        const c = seatColour(p.seat).hex;
        const turn = active.includes(p.seat) && p.alive;
        const me = p.seat === you;
        return (
          <div key={p.seat} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: x, top: y, opacity: p.alive ? 1 : 0.35 }}>
            {turn && (
              <>
                <svg className="tt-pulse absolute left-1/2 top-[30px] -translate-x-1/2 -translate-y-1/2" width={74} height={74} viewBox="0 0 74 74" aria-hidden>
                  <circle cx={37} cy={37} r={33} fill="none" stroke="rgba(247,187,31,.2)" strokeWidth={4} />
                  <circle cx={37} cy={37} r={33} fill="none" stroke={GOLD} strokeWidth={4} strokeLinecap="round" transform="rotate(-90 37 37)"
                    strokeDasharray={`${RING * Math.max(0, Math.min(1, (left ?? total) / total))} 999`} style={{ filter: `drop-shadow(0 0 4px ${GOLD})` }} />
                </svg>
                {left !== null && <div className="absolute -top-5 rounded-md bg-[#f7bb1f] px-2 py-px text-[10px] font-bold text-[#021230] shadow-[0_2px_0_#8a6200]">{Math.ceil(left)}s</div>}
              </>
            )}
            <div className="absolute bottom-[22px] -z-10 h-4 w-[58px] rounded-[50%]" style={{ background: `radial-gradient(${c}88, transparent 70%)` }} />
            <div style={{ filter: "drop-shadow(0 3px 2px rgba(0,0,0,.5))" }}>
              <Figure colour={p.alive ? c : "#7d8496"} size={42} label={p.name} />
            </div>
            <div className="mt-0.5 rounded-lg bg-[#021230e0] px-2.5 py-px text-[11.5px] font-semibold" style={{ color: me ? GOLD : "#fff", boxShadow: `inset 0 0 0 1.5px ${me ? GOLD : c + "aa"}` }}>
              {me ? "YOU" : p.name}
            </div>
          </div>
        );
      })}
    </>
  );
}
