"use client";
// THE TABLE (owner + team 2026-11-19, approved sketch "village-classy" with the dusk plum circle): the night
// village, players as the card back round the courtyard (your seat shows your role card), the centre panel with
// whose turn it is and what just happened, the countdown top right, your real cards on the mat. Tap a card → it
// rises into your profile space. PLAY and PASS are the same move (owner 2026-11-21): raise a PAIR -> one gold button
// plays it (CardPanel asks who); raise 2 different cards -> they are the 2 you keep, one gold button "Pass 3 to Riya".
// No separate Pass button. Stones rise only on your own turn. One fixed design size (layout.ts) scaled to the phone.
import { useEffect, useState, useSyncExternalStore } from "react";
import { play } from "@/lib/sfx";
import { besideMe, type Card, type Move, type Talk } from "@/rules/game";
import type { TableView } from "@/server/game";
import { Centre } from "./Centre";
import { RolesSheet } from "./RolesSheet";
import { FilmLayer } from "./FilmLayer";
import { notes as knownNotes, publicTags, type Claim } from "./knowledge";
import { SecretLayer } from "./SecretLayer";
import { GearButton, SettingsSheet } from "./SettingsSheet";
import { ProfileBox } from "./ProfileBox";
import { WhisperPanel } from "./WhisperPanel";
import { AnswerPanel } from "./AnswerPanel";
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
export function useScale() { return useSyncExternalStore(subscribe, fit, () => 1); }

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
/** when this phone first saw each talk line (by event n + text): its bubble shows for 7 s from then */
const HEARD = new Map<string, number>();

