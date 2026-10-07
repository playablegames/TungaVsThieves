"use client";
// The action dock: what YOU can do right now, one step at a time. Irreversible moves go through a 5-second
// timed confirm instead of undo (BGA: undo is impossible once hidden information is out).
import { useMemo, useState } from "react";
import type { Action, ActionCard, Card } from "@/engine/types";
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

const TARGETED: ActionCard[] = ["KUNDLI", "TALASHI", "HERA_PHERI", "TEER_KAMAN", "MAYA_JAAL"];

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
    case "turn": return <Turn v={v} playable={d.playable as ActionCard[]} passSize={d.passSize} act={act} ask={c.ask} />;
    case "debate": case "vote": return null;
    case "batwara": return <Bhukamp v={v} act={act} />;
    case "dal_badal": return <Swap options={others} count={d.count} ask={c.ask} name={name} />;
    case "dal_pick": return <DalPick count={d.count} act={act} />;
    case "gift": return <OneOf title="Dying power — give 1 vote" hint="They vote with one more from now on." options={others}
      go={(s) => c.ask(`Give your vote to ${name(s)}`, { type: "gift", target: s })} skip={{ label: "Give it to nobody", action: { type: "gift", target: null } }} act={act} />;
    case "shot": return <Shot v={v} options={others} ask={c.ask} act={act} name={name} />;
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

