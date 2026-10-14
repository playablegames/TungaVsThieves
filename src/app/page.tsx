"use client";
/* Hallmark · genre: atmospheric · macrostructure: Workbench (app, portrait) · design-system: DESIGN.md · designed-as-app */
// Title screen (designer's mockup 2026-10-07; two ways in, 2026-10-09): PLAY WITH FRIENDS (a table + the invite lobby),
// PLAY WITH BOTS (a table of bots, the game starts at once), or join friends with a code. Your name is asked after you
// choose. How to play is one tap away.
import { Suspense, useEffect, useRef, useState } from "react";
import { startHomeMusicOnFirstTap, stopHomeMusic } from "@/lib/music";
import { useRouter, useSearchParams } from "next/navigation";
import { api, saveToken, useHydrated } from "@/lib/client";
import { HowToPlay } from "@/components/HowToPlay";
import { MotionSettings } from "@/components/MotionSettings";

const NAME_KEY = "tunga:name";
const LEARNED = "tunga:learned";
/** Play with bots (designer 2026-10-12: "must open a screen to add however many bots we want"): 4 to 11 bots —
 *  5 to 12 players — 5 to start with */
const BOTS_MIN = 4, BOTS_MAX = 11, BOTS_START = 5;

function savedName(): string {
  try { return localStorage.getItem(NAME_KEY) ?? ""; } catch { return ""; }
}

export default function Home() {
  return <Suspense><Entry /></Suspense>;
}

