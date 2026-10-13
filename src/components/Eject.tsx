"use client";
// The ejection (2026-10-07, "make it viral like Among Us"): whoever goes out tumbles across the night sky over the
// village while the verdict types itself out — then, since 2026-10-09, "Munna is out. Their role stays hidden."
// (roles are never shown to the table; the Teer Kaman shooter or Faisla caller learns it on their own phone).
// The old reveal ("was a Thief", thieves remaining) still plays when a role is public. Tap to skip.
import { useEffect, useState } from "react";
import { THIEF_ROLES } from "@/engine/setup";
import { LAST_WORDS_MS } from "@/lib/beats";
import { TapOn } from "./ui";
import { roleArt } from "./CardIcon";

const STARS = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 37.7) % 100, y: (i * 23.3) % 62, s: 1 + ((i * 7) % 3), t: 1.6 + ((i * 13) % 20) / 10,
}));

export function Eject({ name, initials, colour, thief, role, remaining, onDone, onSkipWords, lastWords = false, mine = false, speed = 1, killer = null, secret = null }: {
  name: string; initials: string; colour: string; thief: boolean; role: string | null; remaining: number; onDone: () => void;
  /** (designer 2026-10-14: "role hidden is salt on the wound") who put them out — "only Asha knows…" */
  killer?: string | null;
  /** the role, when THIS phone put them out (the Faisla caller / Teer Kaman shooter) — their private reveal */
  secret?: { role: string; thief: boolean } | null;
  /** a human put out speaks for 10 s first, in a spotlight, everyone else's mic held (designer 2026-10-07) */
  lastWords?: boolean; mine?: boolean;
  /** (designer 2026-10-12) the speaker ends their last words for everyone; anyone else just closes the screen */
  onSkipWords?: () => void;
  speed?: number;
}) {
  // (designer 2026-10-14) three stories, never "their role stays hidden": YOU are out but still in the game · YOU put
  // them out and see the card · everyone else wonders, and only the one who did it knows
  const verdict = mine ? "You're out." : role ? `${name} was ${thief ? "a Thief" : "not a Thief"}.` : `${name} is OUT!`;
  const words = lastWords ? LAST_WORDS_MS : 0;
  const [typed, setTyped] = useState(0);
  const [flying, setFlying] = useState(!lastWords);
  const [left, setLeft] = useState(Math.ceil(words / 1000));
  useEffect(() => {
    let i = 0;
    const tick = lastWords ? setInterval(() => setLeft((x) => Math.max(0, x - 1)), 1000) : undefined;
    const fly = setTimeout(() => setFlying(true), words);
    // type the verdict out once the body is mid-flight, like the original
    const start = setTimeout(() => {
      const t = setInterval(() => { i += 1; setTyped(i); if (i >= verdict.length) clearInterval(t); }, 55);
    }, words + 900);
    // (designer 2026-10-13 evening) the flight + 2 s, then it moves on by itself
    const end = setTimeout(onDone, words + Math.round((secret || !mine ? 5200 : 4000) / speed));
    return () => { clearTimeout(start); clearTimeout(end); clearTimeout(fly); if (tick) clearInterval(tick); };
  }, [verdict, onDone, words, lastWords, speed, secret, mine]);

  return (
    <button type="button" onClick={() => { if (flying) onDone(); }} aria-label={`${verdict} ${role ? `${remaining} ${remaining === 1 ? "thief remains" : "thieves remain"}.` : mine ? "You are still in the game." : secret ? `Only you see it: ${secret.role}.` : killer ? `Only ${killer} knows the role.` : ""} Tap to continue`}
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

      {/* LAST WORDS: standing in the moonlight, mic open, everyone listening */}
      {!flying && (
        <div className="absolute inset-x-6 top-[26%] flex flex-col items-center">
          <span aria-hidden className="absolute -top-16 h-[52vh] w-40 bg-[radial-gradient(ellipse_at_top,rgba(243,226,184,.28),transparent_70%)]" />
          <span className="speaking relative grid h-24 w-24 place-items-center rounded-full text-[36px] font-medium text-card-ink" style={{ background: colour }}>{initials}</span>
          <p className="mt-5 font-[family-name:var(--font-engraved)] text-[13px] font-bold uppercase tracking-[0.3em] text-[#f3c66b]">Last words</p>
          <p className="mt-1 font-display text-[clamp(24px,7vw,32px)] font-bold text-stock">{mine ? "Speak — everyone is listening" : name}</p>
          <p className="mt-3 font-display text-[44px] font-bold tabular-nums text-stock/80">🎙️ {left}</p>
          <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); (onSkipWords ?? onDone)(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); (onSkipWords ?? onDone)(); } }}
            className="mt-6 grid min-h-12 min-w-32 place-items-center rounded-full border-2 border-brass/70 bg-black/40 px-6 font-[family-name:var(--font-engraved)] text-[15px] font-bold uppercase tracking-[0.12em] text-stock">
            {mine ? "Done — skip" : "Skip"}
          </span>
        </div>
      )}
      {/* the one who goes out, tumbling across the sky */}
      {flying && <span aria-hidden className="eject-fly absolute left-1/2 top-[38%] -ml-9 grid h-[72px] w-[72px] place-items-center rounded-full text-[28px] font-medium text-card-ink shadow-[0_0_30px_6px_rgba(255,255,255,.12)]"
        style={{ background: colour }}>{initials}</span>}

      <div className={`absolute inset-x-6 top-[56%] -translate-y-1/2 ${flying ? "" : "hidden"}`}>
        <p className="min-h-[2.6em] font-display text-[clamp(24px,7vw,34px)] font-bold leading-tight text-stock">
          {verdict.slice(0, typed)}<span className="opacity-60">{typed < verdict.length ? "▌" : ""}</span>
        </p>
        {typed >= verdict.length && !role && mine && (
          <div className="rise mt-3 flex flex-col items-center gap-2">
            <p className="font-display text-[20px] text-stock/90">…but you&rsquo;re <b className="text-jade-soft">still in the game</b>.</p>
            <p className="text-[15px] text-stock/75">Talk. Accuse. Bluff. Help your team win the Stones.</p>
          </div>
        )}
        {typed >= verdict.length && !role && !mine && secret && (
          <div className="mt-4 flex flex-col items-center">
            <p className="rise font-[family-name:var(--font-engraved)] text-[12px] font-bold uppercase tracking-[0.25em] text-jade-soft">Only you see this</p>
            {roleArt(secret.role)
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={roleArt(secret.role)!} alt={secret.role} className="flip-in mt-2 w-28 rounded-lg shadow-[0_14px_30px_-8px_rgba(0,0,0,.9)]" />
              : <p className="flip-in mt-2 font-display text-[28px] font-bold">{secret.role}</p>}
            <p className={`stage-stamp mt-3 inline-block rounded border-4 border-current px-4 py-1 font-[family-name:var(--font-engraved)] text-[26px] font-black tracking-[0.12em] ${secret.thief ? "text-crimson-soft" : "text-[#f3c66b]"}`}>
              {secret.thief ? "CHOR! CAUGHT" : "A VILLAGER…"}
            </p>
            <p className="rise mt-2 text-[14px] text-stock/75">{secret.thief ? "You caught a thief. Tell them — or keep it to yourself." : "Oops. Say it — or let them wonder."}</p>
          </div>
        )}
        {typed >= verdict.length && !role && !mine && !secret && (
          <div className="mt-4 flex flex-col items-center">
            <div className="flip-in relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/art/cards/back.webp" alt="" className="w-24 rounded-lg shadow-[0_14px_30px_-8px_rgba(0,0,0,.9)]" />
              <span className="stage-stamp absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded border-[3px] border-crimson-soft bg-black/50 px-2 font-[family-name:var(--font-engraved)] text-[18px] font-black tracking-[0.15em] text-crimson-soft">SECRET</span>
            </div>
            <p className="rise mt-3 font-display text-[20px] text-stock/90">Who were they, really?</p>
            {killer
              ? <p className="rise mt-1 text-[15px] text-stock/80">Only <b className="text-[#f3c66b]">{killer}</b> knows… <b className="text-jade-soft">ask {killer}!</b></p>
              : <p className="rise mt-1 text-[15px] text-stock/80">Nobody knows. Start talking.</p>}
          </div>
        )}
        <div className="mt-6"><TapOn ms={Math.round(4000 / speed)} /></div>
        {typed >= verdict.length && role && (
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
