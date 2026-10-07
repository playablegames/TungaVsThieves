"use client";
// The action dock: what YOU can do right now, one step at a time. Irreversible moves go through a 5-second
// timed confirm instead of undo (BGA: undo is impossible once hidden information is out).
import { useEffect, useMemo, useState } from "react";
import type { Action, ActionCard, Card } from "@/engine/types";
import type { PlayerView, PublicPlayer } from "@/engine/view";
import { CARD } from "@/lib/cards";
import { Btn } from "./ui";
import { HandRow } from "./Hand";

const TARGETED: ActionCard[] = ["KUNDLI", "TALASHI", "HERA_PHERI", "TEER_KAMAN", "MAYA_JAAL"];
const CONFIRM_MS = 5000;

type Ask = (label: string, action: Action) => void;

/** Hold an irreversible action for 5 seconds with Cancel / Now — the table still sees it the moment it lands. */
function useTimedConfirm(act: (a: Action) => void) {
  const [pending, setPending] = useState<{ label: string; action: Action; until: number } | null>(null);
  const [left, setLeft] = useState(CONFIRM_MS);
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => {
      const ms = pending.until - Date.now();
      if (ms <= 0) { setPending(null); act(pending.action); } else setLeft(ms);
    }, 200);
    return () => clearInterval(t);
  }, [pending, act]);
  const ask: Ask = (label, action) => { setLeft(CONFIRM_MS); setPending({ label, action, until: Date.now() + CONFIRM_MS }); };
  return { pending, left, ask, cancel: () => setPending(null), now: () => { if (pending) { setPending(null); act(pending.action); } } };
}

function Head({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h2 className="font-display text-[22px] font-black leading-tight">{title}</h2>
      {hint && <p className="mt-0.5 text-[14px] leading-snug text-ink-2">{hint}</p>}
    </div>
  );
}

export function PlayerChip({ p, selected, onClick, me }: { p: PublicPlayer; selected?: boolean; onClick?: () => void; me?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`flex min-h-12 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-left text-[14px] font-bold ${selected ? "bg-jade text-card-ink" : "bg-raise text-ink"}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-extrabold ${selected ? "bg-card-ink text-jade" : "bg-raise-2"}`}>{p.name.slice(0, 1)}</span>
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
          className={`min-h-11 rounded-full px-4 text-[14px] font-bold ${sel.includes(r) ? "bg-crimson text-ink" : "bg-raise text-ink"}`}>{r}</button>
      ))}
    </div>
  );
}

/** The tray: your move when it needs your cards or a pick. Debate and voting happen on the centre stage. */
export function Decide({ v, act }: { v: PlayerView; act: (a: Action) => void }) {
  const c = useTimedConfirm(act);
  if (c.pending) {
    const left = Math.ceil(c.left / 1000);
    return (
      <div className="flex flex-col gap-3" role="status">
        <Head title={c.pending.label} hint={`Goes to the table in ${left}s.`} />
        <div className="h-1.5 overflow-hidden rounded-full bg-raise"><div className="h-full bg-jade transition-[width] duration-200" style={{ width: `${(c.left / CONFIRM_MS) * 100}%` }} /></div>
        <div className="grid grid-cols-2 gap-2">
          <Btn voice="ghost" onClick={c.cancel}>Cancel</Btn>
          <Btn voice="relic" onClick={c.now}>Now</Btn>
        </div>
      </div>
    );
  }
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
      <Pickers options={options} sel={sel} onPick={setSel} />
      <div className="grid grid-cols-2 gap-2">
        {skip ? <Btn voice="ghost" onClick={() => act(skip.action)}>{skip.label}</Btn> : <span />}
        <Btn voice="vote" disabled={sel === null} onClick={() => go(sel!)}>Confirm</Btn>
      </div>
    </div>
  );
}

