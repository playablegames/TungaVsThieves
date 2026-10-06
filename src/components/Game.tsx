"use client";
/* Hallmark · genre: atmospheric · macrostructure: Workbench (app, portrait spotlight) · design-system: DESIGN.md · designed-as-app */
// The table, phone-first and portrait: a status line everyone reads the same way (BGA's "${actplayer} must…"),
// a seat strip where the spotlight glows, the table centre, and a dock with your role, your hand and your move.
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useGame, useHydrated } from "@/lib/client";
import { CARD, isStoneCard, sideName } from "@/lib/cards";
import type { Beat } from "@/lib/beats";
import type { Action } from "@/engine/types";
import type { PlayerView, PublicPlayer } from "@/engine/view";
import type { ClientState } from "@/server/game";
import { useStage } from "@/lib/stage";
import { Stage } from "./Stage";
import { Decide } from "./Decide";
import { Btn, CardFace, TimerRing } from "./ui";
import { useVoice } from "@/lib/voice";

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
  if (!g.hydrated) return <Centered>Connecting…</Centered>;
  if (g.token === null)
    return (
      <Centered>
        <p>You aren&rsquo;t at table <b>{code}</b> on this phone.</p>
        <Link href={`/?code=${code}`} className="mt-4 inline-flex min-h-12 items-center rounded-full bg-marigold px-6 font-extrabold uppercase tracking-wide text-card-ink">Join this table</Link>
      </Centered>
    );
  if (!g.state) return <Centered>{g.error ?? "Connecting…"}</Centered>;
  const s = g.state;
  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-y-auto">
      {s.you.away && s.status === "playing" && (
        <button onClick={g.reclaim} className="m-3 mb-0 rounded-xl bg-marigold p-3 text-left font-bold text-card-ink">
          A stand-in is playing safe for you. Tap — I&rsquo;m back.
        </button>
      )}
      {g.error && <button onClick={() => g.setError(null)} className="m-3 mb-0 rounded-xl bg-crimson-deep p-3 text-left text-[14px]">{g.error} — tap to dismiss</button>}
      <VoiceBanner voice={voice} />
      {s.status === "lobby"
        ? <Lobby s={s} code={code} token={g.token!} onError={g.setError} voice={voice} />
        : s.view && <Table s={s} v={s.view} act={g.act} now={g.now} extend={s.you.host ? g.extend : undefined} code={code} token={g.token!} voice={voice} />}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center text-ink-2"><div>{children}</div></main>;
}