function Swap({ options, count, ask, name }: { options: PublicPlayer[]; count: number; ask: Ask; name: (s: number) => string }) {
  const [sel, setSel] = useState<number[]>([]);
  const toggle = (s: number) => {
    const next = sel.includes(s) ? sel.filter((y) => y !== s) : sel.length < count ? [...sel, s] : sel;
    setSel(next);
    if (next.length === count) ask(`Shuffle ${next.map(name).join(", ")}`, { type: "dal_badal", seats: next });
  };
  return (
    <div className="flex flex-col gap-3">
      <Head title={`Dal Badal — pick ${count}`} hint={`Pick ${count} players. Their role cards are shuffled face down and each picks one back. They see their new role in secret; the table sees only who was in it.`} />
      <div className="grid grid-cols-2 gap-2">{options.map((p) => <PlayerChip key={p.seat} p={p} selected={sel.includes(p.seat)} onClick={() => toggle(p.seat)} />)}</div>
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

function Shot({ v, options, ask, act, name }: { v: PlayerView; options: PublicPlayer[]; ask: Ask; act: (a: Action) => void; name: (s: number) => string }) {
  const [target, setTarget] = useState<number | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const fire = (t: number | null, r: string[]) => { if (t !== null && r.length === 2) ask(`Shoot ${name(t)}`, { type: "shot", target: t, roles: r as [string, string] }); };
  return (
    <div className="flex flex-col gap-3">
      <Head title="Last shot — who, and 2 roles" hint="Point at one player, name two roles. Either is theirs: they're out with you." />
      <Pickers options={options} sel={target} onPick={(t) => { setTarget(t); fire(t, roles); }} />
      <RolePicker roles={v.rolesInPlay} sel={roles} setSel={(r) => { setRoles(r); fire(target, r); }} />
      <Btn voice="ghost" onClick={() => act({ type: "shot", target: null })}>No shot</Btn>
    </div>
  );
}

function Bhukamp({ v, act }: { v: PlayerView; act: (a: Action) => void }) {
  const [left, setLeft] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);
  const living = v.players.filter((p) => p.alive).map((p) => p.seat);
  const i = living.indexOf(v.me.seat);
  const L = v.players[living[(i - 1 + living.length) % living.length]].name;
  const R = v.players[living[(i + 1) % living.length]].name;
  const [pile, setPile] = useState<number | null>(null);
  const d = v.decision?.kind === "batwara" ? v.decision : null;
  const choosePile = Boolean(d?.choosePile);
  const next = v.players[living[(i + 1) % living.length]].name;
  // the tap that completes the split passes it (designer: "directly do action")
  const tap = (k: number) => {
    let l = left, r = right, p = pile;
    if (l === k) l = null; else if (r === k) r = null; else if (p === k) p = null;
    else if (l === null) l = k; else if (r === null) r = k; else if (choosePile && p === null) p = k;
    setLeft(l); setRight(r); setPile(p);
    if (l !== null && r !== null && (!choosePile || p !== null))
      act({ type: "batwara", left: v.me.hand[l], right: v.me.hand[r], ...(choosePile ? { pile: v.me.hand[p!] } : {}) });
  };
  return (
    <div className="flex flex-col gap-3">
      <Head title={choosePile ? "Bhukamp — 1 left, 1 right, 1 on" : "Bhukamp — 1 left, 1 right"} />
      <div className="pt-2">
        <HandRow cards={v.me.hand} selected={[left, right, pile].filter((k): k is number => k !== null)}
          labels={Object.fromEntries([[left, `← ${L}`], [right, `${R} →`], [pile, `→ ${next}`]].filter(([k]) => k !== null))} onTap={tap} />
      </div>
    </div>
  );
}

/** why a pair in your hand can't be played right now (engine canPlay, in words) */
function whyNot(v: PlayerView, c: ActionCard, hand: Card[], passSize: number): string {
  if (hand.length - 2 < 3) return `needs ${passSize} other cards left to pass`;
  if (c === "MAYA_JAAL") return "nobody is out yet to bring back";
  if (c === "HERA_PHERI") return "nobody has cards to steal";
  return "no one to aim it at";
}

function Turn({ v, playable, passSize, act, ask }: { v: PlayerView; playable: ActionCard[]; passSize: number; act: (a: Action) => void; ask: Ask }) {
  const [card, setCard] = useState<ActionCard | "NONE" | null>(null);
  const [pass, setPass] = useState<number[]>([]);
  const [target, setTarget] = useState<number | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const hand = v.me.hand;
  const pairIdx = useMemo(() => (!card || card === "NONE" ? [] : hand.map((c, i) => (c === card ? i : -1)).filter((i) => i >= 0).slice(0, 2)), [card, hand]);
  const reset = () => { setCard(null); setPass([]); setTarget(null); setRoles([]); };
  const others = v.players.filter((p) => p.alive && p.seat !== v.me.seat);
  const targets = card === "MAYA_JAAL" ? v.players.filter((p) => !p.alive) : card === "HERA_PHERI" ? others.filter((p) => p.handSize > 0) : others;
  const needsTarget = card && card !== "NONE" && TARGETED.includes(card);
  /** the cards left once this pair is out — when exactly passSize remain, they go on by themselves */
  const restAfter = (c: ActionCard) => {
    const pair = hand.map((h, i) => (h === c ? i : -1)).filter((i) => i >= 0).slice(0, 2);
    return hand.map((_, i) => i).filter((i) => !pair.includes(i));
  };
  const auto = card && card !== "NONE" && restAfter(card).length === passSize;
  const declare = (c: ActionCard) => {
    const rest = restAfter(c);
    // nothing to choose: the pair is declared and the other cards go to the next player in the same move
    // Bhukamp splits first: nothing is passed when it is declared — the split screen comes next
    if (c === "BATWARA") { ask(`Declaring ${CARD[c].name} — then everyone splits, you too`, { type: "play", card: c, pass: [] }); return; }
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
    const blocked = (["FAISLA", "TALASHI", "KUNDLI", "HERA_PHERI", "BATWARA", "MAYA_JAAL", "TEER_KAMAN"] as ActionCard[])
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
    if (needsTarget && t === null) return;
    if (card === "TEER_KAMAN" && r.length !== 2) return;
    ask(card, { type: "play", card, pass: p.map((i) => hand[i]), target: t ?? undefined, roles: card === "TEER_KAMAN" ? (r as [string, string]) : undefined });
    reset();
  };
  const ASK: Partial<Record<ActionCard, string>> = {
    TALASHI: "Search who?", KUNDLI: "Read whose role?", HERA_PHERI: "Steal from who?", MAYA_JAAL: "Bring back who?", TEER_KAMAN: "Shoot who? Name 2 roles",
  };
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
