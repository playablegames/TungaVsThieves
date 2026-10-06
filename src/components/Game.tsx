"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api, useGame, useHydrated } from "@/lib/client";
import { CARD, isStoneCard, sideName } from "@/lib/cards";
import type { Action, ActionCard, Card } from "@/engine/types";
import type { PlayerView, PublicPlayer } from "@/engine/view";
import type { ClientState } from "@/server/game";
import type { ChatMessage } from "@/server/store";
import { useStage } from "@/lib/stage";
import { LastPlay, Stage } from "./Stage";

const TARGETED: ActionCard[] = ["KUNDLI", "TALASHI", "HERA_PHERI", "TEER_KAMAN", "MAYA_JAAL"];

export default function Game({ code }: { code: string }) {
  const g = useGame(code);
  if (!g.hydrated) return <Shell><p className="text-center text-stone-400">Connecting…</p></Shell>;
  if (g.token === null)
    return (
      <Shell>
        <p className="text-center">You are not in room <b>{code}</b> on this phone.</p>
        <Link href="/" className="block rounded-lg bg-amber-500 py-3 text-center font-bold text-stone-950">Join from the home page</Link>
      </Shell>
    );
  if (!g.state) return <Shell><p className="text-center text-stone-400">{g.error ?? "Connecting…"}</p></Shell>;
  const s = g.state;
  return (
    <Shell>
      {g.error && <button onClick={() => g.setError(null)} className="w-full rounded-lg bg-red-900/70 p-2 text-sm">{g.error} ✕</button>}
      {s.status === "lobby" ? <Lobby s={s} code={code} token={g.token!} onError={g.setError} />
        : s.view && <Table s={s} v={s.view} act={g.act} now={g.now} extend={s.you.host ? g.extend : undefined} />}
      {s.view && s.status === "over" && <Final v={s.view} host={s.you.host} code={code} token={g.token!} />}
      <Chat messages={g.messages} me={s.you.seat} say={g.say} canSpeak={!s.view || s.view.me.alive || s.status === "over"} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4 pb-24">{children}</main>;
}

// ---------------------------------------------------------------- lobby
function Lobby({ s, code, token, onError }: { s: ClientState; code: string; token: string; onError: (e: string) => void }) {
  const names = s.lobby!.names;
  const bots = s.lobby!.bots;
  const row = s.lobby!.roleTable[names.length];
  const link = useHydrated() ? `${location.origin}/` : "";
  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-xl bg-stone-900 p-4 text-center">
        <p className="text-sm text-stone-400">Room code</p>
        <p className="text-5xl font-black tracking-[0.3em] text-amber-400">{code}</p>
        <p className="mt-1 text-xs text-stone-500">Friends open {link || "this site"} and join with this code.</p>
      </div>
      <div className="rounded-xl bg-stone-900 p-4">
        <p className="mb-2 font-bold">{names.length} at the table</p>
        <ul className="grid grid-cols-2 gap-2">{names.map((n, i) => (
          <li key={i} className="flex items-center justify-between rounded bg-stone-800 px-3 py-2">
            <span>{n}{i === 0 ? " · host" : ""}</span>
            {s.you.host && bots[i] && (
              <button aria-label={`Remove ${n}`} onClick={() => api.removeBot(code, token, i).catch((e) => onError(e.message))}
                className="px-1 text-stone-400 hover:text-red-400">✕</button>
            )}
          </li>
        ))}</ul>
        <p className="mt-3 text-sm text-stone-400">
          {row ? `${names.length} players: ${row[0]} Tunga · ${row[1]} Thieves · ${row[2]} rounds` : "Tunga needs 4 to 30 players."}
        </p>
      </div>
      {s.you.host && names.length < 30 && (
        <button onClick={() => api.addBot(code, token).catch((e) => onError(e.message))}
          className="rounded-lg border border-stone-600 py-2 font-bold text-stone-200">+ Add a bot 🤖</button>
      )}
      {s.you.host ? (
        <button disabled={!row} onClick={() => api.start(code, token).catch((e) => onError(e.message))}
          className="rounded-lg bg-amber-500 py-3 text-lg font-bold text-stone-950 disabled:opacity-40">Deal the roles</button>
      ) : <p className="text-center text-stone-400">Waiting for {names[0]} to start…</p>}
    </section>
  );
}

