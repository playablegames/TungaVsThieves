"use client";
/* Hallmark · genre: atmospheric · macrostructure: Workbench (app, portrait spotlight) · design-system: DESIGN.md · designed-as-app */
// The table, phone-first and portrait: a status line everyone reads the same way (BGA's "${actplayer} must…"),
// a seat strip where the spotlight glows, the table centre, and a dock with your role, your hand and your move.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, useGame, useHydrated } from "@/lib/client";
import { CARD } from "@/lib/cards";
import { beatsFor, type Beat } from "@/lib/beats";
import type { Action, Card, Side } from "@/engine/types";
import type { PlayerView, PublicPlayer } from "@/engine/view";
import type { ClientState } from "@/server/game";
import { useStage } from "@/lib/stage";
import { Stage } from "./Stage";
import { Decide, PlayerChip } from "./Decide";
import { HandRow, PlayedPair } from "./Hand";
import { CardIcon } from "./CardIcon";
import { RoleReveal, revealSeen } from "./RoleReveal";
import { TimerRing } from "./ui";
import { useVoice } from "@/lib/voice";
import { useBotSpeech } from "@/lib/botspeech";
import type { ChatMessage } from "@/server/store";

type VoiceCtl = ReturnType<typeof useVoice>;

export default function Game({ code }: { code: string }) {
  const g = useGame(code);
  const st = g.state;
  const voice = useVoice(
    code,
    st ? { seat: st.you.seat, name: st.you.name } : null,
    st?.status !== "playing",
    st?.view?.players.filter((p) => !p.alive).map((p) => p.seat) ?? [],
  );
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
      <VoiceBanner voice={voice} />
      {s.status === "playing" && s.view && !revealed && (
        <RoleReveal code={code} role={s.view.me.role} side={s.view.me.side} names={s.view.players.map((p) => p.name)} mySeat={s.view.me.seat} onDone={() => setRevealed(true)} />
      )}
      {s.status === "lobby"
        ? <Lobby s={s} code={code} token={g.token!} onError={g.setError} voice={voice} />
        : s.view && <Table s={s} v={s.view} act={g.act} now={g.now} extend={s.you.host ? g.extend : undefined} code={code} token={g.token!} voice={voice} messages={g.messages} />}
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
                {s.you.host && bots[i] && (
                  <button type="button" aria-label={`Remove ${plain(name, true)}`} onClick={() => api.removeBot(code, token, i).catch((e) => onError(e.message))}
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
              {i === 0 && <span className="-mt-0.5 rounded-full bg-[#f5a623] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-card-ink">Host</span>}
            </div>
          );
        })}
      </div>

      <div className="contents landscape:col-start-1 landscape:row-start-2 landscape:flex landscape:flex-col landscape:justify-end">
      {n >= 13 && <p className="mb-2 text-center text-[13px] font-semibold text-brass landscape:hidden">↻ Turn your phone sideways for a bigger table</p>}
      <p className="mb-3 text-center text-[13px] text-stock/70">
        {row ? `${row[0]} villagers · ${row[1]} thie${row[1] === 1 ? "f" : "ves"}` : `You need at least 4 players`}
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
      ) : <p className={`py-4 text-center ${ENGRAVED} text-[14px] font-semibold uppercase tracking-[0.15em] text-stock/85`}>Waiting for {names[0]} to start…</p>}
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
  if (p === "batwara") return mine ? "Bhukamp — pass one left, one right" : `Bhukamp — waiting for ${list}`;
  if (p.startsWith("elim:dal_pick")) return mine ? "Dal Badal — pick a role card" : `Dal Badal — ${list} picking a role card`;
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