function Entry() {
  const router = useRouter();
  const invited = (useSearchParams().get("code") ?? "").toUpperCase().slice(0, 5);
  const [code, setCode] = useState(invited);
  const [ask, setAsk] = useState<null | "create" | "join" | "bots" | "learn">(null);
  // LEARN BY PLAYING (2026-10-09): offered once to a first-time visitor — skippable
  // (read only once hydrated: the server can't see this phone's storage)
  const hydrated = useHydrated();
  // the festive Mohanam plays softly under the cover after the first tap; it stops when you go to a table
  useEffect(() => { startHomeMusicOnFirstTap(); return () => stopHomeMusic(); }, []);
  const [skipped, setSkipped] = useState(false);
  const newHere = hydrated && !skipped && (() => { try { return localStorage.getItem(LEARNED) === null; } catch { return false; } })();
  const skipLearn = () => { setSkipped(true); try { localStorage.setItem(LEARNED, "skipped"); } catch {} };
  const [rules, setRules] = useState(false);
  const [comfort, setComfort] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bots, setBots] = useState(BOTS_START);
  const nameRef = useRef<HTMLInputElement>(null);
  const codeOk = code.trim().length === 5;

  function choose(kind: "create" | "join" | "bots" | "learn") {
    setError(null);
    setName(savedName());
    setAsk(kind);
    // (2026-10-12, "bot picker doesn't work") the keyboard only opens when there is no name yet: popping it over the
    // bots stepper moved the sheet under the finger and the − / + taps were lost
    if (!savedName()) setTimeout(() => nameRef.current?.focus(), 50);
  }

  async function go() {
    if (!ask || !name.trim()) return;
    setError(null); setBusy(true);
    try { localStorage.setItem(NAME_KEY, name.trim()); } catch {}
    try {
      if (ask === "learn") {
        try { localStorage.setItem(LEARNED, "yes"); } catch {}
        const t = await api.tutorial(name);
        saveToken(t.code, t.token);
        router.push(`/g/${t.code}`);
        return;
      }
      // (2026-10-14) Play with bots: the table is seated, dealt and started in ONE call (it was three)
      const r = ask === "join" ? await api.join(code.trim().toUpperCase(), name) : ask === "bots" ? await api.createWithBots(name, bots) : await api.create(name);
      saveToken(r.code, r.token);
      router.push(`/g/${r.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center px-6 pb-10 pt-[9dvh]">
      {/* firelit brown wash behind the emblem — this screen only */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[radial-gradient(90%_55%_at_50%_30%,var(--color-ember-2)_0%,var(--color-ember)_65%,#120903_100%)]" />

      <h1 className="sr-only">Tunga vs Thieves</h1>
      {/* THE COVER, ALIVE (designer: "the cover = the home screen"; 2026-10-13): the box art with a slow cinematic push-in,
          the two Stones glowing on the shrine steps, dust drifting up through the light, the emblem in the sky */}
      <div aria-hidden className="relative -mx-6 -mt-[9dvh] aspect-[1060/1484] w-[calc(100%+3rem)] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
        <img src="/art/cover.webp" alt="" fetchPriority="high" decoding="async" className="cover-pushin absolute inset-0 h-full w-full object-cover" />
        <span className="stone-glow" style={{ left: "42.5%", top: "70%", ["--g" as string]: "90,140,255" }} />
        <span className="stone-glow" style={{ left: "58%", top: "70%", ["--g" as string]: "255,170,60", animationDelay: "-1.3s" }} />
        {Array.from({ length: 16 }, (_, i) => (
          <span key={i} className="dust-mote" style={{ left: `${(i * 37 + 11) % 96}%`, top: `${40 + ((i * 23) % 50)}%`, animationDuration: `${9 + (i % 5) * 2}s`, animationDelay: `${-i * 1.1}s` }} />
        ))}
        <div className="absolute inset-x-0 bottom-0 h-[28%] bg-gradient-to-b from-transparent to-[#120903]" />
        {/* the title in the sky (the emblem card covered the villagers — screen check 2026-10-13) */}
        <p className="cover-title absolute inset-x-0 top-[3%] text-center font-[family-name:var(--font-engraved)] font-black uppercase leading-[.95] text-[#ffe2a3]">
          <span className="block text-[clamp(30px,10vw,44px)] tracking-[0.08em]">Tunga</span>
          <span className="block text-[clamp(13px,4vw,18px)] tracking-[0.4em] text-[#f3c66b]">vs</span>
          <span className="block text-[clamp(30px,10vw,44px)] tracking-[0.08em]">Thieves</span>
        </p>
      </div>

      <div className="-mt-6 flex w-full flex-col gap-7">
        {newHere && !invited && (
          <div className="stage-in -mb-2 rounded-2xl border-2 border-[#f0a32e]/80 bg-[#2a1a08] p-3 text-center">
            <p className="text-[15px] text-stock">New here? Learn in a short guided game against bots.</p>
            <div className="mt-2 flex items-center justify-center gap-5">
              <button type="button" onClick={() => choose("learn")} className="nudge min-h-11 rounded-full bg-[#f0a32e] px-5 text-[14px] font-bold uppercase tracking-wide text-card-ink">Learn by playing</button>
              <button type="button" onClick={skipLearn} className="min-h-11 text-[14px] text-stock/70 underline underline-offset-2">Skip</button>
            </div>
          </div>
        )}
        <button type="button" disabled={busy || (!!invited && !codeOk)} onClick={() => choose(invited ? "join" : "create")}
          className="relative flex min-h-16 w-full items-center justify-center rounded-full border-2 border-brass/80 btn-primary px-12 font-[family-name:var(--font-engraved)] text-[21px] font-bold uppercase tracking-[0.12em] text-stock shadow-[inset_0_1px_0_rgba(255,220,170,.35),0_10px_30px_-8px_rgba(0,0,0,.7)] transition-transform active:translate-y-px disabled:opacity-50">
          {invited ? `Join table ${invited}` : "Play with friends"}
          <svg aria-hidden viewBox="0 0 24 24" className="absolute right-6 size-6 fill-none stroke-stock stroke-2"><path d="M9 5l7 7-7 7" /></svg>
        </button>

        {!invited && (
          <button type="button" disabled={busy} onClick={() => choose("bots")}
            className="-mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-full border-2 border-brass/80 bg-black/40 font-[family-name:var(--font-engraved)] text-[18px] font-bold uppercase tracking-[0.12em] text-stock active:translate-y-px disabled:opacity-50">
            <span aria-hidden>🤖</span> Play with bots
          </button>
        )}

        <div className="flex items-center gap-3 font-[family-name:var(--font-engraved)] text-[13px] font-semibold uppercase tracking-[0.2em] text-stock/85">
          <span className="h-px flex-1 bg-brass/50" /><span aria-hidden className="text-brass">◇</span>
          {invited ? "or start your own" : "or join friends"}
          <span aria-hidden className="text-brass">◇</span><span className="h-px flex-1 bg-brass/50" />
        </div>

        {invited ? (
          <button type="button" disabled={busy} onClick={() => choose("create")}
            className="min-h-14 rounded-2xl border border-brass/70 bg-black/40 font-[family-name:var(--font-engraved)] text-[15px] font-semibold uppercase tracking-[0.25em] text-stock active:translate-y-px disabled:opacity-50">
            Create a table
          </button>
        ) : (
          <div className="flex gap-4">
            <label htmlFor="code" className="sr-only">Table code</label>
            <input id="code" value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter" && code.trim().length === 5) choose("join"); }}
              placeholder="CODE" autoCapitalize="characters" autoComplete="off" spellCheck={false}
              className="min-h-14 w-0 flex-1 rounded-2xl border-2 border-brass/80 bg-black/40 text-center font-[family-name:var(--font-engraved)] text-[17px] font-semibold uppercase tracking-[0.25em] text-stock caret-brass outline-none placeholder:text-stock/80 focus:border-brass" />
            <button type="button" disabled={busy || !codeOk} onClick={() => choose("join")}
              className="min-h-14 flex-1 rounded-2xl border-2 border-brass/80 bg-black/40 font-[family-name:var(--font-engraved)] text-[15px] font-semibold uppercase tracking-[0.25em] text-stock transition active:translate-y-px disabled:border-brass/30 disabled:text-stock/45">
              Join
            </button>
          </div>
        )}

        {error && !ask && <p role="alert" className="rounded-xl bg-crimson-deep p-3 text-center text-[14px]">{error}</p>}
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => setRules(true)} className="min-h-11 px-4 text-[15px] font-semibold text-brass underline underline-offset-4">How to play</button>
          <button type="button" onClick={() => setComfort(true)} className="min-h-11 px-3 text-[13px] text-stock/60 underline underline-offset-4">Motion &amp; comfort</button>
          <a href="/privacy" className="min-h-11 px-3 py-2.5 text-[13px] text-stock/60 underline underline-offset-4">Privacy</a>
        </div>
      </div>
      {comfort && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" onClick={() => setComfort(false)}>
          <div role="dialog" aria-label="Motion and comfort" onClick={(e) => e.stopPropagation()} className="stage-in flex w-full max-w-md flex-col gap-3 rounded-t-3xl border-t-2 border-brass/70 bg-ember px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
            <MotionSettings />
            <button type="button" onClick={() => setComfort(false)} className="min-h-12 rounded-full border-2 border-brass/70 text-[14px] font-bold uppercase tracking-wide text-stock">Done</button>
          </div>
        </div>
      )}
      {rules && <HowToPlay onClose={() => setRules(false)} onLearn={() => { setRules(false); choose("learn"); }} />}

      {ask && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60" onClick={() => !busy && setAsk(null)}>
          <form role="dialog" aria-labelledby="name-title" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); void go(); }}
            className="stage-in flex w-full max-w-md flex-col gap-4 rounded-t-3xl border-t-2 border-brass/70 bg-ember px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
            <h2 id="name-title" className="text-center font-[family-name:var(--font-engraved)] text-[15px] font-semibold uppercase tracking-[0.2em] text-stock">
              {ask === "join" ? `Joining ${code.trim().toUpperCase()}` : "What do they call you?"}
            </h2>
            <label htmlFor="name" className="sr-only">Your name</label>
            <input id="name" ref={nameRef} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="nickname"
              className="min-h-14 rounded-2xl border-2 border-brass/80 bg-black/40 px-4 text-center text-[17px] text-stock caret-brass outline-none placeholder:text-stock/40" />
            {ask === "bots" && (
              <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-brass/50 bg-black/30 px-3 py-2">
                <button type="button" aria-label="One bot fewer" disabled={busy || bots <= BOTS_MIN} onClick={() => setBots((b) => Math.max(BOTS_MIN, b - 1))}
                  className="size-12 rounded-full border-2 border-brass/70 text-[24px] font-bold text-stock disabled:opacity-30">−</button>
                <p className="text-center text-stock" aria-live="polite">
                  <span className="block font-display text-[22px] font-bold leading-tight">{bots} bots</span>
                  <span className="text-[13px] text-stock/70">{bots + 1} players</span>
                </p>
                <button type="button" aria-label="One bot more" disabled={busy || bots >= BOTS_MAX} onClick={() => setBots((b) => Math.min(BOTS_MAX, b + 1))}
                  className="size-12 rounded-full border-2 border-brass/70 text-[24px] font-bold text-stock disabled:opacity-30">+</button>
              </div>
            )}
            {error && <p role="alert" className="rounded-xl bg-crimson-deep p-3 text-center text-[14px]">{error}</p>}
            <button type="submit" disabled={busy || !name.trim()}
              className="min-h-14 rounded-full border-2 border-brass/80 btn-primary font-[family-name:var(--font-engraved)] text-[17px] font-bold uppercase tracking-[0.12em] text-stock active:translate-y-px disabled:opacity-50">
              {busy ? "…" : ask === "create" ? "Open the table" : ask === "bots" || ask === "learn" ? "Start the game" : "Take a seat"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

