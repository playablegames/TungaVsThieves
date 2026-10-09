"use client";
/* Hallmark · genre: atmospheric · macrostructure: Workbench (app, portrait spotlight) · design-system: DESIGN.md · designed-as-app */
// The table, phone-first and portrait: a status line everyone reads the same way (BGA's "${actplayer} must…"),
// a seat strip where the spotlight glows, the table centre, and a dock with your role, your hand and your move.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, saveToken, useGame, useHydrated } from "@/lib/client";
import { beatsFor } from "@/lib/beats";
import type { Action, Card, Side } from "@/engine/types";
import { MIN_PLAYERS } from "@/engine/setup";
import type { PlayerView, PublicPlayer } from "@/engine/view";
import type { ClientState } from "@/server/game";
import { useStage } from "@/lib/stage";
import { Stage } from "./Stage";
import { Decide } from "./Decide";
import { HandRow } from "./Hand";
import { CardIcon } from "./CardIcon";
import { Eject, thievesRemaining } from "./Eject";
import { Confetti, ShareResult } from "./Share";
import { buzz, duck, play, setSound, soundOn, unlockOnFirstTap, type Sound } from "@/lib/sfx";
import { musicDuck, musicOn, setMood, setMusic, startMusicOnFirstTap, stopMusic, type Mood } from "@/lib/music";
import { narrate, narratorOn, setNarrator } from "@/lib/narrator";
import { REACTIONS, ThrowQueue, reactionText, type Throw } from "@/lib/reactions";
import { setPtt, setTalking, usePtt } from "@/lib/ptt";
import { RoleReveal, revealSeen } from "./RoleReveal";
import { TimerRing } from "./ui";
import { useVoice } from "@/lib/voice";
import { useBotSpeech } from "@/lib/botspeech";
import type { ChatMessage } from "@/server/store";
import { useFeed, CAPTION_PREFIX, QUICK_PREFIX, type FeedItem } from "@/lib/feed";
import { useCaptions } from "@/lib/captions";
import { cut, say, setQuiet, useReading } from "@/lib/speech";
import { alertSupport, disableAlerts, enableAlerts, useAlertPresence } from "@/lib/alerts";

type VoiceCtl = ReturnType<typeof useVoice>;