function Swap({ options, count, ask, name }: { options: PublicPlayer[]; count: number; ask: Ask; name: (s: number) => string }) {
  const [sel, setSel] = useState<number[]>([]);
  const toggle = (s: number) => setSel((x) => (x.includes(s) ? x.filter((y) => y !== s) : x.length < count ? [...x, s] : x));
  return (
    <div className="flex flex-col gap-3">
      <Head title={`Dal Badal — shuffle ${count} roles`} hint={`Pick ${count} players. Their role cards are shuffled face down and each picks one back. They see their new role in secret; the table sees only who was in it.`} />
      <div className="grid grid-cols-2 gap-2">{options.map((p) => <PlayerChip key={p.seat} p={p} selected={sel.includes(p.seat)} onClick={() => toggle(p.seat)} />)}</div>
      <Btn voice="lethal" disabled={sel.length !== count} onClick={() => ask(`Shuffle ${sel.map(name).join(", ")}`, { type: "dal_badal", seats: sel })}>Shuffle</Btn>
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
  return (
    <div className="flex flex-col gap-3">
      <Head title="Your last shot" hint="Point at one player, name two roles. Either is theirs: they're out with you." />
      <Pickers options={options} sel={target} onPick={setTarget} />
      <RolePicker roles={v.rolesInPlay} sel={roles} setSel={setRoles} />
      <div className="grid grid-cols-2 gap-2">
        <Btn voice="ghost" onClick={() => act({ type: "shot", target: null })}>No shot</Btn>
        <Btn voice="lethal" disabled={target === null || roles.length !== 2}
          onClick={() => ask(`Shoot ${name(target!)}: ${roles.join(" or ")}`, { type: "shot", target, roles: roles as [string, string] })}>Shoot</Btn>
      </div>
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
  const mine = v.turnSeat === v.me.seat; // you played it: what's left after your split goes on with the 2 you draw
  const choosePile = Boolean(d?.choosePile);
  const next = v.players[living[(i + 1) % living.length]].name;
  const tap = (k: number) => {
    if (left === k) return setLeft(null);
    if (right === k) return setRight(null);
    if (pile === k) return setPile(null);
    if (left === null) setLeft(k); else if (right === null) setRight(k); else if (choosePile && pile === null) setPile(k);
  };
  const ready = left !== null && right !== null && (!choosePile || pile !== null);
  return (
    <div className="flex flex-col gap-3">
      <Head title="Bhukamp — split your cards"
        hint={`First tap goes left to ${L}, second goes right to ${R}.${choosePile ? ` Third tap: the card that goes to ${next} with the 2 you draw.` : mine ? ` Your last card goes to ${next} with the 2 you draw.` : ""} A Stone may move.`} />
      <div className="pt-2">
        <HandRow cards={v.me.hand} selected={[left, right, pile].filter((k): k is number => k !== null)}
          labels={Object.fromEntries([[left, "LEFT"], [right, "RIGHT"], [pile, "NEXT"]].filter(([k]) => k !== null))} onTap={tap} />
      </div>
      <Btn voice="gold" disabled={!ready}
        onClick={() => act({ type: "batwara", left: v.me.hand[left!], right: v.me.hand[right!], ...(choosePile ? { pile: v.me.hand[pile!] } : {}) })}>Pass them</Btn>
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
  const togglePass = (i: number) => setPass((p) => (p.includes(i) ? p.filter((x) => x !== i) : p.length < passSize ? [...p, i] : p));
  const others = v.players.filter((p) => p.alive && p.seat !== v.me.seat);
  const targets = card === "MAYA_JAAL" ? v.players.filter((p) => !p.alive) : card === "HERA_PHERI" ? others.filter((p) => p.handSize > 0) : others;
  const needsTarget = card && card !== "NONE" && TARGETED.includes(card);
  const ready = card && pass.length === passSize && (!needsTarget || target !== null) && (card !== "TEER_KAMAN" || roles.length === 2);
  const name = (s: number) => v.players[s]?.name ?? "?";
  const living = v.players.filter((p) => p.alive).map((p) => p.seat);
  const next = name(living[(living.indexOf(v.me.seat) + 1) % living.length]);
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
      ask(`Declaring ${CARD[c].name} · ${rest.map((i) => CARD[hand[i]].name).join(", ")} go to ${next}`, { type: "play", card: c, pass: rest.map((i) => hand[i]) });
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
        {!playable.length && <p className="text-center text-[12px] text-stock/60">No pair to play — tap a card to read it.</p>}
        {blocked.map((c) => <p key={c} className="text-center text-[12px] text-stock/60">{CARD[c].name} ×2 — {whyNot(v, c, hand, passSize)}</p>)}
      </div>
    );
  }
  const playing = card !== "NONE";
  const label = !playing ? "" : `${CARD[card].name}${target !== null ? ` on ${name(target)}` : ""}${card === "TEER_KAMAN" && roles.length === 2 ? `: ${roles.join(" or ")}` : ""}${auto ? ` · ${pass.map((i) => CARD[hand[i]].name).join(", ")} go to ${next}` : ""}`;
  return (
    <div className="flex flex-col gap-3">
      <Head title={playing ? `Declare ${CARD[card].name}` : `Pass ${passSize} cards`}
        hint={playing
          ? `${auto ? `Your other ${passSize} cards go face down to ${next} as you declare.` : `Choose ${passSize} cards to pass face down to ${next} — a Stone only if you must.`} ${CARD[card].text}`
          : `Face down to ${next}. A Stone may go — whoever is next picks it up.`} />
      <div className="pt-2">
        <HandRow cards={hand} dim={pairIdx} selected={pass}
          labels={Object.fromEntries([...pairIdx.map((i) => [i, "PLAY"]), ...pass.map((i) => [i, "PASS"])])}
          onTap={auto ? undefined : (i) => { if (!pairIdx.includes(i)) togglePass(i); }} />
      </div>
      {!auto && <p className="text-[13px] text-ink-2">{pass.length} of {passSize} chosen to pass</p>}
      {needsTarget && <Pickers options={targets} sel={target} onPick={setTarget} />}
      {card === "TEER_KAMAN" && <RolePicker roles={v.rolesInPlay} sel={roles} setSel={setRoles} />}
      <div className="grid grid-cols-2 gap-2">
        <Btn voice="ghost" onClick={reset}>Back</Btn>
        {playing
          ? <Btn voice={CARD[card].voice} disabled={!ready} onClick={() => { ask(`Declaring ${label}`, { type: "play", card, pass: pass.map((i) => hand[i]), target: target ?? undefined, roles: card === "TEER_KAMAN" ? (roles as [string, string]) : undefined }); reset(); }}>Declare</Btn>
          : <Btn voice="pass" disabled={!ready} onClick={() => { act({ type: "pass", pass: pass.map((i) => hand[i]) }); reset(); }}>Pass</Btn>}
      </div>
    </div>
  );
}
