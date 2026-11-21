"use client";
// THE TABLE (owner + team 2026-11-19, approved sketch "village-classy" with the dusk plum circle): the night
// village, players as the card back round the courtyard (your seat shows your role card), the centre panel with
// whose turn it is and what just happened, the countdown top right, your real cards on the mat. Tap a card → it
// rises into your profile space. PLAY and PASS are the same move (owner 2026-11-21): raise a PAIR -> one gold button
// plays it (CardPanel asks who); raise 2 different cards -> they are the 2 you keep, one gold button "Pass 3 to Riya".
// No separate Pass button. Stones rise only on your own turn. One fixed design size (layout.ts) scaled to the phone.
import { useEffect, useState, useSyncExternalStore } from "react";
import { play } from "@/lib/sfx";
import type { Card, Move } from "@/rules/game";
import type { TableView } from "@/server/game";
import { Centre } from "./Centre";
import { FilmLayer } from "./FilmLayer";
import { CardFace, LINE } from "./CardSheet";
import { CARD, isStoneCard } from "@/lib/cards";

/** pairs played on nobody: the gold button plays them at once */
const NO_NAMES = new Set<Card>(["FAISLA", "BHUKAMP"]);
import { CardPanel, isQuietCard } from "./CardPanel";
import { H, HAND_TOP, W } from "./layout";
import { Seats } from "./Seats";
import { useTableSounds } from "./useTableSounds";
import { VoteResult } from "./VoteResult";
import { liveCount, VoteSheet } from "./VoteSheet";
import { MatEdge, VillageScene } from "./VillageScene";
import "./table.css";

const subscribe = (cb: () => void) => { window.addEventListener("resize", cb); return () => window.removeEventListener("resize", cb); };
const fit = () => Math.min(window.innerWidth / W, window.innerHeight / H);
function useScale() { return useSyncExternalStore(subscribe, fit, () => 1); }

/** the clock starts after the first paint, so the server's render and the phone's first render agree */
function useClock(now: () => number) {
  const [t, setT] = useState<number | null>(null);
  useEffect(() => { const id = setInterval(() => setT(now()), 250); return () => clearInterval(id); }, [now]);
  return t;
}

/** who the game is waiting on — they glow gold */
function activeSeats(v: TableView): number[] {
  const ph = v.phase;
  switch (ph.kind) {
    case "turn": case "pass": case "gift": return [ph.seat];
    case "aim": return [ph.shooter];
    case "bhukamp": return v.players.filter((p) => p.alive && !(p.seat in ph.picks)).map((p) => p.seat);
    case "vote": return v.players.filter((p) => p.alive && !(p.seat in ph.ballots)).map((p) => p.seat);
    default: return [];
  }
}

const RING = 2 * Math.PI * 19;

