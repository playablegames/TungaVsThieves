"use client";
// Designer's mockups 2026-10-07: the two screens every phone shows when the game starts, before the table.
// 1) your secret role on a card, 15s ring, Continue   2) "2 Ancient Stones" and how each side wins, 10s, Continue.
// 3) the deal round the table (DealIntro.tsx). The server holds the first clock for all three (INTRO_MS in server/game.ts).
import { useEffect, useRef, useState } from "react";
import type { Side } from "@/engine/types";
import { DealIntro } from "./DealIntro";

const ROLE_SECONDS = 15;
const STONES_SECONDS = 10;
/** role art cut from the designer's mockups; roles without art get their initial */
const ART: Record<string, string> = { Kisaan: "/role-kisaan.webp" };
const seenKey = (code: string) => `tunga:reveal:${code.toUpperCase()}`;
const BACKDROP = "fixed inset-0 z-40 flex flex-col items-center overflow-y-auto bg-[radial-gradient(90%_55%_at_50%_45%,var(--color-ember-2)_0%,var(--color-ember)_65%,#120903_100%)] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]";
const CONTINUE = "min-h-14 w-full max-w-md shrink-0 border-2 border-brass/80 bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] font-[family-name:var(--font-engraved)] text-[22px] font-bold uppercase tracking-[0.1em] text-stock shadow-[inset_0_1px_0_rgba(255,220,170,.3)] active:translate-y-px";
const TAG = "polygon(6% 0, 94% 0, 100% 50%, 94% 100%, 6% 100%, 0 50%)";
const FEATHER: React.CSSProperties = {
  maskImage: "linear-gradient(to right, transparent, #000 8%, #000 92%, transparent), linear-gradient(to bottom, transparent, #000 8%, #000 88%, transparent)",
  maskComposite: "intersect",
};

export function revealSeen(code: string): boolean {
  try { return localStorage.getItem(seenKey(code)) === "1"; } catch { return false; }
}

/** Seconds left on a countdown that starts when the screen opens; calls onZero once at 0. */
function useCountdown(seconds: number, onZero: () => void) {
  const [left, setLeft] = useState(seconds);
  const zero = useRef(onZero);
  useEffect(() => { zero.current = onZero; });
  useEffect(() => {
    const end = Date.now() + seconds * 1000;
    const t = setInterval(() => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) { clearInterval(t); zero.current(); }
    }, 250);
    return () => clearInterval(t);
  }, [seconds]);
  return left;
}

export function RoleReveal({ code, role, side, names, mySeat, onDone }: {
  code: string; role: string; side: Side; names: string[]; mySeat: number; onDone: () => void;
}) {
  const [step, setStep] = useState<"role" | "stones" | "deal">("role");
  function done() {
    try { localStorage.setItem(seenKey(code), "1"); } catch {}
    onDone();
  }
  if (step === "role") return <RoleStep role={role} side={side} onDone={() => setStep("stones")} />;
  if (step === "stones") return <StonesStep onDone={() => setStep("deal")} />;
  return <DealIntro names={names} mySeat={mySeat} onDone={done} />;
}