export function Table({ view, deadline, now, total = 20, onMove, initialOpen = null, voice = null, bots = [], onWhisper, onTell, initialBox = null }: {
  view: TableView; deadline: number | null; now: () => number; total?: number; onMove: (m: Move) => void;
  /** the bots' seats (they get tags, not chat) */
  bots?: number[];
  /** dev preview only: start with this seat's box open */
  initialBox?: number | null;
  /** send a private chat line to one player (owner 2026-11-22) */
  onWhisper?: (to: number, text: string) => Promise<boolean>;
  /** (2026-11-23) a ready-made whisper (a role, your Stones) to the player beside you — bots read these */
  onTell?: (to: number, talk: Talk) => Promise<boolean>;
  /** table voice (TableScreen owns the call): the mic button + who is talking */
  voice?: VoiceControls | null;
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
  // [1.4c] roles in play: shown once when a game opens (before anyone has passed), and on tapping ROUND in the middle.
  // (owner 2026-11-23: "let both be there, be safe") kept as well as the roles face up in the lobby
  const [rolesOpen, setRolesOpen] = useState(() => {
    if (initialBox !== null || view.phase.kind === "over") return false; // dev preview of the player box · the game already ended
    // once per game per phone (a game = its players + roles); round 1 only
    const k = `tunga:roles-seen:${view.players.map((p) => p.name).join("|")}:${view.rolesInPlay.join("|")}`;
    try { if (view.round !== 1 || sessionStorage.getItem(k)) return false; sessionStorage.setItem(k, "1"); } catch { return view.round === 1; }
    return true;
  });
  const [who, setWho] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);
  // TAP A PLAYER (owner 2026-11-22): the box (Chat + tags), the chat itself, what you have read
  const [box, setBox] = useState<number | null>(initialBox);
  const [chatWith, setChatWith] = useState<number | null>(null);
  // (owner 2026-11-23) answering a question put to you, or whispering a fact to the bot beside you
  const [skipped, setSkipped] = useState<number[]>([]);
  const lastN = view.events.at(-1)?.n ?? 0;
  const [readTo, setReadTo] = useState<Record<number, number>>({});
  const [openedAt] = useState(lastN);
  const [armed, setArmed] = useState<string | null>(null); // "Play Kundli" pressed: the names fill the bottom area
  const [passMode, setPassMode] = useState<string | null>(null); // "Pass 3 cards" pressed: every tap raises ONE card
  const shooting = view.phase.kind === "aim" && view.phase.shooter === you; // [3.7] Teer Kaman step 2
  const voting = view.phase.kind === "vote" && Boolean(me?.alive);
  const passing = view.phase.kind === "pass" && view.phase.seat === you; // after Faisla / a hit / Dal Badal: choose what you pass
  // [3.6] Bhukamp: every living player raises ONE card for the next player; picks are secret until all have picked
  const quaking = view.phase.kind === "bhukamp" && Boolean(me?.alive) && !(String(you) in view.phase.picks);
  const quakeDone = view.phase.kind === "bhukamp" && Boolean(me?.alive) && !quaking;
  const giving = view.phase.kind === "gift" && view.phase.seat === you; // [5.5] you are out: give the extra vote
  const out = Boolean(me) && !me!.alive;
  const selIdx = (sel.at === "" || sel.at === moment ? sel.idx : []).filter((i) => i < hand.length);
  const up = selIdx.map((i) => hand[i]);
  const setUp = (idx: number[], arm = false) => { setPicked([]); setArmed(arm ? moment : null); setSel({ idx, at: moment }); };

  // RAISED CARDS ARE THE CARDS LEAVING YOUR HAND (owner 2026-11-21): a pair to play, or the 3 you pass
  const passN = view.phase.kind === "pass" && passing ? Math.min(3, hand.length - view.phase.keep) : Math.min(3, Math.max(0, hand.length - 2));
  const thief = me?.side === "T";
  const playable = (c: Card) => !isStoneCard(c) && c !== "DAL_BADAL";
  const pair = up.length === 2 && up[0] === up[1] && playable(up[0]);
  // (owner 2026-11-23) Dal Badal is played holding 2 cards: Dal Badal + the one you keep; the other 3 go on by themselves
  const dalPick = up.length === 1 && up[0] === "DAL_BADAL" && thief && myTurn;
  const dalReady = up.length === 2 && up[0] === "DAL_BADAL" && thief;
  const playReady = myTurn && (pair || dalReady);
  // the card whose screen fills the bottom area (CardPanel), if any
  const open: Card | null = voting ? null : shooting ? "TEER_KAMAN"
    : playReady && armed === moment && !NO_NAMES.has(up[0]) ? up[0]
    : !myTurn && !passing && !quaking && up.length === 1 ? up[0] : null;
  const passReady = !open && (myTurn || passing) && passN > 0 && up.length === passN;
  const nextName = (() => {
    const n = view.players.length;
    for (let k = 1; k <= n; k++) { const p = view.players[(you + k) % n]; if (p?.alive) return p.name; }
    return "";
  })();

  const tapCard = (i: number) => {
    play("tap");
    if (quaking) { setUp([i]); return; } // one card, any card, Stones too [3.6]
    if (myTurn || passing) { // your turn: any card rises, Stones too (owner 2026-11-21)
      if (myTurn && selIdx.length === 0 && passMode !== moment && playable(hand[i])) {
        const twin = hand.findIndex((c, j) => j !== i && c === hand[i]);
        if (twin >= 0) { setUp([i, twin]); return; } // the FIRST card you tap brings its pair up with it
      }
      if (myTurn && thief && selIdx.length === 1 && hand[selIdx[0]] === "DAL_BADAL" && passMode !== moment) { setUp([...selIdx, i], true); return; } // + the card you keep
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
    if (thief && db >= 0) choices.push({ key: "DAL_BADAL", label: "Play Dal Badal", on: false, tap: () => { setPassMode(null); setUp([db]); } });
    if (passN > 0) choices.push({ key: "pass", label: `Pass ${passN} cards`, on: passMode === moment, tap: () => setPassMode(moment) });
  }
  const drop = (i: number) => { play("tap"); setUp(selIdx.filter((x) => x !== i)); };
  const left = deadline && t !== null ? Math.max(0, (deadline - t) / 1000) : null;

  // WHAT EVERYONE DID THIS ROUND (a tag on their seat), WHAT THEY SAID (a bubble for 7 s) — owner 2026-11-21
  // (owner 2026-11-24: "when I play the pair, whether a person passed or played is lost") each seat keeps its LAST move
  // until that player makes a new one — a new round no longer wipes every tag (a pair played last in a round did that)
  const doing: Record<number, string> = {};
  const fresh: Record<number, boolean> = {}; // their turn began and they haven't played yet this turn
  for (const e of view.events) {
    const d = (e.data ?? {}) as { seat?: number; card?: string; target?: number; hit?: boolean };
    if (typeof d.seat !== "number") continue;
    const who = (x?: number) => (x === undefined ? "" : x === you ? "you" : view.players[x]?.name ?? "");
    // (owner 2026-11-23: "the pass signal is fake") the 3 cards that go on after a pair / Dal Badal / Bhukamp are not a
    // choice to pass: only a turn where they played nothing shows "Passed"
    if (e.type === "turn") fresh[d.seat] = true;
    else if (e.type === "pass") { if (fresh[d.seat] && !(e.data as { auto?: boolean }).auto) doing[d.seat] = "Passed"; fresh[d.seat] = false; }
    else if (e.type === "play" && d.card) { fresh[d.seat] = false; doing[d.seat] = `${CARD[d.card as Card].name}${d.target !== undefined ? ` on ${who(d.target)}` : ""}`; }
    else if (e.type === "teer_kaman") { fresh[d.seat] = false; doing[d.seat] = `Teer Kaman ${d.hit ? "HIT" : "missed"} ${who(d.target)}`; }
    else if (e.type === "dal_badal") { fresh[d.seat] = false; doing[d.seat] = "Dal Badal"; }
  }
  const saying: Record<number, { text: string; key: number }> = {};
  for (const e of view.events) {
    const dd = (e.data ?? {}) as { seat?: number; to?: number };
    // (owner 2026-11-23) a whisper TO YOU shows as a bubble over the one who whispered (only on your phone)
    const toMe = e.type === "whisper" && dd.to === you && dd.seat !== you;
    if (e.type !== "say" && e.type !== "chat" && !toMe) continue;
    const seat = dd.seat;
    if (typeof seat !== "number") continue;
    const k = `${e.n}:${e.msg}`;
    if (!HEARD.has(k) && t !== null) HEARD.set(k, t);
    const at = HEARD.get(k) ?? 0;
    if (t !== null && t - at < (toMe ? 7000 : 4000)) { for (const k of Object.keys(saying)) delete saying[+k]; saying[seat] = { text: toMe ? `🤫 ${e.msg}` : e.msg.slice(e.msg.indexOf(":") + 1).trim(), key: e.n }; }
  } // (owner 2026-11-23) ONE bubble at a time — only the latest speaker — for 4 s (was every speaker for 7 s)
  // whispers: who whispered in the last 5 s (everyone sees that), and what you haven't read
  const whispering: number[] = [];
  const unread: Record<number, number> = {};
  for (const e of view.events) {
    const d = (e.data ?? {}) as { seat?: number; to?: number };
    if (e.type === "whisper_seen" && typeof d.seat === "number") {
      const k = `${e.n}:w`;
      if (!HEARD.has(k) && t !== null) HEARD.set(k, t);
      if (t !== null && t - (HEARD.get(k) ?? 0) < 5000) whispering.push(d.seat, d.to!);
    }
    if (e.type === "whisper" && d.to === you && typeof d.seat === "number" && d.seat !== chatWith && e.n > (readTo[d.seat] ?? openedAt))
      unread[d.seat] = (unread[d.seat] ?? 0) + 1;
  }
  const openChat = (s: number | null) => { if (chatWith !== null) setReadTo((r) => ({ ...r, [chatWith]: lastN })); if (s !== null) setReadTo((r) => ({ ...r, [s]: lastN })); setChatWith(s); };
  // PUBLIC TAGS (owner 2026-11-22: "tags are public"): a tag is said out loud about that player; tap again = take it back
  const said = publicTags(view.events);
  const mine = (seat: number) => (Object.entries(said[seat] ?? {}) as [Claim, number[]][]).filter(([, who]) => who.includes(you)).map(([c]) => c);
  const tag = (seat: number, c: Claim) => {
    const on = mine(seat).includes(c);
    // (owner 2026-11-23: "no way to inform that a player doesn't have stone")
    if (c === "No Stone") { onMove({ kind: "say", talk: on ? { t: "retract", target: seat, what: "stone" } : { t: "stone", target: seat, has: false } }); return; }
    if (c === "Villager" || c === "Thief") {
      onMove({ kind: "say", talk: on ? { t: "retract", target: seat } : c === "Villager" ? { t: "vouch", target: seat } : { t: "accuse", target: seat } });
      return;
    }
    onMove({ kind: "say", talk: { t: "stone", target: seat, has: !on, which: c === "Tunga" ? "TUNGA_STONE" : "BHADRA_STONE" } });
  };
  // A QUESTION PUT TO YOU (owner 2026-11-23): the latest "what is your role?" / "do you have a Stone?" this round that you
  // haven't answered (said or whispered a role or a Stone after it) or closed
  const asked = (() => {
    if (!me?.alive || view.phase.kind === "over") return null;
    const roundAt = [...view.events].reverse().find((e) => e.type === "round")?.n ?? 0;
    let q: { n: number; from: number; what: "role" | "stone"; priv: boolean } | null = null;
    for (const e of view.events) {
      if (e.n < roundAt) continue;
      const d = (e.data ?? {}) as { seat?: number; to?: number; talk?: Talk };
      const k = d.talk;
      if (k?.t === "ask" && k.target === you && typeof d.seat === "number" && d.seat !== you && (e.type === "say" || (e.type === "whisper" && d.to === you)))
        q = { n: e.n, from: d.seat, what: k.what, priv: e.type === "whisper" };
      else if (q && d.seat === you && (e.type === "say" || e.type === "whisper") && (k?.t === "claim" || k?.t === "stone")) q = null;
    }
    return q && !skipped.includes(q.n) ? q : null;
  })();
  const freeHands = !open && !voting && !giving && box === null;
  const whisperSeat = chatWith ?? (asked?.priv && freeHands ? asked.from : null);
  const preset = asked?.priv && asked.from === whisperSeat ? asked.what : null;
  useTableSounds(view, left);

  // your cards in their printed near-square shape: big when you hold 2, smaller and overlapping when you hold 5
  const rest = hand.map((c, i) => ({ c, i })).filter(({ i }) => !selIdx.includes(i));
  const n = rest.length;
  const cw = n <= 2 ? 118 : n === 3 ? 108 : 92; // (owner 2026-11-23: smaller; was 150/124/100)
  const step = n > 1 ? Math.min(cw + 16, (W - 24 - cw) / (n - 1)) : 0;
  const x0 = (W - (cw + step * (n - 1))) / 2;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#15142c]">
      <div className="absolute left-1/2 top-1/2 origin-center" style={{ width: W, height: H, transform: `translate(-50%,-50%) scale(${scale})`, fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
        <VillageScene />

        <div className="absolute inset-x-3.5 top-3 z-10 flex h-[46px] items-center justify-between">
          <div className="flex gap-2">
            {voice && <MicButton voice={voice} />}
            <GearButton onTap={() => setSettings(true)} />
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

        <Centre view={view} onRoles={() => { play("tap"); setRolesOpen(true); }} />
        <Seats players={view.players} you={you} myRole={me?.role ?? null} active={activeSeats(view)} reveal={view.phase.kind === "over"} picked={open || giving ? picked : []} talking={voice?.talking} muted={voice?.muted} doing={doing} saying={saying} notes={knownNotes(view.events, you)} whispering={whispering} unread={unread} says={said}
          onSeat={!open && !voting && !giving && up.length === 0 ? (s) => { play("tap"); if (s !== you && me?.alive && besideMe(view.players, you).includes(s) && view.phase.kind !== "over") openChat(s); else setBox(s); } : undefined} hideYou={(!voting && up.length > 0) || shooting}
          votes={view.phase.kind === "vote" ? liveCount(view.phase, view.extraVote) : undefined} />
        <VoteResult view={view} />

        <div className="absolute inset-x-0 bottom-0 z-[1]" style={{ top: HAND_TOP }}>
          <div className="absolute inset-0 shadow-[0_-10px_24px_rgba(0,0,0,.5)]" style={{ background: "linear-gradient(rgba(2,10,30,.35), rgba(2,8,24,.9)), repeating-linear-gradient(90deg, rgba(255,231,166,.035) 0 1px, transparent 1px 12px), repeating-linear-gradient(0deg, #0e1a3c 0 6px, #0a1532 6px 12px)" }} />
          {!voting && !open && !giving && view.phase.kind !== "over" && (
            <p className="absolute inset-x-0 top-[22px] text-center text-[12px] text-[#ffe7a6d9]">
              {note && t !== null && t < note.until ? note.text
                : quaking ? `Bhukamp · 1 card goes to ${nextName}`
                : quakeDone ? "Waiting for the others"
                : out ? "You're out · you can still talk"
                : dalPick ? "Tap the card you keep with Dal Badal"
                : myTurn || passing ? "Your turn" : "Your cards"}
            </p>
          )}
          <div className="absolute inset-x-0 top-[44px]" style={{ height: cw, visibility: voting || open || view.phase.kind === "over" ? "hidden" : undefined }}>
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
            <div className="absolute inset-x-4 bottom-[12px] grid grid-cols-2 gap-2">
              {choices.map((o) => (
                <button key={o.key} onClick={() => { play("tap"); o.tap(); }} aria-pressed={o.on}
                  className={`${choices.length > 2 ? "h-10 text-[14px]" : "h-[46px] text-[15px]"} truncate rounded-2xl px-2 font-bold transition-transform active:scale-95 ${choices.length % 2 && o.key === "pass" ? "col-span-2" : ""}`}
                  style={o.on
                    ? { background: "linear-gradient(#3a2a08, #241804)", color: "#ffe7a6", boxShadow: "inset 0 0 0 2px #f7bb1f, 0 0 14px rgba(247,187,31,.45)" }
                    : { background: "linear-gradient(#0d1f4a, #061538)", color: "#ffe7a6", boxShadow: "inset 0 0 0 1.5px rgba(247,187,31,.6)" }}>
                  {o.label}
                </button>
              ))}
            </div>
          )}
          {quaking && up.length === 1 && (
            <div className="absolute inset-x-4 bottom-[12px] h-[46px]">
              <button key="quake"
                className="tt-pop size-full truncate rounded-2xl bg-gradient-to-b from-[#f7c94a] to-[#e0a020] px-4 text-[16px] font-bold text-[#2a1404] shadow-[inset_0_1px_0_#ffe7a6,0_4px_0_#8a5a08] active:translate-y-0.5"
                onClick={() => { play("tap"); const card = up[0]; setUp([]); onMove({ kind: "bhukamp", card }); }}>
                {`Pass ${CARD[up[0]].name} to ${nextName}`}
              </button>
            </div>
          )}
          {!open && (passReady || playReady) && (
            <div className="absolute inset-x-4 bottom-[12px] h-[46px]">
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
          <CardPanel key={open} card={open} view={view} myTurn={myTurn} thief={thief} shooting={shooting} keep={open === "DAL_BADAL" && dalReady ? up[1] : undefined}
            picked={picked} setPicked={setPicked}
            onMove={(m) => { play("tap"); if (m.kind !== "teer_kaman") setUp([]); onMove(m); }} />
        )}

        {/* the Faisla vote opens on every living player's phone (owner 2026-11-20) */}
        {view.phase.kind === "vote" && me?.alive && <VoteSheet view={view} onMove={onMove} />}
        {who !== null && voice && <PlayerSheet key={who} name={view.players[who]?.name ?? ""} muted={voice.muted.includes(who)}
          onMute={(on) => voice.mute(who, on)} onReport={(reason) => voice.report(who, reason)} onClose={() => setWho(null)} />}
        {box !== null && (
          <ProfileBox view={view} seat={box} self={box === you} bot={box !== you && bots.includes(box)} canTell={Boolean(onTell)} unread={box === you ? 0 : unread[box] ?? 0}
            tags={mine(box)} onTag={(x) => tag(box, x)} onClose={() => setBox(null)}
            onChat={() => { openChat(box); setBox(null); }}
            onMore={voice && box !== you && !bots.includes(box) ? () => { setWho(box); setBox(null); } : null} />
        )}
        {/* a question said OUT LOUD to you: answer out loud */}
        {asked && !asked.priv && !open && !voting && !giving && chatWith === null && box === null && (
          <AnswerPanel key={asked.n} you={you} roles={view.rolesInPlay} mode={asked.what}
            title={`${view.players[asked.from]?.name ?? ""} asks: ${asked.what === "role" ? "what is your role?" : "do you have a Stone?"}`}
            sub="Your answer is said out loud · you may bluff"
            onSend={async (talks) => { for (const t of talks) onMove({ kind: "say", talk: t }); }}
            onClose={() => setSkipped((x) => [...x, asked.n])} />
        )}
        {/* THE WHISPER SCREEN (owner 2026-11-23): the player beside you, person or bot; a whispered question opens it with the answers up */}
        {whisperSeat !== null && (
          <WhisperPanel key={`${whisperSeat}:${preset ?? ""}`} view={view} seat={whisperSeat} bot={bots.includes(whisperSeat)} preset={preset}
            onSend={onWhisper ? (x) => onWhisper(whisperSeat, x) : null} onTell={onTell ?? null}
            onTags={whisperSeat !== you ? () => { const s = whisperSeat; openChat(null); setBox(s); } : null}
            onClose={() => { if (preset && asked) setSkipped((x) => [...x, asked.n]); openChat(null); }} />
        )}
        {giving && <GiftPanel view={view} picked={picked} setPicked={setPicked} onMove={(m) => { play("tap"); onMove(m); }} />}

        {rolesOpen && <RolesSheet roles={view.rolesInPlay} onClose={() => setRolesOpen(false)} />}
        {/* the big moments' films, over everything (owner 2026-11-20) */}
        <FilmLayer view={view} />
        {/* your private result (Kundli, Talashi, Hera Pheri, Teer Kaman, Bhukamp), after its film — owner 2026-11-22 */}
        <SecretLayer view={view} />
        {settings && <SettingsSheet onClose={() => setSettings(false)} />}

      </div>
    </div>
  );
}