// ---------------------------------------------------------------- table
function Table({ s, v, act, now, extend }: { s: ClientState; v: PlayerView; act: (a: Action) => void; now: () => number; extend?: () => void }) {
  const name = (seat: number) => v.players[seat]?.name ?? "?";
  const turnName = name(v.turnSeat);
  const stage = useStage(v.events, v.players.map((p) => p.name));
  const myMove = v.decision?.kind ?? null;
  // your move: a short buzz and a tab-title flag, so a phone face-down on the table still tells you
  useEffect(() => {
    if (!myMove) return;
    navigator.vibrate?.(60);
    const was = document.title;
    document.title = "● Your move — Tunga vs Thieves";
    return () => { document.title = was; };
  }, [myMove]);
  return (
    <section className="flex flex-col gap-4">
      <Stage stage={stage} skip={stage.skip} />
      <div className="flex items-center justify-between text-sm">
        <span className="rounded bg-stone-800 px-2 py-1">Round {v.round}/{v.rounds}</span>
        <Phase v={v} turnName={turnName} />
        <Timer deadline={s.deadline} now={now} />
      </div>

      <div className={`rounded-xl p-4 ${v.me.side === "V" ? "bg-emerald-950 ring-1 ring-emerald-700" : "bg-red-950 ring-1 ring-red-800"}`}>
        <p className="text-xs uppercase tracking-widest text-stone-400">Your role · keep it secret</p>
        <p className="text-2xl font-black">{v.me.role}</p>
        <p className="text-sm">{sideName(v.me.side)} — {v.me.side === "V" ? "get BOTH Stones into villager hands." : "have ONE Stone in a thief's hand at the end."}</p>
        <p className="mt-1 text-xs text-stone-400">{v.me.alive ? `${v.me.votes} vote${v.me.votes === 1 ? "" : "s"}` : "You are out — stay silent, the app passes the pile for you."}</p>
      </div>

      <LastPlay last={stage.last} />
      <Players players={v.players} turn={v.turnSeat} waiting={v.waitingOn} me={v.me.seat} />
      <Hand cards={v.me.hand} />
      {v.decision && <Decide v={v} act={act} extend={extend} />}
      {!v.decision && v.phase !== "over" && (
        <p className="rounded-lg bg-stone-900 p-3 text-center text-sm text-stone-400">
          Waiting for {v.waitingOn.map(name).join(", ") || "…"}
        </p>
      )}
      <Log v={v} />
    </section>
  );
}

function Phase({ v, turnName }: { v: PlayerView; turnName: string }) {
  const p = v.phase;
  const label = p.startsWith("turn") ? `${turnName}'s turn` : p === "faisla_debate" ? "Faisla — open floor" : p === "final_debate" ? "Last debate"
    : p === "faisla_vote" ? "Faisla vote" : p === "final_vote" ? "MANDATORY VOTE"
    : p === "batwara" ? "Bhukamp" : p.startsWith("elim") ? "Elimination" : p === "over" ? "Game over" : p;
  return <span className="font-bold text-amber-400">{label}</span>;
}

function Timer({ deadline, now }: { deadline: number | null; now: () => number }) {
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force((x) => x + 1), 500); return () => clearInterval(t); }, []);
  if (!deadline) return <span />;
  const secs = Math.max(0, Math.ceil((deadline - now()) / 1000));
  return <span className={`rounded px-2 py-1 font-mono ${secs <= 10 ? "bg-red-800" : "bg-stone-800"}`}>{secs}s</span>;
}

