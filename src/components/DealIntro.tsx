"use client";
// Designer's mockup 2026-10-07: the deal, played out round the table — Collecting all cards → Shuffling → Dealing →
// Almost done → Cards distributed! Game begins now. Plain CSS (globals.css "deal-*"), lighting kept low on purpose.
// Runs after the Stones screen; the server's first clock waits for it (INTRO_MS in server/game.ts).
import { useEffect, useRef, useState } from "react";

export const DEAL_MS = 8400;
const STAGES = [
  { at: 0, key: "collect", title: "Collecting all cards", sub: "in the center…" },
  { at: 1800, key: "shuffle", title: "Shuffling cards…" },
  { at: 3600, key: "deal", title: "Dealing cards…" },
  { at: 5300, key: "deal", title: "Almost done…" },
  { at: 6400, key: "done", title: "Cards distributed!", sub: "Game begins now." },
] as const;
const HAND = 2; // cards each player is dealt (engine/setup.ts)
const AVATAR = ["#f5a623", "#c77dd6", "#f2766b", "#6aaee8", "#7cc47a", "#a9a9a9", "#e3c565", "#5fc4b8", "#e88fb4", "#9b8cf0", "#4f7cf0", "#f08c5a"];

/** one or two letters: two when another player shares the first letter (Ka / Ki) */
function initials(names: string[]) {
  return names.map((n) => {
    const first = n.slice(0, 1).toUpperCase();
    const clash = names.some((m) => m !== n && m.slice(0, 1).toUpperCase() === first);
    return clash ? first + n.slice(1, 2).toLowerCase() : first;
  });
}