/** printed faces are 600×513; one card raised = 112 wide, two = 100 each, three = 84 each (owner 2026-11-23: smaller). Tap one to drop it back. */
function RaisedCards({ cards, onDrop, onClose }: { cards: Card[]; onDrop: ((k: number) => void) | null; onClose: (() => void) | null }) {
  // (owner 2026-11-23: "whenever I play a pair, what people played is hidden") the raised cards covered the two seats
  // nearest your hand — their names and what they played. Now seat-sized, sitting just above your hand, below the seats.
  const w = cards.length === 1 ? 72 : cards.length === 2 ? 64 : 58, gap = 8;
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

/** [5.5] you are out: give your extra vote to a living player — name buttons + one gold button, like playing a card */
function GiftPanel({ view, picked, setPicked, onMove }: {
  view: TableView; picked: number[]; setPicked: (p: number[]) => void; onMove: (m: Move) => void;
}) {
  const living = view.players.filter((p) => p.alive);
  const to = picked[0];
  const cols = living.length > 9 ? 4 : 3;
  return (
    <div className="absolute inset-x-0 bottom-0 z-[3]" style={{ top: HAND_TOP }} role="group" aria-label="Give your extra vote">
      <div className="absolute inset-0" style={{ background: "linear-gradient(rgba(2,10,30,.6), rgba(2,8,24,.95))" }} />
      <p className="absolute inset-x-4 top-[18px] text-center text-[15px] font-semibold text-[#ffe7a6]">You&apos;re out · give your extra vote</p>
      <div className="absolute inset-x-4 top-[62px] grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {living.map((p) => {
          const on = to === p.seat;
          return (
            <button key={p.seat} onClick={() => setPicked([p.seat])} aria-pressed={on}
              className={`h-11 truncate rounded-xl px-2 font-semibold transition-transform active:scale-95 ${cols === 4 ? "text-[13.5px]" : "text-[15px]"}`}
              style={on
                ? { background: "linear-gradient(#3a2a08, #241804)", color: "#ffe7a6", boxShadow: "inset 0 0 0 2px #f7bb1f, 0 0 14px rgba(247,187,31,.45)" }
                : { background: "linear-gradient(#0d1f4a, #061538)", color: "#fff", boxShadow: "inset 0 0 0 1px rgba(247,187,31,.5)" }}>
              {p.name}
            </button>
          );
        })}
      </div>
      <div className="absolute inset-x-4 bottom-[12px] grid h-[46px] place-items-center">
        {to !== undefined ? (
          <button key={to} onClick={() => onMove({ kind: "gift", to })}
            className="tt-pop size-full truncate rounded-2xl bg-gradient-to-b from-[#f7c94a] to-[#e0a020] px-4 text-[16px] font-bold text-[#2a1404] shadow-[inset_0_1px_0_#ffe7a6,0_4px_0_#8a5a08] active:translate-y-0.5">
            {`Give my vote to ${view.players[to]?.name}`}
          </button>
        ) : <p className="text-[13px] text-[#ffe7a6b3]">Tap a name</p>}
      </div>
    </div>
  );
}