function Players({ players, turn, waiting, me }: { players: PublicPlayer[]; turn: number; waiting: number[]; me: number }) {
  return (
    <ul className="grid grid-cols-2 gap-2 text-sm">
      {players.map((p) => (
        <li key={p.seat} className={`rounded-lg px-3 py-2 ${p.alive ? "bg-stone-900" : "bg-stone-900/40 text-stone-500 line-through"} ${p.seat === turn ? "ring-1 ring-amber-500" : ""}`}>
          <div className="flex justify-between">
            <span className="font-semibold">{p.name}{p.seat === me ? " (you)" : ""}</span>
            {waiting.includes(p.seat) && <span className="text-amber-400">…</span>}
          </div>
          <div className="text-xs text-stone-400">
            {p.handSize} cards · {p.votes} vote{p.votes === 1 ? "" : "s"}{p.revealedRole ? ` · was ${p.revealedRole}` : ""}
          </div>
        </li>
      ))}
    </ul>
  );
}

function CardChip({ c, selected, onClick, dim }: { c: Card; selected?: boolean; onClick?: () => void; dim?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} title={CARD[c].text}
      className={`rounded-lg px-3 py-2 text-sm font-bold ${CARD[c].tone} ${selected ? "ring-4 ring-amber-400" : ""} ${dim ? "opacity-30" : ""}`}>
      {CARD[c].name}
    </button>
  );
}

function Hand({ cards }: { cards: Card[] }) {
  return (
    <div className="rounded-xl bg-stone-900 p-3">
      <p className="mb-2 text-xs uppercase tracking-widest text-stone-400">Your hand ({cards.length})</p>
      <div className="flex flex-wrap gap-2">{cards.map((c, i) => <CardChip key={i} c={c} />)}</div>
    </div>
  );
}

// ---------------------------------------------------------------- decisions
function Decide({ v, act, extend }: { v: PlayerView; act: (a: Action) => void; extend?: () => void }) {
  const d = v.decision!;
  const living = v.players.filter((p) => p.alive);
  const others = living.filter((p) => p.seat !== v.me.seat);
  switch (d.kind) {
    case "turn": return <TurnDecision v={v} playable={d.playable as ActionCard[]} passSize={d.passSize} act={act} />;
    case "debate": {
      const ready = d.ready.length, total = living.length;
      return (
        <Box title={d.reason === "final" ? "Last debate — talk before the mandatory vote" : "Faisla — the floor is open"}
          hint="Accuse, defend, claim a Stone, call a bluff — on your call or in the chat. The vote opens when everyone is ready, or when time runs out.">
          <p className="text-sm text-stone-300">{ready} of {total} ready to vote</p>
          <button onClick={() => act({ type: "ready" })} className="rounded-lg bg-amber-500 py-3 text-lg font-bold text-stone-950">I&rsquo;m ready to vote</button>
          {extend && <button onClick={extend} className="rounded-lg border border-stone-600 py-2 text-sm">+30 seconds (host, once)</button>}
        </Box>
      );
    }
    case "vote": return (
      <Pick title={d.reason === "final" ? "MANDATORY VOTE — who is out?" : "Faisla — who is out?"} hint="All your votes go on one player. A tie does nothing."
        options={living} onPick={(seat) => act({ type: "vote", target: seat })} extra={{ label: "Abstain", onClick: () => act({ type: "vote", target: null }) }} />
    );
    case "batwara": return <BatwaraDecision v={v} act={act} />;
    case "dal_badal": return <TwoPlayers title="DAL BADAL — swap the roles of two living players" options={others} onDone={(a, b) => act({ type: "dal_badal", a, b })} />;
    case "gift": return (
      <Pick title="Dying power — give 1 vote" hint="They vote with one more from now on." options={others}
        onPick={(seat) => act({ type: "gift", target: seat })} extra={{ label: "Give it to nobody", onClick: () => act({ type: "gift", target: null }) }} />
    );
    case "shot": return <ShotDecision v={v} options={others} act={act} title="Dying power — LAST SHOT" allowSkip />;
    case "handoff": return (
      <Pick title="Hand ALL your cards to a living player" hint="Stones included. Everyone sees what you hand over." options={others}
        onPick={(seat) => act({ type: "handoff", target: seat })} />
    );
  }
}

