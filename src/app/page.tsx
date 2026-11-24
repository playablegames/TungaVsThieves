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
import { AgeGate } from "@/components/AgeGate";
import { NICKNAMES, isMinor, readGate } from "@/lib/gate";
import { NAME_MAX } from "@/lib/names";

const NAME_KEY = "tunga:name";
const LEARNED = "tunga:learned";
/** (owner 2026-11-24) phone + email are asked ONCE, both optional, never to under-18s; "yes" once the sheet was sent */
const CONTACT_KEY = "tunga:contact";
function contactAsked(): boolean {
  try { return localStorage.getItem(CONTACT_KEY) === "yes"; } catch { return true; }
}
/** 10-digit Indian mobile from whatever was typed (+91, 0, spaces, dashes), or null */
function cleanPhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}
/** Play with bots opens your table's lobby with 4 bots (owner 2026-11-23: one step); more bots are added there —
 *  4 to 12 players, the box's own range (rules 1.1; 2026-11-18 it stopped at 5 players) — 5 to start with */
const BOTS_START = 4; // owner 2026-11-22: start at 4 bots + you = 5 players, 2 rounds
/** the sheet's heading and one line under it, per way in (2026-11-18 Make / join sheet) */
const SHEET: Record<"create" | "join" | "bots" | "learn", { title: string; line: string; button: string }> = {
  create: { title: "Open a table", line: "Friends join with a code you’ll share next", button: "Open the table" },
  join: { title: "Join table", line: "", button: "Take a seat" },
  bots: { title: "Play with bots", line: "Your table opens with 4 bots. Add more there.", button: "Open my table" },
  learn: { title: "Learn by playing", line: "A table of bots, explained as you go", button: "Start the game" },
};

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
  // (2026-11-16, real-phone check) the phone's own bars take the box's night on this screen: the status bar follows
  // theme-color, the bottom bar follows the page behind it. Put back when you leave for a table (still the old look).
  useEffect(() => {
    const NIGHT = "#021230";
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const was = { theme: meta?.content, bg: document.body.style.background };
    if (meta) meta.content = NIGHT;
    document.body.style.background = NIGHT;
    return () => { if (meta && was.theme) meta.content = was.theme; document.body.style.background = was.bg; };
  }, []);
  const [rules, setRules] = useState(false);
  const [comfort, setComfort] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [askContact, setAskContact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const codeOk = code.trim().length === 5;
  // JOIN checks the code BEFORE the name (2026-11-18): found + how many sit there, or why you can't sit
  const [peek, setPeek] = useState<null | "looking" | { open: boolean; players: number; reason: string | null }>(null);
  useEffect(() => {
    if (ask !== "join") return;
    let live = true;
    api.peek(code.trim().toUpperCase())
      .then((r) => live && setPeek(r))
      .catch((e) => live && setPeek({ open: false, players: 0, reason: (e as Error).message }));
    return () => { live = false; };
  }, [ask, code]);
  const joinBlocked = ask === "join" && (peek === null || peek === "looking" || !peek.open);

  // THE DOOR (2026-11-17): the first Play tap asks age + Terms of use once; under 18 plays with bots only
  const [gateFor, setGateFor] = useState<null | "create" | "join" | "bots" | "learn">(null);
  const minor = hydrated && isMinor();
  function choose(kind: "create" | "join" | "bots" | "learn") {
    setError(null);
    if (!readGate()) { setGateFor(kind); return; }
    if (isMinor()) {
      if (kind === "create" || kind === "join") { setError("Under 18, you can play with bots. Tables with other people open at 18."); return; }
      const nick = NICKNAMES.includes(savedName()) ? savedName() : NICKNAMES[0];
      setName(nick); setAsk(kind); return;
    }
    // (owner 2026-11-23: "why are there 2 steps, play with bots must open the lobby") a known name goes straight to the
    // table's lobby, where bots are added and the game started
    // (2026-11-24) ...unless this phone has not yet been offered the phone + email boxes: then the sheet shows once
    const offer = !contactAsked();
    setAskContact(offer);
    if (kind === "bots" && savedName() && !offer) { void open("bots", savedName()); return; }
    setName(savedName());
    setPeek(kind === "join" ? "looking" : null);
    setAsk(kind);
    // (2026-10-12, "bot picker doesn't work") the keyboard only opens when there is no name yet: popping it over the
    // bots stepper moved the sheet under the finger and the − / + taps were lost
    if (!savedName()) setTimeout(() => nameRef.current?.focus(), 50);
  }

  async function go() {
    if (!ask || !name.trim()) return;
    if (askContact && !minor) {
      const p = phone.trim() ? cleanPhone(phone) : "";
      const m = email.trim().toLowerCase();
      if (p === null) { setError("Check the WhatsApp number: 10 digits"); return; }
      if (m && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m)) { setError("Check the email"); return; }
      if (p || m) void api.contact(name.trim(), p, m).catch(() => {});
      try { localStorage.setItem(CONTACT_KEY, "yes"); } catch {}
    }
    await open(ask, name);
  }
  async function open(ask: "create" | "join" | "bots" | "learn", name: string) {
    setError(null); setBusy(true);
    try { localStorage.setItem(NAME_KEY, name.trim()); } catch {}
    try {
      if (ask === "learn") {
        try { localStorage.setItem(LEARNED, "yes"); } catch {}
        // (2026-11-19) the guided first game went with the old rules: for now it is a plain game with 4 bots (5 players, owner 2026-11-22)
        const t = await api.createWithBots(name, 4);
        saveToken(t.code, t.token);
        router.push(`/g/${t.code}`);
        return;
      }
      // (2026-10-14) Play with bots: the table is seated, dealt and started in ONE call (it was three)
      const r = ask === "join" ? await api.join(code.trim().toUpperCase(), name) : ask === "bots" ? await api.createWithBots(name, BOTS_START) : await api.create(name);
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
      {/* (2026-11-17, owner's phone 442x884, installed app, no hidden bars) the painting GROWS to fill a tall screen so the
          buttons sit at the bottom with no empty band; never shorter than the painting's own shape */}
      <div aria-hidden className="relative -mx-5 w-[calc(100%+2.5rem)] flex-1 overflow-hidden" style={{ minHeight: "min(calc(100vw * 1478 / 1064), calc(28rem * 1478 / 1064))" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
        <img src="/art/cover-night.webp" alt="" fetchPriority="high" decoding="async" className="cover-pushin absolute inset-0 h-full w-full object-cover object-top" />
        <span className="stone-glow" style={{ left: "43%", top: "70%", ["--g" as string]: "255,190,60" }} />
        <span className="stone-glow" style={{ left: "56%", top: "70%", ["--g" as string]: "90,150,255", animationDelay: "-1.3s" }} />
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="dust-mote" style={{ left: `${(i * 37 + 11) % 96}%`, top: `${40 + ((i * 23) % 50)}%`, animationDuration: `${9 + (i % 5) * 2}s`, animationDelay: `${-i * 1.1}s` }} />
        ))}
        <div className="absolute inset-x-0 bottom-0 h-[30%] bg-gradient-to-b from-transparent via-night-deep/80 to-night-deep" />
        {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
        <img src="/art/logo-gold.webp" alt="" decoding="async" className="absolute left-[25%] top-[max(2.5%,env(safe-area-inset-top))] w-[50%] drop-shadow-[0_6px_14px_rgba(0,8,30,.75)]" />
      </div>

      <div className="relative z-10 -mt-[22%] flex w-full flex-col gap-3">
        {minor && <p className="rounded-xl bg-night/80 p-3 text-center text-[14px] text-moon">Under 18: you play with bots. Tables with other people open at 18.</p>}
        {!minor && <button type="button" disabled={busy || (!!invited && !codeOk)} onClick={() => choose(invited ? "join" : "create")}
          className="btn-gold flex min-h-14 w-full items-center justify-center whitespace-nowrap rounded-full px-6 text-[18px] font-semibold">
          {invited ? `Join table ${invited}` : "Play with friends"}
        </button>}
        <button type="button" disabled={busy} onClick={() => choose(invited && !minor ? "create" : "bots")}
          className={`${minor ? "btn-gold min-h-14 text-[18px]" : "btn-line"} flex min-h-[52px] w-full items-center justify-center whitespace-nowrap rounded-full px-6 text-[16px] font-semibold`}>
          {invited && !minor ? "Start my own table" : "Play with bots"}
        </button>
        {/* (owner 2026-11-21) How to play is a main button, not a small link */}
        <button type="button" onClick={() => setRules(true)}
          className="btn-line flex min-h-[52px] w-full items-center justify-center whitespace-nowrap rounded-full px-6 text-[16px] font-semibold">
          How to play
        </button>

        {!invited && !minor && (
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
          <button type="button" onClick={() => setComfort(true)} className="box-focus min-h-11 whitespace-nowrap rounded-lg px-2">Settings</button>
          <a href="/legal" className="box-focus flex min-h-11 items-center whitespace-nowrap rounded-lg px-2">Legal</a>
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
      {gateFor && <AgeGate onClose={() => setGateFor(null)} onDone={() => { const k = gateFor; setGateFor(null); choose(k); }} />}
      {rules && <HowToPlay onClose={() => setRules(false)} onLearn={() => { setRules(false); choose("learn"); }} />}

      {ask && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-night-deep/70" onClick={() => !busy && setAsk(null)}>
          {/* a sheet of card stock: cream, brown ink — the printed card's own colours */}
          <form role="dialog" aria-labelledby="name-title" onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); void go(); }}
            className="sheet-up flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-stock px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 font-[family-name:var(--font-text)] text-card-ink shadow-[0_-12px_40px_rgba(0,0,0,.6)]">
            <span aria-hidden className="mx-auto -mt-2 h-1 w-10 rounded-full bg-card-ink/20" />
            <div className="flex flex-col gap-1">
              <h2 id="name-title" className="font-[family-name:var(--font-engraved)] text-[24px] font-bold uppercase leading-tight tracking-wide text-card-ink">
                {SHEET[ask].title}{ask === "join" && <span className="tracking-[0.2em] text-boxgold-deep"> {code.trim().toUpperCase()}</span>}
              </h2>
              {ask === "join" ? (
                <p aria-live="polite" className={`text-[15px] ${peek && peek !== "looking" && !peek.open ? "font-semibold text-crimson-deep" : "text-card-ink/75"}`}>
                  {peek === null || peek === "looking" ? "Looking for the table…"
                    : peek.open ? `✓ Table found · ${peek.players} here` : peek.reason}
                </p>
              ) : <p className="text-[15px] text-card-ink/75">{minor ? "Pick a nickname, then play" : SHEET[ask].line}</p>}
            </div>
            <label htmlFor="name" className="sr-only">Your name</label>
            {minor ? (
              <select id="name" value={name} onChange={(e) => setName(e.target.value)}
                className="min-h-14 rounded-xl border-[1.5px] border-card-ink/30 bg-white/60 px-4 text-[17px] font-medium text-card-ink outline-none focus:border-marigold-deep">
                {NICKNAMES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            ) : <input id="name" ref={nameRef} value={name} maxLength={NAME_MAX} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="nickname"
              className="min-h-14 rounded-xl border-[1.5px] border-card-ink/30 bg-white/60 px-4 text-[17px] font-medium text-card-ink caret-marigold-deep outline-none placeholder:font-normal placeholder:text-card-ink/40 focus:border-marigold-deep" />}
            {askContact && !minor && <>
              <label htmlFor="phone" className="sr-only">WhatsApp number</label>
              <input id="phone" type="tel" inputMode="tel" value={phone} maxLength={16} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp number (optional)" autoComplete="tel-national"
                className="min-h-14 rounded-xl border-[1.5px] border-card-ink/30 bg-white/60 px-4 text-[17px] font-medium text-card-ink caret-marigold-deep outline-none placeholder:font-normal placeholder:text-card-ink/40 focus:border-marigold-deep" />
              <label htmlFor="email" className="sr-only">Email</label>
              <input id="email" type="email" inputMode="email" value={email} maxLength={120} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" autoComplete="email"
                className="min-h-14 rounded-xl border-[1.5px] border-card-ink/30 bg-white/60 px-4 text-[17px] font-medium text-card-ink caret-marigold-deep outline-none placeholder:font-normal placeholder:text-card-ink/40 focus:border-marigold-deep" />
              <p className="-mt-2 text-[13px] leading-snug text-card-ink/70">We add your number to the Playable Games WhatsApp group for game nights and offers. <a href="/privacy" className="underline">Privacy</a></p>
            </>}
            {error && <p role="alert" className="rounded-xl bg-crimson-deep p-3 text-center text-[14px] text-white">{error}</p>}
            <button type="submit" disabled={busy || !name.trim() || joinBlocked}
              className="btn-gold min-h-14 whitespace-nowrap rounded-full text-[17px] font-semibold">
              {busy ? "One moment…" : SHEET[ask].button}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