export interface VoiceControls {
  status: "unavailable" | "off" | "connecting" | "on" | "needs-tap";
  micOn: boolean; micBlocked: boolean; talking: number[];
  /** tap: join (off / needs a tap) or mute / unmute my mic */
  onTap: () => void;
  /** players I muted for myself; bots (no sheet for them) */
  muted: number[]; bots: number[];
  mute: (seat: number, on: boolean) => void;
  report: (seat: number, reason: string) => Promise<void>;
}

/** top left of the table: voice. Gold mic = you can be heard; slashed = muted; pulsing = tap to join the voice */
export function MicButton({ voice }: { voice: VoiceControls }) {
  const live = voice.status === "on";
  const heard = live && voice.micOn && !voice.micBlocked;
  const label = voice.status === "needs-tap" || voice.status === "off" ? "Tap to join the voice"
    : voice.status === "connecting" ? "Joining the voice" : voice.status === "unavailable" ? "Voice is not available"
    : voice.micBlocked ? "No microphone permission: you can listen" : heard ? "Mute my mic" : "Unmute my mic";
  return (
    <button onClick={() => { play("tap"); voice.onTap(); }} aria-label={label} title={label} disabled={voice.status === "unavailable"}
      className={`relative grid size-11 place-items-center rounded-xl active:scale-95 disabled:opacity-40 ${voice.status === "needs-tap" || voice.status === "off" ? "tt-pulse" : ""}`}
      style={{ background: heard ? "linear-gradient(#3a2a08, #241804)" : "#021230d1", color: heard ? "#f7bb1f" : "#ffe7a6b3", boxShadow: `inset 0 0 0 1.5px ${heard ? "#f7bb1f" : "rgba(247,187,31,.6)"}` }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        {!heard && <path d="M4 4l16 16" />}
      </svg>
    </button>
  );
}

export const REPORT_REASONS = ["Rude or abusive", "Asked for personal details", "Sexual or adult talk", "Seems under 18", "Cheating or spamming", "Something else"];

/** TAP A PLAYER (Play Store user-content rules, 2026-11-17 → new table 2026-11-21): mute them for yourself, or report
 *  them. A report is emailed to the owner (IT Rules 2021: acknowledge in 24 h). The game goes on as normal. */
function PlayerSheet({ name, muted, onMute, onReport, onClose }: {
  name: string; muted: boolean; onMute: (on: boolean) => void; onReport: (reason: string) => Promise<void>; onClose: () => void;
}) {
  const [step, setStep] = useState<"menu" | "report" | "sent">("menu");
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pill = (on: boolean) => on
    ? { background: "linear-gradient(#3a2a08, #241804)", color: "#ffe7a6", boxShadow: "inset 0 0 0 2px #f7bb1f" }
    : { background: "linear-gradient(#0d1f4a, #061538)", color: "#fff", boxShadow: "inset 0 0 0 1px rgba(247,187,31,.5)" };
  return (
    <div className="absolute inset-x-0 bottom-0 z-[7]" style={{ top: HAND_TOP }} role="dialog" aria-label={name}>
      <div className="absolute inset-0" style={{ background: "linear-gradient(#020a1e, #020818)" }} />
      <p className="absolute inset-x-[64px] top-[18px] truncate text-center text-[16px] font-semibold text-[#ffe7a6]">
        {step === "report" ? `Report ${name}` : step === "sent" ? "Thanks for telling us" : name}
      </p>
      <button onClick={onClose} aria-label="Close"
        className="absolute right-4 top-[8px] grid size-11 place-items-center rounded-xl bg-[#021230e6] text-[#f7bb1f] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)] active:scale-95">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
      </button>
      {step === "menu" && (
        <div className="absolute inset-x-4 top-[70px] flex flex-col gap-2">
          <button onClick={() => { play("tap"); onMute(!muted); onClose(); }} className="h-12 rounded-xl text-[15px] font-semibold active:scale-95" style={pill(false)}>
            {muted ? `Unmute ${name}` : `Mute ${name} for me`}
          </button>
          <button onClick={() => { play("tap"); setStep("report"); }} className="h-12 rounded-xl text-[15px] font-semibold active:scale-95" style={pill(false)}>
            Report {name}
          </button>
          <p className="px-2 text-center text-[12px] text-[#ffe7a6a6]">Only you stop hearing them. The game goes on.</p>
        </div>
      )}
      {step === "report" && (
        <>
          <div className="absolute inset-x-4 top-[62px] grid grid-cols-2 gap-2">
            {REPORT_REASONS.map((r) => (
              <button key={r} onClick={() => setReason(r)} aria-pressed={reason === r}
                className="h-11 truncate rounded-xl px-2 text-[13px] font-semibold active:scale-95" style={pill(reason === r)}>{r}</button>
            ))}
          </div>
          <div className="absolute inset-x-4 bottom-[12px] grid h-[46px] place-items-center">
            {reason ? (
              <button disabled={busy} onClick={async () => { play("tap"); setBusy(true); await onReport(reason); onMute(true); setStep("sent"); }}
                className="tt-pop size-full truncate rounded-2xl bg-gradient-to-b from-[#f7c94a] to-[#e0a020] px-4 text-[16px] font-bold text-[#2a1404] shadow-[inset_0_1px_0_#ffe7a6,0_4px_0_#8a5a08] active:translate-y-0.5 disabled:opacity-60">
                {busy ? "Sending…" : `Report ${name}`}
              </button>
            ) : <p className="text-[13px] text-[#ffe7a6b3]">What happened?</p>}
          </div>
        </>
      )}
      {step === "sent" && (
        <p className="absolute inset-x-6 top-[80px] text-center text-[14px] leading-relaxed text-[#ffe7a6d9]">
          We got your report and will look at it within 24 hours. {name} is muted for you.
        </p>
      )}
    </div>
  );
}