function Box({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-amber-950/60 p-4 ring-1 ring-amber-600">
      <div><p className="font-bold text-amber-300">{title}</p>{hint && <p className="text-xs text-stone-400">{hint}</p>}</div>
      {children}
    </div>
  );
}

function Pick({ title, hint, options, onPick, extra }: {
  title: string; hint?: string; options: PublicPlayer[]; onPick: (seat: number) => void; extra?: { label: string; onClick: () => void };
}) {
  return (
    <Box title={title} hint={hint}>
      <div className="grid grid-cols-2 gap-2">
        {options.map((p) => <button key={p.seat} onClick={() => onPick(p.seat)} className="rounded-lg bg-stone-800 py-2">{p.name}</button>)}
      </div>
      {extra && <button onClick={extra.onClick} className="rounded-lg bg-stone-700 py-2 text-sm">{extra.label}</button>}
    </Box>
  );
}

function TwoPlayers({ title, options, onDone }: { title: string; options: PublicPlayer[]; onDone: (a: number, b: number) => void }) {
  const [sel, setSel] = useState<number[]>([]);
  const toggle = (s: number) => setSel((x) => (x.includes(s) ? x.filter((y) => y !== s) : x.length < 2 ? [...x, s] : x));
  return (
    <Box title={title} hint="Both look at their new role in secret. The table sees who was swapped.">
      <div className="grid grid-cols-2 gap-2">
        {options.map((p) => <button key={p.seat} onClick={() => toggle(p.seat)} className={`rounded-lg py-2 ${sel.includes(p.seat) ? "bg-amber-600" : "bg-stone-800"}`}>{p.name}</button>)}
      </div>
      <button disabled={sel.length !== 2} onClick={() => onDone(sel[0], sel[1])} className="rounded-lg bg-amber-500 py-2 font-bold text-stone-950 disabled:opacity-40">Swap</button>
    </Box>
  );
}

function RolePicker({ roles, sel, setSel }: { roles: string[]; sel: string[]; setSel: (r: string[]) => void }) {
  const toggle = (r: string) => setSel(sel.includes(r) ? sel.filter((x) => x !== r) : sel.length < 2 ? [...sel, r] : sel);
  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((r) => <button key={r} onClick={() => toggle(r)} className={`rounded-full px-3 py-1 text-sm ${sel.includes(r) ? "bg-red-600" : "bg-stone-800"}`}>{r}</button>)}
    </div>
  );
}

function ShotDecision({ v, options, act, title, allowSkip }: { v: PlayerView; options: PublicPlayer[]; act: (a: Action) => void; title: string; allowSkip?: boolean }) {
  const [target, setTarget] = useState<number | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  return (
    <Box title={title} hint="Point at one player and name TWO roles out loud. Either is theirs: they are out.">
      <div className="grid grid-cols-2 gap-2">
        {options.map((p) => <button key={p.seat} onClick={() => setTarget(p.seat)} className={`rounded-lg py-2 ${target === p.seat ? "bg-amber-600" : "bg-stone-800"}`}>{p.name}</button>)}
      </div>
      <RolePicker roles={v.rolesInPlay} sel={roles} setSel={setRoles} />
      <button disabled={target === null || roles.length !== 2}
        onClick={() => act({ type: "shot", target, roles: roles as [string, string] })}
        className="rounded-lg bg-red-600 py-2 font-bold disabled:opacity-40">Shoot</button>
      {allowSkip && <button onClick={() => act({ type: "shot", target: null })} className="rounded-lg bg-stone-700 py-2 text-sm">No last shot</button>}
    </Box>
  );
}