export function Table({ view, deadline, now, total = 20, onMove, initialOpen = null }: {
  view: TableView; deadline: number | null; now: () => number; total?: number; onMove: (m: Move) => void;
  /** dev preview only: start with this card's screen open */
  initialOpen?: Card | null;
}) {
  const scale = useScale();
  const t = useClock(now);
  const you = view.you;
  const me = view.players[you];
  const hand = me?.hand ?? [];
  const myTurn = view.phase.kind === "turn" && view.phase.seat === you;
  // a raised card belongs to the moment it was tapped in: when the game moves on, it drops back by itself
  const moment = `${view.phase.kind}:${"seat" in view.phase ? view.phase.seat : ""}:${view.events.length}`;
  // the cards you have raised, by their place in your hand; they belong to the moment they were raised in, and drop
  // back by themselves when the game moves on
  const [sel, setSel] = useState<{ idx: number[]; at: string }>(() => {
    if (!initialOpen) return { idx: [], at: "" };
    const idx = hand.flatMap((c, i) => (c === initialOpen ? [i] : [])).slice(0, 2);
    return { idx, at: "" };
  });
  const [picked, setPicked] = useState<number[]>([]);
  const [note, setNote] = useState<{ text: string; until: number } | null>(null);
  const [armed, setArmed] = useState<string | null>(null); // "Play Kundli" pressed: the names fill the bottom area
  const [passMode, setPassMode] = useState<string | null>(null); // "Pass 3 cards" pressed: every tap raises ONE card
  const shooting = view.phase.kind === "aim" && view.phase.shooter === you; // [3.7] Teer Kaman step 2
  const voting = view.phase.kind === "vote" && Boolean(me?.alive);
  const passing = view.phase.kind === "pass" && view.phase.seat === you; // after Faisla / a hit / Dal Badal: choose what you pass
  const selIdx = (sel.at === "" || sel.at === moment ? sel.idx : []).filter((i) => i < hand.length);
  const up = selIdx.map((i) => hand[i]);
  const setUp = (idx: number[], arm = false) => { setPicked([]); setArmed(arm ? moment : null); setSel({ idx, at: moment }); };

  // RAISED CARDS ARE THE CARDS LEAVING YOUR HAND (owner 2026-11-21): a pair to play, or the 3 you pass
  const passN = view.phase.kind === "pass" && passing ? Math.min(3, hand.length - view.phase.keep) : Math.min(3, Math.max(0, hand.length - 2));
  const thief = me?.side === "T";
  const playable = (c: Card) => !isStoneCard(c) && c !== "DAL_BADAL";
  const pair = up.length === 2 && up[0] === up[1] && playable(up[0]);
  const dalAlone = up.length === 1 && up[0] === "DAL_BADAL" && thief;
  const playReady = myTurn && (pair || dalAlone);
  // the card whose screen fills the bottom area (CardPanel), if any
  const open: Card | null = voting ? null : shooting ? "TEER_KAMAN"
    : playReady && armed === moment && !NO_NAMES.has(up[0]) ? up[0]
    : !myTurn && !passing && up.length === 1 ? up[0] : null;
  const passReady = !open && (myTurn || passing) && passN > 0 && up.length === passN;
  const nextName = (() => {
    const n = view.players.length;
    for (let k = 1; k <= n; k++) { const p = view.players[(you + k) % n]; if (p?.alive) return p.name; }
    return "";
  })();

  const tapCard = (i: number) => {
    play("tap");
    if (myTurn || passing) { // your turn: any card rises, Stones too (owner 2026-11-21)
      if (myTurn && selIdx.length === 0 && passMode !== moment && playable(hand[i])) {
        const twin = hand.findIndex((c, j) => j !== i && c === hand[i]);
        if (twin >= 0) { setUp([i, twin]); return; } // the FIRST card you tap brings its pair up with it
      }
      if (selIdx.length < Math.max(passN, myTurn ? 1 : 0)) setUp([...selIdx, i]);
      return;
    }
    const c = hand[i];
    if (isQuietCard(c)) { setNote({ text: LINE[c], until: now() + 2500 }); return; } // off your turn a Stone never rises
    setUp([i]);
  };
  // THE CHOICES when nothing is raised yet: one "Play X" per pair you hold (+ Dal Badal for a thief), and "Pass 3 cards"
  const choices: { key: string; label: string; on: boolean; tap: () => void }[] = [];
  if (myTurn && selIdx.length === 0) {
    for (const c of [...new Set(hand)]) {
      if (!playable(c)) continue;
      const idx = hand.flatMap((x, i) => (x === c ? [i] : [])).slice(0, 2);
      if (idx.length === 2) choices.push({ key: c, label: `Play ${CARD[c].name}`, on: false, tap: () => { setPassMode(null); setUp(idx, !NO_NAMES.has(c)); } });
    }
    const db = hand.indexOf("DAL_BADAL");
    if (thief && db >= 0) choices.push({ key: "DAL_BADAL", label: "Play Dal Badal", on: false, tap: () => { setPassMode(null); setUp([db], true); } });
    if (passN > 0) choices.push({ key: "pass", label: `Pass ${passN} cards`, on: passMode === moment, tap: () => setPassMode(moment) });
  }
  const drop = (i: number) => { play("tap"); setUp(selIdx.filter((x) => x !== i)); };
  const left = deadline && t !== null ? Math.max(0, (deadline - t) / 1000) : null;
  useTableSounds(view, left);

  // your cards in their printed near-square shape: big when you hold 2, smaller and overlapping when you hold 5
  const rest = hand.map((c, i) => ({ c, i })).filter(({ i }) => !selIdx.includes(i));
  const n = rest.length;
  const cw = n <= 2 ? 150 : n === 3 ? 124 : 100;
  const step = n > 1 ? Math.min(cw + 16, (W - 24 - cw) / (n - 1)) : 0;
  const x0 = (W - (cw + step * (n - 1))) / 2;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#15142c]">
      <div className="absolute left-1/2 top-1/2 origin-center" style={{ width: W, height: H, transform: `translate(-50%,-50%) scale(${scale})`, fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
        <VillageScene />

        <div className="absolute inset-x-3.5 top-3 z-10 flex h-[46px] items-center justify-between">
          <span className="size-10" aria-hidden />
          <div className="rounded-xl bg-[#021230d1] px-3.5 py-[7px] font-[family-name:var(--font-cinzel)] text-[12.5px] font-bold tracking-[2px] text-[#f7bb1f] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)]">
            ROUND {view.round} OF {view.rounds}
          </div>
          <div className="relative grid size-11 place-items-center font-[family-name:var(--font-cinzel)] text-[19px] font-bold text-[#f7bb1f]" aria-label={left !== null ? `${Math.ceil(left)} seconds left` : undefined}>
            {left !== null && (
              <>
                <svg className="absolute inset-0" viewBox="0 0 44 44" aria-hidden>
                  <circle cx={22} cy={22} r={19} fill="#021230" stroke="rgba(247,187,31,.2)" strokeWidth={3} />
                  <circle cx={22} cy={22} r={19} fill="none" stroke="#f7bb1f" strokeWidth={3} strokeLinecap="round" transform="rotate(-90 22 22)"
                    strokeDasharray={`${RING * Math.min(1, left / total)} 999`} />
                </svg>
                <span className="relative">{Math.ceil(left)}</span>
              </>
            )}
          </div>
        </div>

        <Centre view={view} />
        <Seats players={view.players} you={you} myRole={me?.role ?? null} active={activeSeats(view)} picked={open ? picked : []} hideYou={(!voting && up.length > 0) || shooting}
          votes={view.phase.kind === "vote" ? liveCount(view.phase, view.extraVote) : undefined} />
        <VoteResult view={view} />

        <div className="absolute inset-x-0 bottom-0 z-[1]" style={{ top: HAND_TOP }}>
          <div className="absolute inset-0 shadow-[0_-10px_24px_rgba(0,0,0,.5)]" style={{ background: "linear-gradient(rgba(2,10,30,.35), rgba(2,8,24,.9)), repeating-linear-gradient(90deg, rgba(255,231,166,.035) 0 1px, transparent 1px 12px), repeating-linear-gradient(0deg, #0e1a3c 0 6px, #0a1532 6px 12px)" }} />
          {!voting && !open && (
            <p className="absolute inset-x-0 top-10 text-center text-[12px] text-[#ffe7a6d9]">
              {note && t !== null && t < note.until ? note.text : myTurn || passing ? "Your turn" : "Your cards"}
            </p>
          )}
          <div className="absolute inset-x-0 top-[74px]" style={{ height: cw, visibility: voting || open ? "hidden" : undefined }}>
            {rest.map(({ c, i }, k) => {
              const off = k - (n - 1) / 2;
              return (
                <button key={i} onClick={() => tapCard(i)} aria-label={c}
                  className="tt-card absolute top-0 rounded-[8px] shadow-[0_10px_18px_rgba(0,0,0,.6)] active:scale-95"
                  style={{ left: x0 + k * step, transform: `rotate(${off * (n <= 2 ? 6 : 4)}deg) translateY(${Math.abs(off) * 4}px)`, transformOrigin: "50% 120%" }}>
                  <CardFace c={c} width={cw} />
                </button>
              );
            })}
          </div>
          {!open && choices.length > 0 && (
            <div className="absolute inset-x-4 bottom-[18px] grid grid-cols-2 gap-2">
              {choices.map((o) => (
                <button key={o.key} onClick={() => { play("tap"); o.tap(); }} aria-pressed={o.on}
                  className={`${choices.length > 2 ? "h-11 text-[14px]" : "h-[52px] text-[15px]"} truncate rounded-2xl px-2 font-bold transition-transform active:scale-95 ${choices.length % 2 && o.key === "pass" ? "col-span-2" : ""}`}
                  style={o.on
                    ? { background: "linear-gradient(#3a2a08, #241804)", color: "#ffe7a6", boxShadow: "inset 0 0 0 2px #f7bb1f, 0 0 14px rgba(247,187,31,.45)" }
                    : { background: "linear-gradient(#0d1f4a, #061538)", color: "#ffe7a6", boxShadow: "inset 0 0 0 1.5px rgba(247,187,31,.6)" }}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {!open && (passReady || playReady) && (
            <div className="absolute inset-x-4 bottom-[18px] h-[52px]">
              <button key={passReady ? "pass" : up[0]}
                className="tt-pop size-full truncate rounded-2xl bg-gradient-to-b from-[#f7c94a] to-[#e0a020] px-4 text-[16px] font-bold text-[#2a1404] shadow-[inset_0_1px_0_#ffe7a6,0_4px_0_#8a5a08] active:translate-y-0.5"
                onClick={() => {
                  play("tap");
                  if (passReady) { const cards = up; setUp([]); onMove({ kind: "give", cards }); return; }
                  if (NO_NAMES.has(up[0])) { const card = up[0] as "FAISLA" | "BHUKAMP"; setUp([]); onMove({ kind: "play", card }); return; }
                  setArmed(moment); // the names fill the bottom area
                }}>
                {passReady ? `Pass ${passN} to ${nextName}` : `Play ${CARD[up[0]].name}`}
              </button>
            </div>
          )}
        </div>
        <MatEdge />
        {/* the raised cards, in your profile space (your role card hides under them) */}
        {!voting && up.length > 0 && (
          <RaisedCards cards={up} onDrop={shooting ? null : (k) => drop(selIdx[k])} onClose={shooting ? null : () => { play("tap"); setUp([]); }} />
        )}
        {shooting && up.length === 0 && <RaisedCards cards={["TEER_KAMAN", "TEER_KAMAN"]} onDrop={null} onClose={null} />}
        {open && (
          <CardPanel key={open} card={open} view={view} myTurn={myTurn} thief={thief} shooting={shooting}
            picked={picked} setPicked={setPicked}
            onMove={(m) => { play("tap"); if (m.kind !== "teer_kaman") setUp([]); onMove(m); }} />
        )}

        {/* the Faisla vote opens on every living player's phone (owner 2026-11-20) */}
        {view.phase.kind === "vote" && me?.alive && <VoteSheet view={view} onMove={onMove} />}

        {/* the big moments' films, over everything (owner 2026-11-20) */}
        <FilmLayer view={view} />

      </div>
    </div>
  );
}

/** printed faces are 600×513; one card raised = 140 wide, two = 128 each, three = 104 each. Tap one to drop it back. */
function RaisedCards({ cards, onDrop, onClose }: { cards: Card[]; onDrop: ((k: number) => void) | null; onClose: (() => void) | null }) {
  const w = cards.length === 1 ? 140 : cards.length === 2 ? 128 : 104, gap = cards.length === 3 ? 8 : 12;
  const h = Math.round(w * (513 / 600));
  const total = cards.length * w + (cards.length - 1) * gap;
  const top = HAND_TOP - h - 6;
  return (
    <>
      {cards.map((c, k) => (
        <button key={`${k}:${c}`} onClick={() => onDrop?.(k)} disabled={!onDrop} aria-label={`${c}, raised`}
          className="tt-rise absolute z-[6] rounded-[8px] shadow-[0_0_0_3px_#f7bb1f,0_0_26px_rgba(247,187,31,.55),0_14px_30px_rgba(0,0,0,.6)]"
          style={{ left: (W - total) / 2 + k * (w + gap), top }}>
          <CardFace c={c} width={w} />
        </button>
      ))}
      {onClose && (
        <button onClick={onClose} aria-label="Back to your cards"
          className="absolute z-[6] grid size-11 place-items-center rounded-xl bg-[#021230e6] text-[#f7bb1f] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)] active:scale-95"
          style={{ left: (W + total) / 2 + 10, top }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
        </button>
      )}
    </>
  );
}
