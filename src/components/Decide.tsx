"use client";
// The action dock: what YOU can do right now, one step at a time. Irreversible moves go through a 5-second
// timed confirm instead of undo (BGA: undo is impossible once hidden information is out).
import { useMemo, useState } from "react";
import { ACTION_CARDS, type Action, type ActionCard, type Card } from "@/engine/types";
import type { PlayerView, PublicPlayer } from "@/engine/view";
import { CARD } from "@/lib/cards";
import type { Voice } from "@/lib/cards";

/** buttons in the table's brass style (screen check 2026-10-07): "ghost" is the quiet one, everything else the rust pill */
function Btn({ voice = "pass", className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { voice?: Voice | "pass" | "ghost" }) {
  const look = voice === "ghost" || voice === "pass"
    ? "border-2 border-brass/60 bg-black/30 text-stock"
    : "border-2 border-brass/80 bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] text-stock";
  return <button type="button" {...p} className={`inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 font-[family-name:var(--font-engraved)] text-[14px] font-bold uppercase tracking-[0.08em] active:translate-y-px disabled:opacity-40 ${look} ${className}`} />;
}
import { HandRow } from "./Hand";
import { CardIcon } from "./CardIcon";

const TARGETED: ActionCard[] = ["KUNDLI", "TALASHI", "HERA_PHERI", "TEER_KAMAN"];

type Ask = (label: string, action: Action) => void;

/** one short title per step — no descriptions (designer: "too much text") */
function Head({ title }: { title: string; hint?: string }) {
  return <h2 className="font-display text-[20px] font-bold leading-tight text-stock">{title}</h2>;
}

export function PlayerChip({ p, selected, onClick, me }: { p: PublicPlayer; selected?: boolean; onClick?: () => void; me?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`flex min-h-12 items-center gap-2 rounded-xl border-2 py-1.5 pl-1.5 pr-3 text-left text-[14px] font-semibold active:translate-y-px ${selected ? "border-[#f0a32e] bg-[#3a240c] text-[#f3c66b] shadow-[0_0_12px_2px_rgba(240,163,46,.3)]" : "border-brass/35 bg-black/30 text-stock"}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#2a1a0c] text-[13px] font-bold text-stock ring-1 ring-brass/50">{p.name.slice(0, 1)}</span>
      <span className="truncate">{p.name}{me ? " (you)" : ""}</span>
    </button>
  );
}

function Pickers({ options, sel, onPick }: { options: PublicPlayer[]; sel: number | null; onPick: (s: number) => void }) {
  return <div className="grid grid-cols-2 gap-2">{options.map((p) => <PlayerChip key={p.seat} p={p} selected={sel === p.seat} onClick={() => onPick(p.seat)} />)}</div>;
}

function RolePicker({ roles, sel, setSel }: { roles: string[]; sel: string[]; setSel: (r: string[]) => void }) {
  const toggle = (r: string) => setSel(sel.includes(r) ? sel.filter((x) => x !== r) : sel.length < 2 ? [...sel, r] : sel);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Name two roles">
      {roles.map((r) => (
        <button key={r} type="button" onClick={() => toggle(r)} aria-pressed={sel.includes(r)}
          className={`min-h-11 rounded-full border-2 px-4 text-[14px] font-semibold ${sel.includes(r) ? "border-crimson bg-crimson-deep text-ink" : "border-brass/35 bg-black/30 text-stock"}`}>{r}</button>
      ))}
    </div>
  );
}

/** The tray: your move when it needs your cards or a pick. Debate and voting happen on the centre stage. */
export function Decide({ v, act }: { v: PlayerView; act: (a: Action) => void }) {
  const c: { ask: Ask } = { ask: (_label, action) => act(action) };
  const d = v.decision!;
  const living = v.players.filter((p) => p.alive);
  const others = living.filter((p) => p.seat !== v.me.seat);
  const name = (s: number) => v.players[s]?.name ?? "?";
  switch (d.kind) {
    case "turn": return <Turn v={v} playable={d.playable as ActionCard[]} passSize={d.passSize} dalBadal={d.dalBadal} act={act} ask={c.ask} />;
    case "debate": case "vote": return null;
    case "batwara": return <Bhukamp v={v} act={act} />;
    case "surrender": return <Surrender stones={d.stones as Card[]} act={act} />;
    case "dal_pick": return <DalPick count={d.count} act={act} />;
    case "gift": return <OneOf title="Give your vote" hint="They vote with one more from now on." options={others}
      go={(s) => c.ask(`Give your vote to ${name(s)}`, { type: "gift", target: s })} skip={{ label: "Give it to nobody", action: { type: "gift", target: null } }} act={act} />;
    case "handoff": return <OneOf title="Hand ALL your cards to someone" hint="Stones included. Everyone sees what you hand over." options={others}
      go={(s) => c.ask(`Hand everything to ${name(s)}`, { type: "handoff", target: s })} act={act} />;
  }
}

function OneOf({ title, hint, options, go, skip, act }: { title: string; hint: string; options: PublicPlayer[]; go: (s: number) => void; skip?: { label: string; action: Action }; act: (a: Action) => void }) {
  const [sel, setSel] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <Head title={title} hint={hint} />
      <Pickers options={options} sel={sel} onPick={(x) => { setSel(x); go(x); }} />
      {skip && <Btn voice="ghost" onClick={() => act(skip.action)}>{skip.label}</Btn>}
    </div>
  );
}

/** your turn to draw a role back from the Dal Badal shuffle: the cards lie face down — any one */
function DalPick({ count, act }: { count: number; act: (a: Action) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Head title="Dal Badal — pick a role card" hint="Your role card went into a shuffle. Take one back, face down. It could be your own." />
      <div className="flex justify-center gap-3 py-2">
        {Array.from({ length: count }, (_, i) => (
          <button key={i} type="button" onClick={() => act({ type: "dal_pick", index: i })} aria-label={`Face-down role card ${i + 1}`}
            className="aspect-[5/8] w-20 rounded-lg border-2 border-[#b8863b] bg-[repeating-linear-gradient(45deg,#2a1a0c_0_6px,#3a240c_6px_12px)] shadow-[0_8px_18px_-6px_rgba(0,0,0,.9)] active:translate-y-px" />
        ))}
      </div>
    </div>
  );
}

/** SURRENDER: give your Stone(s) to the village, or keep it — everyone holding one decides at the same moment */
function Surrender({ stones, act }: { stones: Card[]; act: (a: Action) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <Head title={stones.length > 1 ? "Surrender your Stones to the village?" : "Surrender your Stone to the village?"} />
      <div className="flex justify-center gap-3 py-1">
        {stones.map((c) => <CardIcon key={c} c={c} className="w-14 drop-shadow-[0_0_12px_rgba(240,163,46,.45)]" />)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Btn voice="ghost" onClick={() => act({ type: "surrender", give: false })}>Keep it</Btn>
        <Btn voice="vote" onClick={() => act({ type: "surrender", give: true })}>Surrender</Btn>
      </div>
    </div>
  );
}

/** BHUKAMP (2026-10-09): everyone passes 1 card to the next player clockwise — one tap passes it */
function Bhukamp({ v, act }: { v: PlayerView; act: (a: Action) => void }) {
  const living = v.players.filter((p) => p.alive).map((p) => p.seat);
  const i = living.indexOf(v.me.seat);
  const next = v.players[living[(i + 1) % living.length]].name;
  return (
    <div className="flex flex-col gap-3">
      <Head title={`Bhukamp — 1 card to ${next}`} />
      <div className="pt-2">
        <HandRow cards={v.me.hand} onTap={(k) => act({ type: "batwara", card: v.me.hand[k] })} />
      </div>
    </div>
  );
}

/** why a pair in your hand can't be played right now (engine canPlay, in words) */
function whyNot(v: PlayerView, c: ActionCard, hand: Card[], passSize: number): string {
  if (hand.length - 2 < 3) return `needs ${passSize} other cards left to pass`;
  if (c === "HERA_PHERI") return "nobody has cards to steal";
  return "no one to aim it at";
}

function Turn({ v, playable, passSize, dalBadal, act, ask }: { v: PlayerView; playable: ActionCard[]; passSize: number; dalBadal: boolean; act: (a: Action) => void; ask: Ask }) {
  const [card, setCard] = useState<ActionCard | "NONE" | "DAL_BADAL" | null>(null);
  const [pass, setPass] = useState<number[]>([]);
  const [target, setTarget] = useState<number | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const hand = v.me.hand;
  // the cards that leave with the move: a pair, or the Dal Badal card itself
  const pairIdx = useMemo(() => (!card || card === "NONE" ? [] : hand.map((c, i) => (c === card ? i : -1)).filter((i) => i >= 0).slice(0, card === "DAL_BADAL" ? 1 : 2)), [card, hand]);
  const [swap, setSwap] = useState<number[]>([]);
  const reset = () => { setCard(null); setPass([]); setTarget(null); setRoles([]); setSwap([]); };
  const others = v.players.filter((p) => p.alive && p.seat !== v.me.seat);
  const targets = card === "HERA_PHERI" ? others.filter((p) => p.handSize > 0) : others;
  const needsTarget = card && card !== "NONE" && card !== "DAL_BADAL" && TARGETED.includes(card);
  /** the cards left once this pair is out — when exactly passSize remain, they go on by themselves */
  const restAfter = (c: ActionCard) => {
    const pair = hand.map((h, i) => (h === c ? i : -1)).filter((i) => i >= 0).slice(0, 2);
    return hand.map((_, i) => i).filter((i) => !pair.includes(i));
  };
  const auto = card && card !== "NONE" && card !== "DAL_BADAL" && restAfter(card).length === passSize;
  const declare = (c: ActionCard) => {
    const rest = restAfter(c);
    // nothing to choose: the pair is declared and the other cards go to the next player in the same move
    if (rest.length === passSize && !TARGETED.includes(c)) {
      ask(CARD[c].name, { type: "play", card: c, pass: rest.map((i) => hand[i]) });
      return;
    }
    setCard(c);
    if (rest.length === passSize) setPass(rest);
  };

  if (!card) {
    // your cards face up; each pair you may legally play is declared in words, beside Pass
    // the two cards of every pair you may play glow together
    const glowing = playable.flatMap((c) => hand.map((h, i) => (h === c ? i : -1)).filter((i) => i >= 0).slice(0, 2));
    const blocked = ACTION_CARDS
      .filter((c) => !playable.includes(c) && hand.filter((h) => h === c).length >= 2);
    return (
      <div className="flex flex-col gap-3">
        <HandRow cards={hand} glow={glowing} />
        <div className="flex flex-col gap-2">
          {playable.map((c) => (
            <button key={c} type="button" onClick={() => declare(c)}
              className="min-h-12 rounded-full border-2 border-brass/80 bg-[linear-gradient(180deg,var(--color-rust)_0%,var(--color-rust-deep)_100%)] font-[family-name:var(--font-engraved)] text-[16px] font-bold uppercase tracking-[0.08em] text-stock active:translate-y-px">
              Play {CARD[c].name} pair
            </button>
          ))}
          {dalBadal && (
            <button type="button" onClick={() => setCard("DAL_BADAL")}
              className="min-h-12 rounded-full border-2 border-crimson bg-crimson-deep/80 font-[family-name:var(--font-engraved)] text-[16px] font-bold uppercase tracking-[0.08em] text-stock active:translate-y-px">
              Use Dal Badal
            </button>
          )}
          <button type="button" onClick={() => setCard("NONE")}
            className="min-h-12 rounded-full border-2 border-brass/60 bg-black/30 font-[family-name:var(--font-engraved)] text-[15px] font-semibold uppercase tracking-[0.12em] text-stock active:translate-y-px">
            {playable.length ? `Or pass ${passSize}` : `Pass ${passSize} cards`}
          </button>
        </div>
        {blocked.map((c) => <p key={c} className="text-center text-[12px] text-stock/60">{CARD[c].name} ×2 — {whyNot(v, c, hand, passSize)}</p>)}
      </div>
    );
  }
  const playing = card !== "NONE";
  /** play the move the moment it is complete */
  const fire = (p: number[], t: number | null, r: string[]) => {
    if (!card || p.length !== passSize) return;
    if (card === "NONE") { act({ type: "pass", pass: p.map((i) => hand[i]) }); reset(); return; }
    if (card === "DAL_BADAL") return;
    if (needsTarget && t === null) return;
    if (card === "TEER_KAMAN" && r.length !== 2) return;
    ask(card, { type: "play", card, pass: p.map((i) => hand[i]), target: t ?? undefined, roles: card === "TEER_KAMAN" ? (r as [string, string]) : undefined });
    reset();
  };
  const ASK: Partial<Record<ActionCard, string>> = {
    TALASHI: "Search who?", KUNDLI: "Read whose role?", HERA_PHERI: "Steal from who?", TEER_KAMAN: "Shoot who? Name 2 roles",
  };
  if (card === "DAL_BADAL") {
    // DAL BADAL is the whole turn: pass 3, show your role, pick 2 players to shuffle role cards with, then draw 1
    const need = Math.min(3, hand.length - 1);
    const go = (p: number[], sw: number[]) => {
      if (p.length === need && sw.length === 2) { act({ type: "dal_badal", seats: sw, pass: p.map((i) => hand[i]) }); reset(); }
    };
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Head title={pass.length < need ? `Dal Badal — pick ${need} to pass` : "Dal Badal — swap with which 2?"} />
          <button type="button" onClick={reset} className="min-h-10 shrink-0 text-[13px] text-stock/60 underline">Back</button>
        </div>
        <HandRow cards={hand} dim={pairIdx} selected={pass}
          labels={Object.fromEntries([...pairIdx.map((i) => [i, "SWAP"]), ...pass.map((i) => [i, "PASS"])])}
          onTap={(i) => {
            if (pairIdx.includes(i)) return;
            const next = pass.includes(i) ? pass.filter((x) => x !== i) : pass.length < need ? [...pass, i] : pass;
            setPass(next); go(next, swap);
          }} />
        <div className="grid grid-cols-2 gap-2">
          {others.map((p) => (
            <PlayerChip key={p.seat} p={p} selected={swap.includes(p.seat)} onClick={() => {
              const next = swap.includes(p.seat) ? swap.filter((x) => x !== p.seat) : swap.length < 2 ? [...swap, p.seat] : swap;
              setSwap(next); go(pass, next);
            }} />
          ))}
        </div>
        <p className="text-center text-[12px] text-stock/60">Everyone sees your role. Then you draw 1.</p>
      </div>
    );
  }
  const title = !playing ? `Pick ${passSize} to pass` : !auto ? `Pick ${passSize} to pass${needsTarget ? `, then ${ASK[card]?.toLowerCase()}` : ""}` : ASK[card] ?? CARD[card].name;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Head title={title} />
        <button type="button" onClick={reset} className="min-h-10 shrink-0 text-[13px] text-stock/60 underline">Back</button>
      </div>
      {!auto && (
        <HandRow cards={hand} dim={pairIdx} selected={pass}
          labels={Object.fromEntries([...pairIdx.map((i) => [i, "PLAY"]), ...pass.map((i) => [i, "PASS"])])}
          onTap={(i) => {
            if (pairIdx.includes(i)) return;
            const next = pass.includes(i) ? pass.filter((x) => x !== i) : pass.length < passSize ? [...pass, i] : pass;
            setPass(next);
            fire(next, target, roles);
          }} />
      )}
      {needsTarget && <Pickers options={targets} sel={target} onPick={(t) => { setTarget(t); fire(pass, t, roles); }} />}
      {card === "TEER_KAMAN" && <RolePicker roles={v.rolesInPlay} sel={roles} setSel={(r) => { setRoles(r); fire(pass, target, r); }} />}
    </div>
  );
}
