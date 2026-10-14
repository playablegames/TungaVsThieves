"use client";
// The action dock: what YOU can do right now, one step at a time. Irreversible moves go through a 5-second
// timed confirm instead of undo (BGA: undo is impossible once hidden information is out).
import { useEffect, useMemo, useRef, useState } from "react";
import { tkGuesses } from "@/engine/setup";
import { ACTION_CARDS, type Action, type ActionCard, type Card } from "@/engine/types";
import type { PlayerView, PublicPlayer } from "@/engine/view";
import { CARD } from "@/lib/cards";
import type { Voice } from "@/lib/cards";

/** buttons in the table's brass style (screen check 2026-10-07): "ghost" is the quiet one, everything else the rust pill */
function Btn({ voice = "pass", className = "", ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { voice?: Voice | "pass" | "ghost" }) {
  const look = voice === "ghost" || voice === "pass"
    ? "border-2 border-brass/60 bg-black/30 text-stock"
    : "border-2 border-brass/80 btn-primary text-stock";
  return <button type="button" {...p} className={`inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 font-[family-name:var(--font-engraved)] text-[14px] font-bold uppercase tracking-[0.08em] active:translate-y-px disabled:opacity-40 ${look} ${className}`} />;
}
import { HandRow } from "./Hand";
import { CardIcon } from "./CardIcon";
import { TapOn } from "./ui";

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

function RolePicker({ roles, sel, setSel, max, known = [] }: { roles: string[]; sel: string[]; setSel: (r: string[]) => void; max: number; known?: string[] }) {
  const toggle = (r: string) => setSel(sel.includes(r) ? sel.filter((x) => x !== r) : sel.length < max ? [...sel, r] : max === 1 ? [r] : sel);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={max === 1 ? "Name one role" : "Name two roles"}>
      {roles.map((r) => (
        <button key={r} type="button" onClick={() => toggle(r)} aria-pressed={sel.includes(r)}
          className={`min-h-11 rounded-full border-2 px-4 text-[14px] font-semibold ${sel.includes(r) ? "border-crimson bg-crimson-deep text-ink" : known.includes(r) ? "border-[#f0a32e] bg-[#3a240c] text-[#f3c66b] shadow-[0_0_12px_2px_rgba(240,163,46,.35)]" : "border-brass/35 bg-black/30 text-stock"}`}>
          {known.includes(r) ? `🔮 ${r}` : r}</button>
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
    case "debate": return d.dalBadal ? <DebateDalBadal v={v} act={act} /> : null;
    case "vote": return null;
    case "dal_badal_out": return <DalBadalOut v={v} act={act} />;
    case "dal_badal_shield": return <DalBadalShield v={v} on={d.on} act={act} />;
    case "batwara": return <Bhukamp v={v} act={act} />;
    case "surrender": return <Surrender stones={d.stones as Card[]} act={act} />;
    case "dal_pick": return <DalPick count={d.count} act={act} />;
    case "pass_on": return <PassOn v={v} passSize={d.passSize} held={d.held} act={act} />;
    case "gift": return <OneOf title="Give your vote" hint="One extra vote in their next vote, then back to 1." options={others}
      go={(s) => c.ask(`Give your vote to ${name(s)}`, { type: "gift", target: s })} skip={{ label: "Give it to nobody", action: { type: "gift", target: null } }} act={act} />;
    case "handoff": return <OneOf title="Hand ALL your cards to someone" hint="Stones included. Only they see what you hand over." options={others}
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

/** BHUKAMP (2026-10-12): 1 card to your left (the next player), 1 to your right — tap the left one, then the right one */
function Bhukamp({ v, act }: { v: PlayerView; act: (a: Action) => void }) {
  const [first, setFirst] = useState<number | null>(null);
  const living = v.players.filter((p) => p.alive).map((p) => p.seat);
  const i = living.indexOf(v.me.seat);
  const bare = (s: string) => s.replace(/\s*🤖$/, "");
  const left = bare(v.players[living[(i + 1) % living.length]].name);
  const right = bare(v.players[living[(i - 1 + living.length) % living.length]].name);
  const hand = v.me.hand;
  if (hand.length < 2) {
    return (
      <div className="flex flex-col gap-3">
        <Head title={`Bhukamp — 1 card to ${left}`} />
        <div className="pt-2"><HandRow cards={hand} onTap={(k) => act({ type: "batwara", card: hand[k] })} /></div>
      </div>
    );
  }
  // (designer 2026-10-13 evening: "give decision for one card, the other is automatic; a timer for which card goes to
  // which") two cards: tap the one for the left — the other goes right; both are labelled for 2 s, then they go.
  // Tap the other card in those 2 s to swap.
  if (hand.length === 2) return <BhukampTwo hand={hand} left={left} right={right} act={act} />;
  return (
    <div className="flex flex-col gap-3">
      <Head title={first === null ? `Bhukamp — which card to ${left}?` : `…and which to ${right}?`} />
      <div className="pt-2">
        <HandRow cards={hand} selected={first === null ? [] : [first]} labels={first === null ? {} : { [first]: left }}
          onTap={(k) => {
            if (first === null) return setFirst(k);
            if (k === first) return setFirst(null);
            act({ type: "batwara", card: hand[first], right: hand[k] });
          }} />
      </div>
    </div>
  );
}

const BHUKAMP_LOOK_MS = 2000;
function BhukampTwo({ hand, left, right, act }: { hand: Card[]; left: string; right: string; act: (a: Action) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  // the phone re-polls the hand every few seconds: the clock keys on the cards, not the array
  const send = useRef({ act, hand });
  useEffect(() => { send.current = { act, hand }; });
  const key = hand.join();
  useEffect(() => {
    if (pick === null) return;
    const t = setTimeout(() => { const { act: a, hand: h } = send.current; a({ type: "batwara", card: h[pick], right: h[1 - pick] }); }, BHUKAMP_LOOK_MS);
    return () => clearTimeout(t);
  }, [pick, key]);
  return (
    <div className="flex flex-col gap-3">
      <Head title={pick === null ? `Bhukamp — which card to ${left}?` : `◀ ${left} · ${right} ▶`} />
      <div className="pt-2">
        <HandRow cards={hand} selected={pick === null ? [] : [pick]} labels={pick === null ? {} : { [pick]: `◀ ${left}`, [1 - pick]: `${right} ▶` }}
          onTap={(k) => setPick(k)} />
      </div>
      {pick !== null && <div className="flex justify-center"><TapOn key={pick} ms={BHUKAMP_LOOK_MS} label="Tap the other card to swap" /></div>}
    </div>
  );
}

/** DAL BADAL in the mandatory vote (2026-10-12): during the debate a thief may use it — no cards passed, nothing drawn */
function DebateDalBadal({ v, act }: { v: PlayerView; act: (a: Action) => void }) {
  const [open, setOpen] = useState(false);
  const [swap, setSwap] = useState<number[]>([]);
  const others = v.players.filter((p) => p.alive && p.seat !== v.me.seat);
  if (!open) return <Btn voice="lethal" onClick={() => setOpen(true)}>Use Dal Badal</Btn>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Head title="Dal Badal — swap with which 2?" />
        <button type="button" onClick={() => { setOpen(false); setSwap([]); }} className="min-h-10 shrink-0 text-[13px] text-stock/60 underline">Back</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {others.map((p) => (
          <PlayerChip key={p.seat} p={p} selected={swap.includes(p.seat)} onClick={() => {
            const next = swap.includes(p.seat) ? swap.filter((x) => x !== p.seat) : swap.length < 2 ? [...swap, p.seat] : swap;
            setSwap(next);
            if (next.length === 2) act({ type: "dal_badal", seats: next, pass: [] });
          }} />
        ))}
      </div>
      <p className="text-center text-[12px] text-stock/60">Everyone sees your role.</p>
    </div>
  );
}

/** DAL BADAL when the mandatory vote puts you out (2026-10-12): before the reveal — sides count after the shuffle */
/** DAL BADAL AS A SHIELD (designer 2026-10-14, "why can't a thief use Dal Badal anytime"): shot at, read or voted out —
 *  shuffle role cards with 2 players FIRST, and the shot, the read or the exit lands on the role card you hold then */
function DalBadalShield({ v, on, act }: { v: PlayerView; on: "tk" | "kundli" | "faisla_out"; act: (a: Action) => void }) {
  const [swap, setSwap] = useState<number[]>([]);
  const others = v.players.filter((p) => p.alive && p.seat !== v.me.seat);
  const title = on === "tk" ? "An arrow is coming — Dal Badal first?" : on === "kundli" ? "They're reading you — Dal Badal first?" : "You're voted out — Dal Badal first?";
  return (
    <div className="flex flex-col gap-3">
      <Head title={title} />
      <p className="-mt-2 text-[12px] text-stock/60">Pick 2 to shuffle role cards with. Everyone sees your role; then it lands on the card you hold.</p>
      <div className="grid grid-cols-2 gap-2">
        {others.map((p) => (
          <PlayerChip key={p.seat} p={p} selected={swap.includes(p.seat)} onClick={() => {
            const next = swap.includes(p.seat) ? swap.filter((x) => x !== p.seat) : swap.length < 2 ? [...swap, p.seat] : swap;
            setSwap(next);
            if (next.length === 2) act({ type: "dal_badal", seats: next, pass: [] });
          }} />
        ))}
      </div>
      <Btn voice="ghost" onClick={() => act({ type: "ready" })}>Let it happen</Btn>
    </div>
  );
}

function DalBadalOut({ v, act }: { v: PlayerView; act: (a: Action) => void }) {
  const [swap, setSwap] = useState<number[]>([]);
  const others = v.players.filter((p) => p.alive && p.seat !== v.me.seat);
  return (
    <div className="flex flex-col gap-3">
      <Head title="Dal Badal before the reveal?" />
      <div className="grid grid-cols-2 gap-2">
        {others.map((p) => (
          <PlayerChip key={p.seat} p={p} selected={swap.includes(p.seat)} onClick={() => {
            const next = swap.includes(p.seat) ? swap.filter((x) => x !== p.seat) : swap.length < 2 ? [...swap, p.seat] : swap;
            setSwap(next);
            if (next.length === 2) act({ type: "dal_badal", seats: next, pass: [] });
          }} />
        ))}
      </div>
      <Btn voice="ghost" onClick={() => act({ type: "dal_badal", seats: [], pass: [] })}>Keep it</Btn>
    </div>
  );
}

/** the roles your own Kundli reads have shown you, by seat (a Dal Badal over a seat wipes it) */
function knownRoles(v: PlayerView): Map<number, string> {
  const known = new Map<number, string>();
  for (const e of v.events) {
    const mine = Array.isArray(e.to) && e.to.includes(v.me.seat);
    if (mine && e.type === "kundli_private") known.set(e.data?.target as number, String(e.data?.role));
    if (e.type === "dal_badal") for (const x of (e.data?.seats as number[]) ?? []) known.delete(x);
  }
  return known;
}

/** (designer 2026-10-14: "a dark pattern") the list never steers — same order every time, no role moved up or
 *  outlined because someone CLAIMED it. Only your own Kundli read of THIS target is marked (🔮), since you saw it. */
/** TEER KAMAN'S LIST (designer 2026-10-14, replacing "the other team only"): EVERY role in this game but your own —
 *  a thief may shoot a thief to look like a villager, a villager may shoot a villager it doesn't believe. */
function shortlist(v: PlayerView): string[] {
  return v.rolesInPlay.filter((r) => r !== v.me.role);
}

/** PLAY, THEN PASS (designer 2026-10-14): your pair's effect is over — now pass 3 as the new pile, then draw back up to
 *  2 (or take the cards of the player you put out). Nothing is sent until "Pass these 3". */
function PassOn({ v, passSize, held, act }: { v: PlayerView; passSize: number; held: number; act: (a: Action) => void }) {
  const hand = v.me.hand;
  const [pass, setPass] = useState<number[]>(() => (hand.length === passSize ? hand.map((_, i) => i) : []));
  const after = held ? `then you take the ${held} card${held === 1 ? "" : "s"} you won` : "then you draw back to 2";
  return (
    <div className="flex flex-col gap-3">
      <Head title={`Now pass ${passSize}`} />
      <p className="-mt-2 text-[12px] text-stock/60">They go on as the new pile, {after}.</p>
      <HandRow cards={hand} selected={pass} labels={Object.fromEntries(pass.map((i) => [i, "PASS"]))}
        onTap={(i) => setPass((was) => (was.includes(i) ? was.filter((x) => x !== i) : was.length < passSize ? [...was, i] : was))} />
      {pass.length === passSize && (
        <button type="button" onClick={() => act({ type: "pass", pass: pass.map((i) => hand[i]) })}
          className="nudge min-h-12 rounded-full border-2 border-brass/80 btn-primary font-[family-name:var(--font-engraved)] text-[16px] font-bold uppercase tracking-[0.08em] text-stock active:translate-y-px">
          Pass these {passSize}
        </button>
      )}
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
  const guesses = tkGuesses(v.rolesInPlay);
  const hand = v.me.hand;
  // the cards that leave with the move: a pair, or the Dal Badal card itself
  const pairIdx = useMemo(() => (!card || card === "NONE" ? [] : hand.map((c, i) => (c === card ? i : -1)).filter((i) => i >= 0).slice(0, card === "DAL_BADAL" ? 1 : 2)), [card, hand]);
  const [swap, setSwap] = useState<number[]>([]);
  const reset = () => { setCard(null); setPass([]); setTarget(null); setRoles([]); setSwap([]); };
  const others = v.players.filter((p) => p.alive && p.seat !== v.me.seat);
  const targets = card === "HERA_PHERI" ? others.filter((p) => p.handSize > 0) : others;
  const needsTarget = card && card !== "NONE" && card !== "DAL_BADAL" && TARGETED.includes(card);
  // PLAY, THEN PASS (designer 2026-10-14): playing a pair picks no pass - you choose your 3 after the effect
  const declare = (c: ActionCard) => {
    if (!TARGETED.includes(c)) { ask(CARD[c].name, { type: "play", card: c }); return; }
    setCard(c);
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
          {playable.map((c, i) => (
            <button key={c} type="button" onClick={() => declare(c)}
              className={`${i === 0 ? "nudge" : ""} min-h-12 rounded-full border-2 border-brass/80 btn-primary font-[family-name:var(--font-engraved)] text-[16px] font-bold uppercase tracking-[0.08em] text-stock active:translate-y-px`}>
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
            className={`${playable.length ? "" : "nudge"} min-h-12 rounded-full border-2 border-brass/60 bg-black/30 font-[family-name:var(--font-engraved)] text-[15px] font-semibold uppercase tracking-[0.12em] text-stock active:translate-y-px`}>
            {playable.length ? `Or pass ${passSize}` : `Pass ${passSize} cards`}
          </button>
        </div>
        {blocked.map((c) => <p key={c} className="text-center text-[12px] text-stock/60">{CARD[c].name} ×2 — {whyNot(v, c, hand, passSize)}</p>)}
      </div>
    );
  }
  const playing = card !== "NONE";
  /** (designer 2026-10-12) the move is never sent on the last tap: every pick shows its label (all 3 PASS cards), then
   *  one button sends it. Returns null while something is still missing. */
  const complete = (p: number[], t: number | null, r: string[]) =>
    !card || card === "DAL_BADAL" || (card === "NONE" && p.length !== passSize) || (needsTarget && t === null) || (card === "TEER_KAMAN" && r.length !== guesses) ? null : { p, t, r };
  const send = () => {
    const c = complete(pass, target, roles);
    if (!c || !card || card === "DAL_BADAL") return;
    if (card === "NONE") { act({ type: "pass", pass: c.p.map((i) => hand[i]) }); reset(); return; }
    ask(card, { type: "play", card, target: c.t ?? undefined, roles: card === "TEER_KAMAN" ? c.r : undefined });
    reset();
  };
  const ASK: Partial<Record<ActionCard, string>> = {
    TALASHI: "Search who?", KUNDLI: "Read whose role?", HERA_PHERI: "Steal from who?", TEER_KAMAN: guesses === 1 ? "Shoot who? Name 1 role" : "Shoot who? Name 2 roles",
  };
  if (card === "DAL_BADAL") {
    // DAL BADAL on your turn (2026-10-14): show your role, pick 2 players to shuffle role cards with - then pass 3 and
    // draw back up to 2, like any play
    const go = (sw: number[]) => { if (sw.length === 2) { act({ type: "dal_badal", seats: sw, pass: [] }); reset(); } };
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Head title="Dal Badal — swap with which 2?" />
          <button type="button" onClick={reset} className="min-h-10 shrink-0 text-[13px] text-stock/60 underline">Back</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {others.map((p) => (
            <PlayerChip key={p.seat} p={p} selected={swap.includes(p.seat)} onClick={() => {
              const next = swap.includes(p.seat) ? swap.filter((x) => x !== p.seat) : swap.length < 2 ? [...swap, p.seat] : swap;
              setSwap(next); go(next);
            }} />
          ))}
        </div>
        <p className="text-center text-[12px] text-stock/60">Everyone sees your role. Then you pass 3 and draw back to 2.</p>
      </div>
    );
  }
  const title = !playing ? `Pick ${passSize} to pass` : ASK[card] ?? CARD[card].name;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Head title={title} />
        <button type="button" onClick={reset} className="min-h-10 shrink-0 text-[13px] text-stock/60 underline">Back</button>
      </div>
      {!playing && (
        <HandRow cards={hand} dim={pairIdx} selected={pass}
          labels={Object.fromEntries([...pairIdx.map((i) => [i, "PLAY"]), ...pass.map((i) => [i, "PASS"])])}
          onTap={(i) => {
            if (pairIdx.includes(i)) return;
            const next = pass.includes(i) ? pass.filter((x) => x !== i) : pass.length < passSize ? [...pass, i] : pass;
            setPass(next);
          }} />
      )}
      {needsTarget && <Pickers options={targets} sel={target} onPick={setTarget} />}
      {card === "TEER_KAMAN" && <RolePicker roles={shortlist(v)} known={target !== null && knownRoles(v).has(target) ? [knownRoles(v).get(target)!] : []} max={guesses} sel={roles} setSel={setRoles} />}
      {complete(pass, target, roles) && (
        <button type="button" onClick={send}
          // the next step glows green — never a lethal one (Teer Kaman)
          className={`${card === "TEER_KAMAN" ? "" : "nudge"} min-h-12 rounded-full border-2 border-brass/80 btn-primary font-[family-name:var(--font-engraved)] text-[16px] font-bold uppercase tracking-[0.08em] text-stock active:translate-y-px`}>
          {card === "NONE" ? `Pass these ${passSize}` : card === "TEER_KAMAN" ? "Shoot" : `Play ${CARD[card as ActionCard].name}`}
        </button>
      )}
    </div>
  );
}
