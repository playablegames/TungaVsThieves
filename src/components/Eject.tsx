"use client";
// The ejection (2026-10-07, "make it viral like Among Us"): whoever goes out tumbles across the night sky over the
// village while the verdict types itself out — "Munna was a Thief." / "Munna was not a Thief." — then how many
// thieves remain. The one screen people screenshot. Tap to skip.
import { useEffect, useState } from "react";
import { THIEF_ROLES } from "@/engine/setup";

const STARS = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 37.7) % 100, y: (i * 23.3) % 62, s: 1 + ((i * 7) % 3), t: 1.6 + ((i * 13) % 20) / 10,
}));

export function Eject({ name, initials, colour, thief, role, remaining, onDone }: {
  name: string; initials: string; colour: string; thief: boolean; role: string; remaining: number; onDone: () => void;
}) {
  const verdict = `${name} was ${thief ? "a Thief" : "not a Thief"}.`;
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    // type the verdict out once the body is mid-flight, like the original
    let i = 0;
    const start = setTimeout(() => {
      const t = setInterval(() => { i += 1; setTyped(i); if (i >= verdict.length) clearInterval(t); }, 55);
    }, 900);
    const end = setTimeout(onDone, 5600);
    return () => { clearTimeout(start); clearTimeout(end); };
  }, [verdict, onDone]);

  return (
    <button type="button" onClick={onDone} aria-label={`${verdict} ${remaining} ${remaining === 1 ? "thief remains" : "thieves remain"}. Tap to continue`}
      className="fixed inset-0 z-50 overflow-hidden bg-[linear-gradient(180deg,#05040c_0%,#0d0a1f_55%,#1f1007_100%)] text-center">
      {STARS.map((st, i) => (
        <span key={i} aria-hidden className="twinkle absolute rounded-full bg-[#fff6dc]"
          style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, ["--t" as string]: `${st.t}s` }} />
      ))}
      {/* the moon and the village below */}
      <span aria-hidden className="absolute right-[12%] top-[9%] h-14 w-14 rounded-full bg-[#f3e2b8] shadow-[0_0_40px_10px_rgba(243,226,184,.25)]" />
      <svg aria-hidden viewBox="0 0 400 90" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[18vh] w-full">
        <path d="M0 90V62l18-10 18 10V48l22-16 22 16v14h14V44l10-22 10 22v18h20V52l24-18 24 18v10h18V40l6-14 6 14v22h26V50l20-14 20 14v12h16V46l26-20 26 20v16h30V54l16-10 16 10v36z" fill="#0a0604" />
        <path d="M296 62c4-22 10-36 22-46m-22 46c-6-20-16-30-30-34m30 34c10-16 22-22 36-22" stroke="#0a0604" strokeWidth="5" fill="none" />
      </svg>

      {/* the one who goes out, tumbling across the sky */}
      <span aria-hidden className="eject-fly absolute left-1/2 top-[38%] -ml-9 grid h-[72px] w-[72px] place-items-center rounded-full text-[28px] font-medium text-card-ink shadow-[0_0_30px_6px_rgba(255,255,255,.12)]"
        style={{ background: colour }}>{initials}</span>

      <div className="absolute inset-x-6 top-[56%] -translate-y-1/2">
        <p className="min-h-[2.6em] font-display text-[clamp(24px,7vw,34px)] font-bold leading-tight text-stock">
          {verdict.slice(0, typed)}<span className="opacity-60">{typed < verdict.length ? "▌" : ""}</span>
        </p>
        {typed >= verdict.length && (
          <>
            <p className={`rise mt-2 font-[family-name:var(--font-engraved)] text-[13px] font-bold uppercase tracking-[0.25em] ${thief ? "text-crimson-soft" : "text-[#f3c66b]"}`}>{role}</p>
            <p className="rise mt-4 font-display text-[18px] text-stock/75" style={{ animationDelay: "350ms" }}>
              {remaining} {remaining === 1 ? "thief remains" : "thieves remain"}.
            </p>
          </>
        )}
      </div>
    </button>
  );
}

/** how many thieves are still at the table, from what everyone can see: thief role cards in play minus those revealed */
export function thievesRemaining(rolesInPlay: string[], revealed: (string | null)[]): number {
  const total = rolesInPlay.filter((r) => THIEF_ROLES.includes(r)).length;
  const caught = revealed.filter((r) => r && THIEF_ROLES.includes(r)).length;
  return Math.max(0, total - caught);
}
