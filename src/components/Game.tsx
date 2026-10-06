"use client";
/* Hallmark · genre: atmospheric · macrostructure: Workbench (app, portrait spotlight) · design-system: DESIGN.md · designed-as-app */
// The table, phone-first and portrait: a status line everyone reads the same way (BGA's "${actplayer} must…"),
// a seat strip where the spotlight glows, the table centre, and a dock with your role, your hand and your move.
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, useGame, useHydrated } from "@/lib/client";
import { isStoneCard, sideName } from "@/lib/cards";
import type { Action } from "@/engine/types";
import type { PlayerView, PublicPlayer } from "@/engine/view";
import type { ClientState } from "@/server/game";
import type { ChatMessage } from "@/server/store";
import { useStage } from "@/lib/stage";
import { Stage } from "./Stage";
import { Decide, QUICK_CLAIMS } from "./Decide";
import { Btn, CardBack, CardFace, Sheet, TimerRing } from "./ui";

export default function Game({ code }: { code: string }) {
  const g = useGame(code);
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      {s.you.away && s.status === "playing" && (
        <button onClick={g.reclaim} className="m-3 mb-0 rounded-xl bg-marigold p-3 text-left font-bold text-card-ink">
          A stand-in is playing safe for you. Tap — I&rsquo;m back.
        </button>
      )}
      {g.error && <button onClick={() => g.setError(null)} className="m-3 mb-0 rounded-xl bg-crimson-deep p-3 text-left text-[14px]">{g.error} — tap to dismiss</button>}
      {s.status === "lobby"
        ? <Lobby s={s} code={code} token={g.token!} onError={g.setError} />
        : s.view && <Table s={s} v={s.view} act={g.act} say={g.say} now={g.now} messages={g.messages} extend={s.you.host ? g.extend : undefined} code={code} token={g.token!} />}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto grid min-h-dvh max-w-md place-items-center p-6 text-center text-ink-2"><div>{children}</div></main>;
}