// ---------------------------------------------------------------- lobby
function Lobby({ s, code, token, onError, voice }: { s: ClientState; code: string; token: string; onError: (e: string) => void; voice: VoiceCtl }) {
  const names = s.lobby!.names;
  const bots = s.lobby!.bots;
  const row = s.lobby!.roleTable[names.length];
  const hydrated = useHydrated();
  const link = hydrated ? `${location.origin}/?code=${code}` : "";
  const invite = `Join my Tunga vs Thieves table — code ${code}: ${link}`;
  return (
    <section className="flex flex-col gap-5 p-4 pb-8">
      <div className="rounded-2xl border border-rim bg-paper-2/80 p-5 text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-ink-2">Table code</p>
        <p className="font-display text-5xl font-black tracking-[0.2em] text-marigold-soft">{code}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={`https://wa.me/?text=${encodeURIComponent(invite)}`} target="_blank" rel="noreferrer"
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-jade px-4 text-[13px] font-extrabold uppercase tracking-wide text-card-ink">Invite on WhatsApp</a>
          <Btn voice="pass" onClick={() => navigator.clipboard?.writeText(link).catch(() => {})}>Copy link</Btn>
        </div>
        <div className="mt-3 flex items-center gap-3 text-left">
          <MicButton voice={voice} />
          <p className="text-[13px] leading-snug text-ink-2">Voice is built in — everyone talks from their seat. Earphones stop the echo. Your phone buzzes when it&rsquo;s your move.</p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">{names.length} at the table</h2>
          <span className="text-[13px] text-ink-2">{row ? `${row[0]} Tunga · ${row[1]} Thieves · ${row[2]} rounds` : "4–30 players"}</span>
        </div>
        <ul className="flex flex-col gap-2">{names.map((n, i) => (
          <li key={i} className="flex min-h-12 items-center gap-3 rounded-xl bg-paper-2/70 px-3 ring-1 ring-rim">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-[13px] font-extrabold ${i === 0 ? "bg-marigold text-card-ink" : "bg-raise-2"} ${(i === s.you.seat ? voice.speaking : voice.peers[i]?.speaking) ? "speaking" : ""}`}>{n.slice(0, 1)}</span>
            <span className="font-bold">{n}</span>
            {i !== s.you.seat && voice.peers[i]?.muted && <MicOff />}
            {i === 0 && <span className="rounded-full bg-marigold/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-marigold-soft">Host</span>}
            {bots[i] && <span className="rounded-full bg-jade/15 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-jade-soft">Bot</span>}
            {s.you.host && bots[i] && (
              <button aria-label={`Remove ${n}`} onClick={() => api.removeBot(code, token, i).catch((e) => onError(e.message))}
                className="ml-auto grid h-11 w-11 place-items-center rounded-full text-muted">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            )}
          </li>
        ))}</ul>
      </div>

      {s.you.host ? (
        <div className="flex flex-col gap-2">
          {names.length < 30 && <Btn voice="ghost" onClick={() => api.addBot(code, token).catch((e) => onError(e.message))}>Add a bot</Btn>}
          <Btn voice="vote" disabled={!row} onClick={() => api.start(code, token).catch((e) => onError(e.message))}>Deal the roles</Btn>
          <p className="text-center text-[12px] text-muted">Seats are shuffled when you deal.</p>
        </div>
      ) : <p className="text-center text-ink-2">Waiting for {names[0]} to deal…</p>}
    </section>
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
  if (p.startsWith("elim")) {
    const seat = Number(p.split(":")[2]);
    return mine ? "You're out — your last decision" : `${name(seat)} is out — their last decision`;
  }
  return "";
}

// One screen: a ring of seats around a centre stage. You are the seat at the bottom. Voice carries the table —
// the centre holds the round, the clock, the vote and one "last declaration" line; only climaxes take the stage.
function Table({ s, v, act, now, extend, code, token, voice }: {
  s: ClientState; v: PlayerView; act: (a: Action) => void; now: () => number;
  extend?: () => void; code: string; token: string; voice: VoiceCtl;
}) {
  const stage = useStage(v.events, v.players.map((p) => p.name));
  const [pick, setPick] = useState<number | null>(null);
  const myMove = v.decision?.kind ?? null;
  // your move: a short buzz and a tab-title flag, so a phone face-down on the table still tells you
  useEffect(() => {
    if (!myMove) return;
    navigator.vibrate?.(60);
    const was = document.title;
    document.title = "● Your move — Tunga vs Thieves";
    return () => { document.title = was; };
  }, [myMove]);

  if (s.status === "over") return (<><Stage stage={stage} skip={stage.skip} /><Final v={v} host={s.you.host} code={code} token={token} /></>);

  const voting = myMove === "vote";
  const living = v.players.filter((p) => p.alive);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Stage stage={stage} skip={stage.skip} />
      <Ring v={v} voice={voice} pick={pick} onPick={voting ? (seat) => setPick(seat === pick ? null : seat) : undefined}>
        <Centre s={s} v={v} now={now} last={stage.last} pick={pick} living={living.length} extend={extend}
          vote={(target) => { act({ type: "vote", target }); setPick(null); }} ready={() => act({ type: "ready" })} />
      </Ring>
      <Tray v={v} act={act} voice={voice} />
    </div>
  );
}

/** Seats on an ellipse, in turn order, starting from you at the bottom. */
function Ring({ v, voice, pick, onPick, children }: {
  v: PlayerView; voice: VoiceCtl; pick: number | null; onPick?: (seat: number) => void; children: React.ReactNode;
}) {
  const n = v.players.length;
  const voteOpen = v.phase.endsWith("_vote");
  return (
    <section className="relative mt-2 min-h-[420px] flex-1" aria-label="The table">
      <div className="absolute inset-x-[14%] inset-y-[18%] rounded-[50%] border border-rim bg-paper-2/40" aria-hidden />
      {Array.from({ length: n }, (_, k) => {
        const p = v.players[(v.me.seat + k) % n];
        const angle = Math.PI / 2 + (k * 2 * Math.PI) / n;
        const me = p.seat === v.me.seat;
        const peer = voice.peers[p.seat];
        return (
          <div key={p.seat} className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${50 + 41 * Math.cos(angle)}%`, top: `${51 + 40 * Math.sin(angle)}%` }}>
            <Seat p={p} me={me} v={v}
              spot={!voteOpen && v.waitingOn.includes(p.seat)}
              voted={voteOpen && p.alive && !v.waitingOn.includes(p.seat)}
              picked={pick === p.seat}
              speaking={me ? voice.speaking : Boolean(peer?.speaking && !peer.hushed)}
              micOff={me ? !voice.micOn || voice.micBlocked : Boolean(peer?.muted)}
              hushed={Boolean(peer?.hushed)}
              onTap={onPick && p.alive ? () => onPick(p.seat) : !me && peer ? () => voice.hush(p.seat) : undefined} />
          </div>
        );
      })}
      <div className="absolute left-1/2 top-1/2 w-[52%] -translate-x-1/2 -translate-y-1/2">{children}</div>
    </section>
  );
}

