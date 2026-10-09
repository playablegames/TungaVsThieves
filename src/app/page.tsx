"use client";
/* Hallmark · genre: atmospheric · macrostructure: Workbench (app, portrait) · design-system: DESIGN.md · designed-as-app */
// Title screen (designer's mockup 2026-10-07; two ways in, 2026-10-09): PLAY WITH FRIENDS (a table + the invite lobby),
// PLAY WITH BOTS (a table of bots, the game starts at once), or join friends with a code. Your name is asked after you
// choose. How to play is one tap away.
import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, saveToken, useHydrated } from "@/lib/client";
import { CARD } from "@/lib/cards";
import { CardIcon } from "@/components/CardIcon";
import type { Card } from "@/engine/types";

const NAME_KEY = "tunga:name";
const LEARNED = "tunga:learned";
/** Play with bots: you and this many bots (6 players) */
const BOTS = 5;

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
  const [skipped, setSkipped] = useState(false);
  const newHere = hydrated && !skipped && (() => { try { return localStorage.getItem(LEARNED) === null; } catch { return false; } })();
  const skipLearn = () => { setSkipped(true); try { localStorage.setItem(LEARNED, "skipped"); } catch {} };
  const [rules, setRules] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const codeOk = code.trim().length === 5;

  function choose(kind: "create" | "join" | "bots" | "learn") {
    setError(null);
    setName(savedName());
    setAsk(kind);
    setTimeout(() => nameRef.current?.focus(), 50);
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
      const r = ask === "join" ? await api.join(code.trim().toUpperCase(), name) : await api.create(name);
      saveToken(r.code, r.token);
      if (ask === "bots") {
        // a table of bots, and the game begins at once
        for (let i = 0; i < BOTS; i++) await api.addBot(r.code, r.token);
        await api.start(r.code, r.token);
      }
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
      {/* eslint-disable-next-line @next/next/no-img-element -- static art, no optimisation needed */}
      <img src="/emblem.webp" alt="" width={500} height={710}
        className="w-[min(78vw,340px)] [mask-composite:intersect] [mask-image:linear-gradient(to_right,transparent,#000_7%,#000_93%,transparent),linear-gradient(to_bottom,transparent,#000_5%,#000_95%,transparent)] drop-shadow-[0_0_40px_rgba(224,162,74,.18)]" />

      <div className="mt-8 flex w-full flex-col gap-7">
        {newHere && !invited && (
          <div className="stage-in -mb-2 rounded-2xl border-2 border-[#f0a32e]/80 bg-[#2a1a08] p-3 text-center">
            <p className="text-[15px] text-stock">New here? Learn in a short guided game against bots.</p>
            <div className="mt-2 flex items-center justify-center gap-5">
              <button type="button" onClick={() => choose("learn")} className="min-h-11 rounded-full bg-[#f0a32e] px-5 text-[14px] font-bold uppercase tracking-wide text-card-ink">Learn by playing</button>
              <button type="button" onClick={skipLearn} className="min-h-11 text-[14px] text-stock/70 underline underline-offset-2">Skip</button>
            </div>
          </div>
        )}
        <button type="button" disabled={busy || (!!invited && !codeOk)} onClick={() => choose(invited ? "join" : "create")}
          className="relative flex min-h-16 w-full items-center justify-center rounded-full border-2 border-brass/80 bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] px-12 font-[family-name:var(--font-engraved)] text-[21px] font-bold uppercase tracking-[0.12em] text-stock shadow-[inset_0_1px_0_rgba(255,220,170,.35),0_10px_30px_-8px_rgba(0,0,0,.7)] transition-transform active:translate-y-px disabled:opacity-50">
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
        <button type="button" onClick={() => setRules(true)} className="mx-auto min-h-11 px-4 text-[15px] font-semibold text-brass underline underline-offset-4">How to play</button>
      </div>
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
            {error && <p role="alert" className="rounded-xl bg-crimson-deep p-3 text-center text-[14px]">{error}</p>}
            <button type="submit" disabled={busy || !name.trim()}
              className="min-h-14 rounded-full border-2 border-brass/80 bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] font-[family-name:var(--font-engraved)] text-[17px] font-bold uppercase tracking-[0.12em] text-stock active:translate-y-px disabled:opacity-50">
              {busy ? "…" : ask === "create" ? "Open the table" : ask === "bots" || ask === "learn" ? "Start the game" : "Take a seat"}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

/** HOW TO PLAY (2026-10-09 — research: Court of Shadows and Wingspan teach before the first game). Everything here is the
 *  game's own text: the win lines from the Stones screen, the turn as the engine plays it, the printed card texts. */
function HowToPlay({ onClose, onLearn }: { onClose: () => void; onLearn: () => void }) {
  const cards: Card[] = ["FAISLA", "KUNDLI", "TALASHI", "HERA_PHERI", "BATWARA", "TEER_KAMAN", "DAL_BADAL"];
  const h = "font-[family-name:var(--font-engraved)] text-[13px] font-bold uppercase tracking-[0.2em] text-brass";
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div role="dialog" aria-labelledby="htp" onClick={(e) => e.stopPropagation()}
        className="stage-in flex max-h-[88dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl border-t-2 border-brass/70 bg-ember px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 text-[15px] leading-snug text-stock">
        <h2 id="htp" className="text-center font-display text-[26px] font-bold">How to play</h2>
        <button type="button" onClick={onLearn} className="min-h-12 rounded-full bg-[#f0a32e] font-[family-name:var(--font-engraved)] text-[15px] font-bold uppercase tracking-[0.1em] text-card-ink">🧑‍🏫 Learn by playing</button>
        <section>
          <p className={h}>The two Stones</p>
          <p className="mt-1">Everyone is secretly a <b>villager</b> or a <b>thief</b>. Two Stones are hidden in the cards.</p>
          <p className="mt-1"><b className="text-[#f3c66b]">Both Stones with the villagers — Tunga wins.</b><br /><b className="text-crimson-soft">Any Stone with a thief — Thieves win.</b></p>
        </section>
        <section>
          <p className={h}>Your turn</p>
          <p className="mt-1">Pick up the cards passed to you. Play a <b>matching pair</b> to use its power — or play nothing. Then pass 3 cards to the next player.</p>
        </section>
        <section>
          <p className={h}>The cards</p>
          <ul className="mt-2 flex flex-col gap-2">
            {cards.map((c) => (
              <li key={c} className="flex gap-3"><CardIcon c={c} className="w-7 shrink-0" />
                <span><b>{CARD[c].name}</b> — {CARD[c].text}</span></li>
            ))}
            <li className="flex gap-3"><CardIcon c="STONE_1" className="w-7 shrink-0" /><span><b>Stones</b> — {CARD.STONE_1.text}</span></li>
          </ul>
        </section>
        <section>
          <p className={h}>Talk</p>
          <p className="mt-1">Talk out loud. Tap any player to tell the table <b>🌾 Villager, 🫵 Thief, 🔮 their role or 💎 Stone</b> — true or a lie.</p>
        </section>
        <section>
          <p className={h}>The screen</p>
          <ul className="mt-1 flex flex-col gap-1.5">
            <li><b>The middle</b> — the table&rsquo;s diary: every move, claim and vote. Tap it to see everything.</li>
            <li><b>Tap a player</b> — 🌾 Villager · 🫵 Thief · 🔮 Role · 💎 Stone (true or a lie), throw 🍅 😂, or 🤫 whisper.</li>
            <li><b>Mark ✓ ! ?</b> — your private note on a player. Only you see it.</li>
            <li><b>Under a name</b> — 🫵 / 🌾 how often called a thief / a villager; 💎✓/✗ said to hold a Stone.</li>
            <li><b>On a player</b> — the number is cards held, the dots are votes, 💤 is away.</li>
            <li><b>Tap yourself</b> — quick lines like &ldquo;Not me!&rdquo;</li>
            <li><b>Top</b> — ☰ menu (peek at your role, alerts, sound), 🎙 your mic, the history, the clock.</li>
          </ul>
        </section>
        <section>
          <p className={h}>The end</p>
          <p className="mt-1">After 3 rounds, anyone holding a Stone may surrender it to the village. Then a last vote: the one voted out gives their cards to the village.</p>
        </section>
        <button type="button" onClick={onClose} className="min-h-12 rounded-full border-2 border-brass/80 font-[family-name:var(--font-engraved)] text-[15px] font-bold uppercase tracking-[0.12em]">Got it</button>
      </div>
    </div>
  );
}
