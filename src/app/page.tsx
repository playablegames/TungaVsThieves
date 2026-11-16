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
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col items-center px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] font-[family-name:var(--font-text)]">
      {/* the box's night sky behind everything — this screen only */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-night-deep" />

      <h1 className="sr-only">Tunga vs Thieves</h1>
      {/* THE BOX FRONT (2026-11-16, "tunga box latest"): the night painting with a slow push-in, the two Stones glowing on
          the shrine, fireflies drifting up, and the box's own gold logo in the sky where the box has it */}
      <div aria-hidden className="relative -mx-5 aspect-[1064/1478] w-[calc(100%+2.5rem)] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
        <img src="/art/cover-night.webp" alt="" fetchPriority="high" decoding="async" className="cover-pushin absolute inset-0 h-full w-full object-cover" />
        <span className="stone-glow" style={{ left: "43%", top: "70%", ["--g" as string]: "255,190,60" }} />
        <span className="stone-glow" style={{ left: "56%", top: "70%", ["--g" as string]: "90,150,255", animationDelay: "-1.3s" }} />
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="dust-mote" style={{ left: `${(i * 37 + 11) % 96}%`, top: `${40 + ((i * 23) % 50)}%`, animationDuration: `${9 + (i % 5) * 2}s`, animationDelay: `${-i * 1.1}s` }} />
        ))}
        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-b from-transparent via-night-deep/80 to-night-deep" />
        {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
        <img src="/art/logo-gold.webp" alt="" decoding="async" className="absolute left-[25%] top-[max(2.5%,env(safe-area-inset-top))] w-[50%] drop-shadow-[0_6px_14px_rgba(0,8,30,.75)]" />
      </div>

      <div className="relative z-10 -mt-[22%] flex w-full flex-1 flex-col justify-end gap-3">
        {newHere && !invited && (
          <div className="stage-in flex items-center rounded-2xl bg-stock text-card-ink shadow-[0_10px_24px_-10px_rgba(0,0,0,.9)]">
            <button type="button" onClick={() => choose("learn")} className="box-focus flex min-h-16 flex-1 items-center gap-3 rounded-l-2xl py-2 pl-4 pr-2 text-left">
              <span className="flex-1">
                <span className="block text-[13px] font-medium text-card-ink/70">First time here?</span>
                <span className="block text-[17px] font-semibold leading-tight">Learn by playing</span>
              </span>
              <svg aria-hidden viewBox="0 0 24 24" className="size-5 shrink-0 fill-none stroke-current stroke-[2.4]"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" onClick={skipLearn} className="box-focus min-h-16 rounded-r-2xl border-l border-card-ink/15 px-4 text-[14px] font-medium text-card-ink/70">Skip</button>
          </div>
        )}
        <button type="button" disabled={busy || (!!invited && !codeOk)} onClick={() => choose(invited ? "join" : "create")}
          className="btn-gold flex min-h-14 w-full items-center justify-center whitespace-nowrap rounded-full px-6 text-[18px] font-semibold">
          {invited ? `Join table ${invited}` : "Play with friends"}
        </button>
        <button type="button" disabled={busy} onClick={() => choose(invited ? "create" : "bots")}
          className="btn-line flex min-h-[52px] w-full items-center justify-center whitespace-nowrap rounded-full px-6 text-[16px] font-semibold">
          {invited ? "Start my own table" : "Play with bots"}
        </button>

        {!invited && (
          <div className="mt-2 flex items-center gap-2">
            <label htmlFor="code" className="shrink-0 text-[14px] text-moon/80">Have a code?</label>
            <input id="code" value={code} maxLength={5} onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter" && code.trim().length === 5) choose("join"); }}
              placeholder="ABCDE" autoCapitalize="characters" autoComplete="off" spellCheck={false}
              className="box-focus min-h-12 w-0 flex-1 rounded-xl border border-moon/30 bg-night/70 text-center text-[16px] font-semibold uppercase tracking-[0.3em] text-white caret-boxgold outline-none placeholder:font-normal placeholder:text-moon/35 focus:border-boxgold" />
            <button type="button" disabled={busy || !codeOk} onClick={() => choose("join")}
              className="btn-line min-h-12 shrink-0 rounded-xl px-5 text-[15px] font-semibold">
              Join
            </button>
          </div>
        )}

        {error && !ask && <p role="alert" className="rounded-xl bg-crimson-deep p-3 text-center text-[14px] text-white">{error}</p>}
        <nav className="mt-1 flex items-center justify-between text-[14px] text-moon/75">
          <button type="button" onClick={() => setRules(true)} className="box-focus min-h-11 whitespace-nowrap rounded-lg px-2 font-medium text-boxgold-soft">How to play</button>
          <button type="button" onClick={() => setComfort(true)} className="box-focus min-h-11 whitespace-nowrap rounded-lg px-2">Settings</button>
          <a href="/privacy" className="box-focus flex min-h-11 items-center whitespace-nowrap rounded-lg px-2">Privacy</a>
        </nav>
      </div>
      {comfort && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-night-deep/70" onClick={() => setComfort(false)}>
          <div role="dialog" aria-label="Settings" onClick={(e) => e.stopPropagation()} className="sheet-up flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-night px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-12px_40px_rgba(0,0,0,.6)]">
            <MotionSettings />
            <button type="button" onClick={() => setComfort(false)} className="btn-line min-h-12 rounded-full text-[15px] font-semibold">Done</button>
          </div>
        </div>
      )}
      {rules && <HowToPlay onClose={() => setRules(false)} onLearn={() => { setRules(false); choose("learn"); }} />}

      {ask && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-night-deep/70" onClick={() => !busy && setAsk(null)}>
          {/* a sheet of card stock: cream, brown ink — the printed card's own colours */}
          <form role="dialog" aria-labelledby="name-title" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); void go(); }}
            className="sheet-up flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-stock px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 font-[family-name:var(--font-text)] text-card-ink shadow-[0_-12px_40px_rgba(0,0,0,.6)]">
            <h2 id="name-title" className="text-[20px] font-semibold leading-tight">
              {ask === "join" ? `Joining table ${code.trim().toUpperCase()}` : "What do they call you?"}
            </h2>
            <label htmlFor="name" className="sr-only">Your name</label>
            <input id="name" ref={nameRef} value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="nickname"
              className="min-h-14 rounded-xl border-[1.5px] border-card-ink/30 bg-white/60 px-4 text-[17px] font-medium text-card-ink caret-marigold-deep outline-none placeholder:font-normal placeholder:text-card-ink/40 focus:border-marigold-deep" />
            {ask === "bots" && (
              <div className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-card-ink/20 px-2 py-2">
                <button type="button" aria-label="One bot fewer" disabled={busy || bots <= BOTS_MIN} onClick={() => setBots((b) => Math.max(BOTS_MIN, b - 1))}
                  className="size-12 rounded-full border-[1.5px] border-card-ink/40 text-[24px] font-medium transition-transform duration-150 active:scale-95 disabled:opacity-30">−</button>
                <p className="text-center" aria-live="polite">
                  <span className="block text-[20px] font-semibold leading-tight tabular-nums">{bots} bots</span>
                  <span className="text-[13px] text-card-ink/70">{bots + 1} players at the table</span>
                </p>
                <button type="button" aria-label="One bot more" disabled={busy || bots >= BOTS_MAX} onClick={() => setBots((b) => Math.min(BOTS_MAX, b + 1))}
                  className="size-12 rounded-full border-[1.5px] border-card-ink/40 text-[24px] font-medium transition-transform duration-150 active:scale-95 disabled:opacity-30">+</button>
              </div>
            )}
            {error && <p role="alert" className="rounded-xl bg-crimson-deep p-3 text-center text-[14px] text-white">{error}</p>}
            <button type="submit" disabled={busy || !name.trim()}
              className="btn-gold min-h-14 whitespace-nowrap rounded-full text-[17px] font-semibold">
              {busy ? "One moment…" : ask === "create" ? "Open the table" : ask === "bots" || ask === "learn" ? "Start the game" : "Take a seat"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