function Table({ s, v, act, now, extend, code, token, voice, messages }: {
  s: ClientState; v: PlayerView; act: (a: Action) => void; now: () => number;
  extend?: () => void; code: string; token: string; voice: VoiceCtl; messages: ChatMessage[];
}) {
  const stage = useStage(v.events, v.players.map((p) => p.name));
  const bots = useBotSpeech(messages);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<null | "claim" | "history">(null);
  const myMove = v.decision?.kind ?? null;
  // playtest 2026-10-07: the last BIG play stays in the panel until the next big play replaces it; passes and
  // the like go on a one-line ticker under it, and the last claim out loud stays on its own line
  const shown = stage.current?.n ?? stage.last?.n ?? -1;
  const beats = useMemo(() => beatsFor(v.events, v.players.map((p) => p.name)).filter((b) => !b.private), [v.events, v.players]);
  const seen = beats.filter((b) => b.n <= shown);
  const headline = [...seen].reverse().find((b) => !TICKER.has(b.type) && b.type !== "claim") ?? null;
  const ticker = [...seen].reverse().find((b) => TICKER.has(b.type) && b.n > (headline?.n ?? -1)) ?? null;
  const said = [...seen].reverse().find((b) => b.type === "claim") ?? null;
  // playtest 2026-10-07 ("it doesn't show who received how many votes"): the last vote's counts stay on the seats and
  // in the panel — through the elimination it caused — until the next card is played or passed
  const lastVote = [...seen].reverse().find((b) => b.type === "vote_result") ?? null;
  const voteShown = lastVote && !seen.some((b) => b.n > lastVote.n && (b.card || b.type === "pass")) ? lastVote : null;
  // open voting: every ballot counts on the table the moment it is cast (weighted by the voter's votes)
  const live = v.ballots ? liveTally(v) : null;
  // your move: a short buzz and a tab-title flag, so a phone face-down on the table still tells you
  useEffect(() => {
    if (!myMove) return;
    navigator.vibrate?.(60);
    const was = document.title;
    document.title = "● Your move — Tunga vs Thieves";
    return () => { document.title = was; };
  }, [myMove]);

  if (s.status === "over") return (<><Stage stage={stage} skip={stage.skip} names={v.players.map((p) => p.name)} /><Final v={v} /></>);

  const living = v.players.filter((p) => p.alive);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div aria-hidden className="fixed inset-0 -z-10 bg-[radial-gradient(80%_45%_at_50%_32%,var(--color-ember-2)_0%,var(--color-ember)_60%,#120903_100%)]" />

      <header className="flex items-center gap-2 px-3 pt-2">
        <button type="button" onClick={() => setMenu(true)} aria-label="Menu" className="grid h-11 w-11 place-items-center text-stock">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <MicButton voice={voice} />
        <button type="button" onClick={() => setSheet("history")} aria-label="What happened so far" className="grid h-11 w-11 place-items-center text-brass">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
        </button>
        <p className="flex-1 text-center font-[family-name:var(--font-engraved)] text-[12px] font-semibold uppercase tracking-[0.18em] text-brass">Round {v.round} of {v.rounds}</p>
        <TimerRing deadline={s.deadline} now={now} size={52} brass />
      </header>

      <Ring v={v} voice={voice} talking={bots.current?.seat ?? null} actor={headline?.actor} target={headline?.target} pick={v.decision?.kind === "vote" ? v.decision.mine ?? null : null} tally={live ?? voteShown?.tally}
>
        {stage.current?.big
          ? <Stage stage={stage} skip={stage.skip} names={v.players.map((p) => p.name)} inline small={v.players.length > 8} />
          : <Centre v={v} last={headline} lastVote={voteShown} live={live} ticker={ticker} compact={Boolean(myMove && myMove !== "vote" && myMove !== "debate")} living={living.length} extend={extend}
          ready={() => act({ type: "ready" })} />}
      </Ring>
      <div className="mx-3 flex min-h-11 items-center" aria-live="polite">
        {bots.current ? (
          <p key={`${bots.current.seat}:${bots.current.text}`} className="stage-in w-full rounded-xl bg-black/40 px-3 py-1.5 text-[13px] leading-snug ring-1 ring-jade/50">
            <b className="text-jade-soft">{bots.current.name}:</b> <span className="italic">&ldquo;{bots.current.text}&rdquo;</span>
          </p>
        ) : said ? (
          <p key={said.n} className={`stage-in w-full rounded-xl bg-black/40 px-3 py-1.5 text-[13px] leading-snug ${said.tone === "lethal" ? "text-crimson-soft" : "text-[#f3c66b]"}`}>🗣 {said.title}</p>
        ) : null}
      </div>
      <Tray v={v} act={act} live={live} onClaim={v.me.alive ? () => setSheet("claim") : undefined} />
      {sheet === "claim" && <Claim v={v} code={code} token={token} onClose={() => setSheet(null)} />}
      {sheet === "history" && <Sheet title="What happened" onClose={() => setSheet(null)}><Story v={v} /></Sheet>}

      {menu && (
        <Sheet title="Menu" onClose={() => setMenu(false)}>
          <RolePeek v={v} />
          <div className="flex items-center gap-3">
            <MicButton voice={voice} />
            <p className="flex-1 text-[14px] text-stock/80">Your mic. Tap a player&rsquo;s seat to mute them for you only.</p>
          </div>
          <button type="button" onClick={() => bots.setVoice(!bots.voice)} aria-pressed={bots.voice}
            className="flex min-h-12 items-center gap-3 rounded-2xl border border-brass/40 px-4 text-left text-[14px] text-stock">
            <span className="text-[18px]" aria-hidden>{bots.voice ? "🔊" : "🔈"}</span>{bots.voice ? "Bots speak aloud" : "Bots speak as text only"}
          </button>
          <Story v={v} />
          <Link href="/" className="text-center text-[13px] text-stock/60 underline">Leave this table</Link>
        </Sheet>
      )}
    </div>
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
function Ring({ v, voice, talking, actor, target, pick, tally, onPick, children }: {
  v: PlayerView; voice: VoiceCtl; talking: number | null; actor?: number; target?: number; pick: number | null; tally?: Record<string, number>; onPick?: (seat: number) => void; children: React.ReactNode;
}) {
  const n = v.players.length;
  const voteOpen = v.phase.endsWith("_vote");
  const size: SeatSize = n <= 8 ? "lg" : n <= 16 ? "md" : "sm";
  const ini = initialsOf(v.players.map((p) => p.name));
  return (
    <section className="relative mx-2 min-h-[440px] flex-1" aria-label="The table">
      <div className="absolute inset-x-[9%] inset-y-[8%] rounded-[50%] border border-brass/35" aria-hidden />
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
              onTap={onPick && p.alive ? () => onPick(p.seat) : !me && peer ? () => voice.hush(p.seat) : undefined} />
          </div>
        );
      })}
      <div className="absolute left-1/2 top-1/2 max-h-[50%] w-[54%] max-w-[240px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl [scrollbar-width:none]">{children}</div>
    </section>
  );
}