function RoleStep({ role, side, onDone }: { role: string; side: Side; onDone: () => void }) {
  const left = useCountdown(ROLE_SECONDS, onDone);
  const r = 46, c = 2 * Math.PI * r;
  const thief = side === "T";
  return (
    <div role="dialog" aria-modal aria-labelledby="role-title" className={`${BACKDROP} pt-[6dvh]`}>
      <h1 id="role-title" className="bg-[linear-gradient(180deg,#f7d58a_0%,#d9a043_100%)] bg-clip-text font-display text-[46px] font-bold leading-tight text-transparent">Your role</h1>
      <p className="mt-2 text-center font-display text-[16px] font-normal leading-snug text-stock/90">
        This is your secret role.<br />Keep it hidden from the other players.
      </p>

      {/* the role card: cream stock, gold double rule, the art, the name between two ornaments */}
      <div className="flip-in relative mt-7 aspect-[505/713] shrink-0 rounded-xl bg-[radial-gradient(120%_90%_at_50%_40%,#f7e6c4_0%,#ecd3a3_100%)] shadow-[0_18px_40px_-10px_rgba(0,0,0,.8)]" style={{ width: "min(62vw, 280px)" }}>
        <div aria-hidden className="absolute inset-[9px] rounded-md border border-[#c08a3a]" />
        <div aria-hidden className="absolute inset-[13px] rounded-sm border border-[#c08a3a]/50" />
        <Diamond className="absolute left-1/2 top-[6px] -translate-x-1/2" />
        <Diamond className="absolute bottom-[6px] left-1/2 -translate-x-1/2" />
        <div className="absolute inset-x-0 top-[22%] flex justify-center px-[12%]">
          {ART[role]
            // eslint-disable-next-line @next/next/no-img-element -- static art
            ? <img src={ART[role]} alt="" className="w-full" />
            : <span aria-hidden className="font-display text-[64px] font-black text-card-ink/80">{role.slice(0, 1)}</span>}
        </div>
        <div className="absolute inset-x-[16%] top-[63%] flex flex-col items-center">
          <Rule />
          <p className="my-1.5 font-[family-name:var(--font-engraved)] text-[clamp(18px,7vw,30px)] font-bold uppercase leading-none tracking-wide text-card-ink">{role}</p>
          <Rule />
          <p className={`mt-2 text-[11px] font-extrabold uppercase tracking-[0.18em] ${thief ? "text-crimson-deep" : "text-marigold-deep"}`}>{thief ? "Team Thieves" : "Team Tunga"}</p>
        </div>
      </div>

      <div className="relative mt-7 grid h-[104px] w-[104px] shrink-0 place-items-center" role="timer" aria-label={`${left} seconds`}>
        <svg viewBox="0 0 104 104" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="52" cy="52" r={r} fill="#160b04" stroke="#4a3220" strokeWidth="5" />
          <circle cx="52" cy="52" r={r} fill="none" stroke="#f0a32e" strokeWidth="5" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - left / ROLE_SECONDS)} className="transition-[stroke-dashoffset] duration-300" />
        </svg>
        <span className="relative flex flex-col items-center leading-none">
          <span className="font-sans text-[40px] font-medium tabular-nums text-stock">{left}</span>
          <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.15em] text-stock/80">Seconds</span>
        </span>
      </div>

      <button type="button" onClick={onDone} className={`mt-6 rounded-2xl ${CONTINUE}`}>Continue</button>
    </div>
  );
}

function StonesStep({ onDone }: { onDone: () => void }) {
  const left = useCountdown(STONES_SECONDS, onDone);
  const r = 24, c = 2 * Math.PI * r;
  return (
    <div role="dialog" aria-modal aria-labelledby="stones-title" className={`${BACKDROP} pt-4`}>
      <div className="relative grid h-14 w-14 shrink-0 place-items-center self-end" role="timer" aria-label={`${left} seconds`}>
        <svg viewBox="0 0 56 56" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="28" cy="28" r={r} fill="#160b04" stroke="#4a3220" strokeWidth="3" />
          <circle cx="28" cy="28" r={r} fill="none" stroke="#f0a32e" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - left / STONES_SECONDS)} className="transition-[stroke-dashoffset] duration-300" />
        </svg>
        <span className="relative font-display text-[20px] font-bold tabular-nums text-stock">{left}</span>
      </div>

      <svg viewBox="0 0 200 12" className="mt-1 h-3 w-[48%] shrink-0" aria-hidden>
        <path d="M0 6h88M112 6h88" stroke="#b07a2c" strokeWidth="1.2" /><path d="M100 1l6 5-6 5-6-5z" fill="none" stroke="#e0a24a" strokeWidth="1.4" />
      </svg>
      <h1 id="stones-title" className="mt-4 text-center font-display text-[38px] font-bold leading-tight text-stock">
        <span className="text-brass">2</span> Ancient Stones
      </h1>
      <p className="text-center font-display text-[18px] font-normal text-stock/85">are hidden among the players.</p>

      <div className="mt-6 w-full max-w-md shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
        <img src="/stones-intro.webp" alt="The Tunga Stone (gold) and the Bhadra Stone (blue)" width={700} height={330} className="w-full" style={FEATHER} />
        <div className="-mt-3 grid grid-cols-2 gap-4 px-1">
          <Plate>Tunga Stone</Plate>
          <Plate>Bhadra Stone</Plate>
        </div>
      </div>

      <div className="mt-6 flex w-full max-w-md shrink-0 flex-col gap-3">
        <WinRow tone="tunga" line="Both Stones with the villagers" result="Tunga wins" />
        <WinRow tone="thief" line="Any Stone with a thief" result="Thieves win" />
      </div>

      <button type="button" onClick={onDone} className={`mt-8 rounded-full ${CONTINUE}`}>Continue</button>
    </div>
  );
}