// ---------------------------------------------------------------- lobby
function Lobby({ s, code, token, onError }: { s: ClientState; code: string; token: string; onError: (e: string) => void }) {
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
        <p className="mt-3 text-[13px] leading-snug text-ink-2">Playing apart? Start a WhatsApp group call and keep this tab open — your phone buzzes when it&rsquo;s your move.</p>
      </div>

      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold">{names.length} at the table</h2>
          <span className="text-[13px] text-ink-2">{row ? `${row[0]} Tunga · ${row[1]} Thieves · ${row[2]} rounds` : "4–30 players"}</span>
        </div>
        <ul className="flex flex-col gap-2">{names.map((n, i) => (
          <li key={i} className="flex min-h-12 items-center gap-3 rounded-xl bg-paper-2/70 px-3 ring-1 ring-rim">
            <span className={`grid h-8 w-8 place-items-center rounded-full text-[13px] font-extrabold ${i === 0 ? "bg-marigold text-card-ink" : "bg-raise-2"}`}>{n.slice(0, 1)}</span>
            <span className="font-bold">{n}</span>
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

function Table({ s, v, act, say, now, messages, extend, code, token }: {
  s: ClientState; v: PlayerView; act: (a: Action) => void; say: (t: string) => void; now: () => number;
  messages: ChatMessage[]; extend?: () => void; code: string; token: string;
}) {
  const stage = useStage(v.events, v.players.map((p) => p.name));
  const [talk, setTalk] = useState(false);
  const [story, setStory] = useState(false);
  const [seen, setSeen] = useState(0);
  const myMove = v.decision?.kind ?? null;
  // your move: a short buzz and a tab-title flag, so a phone face-down on the table (or on a call) still tells you
  useEffect(() => {
    if (!myMove) return;
    navigator.vibrate?.(60);
    const was = document.title;
    document.title = "● Your move — Tunga vs Thieves";
    return () => { document.title = was; };
  }, [myMove]);
  const over = s.status === "over";
  const unread = Math.max(0, messages.length - seen);
  const canSpeak = v.me.alive || over;

  return (
    <div className="flex min-h-dvh flex-col">
      <Stage stage={stage} skip={stage.skip} />

      {/* the status line — the same sentence on every phone, worded for you when it's yours */}
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-rim bg-paper/90 px-4 py-2 backdrop-blur">
        <span className="rounded-full bg-raise px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-ink-2">R{v.round}/{v.rounds}</span>
        <p className={`min-w-0 flex-1 truncate text-[15px] font-bold ${v.decision ? "text-jade-soft" : "text-ink"}`}>{status(v)}</p>
        {!over && <TimerRing deadline={s.deadline} now={now} />}
      </header>

      {over && <Final v={v} host={s.you.host} code={code} token={token} />}

      {/* seats — the spotlight glows on whoever the table is waiting for */}
      <Seats v={v} />

      {/* the table centre */}
      {!over && (
        <section className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="relative h-[78px] w-[86px]" aria-label={`Procession pile: ${v.pileSize} cards face down`}>
              {Array.from({ length: Math.max(v.pileSize, 1) }).map((_, i) => (
                <div key={i} className="absolute top-0" style={{ left: i * 14, transform: `rotate(${(i - 1) * 5}deg)` }}>
                  <CardBack size="sm" className={v.pileSize ? "" : "opacity-30"} />
                </div>
              ))}
            </div>
            <div className="text-[13px] leading-snug text-ink-2">
              <p className="font-bold text-ink">Procession pile</p>
              <p>{v.pileSize} face down · deck {v.deckSize}</p>
            </div>
          </div>
          {stage.last && (
            <div className="w-full rounded-xl border border-rim bg-paper-2/70 px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">Last play</p>
              <p className="font-display text-[18px] font-bold leading-snug">{stage.last.title}</p>
              {stage.last.detail && <p className="text-[14px] text-ink-2">{stage.last.detail}</p>}
            </div>
          )}
        </section>
      )}

      {/* the dock — your role, your hand, your move */}
      {!over && (
        <section className="sticky bottom-0 z-10 flex flex-col gap-3 rounded-t-2xl border-t border-rim bg-paper-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <RolePeek v={v} />
            <button onClick={() => { setTalk(true); setSeen(messages.length); }} className="relative ml-auto min-h-11 rounded-full bg-raise px-4 text-[13px] font-extrabold uppercase tracking-wide">
              Talk{unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-marigold px-1 text-[11px] text-card-ink">{unread}</span>}
            </button>
            <button onClick={() => setStory(true)} className="min-h-11 rounded-full bg-raise px-4 text-[13px] font-extrabold uppercase tracking-wide">Story</button>
          </div>
          {!v.me.alive ? (
            <p className="text-[14px] text-ink-2">You&rsquo;re out. Watch closely — and stay silent; the pile passes through you on its own.</p>
          ) : v.decision ? (
            <Decide key={v.phase} v={v} act={act} say={say} extend={extend} />
          ) : (
            <div>
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">Your hand · {v.me.hand.length}</p>
              <div className="flex flex-wrap gap-2">{v.me.hand.map((c, i) => <CardFace key={i} c={c} size="sm" />)}</div>
            </div>
          )}
        </section>
      )}

      <Sheet open={talk} onClose={() => { setTalk(false); setSeen(messages.length); }} title="Table talk">
        <Talk messages={messages} me={v.me.seat} say={say} canSpeak={canSpeak} />
      </Sheet>
      <Sheet open={story} onClose={() => setStory(false)} title="The story so far">
        <Story v={v} />
      </Sheet>
    </div>
  );
}

function Seats({ v }: { v: PlayerView }) {
  return (
    <ul className="grid max-h-[25dvh] grid-cols-5 gap-x-1 gap-y-2 overflow-y-auto px-3 py-3" aria-label="Players">
      {v.players.map((p) => <Seat key={p.seat} p={p} me={p.seat === v.me.seat} spot={v.waitingOn.includes(p.seat)} />)}
    </ul>
  );
}

function Seat({ p, me, spot }: { p: PublicPlayer; me: boolean; spot: boolean }) {
  return (
    <li className={`flex flex-col items-center gap-1 text-center ${p.alive ? "" : "opacity-45"}`} aria-label={`${p.name}${me ? " (you)" : ""}: ${p.handSize} cards, ${p.votes} votes${p.alive ? "" : `, out — was ${p.revealedRole}`}${spot ? ", deciding" : ""}`}>
      <span className={`relative grid h-11 w-11 place-items-center rounded-full font-display text-[17px] font-black ${me ? "bg-marigold text-card-ink" : "bg-raise-2"} ${spot ? "spotlight" : ""}`}>
        {p.name.slice(0, 1)}
        <span className="absolute -bottom-1 -right-1 rounded-full bg-paper px-1 text-[10px] font-extrabold tabular-nums text-ink-2 ring-1 ring-raise-2">{p.handSize}</span>
      </span>
      <span className="w-full truncate text-[12px] font-bold leading-tight">{me ? "You" : p.name}</span>
      <span className="flex h-2 gap-0.5" aria-hidden>{Array.from({ length: p.votes }).map((_, i) => <span key={i} className="h-2 w-2 rounded-full bg-marigold" />)}</span>
      {!p.alive && p.revealedRole && <span className="text-[10px] leading-tight text-crimson-soft">{p.revealedRole}</span>}
    </li>
  );
}

/** Your role stays face down. Hold to see it — so a phone on the table never gives you away. */
function RolePeek({ v }: { v: PlayerView }) {
  const [open, setOpen] = useState(false);
  const show = () => setOpen(true), hide = () => setOpen(false);
  return (
    <button type="button" onPointerDown={show} onPointerUp={hide} onPointerLeave={hide} onPointerCancel={hide}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") show(); }} onKeyUp={hide} onContextMenu={(e) => e.preventDefault()}
      aria-label="Hold to see your role"
      className={`flex min-h-11 select-none items-center gap-2 rounded-full px-4 text-left [-webkit-touch-callout:none] ${open ? (v.me.side === "V" ? "bg-marigold text-card-ink" : "bg-crimson text-ink") : "bg-raise text-ink"}`}>
      {open ? (
        <span className="text-[14px] font-extrabold">{v.me.role} · {sideName(v.me.side)} · {v.me.votes} vote{v.me.votes === 1 ? "" : "s"}</span>
      ) : (
        <span className="text-[13px] font-extrabold uppercase tracking-wide">Hold — your role</span>
      )}
    </button>
  );
}

function Talk({ messages, me, say, canSpeak }: { messages: ChatMessage[]; me: number; say: (t: string) => void; canSpeak: boolean }) {
  const [text, setText] = useState("");
  return (
    <>
      <ul className="flex min-h-24 flex-col gap-1.5 overflow-y-auto text-[15px]">
        {messages.length === 0 && <li className="text-ink-2">Nothing said yet. On a call? Talk there — this is for claims you want on the record.</li>}
        {messages.map((m) => <li key={m.id}><b className={m.seat === me ? "text-marigold-soft" : ""}>{m.name}:</b> {m.text}</li>)}
      </ul>
      {canSpeak ? (
        <>
          <div className="flex flex-wrap gap-2">
            {QUICK_CLAIMS.map((q) => <button key={q} type="button" onClick={() => say(q)} className="min-h-11 rounded-full bg-raise px-4 text-[14px] font-bold">{q}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { say(text); setText(""); } }} className="flex gap-2">
            <label htmlFor="say" className="sr-only">Say something</label>
            <input id="say" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Claim, deny, accuse…"
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-gold bg-field px-4 text-[15px] text-ink caret-jade outline-none placeholder:text-muted" />
            <Btn voice="vote" type="submit">Say</Btn>
          </form>
        </>
      ) : <p className="text-[14px] text-ink-2">You&rsquo;re out — eliminated players stay silent.</p>}
    </>
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