export default function Game({ code }: { code: string }) {
  const g = useGame(code);
  const router = useRouter();
  const st = g.state;
  // voice moments: SAFAI DO (one player holds the floor) and LAST WORDS (the one just put out speaks)
  const [, rerender] = useState(0);
  const lw = st?.lastWords && st.lastWords.until > g.now() ? st.lastWords : null;
  const fl = st?.floor && st.floor.until > g.now() ? st.floor : null;
  useEffect(() => {
    // re-render the moment a floor or last-words window ends, so mics open again on time
    const ends = [st?.lastWords?.until, st?.floor?.until].filter((x): x is number => typeof x === "number");
    if (!ends.length) return;
    const t = setTimeout(() => rerender((x) => x + 1), Math.max(0, Math.min(...ends) - g.now() + 60));
    return () => clearTimeout(t);
  }, [st?.lastWords?.until, st?.floor?.until, g]);
  const voice = useVoice(
    code,
    st ? { seat: st.you.seat, name: st.you.name } : null,
    st?.status !== "playing",
    // whoever is speaking last words stays at the table until they finish
    // (designer 2026-10-09) no Gone room: a player who is out is still heard by everyone
    [],
    st?.voice ?? "mesh",
  );
  const ptt = usePtt();
  const me = st?.you.seat ?? -1;
  // you + bots only: nobody can hear you, so no mic, no talk button (designer 2026-10-09)
  const solo = st?.status === "playing" && (st.view?.players.filter((p) => !isBot(p.name)).length ?? 2) <= 1;
  // a line read aloud on this phone holds the mic, so the call never carries it back (designer 2026-10-09, option 1)
  const reading = useReading();
  useEffect(() => { if (ptt.down) cut(); }, [ptt.down]);
  // an update (the Sutradhar) has priority over voice chat: mic held, the table ducked under it — even mid push-to-talk
  const held = Boolean((fl && fl.seat !== me) || (lw && lw.seat !== me) || (ptt.on && !ptt.down) || reading === "update" || (reading === "talk" && !ptt.down));
  const duckTable = voice.duck;
  useEffect(() => { duckTable(reading === "update"); }, [reading, duckTable]);
  const setHeld = voice.setHeld;
  useEffect(() => { setHeld(held); }, [held, setHeld]);
  const clip = voice.clip;
  const nameOf = (seat: number) => st?.view?.players[seat]?.name.replace(/\s*🤖$/, "") ?? "";
  const lwKey = lw ? `${lw.seat}:${lw.until}` : "", flKey = fl ? `${fl.seat}:${fl.until}` : "";
  useEffect(() => { if (lw) clip(`${nameOf(lw.seat)} — last words`, Math.max(0, lw.until - g.now())); }, [lwKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (fl) clip(`${nameOf(fl.seat)} takes the floor`, Math.max(0, fl.until - g.now())); }, [flKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useAlertPresence(code, g.token, Boolean(st?.you.alerts));
  // PLAY AGAIN: the host moved the group to a new table — every phone follows, same seat token
  const nextTable = st?.next ?? null;
  useEffect(() => {
    if (!nextTable || !g.token) return;
    saveToken(nextTable, g.token);
    router.replace(`/g/${nextTable}`);
  }, [nextTable, g.token, router]);
  // the role reveal opens the game on every phone, once
  const [revealed, setRevealed] = useState(() => revealSeen(code));
  if (!g.hydrated) return <Centered>Connecting…</Centered>;
  if (g.token === null)
    return (
      <Centered>
        <p>You aren&rsquo;t at table <b>{code}</b> on this phone.</p>
        <Link href={`/?code=${code}`} className="mt-5 inline-flex min-h-12 items-center rounded-full border-2 border-brass/80 bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] px-6 font-[family-name:var(--font-engraved)] font-bold uppercase tracking-[0.1em] text-stock">Join this table</Link>
      </Centered>
    );
  if (!g.state) return <Centered>{g.error ?? "Connecting…"}</Centered>;
  const s = g.state;
  return (
    <main className={`mx-auto flex h-dvh w-full max-w-md flex-col overflow-y-auto ${s.status === "lobby" ? "landscape:max-w-5xl" : ""}`}>
      {s.you.away && s.status === "playing" && (
        <button onClick={g.reclaim} className="m-3 mb-0 rounded-xl border-2 border-brass/80 bg-[#3a240c] p-3 text-left font-bold text-[#f3c66b]">
          A stand-in is playing safe for you. Tap — I&rsquo;m back.
        </button>
      )}
      {g.error && <button onClick={() => g.setError(null)} className="m-3 mb-0 rounded-xl bg-crimson-deep p-3 text-left text-[14px]">{g.error} — tap to dismiss</button>}
      {!solo && <VoiceBanner voice={voice} />}
      {s.status === "playing" && s.view && !revealed && (
        <RoleReveal code={code} role={s.view.me.role} side={s.view.me.side} names={s.view.players.map((p) => p.name)} mySeat={s.view.me.seat} onDone={() => setRevealed(true)} />
      )}
      {s.status === "lobby"
        ? <Lobby s={s} code={code} token={g.token!} onError={g.setError} voice={voice} />
        : s.view && <Table s={s} v={s.view} act={g.act} now={g.now} extend={s.you.host ? g.extend : undefined} code={code} token={g.token!} voice={voice} messages={g.messages} solo={solo} />}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center font-display text-[17px] text-stock/80"><div>{children}</div></main>;
}

// ---------------------------------------------------------------- lobby
// Designer's mockup 2026-10-07: "Invite your friends": invite row, the seats in a ring round the two Stones, Add a bot, Start game.
const AVATAR = ["bg-[#f5a623]", "bg-[#c77dd6]", "bg-[#f2766b]", "bg-[#6aaee8]", "bg-[#7cc47a]", "bg-[#a9a9a9]", "bg-[#e3c565]", "bg-[#5fc4b8]", "bg-[#e88fb4]", "bg-[#9b8cf0]"];
const ENGRAVED = "font-[family-name:var(--font-engraved)]";
const plain = (name: string, bot?: boolean) => (bot ? name.replace(/\s*🤖$/, "") : name);

function Lobby({ s, code, token, onError, voice }: { s: ClientState; code: string; token: string; onError: (e: string) => void; voice: VoiceCtl }) {
  const names = s.lobby!.names;
  const bots = s.lobby!.bots;
  const row = s.lobby!.roleTable[names.length];
  const hydrated = useHydrated();
  const link = hydrated ? `${location.origin}/?code=${code}` : "";
  const invite = `Join my Tunga vs Thieves table — code ${code}: ${link}`;
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);
  const n = names.length;
  // a big table shrinks the seats so the ring still fits a phone
  const big = n > 8;
  const can = (i: number) => i === s.you.seat || Boolean(s.you.host && bots[i]);

  function copy() {
    navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  }

  return (
    <section className="flex min-h-dvh flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 landscape:grid landscape:h-dvh landscape:min-h-0 landscape:grid-cols-[2fr_3fr] landscape:grid-rows-[auto_1fr] landscape:gap-x-6 landscape:pb-3 landscape:pt-1">
      <div aria-hidden className="fixed inset-0 -z-10 bg-[radial-gradient(90%_55%_at_50%_50%,var(--color-ember-2)_0%,var(--color-ember)_65%,#120903_100%)]" />

      {/* sideways: invite + buttons on the left, the ring fills the right */}
      <div className="contents landscape:col-start-1 landscape:row-start-1 landscape:flex landscape:flex-col">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="Back to the start" className="grid h-11 w-11 place-items-center text-brass">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        <button type="button" onClick={() => setSettings(true)} aria-label="Table settings" className="grid h-11 w-11 place-items-center text-brass">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
        </button>
      </div>

      <h1 className="mt-1 text-center font-display text-[36px] font-bold leading-tight text-stock landscape:mt-0 landscape:text-[28px]">Invite your friends</h1>
      <p className={`mt-1 text-center ${ENGRAVED} text-[13px] font-semibold tracking-[0.25em] text-brass`}>TABLE {code}</p>

      <div className="mt-5 grid grid-cols-[1.3fr_1fr] gap-3 landscape:mt-3">
        <a href={`https://wa.me/?text=${encodeURIComponent(invite)}`} target="_blank" rel="noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full bg-[#1aa34a] px-3 text-[12px] font-bold uppercase tracking-wide text-white">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.3.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>
          Invite on WhatsApp
        </a>
        <button type="button" onClick={copy}
          className="inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-brass/70 px-3 text-[12px] font-bold uppercase tracking-wide text-stock">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></svg>
          <span aria-live="polite">{copied ? "Copied!" : "Copy link"}</span>
        </button>
      </div>
      </div>

      {/* the ring: you at the bottom, everyone else round the two Stones in seat order */}
      <div className="relative my-6 min-h-[440px] flex-1 landscape:col-start-2 landscape:row-span-2 landscape:row-start-1 landscape:my-0 landscape:min-h-0" aria-label={`${n} at the table`} role="list">
        {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
        <img src="/stones.webp" alt="The Bhadra Stone and the Tunga Stone" width={378} height={235}
          className="absolute left-1/2 top-1/2 w-[46%] max-w-[210px] -translate-x-1/2 -translate-y-1/2 [mask-image:radial-gradient(closest-side,#000_70%,transparent_100%)]" />
        {names.map((name, i) => {
          const k = (i - s.you.seat + n) % n;
          const angle = Math.PI / 2 + (k * 2 * Math.PI) / n;
          const speaking = i === s.you.seat ? voice.speaking : Boolean(voice.peers[i]?.speaking);
          return (
            <div key={i} role="listitem" className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${50 + 36 * Math.cos(angle)}%`, top: `${48 + 37 * Math.sin(angle)}%` }}>
              <span className={`relative grid place-items-center rounded-full font-medium text-card-ink ${big ? "h-11 w-11 text-[20px]" : "h-[60px] w-[60px] text-[30px]"} ${AVATAR[i % AVATAR.length]} ${speaking ? "speaking" : ""} ${i === s.you.seat ? "outline-[3px] outline-offset-[3px] outline-jade shadow-[0_0_22px_4px_#2ecc7166]" : ""}`}>
                {bots[i] ? "🤖" : name.slice(0, 1).toUpperCase()}
                {s.you.host && i !== s.you.seat && (
                  <button type="button" aria-label={`Remove ${plain(name, bots[i])}`} onClick={() => api.removeBot(code, token, i).catch((e) => onError(e.message))}
                    className="absolute -right-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-ember text-stock ring-1 ring-brass/70">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                )}
                {i !== s.you.seat && voice.peers[i]?.muted && <span className="absolute -left-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ember ring-1 ring-brass/50"><MicOff small /></span>}
              </span>
              <button type="button" disabled={!can(i)} onClick={() => setEditing(i)} aria-label={`${can(i) ? `Rename ${plain(name, bots[i])}` : name}${i === s.you.seat ? " (you)" : ""}`}
                className={`relative z-10 -mt-1.5 flex items-center justify-center gap-1.5 rounded-full border bg-ember font-medium ${i === s.you.seat ? "border-2 border-jade text-jade-soft" : "border-brass/70 text-stock"} ${big ? "max-w-[84px] px-2 py-0.5 text-[11px]" : "max-w-[150px] px-4 py-1 text-[14px]"}`}>
                <span className="truncate">{plain(name, bots[i])}</span>
                {can(i) && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-brass" aria-hidden><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>}
              </button>
              {i === s.host && <span className="-mt-0.5 rounded-full bg-[#f5a623] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-card-ink">Host</span>}
            </div>
          );
        })}
      </div>

      <div className="contents landscape:col-start-1 landscape:row-start-2 landscape:flex landscape:flex-col landscape:justify-end">
      {n >= 13 && <p className="mb-2 text-center text-[13px] font-semibold text-brass landscape:hidden">↻ Turn your phone sideways for a bigger table</p>}
      <p className="mb-3 text-center text-[13px] text-stock/70">
        {row ? `${row[0]} villagers · ${row[1]} thie${row[1] === 1 ? "f" : "ves"}` : `You need at least ${MIN_PLAYERS} players`}
      </p>

      {s.you.host ? (
        <div className="flex flex-col gap-3">
          {n < s.lobby!.max && (
            <button type="button" onClick={() => api.addBot(code, token).catch((e) => onError(e.message))}
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-full border-2 border-brass/70 text-[16px] font-bold uppercase tracking-wide text-stock active:translate-y-px landscape:min-h-12">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden><circle cx="9" cy="7" r="4" /><path d="M1 21v-1a7 7 0 0 1 12.5-4.3V21z" /><path d="M18 14v8M14 18h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
              Add a bot
            </button>
          )}
          <button type="button" disabled={!row} onClick={() => api.start(code, token).catch((e) => onError(e.message))}
            className="min-h-16 rounded-full bg-[#c9661f] text-[22px] font-semibold landscape:min-h-12 landscape:text-[19px] uppercase tracking-[0.08em] text-card-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,.8)] active:translate-y-px disabled:opacity-45">
            Start game
          </button>
        </div>
      ) : <p className={`py-4 text-center ${ENGRAVED} text-[14px] font-semibold uppercase tracking-[0.15em] text-stock/85`}>Waiting for {plain(names[s.host] ?? "the host", bots[s.host])} to start…</p>}
      </div>

      {editing !== null && names[editing] !== undefined && (
        <Rename initial={plain(names[editing], bots[editing])} onClose={() => setEditing(null)}
          onSave={(name) => api.rename(code, token, editing, name).then(() => setEditing(null))} />
      )}
      {settings && (
        <Sheet title="Table settings" onClose={() => setSettings(false)}>
          <div className="flex items-center gap-3">
            <MicButton voice={voice} />
            <p className="text-[14px] leading-snug text-stock/80">Voice is built in: everyone talks from their seat. Earphones stop the echo.</p>
          </div>
          <p className="text-[14px] text-stock/80">Table code <b className={`${ENGRAVED} tracking-[0.2em] text-brass`}>{code}</b>. Seats are shuffled when the game starts.</p>
        </Sheet>
      )}
    </section>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="stage-in flex w-full max-w-md flex-col gap-4 rounded-t-3xl border-t-2 border-brass/70 bg-ember px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
        <h2 className={`text-center ${ENGRAVED} text-[15px] font-semibold uppercase tracking-[0.2em] text-stock`}>{title}</h2>
        {children}
        <button type="button" onClick={onClose} className="min-h-12 rounded-full border-2 border-brass/70 text-[14px] font-bold uppercase tracking-wide text-stock">Done</button>
      </div>
    </div>
  );
}

function Rename({ initial, onSave, onClose }: { initial: string; onSave: (name: string) => Promise<unknown>; onClose: () => void }) {
  const [name, setName] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60" onClick={() => !busy && onClose()}>
      <form role="dialog" aria-label="Change name" onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; setBusy(true); setErr(null); onSave(name.trim()).catch((x) => { setErr((x as Error).message); setBusy(false); }); }}
        className="stage-in flex w-full max-w-md flex-col gap-4 rounded-t-3xl border-t-2 border-brass/70 bg-ember px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
        <label htmlFor="rename" className={`text-center ${ENGRAVED} text-[15px] font-semibold uppercase tracking-[0.2em] text-stock`}>Change name</label>
        <input id="rename" autoFocus value={name} maxLength={20} onChange={(e) => setName(e.target.value)}
          className="min-h-14 rounded-2xl border-2 border-brass/80 bg-black/40 px-4 text-center text-[17px] text-stock caret-brass outline-none" />
        {err && <p role="alert" className="rounded-xl bg-crimson-deep p-3 text-center text-[14px]">{err}</p>}
        <button type="submit" disabled={busy || !name.trim()}
          className="min-h-14 rounded-full bg-[#c9661f] text-[17px] font-semibold uppercase tracking-[0.08em] text-card-ink disabled:opacity-50">Save</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- the table
function status(v: PlayerView): string {
  const name = (s: number) => v.players[s]?.name ?? "?";
  const mine = v.decision !== null;
  const w = v.waitingOn.filter((x) => x !== v.me.seat);
  const list = w.length > 3 ? `${w.length} players` : w.map(name).join(", ");
  const p = v.phase;
  if (p === "over") return v.winner === "V" ? "Tunga wins" : "Thieves win";
  if (p.startsWith("turn")) return mine ? "Your move — play a pair or pass" : `${name(v.turnSeat)} must play a pair or pass`;
  if (p.endsWith("_debate")) return `${p.startsWith("final") ? "Last debate" : "Faisla"} — the floor is open`;
  if (p.endsWith("_vote")) return mine ? "Your vote" : `Voting — waiting for ${list}`;
  if (p === "surrender") return mine ? "Surrender your Stone?" : "The Stone holders are deciding…";
  if (p === "batwara") return mine ? "Bhukamp — pass one card clockwise" : `Bhukamp — waiting for ${list}`;
  if (p.startsWith("dal_badal")) return mine ? "Dal Badal — pick a role card" : `Dal Badal — ${list} picking a role card`;
  if (p.startsWith("elim")) {
    const seat = Number(p.split(":")[2]);
    return mine ? "You're out — your last decision" : `${name(seat)} is out — their last decision`;
  }
  return "";
}

// One screen (designer's mockup 2026-10-07): ☰ + mic, round, clock on top; the seats in a ring round a framed panel
// that tells what just happened; "Your Cards" below. You are the seat at the bottom, in green. Voice carries the
// table — only climaxes take the full stage.
const SEAT_COLOURS = ["#f5a623", "#c77dd6", "#f2766b", "#6aaee8", "#7cc47a", "#a9a9a9", "#e3c565", "#5fc4b8", "#e88fb4", "#9b8cf0", "#4f7cf0", "#f08c5a"];

/** one or two letters: two when another player shares the first letter (Ka / Ki) */
function initialsOf(names: string[]) {
  return names.map((n) => {
    const first = n.slice(0, 1).toUpperCase();
    return names.some((m) => m !== n && m.slice(0, 1).toUpperCase() === first) ? first + n.slice(1, 2).toLowerCase() : first;
  });
}

function Table({ s, v, act, now, extend, code, token, voice, messages, solo }: {
  s: ClientState; v: PlayerView; act: (a: Action) => void; now: () => number;
  extend?: () => void; code: string; token: string; voice: VoiceCtl; messages: ChatMessage[]; solo: boolean;
}) {
  const stage = useStage(v.events, v.players.map((p) => p.name));
  const bots = useBotSpeech(messages);
  const [menu, setMenu] = useState(false);
  const myMove = v.decision?.kind ?? null;
  const shown = stage.current?.n ?? stage.last?.n ?? -1;
  const beats = useMemo(() => beatsFor(v.events, v.players.map((p) => p.name)).filter((b) => !b.private), [v.events, v.players]);
  const seen = beats.filter((b) => b.n <= shown);
  // the last play's who → whom tags on the seats (passes and talk don't move them)
  const headline = [...seen].reverse().find((b) => !TAGLESS.has(b.type) && b.type !== "claim") ?? null;
  // playtest 2026-10-07 ("it doesn't show who received how many votes"): the last vote's counts stay on the seats and
  // in the panel — through the elimination it caused — until the next card is played or passed
  const lastVote = [...seen].reverse().find((b) => b.type === "vote_result") ?? null;
  const voteShown = lastVote && !seen.some((b) => b.n > lastVote.n && (b.card || b.type === "pass")) ? lastVote : null;
  // open voting: every ballot counts on the table the moment it is cast (weighted by the voter's votes)
  const live = v.ballots ? liveTally(v) : null;
  const names = useMemo(() => v.players.map((p) => p.name), [v.players]);
  // THE CENTRE FEED (designer 2026-10-09, option A): every update, claim, accusation, line and ballot, in order
  const seenAll = useMemo(() => beatsFor(v.events, names).filter((b) => b.n <= shown), [v.events, names, shown]);
  const readAloud = useRef(bots.voice);
  useEffect(() => { readAloud.current = bots.voice; }, [bots.voice]);
  const onFresh = useCallback((it: FeedItem) => {
    // read aloud: what someone says or claims (bots and the Villager/Thief/Role/Stone taps) — not your own, not captions
    if (!readAloud.current || it.old || it.seat === v.me.seat || (it.kind !== "talk" && it.kind !== "claim")) return;
    const seat = it.seat ?? 0;
    const text = it.kind === "talk" ? `${names[seat]?.replace(/\s*🤖$/, "") ?? ""}: ${it.text}` : it.text;
    say({ text, lang: "en-IN", pitch: 0.75 + ((seat * 37) % 60) / 100, rate: 0.95 + ((seat * 13) % 20) / 100 });
  }, [names, v.me.seat]);
  const caughtUp = shown >= (beats.at(-1)?.n ?? -1);
  // (2026-10-09, "eliminated screen and whom to give vote collided"): your last decision waits until YOUR ejection has
  // played — the full-screen ejection used to cover it and swallow the taps
  const myExitPending = beats.some((b) => b.type === "eliminated" && b.target === v.me.seat && (b.n > shown || stage.current?.n === b.n));
  const feed = useFeed(seenAll, messages, v.ballots, names, caughtUp, onFresh);
  const [feedOpen, setFeedOpen] = useState(false);
  // PRIVATE MARKS (2026-10-09, Town of Salem's notepad / Clocktower's reminder tokens): your own ✓ ! ? on a seat —
  // kept on this phone for this table only, never sent anywhere
  const [marks, setMarks] = useState<Record<number, Mark>>(() => { try { return JSON.parse(localStorage.getItem(`tunga:marks:${code}`) ?? "{}"); } catch { return {}; } });
  const setMark = (seat: number, m: Mark | null) => setMarks((was) => {
    const next = { ...was };
    if (m) next[seat] = m; else delete next[seat];
    try { localStorage.setItem(`tunga:marks:${code}`, JSON.stringify(next)); } catch {}
    return next;
  });
  const ptt = usePtt();
  // FIRST-TIME TIPS (designer 2026-10-09): one short line at a time, each once per phone — your first turn, debate and
  // vote, how to talk to the table, and at a table of humans AND bots that the bots can't hear voice
  const mixed = !solo && v.players.some((p) => isBot(p.name));
  const [tipsSeen, setTipsSeen] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(TIPS) ?? "[]"); } catch { return []; } });
  const seeTips = (...ids: string[]) => setTipsSeen((was) => {
    const next = [...new Set([...was, ...ids])];
    try { localStorage.setItem(TIPS, JSON.stringify(next)); } catch {}
    return next;
  });
  const now_ = v.decision?.kind === "vote" ? "vote" : v.decision?.kind === "debate" ? "debate" : v.decision && v.phase.startsWith("turn") ? "turn" : null;
  // LEARN BY PLAYING: in a guided first game the coach takes the tips' place (lib-free: coachFor below)
  const [coachOff, setCoachOff] = useState(false);
  const [coachSeen, setCoachSeen] = useState<string[]>([]);
  const coach = v.tutorial && !coachOff ? coachFor(v, coachSeen, solo) : null;
  const lastCoach = useRef<string | null>(null);
  useEffect(() => {
    // a coach line is done once its moment has passed
    const was = lastCoach.current;
    if (was && was !== coach?.id) queueMicrotask(() => setCoachSeen((xs) => (xs.includes(was) ? xs : [...xs, was])));
    lastCoach.current = coach?.id ?? null;
  });
  const tip = v.me.alive && !v.tutorial ? [now_, mixed ? "bots" : null, "seats"].find((t): t is string => t !== null && !tipsSeen.includes(t)) ?? null : null;
  const lastTip = useRef<string | null>(null);
  useEffect(() => {
    // the moment the tip was about has passed: don't show it again next time
    if (lastTip.current && lastTip.current !== now_ && ["turn", "debate", "vote"].includes(lastTip.current) && !tipsSeen.includes(lastTip.current)) {
      const id = lastTip.current;
      queueMicrotask(() => seeTips(id));
    }
    lastTip.current = now_;
  });
  const claimAt = (kind: "accuse" | "trust" | "kundli" | "stone", seat: number, role?: string, has?: boolean) => {
    seeTips("seats", "bots");
    setCoachSeen((xs) => [...xs, "tell"]);
    api.claim(code, token, { kind, target: seat, ...(role ? { role } : {}), ...(has !== undefined ? { has } : {}) }).catch(() => {});
  };
  // live captions (menu switch, off by default): your sentences go in the centre under your name
  const captions = useCaptions(voice.status === "on" && voice.micOn && !voice.micBlocked && (!ptt.on || ptt.down),
    useCallback((t: string) => { api.chat(code, token, CAPTION_PREFIX + t).catch(() => {}); }, [code, token]));
  const root = useRef<HTMLDivElement>(null);
  const [throws] = useState(() => new ThrowQueue());
  useEffect(() => { throws.feed(messages, v.me.seat); }, [throws, messages, v.me.seat]);
  const flying = useSyncExternalStore(throws.subscribe, throws.getSnapshot, throws.getSnapshot);
  const lastThrow = useRef(0);
  const throwAt = (seat: number, emoji: string) => {
    if (Date.now() - lastThrow.current < 1200) return; // one reaction at a time, no spamming the table
    lastThrow.current = Date.now();
    api.chat(code, token, reactionText(emoji, seat)).catch(() => {});
  };
  useEffect(() => { unlockOnFirstTap(); startMusicOnFirstTap(); }, []);
  useEffect(() => () => stopMusic(), []);
  // every big moment gets its sound, the narrator's line, a shake and a buzz (research 2026-10-07)
  const beat = stage.current;
  useEffect(() => {
    if (!beat) return;
    const SOUND: Partial<Record<string, Sound>> = {
      faisla: "faisla", ballots_open: "drumroll", final_vote: "drumroll", talashi: "flip", talashi_private: "flip", kundli: "mystic", kundli_private: "mystic",
      hera_pheri: "steal", batwara: "quake", dal_badal: "swirl", eliminated: "gong", eliminated_private: "mystic", claim: "claim",
      pass: "whoosh", to_village: "gong", surrender_open: "drumroll", surrender: "gong",
    };
    if (beat.type === "teer_kaman") play("arrow", beat.result === "hit");
    else if (SOUND[beat.type]) play(SOUND[beat.type]!);
    narrate(beat);
    const hard = beat.type === "eliminated" || beat.type === "batwara" || (beat.type === "teer_kaman" && beat.result === "hit");
    if (hard && root.current) {
      root.current.classList.remove("shake");
      void root.current.offsetWidth; // restart the animation
      root.current.classList.add("shake");
      buzz(beat.type === "eliminated" ? [90, 60, 220] : [60, 40, 60]);
    }
  }, [beat, names]);
  // talking? the effects step back so voices stay on top
  const talkingNow = voice.speaking || Object.values(voice.peers).some((p) => p.speaking && !p.hushed);
  useEffect(() => { duck(talkingNow); musicDuck(talkingNow); }, [talkingNow]);
  // a line read aloud waits for a gap: nobody talking, your talk button not held
  const busyTalk = useRef(false);
  useEffect(() => { busyTalk.current = talkingNow || ptt.down; }, [talkingNow, ptt.down]);
  useEffect(() => { setQuiet(() => !busyTalk.current); return () => setQuiet(() => true); }, []);
  // the score follows the game (music.ts): calm on turns, tense through a Faisla, the last vote and the surrender,
  // and it steps aside for the ejection and the end
  const mood: Mood = s.status === "over" || beat?.type === "eliminated" ? "silent"
    : /_(debate|vote)$/.test(v.phase) || v.phase === "surrender" ? "tense" : "calm";
  useEffect(() => { setMood(mood); }, [mood]);
  // the clock running out on YOUR decision: a heartbeat every second for the last ten
  useEffect(() => {
    if (!myMove || !s.deadline) return;
    const t = setInterval(() => {
      const left = s.deadline! - now();
      if (left > 0 && left <= 10_000) { play("heartbeat"); if (left <= 5000) buzz(25); }
    }, 1000);
    return () => clearInterval(t);
  }, [myMove, s.deadline, now]);
  // a vote lands: a note that climbs with every ballot
  const liveTotal = Object.values(v.ballots ?? {}).filter((t) => t !== null).length;
  useEffect(() => { if (liveTotal > 0) play("vote", liveTotal); }, [liveTotal]);
  // (2026-10-09, collisions sweep) a new move of yours closes anything that would cover it: menu, history, the feed
  // list, the whisper sheet (the seat menu closes itself on a phase change — Ring)
  useEffect(() => {
    if (!myMove) return;
    queueMicrotask(() => { setMenu(false); setFeedOpen(false); });
  }, [myMove, v.phase]);
  // your move: a chime, a short buzz and a tab-title flag, so a phone face-down on the table still tells you
  useEffect(() => {
    if (!myMove) return;
    if (myMove !== "vote" && myMove !== "debate") play("yourMove");
    buzz(60);
    const was = document.title;
    document.title = "● Your move — Tunga vs Thieves";
    return () => { document.title = was; };
  }, [myMove]);

  if (s.status === "over") return (<><Stage stage={stage} skip={stage.skip} names={v.players.map((p) => p.name)} /><Final v={v} clips={voice.clips ?? []} host={s.you.host} hostName={(s.view?.players[s.host]?.name ?? "the host").replace(/\s*🤖$/, "")}
    onRematch={() => api.rematch(code, token)} /></>);

  const living = v.players.filter((p) => p.alive);
  const ejected = beat?.type === "eliminated" && beat.target !== undefined ? v.players[beat.target] : null;
  return (
    <div ref={root} className="flex min-h-0 flex-1 flex-col">
      {ejected && beat && (
        <Eject key={beat.n} name={ejected.name.replace(/\s*🤖$/, "")} initials={initialsOf(names)[ejected.seat]} colour={SEAT_COLOURS[ejected.seat % SEAT_COLOURS.length]}
          thief={beat.tone === "relic"} role={ejected.revealedRole} onDone={stage.skip} lastWords={Boolean(beat.lastWords)} mine={ejected.seat === v.me.seat}
          remaining={thievesRemaining(v.rolesInPlay, v.players.filter((p) => !p.alive).map((p) => p.revealedRole))} />
      )}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[radial-gradient(80%_45%_at_50%_32%,var(--color-ember-2)_0%,var(--color-ember)_60%,#120903_100%)]" />

      <header className="flex items-center gap-2 px-3 pt-2">
        <button type="button" onClick={() => setMenu(true)} aria-label="Menu" className="grid h-11 w-11 place-items-center text-stock">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        {!solo && <MicButton voice={voice} />}
        <button type="button" onClick={() => setFeedOpen(true)} aria-label="What happened so far" className="grid h-11 w-11 place-items-center text-brass">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
        </button>
        <p className="flex-1 text-center font-[family-name:var(--font-engraved)] text-[12px] font-semibold uppercase tracking-[0.18em] text-brass">Round {v.round} of {v.rounds}</p>
        <TimerRing deadline={s.deadline} now={now} size={52} brass />
      </header>

      <Ring v={v} voice={voice} talking={bots.current?.seat ?? null} floorSeat={s.floor && s.floor.until > now() ? s.floor.seat : null} actor={headline?.actor} target={headline?.target} pick={v.decision?.kind === "vote" ? v.decision.mine ?? null : null} tally={live ?? voteShown?.tally}
        flying={flying} onThrow={s.status === "playing" ? throwAt : undefined}
        away={s.away} marks={marks} onMark={setMark}
        onClaim={s.status === "playing" ? claimAt : undefined}
        onQuick={s.status === "playing" ? (l) => { seeTips("seats"); api.chat(code, token, QUICK_PREFIX + l).catch(() => {}); } : undefined}>
        {stage.current?.big
          ? <Stage stage={stage} skip={stage.skip} names={v.players.map((p) => p.name)} inline small={v.players.length > 8} />
          : <Centre v={v} feed={feed} onOpen={() => setFeedOpen(true)} compact={Boolean(myMove && myMove !== "vote" && myMove !== "debate")} living={living.length} extend={extend}
          ready={() => act({ type: "ready" })} />}
      </Ring>
      {!solo && <TalkButton up={Boolean(myMove && myMove !== "debate")} />}
      {/* the coach (a guided first game) or a first-time tip sits INSIDE the tray, so the cards never cover it */}
      <Tray v={v} act={act} live={live} waitForExit={myExitPending} banner={coach
        ? <Coach key={coach.id} text={coach.text} onNext={() => setCoachSeen((xs) => [...xs, coach.id])} onSkip={() => setCoachOff(true)} />
        : tip ? <Tip key={tip} text={TIP_TEXT[tip]} onDone={() => seeTips(tip)} /> : null} />
      {feedOpen && <Sheet title="Everything at the table" onClose={() => setFeedOpen(false)}><FeedList items={[...feed].reverse()} names={names} me={v.me.seat} /></Sheet>}

      {menu && (
        <Sheet title="Menu" onClose={() => setMenu(false)}>
          <RolePeek v={v} />
          {!solo && (
            <div className="flex items-center gap-3">
              <MicButton voice={voice} />
              <p className="flex-1 text-[14px] text-stock/80">Your mic. Tap a player&rsquo;s seat to mute them for you only.</p>
            </div>
          )}
          <SoundMode lines={bots.voice} setLines={bots.setVoice} />
          <AlertsToggle code={code} token={token} on={s.you.alerts} />
          <details className="group rounded-2xl border border-brass/30 px-4 py-1 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[14px] font-semibold text-stock/80">More<span aria-hidden className="transition group-open:rotate-90">›</span></summary>
            <div className="flex flex-col gap-2 pb-2">
          <Toggles solo={solo} />
          <button type="button" onClick={() => bots.setVoice(!bots.voice)} aria-pressed={bots.voice}
            className="flex min-h-12 items-center gap-3 rounded-2xl border border-brass/40 px-4 text-left text-[14px] text-stock">
            <span className="text-[18px]" aria-hidden>{bots.voice ? "🔊" : "🔈"}</span>{bots.voice ? "Lines read aloud" : "Lines as text only"}
          </button>
          {captions.supported && !solo && (
            <button type="button" onClick={() => captions.setOn(!captions.on)} aria-pressed={captions.on}
              className="flex min-h-12 items-center gap-3 rounded-2xl border border-brass/40 px-4 text-left text-[14px] text-stock">
              <span className="text-[18px]" aria-hidden>{captions.on ? "💬" : "🔇"}</span>
              {captions.on ? (captions.broken ? "Captions — this phone can't (mic busy)" : "Live captions of my voice on") : "Live captions of my voice off"}
            </button>
          )}
            </div>
          </details>
          <Link href="/" className="text-center text-[13px] text-stock/60 underline">Leave this table</Link>
        </Sheet>
      )}
    </div>
  );
}

/** menu switches for the game's sound and the narrator (remembered on this phone) */
function Toggles({ solo }: { solo: boolean }) {
  const [snd, setSnd] = useState(soundOn);
  const [nar, setNar] = useState(narratorOn);
  const [mus, setMus] = useState(musicOn);
  const row = "flex min-h-12 items-center gap-3 rounded-2xl border border-brass/40 px-4 text-left text-[14px] text-stock";
  return (
    <>
      <button type="button" aria-pressed={snd} onClick={() => { setSound(!snd); setSnd(!snd); }} className={row}><span className="text-[18px]" aria-hidden>{snd ? "🥁" : "🔕"}</span>{snd ? "Game sounds on" : "Game sounds off"}</button>
      <button type="button" aria-pressed={mus} onClick={() => { setMusic(!mus); setMus(!mus); }} className={row}><span className="text-[18px]" aria-hidden>{mus ? "🎵" : "🔇"}</span>{mus ? "Music on" : "Music off"}</button>
      {!solo && <PttSwitch row={row} />}
      <button type="button" aria-pressed={nar} onClick={() => { setNarrator(!nar); setNar(!nar); }} className={row}><span className="text-[18px]" aria-hidden>{nar ? "🎙️" : "🤐"}</span>{nar ? "Sutradhar (narrator) on" : "Sutradhar off"}</button>
    </>
  );
}

function PttSwitch({ row }: { row: string }) {
  const p = usePtt();
  return <button type="button" aria-pressed={p.on} onClick={() => setPtt(!p.on)} className={row}><span className="text-[18px]" aria-hidden>{p.on ? "✋" : "🎙️"}</span>{p.on ? "Push to talk (hold the button)" : "Open mic (talk anytime)"}</button>;
}

/** push-to-talk: hold the big button to speak */
/** `up`: while you decide, the button moves to the top so it never covers a ballot tile or a card */
function TalkButton({ up = false }: { up?: boolean }) {
  const p = usePtt();
  if (!p.on) return null;
  return (
    <button type="button" aria-label="Hold to talk" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setTalking(true); }}
      onPointerUp={() => setTalking(false)} onPointerCancel={() => setTalking(false)} onContextMenu={(e) => e.preventDefault()}
      className={`fixed ${up ? "top-16" : "bottom-[34%]"} right-3 z-30 grid h-16 w-16 select-none place-items-center rounded-full border-2 text-[26px] shadow-[0_8px_20px_rgba(0,0,0,.7)] [-webkit-touch-callout:none] ${p.down ? "speaking border-jade bg-jade-deep" : "border-brass/70 bg-ember"}`}>
      🎙️
    </button>
  );
}

/** your role, behind a hold — a phone lying on the table never gives you away */
function RolePeek({ v }: { v: PlayerView }) {
  const [peek, setPeek] = useState(false);
  return (
    <button type="button" onPointerDown={() => setPeek(true)} onPointerUp={() => setPeek(false)} onPointerLeave={() => setPeek(false)} onPointerCancel={() => setPeek(false)}
      onContextMenu={(e) => e.preventDefault()} aria-label="Hold to see your role"
      className={`min-h-14 select-none rounded-2xl border-2 px-4 font-[family-name:var(--font-engraved)] text-[16px] font-bold uppercase tracking-[0.1em] [-webkit-touch-callout:none] ${peek ? (v.me.side === "V" ? "border-[#f0a32e] bg-[#3a240c] text-[#f3c66b]" : "border-crimson bg-crimson-deep text-ink") : "border-brass/50 text-stock/80"}`}>
      {peek ? `${v.me.role} · ${v.me.side === "V" ? "Team Tunga" : "Team Thieves"}` : "Hold to see your role"}
    </button>
  );
}

/** Seats on an oval in turn order, you at the bottom, a thin brass line joining them. */
function Ring({ v, voice, talking, floorSeat = null, actor, target, pick, tally, flying = [], away = [], marks = {}, onMark, onThrow, onPick, onClaim, onQuick, children }: {
  v: PlayerView; voice: VoiceCtl; talking: number | null; floorSeat?: number | null; actor?: number; target?: number; pick: number | null; tally?: Record<string, number>;
  flying?: Throw[]; away?: number[]; marks?: Record<number, Mark>; onMark?: (seat: number, m: Mark | null) => void; onThrow?: (seat: number, emoji: string) => void; onPick?: (seat: number) => void;
  onClaim?: (kind: "accuse" | "trust" | "kundli" | "stone", seat: number, role?: string, has?: boolean) => void; onQuick?: (line: string) => void; children: React.ReactNode;
}) {
  const n = v.players.length;
  const voteOpen = v.phase.endsWith("_vote");
  const size: SeatSize = n <= 8 ? "lg" : n <= 16 ? "md" : "sm";
  const ini = initialsOf(v.players.map((p) => p.name));
  const [picker, setPickerRaw] = useState<number | null>(null);
  // the claims (designer 2026-10-09): 🌾 Villager · 🫵 Thief · 🔮 Role (name it exactly — true or a lie) · 💎 Stone
  // (has one / has none). 🔮 and 💎 open their choices in the same strip — no window.
  const [reading, setReadingRoles] = useState<false | "role" | "stone">(false);
  const setPicker = (seat: number | null) => { setPickerRaw(seat); setReadingRoles(false); };
  // the table moved on (a new turn, a vote): a seat menu left open would cover the centre
  const phaseKey = `${v.phase}:${v.turnSeat}`;
  const [pickerPhase, setPickerPhase] = useState(phaseKey);
  if (pickerPhase !== phaseKey) { setPickerPhase(phaseKey); if (picker !== null) setPicker(null); }
  /** where a seat sits on the oval, in % of the table — you at the bottom */
  const pos = (seat: number) => {
    const a = Math.PI / 2 + (((seat - v.me.seat + n) % n) * 2 * Math.PI) / n;
    return { x: 50 + 41 * Math.cos(a), y: 50 + 42 * Math.sin(a) };
  };
  // the spotlight beam: from the middle of the table to whoever must act
  // the beam follows whoever holds the floor; otherwise whoever must act
  const lit = floorSeat !== null ? floorSeat : v.phase.startsWith("turn") ? v.turnSeat : v.phase === "batwara" ? null : v.waitingOn.length === 1 ? v.waitingOn[0] : null;
  const beam = lit !== null ? (() => {
    const t = pos(lit), dx = t.x - 50, dy = t.y - 50, len = Math.hypot(dx, dy) || 1, w = 7;
    return `50,50 ${t.x + (-dy / len) * w},${t.y + (dx / len) * w} ${t.x - (-dy / len) * w},${t.y - (dx / len) * w}`;
  })() : null;
  const peerOf = (seat: number) => voice.peers[seat];
  const said = useMemo(() => saidAbout(v), [v]);
  return (
    <section className="relative mx-2 mt-5 min-h-[440px] flex-1" aria-label="The table">
      <div className="absolute inset-x-[9%] inset-y-[8%] rounded-[50%] border border-brass/35" aria-hidden />
      {beam && lit !== null && (
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="beam" gradientUnits="userSpaceOnUse" x1="50" y1="50" x2={pos(lit).x} y2={pos(lit).y}>
              <stop offset="0" stopColor="#f0a32e" stopOpacity="0" /><stop offset="1" stopColor="#f0a32e" stopOpacity=".38" />
            </linearGradient>
          </defs>
          <polygon key={lit} points={beam} fill="url(#beam)" className="stage-in beam-glow" />
        </svg>
      )}
      {Array.from({ length: n }, (_, k) => {
        const p = v.players[(v.me.seat + k) % n];
        const angle = Math.PI / 2 + (k * 2 * Math.PI) / n;
        const me = p.seat === v.me.seat;
        const peer = voice.peers[p.seat];
        return (
          <div key={p.seat} className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${50 + 41 * Math.cos(angle)}%`, top: `${50 + 42 * Math.sin(angle)}%` }}>
            <Seat p={p} me={me} size={size} initials={ini[p.seat]} got={tally?.[p.seat]} tag={p.seat === actor ? "played" : p.seat === target ? "target" : undefined}
              spot={!voteOpen && v.waitingOn.includes(p.seat)}
              voted={voteOpen && p.alive && !v.waitingOn.includes(p.seat)}
              picked={pick === p.seat}
              speaking={me ? voice.speaking : Boolean(peer?.speaking && !peer.hushed) || talking === p.seat}
              micOff={me ? !voice.micOn || voice.micBlocked : Boolean(peer?.muted)}
              hushed={Boolean(peer?.hushed)}
              away={away.includes(p.seat)} mark={marks[p.seat]} said={said[p.seat]}
              onTap={onPick && p.alive ? () => onPick(p.seat) : (me ? onQuick : onThrow || onClaim || peer) ? () => setPicker(picker === p.seat ? null : p.seat) : undefined} />
          </div>
        );
      })}
      {/* tap a seat: throw something at them (everyone sees it fly), or mute them for you */}
      {picker !== null && (
        <div className="pop absolute z-30 flex w-[min(92%,340px)] -translate-x-1/2 -translate-y-[115%] flex-col gap-1 rounded-2xl border border-brass/60 bg-ember/95 p-1.5 shadow-[0_8px_20px_rgba(0,0,0,.7)]"
          style={{ left: "50%", top: `${Math.max(24, pos(picker).y)}%` }} role="menu" aria-label={`${v.players[picker]?.name}`}>
          {/* your own seat: a ready-made line, straight into the centre */}
          {picker === v.me.seat && onQuick && (
            <div className="grid grid-cols-2 gap-1">
              {QUICK_LINES.map((l) => (
                <button key={l} type="button" role="menuitem" onClick={() => { onQuick(l); setPicker(null); }}
                  className="min-h-11 rounded-xl bg-black/40 px-2 text-[14px] font-bold text-stock ring-1 ring-brass/50 active:scale-95">{l}</button>
              ))}
            </div>
          )}
          {/* accuse / vouch / a Kundli read — straight into the centre, one tap */}
          {/* 💎 Stone: after a Talashi — "has a Stone" / "has no Stone" */}
          {picker !== v.me.seat && onClaim && v.players[picker]?.alive && reading === "stone" && (
            <div className="grid grid-cols-2 gap-1" role="group" aria-label={`Does ${v.players[picker]?.name} hold a Stone?`}>
              <button type="button" role="menuitem" onClick={() => { onClaim("stone", picker, undefined, true); setPicker(null); }}
                className="min-h-11 rounded-xl bg-[#3a240c] text-[14px] font-bold text-[#f3c66b] ring-1 ring-[#f0a32e]/60 active:scale-95">💎 Has a Stone</button>
              <button type="button" role="menuitem" onClick={() => { onClaim("stone", picker, undefined, false); setPicker(null); }}
                className="min-h-11 rounded-xl bg-black/40 text-[14px] font-bold text-stock ring-1 ring-brass/50 active:scale-95">No Stone</button>
            </div>
          )}
          {picker !== v.me.seat && onClaim && v.players[picker]?.alive && reading !== "stone" && (reading === "role" ? (
            <div className="flex flex-wrap justify-center gap-1" role="group" aria-label={`Which role is ${v.players[picker]?.name}?`}>
              {v.rolesInPlay.map((r) => (
                <button key={r} type="button" role="menuitem" onClick={() => { onClaim("kundli", picker, r); setPicker(null); }}
                  className="min-h-10 rounded-full bg-black/40 px-3 text-[13px] font-bold text-stock ring-1 ring-brass/50 active:scale-95">{r}</button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1">
              <button type="button" role="menuitem" onClick={() => { onClaim("trust", picker); setPicker(null); }}
                className="min-h-11 rounded-xl bg-jade-deep/60 text-[14px] font-bold text-jade-soft ring-1 ring-jade/60 active:scale-95">🌾 Villager</button>
              <button type="button" role="menuitem" onClick={() => { onClaim("accuse", picker); setPicker(null); }}
                className="min-h-11 rounded-xl bg-crimson-deep text-[14px] font-bold text-ink active:scale-95">🫵 Thief</button>
              <button type="button" role="menuitem" onClick={() => setReadingRoles("role")}
                className="min-h-11 rounded-xl bg-black/40 text-[14px] font-bold text-stock ring-1 ring-brass/50 active:scale-95">🔮 Role</button>
              <button type="button" role="menuitem" onClick={() => setReadingRoles("stone")}
                className="min-h-11 rounded-xl bg-[#3a240c] text-[14px] font-bold text-[#f3c66b] ring-1 ring-[#f0a32e]/60 active:scale-95">💎 Stone</button>
            </div>
          ))}
          {!reading && picker !== v.me.seat && onMark && (
            <div className="flex items-center justify-center gap-1 border-t border-brass/30 pt-1" role="group" aria-label="Your private mark — only you see it">
              <span className="mr-1 text-[12px] text-stock/70">Mark</span>
              {(Object.keys(MARK) as Mark[]).map((m) => (
                <button key={m} type="button" role="menuitemradio" aria-label={`Mark ${MARK[m].label}`} aria-checked={marks[picker] === m}
                  onClick={() => { onMark(picker, marks[picker] === m ? null : m); setPicker(null); }}
                  className={`grid h-9 w-9 place-items-center rounded-full text-[13px] font-black ${MARK[m].dot} ${marks[picker] === m ? "ring-2 ring-stock" : ""}`}>{MARK[m].glyph}</button>
              ))}
              {marks[picker] && <button type="button" role="menuitem" aria-label="Clear mark" onClick={() => { onMark(picker, null); setPicker(null); }} className="grid h-9 w-9 place-items-center rounded-full text-[14px] text-stock/80 ring-1 ring-brass/50">✕</button>}
            </div>
          )}
          {!reading && picker !== v.me.seat && <div className="flex justify-center gap-1">
          {onThrow && REACTIONS.map((e) => (
            <button key={e} type="button" role="menuitem" onClick={() => { onThrow(picker, e); setPicker(null); }} className="grid h-10 w-10 place-items-center rounded-full text-[22px] active:scale-90">{e}</button>
          ))}
          {peerOf(picker) && (
            <button type="button" role="menuitem" aria-label={peerOf(picker)!.hushed ? "Unmute for me" : "Mute for me"} onClick={() => { voice.hush(picker); setPicker(null); }}
              className="grid h-10 w-10 place-items-center rounded-full text-[20px]">{peerOf(picker)!.hushed ? "🔊" : "🔇"}</button>
          )}
          </div>}
        </div>
      )}
      {flying.map((t) => {
        const f = pos(t.from), to = pos(t.to);
        return <span key={t.id} aria-hidden className="throw z-40 text-[34px]"
          style={{ ["--fx" as string]: `${f.x}%`, ["--fy" as string]: `${f.y}%`, ["--tx" as string]: `${to.x}%`, ["--ty" as string]: `${to.y}%` }}>{t.emoji}</span>;
      })}
      <div className="absolute left-1/2 top-1/2 max-h-[56%] w-[60%] max-w-[260px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl [scrollbar-width:none]">{children}</div>
    </section>
  );
}

type SeatSize = "lg" | "md" | "sm";
const SEAT: Record<SeatSize, { disc: string; tag: string; w: string }> = {
  lg: { disc: "h-14 w-14 text-[24px]", tag: "px-3 py-0.5 text-[13px] max-w-[96px]", w: "w-[96px]" },
  md: { disc: "h-11 w-11 text-[18px]", tag: "px-2 py-px text-[11px] max-w-[76px]", w: "w-[76px]" },
  sm: { disc: "h-9 w-9 text-[14px]", tag: "px-1.5 py-px text-[10px] max-w-[60px]", w: "w-[60px]" },
};

function Seat({ p, me, size, initials, got, tag, spot, voted, picked, speaking, micOff, hushed, away = false, mark, said, onTap }: {
  p: PublicPlayer; me: boolean; size: SeatSize; initials: string; got?: number; tag?: "played" | "target"; spot: boolean; voted: boolean; picked: boolean;
  speaking: boolean; micOff: boolean; hushed: boolean; away?: boolean; mark?: Mark; said?: SaidAbout; onTap?: () => void;
}) {
  const z = SEAT[size];
  const label = `${p.name}${me ? " (you)" : ""}${got ? `, got ${got} vote${got === 1 ? "" : "s"}` : ""}: ${p.handSize} cards, ${p.votes} vote${p.votes === 1 ? "" : "s"}${p.alive ? "" : p.revealedRole ? `, out — was ${p.revealedRole}` : ", out"}${spot ? ", their move" : ""}${speaking ? ", talking" : ""}${voted ? ", has voted" : ""}${away ? ", away" : ""}${mark ? `, you marked ${MARK[mark].label}` : ""}${said?.accuse ? `, called a thief ${said.accuse} times` : ""}${said?.trust ? `, called a villager ${said.trust} times` : ""}${said?.role ? `, read as ${said.role}` : ""}${said?.stone !== undefined ? (said.stone ? ", said to hold a Stone" : ", said to hold no Stone") : ""}`;
  return (
    <div className={`relative flex flex-col items-center text-center ${z.w} ${p.alive ? "" : "opacity-45 grayscale"}`}>
      {/* the play in the centre panel, on the ring: who played it, and at whom (12-player playtest: "who did what to whom") */}
      {tag && <span className={`absolute -top-3.5 z-20 rounded-full px-1.5 text-[9px] font-black uppercase tracking-wide ${tag === "played" ? "bg-[#f0a32e] text-card-ink" : "bg-crimson text-ink"}`}>{tag}</span>}
      <button type="button" disabled={!onTap} onClick={onTap} aria-label={label} aria-pressed={onTap ? picked : undefined}
        className={`relative grid select-none place-items-center rounded-full font-medium text-card-ink ${z.disc}
          ${me ? "outline-[3px] outline-offset-2 outline-jade" : ""} ${spot ? "outline-[3px] outline-offset-[3px] outline-[#f0a32e] shadow-[0_0_18px_4px_rgba(240,163,46,.45)]" : ""}
          ${speaking ? "speaking" : ""} ${picked ? "ring-4 ring-jade" : ""} ${tag === "target" ? "ring-[3px] ring-crimson" : ""}`}
        style={{ background: SEAT_COLOURS[p.seat % SEAT_COLOURS.length] }}>
        {p.alive ? initials : "✕"}
        <span className="absolute -bottom-1 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-ember px-1 text-[10px] font-bold tabular-nums text-stock ring-1 ring-brass/60" aria-hidden>{p.handSize}</span>
        {(micOff || hushed) && <span className="absolute -left-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-ember ring-1 ring-brass/50"><MicOff small crossed={hushed} /></span>}
        {Boolean(got) && <span key={got} className="pop absolute -left-2 -top-2 z-10 grid h-6 min-w-6 place-items-center rounded-full bg-crimson px-1 text-[12px] font-black text-ink ring-2 ring-ember" aria-hidden>{got}</span>}
        {voted && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#f0a32e] text-[11px] font-black text-card-ink" aria-hidden>✓</span>}
        {/* a stand-in is playing for them */}
        {away && <span className="absolute -bottom-1 -left-1.5 grid h-5 w-5 place-items-center rounded-full bg-ember text-[11px] ring-1 ring-brass/60" aria-hidden>💤</span>}
        {/* your private mark — only this phone knows */}
        {mark && <span className={`absolute -left-2.5 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full text-[10px] font-black ring-2 ring-ember ${MARK[mark].dot}`} aria-hidden>{MARK[mark].glyph}</span>}
      </button>
      <span className={`relative z-10 -mt-1 truncate rounded-full border bg-ember font-medium ${z.tag} ${me ? "border-2 border-jade text-jade-soft" : spot ? "border-[#f0a32e] text-[#f3c66b]" : "border-brass/60 text-stock"}`}>{p.name}</span>
      {p.alive
        ? <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden>{p.votes > 1 && Array.from({ length: p.votes }).map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#f0a32e]" />)}</span>
        : <span className="text-[10px] leading-tight text-crimson-soft">{p.revealedRole ?? "out"}</span>}
      {/* what the table has said ABOUT them — kept on the seat once the feed has scrolled on (Town of Salem's notepad, BGA's player panels) */}
      {p.alive && said && (said.accuse || said.trust || said.role || said.stone !== undefined) && (
        <span className="mt-0.5 flex max-w-full items-center gap-1 truncate rounded-full bg-black/50 px-1.5 text-[11px] leading-[16px] text-stock" aria-hidden>
          {said.accuse ? <span className="text-crimson-soft">🫵{said.accuse}</span> : null}
          {said.trust ? <span className="text-jade-soft">🌾{said.trust}</span> : null}
          {said.role ? <span className="truncate text-stock">🔮{said.role}</span> : null}
          {said.stone !== undefined ? <span className="text-[#f3c66b]">💎{said.stone ? "✓" : "✗"}</span> : null}
        </span>
      )}
      {spot && <span aria-hidden className="absolute -bottom-3 text-[12px] leading-none text-[#f0a32e]">▲</span>}
    </div>
  );
}

/** The framed panel in the middle: what just happened, whose move it is, and the vote when one is open. */
/** The ballot (designer 2026-10-06: an Among Us-style vote grid): while ballots are open your cards make way for one
 *  big tile per living player with their live count. Tap to vote; tap another to change — until the clock runs out. */
function Ballot({ v, mine, live, act }: { v: PlayerView; mine: number | null | undefined; live: Record<string, number>; act: (a: Action) => void }) {
  const ini = initialsOf(v.players.map((p) => p.name));
  const living = v.players.filter((p) => p.alive);
  const cast = (target: number | null) => { if (target !== mine) act({ type: "vote", target }); };
  return (
    <section className="sticky bottom-0 z-20 flex flex-col gap-2 rounded-t-3xl border-t border-brass/30 bg-ember px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-14px_30px_-6px_rgba(0,0,0,.75)]">
      <h2 className="text-center font-display text-[24px] font-bold leading-tight text-stock">Who goes out?</h2>
      <p className="-mt-1 text-center text-[12px] text-stock/60">{mine === undefined ? "Tap a player to vote." : "Tap another player to change your vote."}</p>
      <ul className="grid max-h-[38dvh] grid-cols-3 gap-2 overflow-y-auto pt-2" role="radiogroup" aria-label="Your vote">
        {living.map((p) => {
          const me = p.seat === v.me.seat;
          const chosen = mine === p.seat;
          const n = live[p.seat] ?? 0;
          return (
            <li key={p.seat}>
              <button type="button" role="radio" aria-checked={chosen} onClick={() => cast(p.seat)}
                aria-label={`${p.name}${me ? " (you)" : ""}, ${n} vote${n === 1 ? "" : "s"}${chosen ? ", your vote" : ""}`}
                className={`relative flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 px-1 pb-1.5 pt-2 active:translate-y-px ${chosen ? "border-[#f0a32e] bg-[#3a240c] shadow-[0_0_14px_2px_rgba(240,163,46,.35)]" : "border-brass/40 bg-black/30"}`}>
                <span className="grid h-9 w-9 place-items-center rounded-full text-[15px] font-medium text-card-ink" style={{ background: SEAT_COLOURS[p.seat % SEAT_COLOURS.length] }}>{ini[p.seat]}</span>
                <span className={`w-full truncate text-[12px] font-semibold ${me ? "text-jade-soft" : "text-stock"}`}>{me ? "You" : p.name}</span>
                {n > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-crimson px-1 text-[12px] font-black text-ink ring-2 ring-ember">{n}</span>}
                {chosen && <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#f0a32e] px-1.5 text-[9px] font-black uppercase tracking-wide text-card-ink">Your vote</span>}
              </button>
            </li>
          );
        })}
        <li>
          <button type="button" role="radio" aria-checked={mine === null} onClick={() => cast(null)}
            className={`flex min-h-[72px] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-1 text-[12px] font-semibold uppercase tracking-wide active:translate-y-px ${mine === null ? "border-[#f0a32e] bg-[#3a240c] text-[#f3c66b]" : "border-brass/30 text-stock/60"}`}>
            Abstain
          </button>
        </li>
      </ul>
    </section>
  );
}

/** the open vote so far: each ballot weighs as many votes as its voter holds */
function liveTally(v: PlayerView): Record<string, number> {
  const t: Record<string, number> = {};
  for (const [voter, target] of Object.entries(v.ballots ?? {})) {
    if (target === null) continue;
    t[target] = (t[target] ?? 0) + (v.players[Number(voter)]?.votes ?? 1);
  }
  return t;
}

/** seconds left on the floor */
/** whose turn comes after this one (the next living seat) — only while a turn is on */
function nextUp(v: PlayerView): string | null {
  if (!v.phase.startsWith("turn")) return null;
  const n = v.players.length;
  for (let k = 1; k < n; k++) { const p = v.players[(v.turnSeat + k) % n]; if (p.alive) return p.seat === v.me.seat ? "you" : p.name; }
  return null;
}

const TAGLESS = new Set(["pass", "away", "back", "floor_extended", "timeout", "gift", "dal_badal_done", "whisper", "whisper_private"]);

/** THE CENTRE (designer 2026-10-09, option A — "every little thing must be displayed at the center"): a status line,
 *  then the running feed — newest at the bottom and biggest, older lines smaller and fainter — then the debate's
 *  controls. Tap the feed for everything that was said and done. */
function Centre({ v, feed, onOpen, compact, living, extend, ready }: {
  v: PlayerView; feed: FeedItem[]; onOpen: () => void; compact: boolean; living: number;
  extend?: () => void; ready: () => void;
}) {
  const d = v.decision;
  const voteOpen = v.phase.endsWith("_vote");
  const debate = v.phase.endsWith("_debate");
  const btn = "min-h-11 rounded-full border-2 border-brass/70 px-3 font-[family-name:var(--font-engraved)] text-[13px] font-bold uppercase tracking-wide";
  const names = v.players.map((p) => p.name);
  // the debate's buttons and your move need the room: 3 lines then
  const lines = feed.slice(compact || debate ? -3 : -6);
  return (
    <div className="relative rounded-2xl border border-brass/70 bg-[#1a0e06]/90 px-2.5 pb-2.5 pt-3 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,.8)]">
      <Ornament className="absolute -top-2 left-1/2 -translate-x-1/2" />
      <Ornament className="absolute -bottom-2 left-1/2 -translate-x-1/2" />

      <p className={`text-[12px] font-semibold leading-snug ${debate || voteOpen ? "text-[#f3c66b]" : d ? "text-jade-soft" : "text-stock/70"}`}>
        {debate ? `${v.phase.startsWith("final") ? "Last debate" : "Faisla"} — accuse, defend, claim`
          : voteOpen ? `Vote · ${living - v.waitingOn.length} of ${living} voted`
          : <>{status(v)}{nextUp(v) ? <span className="text-stock/50"> · next: <b className="text-[#f3c66b]">{nextUp(v)}</b></span> : null}</>}
      </p>

      <button type="button" onClick={onOpen} aria-label="Everything at the table" className="mt-1.5 block w-full text-left" aria-live="polite">
        {lines.length === 0
          ? <p className="py-2 text-center font-display text-[15px] text-stock/80">The cards are dealt.</p>
          : <ul className="flex flex-col gap-1">
              {lines.map((it, i) => <FeedLine key={it.id} it={it} names={names} me={v.me.seat} rank={lines.length - 1 - i} />)}
            </ul>}
      </button>

      {debate && d?.kind === "debate" && (
        <div className="mt-2 flex flex-col items-center gap-1.5">
          <p className="text-[12px] text-stock/60">{d.ready.length} of {living} ready</p>
          <button type="button" onClick={ready} className={`${btn} w-full bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] text-stock`}>Ready to vote</button>
          {extend && <button type="button" onClick={extend} className="min-h-8 text-[11px] text-stock/60 underline">+30s (host, once)</button>}
        </div>
      )}
    </div>
  );
}

const TONE_TEXT: Record<string, string> = { lethal: "text-crimson-soft", vote: "text-[#f3c66b]", relic: "text-jade-soft", gold: "text-[#f3c66b]", neutral: "text-stock" };
const KIND_ICON: Partial<Record<FeedItem["kind"], string>> = { vote: "🗳", caption: "🎙", react: "", whisper: "🤫" };

/** one line of the feed: who (in their seat colour) → what. rank 0 = newest (biggest), then smaller and fainter */
function FeedLine({ it: raw, names, me, rank, full = false }: { it: FeedItem; names: string[]; me: number; rank: number; full?: boolean }) {
  // the 🤖 badge belongs on the seat, not in every sentence
  const it = { ...raw, text: raw.text.replace(/\s*🤖/g, ""), detail: raw.detail?.replace(/\s*🤖/g, "") };
  // (2026-10-09, research: stream/phone readability) a step bigger than before: 16 / 14 / 13
  const size = full ? "text-[15px]" : rank === 0 ? "text-[16px] font-semibold" : rank === 1 ? "text-[14px]" : "text-[13px]";
  const fade = full || rank <= 1 ? "" : rank === 2 ? "opacity-75" : "opacity-55";
  const who = (seat?: number) => seat === undefined ? null
    : <b style={{ color: SEAT_COLOURS[seat % SEAT_COLOURS.length] }}>{seat === me ? "You" : names[seat]?.replace(/\s*🤖$/, "")}</b>;
  let body: React.ReactNode;
  if (it.kind === "talk" || it.kind === "caption") body = <>{KIND_ICON[it.kind] ? `${KIND_ICON[it.kind]} ` : ""}{who(it.seat)}: <span className="italic">&ldquo;{it.text}&rdquo;</span></>;
  else if (it.kind === "claim") body = <span className={TONE_TEXT[it.tone]}>{it.tone === "lethal" ? "🫵" : it.tone === "gold" ? "💎" : "🌾"} {it.text}</span>;
  else body = <span className={it.mine ? "text-jade-soft" : it.kind === "event" ? TONE_TEXT[it.tone] : "text-stock/90"}>
    {it.mine ? "🔒 Only you: " : KIND_ICON[it.kind] ? `${KIND_ICON[it.kind]} ` : ""}{it.text}
    {it.detail && (rank === 0 || full) && <span className="mt-0.5 block text-[12px] font-normal text-stock/70">{it.detail}</span>}
  </span>;
  // in the centre a line is two rows at most — the whole of it is one tap away
  return <li className={`stage-in leading-snug text-stock ${size} ${fade} ${full ? "" : "line-clamp-2"}`}>{body}</li>;
}

function FeedList({ items, names, me }: { items: FeedItem[]; names: string[]; me: number }) {
  if (!items.length) return <p className="text-center text-[14px] text-stock/60">Nothing yet.</p>;
  return <ul className="flex max-h-[60dvh] flex-col gap-2 overflow-y-auto">{items.map((it) => <FeedLine key={it.id} it={it} names={names} me={me} rank={0} full />)}</ul>;
}

function Ornament({ className = "" }: { className?: string }) {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" className={className} aria-hidden>
      <path d="M11 1l7 7-7 7-7-7z" fill="#1a0e06" stroke="#e0a24a" strokeWidth="1.4" /><path d="M11 5l3 3-3 3-3-3z" fill="#e0a24a" />
    </svg>
  );
}

function Divider() {
  return (
    <svg viewBox="0 0 200 12" className="mx-auto my-2 h-3 w-full" aria-hidden>
      <path d="M0 6h88M112 6h88" stroke="#8a5a1c" strokeWidth="1" /><path d="M100 1l6 5-6 5-6-5z" fill="none" stroke="#e0a24a" strokeWidth="1.2" />
    </svg>
  );
}

/** "Your Cards": the tiles, and — when it's your move — the pair buttons or the next step. */
function Tray({ v, act, live, banner = null, waitForExit = false }: { v: PlayerView; act: (a: Action) => void; live: Record<string, number> | null; banner?: React.ReactNode; waitForExit?: boolean }) {
  const d = v.decision;
  const exitFirst = waitForExit && (d?.kind === "gift" || d?.kind === "handoff");
  if (d?.kind === "vote") return <>{banner && <div className="relative z-20">{banner}</div>}<Ballot v={v} mine={d.mine} live={live ?? {}} act={act} /></>;
  const inTray = d && d.kind !== "debate";
  return (
    <section className="sticky bottom-0 z-20 flex flex-col gap-2 rounded-t-3xl border-t border-brass/30 bg-ember px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-14px_30px_-6px_rgba(0,0,0,.75)]">
      {banner && <div className="-mx-3">{banner}</div>}
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-brass/40" /><Ornament /><span className="h-px flex-1 bg-brass/40" />
      </div>
      <div className="-mt-1 grid grid-cols-[1fr_auto_1fr] items-center">
        <span />
        <h2 className="text-center font-display text-[24px] font-bold leading-tight text-stock">
          {!v.me.alive ? "You're out" : inTray ? "Your move" : "Your Cards"}
        </h2>
      </div>
      {!v.me.alive && <p className="text-center text-[13px] text-stock/70">You&rsquo;re out — you can still talk to the table.</p>}
      {exitFirst ? <p className="py-3 text-center font-display text-[16px] text-stock/80">Your last decision comes next…</p>
        : inTray ? <Decide key={v.phase} v={v} act={act} /> : v.me.alive && <HandRow cards={v.me.hand} />}
    </section>
  );
}

function Story({ v }: { v: PlayerView }) {
  const items = [...v.events].reverse().filter((e) => !["analytics_deal", "analytics_turn"].includes(e.type)).slice(0, 120);
  return (
    <ul className="flex max-h-[55dvh] flex-col gap-1.5 overflow-y-auto text-[14px]">
      {items.map((e) => (
        <li key={e.n} className={e.to === "all" ? "text-ink-2" : "rounded-lg bg-jade/10 px-2 py-1 text-jade-soft"}>
          {e.to === "all" ? "" : "Private · "}{e.msg}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- the end: every role flips, the whole story opens
/** Game over (2026-10-07): the verdict, then the whole table turns its role cards over, round the same ring, with
 *  the two Stones in the middle saying where they ended up — the question the whole game was about. */
function Final({ v, clips = [], host = false, hostName = "the host", onRematch }: {
  v: PlayerView; clips?: { label: string; url: string }[]; host?: boolean; hostName?: string; onRematch?: () => Promise<unknown>;
}) {
  const [again, setAgain] = useState<"idle" | "busy" | "error">("idle");
  const [story, setStory] = useState(false);
  const reveal = v.finalReveal!;
  const village = v.winner === "V";
  const mine = reveal.find((r) => r.seat === v.me.seat)!;
  const won = mine.side === v.winner;
  const name = (seat: number) => v.players[seat]?.name ?? "?";
  // the end lands with a fanfare (or a wah-wah) once
  useEffect(() => { play(won ? "fanfare" : "sting"); buzz(won ? [60, 40, 60, 40, 160] : 200); }, [won]);
  // where each Stone ended: in a living player's hand, or with the village (the cards left on the table at the end,
  // and the cards of anyone the mandatory vote put out)
  const stoneAt = (c: Card) => {
    const r = reveal.find((x) => x.hand.includes(c) && v.players[x.seat].alive);
    return r ? { who: name(r.seat), side: r.side as Side, role: r.role } : { who: "The village", side: "V" as Side, role: null };
  };
  // WHY (2026-10-09 — Among Us players ask the end screen for the reason, not just the result): Thieves win only if a
  // living thief holds a Stone
  const STONES: Card[] = ["STONE_1", "STONE_2"];
  const held = STONES.map((c) => ({ c, ...stoneAt(c) }));
  const plainName = (w: string) => w.replace(/\s*🤖$/, "");
  const why = !village
    ? held.filter((h) => h.side === "T").map((h) => `${plainName(h.who)} (${h.role}) kept the ${STONE_NAME[h.c]}`).join(" · ")
    : held.every((h) => h.role === null) ? "Both Stones ended with the village." : "No thief kept a Stone.";
  const n = reveal.length;
  const size: SeatSize = n <= 8 ? "lg" : n <= 16 ? "md" : "sm";
  // the mandatory vote decided the game: everyone sees how many votes each player got
  const finalTally = (v.events.filter((e) => e.type === "vote_result" && e.data?.reason === "final").at(-1)?.data?.tally ?? {}) as Record<string, number>;
  const ini = initialsOf(v.players.map((p) => p.name));
  const btn = "min-h-12 rounded-full border-2 border-brass/70 font-[family-name:var(--font-engraved)] text-[14px] font-bold uppercase tracking-[0.1em]";

  return (
    <section className="flex min-h-dvh flex-col px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
      <div aria-hidden className="fixed inset-0 -z-10 bg-[radial-gradient(80%_45%_at_50%_30%,var(--color-ember-2)_0%,var(--color-ember)_60%,#120903_100%)]" />

      <header className="stage-in text-center">
        <Divider />
        <p className="font-[family-name:var(--font-engraved)] text-[12px] font-semibold uppercase tracking-[0.3em] text-brass">Game over</p>
        <h1 className={`mt-1 font-display text-[clamp(34px,11vw,46px)] font-bold uppercase leading-none tracking-wide ${village ? "text-[#f3c66b]" : "text-crimson-soft"}`}>
          {village ? "Tunga wins" : "Thieves win"}
        </h1>
        <p className="mt-2 font-display text-[16px] text-stock/90">{why}</p>
        <p className={`mt-1 font-display text-[15px] ${won ? "text-jade-soft" : "text-stock/70"}`}>{won ? "You won" : "You lost"} — you were {mine.role}</p>
      </header>

      {/* everyone turns their role over, round the same ring as the table */}
      <div className="relative mx-1 mt-3 min-h-[400px] flex-1" role="list" aria-label="Everyone's role">
        <div className="absolute inset-x-[9%] inset-y-[8%] rounded-[50%] border border-brass/35" aria-hidden />
        {Array.from({ length: n }, (_, k) => {
          const r = reveal[(v.me.seat + k) % n];
          const p = v.players[r.seat];
          const me = r.seat === v.me.seat;
          const angle = Math.PI / 2 + (k * 2 * Math.PI) / n;
          const z = SEAT[size];
          const thief = r.side === "T";
          return (
            <div key={r.seat} role="listitem" className={`flip-in absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center ${z.w}`}
              style={{ left: `${50 + 41 * Math.cos(angle)}%`, top: `${50 + 42 * Math.sin(angle)}%`, animationDelay: `${300 + k * 160}ms` }}
              aria-label={`${p.name}${me ? " (you)" : ""}: ${r.role}, ${thief ? "thief" : "Tunga"}${p.alive ? "" : ", out"}`}>
              {Boolean(finalTally[r.seat]) && <span className="absolute left-0 top-0 z-20 grid h-6 min-w-6 place-items-center rounded-full bg-crimson px-1 text-[12px] font-black text-ink ring-2 ring-ember" aria-label={`${finalTally[r.seat]} votes`}>{finalTally[r.seat]}</span>}
              <span className={`relative grid place-items-center rounded-full font-medium text-card-ink ${z.disc} ${me ? "outline-[3px] outline-offset-2 outline-jade" : ""} ${p.alive ? "" : "opacity-50 grayscale"}`}
                style={{ background: SEAT_COLOURS[r.seat % SEAT_COLOURS.length], boxShadow: `0 0 0 3px ${thief ? "#c0392b" : "#e0a24a"}` }}>
                {ini[r.seat]}
              </span>
              <span className={`relative z-10 -mt-1 truncate rounded-full border bg-ember font-medium ${z.tag} ${me ? "border-2 border-jade text-jade-soft" : "border-brass/60 text-stock"}`}>{p.name}</span>
              <span className={`mt-0.5 truncate rounded px-1.5 font-[family-name:var(--font-engraved)] text-[10px] font-bold uppercase tracking-wide ${thief ? "bg-crimson-deep text-ink" : "bg-[#3a240c] text-[#f3c66b]"}`}>{r.role}</span>
            </div>
          );
        })}

        {/* the middle: where the two Stones ended */}
        <div className="absolute left-1/2 top-1/2 w-[54%] max-w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-brass/70 bg-[#1a0e06]/90 px-3 pb-3 pt-4 text-center">
          <Ornament className="absolute -top-2 left-1/2 -translate-x-1/2" />
          <p className="font-[family-name:var(--font-engraved)] text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">The Stones</p>
          <ul className="mt-2 flex flex-col gap-2 text-left">
            {(["STONE_1", "STONE_2"] as Card[]).map((c) => {
              const at = stoneAt(c);
              return (
                <li key={c} className="flex items-center gap-2">
                  <CardIcon c={c} className="w-8 shrink-0" />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate font-display text-[14px] font-bold text-stock">{at.who}</span>
                    <span className={`text-[11px] font-bold uppercase tracking-wide ${at.side === "V" ? "text-[#f3c66b]" : "text-crimson-soft"}`}>{at.side === "V" ? "Tunga" : "Thief"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* the best voice moments of the game, as this phone heard them */}
      {clips.length > 0 && (
        <div className="mt-3 rounded-2xl border border-brass/40 bg-black/30 p-3">
          <p className="mb-2 text-center font-[family-name:var(--font-engraved)] text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">Highlights</p>
          <ul className="flex flex-col gap-1.5">
            {clips.map((c) => (
              <li key={c.url}>
                <button type="button" onClick={() => void new Audio(c.url).play().catch(() => {})}
                  className="flex min-h-10 w-full items-center gap-2 rounded-xl border border-brass/30 px-3 text-left text-[14px] text-stock active:translate-y-px">▶ {c.label}</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {won && <Confetti />}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ShareResult won={won} village={village} role={mine.role} thief={mine.side === "T"} caught={reveal.filter((r) => r.side === "T" && !v.players[r.seat].alive).length} />
        {host && onRematch ? (
          // PLAY AGAIN keeps the table: same group, back to the lobby (everyone's phone follows)
          <button type="button" disabled={again === "busy"} onClick={() => { setAgain("busy"); onRematch().catch(() => setAgain("error")); }}
            className={`${btn} bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] text-stock disabled:opacity-60`}>
            {again === "busy" ? "…" : again === "error" ? "Try again" : "Play again"}
          </button>
        ) : (
          <Link href="/" className={`${btn} inline-flex items-center justify-center border-brass/40 text-stock/80`}>Leave</Link>
        )}
      </div>
      {!host && <p className="mt-2 text-center text-[14px] text-stock/70">Waiting for {hostName} to start the next game…</p>}
      <div className="mt-2 flex justify-center gap-6 text-[13px] text-stock/60">
        <button type="button" onClick={() => setStory(true)} className="min-h-10 underline-offset-2 hover:underline">The whole story</button>
      </div>
      {story && <Sheet title="The whole story — every secret" onClose={() => setStory(false)}><Story v={v} /></Sheet>}
    </section>
  );
}


// ---------------------------------------------------------------- voice
function MicOff({ small = false, crossed = false }: { small?: boolean; crossed?: boolean }) {
  const px = small ? 10 : 14;
  return (
    <svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-label={crossed ? "muted by you" : "mic off"} className={crossed ? "text-crimson-soft" : "text-muted"}>
      {crossed
        ? <><path d="M11 5L6 9H3v6h3l5 4z" /><path d="M22 9l-6 6M16 9l6 6" /></>
        : <><path d="M9 9v3a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.7" /><path d="M19 11a7 7 0 0 1-1.2 3.9M5 11a7 7 0 0 0 11.2 5.6M12 19v3M3 3l18 18" /></>}
    </svg>
  );
}

function MicButton({ voice }: { voice: VoiceCtl }) {
  if (voice.status === "unavailable") return null;
  if (voice.status === "off")
    return <button onClick={voice.join} className="min-h-11 rounded-full bg-jade px-4 text-[13px] font-extrabold uppercase tracking-wide text-card-ink">Join voice</button>;
  const live = voice.micOn && !voice.micBlocked;
  return (
    <button onClick={voice.toggleMic} aria-pressed={live} aria-label={voice.micBlocked ? "Microphone blocked — tap to retry" : live ? "Mute your mic" : "Unmute your mic"}
      className={`grid h-11 w-11 place-items-center rounded-full ${live ? (voice.speaking ? "speaking bg-jade text-card-ink" : "bg-jade/20 text-jade-soft") : "bg-crimson-deep text-ink"}`}>
      {live
        ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4" /></svg>
        : <MicOff />}
    </button>
  );
}

/** Voice is on by default — this only shows when the browser needs a tap, or the mic was refused. */
function VoiceBanner({ voice }: { voice: VoiceCtl }) {
  if (voice.status === "needs-tap")
    return <button onClick={voice.unlock} className="m-3 mb-0 rounded-xl border-2 border-jade bg-jade-deep/60 p-3 text-left font-bold text-jade-soft">Tap to hear the table 🔊</button>;
  if (voice.micBlocked && voice.status === "on")
    return <p className="m-3 mb-0 rounded-xl border border-brass/40 bg-black/30 p-3 text-[13px] text-stock/75">Mic blocked — you&rsquo;re listening only. Allow the microphone, then tap the mic.</p>;
  return null;
}

// ---------------------------------------------------------------- humans and bots at one table
const TIPS = "tunga:tips";
const STONE_NAME: Partial<Record<Card, string>> = { STONE_1: "Bhadra Stone", STONE_2: "Tunga Stone" };
const TIP_TEXT: Record<string, React.ReactNode> = {
  turn: <>Your turn: play a glowing pair, or pass your cards on.</>,
  debate: <>Faisla: talk it out, then tap <b>Ready to vote</b>.</>,
  vote: <>Tap who goes out. You can change your vote.</>,
  bots: <>🤖 Bots can&rsquo;t hear voice — tap a seat: <b>🌾 Villager · 🫵 Thief · 🔮 Role · 💎 Stone</b></>,
  seats: <>Tap anyone to say <b>🌾 Villager, 🫵 Thief, 🔮 Role or 💎 Stone</b> — true or a lie. Tap <b>yourself</b> for quick lines.</>,
};
/** tap your own seat: lines anyone says at a real table (designer 2026-10-09) */
const QUICK_LINES = ["🙋 Not me!", "🌾 I'm with the village", "🪨 I have no Stone", "⏳ Wait"];
const isBot = (name: string) => /🤖$/.test(name);

/** a first-time tip: shown once per phone, gone on ✕ or once you do the thing */
function Tip({ text, onDone }: { text: React.ReactNode; onDone: () => void }) {
  return (
    <button type="button" onClick={onDone} className="stage-in mx-3 mb-2 flex min-h-11 items-center gap-2 rounded-xl border border-jade/60 bg-jade-deep/40 px-3 text-left text-[14px] leading-snug text-jade-soft">
      <span className="flex-1">{text}</span>
      <span aria-label="Got it" className="text-[16px]">✕</span>
    </button>
  );
}

// ---------------------------------------------------------------- what's been said about each seat, and your own marks
type Mark = "trust" | "sus" | "unsure";
const MARK: Record<Mark, { label: string; glyph: string; dot: string }> = {
  trust: { label: "trusted", glyph: "✓", dot: "bg-jade text-card-ink" },
  sus: { label: "suspect", glyph: "!", dot: "bg-crimson text-ink" },
  unsure: { label: "unsure", glyph: "?", dot: "bg-[#f0a32e] text-card-ink" },
};
interface SaidAbout { accuse: number; trust: number; role?: string; stone?: boolean }
/** every public claim about a seat: how often called a thief, how often vouched for, the last role named for them */
function saidAbout(v: PlayerView): Record<number, SaidAbout> {
  const out: Record<number, SaidAbout> = {};
  const seen = new Set<string>();
  for (const e of v.events) {
    if (e.type !== "claim" || e.to !== "all") continue;
    const t = e.data?.target as number | undefined;
    if (t === undefined) continue;
    // one speaker saying the same thing twice counts once
    const key = `${e.data?.seat}:${e.data?.kind}:${t}:${e.data?.side}:${e.data?.has}:${e.data?.role}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const a = (out[t] ??= { accuse: 0, trust: 0 });
    if (e.data?.kind === "kundli") a.role = String(e.data?.role ?? "");
    else if (e.data?.kind === "stone") a.stone = Boolean(e.data?.has);
    else if (e.data?.side === "T") a.accuse++;
    else a.trust++;
  }
  return out;
}

// ---------------------------------------------------------------- turn alerts
/** 🔔 a push when it's your move and your phone is on something else (lib/alerts.ts) */
function AlertsToggle({ code, token, on }: { code: string; token: string; on: boolean }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const support = alertSupport();
  const row = "flex min-h-12 items-center gap-3 rounded-2xl border border-brass/40 px-4 text-left text-[14px] text-stock disabled:opacity-60";
  if (support === "no") return null;
  if (support === "home-screen")
    return <p className="rounded-2xl border border-brass/30 px-4 py-3 text-[13px] text-stock/75">🔔 For turn alerts on iPhone: Share → <b>Add to Home Screen</b>, then open the game from there.</p>;
  const flip = async () => {
    setBusy(true); setNote(null);
    try {
      if (on) await disableAlerts(code, token);
      else if (!(await enableAlerts(code, token))) setNote("Alerts are blocked — allow notifications for this site in your browser.");
    } catch { setNote("Couldn't turn alerts on here."); }
    setBusy(false);
  };
  return (
    <>
      <button type="button" disabled={busy} aria-pressed={on} onClick={flip} className={row}>
        <span className="text-[18px]" aria-hidden>{on ? "🔔" : "🔕"}</span>{on ? "Turn alerts on" : "Turn alerts off"}
      </button>
      {note && <p role="alert" className="text-[13px] text-crimson-soft">{note}</p>}
    </>
  );
}

// ---------------------------------------------------------------- learn by playing
/** The coach's line for this moment of a guided first game (designer 2026-10-09, option A). One line at a time, in
 *  the order a new player meets things; each is shown until its moment passes, then never again. */
function coachFor(v: PlayerView, seen: string[], solo = false): { id: string; text: React.ReactNode } | null {
  const d = v.decision;
  const me = v.me.seat;
  const stone = v.me.hand.some((c) => c === "STONE_1" || c === "STONE_2");
  const read = v.events.some((e) => e.type === "kundli_private" && Array.isArray(e.to) && e.to.includes(me));
  const steps: [string, boolean, React.ReactNode][] = [
    ["over", v.winner !== null, <>That&rsquo;s the game! Tap <b>Play again</b> for another — or go back and <b>play with friends</b>.</>],
    ["final", v.phase.startsWith("final") && d?.kind === "vote", <>The last vote. Vote out the player you think is a <b>thief holding a Stone</b> — their cards go to the village.</>],
    ["surrender", d?.kind === "surrender", <>The rounds are over. <b>Surrender your Stone</b> to the village — a thief holding one wins it for the thieves.</>],
    ["vote", d?.kind === "vote", <>Tap the player you think is a <b>thief</b>. You can change your vote until the clock runs out.</>],
    ["debate", d?.kind === "debate", <>A <b>Faisla</b>! Everyone talks. Say what you know, then tap <b>Ready to vote</b>.</>],
    ["tell", read && !d, <>Only <b>you</b> saw that role. Tell the table — tap their seat → <b>🌾 Villager · 🫵 Thief · 🔮 Role</b>. Or keep it secret.</>],
    ["turn", d?.kind === "turn", <>Your turn! The two <b>glowing cards</b> are a pair — tap <b>Play</b> to use its power. Or pass.</>],
    ["steps", Boolean(d) && d?.kind !== "turn", <>Follow the steps under your cards — pick a player, then the cards you pass on.</>],
    ["stone", stone, <>💎 You hold a <b>Stone</b>. Keep it away from thieves — at the end both Stones must be with villagers.</>],
    // THE SCREEN TOUR (designer 2026-10-09: "every feature should be explained"): while others play, one thing at a time
    ...TOUR.filter(([id]) => !(solo && id === "voice")).map(([id, text]) => [id, !d && v.phase.startsWith("turn"), text] as [string, boolean, React.ReactNode]),
  ];
  const s = steps.find(([id, when]) => when && !seen.includes(id));
  return s ? { id: s[0], text: s[2] } : null;
}

/** the screen, one feature at a time — also listed in How to play ("The screen") */
export const TOUR: [string, React.ReactNode][] = [
  ["centre", <>The <b>middle of the table</b> is its diary: every move, claim and vote, newest at the bottom. Tap it to see everything.</>],
  ["claims", <>Tap any player to tell the table <b>🌾 Villager · 🫵 Thief · 🔮 Role · 💎 Stone</b> — true or a lie. Bots listen.</>],
  ["marks", <>In that menu, <b>Mark ✓ ! ?</b> is your private note on a player. Only you see it.</>],
  ["counts", <>Under a name: <b>🫵</b> times called a thief, <b>🌾</b> called a villager, <b>💎✓/✗</b> said to hold a Stone or not.</>],
  ["badges", <>On each player: the <b>number</b> is cards held, <b>dots</b> mean extra votes, <b>💤</b> means away.</>],
  ["self", <>Tap <b>yourself</b> for quick lines like &ldquo;Not me!&rdquo;</>],
  ["react", <>From a player&rsquo;s menu, throw <b>🍅 😂 🔥</b> at them.</>],
  ["voice", <>Your <b>mic is on</b> — just talk. The 🎙 button at the top mutes you.</>],
  ["clock", <>The <b>circle at the top right</b> is the clock for the move being made.</>],
  ["history", <>The <b>clock-arrow</b> at the top — or a tap on the middle — shows everything that happened so far.</>],
  ["menu", <><b>☰ Menu</b>: hold to peek at your role, sound, turn alerts.</>],
];

function Coach({ text, onNext, onSkip }: { text: React.ReactNode; onNext: () => void; onSkip: () => void }) {
  return (
    <div className="stage-in mx-3 mb-1 rounded-2xl border-2 border-[#f0a32e]/80 bg-[#2a1a08] px-3 pb-1 pt-2 text-[15px] leading-snug text-stock shadow-[0_8px_20px_-8px_rgba(0,0,0,.8)]" role="status">
      <p><span aria-hidden className="mr-1">🧑‍🏫</span>{text}</p>
      <div className="flex justify-end gap-4 text-[13px] font-semibold">
        <button type="button" onClick={onSkip} className="min-h-9 text-stock/60 underline underline-offset-2">Skip tutorial</button>
        <button type="button" onClick={onNext} className="min-h-9 text-[#f3c66b]">Got it ›</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- one sound switch (2026-10-09, "simplify")
type SoundSetting = "all" | "voices" | "off";
/** All = effects, music, the Sutradhar and lines read aloud · Voices only = the Sutradhar and lines, no effects or
 *  music · Off = silent (voice chat is the mic's business). The single switches stay under More. */
function SoundMode({ lines, setLines }: { lines: boolean; setLines: (on: boolean) => void }) {
  const [, redraw] = useState(0);
  const now: SoundSetting | null = soundOn() && musicOn() && narratorOn() && lines ? "all"
    : !soundOn() && !musicOn() && narratorOn() && lines ? "voices"
    : !soundOn() && !musicOn() && !narratorOn() && !lines ? "off" : null;
  const pick = (m: SoundSetting) => {
    setSound(m === "all"); setMusic(m === "all"); setNarrator(m !== "off"); setLines(m !== "off");
    redraw((x) => x + 1);
  };
  const opt = (m: SoundSetting, label: string) => (
    <button key={m} type="button" aria-pressed={now === m} onClick={() => pick(m)}
      className={`min-h-11 flex-1 rounded-full text-[13px] font-bold ${now === m ? "bg-[#f0a32e] text-card-ink" : "text-stock/80 ring-1 ring-brass/40"}`}>{label}</button>
  );
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label="Sound">
      <p className="text-[13px] font-semibold text-stock/70">Sound</p>
      <div className="flex gap-2">{opt("all", "All")}{opt("voices", "Voices only")}{opt("off", "Off")}</div>
    </div>
  );
}