type SeatSize = "lg" | "md" | "sm";
const SEAT: Record<SeatSize, { disc: string; tag: string; w: string }> = {
  lg: { disc: "h-14 w-14 text-[24px]", tag: "px-3 py-0.5 text-[13px] max-w-[96px]", w: "w-[96px]" },
  md: { disc: "h-11 w-11 text-[18px]", tag: "px-2 py-px text-[11px] max-w-[76px]", w: "w-[76px]" },
  sm: { disc: "h-9 w-9 text-[14px]", tag: "px-1.5 py-px text-[10px] max-w-[60px]", w: "w-[60px]" },
};

function Seat({ p, me, size, initials, got, tag, spot, voted, picked, speaking, micOff, hushed, onTap }: {
  p: PublicPlayer; me: boolean; size: SeatSize; initials: string; got?: number; tag?: "played" | "target"; spot: boolean; voted: boolean; picked: boolean;
  speaking: boolean; micOff: boolean; hushed: boolean; onTap?: () => void;
}) {
  const z = SEAT[size];
  const label = `${p.name}${me ? " (you)" : ""}${got ? `, got ${got} vote${got === 1 ? "" : "s"}` : ""}: ${p.handSize} cards, ${p.votes} vote${p.votes === 1 ? "" : "s"}${p.alive ? "" : `, out — was ${p.revealedRole}`}${spot ? ", their move" : ""}${speaking ? ", talking" : ""}${voted ? ", has voted" : ""}`;
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
        {Boolean(got) && <span className="absolute -left-2 -top-2 z-10 grid h-6 min-w-6 place-items-center rounded-full bg-crimson px-1 text-[12px] font-black text-ink ring-2 ring-ember" aria-hidden>{got}</span>}
        {voted && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#f0a32e] text-[11px] font-black text-card-ink" aria-hidden>✓</span>}
      </button>
      <span className={`relative z-10 -mt-1 truncate rounded-full border bg-ember font-medium ${z.tag} ${me ? "border-2 border-jade text-jade-soft" : spot ? "border-[#f0a32e] text-[#f3c66b]" : "border-brass/60 text-stock"}`}>{p.name}</span>
      {p.alive
        ? <span className="mt-0.5 flex h-1.5 gap-0.5" aria-hidden>{Array.from({ length: p.votes }).map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-[#f0a32e]" />)}</span>
        : <span className="text-[10px] leading-tight text-crimson-soft">{p.revealedRole}</span>}
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

/** whose turn comes after this one (the next living seat) — only while a turn is on */
function nextUp(v: PlayerView): string | null {
  if (!v.phase.startsWith("turn")) return null;
  const n = v.players.length;
  for (let k = 1; k < n; k++) { const p = v.players[(v.turnSeat + k) % n]; if (p.alive) return p.seat === v.me.seat ? "you" : p.name; }
  return null;
}

const TICKER = new Set(["pass", "away", "back", "floor_extended", "timeout", "vote_lost", "gift"]);

function Centre({ v, last, lastVote, live, ticker, compact, living, extend, ready }: {
  v: PlayerView; last: Beat | null; lastVote: Beat | null; live: Record<string, number> | null; ticker: Beat | null; compact: boolean; living: number;
  extend?: () => void; ready: () => void;
}) {
  const d = v.decision;
  const voteOpen = v.phase.endsWith("_vote");
  const debate = v.phase.endsWith("_debate");
  const name = (seat: number) => v.players[seat]?.name ?? "?";
  const btn = "min-h-11 rounded-full border-2 border-brass/70 px-3 font-[family-name:var(--font-engraved)] text-[13px] font-bold uppercase tracking-wide";
  return (
    <div className="relative rounded-2xl border border-brass/70 bg-[#1a0e06]/90 px-2.5 pb-2.5 pt-4 text-center shadow-[0_10px_30px_-10px_rgba(0,0,0,.8)]">
      <Ornament className="absolute -top-2 left-1/2 -translate-x-1/2" />
      <Ornament className="absolute -bottom-2 left-1/2 -translate-x-1/2" />
      <Ornament className="absolute -left-2.5 top-1/2 -translate-y-1/2" />
      <Ornament className="absolute -right-2.5 top-1/2 -translate-y-1/2" />

      {voteOpen || debate ? (
        <>
          <p className="font-display text-[19px] font-bold leading-tight text-stock">{debate ? (v.phase.startsWith("final") ? "Last debate" : "Faisla") : "Vote"}</p>
          <p className="mt-1 text-[13px] leading-snug text-stock/75">
            {debate ? "The floor is open — accuse, defend, claim." : `${living - v.waitingOn.length} of ${living} voted`}
          </p>
          {voteOpen && live && <Tally v={v} tally={live} ballots={v.ballots ?? {}} />}
          {debate && d?.kind === "debate" && (
            <div className="mt-2 flex flex-col items-center gap-1.5">
              <p className="text-[12px] text-stock/60">{d.ready.length} of {living} ready</p>
              <button type="button" onClick={ready} className={`${btn} w-full bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] text-stock`}>Ready to vote</button>
              {extend && <button type="button" onClick={extend} className="min-h-8 text-[11px] text-stock/60 underline">+30s (host, once)</button>}
            </div>
          )}

        </>
      ) : last && compact ? (
        // your move: the cards and buttons need the room, so the panel shrinks to one play and one line (decision 2a)
        <div key={last.n} className="stage-in">
          {last.card && last.actor !== undefined
            ? <p className="font-display text-[13px] leading-snug text-stock/75">{name(last.actor)} played <b className="font-bold uppercase text-[#f3c66b]">{CARD[last.card].name} ×2</b></p>
            : null}
          <p className="mt-0.5 line-clamp-2 font-display text-[13px] leading-snug text-stock/90">{last.title}</p>
        </div>
      ) : last ? (
        <div key={last.n} className="stage-in">
          {last.card && last.actor !== undefined ? (
            <>
              {/* designer's mockup 2026-10-07: who played · the card in gold ×2 · the pair · what it did · what follows */}
              <p className="font-display text-[14px] leading-tight text-stock/75">{name(last.actor)} played</p>
              <p className="mt-0.5 font-display text-[clamp(18px,5.5vw,24px)] font-bold uppercase leading-none tracking-wide text-[#f3c66b]">{CARD[last.card].name} <span className="text-[0.75em]">×2</span></p>
              {v.players.length <= 8 && <div className="mt-2"><PlayedPair c={last.card} /></div>}
              <Divider />
              <p className="font-display text-[14px] leading-snug text-stock/90">{last.title}</p>
              {last.cards && last.cards.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap justify-center gap-1">
                  {last.cards.map((c, i) => <li key={i} className="flex items-center gap-1 rounded-full border border-brass/40 bg-black/30 py-0.5 pl-0.5 pr-2 text-[11px] text-stock"><CardIcon c={c} className="w-4" />{CARD[c].name}</li>)}
                </ul>
              )}
            </>
          ) : <p className="font-display text-[17px] font-bold leading-snug text-stock">{last.title}</p>}
          {lastVote?.tally && (last.type === "vote_result" || last.n > lastVote.n) && <Tally v={v} tally={lastVote.tally} ballots={lastVote.ballots ?? {}} />}
          {last.detail && (
            last.card
              ? <p className="mt-1.5 flex items-center gap-2 rounded-lg border border-brass/40 bg-black/30 px-2 py-1 text-left font-display text-[12px] leading-snug text-stock/85">
                  <svg width="18" height="16" viewBox="0 0 18 16" className="shrink-0" aria-hidden><rect x="1" y="3" width="9" height="12" rx="1.5" transform="rotate(-10 5 9)" fill="#6b4520" stroke="#e0a24a" /><rect x="7" y="1" width="9" height="12" rx="1.5" transform="rotate(8 11 7)" fill="#8a5a1c" stroke="#e0a24a" /></svg>
                  <span className="line-clamp-2">{last.detail}</span>
                </p>
              : <><Divider /><p className="line-clamp-2 font-display text-[13px] leading-snug text-stock/80">{last.detail}</p></>
          )}
        </div>
      ) : (
        <p className="font-display text-[17px] leading-snug text-stock">The cards are dealt.</p>
      )}

      {ticker && !voteOpen && !debate && !compact && <p className="mt-2 truncate text-[12px] text-stock/55">{ticker.title}</p>}
      {!voteOpen && !debate && <p className={`mt-1.5 text-[12px] font-semibold leading-snug ${d ? "text-jade-soft" : "text-stock/60"}`}>{status(v)}{nextUp(v) ? <span className="text-stock/50"> · next: <b className="text-[#f3c66b]">{nextUp(v)}</b></span> : null}</p>}


    </div>
  );
}

/** after a vote: everyone's count, and who voted whom (votes are cast in the open) */
function Tally({ v, tally, ballots }: { v: PlayerView; tally: Record<string, number>; ballots: Record<string, number | null> }) {
  const [open, setOpen] = useState(false);
  const name = (x: string | number) => v.players[Number(x)]?.name ?? "?";
  const rows = Object.entries(tally).filter(([, k]) => k > 0).sort((a, b) => b[1] - a[1]);
  const abstained = Object.entries(ballots).filter(([, t]) => t === null).map(([x]) => name(x));
  return (
    <div className="mt-2 text-center">
      <ul className="flex flex-wrap justify-center gap-1.5">
        {rows.map(([x, k]) => (
          <li key={x} className="rounded-full border border-brass/50 bg-black/30 px-2 py-0.5 text-[12px] text-stock"><b className="text-[#f3c66b]">{k}</b> {name(x)}</li>
        ))}
        {!rows.length && <li className="text-[12px] text-stock/60">Nobody got a vote.</li>}
      </ul>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mx-auto mt-1 block min-h-8 text-[11px] text-stock/60 underline">{open ? "Hide" : "Who voted whom"}</button>
      {open && (
        <ul className="mt-1 flex max-h-32 flex-col items-center overflow-y-auto text-[12px] leading-snug text-stock/80">
          {Object.entries(ballots).filter(([, t]) => t !== null).map(([x, t]) => <li key={x}>{name(x)} → {name(t!)}</li>)}
          {abstained.length > 0 && <li className="text-stock/50">Abstained: {abstained.join(", ")}</li>}
        </ul>
      )}
    </div>
  );
}

/** Say something to the whole table — the bots hear it too. A claim can be true or a lie, like at a real table. */
function Claim({ v, code, token, onClose }: { v: PlayerView; code: string; token: string; onClose: () => void }) {
  const [kind, setKind] = useState<"kundli" | "accuse" | "trust">("kundli");
  const [target, setTarget] = useState<number | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const others = v.players.filter((p) => p.alive && p.seat !== v.me.seat);
  const ready = target !== null && (kind !== "kundli" || role !== null);
  const send = () => {
    setBusy(true); setErr(null);
    api.claim(code, token, { kind, target: target!, ...(kind === "kundli" ? { role: role! } : {}) })
      .then(onClose).catch((e) => { setErr((e as Error).message); setBusy(false); });
  };
  const tab = (k: typeof kind, label: string) => (
    <button type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
      className={`min-h-11 flex-1 rounded-full border-2 text-[12px] font-bold uppercase tracking-wide ${kind === k ? "border-[#f0a32e] bg-[#3a240c] text-[#f3c66b]" : "border-brass/40 text-stock/70"}`}>{label}</button>
  );
  return (
    <Sheet title="Tell the table" onClose={onClose}>
      <div className="flex gap-2">{tab("kundli", "Kundli read")}{tab("accuse", "A thief")}{tab("trust", "Trust")}</div>
      <p className="text-center text-[13px] text-stock/70">
        {kind === "kundli" ? "Who did you read, and what did you see?" : kind === "accuse" ? "Who is a thief?" : "Who is with the village?"}
      </p>
      <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
        {others.map((p) => <PlayerChip key={p.seat} p={p} selected={target === p.seat} onClick={() => setTarget(p.seat)} />)}
      </div>
      {kind === "kundli" && (
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="The role you saw">
          {v.rolesInPlay.map((r) => (
            <button key={r} type="button" onClick={() => setRole(r)} aria-pressed={role === r}
              className={`min-h-10 rounded-full px-3 text-[13px] font-bold ${role === r ? "bg-[#f0a32e] text-card-ink" : "bg-black/40 text-stock ring-1 ring-brass/40"}`}>{r}</button>
          ))}
        </div>
      )}
      {err && <p role="alert" className="rounded-xl bg-crimson-deep p-3 text-center text-[14px]">{err}</p>}
      <button type="button" disabled={!ready || busy} onClick={send}
        className="min-h-12 rounded-full border-2 border-brass/80 bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] font-[family-name:var(--font-engraved)] text-[16px] font-bold uppercase tracking-[0.08em] text-stock disabled:opacity-40">
        Say it
      </button>
    </Sheet>
  );
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
function Tray({ v, act, live, onClaim }: { v: PlayerView; act: (a: Action) => void; live: Record<string, number> | null; onClaim?: () => void }) {
  const d = v.decision;
  if (d?.kind === "vote") return <Ballot v={v} mine={d.mine} live={live ?? {}} act={act} />;
  const inTray = d && d.kind !== "debate";
  return (
    <section className="sticky bottom-0 z-20 flex flex-col gap-2 rounded-t-3xl border-t border-brass/30 bg-ember px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-14px_30px_-6px_rgba(0,0,0,.75)]">
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-brass/40" /><Ornament /><span className="h-px flex-1 bg-brass/40" />
      </div>
      <div className="-mt-1 grid grid-cols-[1fr_auto_1fr] items-center">
        <span />
        <h2 className="text-center font-display text-[24px] font-bold leading-tight text-stock">
          {!v.me.alive ? "You're out" : inTray ? "Your move" : "Your Cards"}
        </h2>
        {onClaim && (
          <button type="button" onClick={onClaim} className="justify-self-end rounded-full border border-brass/60 px-3 py-1.5 text-[12px] font-bold text-stock">🗣 Tell</button>
        )}
      </div>
      {!v.me.alive && <p className="text-center text-[12px] text-stock/60">Gone room — you hear the table; only the gone hear you.</p>}
      {inTray ? <Decide key={v.phase} v={v} act={act} /> : v.me.alive && <HandRow cards={v.me.hand} />}
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
function Final({ v }: { v: PlayerView }) {
  const [story, setStory] = useState(false);
  const reveal = v.finalReveal!;
  const village = v.winner === "V";
  const mine = reveal.find((r) => r.seat === v.me.seat)!;
  const won = mine.side === v.winner;
  const name = (seat: number) => v.players[seat]?.name ?? "?";
  // where each Stone ended: in a living player's hand, or with the village (the cards left on the table at the end,
  // and the cards of anyone the mandatory vote put out)
  const stoneAt = (c: Card) => {
    const r = reveal.find((x) => x.hand.includes(c) && v.players[x.seat].alive);
    return r ? { who: name(r.seat), side: r.side as Side } : { who: "The village", side: "V" as Side };
  };
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
        <p className={`mt-2 font-display text-[16px] ${won ? "text-jade-soft" : "text-stock/70"}`}>{won ? "You won" : "You lost"} — you were {mine.role}</p>
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

      <Link href="/" className={`${btn} mt-3 inline-flex items-center justify-center bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] text-stock`}>Play again</Link>
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