/** the name plate under each Stone: a gold-edged tag with clipped ends */
function Plate({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-brass/80 p-px" style={{ clipPath: TAG }}>
      <div className="bg-ember py-2 text-center font-display text-[15px] font-bold uppercase tracking-wide text-[#f3c66b]" style={{ clipPath: TAG }}>{children}</div>
    </div>
  );
}

function WinRow({ tone, line, result }: { tone: "tunga" | "thief"; line: string; result: string }) {
  return (
    <div className={`flex items-center gap-4 rounded-xl border px-4 py-4 ${tone === "tunga" ? "border-[#3e3a22] bg-[#1b1a0e]" : "border-[#4a1d12] bg-[#24100b]"}`}>
      <span className="grid w-12 shrink-0 place-items-center text-[#f6cf86]">
        {tone === "tunga"
          ? <svg width="44" height="34" viewBox="0 0 44 34" fill="currentColor" aria-hidden><circle cx="13" cy="9" r="7" /><circle cx="31" cy="9" r="7" /><path d="M0 34v-6a9 9 0 0 1 9-9h8a9 9 0 0 1 9 9v6zM24 34v-6a11 11 0 0 0-2.4-6.8A9 9 0 0 1 27 19h8a9 9 0 0 1 9 9v6z" /></svg>
          : <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden><path d="M20 2C12 2 7 9 7 17v4c-3 2-6 6-6 12v5h38v-5c0-6-3-10-6-12v-4C33 9 28 2 20 2z" fill="currentColor" /><ellipse cx="20" cy="19" rx="9" ry="8" fill="#24100b" /><path d="M13 18q3-2 5 1M27 18q-3-2-5 1" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>}
      </span>
      <span className="h-12 w-px shrink-0 bg-brass/30" aria-hidden />
      <p className="font-display text-[16px] leading-snug text-stock/90">
        {line}<br /><b className="text-[20px] font-bold uppercase tracking-wide text-[#f3c66b]">→ {result}</b>
      </p>
    </div>
  );
}

function Diamond({ className = "" }: { className?: string }) {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" className={className} aria-hidden>
      <path d="M11 1l5 6-5 6-5-6z" fill="#ecd3a3" stroke="#b07a2c" strokeWidth="1.2" /><circle cx="11" cy="7" r="1.6" fill="#b07a2c" />
    </svg>
  );
}

function Rule() {
  return (
    <svg viewBox="0 0 200 12" className="h-3 w-full" aria-hidden>
      <path d="M0 6h88M112 6h88" stroke="#8a5a1c" strokeWidth="1.2" /><path d="M100 1l6 5-6 5-6-5z" fill="none" stroke="#8a5a1c" strokeWidth="1.2" /><circle cx="100" cy="6" r="1.5" fill="#8a5a1c" />
    </svg>
  );
}