function Seat({ p, me, v, spot, voted, picked, speaking, micOff, hushed, onTap }: {
  p: PublicPlayer; me: boolean; v: PlayerView; spot: boolean; voted: boolean; picked: boolean;
  speaking: boolean; micOff: boolean; hushed: boolean; onTap?: () => void;
}) {
  const [peek, setPeek] = useState(false);
  // your own seat: hold it to see your role — so a phone on the table never gives you away
  const hold = me && !onTap ? {
    onPointerDown: () => setPeek(true), onPointerUp: () => setPeek(false), onPointerLeave: () => setPeek(false), onPointerCancel: () => setPeek(false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  } : {};
  const label = `${p.name}${me ? " (you)" : ""}: ${p.handSize} cards, ${p.votes} vote${p.votes === 1 ? "" : "s"}${p.alive ? "" : `, out — was ${p.revealedRole}`}${spot ? ", deciding" : ""}${speaking ? ", talking" : ""}${voted ? ", has voted" : ""}`;
  return (
    <div className={`relative flex w-[64px] flex-col items-center gap-0.5 text-center ${p.alive ? "" : "opacity-45"}`}>
      {peek && (
        <span className={`absolute bottom-full mb-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-extrabold ${v.me.side === "V" ? "bg-marigold text-card-ink" : "bg-crimson text-ink"}`}>
          {v.me.role} · {sideName(v.me.side)}
        </span>
      )}
      <button type="button" disabled={!onTap && !me} onClick={onTap} aria-label={me && !onTap ? `${label}. Hold to see your role` : label} aria-pressed={onTap ? picked : undefined} {...hold}
        className={`relative grid h-12 w-12 select-none place-items-center rounded-full font-display text-[18px] font-black [-webkit-touch-callout:none]
          ${me ? "bg-marigold text-card-ink" : "bg-raise-2"} ${spot ? "spotlight" : ""} ${speaking ? "speaking" : ""} ${picked ? "ring-4 ring-jade" : ""}`}>
        {p.alive ? p.name.slice(0, 1) : "✕"}
        <span className="absolute -bottom-1 -right-1 rounded-full bg-paper px-1 text-[10px] font-extrabold tabular-nums text-ink-2 ring-1 ring-raise-2" aria-hidden>{p.handSize}</span>
        {(micOff || hushed) && <span className="absolute -left-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-paper ring-1 ring-raise-2"><MicOff small crossed={hushed} /></span>}
        {voted && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-marigold text-[11px] font-black text-card-ink" aria-hidden>✓</span>}
      </button>
      <span className="w-full truncate text-[11px] font-bold leading-tight">{me ? "You" : p.name}</span>
      {p.alive
        ? <span className="flex h-1.5 gap-0.5" aria-hidden>{Array.from({ length: p.votes }).map((_, i) => <span key={i} className="h-1.5 w-1.5 rounded-full bg-marigold" />)}</span>
        : <span className="text-[10px] leading-tight text-crimson-soft">{p.revealedRole}</span>}
    </div>
  );
}

/** The centre stage: round, clock, what the table is waiting for, the vote, and the last declaration. */
function Centre({ s, v, now, last, pick, living, extend, vote, ready }: {
  s: ClientState; v: PlayerView; now: () => number; last: Beat | null; pick: number | null; living: number;
  extend?: () => void; vote: (target: number | null) => void; ready: () => void;
}) {
  const d = v.decision;
  const voteOpen = v.phase.endsWith("_vote");
  const debate = v.phase.endsWith("_debate");
  const name = (seat: number) => v.players[seat]?.name ?? "?";
  const lastLine = last ? `${last.title}${last.cards?.length ? `: ${last.cards.map((c) => CARD[c].name).join(", ")}` : last.detail ? ` — ${last.detail}` : ""}` : null;
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-2">Round {v.round} · {v.rounds}</p>
      <TimerRing deadline={s.deadline} now={now} size={60} />
      <p className={`font-display text-[17px] font-black leading-tight ${d ? "text-jade-soft" : "text-ink"}`}>{status(v)}</p>

      {debate && d?.kind === "debate" && (
        <>
          <p className="text-[12px] text-ink-2">{d.ready.length} of {living} ready</p>
          <Btn voice="vote" onClick={ready}>Ready to vote</Btn>
          {extend && <button onClick={extend} className="min-h-11 text-[12px] font-bold text-ink-2 underline">+30s (host, once)</button>}
        </>
      )}
      {voteOpen && (
        <p className="text-[12px] text-ink-2">{living - v.waitingOn.length} of {living} voted</p>
      )}
      {voteOpen && d?.kind === "vote" && (
        <>
          <p className="text-[13px] font-bold">{pick === null ? "Tap a seat to vote" : `${name(pick)}?`}</p>
          <div className="grid w-full grid-cols-2 gap-1.5">
            <Btn voice="ghost" onClick={() => vote(null)}>Abstain</Btn>
            <Btn voice="vote" disabled={pick === null} onClick={() => vote(pick)}>Vote</Btn>
          </div>
        </>
      )}

      {lastLine && !voteOpen && !debate && (
        <p className="line-clamp-2 text-[12px] leading-snug text-ink-2"><span className="text-muted">Last: </span>{lastLine}</p>
      )}
    </div>
  );
}

/** Your cards, face up, and — when it's yours — the legal declarations or Pass. */
function Tray({ v, act, voice }: { v: PlayerView; act: (a: Action) => void; voice: VoiceCtl }) {
  const d = v.decision;
  const inTray = d && d.kind !== "vote" && d.kind !== "debate";
  return (
    <section className="sticky bottom-0 z-10 flex flex-col gap-2 rounded-t-2xl border-t border-rim bg-paper-2 px-3 pt-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2">
        <MicButton voice={voice} />
        <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">
          {!v.me.alive ? "Gone room — you hear the table; only the gone hear you" : inTray ? "Your move" : `Your cards · ${v.me.hand.length}`}
        </p>
      </div>
      {v.me.alive && (inTray
        ? <Decide key={v.phase} v={v} act={act} />
        : <div className="flex flex-wrap gap-1.5 opacity-60">{v.me.hand.map((c, i) => <CardFace key={i} c={c} size="sm" />)}</div>)}
      {!v.me.alive && inTray && <Decide key={v.phase} v={v} act={act} />}
    </section>
  );
}

function Story({ v }: { v: PlayerView }) {
  const items = [...v.events].reverse().filter((e) => !["analytics_deal", "analytics_turn"].includes(e.type)).slice(0, 120);
  return (
    <ul className="flex flex-col gap-1.5 overflow-y-auto text-[14px]">
      {items.map((e) => (
        <li key={e.n} className={e.to === "all" ? "text-ink-2" : "rounded-lg bg-jade/10 px-2 py-1 text-jade-soft"}>
          {e.to === "all" ? "" : "Private · "}{e.msg}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- the end: every role flips, the whole story opens
function Final({ v, host, code, token }: { v: PlayerView; host: boolean; code: string; token: string }) {
  async function download() {
    const data = await api.log(code, token);
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tunga-${code}.json`;
    a.click();
  }
  const village = v.winner === "V";
  return (
    <section className="flex flex-col gap-4 p-4">
      <div className={`rounded-2xl p-5 ring-2 ${village ? "bg-marigold/10 ring-marigold" : "bg-crimson/10 ring-crimson"}`}>
        <h1 className={`font-display text-4xl font-black ${village ? "text-marigold-soft" : "text-crimson-soft"}`}>{village ? "Tunga wins" : "Thieves win"}</h1>
        <p className="mt-1 text-[15px] text-ink-2">{v.overReason}</p>
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {v.finalReveal!.map((r, i) => (
          <li key={r.seat} className={`flip-in rounded-xl p-3 ring-1 ${r.side === "V" ? "bg-marigold/10 ring-marigold/50" : "bg-crimson/10 ring-crimson/50"}`} style={{ animationDelay: `${i * 300}ms` }}>
            <p className="font-bold">{v.players[r.seat].name}{r.seat === v.me.seat ? " (you)" : ""}</p>
            <p className="font-display text-[19px] font-black">{r.role}</p>
            <p className={`text-[12px] font-extrabold uppercase tracking-wide ${r.side === "V" ? "text-marigold-soft" : "text-crimson-soft"}`}>{sideName(r.side)}</p>
            {r.hand.some(isStoneCard) && <div className="mt-2 flex gap-1">{r.hand.filter(isStoneCard).map((c) => <CardFace key={c} c={c} size="sm" />)}</div>}
          </li>
        ))}
      </ul>
      <details className="rounded-xl bg-paper-2/70 p-3 ring-1 ring-rim">
        <summary className="min-h-11 cursor-pointer content-center font-bold">The whole story — every secret, in order</summary>
        <div className="mt-2 max-h-[50dvh] overflow-y-auto"><Story v={v} /></div>
      </details>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/" className="inline-flex min-h-12 items-center justify-center rounded-full bg-marigold px-4 text-[13px] font-extrabold uppercase tracking-wide text-card-ink">Play again</Link>
        {host ? <Btn voice="pass" onClick={download}>Game log</Btn> : <span />}
      </div>
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
    return <button onClick={voice.unlock} className="m-3 mb-0 rounded-xl bg-jade p-3 text-left font-bold text-card-ink">Tap to hear the table 🔊</button>;
  if (voice.micBlocked && voice.status === "on")
    return <p className="m-3 mb-0 rounded-xl bg-raise p-3 text-[13px] text-ink-2">Your mic is blocked, so you&rsquo;re listening only. Allow the microphone for this site, then tap the mic button.</p>;
  return null;
}
