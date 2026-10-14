"use client";
/* Hallmark · genre: atmospheric · macrostructure: Workbench (app, portrait spotlight) · design-system: DESIGN.md · designed-as-app */
// The table, phone-first and portrait: a status line everyone reads the same way (BGA's "${actplayer} must…"),
// a seat strip where the spotlight glows, the table centre, and a dock with your role, your hand and your move.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, saveToken, useGame, useHydrated } from "@/lib/client";
import { beatsFor } from "@/lib/beats";
import type { Action, Card, GameEvent, Side } from "@/engine/types";
import type { StoneStep } from "@/engine/stonepath";
import { MIN_PLAYERS, THIEF_ROLES, VILLAGER_ROLES } from "@/engine/setup";
import { report as reportIssue } from "@/lib/report";
import { MotionSettings } from "./MotionSettings";
import { setStreamer, useStreamer } from "@/lib/streamer";
import type { PlayerView, PublicPlayer } from "@/engine/view";
import type { ClientState } from "@/server/game";
import { useStage } from "@/lib/stage";
import { Stage } from "./Stage";
import { Decide } from "./Decide";
import { HandRow } from "./Hand";
import { CARD_BACK, CardIcon, roleArt } from "./CardIcon";
import { Eject, thievesRemaining } from "./Eject";
import { Confetti, ShareResult } from "./Share";
import { buzz, duck, play, setSound, soundOn, unlockOnFirstTap, type Sound } from "@/lib/sfx";
import { musicDuck, musicOn, playSting, setMood, setMusic, startMusicOnFirstTap, stopMusic, type Mood } from "@/lib/music";
import { narrate, narratorOn, setNarrator } from "@/lib/narrator";
import { REACTIONS, ThrowQueue, reactionText, type Throw } from "@/lib/reactions";
import { setPtt, setTalking, usePtt } from "@/lib/ptt";
import { RoleReveal, revealSeen } from "./RoleReveal";
import { TimerRing } from "./ui";
import { useVoice } from "@/lib/voice";
import { MessageSheet, VoiceNoteSheet, WhisperBubble } from "./Whisper";
import { useBotSpeech } from "@/lib/botspeech";
import type { ChatMessage } from "@/server/store";
import { useFeed, CAPTION_PREFIX, type FeedItem } from "@/lib/feed";
import { useCaptions } from "@/lib/captions";
import { cut, say, setQuiet, useReading } from "@/lib/speech";
import { alertSupport, disableAlerts, enableAlerts, useAlertPresence } from "@/lib/alerts";
import { fx, juiceFor } from "@/lib/fx";
import { TableMoment, TABLE_MOMENTS, IMPACT_MS } from "./TableMoment";
import { FinaleBackdrop, FinalVoteOverlay, NightfallOverlay } from "./Cinematic";
import type { Beat } from "@/lib/beats";

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
  // you + bots only: nobody can hear you, so no mic, no talk button (designer 2026-10-09) — and NO voice connection at
  // all: the mic and the call were running hidden all game, a big battery drain (designer 2026-10-12)
  const solo = st?.status === "playing" && (st.view?.players.filter((p) => !isBot(p.name)).length ?? 2) <= 1;
  const voice = useVoice(
    code,
    st && !solo ? { seat: st.you.seat, name: st.you.name } : null,
    st?.status !== "playing",
    // whoever is speaking last words stays at the table until they finish
    // (designer 2026-10-09) no Gone room: a player who is out is still heard by everyone
    [],
    st?.voice ?? "mesh",
  );
  const ptt = usePtt();
  const me = st?.you.seat ?? -1;
  // a line read aloud on this phone holds the mic, so the call never carries it back (designer 2026-10-09, option 1)
  const reading = useReading();
  useEffect(() => { if (ptt.down) cut(); }, [ptt.down]);
  // an update (the Sutradhar) has priority over voice chat: mic held, the table ducked under it — even mid push-to-talk
  // (designer 2026-10-12) a player who is out watches in silence — their mic stays shut, except for their last words
  // your own floor (an accusation answered, a debate turn) or your last words open the mic by themselves — no button to hold
  const ownFloor = Boolean((fl && fl.seat === me) || (lw && lw.seat === me));
  const held = Boolean((fl && fl.seat !== me) || (lw && lw.seat !== me) || (ptt.on && !ptt.down && !ownFloor && st?.status === "playing") || reading === "update" || (reading === "talk" && !ptt.down && !ownFloor));
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
        <Link href={`/?code=${code}`} className="mt-5 inline-flex min-h-12 items-center rounded-full border-2 border-brass/80 btn-primary px-6 font-[family-name:var(--font-engraved)] font-bold uppercase tracking-[0.1em] text-stock">Join this table</Link>
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
  const streamer = useStreamer();
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
      <p className={`mt-1 text-center ${ENGRAVED} text-[13px] font-semibold tracking-[0.25em] text-brass`}>TABLE {streamer ? "•••••" : code}</p>
      <StreamerToggle />

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
      {/* (designer 2026-10-13) the lobby names the roles in this game — the same cards the deal uses */}
      {row ? (
        <table className="mb-3 w-full text-left text-[13px]" aria-label="Roles in this game">
          <tbody>
            <tr className="border-b border-brass/25">
              <th scope="row" className="w-24 py-1.5 pr-2 align-top font-bold text-[#f3c66b]">{row[0]} villagers</th>
              <td className="py-1.5 text-stock/85">{VILLAGER_ROLES.slice(0, row[0]).join(" · ")}</td>
            </tr>
            <tr>
              <th scope="row" className="w-24 py-1.5 pr-2 align-top font-bold text-crimson-soft">{row[1]} thie{row[1] === 1 ? "f" : "ves"}</th>
              <td className="py-1.5 text-stock/85">{THIEF_ROLES.slice(0, row[1]).join(" · ")}</td>
            </tr>
          </tbody>
        </table>
      ) : <p className="mb-3 text-center text-[13px] text-stock/70">You need at least {MIN_PLAYERS} players</p>}

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
  // (designer 2026-10-12) just whose turn it is — the tray says what you can do
  if (p.startsWith("turn")) return mine ? "Your turn" : `${name(v.turnSeat)}'s turn`;
  if (p.endsWith("_debate")) return `${p.startsWith("final") ? "Last debate" : "Faisla"} — the floor is open`;
  if (p.endsWith("_vote")) return mine ? "Your vote" : `Voting — waiting for ${list}`;
  if (p === "surrender") return mine ? "Surrender your Stone?" : "The Stone holders are deciding…";
  if (p === "batwara") return mine ? "Bhukamp — one card left, one right" : `Bhukamp — waiting for ${list}`;
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
  const stage = useStage(v.events, v.players.map((p) => p.name), s.timers.speed ?? 1);
  const bots = useBotSpeech(messages);
  const [menu, setMenu] = useState(false);
  // NEW INFORMATION (designer 2026-10-13): the newest secret / table event this phone has looked at
  const seenKey = `tunga:seen:${code}:${v.me.seat}`;
  const [news, setNews] = useState<{ secret: number; feed: number }>(() => {
    try { const x = JSON.parse(localStorage.getItem(seenKey) ?? "null"); if (x && typeof x.secret === "number") return x; } catch {}
    const top = v.events.length ? v.events[v.events.length - 1].n : -1;
    return { secret: top, feed: top };
  });
  const markSeen = (k: "secret" | "feed") => setNews((x) => {
    const top = v.events.length ? v.events[v.events.length - 1].n : -1;
    const next = { ...x, [k]: top };
    try { localStorage.setItem(seenKey, JSON.stringify(next)); } catch {}
    return next;
  });
  const newSecrets = secretsOf(v).filter((e) => e.n > news.secret).length;
  const newFeed = v.events.some((e) => e.n > news.feed && e.to === "all" && !["analytics_turn", "pickup", "conduit"].includes(e.type));
  const [history, setHistory] = useState<number | null>(null);
  // (designer 2026-10-14) MESSAGES: tap a player → to them (text or voice note); tap your own seat → to everyone
  const [compose, setCompose] = useState<{ to: number | null; voice: boolean } | null>(null);
  // DEFEND (designer 2026-10-13 evening): an open accusation against you — answer it, or close the panel and stay silent
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
  const feed = useFeed(seenAll, messages, v.ballots, names, caughtUp, onFresh, v.me.seat);
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
  const [tipsSeen, setTipsSeen] = useState<string[]>(() => { try { const x = JSON.parse(localStorage.getItem(TIPS) ?? "[]"); return Array.isArray(x) ? x : []; } catch { return []; } });
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
  const lastTip = useRef<string | null>(null);
  useEffect(() => {
    // the moment the tip was about has passed: don't show it again next time
    if (lastTip.current && lastTip.current !== now_ && ["turn", "debate", "vote"].includes(lastTip.current) && !tipsSeen.includes(lastTip.current)) {
      const id = lastTip.current;
      queueMicrotask(() => seeTips(id));
    }
    lastTip.current = now_;
  });
  const claimAt = (kind: "kundli" | "stone", seat: number, role?: string, has?: boolean, stone?: Card) => {
    seeTips("seats", "bots");
    setCoachSeen((xs) => [...xs, "tell"]);
    api.claim(code, token, { kind, target: seat, ...(role ? { role } : {}), ...(has !== undefined ? { has } : {}), ...(stone ? { stone } : {}) }).catch(() => {});
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
  const speedNow = s.timers.speed ?? 1;
  // nightfall plays only for a round that starts while this phone watches (not on a reload mid-round)
  const [startRound] = useState(v.round);
  useEffect(() => {
    if (!beat) return;
    const SOUND: Partial<Record<string, Sound>> = {
      faisla: "faisla", ballots_open: "drumroll", final_vote: "drumroll", talashi: "flip", talashi_private: "flip", kundli: "mystic", kundli_private: "mystic",
      hera_pheri: "steal", batwara: "quake", dal_badal: "swirl", eliminated: "gong", eliminated_private: "mystic", claim: "claim",
      pass: "whoosh", to_village: "gong", to_thieves: "sting", surrender_open: "drumroll", surrender: "gong",
    };
    if (beat.type === "teer_kaman") play("arrow", beat.result === "hit");
    else if (SOUND[beat.type]) play(SOUND[beat.type]!);
    narrate(beat);
    // THE JUICE (lib/fx.ts): particles, a stamped word, the shake, the hit flash, the burn — the same beat on every phone
    // (designer 2026-10-14: "couldn't see any text effects") they used to fire UNDER a full-screen film — invisible.
    // (2026-10-14, after the research study) no cutaway any more: the moment plays ON the table (TableMoment.tsx) and
    // the word, the shake and the sparks land at its moment of impact
    const strike = IMPACT_MS[beat.type];
    const land = strike ? setTimeout(() => juiceFor(beat), Math.round(strike / speedNow)) : undefined;
    if (!strike) juiceFor(beat);
    const hard = beat.type === "eliminated" || beat.type === "batwara" || (beat.type === "teer_kaman" && beat.result === "hit");
    if (hard) buzz(beat.type === "eliminated" ? [90, 60, 220] : [60, 40, 60]);
    return () => { if (land) clearTimeout(land); };
  }, [beat, names]); // eslint-disable-line react-hooks/exhaustive-deps
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
    <div ref={root} data-juice-root className="flex min-h-0 flex-1 flex-col">
      {/* the films (Cinematic.tsx): a big moment, and nightfall when a new round begins */}
      {/* a new round's intro (round 3 = THE LAST ROUND) — and after it, the mandatory vote's intro with its Stone rules */}
      {v.round > startRound && v.round <= v.rounds && <NightfallOverlay key={`night-${v.round}`} round={v.round} rounds={v.rounds} speed={s.timers.speed ?? 1} />}
      {beat?.type === "final_vote" && <FinalVoteOverlay key={`final-${beat.n}`} speed={s.timers.speed ?? 1} />}
      {ejected && beat && (
        <Eject key={beat.n} name={ejected.name.replace(/\s*🤖$/, "")} initials={initialsOf(names)[ejected.seat]} colour={SEAT_COLOURS[ejected.seat % SEAT_COLOURS.length]}
          thief={beat.tone === "relic"} role={ejected.revealedRole} onDone={stage.skip} speed={s.timers.speed ?? 1} lastWords={Boolean(beat.lastWords)} mine={ejected.seat === v.me.seat}
          onSkipWords={ejected.seat === v.me.seat && token ? () => { void api.endWords(code, token).catch(() => {}); stage.skip(); } : undefined}
          remaining={thievesRemaining(v.rolesInPlay, v.players.filter((p) => !p.alive).map((p) => p.revealedRole))}
          killer={beat.actor !== undefined && beat.actor !== ejected.seat ? (v.players[beat.actor]?.name ?? "").replace(/\s*🤖$/, "") || null : null}
          secret={(() => { const e = [...v.events].reverse().find((x) => x.type === "eliminated_private" && x.data?.seat === ejected.seat); return e ? { role: String(e.data?.role), thief: e.data?.side === "T" } : null; })()} />
      )}
      {/* (designer 2026-10-12) the PLAYMAT: a dark warm table, softly lit in the middle — the printed cards are the only bright
          things. The world's paintings (the cover, the shrine) are kept for home, the final vote and the end. */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-[radial-gradient(70%_45%_at_50%_40%,#4a2a14_0%,#2a160a_45%,#140a04_80%,#0a0502_100%)]" />
      <div aria-hidden className="fixed inset-0 -z-10 opacity-[0.07] bg-[url(/emblem.webp)] bg-[length:62%] bg-[position:50%_38%] bg-no-repeat mix-blend-screen" />

      <header className="flex items-center gap-2 px-3 pt-2">
        <button type="button" onClick={() => setMenu(true)} aria-label={newSecrets ? `Menu — ${newSecrets} new secret${newSecrets > 1 ? "s" : ""}` : "Menu"}
          className={`relative grid h-11 w-11 place-items-center rounded-full ${newSecrets ? "nudge text-card-ink" : "text-stock"}`}>
          {newSecrets > 0 && <span className="nudge-dot absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-black" aria-hidden>{newSecrets}</span>}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        {!solo && <MicButton voice={voice} />}
        <button type="button" onClick={() => { setFeedOpen(true); markSeen("feed"); }} aria-label="What happened so far" className="relative grid h-11 w-11 place-items-center text-brass">
          {newFeed && <span className="nudge-dot absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full" aria-hidden />}
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
        </button>
        <p className="flex-1 text-center font-[family-name:var(--font-engraved)] text-[12px] font-semibold uppercase tracking-[0.18em] text-brass">Round {v.round} of {v.rounds}</p>
        <TimerRing deadline={s.deadline} now={now} size={52} brass />
      </header>
      {s.you.host && typeof s.timers.speedAsk === "number" && (s.timers.speed ?? 1) === 1 && (
        <SpeedAsk code={code} token={token} name={v.players[s.timers.speedAsk]?.name.replace(/\s*🤖$/, "") ?? "A player"} />
      )}

      <Ring v={v} voice={voice} moment={beat && TABLE_MOMENTS.has(beat.type) ? beat : null} speed={s.timers.speed ?? 1} onHistory={setHistory} onMessage={(to, voice) => setCompose({ to, voice })} hint={!v.tutorial && v.me.alive && !tipsSeen.includes("seats")} talking={bots.current?.seat ?? null} floorSeat={s.floor && s.floor.until > now() ? s.floor.seat : null} actor={headline?.actor} target={headline?.target} pick={v.decision?.kind === "vote" ? v.decision.mine ?? null : null} tally={live ?? voteShown?.tally}
        flying={flying} onThrow={s.status === "playing" ? throwAt : undefined}
        away={s.away} marks={marks} onMark={setMark}
        onClaim={s.status === "playing" ? claimAt : undefined}>
        {stage.current?.big
          ? <Stage stage={stage} skip={stage.skip} names={v.players.map((p) => p.name)} inline small={v.players.length > 8} />
          : <Centre v={v} feed={feed} onOpen={() => setFeedOpen(true)} compact={Boolean(myMove && myMove !== "vote" && myMove !== "debate")} living={living.length} extend={extend}
          ready={() => act({ type: "ready" })} />}
      </Ring>
      <StreamerBadge v={v} />
      {!solo && <TalkButton up={Boolean(myMove && myMove !== "debate")} />}
      {/* the coach (a guided first game) or a first-time tip sits INSIDE the tray, so the cards never cover it */}
      <Tray v={v} act={act} live={live} waitForExit={myExitPending} banner={coach
        ? <Coach key={coach.id} text={coach.text} onNext={() => setCoachSeen((xs) => [...xs, coach.id])} onSkip={() => setCoachOff(true)} />
        // (designer 2026-10-13: "remove this — everything has to be nudges") no text tips: the thing to tap glows green
        // (designer 2026-10-14) no Defend panel: the accused answers like anyone — tap the accuser to message them or
        // send a voice note, talk, or tap a role card
        : null} />
      {compose && !compose.voice && <MessageSheet v={v} code={code} token={token} to={compose.to} onClose={() => setCompose(null)}
        onHistory={compose.to === null ? () => { setCompose(null); setHistory(v.me.seat); } : undefined} />}
      {compose?.voice && compose.to !== null && <VoiceNoteSheet v={v} code={code} token={token} to={compose.to} onClose={() => setCompose(null)} />}
      <VoiceNoteInbox throws={throws} names={names} />
      {history !== null && <Sheet title={`${history === v.me.seat ? "Your" : `${v.players[history]?.name.replace(/\s*🤖$/, "")}'s`} history`} onClose={() => setHistory(null)}><SeatHistory v={v} seat={history} /></Sheet>}
      {feedOpen && <Sheet title="Everything at the table" onClose={() => setFeedOpen(false)}><FeedList items={[...feed].reverse()} names={names} me={v.me.seat} /></Sheet>}

      {menu && (
        <Sheet title="Menu" onClose={() => { setMenu(false); markSeen("secret"); }}>
          <RolePeek v={v} />
          <MySecrets v={v} seenBefore={news.secret} />
          {!solo && (
            <div className="flex items-center gap-3">
              <MicButton voice={voice} />
              <p className="flex-1 text-[14px] text-stock/80">Your mic. Tap a player&rsquo;s seat to mute them for you only.</p>
            </div>
          )}
          <SoundMode lines={bots.voice} setLines={bots.setVoice} />
          <MotionSettings />
          <StreamerToggle />
          <SpeedRow code={code} token={token} host={s.you.host} speed={s.timers.speed ?? 1} asked={s.timers.speedAsk === s.you.seat} />
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
          <ReportProblem />
          <div className="flex justify-center gap-5 text-[13px] text-stock/60">
            <Link href="/privacy" className="underline">Privacy</Link>
            <Link href="/" className="underline">Leave this table</Link>
          </div>
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
      <span className="flex flex-col items-center leading-none">🎙️<span className="mt-0.5 text-[9px] font-extrabold uppercase tracking-wide text-stock/85">{p.down ? "Live" : "Hold"}</span></span>
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
function Ring({ v, voice, moment = null, speed = 1, talking, floorSeat = null, actor, target, pick, tally, flying = [], away = [], marks = {}, onMark, onThrow, onPick, onClaim, onHistory, onMessage, hint = false, children }: {
  v: PlayerView; voice: VoiceCtl; moment?: Beat | null; speed?: number; talking: number | null; floorSeat?: number | null; actor?: number; target?: number; pick: number | null; tally?: Record<string, number>;
  flying?: Throw[]; away?: number[]; marks?: Record<number, Mark>; onMark?: (seat: number, m: Mark | null) => void; onThrow?: (seat: number, emoji: string) => void; onPick?: (seat: number) => void;
  onClaim?: (kind: "kundli" | "stone", seat: number, role?: string, has?: boolean, stone?: Card) => void; onHistory?: (seat: number) => void;
  onMessage?: (to: number | null, voice: boolean) => void; hint?: boolean; children: React.ReactNode;
}) {
  const n = v.players.length;
  const voteOpen = v.phase.endsWith("_vote");
  const size: SeatSize = n <= 8 ? "lg" : n <= 16 ? "md" : "sm";
  const [picker, setPickerRaw] = useState<number | null>(null);
  const setPicker = (seat: number | null) => setPickerRaw(seat);
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
  const faces = useMemo(() => seatFaces(v), [v]);
  return (
    <section className="relative mx-2 mt-5 min-h-[440px] flex-1" aria-label="The table">
      {/* depth: the felt sits sunk in its frame; light: the table darker toward its edges, a lantern on whoever acts */}
      <div className="table-depth absolute inset-x-[9%] inset-y-[8%] rounded-[50%] border border-brass/35" aria-hidden />
      <div className="vignette absolute inset-0" aria-hidden />
      {lit !== null && <div className="lantern" style={{ left: `${pos(lit).x}%`, top: `${pos(lit).y}%` }} aria-hidden />}
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
          <div key={p.seat} data-seat={p.seat} {...(me ? { "data-me-seat": "" } : {})} className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${50 + 41 * Math.cos(angle)}%`, top: `${50 + 42 * Math.sin(angle)}%` }}>
            <Seat p={p} me={me} size={size} face={faces[p.seat]} got={tally?.[p.seat]} tag={p.seat === actor ? "played" : p.seat === target ? "target" : undefined}
              spot={!voteOpen && v.waitingOn.includes(p.seat)}
              voted={voteOpen && p.alive && !v.waitingOn.includes(p.seat)}
              picked={pick === p.seat}
              speaking={me ? voice.speaking : Boolean(peer?.speaking && !peer.hushed) || talking === p.seat}
              micOff={me ? !voice.micOn || voice.micBlocked : Boolean(peer?.muted)}
              hushed={Boolean(peer?.hushed)}
              away={away.includes(p.seat)} mark={marks[p.seat]} said={said[p.seat]} hint={hint && !me && p.alive}
              onTap={onPick && p.alive ? () => onPick(p.seat)
                // (designer 2026-10-14) your own seat: a message to everyone (your history is one tap from there)
                : me ? (onMessage ? () => onMessage(null, false) : onHistory ? () => onHistory(p.seat) : undefined)
                : (onThrow || onClaim || peer || onHistory || onMark) ? () => setPicker(picker === p.seat ? null : p.seat) : undefined} />
          </div>
        );
      })}
      {/* tap a seat: throw something at them (everyone sees it fly), or mute them for you */}
      {/* (designer 2026-10-14: "accusing someone for stone and role can be made 100x better") a big sheet from the
          bottom, ONE tap: the real role cards — a thief card accuses, a village card clears — and the Stone, yes or no */}
      {picker !== null && picker !== v.me.seat && v.players[picker] && (
        <AccuseSheet v={v} seat={picker} said={said[picker]} seen={faces[picker]?.seen} mark={marks[picker]}
          onClose={() => setPicker(null)}
          onClaim={onClaim ? (kind, role, has, stone) => { onClaim(kind, picker, role, has, stone); setPicker(null); } : undefined}
          onMessage={onMessage ? (voice) => { onMessage(picker, voice); setPicker(null); } : undefined}
          onMark={onMark ? (m) => { onMark(picker, m); setPicker(null); } : undefined}
          onThrow={onThrow ? (e) => { onThrow(picker, e); setPicker(null); } : undefined}
          hush={peerOf(picker) ? { hushed: peerOf(picker)!.hushed, toggle: () => { voice.hush(picker); setPicker(null); } } : undefined}
          onHistory={onHistory ? () => { onHistory(picker); setPicker(null); } : undefined} />
      )}
      <CardFlights v={v} pos={pos} />
      {moment && <TableMoment key={moment.n} beat={moment} pos={pos} speed={speed} />}
      {flying.map((t) => {
        const f = pos(t.from), to = pos(t.to);
        return <span key={t.id} aria-hidden className="throw z-40 text-[34px]"
          style={{ ["--fx" as string]: `${f.x}%`, ["--fy" as string]: `${f.y}%`, ["--tx" as string]: `${to.x}%`, ["--ty" as string]: `${to.y}%` }}>{t.emoji}</span>;
      })}
      <div className="absolute left-1/2 top-1/2 max-h-[56%] w-[54%] max-w-[230px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl [scrollbar-width:none]">{children}</div>
    </section>
  );
}

type SeatSize = "lg" | "md" | "sm";
const SEAT: Record<SeatSize, { disc: string; tag: string; w: string }> = {
  lg: { disc: "h-[78px] w-[56px]", tag: "px-2.5 py-0.5 text-[13px] max-w-[96px]", w: "w-[96px]" },
  md: { disc: "h-[64px] w-[46px]", tag: "px-2 py-px text-[11px] max-w-[80px]", w: "w-[80px]" },
  sm: { disc: "h-[50px] w-[36px]", tag: "px-1.5 py-px text-[10px] max-w-[64px]", w: "w-[64px]" },
};

/** CARD MOTION (designer 2026-10-13): every time cards change hands the table SEES them travel, face down — a pass of
 *  3 to the next player, a pair played (its 3 go on), a Hera Pheri steal, a Bhukamp (every hand one seat back), the
 *  cards of a player put out. Only new events fly (never history on reload). */
type Flight = { id: string; from: number; to: number; delay: number; r0: number; r1: number };
function CardFlights({ v, pos }: { v: PlayerView; pos: (seat: number) => { x: number; y: number } }) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const last = useRef<number | null>(null);
  const top = v.events.length ? v.events[v.events.length - 1].n : -1;
  useEffect(() => {
    if (last.current === null) { last.current = top; return; }
    const fresh = v.events.filter((e) => e.n > last.current!);
    last.current = top;
    if (!fresh.length) return;
    const n = v.players.length;
    const nextLiving = (x: number, dir: 1 | -1) => { for (let k = 1; k < n; k++) { const y = (x + dir * k + n * n) % n; if (v.players[y].alive) return y; } return x; };
    const add: Flight[] = [];
    const fly = (from: number, to: number, count: number, at = 0) => {
      for (let i = 0; i < count; i++) add.push({ id: `${top}-${add.length}`, from, to, delay: at + i * 90, r0: -14 + Math.random() * 28, r1: -8 + Math.random() * 16 });
    };
    for (const e of fresh) {
      const d = e.data ?? {};
      const seat = typeof d.seat === "number" ? d.seat : null, target = typeof d.target === "number" ? d.target : null;
      if ((e.type === "pass" || e.type === "play") && seat !== null) fly(seat, nextLiving(seat, 1), 3);
      if (e.type === "hera_pheri" && seat !== null && target !== null) fly(target, seat, typeof d.k === "number" ? d.k : 2, 250);
      // Bhukamp: every living hand sends 1 card LEFT (the next player) and 1 RIGHT (the one before) — when the passes
      // really happen (batwara_done), not when the pair is played (designer 2026-10-13 evening: "it suddenly vanishes and
      // new cards appear"). Left first, then right, so the eye can follow each.
      if (e.type === "batwara_done") for (const p of v.players) if (p.alive) { fly(p.seat, nextLiving(p.seat, 1), 1, 0); fly(p.seat, nextLiving(p.seat, -1), 1, 700); }
      if (e.type === "handoff" && seat !== null && target !== null) fly(seat, target, typeof d.count === "number" ? Math.min(3, d.count) : 2, 200);
    }
    if (!add.length) return;
    const ids = new Set(add.map((x) => x.id));
    const go = setTimeout(() => setFlights((f) => [...f, ...add]), 0);
    const done = setTimeout(() => setFlights((f) => f.filter((x) => !ids.has(x.id))), 2400);
    return () => { clearTimeout(go); clearTimeout(done); };
  }, [top]); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{flights.map((f) => {
    const a = pos(f.from), b = pos(f.to);
    return <span key={f.id} aria-hidden className="card-fly z-30" style={{ animationDelay: `${f.delay}ms`, ["--fx" as string]: `${a.x}%`, ["--fy" as string]: `${a.y}%`,
      ["--tx" as string]: `${b.x}%`, ["--ty" as string]: `${b.y}%`, ["--r0" as string]: `${f.r0}deg`, ["--r1" as string]: `${f.r1}deg` }} />;
  })}</>;
}

/** what a seat's card shows on this phone (designer 2026-10-12) */
interface SeatFace { kind: "back" | "mine" | "known" | "rumour"; art: string; role?: string; /** a role you SAW (Kundli, or putting them out) — shown again when you tap the seat */ seen?: string }
function seatFaces(v: PlayerView): Record<number, SeatFace> {
  // (designer 2026-10-13, later the same day: "after Kundli, the role should be visible to the Kundli player") a role you
  // SAW with Kundli — either way, Mutual Kundli — stays face up on that seat for the rest of the game, on your phone
  // only, until a Dal Badal shuffles it. (A player you put out shows the plain back; tapping says what you saw.)
  const seen = new Map<number, { role: string; n: number }>();
  for (const e of v.events) {
    const mine = Array.isArray(e.to) && e.to.includes(v.me.seat);
    if (mine && e.type === "kundli_private") seen.set(e.data?.target as number, { role: String(e.data?.role), n: e.n });
    if (mine && e.type === "eliminated_private") seen.set(e.data?.seat as number, { role: String(e.data?.role), n: e.n });
    if (e.type === "dal_badal") for (const x of (e.data?.seats as number[]) ?? []) seen.delete(x);
  }
  const known = new Map<number, string>();
  for (const [x, k] of seen) known.set(x, k.role);
  const out: Record<number, SeatFace> = {};
  for (const p of v.players) {
    const saw = seen.get(p.seat)?.role;
    // (designer 2026-10-13: "the player voted out is still visible although you covered it") an out seat is the plain
    // card back under its cover — no role you saw, no "I was …" rumour showing through. Tap still says what you saw.
    if (!p.alive && p.seat !== v.me.seat) { out[p.seat] = { kind: "back", art: CARD_BACK, seen: saw }; continue; }
    const role = p.seat === v.me.seat ? v.me.role : known.get(p.seat);
    const art = roleArt(role);
    if (p.seat === v.me.seat && art) out[p.seat] = { kind: "mine", art, role };
    else if (role && art) out[p.seat] = { kind: "known", art, role, seen: saw };
    // (designer 2026-10-14) a role someone CLAIMED no longer turns the seat into that card — a Kundli claim and a plain
    // accusation weigh the same, one 🫵 on the seat each
    else out[p.seat] = { kind: "back", art: CARD_BACK, seen: saw };
  }
  return out;
}

function Seat({ p, me, size, face, got, tag, spot, voted, picked, speaking, micOff, hushed, away = false, mark, said, hint = false, onTap }: {
  p: PublicPlayer; me: boolean; size: SeatSize; face: SeatFace; got?: number; tag?: "played" | "target"; spot: boolean; voted: boolean; picked: boolean;
  speaking: boolean; micOff: boolean; hushed: boolean; away?: boolean; mark?: Mark; said?: SaidAbout; hint?: boolean; onTap?: () => void;
}) {
  const z = SEAT[size];
  const label = `${p.name}${me ? " (you)" : ""}${got ? `, got ${got} vote${got === 1 ? "" : "s"}` : ""}: ${p.handSize} cards, ${p.votes} vote${p.votes === 1 ? "" : "s"}${p.alive ? "" : p.revealedRole ? `, out — was ${p.revealedRole}` : ", out"}${spot ? ", their move" : ""}${speaking ? ", talking" : ""}${voted ? ", has voted" : ""}${away ? ", away" : ""}${mark ? `, you marked ${MARK[mark].label}` : ""}${said?.accuse ? `, called a thief ${said.accuse} times` : ""}${said?.trust ? `, called a villager ${said.trust} times` : ""}${said?.role ? `, read as ${said.role}` : ""}${said?.stone !== undefined ? (said.stone === "STONE_1" ? ", said to hold the Bhadra Stone" : said.stone === "STONE_2" ? ", said to hold the Tunga Stone" : said.stone ? ", said to hold a Stone" : ", said to hold no Stone") : ""}`;
  const saidChip = said && (said.accuse || said.trust || (p.alive && said.stone !== undefined)) ? (
    <span className={`flex max-w-full items-center gap-1 truncate rounded-full bg-black/50 px-1.5 text-[11px] leading-[16px] text-stock ${me ? "mb-0.5" : "mt-0.5"}`} aria-hidden>
      {said.accuse ? <span className="text-crimson-soft">🫵{said.accuse}</span> : null}
      {said.trust ? <span className="text-jade-soft">🌾{said.trust}</span> : null}
      {p.alive && said.stone !== undefined ? <span className="text-[#f3c66b]">{stoneChip(said.stone)}</span> : null}
    </span>
  ) : null;
  return (
    <div className={`relative flex flex-col items-center text-center ${z.w} ${p.alive ? "" : "opacity-45 grayscale"} ${spot ? "turn-bounce" : ""}`}>
      {/* the play in the centre panel, on the ring: who played it, and at whom (12-player playtest: "who did what to whom") */}
      {tag && <span className={`absolute -top-3.5 z-20 rounded-full px-1.5 text-[9px] font-black uppercase tracking-wide ${tag === "played" ? "bg-[#f0a32e] text-card-ink" : "bg-crimson text-ink"}`}>{tag}</span>}
      {me && saidChip}
      {/* (designer 2026-10-12) every seat is a card on the table, as at a real game night: the printed card back — or, on
          this phone only, the character you KNOW (your own, a Kundli read, a player you put out) in full colour, or the one
          the table CLAIMS for them, faded, with a "?" (a rumour, maybe a lie) */}
      <button type="button" disabled={!onTap} onClick={onTap} aria-label={label} aria-pressed={onTap ? picked : undefined}
        className={`relative select-none rounded-[6px] ${z.disc}
          ${me ? "outline-2 outline-offset-2 outline-[#f3c66b]" : ""} ${spot ? "outline-[3px] outline-offset-[3px] outline-[#f0a32e] shadow-[0_0_20px_5px_rgba(240,163,46,.55)]" : "shadow-[0_6px_14px_-4px_rgba(0,0,0,.85)]"}
          ${speaking ? "speaking" : ""} ${hint && !spot ? "nudge-ring" : ""} ${picked ? "ring-4 ring-[#f08a1c]" : ""} ${tag === "target" ? "ring-[3px] ring-crimson" : ""}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={face.art} src={face.art} alt="" draggable={false}
          // (designer 2026-10-13: "the card back is too jarring") a face-down card sits quiet in the shadows — dimmed and
          // warmed — and lights up only on that player's turn, so "whose turn" reads at a glance
          className={`flip-in h-full w-full rounded-[6px] object-cover transition-[filter] duration-300 ${face.kind === "rumour" ? "opacity-70 sepia" : ""} ${spot && p.alive ? "sprite-outline" : tag === "target" ? "sprite-outline-red" : ""}
            ${!p.alive ? "grayscale brightness-[.45]" : (face.kind === "back" || face.kind === "rumour") && !spot ? "brightness-[.55] saturate-[.6] sepia-[.35]" : ""}`} />
        {face.kind === "rumour" && <span className="absolute left-1/2 top-1/2 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/70 text-[12px] font-black text-[#f3c66b]" aria-hidden>?</span>}
        {!p.alive && <span className="absolute inset-0 grid place-items-center rounded-[6px] bg-black/70 text-[22px] font-black text-stock/90" aria-hidden>✕</span>}
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
      {/* what the table has said ABOUT them — kept on the seat once the feed has scrolled on (Town of Salem's notepad,
          BGA's player panels). Your own seat sits on the tray's edge, so yours shows above your circle (2026-10-12) */}
      {!me && saidChip}
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

const TAGLESS = new Set(["pass", "away", "back", "floor_extended", "timeout", "gift", "dal_badal_done", "whisper", "whisper_private"]);

/** THE CENTRE (designer 2026-10-09, option A — "every little thing must be displayed at the center"): a status line,
 *  then the running feed — newest at the bottom and biggest, older lines smaller and fainter — then the debate's
 *  controls. Tap the feed for everything that was said and done. */
function Centre({ v, feed, onOpen, living, extend, ready }: {
  v: PlayerView; feed: FeedItem[]; onOpen: () => void; compact: boolean; living: number;
  extend?: () => void; ready: () => void;
}) {
  const d = v.decision;
  const voteOpen = v.phase.endsWith("_vote");
  const debate = v.phase.endsWith("_debate");
  const btn = "min-h-11 rounded-full border-2 border-brass/70 px-3 font-[family-name:var(--font-engraved)] text-[13px] font-bold uppercase tracking-wide";
  const names = v.players.map((p) => p.name);
  // (designer 2026-10-14) THE CENTRE IS THE CHAT: updates and messages together, newest at the bottom; updates big and
  // highlighted, messages normal. It fits inside the ring of seats and scrolls back; 🕘 keeps everything.
  const lines = feed.filter((it) => it.kind !== "vote" || voteOpen).slice(-14);
  const list = useRef<HTMLUListElement>(null);
  const newest = lines.at(-1)?.id;
  useEffect(() => { const el = list.current; if (el) el.scrollTop = el.scrollHeight; }, [lines.length, newest]);
  return (
    <div className="relative rounded-2xl border border-brass/70 bg-[#1a0e06]/90 px-2.5 pb-2.5 pt-3 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,.8)]">
      <Ornament className="absolute -top-2 left-1/2 -translate-x-1/2" />
      <Ornament className="absolute -bottom-2 left-1/2 -translate-x-1/2" />

      <p className={`text-[12px] font-semibold leading-snug ${debate || voteOpen ? "text-[#f3c66b]" : d ? "text-jade-soft" : "text-stock/70"}`}>
        {debate ? `${v.phase.startsWith("final") ? "Last debate" : "Faisla"} — accuse, defend, claim`
          : voteOpen ? `Vote · ${living - v.waitingOn.length} of ${living} voted`
          : status(v)}
      </p>

      <div className="mt-1.5 w-full text-left" aria-live="polite">
        {lines.length === 0
          ? <button type="button" onClick={onOpen} className="block w-full py-2 text-center font-display text-[15px] text-stock/80">The cards are dealt.</button>
          : <ul ref={list} onClick={onOpen} aria-label="The table — tap for everything"
              className="flex max-h-[min(34dvh,236px)] flex-col gap-1 overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent_0,#000_18px)]">
              {lines.map((it, i) => <FeedLine key={it.id} it={it} names={names} me={v.me.seat} rank={lines.length - 1 - i} />)}
            </ul>}
      </div>

      {debate && d?.kind === "debate" && (
        <div className="mt-2 flex flex-col items-center gap-1.5">
          <p className="text-[12px] text-stock/60">{d.ready.length} of {living} ready</p>
          <button type="button" onClick={ready} className={`${btn} nudge w-full btn-primary text-stock`}>Ready to vote</button>
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
  // (designer 2026-10-14) updates big and highlighted, messages normal; older lines fade a little
  const update = it.kind === "event";
  const size = full ? "text-[15px]" : update ? "text-[14px] font-extrabold" : "text-[12.5px]";
  const fade = full || rank <= 3 ? "" : rank <= 6 ? "opacity-80" : "opacity-60";
  const who = (seat?: number) => seat === undefined ? null
    : <b style={{ color: SEAT_COLOURS[seat % SEAT_COLOURS.length] }}>{seat === me ? "You" : names[seat]?.replace(/\s*🤖$/, "")}</b>;
  let body: React.ReactNode;
  if (it.kind === "chat") body = <>{who(it.seat)}: {it.text}</>;
  else if (it.kind === "private") {
    const toMe = it.target === me;
    body = it.mine && it.privateText !== null
      ? <span className="text-jade-soft">{it.audio ? "🎙 " : "🤫 "}{toMe ? <>{who(it.seat)} (to you)</> : <>You → {who(it.target)}</>}{it.audio ? <> <VoiceNotePlay src={it.audio} /></> : <>: {it.privateText}</>}</span>
      : <span className="italic text-stock/55">🤫 {it.text}</span>;
  }
  else if (it.kind === "talk" || it.kind === "caption") body = <>{KIND_ICON[it.kind] ? `${KIND_ICON[it.kind]} ` : ""}{who(it.seat)}: <span className="italic">&ldquo;{it.text}&rdquo;</span></>;
  else if (it.kind === "claim") body = <span className={TONE_TEXT[it.tone]}>{it.tone === "lethal" ? "🫵" : it.tone === "gold" ? "💎" : "🌾"} {it.text}</span>;
  else body = <span className={it.mine ? "text-jade-soft" : it.kind === "event" ? TONE_TEXT[it.tone] : "text-stock/90"}>
    {it.mine ? "🔒 Only you: " : KIND_ICON[it.kind] ? `${KIND_ICON[it.kind]} ` : ""}{it.text}
    {it.detail && full && <span className="mt-0.5 block text-[12px] font-normal text-stock/70">{it.detail}</span>}
  </span>;
  // in the centre a line is two rows at most — the whole of it is one tap away
  if (update && !full) {
    const box = it.mine ? "border-jade/60 bg-jade/10" : it.tone === "lethal" ? "border-crimson/70 bg-crimson/15 shadow-[0_0_14px_rgba(192,57,43,.3)]" : "border-[#f0a32e]/60 bg-[#f0a32e]/10 shadow-[0_0_14px_rgba(240,163,46,.22)]";
    return <li className={`stage-in rounded-lg border px-2 py-1 text-center leading-tight ${box} ${size} ${fade} line-clamp-2`}>{body}</li>;
  }
  return <li className={`stage-in leading-snug text-stock ${size} ${fade} ${full ? "" : "line-clamp-2"}`}>{body}</li>;
}

/** ▶ a voice note sent to you (or by you): plays on this phone only */
function VoiceNotePlay({ src }: { src: string }) {
  const [on, setOn] = useState(false);
  return (
    <button type="button" aria-label="Play the voice note" onClick={(e) => { e.stopPropagation(); const a = new Audio(src); setOn(true); a.onended = () => setOn(false); a.play().catch(() => setOn(false)); }}
      className="inline-flex min-h-8 items-center rounded-full bg-jade/20 px-2 font-bold text-jade-soft ring-1 ring-jade/60">{on ? "🔊" : "▶"} voice note</button>
  );
}

/** a voice note that just arrived for you: "Only you hear this — ▶ Listen" (typed private lines just appear in the centre) */
function VoiceNoteInbox({ throws, names }: { throws: ThrowQueue; names: string[] }) {
  const inbox = useSyncExternalStore(throws.subscribe, throws.getInbox, throws.getInbox);
  const note = inbox.find((w) => w.body?.kind === "v");
  useEffect(() => { for (const w of inbox) if (w.body?.kind !== "v") throws.dismiss(w.id); }, [inbox, throws]);
  if (!note) return null;
  return <WhisperBubble w={note} names={names} onDone={() => throws.dismiss(note.id)} up />;
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
  const exitFirst = waitForExit && (d?.kind === "gift" || d?.kind === "handoff" || d?.kind === "dal_badal_out");
  if (d?.kind === "vote") return <>{banner && <div className="relative z-20">{banner}</div>}<Ballot v={v} mine={d.mine} live={live ?? {}} act={act} /></>;
  const inTray = d && d.kind !== "debate";
  return (
    <section className="sticky bottom-0 z-20 flex flex-col gap-2 rounded-t-3xl border-t border-brass/30 bg-ember px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-14px_30px_-6px_rgba(0,0,0,.75)]">
      {banner && <div className="-mx-3">{banner}</div>}
      {/* (2026-10-12) on your move the top line already says "Your turn" — the heading makes way so the cards and the
          buttons sit higher on a small phone */}
      {!v.me.alive && (
        <h2 className="text-center font-display text-[22px] font-bold leading-tight text-stock">You&rsquo;re out</h2>
      )}
      {!v.me.alive && <p className="text-center text-[13px] text-stock/70">You&rsquo;re out — but still in the game. Talk, accuse, bluff, help your team. You see no secrets.</p>}
      {exitFirst ? <p className="py-3 text-center font-display text-[16px] text-stock/80">Your last decision comes next…</p>
        : inTray ? <Decide key={v.phase} v={v} act={act} />
        : v.me.alive && <>
          <HandRow cards={v.me.hand} />
          {/* (2026-10-12) the mandatory debate: a thief holding Dal Badal may use it here */}
          {d?.kind === "debate" && d.dalBadal && <Decide key={v.phase} v={v} act={act} />}
        </>}
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
  useEffect(() => { play(won ? "fanfare" : "sting"); void playSting(won); buzz(won ? [60, 40, 60, 40, 160] : 200); }, [won]);
  // the end (juice): marigold petals fall on a village win; smoke rises when the thieves take a Stone
  useEffect(() => { const t = setTimeout(() => (v.winner === "V" ? fx.petals() : fx.smoke()), 900); return () => clearTimeout(t); }, [v.winner]);
  // where each Stone ended: in a living player's hand, or with the village (the cards left on the table at the end,
  // and the cards of anyone the mandatory vote put out)
  const stoneAt = (c: Card) => {
    // (2026-10-12) a villager voted out in the mandatory vote: their Stones went to the thieves
    if (v.events.some((e) => e.type === "to_thieves" && ((e.data?.cards as Card[]) ?? []).includes(c))) return { who: "The thieves", side: "T" as Side, role: null };
    const r = reveal.find((x) => x.hand.includes(c) && v.players[x.seat].alive);
    return r ? { who: name(r.seat), side: r.side as Side, role: r.role } : { who: "The village", side: "V" as Side, role: null };
  };
  // WHY (2026-10-09 — Among Us players ask the end screen for the reason, not just the result): Thieves win only if a
  // living thief holds a Stone
  const STONES: Card[] = ["STONE_1", "STONE_2"];
  const held = STONES.map((c) => ({ c, ...stoneAt(c) }));
  const plainName = (w: string) => w.replace(/\s*🤖$/, "");
  const swaps = dalBadalHistory(v);
  /** "Chirag was Police (Tunga) until Circuit's Dal Badal made them Lootera" — the last swap that changed this seat's side */
  const turned = (who: string) => {
    const seat = v.players.findIndex((p) => p.name === who);
    for (const d of [...swaps].reverse()) {
      const w = d.swaps.find((x) => x.seat === seat && x.from.side !== x.to.side);
      if (w) return `${plainName(who)} was ${w.from.role} (${w.from.side === "V" ? "Tunga" : "Thief"}) until ${plainName(name(d.actor))}'s Dal Badal made them ${w.to.role}`;
    }
    return "";
  };
  const why = !village
    ? held.filter((h) => h.side === "T").map((h) => { const t = turned(h.who); return `${plainName(h.who)}${h.role ? ` (${h.role})` : ""} kept the ${STONE_NAME[h.c]}${t ? `. ${t}` : ""}`; }).join(" · ")
    : held.every((h) => h.role === null) ? "Both Stones ended with the village." : `No thief kept a Stone.${held.map((h) => turned(h.who)).filter(Boolean).map((t) => ` ${t}.`).join("")}`;
  const firstRole = (seat: number) => {
    const r = v.events.find((e) => e.type === "role" && !e.data?.swapped && Array.isArray(e.to) && e.to[0] === seat);
    return r ? String(r.data?.role) : null;
  };
  const n = reveal.length;
  const size: SeatSize = n <= 7 ? "lg" : n <= 9 ? "md" : "sm";
  // the mandatory vote decided the game: everyone sees how many votes each player got
  const finalTally = (v.events.filter((e) => e.type === "vote_result" && e.data?.reason === "final").at(-1)?.data?.tally ?? {}) as Record<string, number>;
  const ini = initialsOf(v.players.map((p) => p.name));
  const btn = "min-h-12 rounded-full border-2 border-brass/70 font-[family-name:var(--font-engraved)] text-[14px] font-bold uppercase tracking-[0.1em]";

  return (
    <section className="flex min-h-dvh flex-col px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
      {/* the shrine at sunset behind it all; the Stones land on its steps — or vanish (Cinematic.tsx) */}
      <FinaleBackdrop village={village} />

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
      <div className="relative mx-1 mb-12 mt-16 min-h-[420px] flex-1" role="list" aria-label="Everyone's role">
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
              style={{ left: `${50 + 41 * Math.cos(angle)}%`, top: `${50 + 40 * Math.sin(angle)}%`, animationDelay: `${300 + k * 160}ms` }}
              aria-label={`${p.name}${me ? " (you)" : ""}: ${r.role}, ${thief ? "thief" : "Tunga"}${p.alive ? "" : ", out"}`}>
              {/* wind sway (juice): every card on the ring swings gently, each in its own time */}
              <div className="sway flex flex-col items-center" style={{ ["--sway-t" as string]: `${3 + (k % 4) * 0.35}s`, ["--sway-d" as string]: `${-(k * 0.7)}s` }}>
              {Boolean(finalTally[r.seat]) && <span className="absolute left-0 top-0 z-20 grid h-6 min-w-6 place-items-center rounded-full bg-crimson px-1 text-[12px] font-black text-ink ring-2 ring-ember" aria-label={`${finalTally[r.seat]} votes`}>{finalTally[r.seat]}</span>}
              <span className={`relative grid place-items-center rounded-full font-medium text-card-ink ${z.disc} ${me ? "outline-[3px] outline-offset-2 outline-jade" : ""} ${p.alive ? "" : "opacity-50 grayscale"}`}
                style={{ background: SEAT_COLOURS[r.seat % SEAT_COLOURS.length], boxShadow: `0 0 0 3px ${thief ? "#c0392b" : "#e0a24a"}` }}>
                {ini[r.seat]}
              </span>
              <span className={`relative z-10 -mt-1 truncate rounded-full border bg-ember font-medium ${z.tag} ${me ? "border-2 border-jade text-jade-soft" : "border-brass/60 text-stock"}`}>{p.name}</span>
              <span className={`mt-0.5 truncate rounded px-1.5 font-[family-name:var(--font-engraved)] text-[10px] font-bold uppercase tracking-wide ${thief ? "bg-crimson-deep text-ink" : "bg-[#3a240c] text-[#f3c66b]"}`}>{r.role}</span>
              {firstRole(r.seat) && firstRole(r.seat) !== r.role && <span className="truncate text-[10px] text-stock/70">was {firstRole(r.seat)}</span>}
              </div>
            </div>
          );
        })}

        {/* the middle: where the two Stones ended */}
        <div className={`absolute left-1/2 top-1/2 ${n > 9 ? "w-[44%]" : "w-[54%]"} max-w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-brass/70 bg-[#1a0e06]/90 px-3 pb-3 pt-4 text-center`}>
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

      <StonePaths v={v} reveal={reveal} />

      {/* every Dal Badal: who shuffled with whom, each role before → after */}
      {swaps.some((d) => d.swaps.length) && (
        <div className="mt-3 rounded-2xl border border-brass/40 bg-black/30 p-3">
          <p className="mb-2 text-center font-[family-name:var(--font-engraved)] text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">Dal Badal</p>
          {swaps.filter((d) => d.swaps.length).map((d) => (
            <div key={d.n} className="mb-2 last:mb-0">
              <p className="text-[13px] text-stock/80">{plainName(name(d.actor))} shuffled roles with {d.swaps.filter((x) => x.seat !== d.actor).map((x) => plainName(name(x.seat))).join(" and ")}</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {d.swaps.map((x) => (
                  <li key={x.seat} className="flex items-center gap-1.5 text-[13px]">
                    <span className="min-w-0 flex-1 truncate font-display text-stock">{plainName(name(x.seat))}</span>
                    {x.from.role === x.to.role ? (
                      <span className={x.to.side === "T" ? "text-crimson-soft" : "text-[#f3c66b]"}>kept {x.to.role}</span>
                    ) : (<>
                      <span className={x.from.side === "T" ? "text-crimson-soft" : "text-[#f3c66b]"}>{x.from.role}</span>
                      <span className="text-stock/50">→</span>
                      <span className={`font-bold ${x.to.side === "T" ? "text-crimson-soft" : "text-[#f3c66b]"}`}>{x.to.role}</span>
                    </>)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

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
            className={`nudge ${btn} btn-primary text-stock disabled:opacity-60`}>
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


/** ROLE HISTORY (designer 2026-10-14: "the end must mention the original role as well as the new one, and explain how
 *  the thieves won because a role was X and then changed to Y"). At the end every secret is open: each seat's deal and
 *  every Dal Badal it was part of. */
interface DalBadalSwap { actor: number; n: number; swaps: { seat: number; from: { role: string; side: Side }; to: { role: string; side: Side } }[] }
function dalBadalHistory(v: PlayerView): DalBadalSwap[] {
  const roleAt = (seat: number, before: number) => {
    const r = v.events.findLast((e) => e.type === "role" && e.n < before && Array.isArray(e.to) && e.to[0] === seat);
    return r ? { role: String(r.data?.role), side: r.data?.side as Side } : null;
  };
  return v.events.filter((e) => e.type === "dal_badal").map((e) => {
    const seats = (e.data?.seats as number[]) ?? [];
    const done = v.events.find((x) => x.n > e.n && x.type === "dal_badal_done")?.n ?? Infinity;
    const swaps = seats.flatMap((seat) => {
      const from = roleAt(seat, e.n);
      const after = v.events.find((x) => x.type === "role" && x.n > e.n && x.n < done && x.data?.swapped && Array.isArray(x.to) && x.to[0] === seat);
      return from && after ? [{ seat, from, to: { role: String(after.data?.role), side: after.data?.side as Side } }] : [];
    });
    return { actor: e.data?.seat as number, n: e.n, swaps };
  });
}

/** SEAT HISTORY (designer 2026-10-12, research: ProAvalon's row per seat): everything that involved one player —
 *  what they played and at whom, what was played on them, what was said about them and by them, how they voted —
 *  grouped by round. Only what this phone saw (your own secrets included). */
const HISTORY_SKIP = new Set(["analytics_deal", "analytics_turn", "role", "setup", "pickup", "pickup_private", "conduit", "batwara_done", "reshuffle", "ballots_open", "reveal", "over", "timeout", "away", "back", "floor", "floor_extended"]);
function SeatHistory({ v, seat }: { v: PlayerView; seat: number }) {
  const nm = (x: number) => (v.players[x]?.name ?? "?").replace(/\s*🤖$/, "");
  const clean = (m: string) => m.replace(/\s*🤖/g, "");
  const groups: { title: string; lines: string[] }[] = [];
  let title = "Round 1";
  const push = (line: string) => {
    if (groups.at(-1)?.title !== title) groups.push({ title, lines: [] });
    const g = groups[groups.length - 1];
    if (g.lines.at(-1) !== line) g.lines.push(line);
  };
  for (const e of v.events) {
    const d = e.data ?? {};
    if (e.type === "pickup" && typeof d.round === "number") { title = `Round ${d.round}`; continue; }
    if (e.type === "final_vote") { title = "Mandatory vote"; continue; }
    if (HISTORY_SKIP.has(e.type)) continue;
    if (e.type === "vote_result") {
      const ballots = (d.ballots ?? {}) as Record<string, number | null>;
      const got = Object.entries(ballots).filter(([, t]) => t === seat).map(([x]) => nm(Number(x)));
      const mine = ballots[String(seat)];
      if (String(seat) in ballots) push(mine === null || mine === undefined ? "Voted for nobody" : `Voted for ${nm(mine)}`);
      if (got.length) push(`Votes against: ${got.join(", ")}`);
      continue;
    }
    if (e.type === "batwara_private" && !(d.from === seat || d.to === seat)) continue;
    const about = d.seat === seat || d.target === seat || (e.type === "batwara_private");
    if (about) push(clean(e.msg));
  }
  if (!groups.length) return <p className="text-center text-[14px] text-stock/70">Nothing yet.</p>;
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g, i) => (
        <section key={i}>
          <p className="font-[family-name:var(--font-engraved)] text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">{g.title}</p>
          <ul className="mt-1 flex flex-col gap-1">{g.lines.map((l, k) => <li key={k} className="text-[14px] leading-snug text-stock">{l}</li>)}</ul>
        </section>
      ))}
    </div>
  );
}

/** MY SECRETS (designer 2026-10-12, research: Pocket Grimoire's "a card you keep"): every private thing this phone
 *  learned, newest first — Kundli reads (both ways), Talashi searches, a role seen when you put someone out, what
 *  Hera Pheri and Bhukamp moved, a Stone you picked up, a new role from Dal Badal. */
const SECRET_TYPES = new Set(["kundli_private", "talashi_private", "eliminated_private", "hera_pheri_private", "batwara_private", "whisper_private", "handoff_private", "kept_private"]);
/** every private thing this phone has learned, newest first (designer 2026-10-13: "info received" must show) */
function secretsOf(v: PlayerView): GameEvent[] {
  const me = v.me.seat;
  const isStone = (c: unknown) => c === "STONE_1" || c === "STONE_2";
  return v.events.filter((e) => Array.isArray(e.to) && e.to.includes(me) && (
    SECRET_TYPES.has(e.type)
    || (e.type === "pickup_private" && ((e.data?.cards as unknown[]) ?? []).some(isStone))
    || (e.type === "role" && e.data?.swapped)
  )).filter((e) => e.type !== "batwara_private" || e.data?.from === me || e.data?.to === me).reverse();
}
function MySecrets({ v, seenBefore = Infinity }: { v: PlayerView; seenBefore?: number }) {
  const items = secretsOf(v);
  return (
    <details open={items.some((e) => e.n > seenBefore)} className="group rounded-2xl border border-brass/30 px-4 py-1 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[14px] font-semibold text-stock/80">
        🔒 My secrets{items.length ? ` (${items.length})` : ""}{items.some((e) => e.n > seenBefore) ? " · NEW" : ""}<span aria-hidden className="transition group-open:rotate-90">›</span>
      </summary>
      {items.length
        ? <ul className="flex flex-col gap-1.5 pb-2">{items.map((e) => (
            <li key={e.n} className="text-[14px] leading-snug text-stock">
              {e.n > seenBefore && <span className="nudge-dot mr-1.5 inline-block rounded-full px-1.5 text-[10px] font-black">NEW</span>}
              {e.msg.replace(/\s*🤖/g, "")}
            </li>
          ))}</ul>
        : <p className="pb-2 text-[13px] text-stock/60">Nothing yet — your Kundli reads and searches will show here.</p>}
    </details>
  );
}

/** THE STONES' PATH (designer 2026-10-12): each Stone from the deal to where it ended, every hand it passed through
 *  (a name in thief red or village gold), how it got there, and 👁 where someone saw it with Talashi. */
const HOW: Record<string, string> = { dealt: "dealt", pile: "pile", bhukamp: "Bhukamp", hera_pheri: "stolen", handoff: "handed" };
function StonePaths({ v, reveal }: { v: PlayerView; reveal: { seat: number; side: string }[] }) {
  const paths = [...v.events].reverse().find((e) => e.type === "over")?.data?.stonePaths as Record<string, StoneStep[]> | undefined;
  if (!paths) return null;
  const sideOf = (seat: number) => reveal.find((r) => r.seat === seat)?.side;
  const nm = (seat: number) => (v.players[seat]?.name ?? "?").replace(/\s*🤖$/, "");
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-brass/40 bg-black/30 p-3" aria-label="How the Stones moved">
      <p className="text-center font-[family-name:var(--font-engraved)] text-[11px] font-semibold uppercase tracking-[0.2em] text-brass">How the Stones moved</p>
      {(["STONE_2", "STONE_1"] as const).map((c) => (
        <div key={c} className="flex flex-col gap-1.5">
          <p className="flex items-center gap-2 font-display text-[14px] font-bold text-stock"><CardIcon c={c} className="w-6 shrink-0" />{STONE_NAME[c]}</p>
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
            {(paths[c] ?? []).map((st, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden className="text-stock/40">›</span>}
                {st.kind === "holder" ? (
                  <span className="flex flex-col items-center leading-none">
                    <span className={`rounded-full px-2 py-0.5 text-[13px] font-bold ${sideOf(st.seat) === "T" ? "bg-crimson-deep text-ink" : "bg-[#3a240c] text-[#f3c66b]"}`}>{nm(st.seat)}</span>
                    <span className="mt-0.5 text-[10px] text-stock/55">{HOW[st.how]}</span>
                  </span>
                ) : st.kind === "seen" ? (
                  <span className="rounded-full px-1.5 py-0.5 text-[12px] text-stock/80 ring-1 ring-stock/30" title="saw it with Talashi">👁 {nm(st.by)}</span>
                ) : (
                  <span className={`rounded-full px-2 py-0.5 text-[13px] font-bold ${st.to === "village" ? "bg-[#3a240c] text-[#f3c66b]" : "bg-crimson-deep text-ink"}`}>{st.to === "village" ? "The village" : "The thieves"}</span>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
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
/** tap your own seat: lines anyone says at a real table (designer 2026-10-09) */
const isBot = (name: string) => /🤖$/.test(name);


// ---------------------------------------------------------------- what's been said about each seat, and your own marks
type Mark = "trust" | "sus" | "unsure";
const MARK: Record<Mark, { label: string; glyph: string; dot: string }> = {
  trust: { label: "trusted", glyph: "✓", dot: "bg-jade text-card-ink" },
  sus: { label: "suspect", glyph: "!", dot: "bg-crimson text-ink" },
  unsure: { label: "unsure", glyph: "?", dot: "bg-[#f0a32e] text-card-ink" },
};
interface SaidAbout { accuse: number; trust: number; role?: string; /** false = "no Stone"; a Stone named; true = an old claim with no name */ stone?: boolean | Card }
/** 🔵 Bhadra · 🟡 Tunga · 💎 a Stone · ✗ none */
const stoneChip = (st: boolean | Card) => (st === "STONE_1" ? "🔵" : st === "STONE_2" ? "🟡" : st ? "💎✓" : "💎✗");
/** every public claim about a seat: how often called a thief, how often vouched for, the last role named for them */
function saidAbout(v: PlayerView): Record<number, SaidAbout> {
  const out: Record<number, SaidAbout> = {};
  // (designer 2026-10-12) each speaker's LATEST word about a seat is the one that counts — say something new (a role
  // came out, a Talashi told you otherwise) and it replaces what you said before. Stone words are kept apart.
  const latest = new Map<string, GameEvent>();
  for (const e of v.events) {
    if (e.type !== "claim" || e.to !== "all") continue;
    const t = e.data?.target as number | undefined;
    if (t === undefined) continue;
    latest.set(`${e.data?.seat}:${t}:${e.data?.kind === "stone" ? "stone" : "side"}`, e);
  }
  for (const e of latest.values()) {
    const t = e.data!.target as number;
    const a = (out[t] ??= { accuse: 0, trust: 0 });
    if (e.data?.kind === "stone") a.stone = e.data?.has ? ((e.data?.stone as Card | undefined) ?? true) : false;
    else {
      if (e.data?.role) a.role = String(e.data.role);
      if (e.data?.side === "T") a.accuse++; else if (e.data?.side === "V") a.trust++;
    }
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
    ["final", v.phase.startsWith("final") && d?.kind === "vote", <>The last vote. Vote out a <b>thief holding a Stone</b> and the village gets it — but vote out a <b>villager</b> holding one and it goes to the thieves.</>],
    ["surrender", d?.kind === "surrender", <>The rounds are over. <b>Surrender your Stone</b> to the village — a thief holding one wins it for the thieves.</>],
    ["vote", d?.kind === "vote", <>Tap the player you think is a <b>thief</b>. You can change your vote until the clock runs out.</>],
    ["debate", d?.kind === "debate", <>{v.phase.startsWith("final") ? <>The <b>last vote</b>!</> : <>A <b>Faisla</b>!</>} Everyone talks. Say what you know, then tap <b>Ready to vote</b>.</>],
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

/** THE ACCUSE SHEET (designer 2026-10-14): what the table has said about them so far, then ONE tap — a role card
 *  (thief cards first, in red: accuse · village cards in gold: clear) or the Stone. Your own read wears 🔮. Private
 *  marks, throws, mute and history sit below. An out player: "was…", no Stone. */
function AccuseSheet({ v, seat, said, seen, mark, onClose, onClaim, onMark, onThrow, hush, onHistory, onMessage }: {
  v: PlayerView; seat: number; said?: SaidAbout; seen?: string; mark?: Mark; onClose: () => void;
  onClaim?: (kind: "kundli" | "stone", role?: string, has?: boolean, stone?: Card) => void; onMark?: (m: Mark | null) => void; onThrow?: (e: string) => void;
  hush?: { hushed: boolean; toggle: () => void }; onHistory?: () => void; onMessage?: (voice: boolean) => void;
}) {
  const p = v.players[seat];
  const name = p.name.replace(/\s*🤖$/, "");
  const roles = [...v.rolesInPlay].sort((x, y) => Number(THIEF_ROLES.includes(y)) - Number(THIEF_ROLES.includes(x)));
  const head = `${ENGRAVED} text-[11px] font-semibold uppercase tracking-[0.2em] text-brass`;
  const anything = Boolean(said && (said.accuse || said.trust || said.stone !== undefined));
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div role="dialog" aria-label={name} onClick={(e) => e.stopPropagation()}
        className="stage-in flex max-h-[88dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl border-t-2 border-brass/70 bg-ember px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-center gap-3">
          <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-[20px] font-medium text-card-ink ${p.alive ? "" : "opacity-50 grayscale"}`}
            style={{ background: SEAT_COLOURS[seat % SEAT_COLOURS.length] }}>{name.slice(0, 1).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[22px] font-bold leading-tight text-stock">{name}{p.alive ? "" : " · out"}</p>
            <p className="text-[13px] text-stock/70">
              {anything && said
                ? <>Table says: {said.accuse > 0 && <span className="text-crimson-soft">🫵 {said.accuse} </span>}{said.trust > 0 && <span className="text-[#f3c66b]">🌾 {said.trust} </span>}{said.stone !== undefined && <span>{stoneChip(said.stone)}</span>}</>
                : "Nobody has said anything yet."}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center text-[20px] text-stock/60">✕</button>
        </div>

        {onMessage && <>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onMessage(false)} className="min-h-12 rounded-xl bg-[#0e2a18] text-[15px] font-bold text-jade-soft ring-2 ring-jade active:scale-95">💬 Message</button>
            <button type="button" onClick={() => onMessage(true)} className="min-h-12 rounded-xl bg-[#0e2a18] text-[15px] font-bold text-jade-soft ring-2 ring-jade active:scale-95">🎙 Voice note</button>
          </div>
          <p className="-mt-1 text-center text-[12px] text-stock/60">Only {name} sees it — the table sees that you two talked</p>
        </>}
        {onClaim && <>
          <p className={head}>{name} {p.alive ? "is" : "was"}… <span className="normal-case tracking-normal text-stock/50">tap a card</span></p>
          <ul className="grid grid-cols-4 gap-2">
            {roles.map((r) => {
              const thief = THIEF_ROLES.includes(r), art = roleArt(r);
              return (
                <li key={r}>
                  <button type="button" onClick={() => onClaim("kundli", r)} aria-label={`${name} ${p.alive ? "is" : "was"} ${r}`}
                    className={`relative flex w-full flex-col items-center overflow-hidden rounded-lg ring-2 active:scale-95 ${thief ? "bg-crimson-deep ring-crimson" : "bg-[#3a240c] ring-[#f0a32e]/70"}`}>
                    {art
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={art} alt="" className="aspect-[5/7] w-full object-cover object-top" />
                      : <span className="grid aspect-[5/7] w-full place-items-center font-display text-[28px] text-stock/80">{r.slice(0, 1)}</span>}
                    {/* the printed card carries its own name */}
                    {!art && <span className={`mt-0.5 w-full truncate px-0.5 text-center text-[11px] font-extrabold uppercase ${thief ? "text-ink" : "text-[#f3c66b]"}`}>{r}</span>}
                    {seen === r && <span className="absolute right-0.5 top-0.5 rounded-full bg-black/70 px-1 text-[12px]" title="You saw it">🔮</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {p.alive && <>
            <p className={head}>{name} has…</p>
            {/* (designer 2026-10-14) WHICH Stone */}
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => onClaim("stone", undefined, true, "STONE_1")} className="min-h-12 rounded-xl bg-[#10243a] text-[14px] font-bold text-[#9cc8ff] ring-2 ring-[#4a90d9] active:scale-95">🔵 Bhadra</button>
              <button type="button" onClick={() => onClaim("stone", undefined, true, "STONE_2")} className="min-h-12 rounded-xl bg-[#3a2a08] text-[14px] font-bold text-[#f3c66b] ring-2 ring-[#f0a32e] active:scale-95">🟡 Tunga</button>
              <button type="button" onClick={() => onClaim("stone", undefined, false)} className="min-h-12 rounded-xl bg-black/40 text-[14px] font-bold text-stock ring-2 ring-brass/50 active:scale-95">✋ No Stone</button>
            </div>
          </>}
        </>}

        <div className="flex flex-wrap items-center justify-center gap-1 border-t border-brass/30 pt-2">
          {onMark && <>
            <span className="mr-1 text-[12px] text-stock/60">🔒 Only you</span>
            {(Object.keys(MARK) as Mark[]).map((m) => (
              <button key={m} type="button" aria-label={`Mark ${MARK[m].label}`} aria-pressed={mark === m} onClick={() => onMark(mark === m ? null : m)}
                className={`grid h-9 w-9 place-items-center rounded-full text-[13px] font-black ${MARK[m].dot} ${mark === m ? "ring-2 ring-stock" : ""}`}>{MARK[m].glyph}</button>
            ))}
            <span className="mx-1 h-6 w-px bg-brass/30" aria-hidden />
          </>}
          {onThrow && REACTIONS.map((e) => <button key={e} type="button" onClick={() => onThrow(e)} className="grid h-10 w-10 place-items-center rounded-full text-[22px] active:scale-90">{e}</button>)}
          {hush && <button type="button" aria-label={hush.hushed ? "Unmute for me" : "Mute for me"} onClick={hush.toggle} className="grid h-10 w-10 place-items-center rounded-full text-[20px]">{hush.hushed ? "🔊" : "🔇"}</button>}
          {onHistory && <button type="button" onClick={onHistory} className="min-h-10 rounded-full px-3 text-[13px] font-bold text-stock/85 ring-1 ring-brass/40">📜 History</button>}
        </div>
      </div>
    </div>
  );
}

/** STREAMER MODE switch (lib/streamer.ts) — in the lobby and the ☰ menu */
function StreamerToggle() {
  const on = useStreamer();
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => setStreamer(!on)}
      className={`mx-auto mt-2 flex min-h-11 items-center gap-2 rounded-full px-4 text-[13px] font-bold ${on ? "bg-crimson-deep text-ink ring-2 ring-crimson" : "border border-brass/40 text-stock/80"}`}>
      <span aria-hidden>{on ? "🔴" : "📺"}</span>{on ? "Streamer mode ON — code hidden, your role shown to viewers" : "Streamer mode"}
    </button>
  );
}

/** the streamer's own role, in a corner, for the AUDIENCE (the table can't see the stream) */
function StreamerBadge({ v }: { v: PlayerView }) {
  const on = useStreamer();
  if (!on) return null;
  const thief = v.me.side === "T";
  return (
    <div aria-hidden className={`pointer-events-none fixed left-2 top-[68px] z-20 flex items-center gap-2 rounded-xl border-2 bg-black/80 p-1 pr-2.5 ${thief ? "border-crimson" : "border-[#f0a32e]"}`}>
      {roleArt(v.me.role)
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={roleArt(v.me.role)!} alt="" className="w-10 rounded" />
        : null}
      <span className="leading-tight">
        <span className="block text-[10px] font-bold uppercase tracking-wide text-stock/70">For viewers 🤫</span>
        <span className={`block font-display text-[15px] font-bold ${thief ? "text-crimson-soft" : "text-[#f3c66b]"}`}>{v.me.role}</span>
        <span className="block text-[11px] text-stock/80">{v.me.hand.filter((c) => c.startsWith("STONE")).length ? `💎 holding ${v.me.hand.filter((c) => c.startsWith("STONE")).length}` : thief ? "Team Thieves" : "Team Tunga"}</span>
      </span>
    </div>
  );
}

/** REPORT A PROBLEM (release checklist 2026-10-14): a few words, sent with this table's code — kept in the game's own log */
function ReportProblem() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  if (state === "sent") return <p className="text-center text-[14px] text-jade-soft">Thanks — we&rsquo;ve got it.</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-2xl border border-brass/40 px-4 text-left text-[14px] text-stock">🐞 Report a problem</button>;
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; setState("busy"); void reportIssue("player", text.trim()).then(() => setState("sent")); }}>
      <label htmlFor="report-text" className="text-[13px] text-stock/70">What went wrong? (no need for names)</label>
      <textarea id="report-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000}
        className="rounded-xl border border-brass/50 bg-black/40 p-3 text-[15px] text-stock outline-none focus:border-jade" />
      <button type="submit" disabled={!text.trim() || state === "busy"} className="nudge min-h-11 rounded-full text-[14px] font-extrabold uppercase tracking-wide disabled:opacity-50">{state === "busy" ? "Sending…" : "Send"}</button>
    </form>
  );
}


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

// ---------------------------------------------------------------- speed (designer 2026-10-12: "2x for everyone if host accepts")
/** 1× / 2×: the host sets it for the whole table; anyone else asks the host. 2× = bots, big-moment screens and the
 *  debate twice as fast; your own turn's clock stays. */
function SpeedRow({ code, token, host, speed, asked }: { code: string; token: string; host: boolean; speed: 1 | 2; asked: boolean }) {
  const [sent, setSent] = useState(false);
  const opt = (sp: 1 | 2) => (
    <button key={sp} type="button" aria-pressed={speed === sp} disabled={!host}
      onClick={() => { api.speed(code, token, { speed: sp }).catch(() => {}); }}
      className={`min-h-11 flex-1 rounded-full text-[13px] font-bold ${speed === sp ? "bg-[#f0a32e] text-card-ink" : "text-stock/80 ring-1 ring-brass/40"} disabled:opacity-100`}>{sp}×</button>
  );
  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label="Speed">
      <p className="text-[13px] font-semibold text-stock/70">Speed{host ? "" : " — the host decides"}</p>
      <div className="flex gap-2">{opt(1)}{opt(2)}</div>
      {!host && speed === 1 && (
        <button type="button" disabled={sent || asked} onClick={() => { setSent(true); api.speed(code, token, { speed: 2 }).catch(() => setSent(false)); }}
          className="min-h-11 rounded-full text-[13px] font-bold text-stock ring-1 ring-brass/50 disabled:opacity-60">{sent || asked ? "Asked the host" : "Ask the host for 2×"}</button>
      )}
    </div>
  );
}

/** the host's yes / no when a player asks for 2× */
function SpeedAsk({ code, token, name }: { code: string; token: string; name: string }) {
  const say = (answer: "yes" | "no") => { api.speed(code, token, { answer }).catch(() => {}); };
  return (
    <div className="mx-3 mt-2 flex items-center gap-2 rounded-2xl border border-brass/50 bg-black/50 px-3 py-2 text-[14px] text-stock" role="alertdialog" aria-label={`${name} asks for 2× speed`}>
      <p className="flex-1">{name} asks for 2× speed</p>
      <button type="button" onClick={() => say("yes")} className="min-h-10 rounded-full bg-[#f0a32e] px-4 font-bold text-card-ink">Yes</button>
      <button type="button" onClick={() => say("no")} className="min-h-10 rounded-full px-3 font-bold text-stock ring-1 ring-brass/50">No</button>
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