export function DealIntro({ names, mySeat, onDone }: { names: string[]; mySeat: number; onDone: () => void }) {
  const [stage, setStage] = useState(0);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    const timers = STAGES.slice(1).map((s, i) => setTimeout(() => setStage(i + 1), s.at));
    timers.push(setTimeout(() => done.current(), DEAL_MS));
    return () => timers.forEach(clearTimeout);
  }, []);

  const n = names.length;
  const big = n > 12;
  const ini = initials(names);
  // you at the bottom, then the table in seat order (same ring as the lobby and the table)
  const seats = names.map((name, seat) => {
    const k = (seat - mySeat + n) % n;
    const a = Math.PI / 2 + (k * 2 * Math.PI) / n;
    return { seat, name, x: 50 + 40 * Math.cos(a), y: 50 + 43 * Math.sin(a) };
  });
  const s = STAGES[stage];

  return (
    <div role="dialog" aria-modal aria-label="Dealing the cards"
      className="fixed inset-0 z-40 flex items-center justify-center overflow-hidden bg-[radial-gradient(70%_45%_at_50%_50%,#2a1608_0%,var(--color-ember)_60%,#120903_100%)]">
      <div className="relative h-[min(100dvh,820px)] w-full max-w-md landscape:max-w-4xl">
        {/* a low lamp over the table centre */}
        <div aria-hidden className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(240,163,46,.16)_0%,transparent_70%)]" />

        {seats.map((p) => {
          const me = p.seat === mySeat;
          return (
            <div key={p.seat} className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
              <span className={`grid place-items-center rounded-full font-medium text-card-ink ${big ? "h-9 w-9 text-[14px]" : "h-11 w-11 text-[17px]"} ${me ? "outline-[3px] outline-offset-2 outline-jade" : ""}`}
                style={{ background: AVATAR[p.seat % AVATAR.length] }}>{ini[p.seat]}</span>
              <span className={`-mt-1 max-w-[72px] truncate rounded-full border bg-ember px-2 py-px font-medium ${big ? "text-[10px]" : "text-[11px]"} ${me ? "border-jade text-jade-soft" : "border-brass/60 text-stock"}`}>{p.name}</span>
            </div>
          );
        })}

        {/* collect: one card from every seat slides into the centre */}
        {s.key === "collect" && seats.map((p, i) => (
          <CardBack key={`c${p.seat}`} className="deal-in" style={{ "--x": `${p.x}%`, "--y": `${p.y}%`, "--r": `${(i * 47) % 40 - 20}deg`, animationDelay: `${(i / n) * 700}ms` } as React.CSSProperties} />
        ))}
        {(s.key === "collect" || s.key === "deal") && <Pile thin={stage === 3} />}

        {/* shuffle: four cards circling in a faint ring */}
        {s.key === "shuffle" && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden>
            <div className="deal-ring absolute left-1/2 top-1/2 h-36 w-56 rounded-[50%] border border-[#f0a32e]/30" />
            {[0, 90, 180, 270].map((a) => (
              <div key={a} className="deal-orbit absolute left-0 top-0" style={{ "--a": `${a}deg` } as React.CSSProperties}>
                <div style={{ transform: "translate(-50%,-50%) translateX(54px)" }}><CardFace /></div>
              </div>
            ))}
          </div>
        )}

        {/* deal: HAND waves, one card to each seat, round the table in order */}
        {s.key === "deal" && Array.from({ length: HAND }).flatMap((_, w) => seats.map((p, i) => (
          <CardBack key={`d${w}-${p.seat}`} className="deal-out" style={{ "--x": `${p.x}%`, "--y": `${p.y}%`, "--r": `${(i * 53) % 50 - 25}deg`, animationDelay: `${w * 1300 + (i / n) * 1100}ms` } as React.CSSProperties} />
        )))}

        {/* the words, over the top of the table */}
        <div className={`pointer-events-none absolute inset-x-[18%] text-center ${s.key === "done" ? "top-1/2 -translate-y-1/2" : "top-[24%] landscape:top-[17%]"}`}>
          {s.key === "done" && (
            <svg viewBox="0 0 100 100" className="deal-check mx-auto mb-4 h-24 w-24" aria-hidden>
              <circle cx="50" cy="50" r="44" fill="none" stroke="#e0a24a" strokeWidth="4" />
              <path d="M30 52l13 13 27-29" fill="none" stroke="#e0a24a" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <p key={stage} aria-live="polite" className="stage-in font-display text-[clamp(22px,7vw,30px)] font-bold leading-tight text-[#f3d9a4]">{s.title}</p>
          {"sub" in s && <p className="mt-1 font-display text-[18px] font-normal text-stock/85">{s.sub}</p>}
          {s.key === "done" && (
            <svg viewBox="0 0 200 12" className="mx-auto mt-3 h-3 w-40" aria-hidden>
              <path d="M0 6h88M112 6h88" stroke="#b07a2c" strokeWidth="1" /><path d="M100 1l6 5-6 5-6-5z" fill="none" stroke="#e0a24a" strokeWidth="1.4" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function CardFace() {
  return (
    <div className="grid h-[54px] w-[38px] place-items-center rounded-[5px] border border-[#c08a3a] bg-[#1c1108] shadow-[0_0_10px_rgba(240,163,46,.25)]">
      <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden><path d="M7 1l6 8-6 8-6-8z" fill="none" stroke="#e0a24a" strokeWidth="1.4" /><circle cx="7" cy="9" r="1.4" fill="#e0a24a" /></svg>
    </div>
  );
}

function CardBack({ className, style }: { className: string; style: React.CSSProperties }) {
  return <div aria-hidden className={`absolute ${className}`} style={style}><CardFace /></div>;
}

/** the stack in the middle of the table */
function Pile({ thin }: { thin: boolean }) {
  const layers = thin ? 3 : 6;
  return (
    <div aria-hidden className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-150 landscape:scale-110">
      {Array.from({ length: layers }).map((_, i) => (
        <div key={i} className="absolute" style={{ transform: `translate(-50%, calc(-50% - ${i * 2}px)) rotate(${((i * 37) % 14) - 7}deg)` }}><CardFace /></div>
      ))}
    </div>
  );
}
