"use client";
// The action dock: what YOU can do right now, one step at a time. Irreversible moves go through a 5-second
// timed confirm instead of undo (BGA: undo is impossible once hidden information is out).
import { useEffect, useMemo, useRef, useState } from "react";
import { THIEF_ROLES, tkGuesses } from "@/engine/setup";
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

function RolePicker({ roles, sel, setSel, max, known = [], said = [] }: { roles: string[]; sel: string[]; setSel: (r: string[]) => void; max: number; known?: string[]; said?: string[] }) {
  const toggle = (r: string) => setSel(sel.includes(r) ? sel.filter((x) => x !== r) : sel.length < max ? [...sel, r] : max === 1 ? [r] : sel);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={max === 1 ? "Name one role" : "Name two roles"}>
      {roles.map((r) => (
        <button key={r} type="button" onClick={() => toggle(r)} aria-pressed={sel.includes(r)}
          className={`min-h-11 rounded-full border-2 px-4 text-[14px] font-semibold ${sel.includes(r) ? "border-crimson bg-crimson-deep text-ink" : known.includes(r) ? "border-[#f0a32e] bg-[#3a240c] text-[#f3c66b] shadow-[0_0_12px_2px_rgba(240,163,46,.35)]" : said.includes(r) ? "border-dashed border-stock/50 bg-black/30 text-stock" : "border-brass/35 bg-black/30 text-stock"}`}>
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
    case "batwara": return <Bhukamp v={v} act={act} />;
    case "surrender": return <Surrender stones={d.stones as Card[]} act={act} />;
    case "dal_pick": return <DalPick count={d.count} act={act} />;
    case "gift": return <OneOf title="Give your vote" hint="They vote with one more from now on." options={others}
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

/** TEER KAMAN'S LIST (designer 2026-10-12): every role of the OTHER team in this game — a villager sees the thief roles,
 *  a thief the village roles (your side now; a Dal Badal may have changed it). Nothing is removed. A role you KNOW is
 *  the target's (your Kundli read, read back to you) comes first — the best shot; then roles the table has named for
 *  them, newest first. (designer 2026-10-12) Your OWN read gets the best colour — gold with 🔮; a role others claimed
 *  (bots included) is taken with a pinch of salt — a faint dashed outline only. */
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

/** roles OTHER players have claimed for this target — a claim can be a lie (or a bot's guess), so only a faint outline */
function claimedRoles(v: PlayerView, target: number | null): string[] {
  if (target === null) return [];
  return v.events.filter((e) => e.type === "claim" && e.data?.target === target && typeof e.data?.role === "string" && e.data?.seat !== v.me.seat)
    .map((e) => e.data!.role as string);
}

function shortlist(v: PlayerView, target: number | null): string[] {
  const known = knownRoles(v);
  const other = v.rolesInPlay.filter((r) => THIEF_ROLES.includes(r) === (v.me.side === "V"));
  // Teer Kaman must name tkGuesses roles; a tiny list (a single thief role at a 1-guess table) is always long enough
  const roles = other.length >= tkGuesses(v.rolesInPlay) ? other : v.rolesInPlay.filter((r) => r !== v.me.role);
  const first: string[] = [];
  if (target !== null) {
    const k = known.get(target);
    if (k && roles.includes(k)) first.push(k);
    for (const e of [...v.events].reverse()) {
      if (e.type !== "claim" || e.data?.target !== target || typeof e.data?.role !== "string" || e.data?.seat === v.me.seat) continue;
      const r = e.data.role as string;
      if (roles.includes(r) && !first.includes(r)) first.push(r);
    }
  }
  return [...first, ...roles.filter((r) => !first.includes(r))];
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
    !card || card === "DAL_BADAL" || p.length !== passSize || (needsTarget && t === null) || (card === "TEER_KAMAN" && r.length !== guesses) ? null : { p, t, r };
  const send = () => {
    const c = complete(pass, target, roles);
    if (!c || !card || card === "DAL_BADAL") return;
    if (card === "NONE") { act({ type: "pass", pass: c.p.map((i) => hand[i]) }); reset(); return; }
    ask(card, { type: "play", card, pass: c.p.map((i) => hand[i]), target: c.t ?? undefined, roles: card === "TEER_KAMAN" ? c.r : undefined });
    reset();
  };
  const ASK: Partial<Record<ActionCard, string>> = {
    TALASHI: "Search who?", KUNDLI: "Read whose role?", HERA_PHERI: "Steal from who?", TEER_KAMAN: guesses === 1 ? "Shoot who? Name 1 role" : "Shoot who? Name 2 roles",
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
          }} />
      )}
      {needsTarget && <Pickers options={targets} sel={target} onPick={setTarget} />}
      {card === "TEER_KAMAN" && <RolePicker roles={shortlist(v, target)} known={[...knownRoles(v).values()]} said={claimedRoles(v, target)} max={guesses} sel={roles} setSel={setRoles} />}
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