function TurnDecision({ v, playable, passSize, act }: { v: PlayerView; playable: ActionCard[]; passSize: number; act: (a: Action) => void }) {
  const [card, setCard] = useState<ActionCard | "NONE" | null>(null);
  const [pass, setPass] = useState<number[]>([]);
  const [target, setTarget] = useState<number | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const hand = v.me.hand;

  // indices of the pair being played (first two copies)
  const pairIdx = useMemo(() => {
    if (!card || card === "NONE") return [] as number[];
    return hand.map((c, i) => (c === card ? i : -1)).filter((i) => i >= 0).slice(0, 2);
  }, [card, hand]);

  const reset = () => { setCard(null); setPass([]); setTarget(null); setRoles([]); };
  const togglePass = (i: number) => setPass((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < passSize ? [...p, i] : p));
  const others = v.players.filter((p) => p.alive && p.seat !== v.me.seat);
  const targets = card === "MAYA_JAAL" ? v.players.filter((p) => !p.alive)
    : card === "HERA_PHERI" ? others.filter((p) => p.handSize > 0) : others;
  const needsTarget = card && card !== "NONE" && TARGETED.includes(card);
  const ready = card && pass.length === passSize && (!needsTarget || target !== null) && (card !== "TEER_KAMAN" || roles.length === 2);

  function submit() {
    const cards = pass.map((i) => hand[i]);
    if (card === "NONE") act({ type: "pass", pass: cards });
    else act({ type: "play", card: card as ActionCard, pass: cards, target: target ?? undefined, roles: card === "TEER_KAMAN" ? (roles as [string, string]) : undefined });
    reset();
  }

  if (!card) {
    return (
      <Box title="Your turn" hint={playable.length ? "Play a pair (you pass 3 other cards first — a Stone can go too), or play nothing and pass 3." : "No pair you can play — pass 3."}>
        <div className="flex flex-wrap gap-2">
          {playable.map((c) => <CardChip key={c} c={c} onClick={() => setCard(c)} />)}
        </div>
        <button onClick={() => setCard("NONE")} className="rounded-lg bg-stone-700 py-2">Play nothing — pass 3</button>
      </Box>
    );
  }
  return (
    <Box title={card === "NONE" ? "Pass 3 cards" : `${CARD[card].name}: pass 3 other cards first`} hint={card === "NONE" ? "A Stone can be passed — whoever is next picks it up." : `${CARD[card].text} A Stone you pass goes to the next player.`}>
      <div className="flex flex-wrap gap-2">
        {hand.map((c, i) => {
          const locked = pairIdx.includes(i);
          return <CardChip key={i} c={c} dim={locked} selected={pass.includes(i)} onClick={locked ? undefined : () => togglePass(i)} />;
        })}
      </div>
      <p className="text-xs text-stone-400">{pass.length}/{passSize} chosen</p>
      {needsTarget && (
        <div className="grid grid-cols-2 gap-2">
          {targets.map((p) => <button key={p.seat} onClick={() => setTarget(p.seat)} className={`rounded-lg py-2 ${target === p.seat ? "bg-amber-600" : "bg-stone-800"}`}>{p.name}</button>)}
        </div>
      )}
      {card === "TEER_KAMAN" && <RolePicker roles={v.rolesInPlay} sel={roles} setSel={setRoles} />}
      <div className="flex gap-2">
        <button onClick={reset} className="flex-1 rounded-lg bg-stone-700 py-2">Back</button>
        <button disabled={!ready} onClick={submit} className="flex-1 rounded-lg bg-amber-500 py-2 font-bold text-stone-950 disabled:opacity-40">Confirm</button>
      </div>
    </Box>
  );
}

function BatwaraDecision({ v, act }: { v: PlayerView; act: (a: Action) => void }) {
  const [left, setLeft] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);
  const living = v.players.filter((p) => p.alive).map((p) => p.seat);
  const i = living.indexOf(v.me.seat);
  const L = v.players[living[(i - 1 + living.length) % living.length]].name;
  const R = v.players[living[(i + 1) % living.length]].name;
  const tap = (k: number) => {
    if (left === k) return setLeft(null);
    if (right === k) return setRight(null);
    if (left === null) setLeft(k); else if (right === null) setRight(k);
  };
  return (
    <Box title="BHUKAMP — pass 1 card left and 1 card right" hint={`First tap goes LEFT to ${L}, second goes RIGHT to ${R}. Stones may move.`}>
      <div className="flex flex-wrap gap-2">
        {v.me.hand.map((c, k) => <CardChip key={k} c={c} selected={k === left || k === right} onClick={() => tap(k)} />)}
      </div>
      <p className="text-xs text-stone-400">Left: {left !== null ? CARD[v.me.hand[left]].name : "—"} · Right: {right !== null ? CARD[v.me.hand[right]].name : "—"}</p>
      <button disabled={left === null || right === null} onClick={() => act({ type: "batwara", left: v.me.hand[left!], right: v.me.hand[right!] })}
        className="rounded-lg bg-amber-500 py-2 font-bold text-stone-950 disabled:opacity-40">Pass</button>
    </Box>
  );
}

// ---------------------------------------------------------------- log, chat, end
function Log({ v }: { v: PlayerView }) {
  const items = [...v.events].reverse().slice(0, 60);
  return (
    <div className="rounded-xl bg-stone-900 p-3">
      <p className="mb-2 text-xs uppercase tracking-widest text-stone-400">What happened</p>
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto text-sm">
        {items.map((e) => (
          <li key={e.n} className={e.to === "all" ? "text-stone-300" : "rounded bg-indigo-950 px-2 py-1 text-indigo-200"}>
            {e.to === "all" ? "" : "🔒 "}{e.msg}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Chat({ messages, me, say, canSpeak }: { messages: ChatMessage[]; me: number; say: (t: string) => void; canSpeak: boolean }) {
  const [text, setText] = useState("");
  return (
    <div className="rounded-xl bg-stone-900 p-3">
      <p className="mb-2 text-xs uppercase tracking-widest text-stone-400">Table talk</p>
      <ul className="mb-2 flex max-h-60 flex-col gap-1 overflow-y-auto text-sm">
        {messages.map((m) => <li key={m.id}><b className={m.seat === me ? "text-amber-400" : ""}>{m.name}:</b> {m.text}</li>)}
      </ul>
      {canSpeak ? (
        <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) { say(text); setText(""); } }} className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Claim, deny, accuse…"
            className="flex-1 rounded-lg bg-stone-800 px-3 py-2 outline-none" />
          <button className="rounded-lg bg-stone-200 px-4 font-bold text-stone-950">Say</button>
        </form>
      ) : <p className="text-center text-xs text-stone-500">You are out — eliminated players stay silent.</p>}
    </div>
  );
}

function Final({ v, host, code, token }: { v: PlayerView; host: boolean; code: string; token: string }) {
  async function download() {
    const data = await api.log(code, token);
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tunga-${code}.json`;
    a.click();
  }
  return (
    <div className={`rounded-xl p-4 ${v.winner === "V" ? "bg-emerald-900" : "bg-red-900"}`}>
      <p className="text-3xl font-black">{v.winner === "V" ? "TUNGA WINS" : "THIEVES WIN"}</p>
      <p className="mb-3 text-sm">{v.overReason}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {v.finalReveal!.map((r) => (
          <li key={r.seat} className="flex flex-wrap items-center gap-1">
            <b>{v.players[r.seat].name}</b> — {r.role} ({sideName(r.side)}) {r.hand.filter(isStoneCard).map((c) => <span key={c} className={`rounded px-1 ${CARD[c].tone}`}>{CARD[c].name}</span>)}
          </li>
        ))}
      </ul>
      {host && <button onClick={download} className="mt-3 w-full rounded-lg bg-stone-200 py-2 font-bold text-stone-950">Download game log (for analysis)</button>}
      <Link href="/" className="mt-2 block text-center text-sm underline">New game</Link>
    </div>
  );
}
