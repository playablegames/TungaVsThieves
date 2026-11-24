// THE BOT BRAIN on the new rules (2026-11-17). Moved from src/server/deduce.ts (exact deduction, DeepRole-style) and
// docs/BOT_LOGIC.md (approved 2026-10-14: bots reason like players; nothing here exists to balance the game), plus the
// owner's 2026-11-17 points (docs/SITUATIONS.md): memory fades turn by turn, big moments fade slower, impressions stay,
// a hunch is said once and RESURFACES at big moments, nobody blabbers, out players keep talking.
//
// A bot holds every placement of the thieves round the table and its weight:
//   · facts DELETE placements (my role, my Kundli read, a role card shown to me, a Dal Badal thief's reveal, "the game
//     isn't over")
//   · everything else WEIGHS them (claims, accusations, ballots, Teer Kaman aims, Stone thefts), and that evidence fades
// A bot reads ONLY what its seat may see: public events, events sent to it, its own hand and role card.
import { next } from "./rng";
import {
  type Action, type Ballot, type Card, canDalBadal, closeVoteNow, isStone, living, type Move, move, newGame, nextLiving, type Side,
  type State, type Talk, tkRoles, waitingOn, ask, tell, besideMe,
} from "./game";

const THIEF_ROLES = ["Chor", "Lootera", "Gunda", "Daku"];
const sideOf = (role: string): Side => (THIEF_ROLES.includes(role) ? "T" : "V");
type R = { rng: number };

export type SkillName = "casual" | "average" | "sharp";
/** HUMAN HABITS (owner 2026-11-23, research in chat: Asch, cascades, babble, Bond & DePaulo, Mafia/Werewolf/Clocktower
 *  community tells). casual = a beginner, sharp = a skilled player. Each number is a chance (0-1) unless said. A bot's
 *  personality (from its name) scales each habit 0.6-1.4x, so the same name plays the same way every game. */
export interface Habits {
  herd: number; anchor: number; switchy: number; revenge: number; gut: number; bus: number; middle: number; liar: number;
  defensive: number; loud: number; truth: number; tunnel: number; evidence: number; counter: number; fight: number;
  flail: number; lurk: number; buddy: number; revouch: number; dupClaim: number; slip: number; emoji: number;
  pairAct: number; tkGut: number; blurt: number; faislaEarly: number; tkWrong: number; sit: number; careless: number;
  confirm: number; stoneSlip: number; dbMiss: number; stoneBait: number; hold: number; target: number; outTell: number;
  lastClaim: number; lieCatch: number;
}
export interface Skill extends Habits {
  name: SkillName;
  /** how much a turn-old SMALL piece of evidence still counts (claims, ballots) */
  memory: number;
  /** big moments (Kundli, Teer Kaman, a Stone stolen, a Dal Badal, a Faisla) fade this much slower */
  bigSlower: number;
  /** chance of pinning a remembered accusation on the wrong player (a neighbour) */
  mixUp: number;
  /** chance a thief bot tells a lie where it could (else silent) */
  lies: number;
}
// VOTING   herd: joins the leader (Asch/cascades) · anchor: the first ballot's weight (x) · switchy: last-second switch ·
//          revenge: votes its accuser · gut: votes on a feeling · bus: thief votes out a doomed partner (a common
//          MISTAKE, so beginners more) · middle: thief joins a pile-on in the middle, never first · liar: votes a caught liar
// READING  lieCatch: catches a provable lie (Bond & DePaulo 54%) · defensive: "defending = guilty" (wrong) · loud: follows
//          the most talkative (babble) · truth: believes claims (truth bias) · tunnel: locks on its first suspect ·
//          evidence: weighs accusations by what's behind them, reads "busy, never names", words vs votes, whisper pairs,
//          "jumps on a panicking player" (flailing data 35% vs 26%), a cheer at the wrong moment
// TALK     counter: accused -> accuses back · fight: speaks up for a trusted player on the block · flail: panics when
//          the vote is on it · lurk: thief talks without naming · buddy: thief befriends one villager · revouch: speaks
//          for trusted players again (goldfish memory) · dupClaim: thief claims a villager's role · slip: thief tells
//          two stories · emoji: thief cheers at a villager's fall
// CARDS    pairAct: plays a pair just to act · tkGut: Teer Kaman on a hunch · blurt: says a Talashi at once · faislaEarly ·
//          tkWrong: right side, wrong role · sit: never fires a weapon pair · careless: passes without a plan · confirm:
//          holding a result, says it again at the vote · stoneSlip: plays a pair and passes its Stone · dbMiss: Dal
//          Badal never/too early · stoneBait: thief fakes "I have the Stone" · hold: keeps a Kundli for a trusted
//          neighbour · target: thief aims at the obvious villager, the persuader, the hunter, the quiet one ·
//          outTell: out, tells all · lastClaim: last round, villagers claim the truth
export const SKILLS: Record<SkillName, Skill> = {
  casual: { name: "casual", memory: 0.8, bigSlower: 0.4, mixUp: 0.06, lies: 0.5, lieCatch: 0.55,
    herd: 0.7, anchor: 2, switchy: 0.4, revenge: 0.35, gut: 0.3, bus: 0.25, middle: 0, liar: 0.5,
    defensive: 0.6, loud: 0.5, truth: 0.6, tunnel: 0.5, evidence: 0, counter: 0.9, fight: 0.6, flail: 0.6, lurk: 0,
    buddy: 0, revouch: 0.3, dupClaim: 0, slip: 0.3, emoji: 0.3, pairAct: 0.4, tkGut: 0.3, blurt: 0.7, faislaEarly: 0.3,
    tkWrong: 0.4, sit: 0.25, careless: 0.5, confirm: 0.8, stoneSlip: 0.15, dbMiss: 0.3, stoneBait: 0, hold: 0.1,
    target: 0, outTell: 0.7, lastClaim: 0.5 },
  average: { name: "average", memory: 0.9, bigSlower: 0.4, mixUp: 0.03, lies: 0.75, lieCatch: 0.75,
    herd: 0.55, anchor: 1.5, switchy: 0.25, revenge: 0.2, gut: 0.18, bus: 0.17, middle: 0.3, liar: 0.65,
    defensive: 0.3, loud: 0.35, truth: 0.5, tunnel: 0.3, evidence: 0.5, counter: 0.75, fight: 0.65, flail: 0.45, lurk: 0.25,
    buddy: 0.2, revouch: 0.5, dupClaim: 0.15, slip: 0.15, emoji: 0.15, pairAct: 0.25, tkGut: 0.15, blurt: 0.5,
    faislaEarly: 0.15, tkWrong: 0.25, sit: 0.15, careless: 0.25, confirm: 0.55, stoneSlip: 0.08, dbMiss: 0.15,
    stoneBait: 0.15, hold: 0.25, target: 0.3, outTell: 0.6, lastClaim: 0.65 },
  sharp: { name: "sharp", memory: 0.97, bigSlower: 0.3, mixUp: 0, lies: 0.95, lieCatch: 0.95,
    herd: 0.4, anchor: 1, switchy: 0.15, revenge: 0.1, gut: 0.08, bus: 0.1, middle: 0.6, liar: 0.8,
    defensive: 0.1, loud: 0.2, truth: 0.4, tunnel: 0.1, evidence: 1, counter: 0.6, fight: 0.7, flail: 0.3, lurk: 0.5,
    buddy: 0.4, revouch: 0.7, dupClaim: 0.3, slip: 0.05, emoji: 0.05, pairAct: 0.1, tkGut: 0.05, blurt: 0.25,
    faislaEarly: 0.05, tkWrong: 0.1, sit: 0.05, careless: 0.05, confirm: 0.3, stoneSlip: 0.02, dbMiss: 0.05,
    stoneBait: 0.3, hold: 0.4, target: 0.6, outTell: 0.5, lastClaim: 0.8 },
};
/** BRAIN_HABITS=0 switches every habit off (the clean bots of 2026-11-22), for an A/B */
const HABITS_ON = ((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BRAIN_HABITS ?? "1") !== "0";
/** BRAIN_OFF=herd,gut,... switches single habits off, for an A/B */
const OFF = (((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BRAIN_OFF) ?? "").split(",");
const frac = (x: number) => x - Math.floor(x);
function hashStr(str: string) { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; }
/** a small stable number per name: how talkative that bot is (0.45-0.9) — and, through rate(), its whole personality */
export function talkyOf(name: string): number { return 0.45 + (hashStr(name) % 1000) / 1000 * 0.45; }

/** behaviour model (from deduce.ts MODEL) */
// feature switches for scripts/ab-brain.mts: K Kundli always spoken · S scheme (leverage + trust) · T Teer Kaman fired ·
// V live vote · P pressure · C passing on purpose · A asking for cards (owner 2026-11-21/22)
// L last pile safe · F final vote weighs Stones
// H hold the Stone (no pair play that would pass it on) · Q read the quiet-pass tell · X villagers hunt a quiet suspect
const EXP = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BRAIN_EXP ?? "KSTVPCALFHQX";
const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const TRY = ENV.BRAIN_TRY ?? "";
const M = { honest: 0.9, hunch: 1.6, ballot: 1.4, aim: 0.7, liar: 0.6, steal: 1.5 };
const BIG = new Set(["kundli", "teer_kaman", "robbed", "dal_badal", "tally"]);

/** one key per secret (who it is about + what) so each is told to each friend once */
function tellKey(k: Talk): string {
  return k.t === "claim" ? `me:${k.role}` : "target" in k ? `${k.t}:${k.target}:${"role" in k ? k.role : ""}` : k.t;
}

function placements(n: number, k: number): number[] {
  const out: number[] = [];
  const go = (start: number, left: number, mask: number) => {
    if (!left) { out.push(mask); return; }
    for (let i = start; i <= n - left; i++) go(i + 1, left - 1, mask | (1 << i));
  };
  go(0, k, 0);
  return out;
}
function permutations(n: number): number[][] {
  if (n <= 1) return [[0]];
  return permutations(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]));
}

export class Brain {
  H: number[]; index: Map<number, number>;
  /** facts: 1 = possible, 0 = ruled out (never fades) */
  fact: Float64Array;
  /** fading evidence, as log-weights: small fades by memory per turn, big by memory^bigSlower */
  small: Float64Array; big: Float64Array;
  seen = 0; turns = 0;
  /** my facts about roles */
  known: Record<number, string> = {};
  stone: Record<number, number> = {};
  /** (owner 2026-11-24: "bots find the last Stone") W: a Stone moves with the cards — the chance the face-down pile holds
   *  one, what a player keeps after a forced pass (the 2 they took), and whether this turn's player played Dal Badal */
  pileStone = 0; keepStone: Record<number, number> = {}; dbBy = -1;
  claims: Record<number, string> = {};
  /** (owner 2026-11-21: "why can't bots pass info to bots they trust") roles OTHERS say they saw (Kundli): seat → { role, from } */
  told: Record<number, { role: string; from: number }> = {};
  accusedMe: Record<number, number> = {};
  /** (owner 2026-11-22: "whoever loses the Stone knows where it is — leverage") Stones I passed or lost: seat → which */
  stoneWent: Record<number, Card[]> = {};
  /** the big plays I have already made with what I know (said once each) */
  played = new Set<string>();
  /** the round the log has reached as I read it */
  atRound = 1;
  /** whose turn it is, did they play, and how often each player has passed without playing (the Stone tell) */
  turnOf = -1; turnPlayed = false; quiet: Record<number, number> = {};
  /** questions put to ME (owner 2026-11-22): who asked, what, and whether by whisper — I choose whether and how to answer */
  askedMe: { from: number; what: "role" | "stone"; priv: boolean }[] = [];
  private hearingPrivate = false;
  /** secrets I want to tell this call, each to ONE player I trust (a whisper) */
  tells: { to: number; talk: Talk }[] = [];
  /** cards I want to ask for this call: whispered to the player who passes to me */
  asks: { to: number; card: Card }[] = [];
  /** who asked ME for a card (the latest ask from each player) */
  askedBy: Record<number, Card> = {};
  /** hunches already said (so nobody blabbers) and the big moment they last resurfaced at */
  hunched = new Set<number>(); resurfaced = -1; hunchRound = 0;
  /** accusers I already answered (nobody blabbers: one answer per accuser) */
  answered = new Set<number>();
  /** how many times the table has pointed at each player (accusations, "I saw a thief role") — the table's mood */
  pointed: Record<number, number> = {};
  private pCache: { at: number; alive: number; p: number[] } | null = null;
  out: Talk[] = [];
  /** verdicts that needed my hand at the time (a Talashi claim about me), by event number: given (a rebuilt bot) and made */
  notes = new Map<number, boolean>();
  noted: [number, boolean][] = [];
  n: number; K: number;
  /** habits' memory (all rebuilt the same from the log): how much each player talked / named someone, who accused whom,
   *  caught liars, whispers between two players, who voted for me or a known partner, how often a player was vouched */
  said: Record<number, number> = {}; named: Record<number, number> = {}; accusedBy: Record<number, Set<number>> = {};
  liars = new Set<number>(); wp: Record<string, number> = {}; hunter: Record<number, number> = {}; vouched: Record<number, number> = {};
  firstHunch: number | null = null; myClaim: string | null = null; lastOut: number | null = null; outAt = -1; gone = new Set<number>();
  private salt: number;

  constructor(public seat: number, public skill: Skill, public talky: number, s: State) {
    this.salt = hashStr(s.players.map((q) => q.name).join("|") + s.rolesInPlay.join(","));
    this.n = s.players.length;
    this.K = s.rolesInPlay.filter((r) => sideOf(r) === "T").length; // [1.4c] the count is public
    this.H = placements(this.n, this.K);
    this.index = new Map(this.H.map((h, i) => [h, i]));
    this.fact = new Float64Array(this.H.length).fill(1);
    this.small = new Float64Array(this.H.length);
    this.big = new Float64Array(this.H.length);
  }
  isT(h: number, x: number) { return (h >> x) & 1; }
  /** a habit's chance for THIS bot: its skill's rate x its personality (0.6-1.4, fixed by its talkiness = its name) */
  rate(k: keyof Habits): number {
    if (!HABITS_ON) return k === "lieCatch" || k === "anchor" ? 1 : k === "counter" || k === "blurt" ? this.talky * 0.7 : 0;
    const v = OFF.includes(k) ? (k === "anchor" || k === "lieCatch" ? 1 : 0) : this.skill[k];
    if (k === "anchor" || k === "lieCatch") return v;
    return Math.max(0, Math.min(1, v * (0.6 + 0.8 * frac(Math.sin(this.talky * 10007 + (hashStr(k) % 997)) * 43758.5453))));
  }
  /** a fixed coin for one decision (the same on every server rebuild of this bot in this game) */
  roll(key: string): number { return frac(Math.sin((this.salt % 100003) + (this.seat + 1) * 7919 + (hashStr(key) % 100019)) * 43758.5453); }
  /** did I already say something since event n (matching f)? (once-per-vote / once-per-round talk, kept in the log) */
  saidSince(s: State, n: number, f: (k: Talk) => boolean = () => true): boolean {
    for (let i = Math.max(0, n); i < s.events.length; i++) {
      const e = s.events[i]; const d = e.data as { seat?: number; talk?: Talk } | undefined;
      if (e.type === "say" && d?.seat === this.seat && d.talk && f(d.talk)) return true;
    }
    return false;
  }
  roundStart(s: State): number { for (let i = s.events.length - 1; i >= 0; i--) if (s.events[i].type === "round") return i; return 0; }
  /** someone I trust: known to be on my side, or (a villager) clearly less suspect than an unknown seat */
  trusts(s: State, x: number): boolean { return this.known[x] ? sideOf(this.known[x]) === this.side(s) : this.side(s) === "V" && this.p(s)[x] < this.trust(0.15); }
  /** (kept 2026-11-23, off with BRAIN_TRY=-R) "below x is someone I trust" was tuned at 5 players (an unknown seat = 25% thief). At 12 players an
   *  unknown seat is 45% thief, so nobody ever got under 0.2 and villagers never trusted, told or traded. Scale the bar. */
  trust(x: number) { const prior = this.K / Math.max(1, this.n - 1); return !TRY.includes("-R") ? Math.min(x * prior / 0.25, prior * 0.9) : x; }
  me(s: State) { return s.players[this.seat]; }
  side(s: State) { return this.me(s).side; }
  /** my side as far as the events read so far go — what a weight must use, so reading the log later gives the same */
  sideThen(s: State): Side { const r = this.known[this.seat]; return r ? sideOf(r) : this.side(s); }

  private setFact(x: number, side: Side) {
    this.pCache = null; for (let i = 0; i < this.H.length; i++) if ((this.isT(this.H[i], x) === 1) !== (side === "T")) this.fact[i] = 0; }
  private weigh(type: string, f: (h: number) => number) {
    this.pCache = null;
    const L = BIG.has(type) ? this.big : this.small;
    for (let i = 0; i < this.H.length; i++) { const v = f(this.H[i]); L[i] += Math.log(Math.max(v, 1e-6)); }
  }
  /** one turn passes: evidence fades (impressions stay — the log-weights shrink toward even, they don't vanish) */
  private fade() {
    this.pCache = null;
    // memory is per ROUND (a round is n turns): people remember the last round well, earlier rounds less
    const a = Math.pow(this.skill.memory, 1 / this.n), b = Math.pow(a, this.skill.bigSlower);
    for (let i = 0; i < this.H.length; i++) { this.small[i] *= a; this.big[i] *= b; }
  }

  /** P(thief) for every seat */
  p(s: State): number[] {
    const alive = s.players.reduce((a, q) => (q.alive ? a | (1 << q.seat) : a), 0);
    if (this.pCache && this.pCache.at === this.seen && this.pCache.alive === alive) return this.pCache.p;
    const res = this.pRaw(alive);
    this.pCache = { at: this.seen, alive, p: res };
    return res;
  }
  private pRaw(alive: number): number[] {
    const w = this.H.map((h, i) => (this.fact[i] && (h & alive) ? Math.exp(this.small[i] + this.big[i]) : 0));
    let t = w.reduce((a, b) => a + b, 0);
    if (!t) { w.fill(1); t = w.length; }
    const out = Array<number>(this.n).fill(0);
    this.H.forEach((h, i) => { for (let x = 0; x < this.n; x++) if (this.isT(h, x)) out[x] += w[i] / t; });
    return out;
  }

  /** a deterministic little coin per (bot, event) — for mix-ups */
  private coin(n: number) { const x = Math.sin((this.seat + 1) * 9301 + n * 49297) * 233280; return x - Math.floor(x); }

  /** W — FOLLOW THE STONES (owner 2026-11-24): a Stone can't be played, so it travels only with passed cards. Every
   *  public move tells me where a Stone I believed in has gone: a forced pass (after a pair) sends ALL of it to the pile,
   *  a chosen pass sends some, the next player picks the pile up, Hera Pheri / a hit / a Faisla-out hand the 2 taken cards
   *  to the player who took them, an out player holds nothing. Once I know where both Stones are, nobody else has one. */
  private follow(type: string, d: Record<string, unknown>, actor: number | undefined, myStones: number) {
    const me = this.seat, st = this.stone;
    const or = (a: number, b: number) => 1 - (1 - a) * (1 - b);
    switch (type) {
      case "turn":
        if (actor !== undefined && actor !== me) st[actor] = or(st[actor] ?? 0, this.pileStone);
        this.pileStone = 0; this.dbBy = -1;
        break;
      case "dal_badal": if (actor === this.turnOf) this.dbBy = actor; break;
      case "play":
        if (d.card === "HERA_PHERI" && actor !== undefined && typeof d.target === "number" && actor !== me) {
          this.keepStone[actor] = d.target === me ? 0 : st[d.target] ?? 0; // what I lost, the "robbed" event tells me
          if (d.target !== me) st[d.target] = 0; // they draw 2 fresh cards — no Stone is in the deck
        }
        break;
      case "out": {
        const v = d.seat as number | undefined;
        if (v === undefined || v === me) break;
        if (v === this.turnOf) this.pileStone = or(this.pileStone, st[v] ?? 0); // a missed shot / a caller out: their 3 are the pile
        else if (this.turnOf !== me && this.keepStone[this.turnOf] === undefined) this.keepStone[this.turnOf] = st[v] ?? 0; // hit / Faisla-out: the 2 go to the taker
        st[v] = 0;
        break;
      }
      case "pass": {
        if (actor === undefined || actor === me) { this.pileStone = 0; delete this.keepStone[me]; break; } // mine: "gave" says
        const had = st[actor] ?? 0;
        const share = !d.auto ? 0.35 : this.dbBy === actor ? 0.75 : 1;
        this.pileStone = had * share;
        st[actor] = this.keepStone[actor] !== undefined ? this.keepStone[actor] : had * (1 - share);
        delete this.keepStone[actor];
        break;
      }
    }
    // both Stones found (in my hand or known for sure): nobody else holds one
    const sure = Object.entries(st).filter(([x, v]) => Number(x) !== me && v >= 0.99).map(([x]) => Number(x));
    if (myStones + sure.length >= 2) {
      for (const x of Object.keys(st)) if (!sure.includes(Number(x)) && Number(x) !== me) st[Number(x)] = 0;
      this.pileStone = 0;
    }
  }

  read(s: State, r: R) {
    for (; this.seen < s.events.length; this.seen++) {
      const e = s.events[this.seen];
      if (e.to !== "all" && !e.to.includes(this.seat)) continue;
      const d = (e.data ?? {}) as Record<string, unknown>;
      const actor = d.seat as number | undefined;
      let target = d.target as number | undefined;
      if ((e.type === "play" || e.type === "dal_badal") && actor === this.turnOf) this.turnPlayed = true;
      if (EXP.includes("W") && e.to === "all") this.follow(e.type, d, actor, (s.players[this.seat]?.hand ?? []).filter(isStone).length);
      switch (e.type) {
        case "turn": this.turns++; this.fade(); this.turnOf = actor ?? -1; this.turnPlayed = false; break;
        case "role": this.known[this.seat] = d.role as string; this.setFact(this.seat, d.side as Side); break;
        case "kundli": case "teer_kaman_shown": {
          const role = d.role as string;
          this.known[target!] = role;
          this.setFact(target!, sideOf(role));
          // (owner 2026-11-21, game NRMFZ: two villagers did a Kundli and neither said a word) a Kundli ALWAYS gets a word
          if (e.type === "kundli" && (EXP.includes("K") || next(r) < this.talky)) this.speakAboutRole(s, target!, role, r);
          break;
        }
        case "talashi": {
          const cards = d.cards as Card[];
          this.stone[target!] = cards.some(isStone) ? 1 : 0;
          if (next(r) < this.rate("blurt")) { // [23]
            const mine = this.side(s), pr = this.p(s)[target!];
            // BOT_LOGIC §3: a villager says what it saw (unless it exposes a likely friend's Stone); a thief says
            // "no Stone" either way — it wants the Stone for itself
            if (mine === "V" && !(cards.some(isStone) && pr < 0.25 && this.skill.name !== "casual")) this.out.push({ t: "saw_cards", target: target!, cards });
            if (mine === "T" && cards.some(isStone) && next(r) < this.skill.lies) this.out.push({ t: "saw_cards", target: target!, cards: cards.filter((c) => !isStone(c)) });
          }
          break;
        }
        case "play": {
          // a Hera Pheri on a player is a choice of whom to rob: a thief robs villagers it thinks have a Stone, a villager robs suspects
          if (d.card === "HERA_PHERI" && actor !== undefined && target !== undefined && actor !== this.seat)
            this.weigh("robbed", (h) => (this.isT(h, actor) !== this.isT(h, target!) ? M.steal : 1) / M.steal);
          break;
        }
        case "robbed": {
          const lost = (d.cards as Card[]).some(isStone);
          const stealer = [...s.events].slice(0, e.n).reverse().find((x) => x.type === "play" && (x.data as { card?: string })?.card === "HERA_PHERI");
          const by = (stealer?.data as { seat?: number })?.seat;
          if (by !== undefined) {
            // W: the 2 taken stay with them, their own 3 go on — so it's the 2 they KEEP that hold my Stone
            if (EXP.includes("W")) this.keepStone[by] = lost ? 1 : 0;
            else this.stone[by] = lost ? 1 : this.stone[by] ?? 0;
            if (lost) this.stoneWent[by] = (d.cards as Card[]).filter(isStone);
            // I'm a villager robbed of a Stone: the robber is more likely a thief (big moment)
            if (lost && this.sideThen(s) === "V") this.weigh("robbed", (h) => (this.isT(h, by) ? 2 : 1));
            if (lost && next(r) < this.talky) { this.out.push({ t: "react", emoji: "cry" }); if (this.p(s)[by] > 0.2 || this.side(s) === "V") this.out.push({ t: "accuse", target: by }); }
          }
          break;
        }
        case "whisper": { // an ask for a card, to me
          if (d.ask && d.to === this.seat && typeof actor === "number") this.askedBy[actor] = d.ask as Card;
          if (actor === this.seat && d.ask) this.played.add(`ask:${this.atRound}`);
          // a TOLD secret (a role, a Kundli seen): mine already sent, or one to me — heard like talk, from someone who chose me
          if (d.talk && actor === this.seat) { this.played.add(`tell:${d.to}:${tellKey(d.talk as Talk)}`); if ((d.talk as Talk).t === "claim") this.played.add(`tell:${d.to}:fake`); }
          else if (d.talk && d.to === this.seat && typeof actor === "number") {
            const k = d.talk as Talk;
            this.hearingPrivate = true;
            this.hear(s, actor, k, "target" in k ? k.target : undefined, e.n, r);
            this.hearingPrivate = false;
            if (k.t === "stone" && k.has && k.target === actor && this.side(s) === "V" && !TRY.includes("s")) {
              const trusted = this.known[actor] ? sideOf(this.known[actor]) === "V" : this.p(s)[actor] < this.trust(0.25);
              if (trusted && !this.played.has(`cover:${actor}`)) { this.played.add(`cover:${actor}`); this.out.push({ t: "vouch", target: actor }); }
            }
            // experiment v: a villager told a neighbour's role in a whisper speaks for that neighbour out loud ("with the
            // village") when it trusts them — trust spreads round a big table instead of staying between two seats
            if (TRY.includes("v") && k.t === "claim" && sideOf(k.role) === "V" && this.side(s) === "V" && !this.played.has(`cover:${actor}`)) {
              const trusted = this.known[actor] ? sideOf(this.known[actor]) === "V" : this.p(s)[actor] < this.trust(0.3);
              if (trusted) { this.played.add(`cover:${actor}`); this.out.push({ t: "vouch", target: actor }); }
            }
          }
          break;
        }
        case "pass": { // (owner 2026-11-22) passing without playing is a TELL: maybe sitting on a Stone (or Dal Badal)
          if (EXP.includes("Q") && actor !== undefined && actor === this.turnOf && !this.turnPlayed && actor !== this.seat) {
            this.quiet[actor] = (this.quiet[actor] ?? 0) + 1;
            const q = this.quiet[actor];
            if ((this.stone[actor] ?? 0) < 0.6) this.stone[actor] = Math.min(0.6, Math.max(this.stone[actor] ?? 0, 0.12 * q));
          }
          break;
        }
        case "gave": { // only I know what I passed; a Stone in it = I know where it is
          const st = (d.cards as Card[]).filter(isStone);
          if (st.length && typeof d.to === "number") { this.stoneWent[d.to] = st; this.stone[d.to] = 1; }
          break;
        }
        case "stole": if ((d.cards as Card[]).some(isStone) && next(r) < this.talky * 0.4) this.out.push({ t: "react", emoji: "cheer" }); break;
        case "dal_badal": {
          // the thief showed its role card, then 4 role cards were shuffled: spread every placement over every deal
          const seats = [actor!, ...(d.targets as number[])];
          this.setFact(actor!, "T");
          for (const x of seats) { if (x !== this.seat) delete this.known[x]; delete this.told[x]; }
          const perms = permutations(seats.length);
          const spread = (src: Float64Array, logs: boolean) => {
            const out = new Float64Array(this.H.length);
            for (let i = 0; i < this.H.length; i++) {
              const bits = seats.map((x) => this.isT(this.H[i], x));
              const v = logs ? Math.exp(src[i]) : src[i];
              for (const pm of perms) {
                let h = this.H[i];
                seats.forEach((x, j) => { h = bits[pm[j]] ? h | (1 << x) : h & ~(1 << x); });
                out[this.index.get(h)!] += v / perms.length;
              }
            }
            return logs ? out.map((x) => Math.log(Math.max(x, 1e-12))) : out;
          };
          // combine everything into one weight, spread it, then keep it as "big" evidence (facts after the shuffle reapply below)
          const comb = new Float64Array(this.H.length);
          for (let i = 0; i < this.H.length; i++) comb[i] = this.fact[i] ? this.small[i] + this.big[i] : -50;
          this.big = spread(comb, true) as Float64Array; this.small.fill(0); this.fact.fill(1);
          if (this.seat in this.known && !seats.includes(this.seat)) this.setFact(this.seat, this.sideThen(s));
          for (const [x, role] of Object.entries(this.known)) this.setFact(Number(x), sideOf(role));
          break;
        }
        case "teer_kaman": {
          // a shot is aimed across the table: shooter and target likely on opposite sides (the roles named are private)
          if (actor !== undefined && target !== undefined) this.weigh("teer_kaman", (h) => (this.isT(h, actor) !== this.isT(h, target!) ? M.aim : 1 - M.aim));
          break;
        }
        case "tally": {
          const ballots = d.ballots as Record<string, { for: number | null }>;
          for (const [k, b] of Object.entries(ballots)) {
            const voter = Number(k), t = b.for;
            if (t === null || voter === this.seat) continue;
            // a thief remembers who voted for it or a known partner: that player is hunting us
            if (t === this.seat || (this.known[t] && sideOf(this.known[t]) === "T")) this.hunter[voter] = (this.hunter[voter] ?? 0) + 1;
            // [evidence] words don't match the vote: accused A out loud, voted B while A was still in
            const acc = this.accusedBy[voter];
            if (acc && acc.size && !acc.has(t) && [...acc].some((x) => !this.gone.has(x)) && this.roll(`wv:${e.n}:${voter}`) < this.rate("evidence") * 0.5)
              this.weigh("small", (h) => (this.isT(h, voter) ? 1.2 : 1));
            this.weigh("small", (h) => (this.isT(h, voter) ? 1 : this.isT(h, t) ? M.ballot : 1) / M.ballot);
          }
          break;
        }
        case "round": {
          this.atRound = (d.round as number) ?? this.atRound;
          // [evidence] "busy, never names anyone" (IIoA / active lurking): lots of talk, no accusation or vouch
          for (let x = 0; x < this.n; x++) if (x !== this.seat && (this.said[x] ?? 0) >= 4 && !(this.named[x] ?? 0) && !this.played.has(`busy:${x}`) && this.roll(`busy:${x}`) < this.rate("evidence")) {
            this.played.add(`busy:${x}`); this.weigh("small", (h) => (this.isT(h, x) ? 1.3 : 1));
          }
          break;
        }
        case "out": { this.lastOut = (d.seat as number) ?? null; this.outAt = e.n; if (this.lastOut !== null) this.gone.add(this.lastOut); break; }
        case "whisper_seen": {
          // [evidence] two players whispering again and again may be a pair (mild: villager neighbours whisper too)
          const a = actor, b = d.to as number | undefined;
          if (a !== undefined && typeof b === "number" && a !== this.seat && b !== this.seat) {
            const k = a < b ? `${a}-${b}` : `${b}-${a}`;
            this.wp[k] = (this.wp[k] ?? 0) + 1;
            if (this.wp[k] === 3 && this.roll(`wp:${k}`) < this.rate("evidence")) this.weigh("small", (h) => (this.isT(h, a) && this.isT(h, b) ? 1.3 : 1));
          }
          break;
        }
        case "say": {
          // (owner 2026-11-22, game KU7KB: "I am Baba" x12) the server rebuilds a bot every call, so what I already
          // said comes back from the log — each "say once" line stays once
          if (actor === this.seat) { this.markSaid(d.talk as Talk); break; }
          if (actor === undefined) break;
          const k = d.talk as Talk;
          this.said[actor] = (this.said[actor] ?? 0) + 1;
          // MIX-UP: rarely a bot pins what it heard on the wrong (neighbouring) player
          if ("target" in k && this.coin(e.n) < this.skill.mixUp) target = (k.target + 1) % this.n; else target = "target" in k ? k.target : undefined;
          this.hear(s, actor, k, target, e.n, r);
          break;
        }
      }
    }
  }

  private hear(s: State, from: number, k: Talk, target: number | undefined, n: number, r: R) {
    const lieCaught = () => { this.liars.add(from); this.weigh("small", (h) => (this.isT(h, from) ? 1 : 0.15)); };
    const catches = this.roll(`lie:${n}`) < this.rate("lieCatch"); // [72] a provable lie is caught only so often
    switch (k.t) {
      case "claim": {
        if (catches) {
          if (this.claims[from] && this.claims[from] !== k.role) lieCaught();                         // [126] two stories
          if (!s.rolesInPlay.includes(k.role)) lieCaught();                                         // [1.4c] not in play
          const dup = Object.entries(this.claims).find(([x, role]) => role === k.role && Number(x) !== from && sideOf(role) === "V");
          if (dup) { const o = Number(dup[0]); this.weigh("small", (h) => (this.isT(h, from) || this.isT(h, o) ? 1 : 0.1)); } // one of them lies
          if (this.known[from] && this.known[from] !== k.role) lieCaught();
          if (k.role === this.known[this.seat] && sideOf(k.role) === "V") lieCaught();               // they claim MY role
        }
        // [34] truth bias: a beginner half-believes a role claim (a little less suspicion of the claimer)
        const tb = this.rate("truth") - 0.3;
        if (tb > 0 && !this.liars.has(from) && from !== this.seat) this.weigh("small", (h) => (this.isT(h, from) ? 1 : 1 + tb));
        this.claims[from] = k.role;
        break;
      }
      case "accuse": case "vouch": case "saw_role": {
        const says: Side = k.t === "vouch" ? "V" : k.t === "accuse" ? "T" : sideOf(k.role);
        const before = target !== undefined && !!this.accusedBy[from]?.has(target);
        if (target !== undefined && target !== from) this.named[from] = (this.named[from] ?? 0) + 1;
        if (says === "T" && target !== undefined) (this.accusedBy[from] ??= new Set()).add(target);
        if (k.t === "vouch" && target !== undefined && target !== from) this.vouched[target] = (this.vouched[target] ?? 0) + 1;
        // [5] "defending = guilty": a beginner reads a player defending itself while under fire as a thief (it isn't)
        if ((this.pointed[from] ?? 0) >= 1 && (target === from || says === "T") && this.roll(`def:${n}`) < this.rate("defensive"))
          this.weigh("small", (h) => (this.isT(h, from) ? 1.5 : 1));
        // [104] jumping on a player already under fire, never accused by you before: the jumper is the tell (35% vs 26%)
        if (says === "T" && target !== undefined && target !== this.seat && !before && (this.pointed[target] ?? 0) >= 2 && this.roll(`jump:${n}`) < this.rate("evidence"))
          this.weigh("small", (h) => (this.isT(h, from) ? 1.3 : 1));
        if (target === this.seat) {
          if (says === "T") { this.accusedMe[from] = (this.accusedMe[from] ?? 0) + 1; this.pointed[this.seat] = (this.pointed[this.seat] ?? 0) + 1;
            if (this.sideThen(s) === "V") this.weigh("small", (h) => (this.isT(h, from) ? 1.6 : 1)); // a wrong guess about me — maybe a lie
            if (!this.answered.has(from) && next(r) < this.rate("counter")) this.answered.add(from), this.out.push(this.selfLine(s), { t: "accuse", target: from }); // [32]
          }
          break;
        }
        if (target === undefined) break;
        if (says === "T") this.pointed[target] = (this.pointed[target] ?? 0) + 1;
        if (catches && this.known[target] && sideOf(this.known[target]) !== says) { lieCaught(); break; } // a word against a fact
        const seen = k.t === "saw_role";
        if (seen) { this.told[target] = { role: k.role, from }; this.weigh("small", (h) => (this.isT(h, from) ? M.liar : (this.isT(h, target) === 1) === (says === "T") ? M.honest : 1 - M.honest)); break; }
        // a hunch: leans toward the truth when a villager says it; a thief's pick is anyone (deduce.ts)
        const others = this.n - 1, K = this.K;
        // [33] the loudest is followed (babble) · [46] a skilled player discounts a bare word with nothing behind it
        const talk = Object.values(this.said), avg = talk.length ? talk.reduce((a, c) => a + c, 0) / talk.length : 1;
        const loudness = Math.min(3, Math.max(0.5, (this.said[from] ?? 0) / Math.max(1, avg)));
        const st = Math.max(0.2, (1 + this.rate("loud") * (loudness - 1)) * (1 - 0.3 * this.rate("evidence")));
        const H = Math.pow(M.hunch, st);
        this.weigh("small", (h) => {
          if (this.isT(h, from)) return 1 / others;
          const lT = says === "T" ? H : 1, lV = says === "T" ? 1 : H;
          return (this.isT(h, target) ? lT : lV) / (K * lT + (others - K) * lV);
        });
        break;
      }
      case "saw_cards": {
        if (target === undefined) break;
        if (target === this.seat) {
          if (catches) {
            const lie = this.notes.get(n) ?? k.cards.some((c) => !this.me(s).hand.includes(c));
            this.noted.push([n, lie]);
            if (lie) lieCaught();
          }
          break;
        }
        this.stone[target] = k.cards.some(isStone) ? 0.8 : (this.stone[target] ?? 0) * 0.3;
        break;
      }
      case "stone": if (target !== undefined) this.stone[target] = k.has ? Math.max(this.stone[target] ?? 0, k.which ? 0.7 : 0.5) : (this.stone[target] ?? 0) * 0.5; break;
      case "ask": if (k.target === this.seat && s.players[this.seat].alive) this.askedMe.push({ from, what: k.what, priv: this.hearingPrivate }); break;
      case "react": {
        // [84] a cheer right after a player went out: the cheerer is likely on the other side from the out player
        const lo = this.lastOut;
        if (k.emoji === "cheer" && lo !== null && lo !== from && n - this.outAt < 12 && this.roll(`cheer:${n}`) < this.rate("evidence"))
          this.weigh("small", (h) => (this.isT(h, from) !== this.isT(h, lo) ? 1.3 : 1));
        break;
      }
    }
  }

  /** BOT_LOGIC §3: a villager says only what it saw; a thief lies that fit the table */
  private speakAboutRole(s: State, t: number, role: string, r: R) {
    const mine = this.side(s), theirs = sideOf(role);
    // a villager says exactly what it saw — "I checked X: Teacher" — so the village can count roles off for Teer Kaman
    // (owner 2026-11-22) a villager's role is NEVER named out loud (it hands the thieves a Teer Kaman name): "with the village"
    if (mine === "V") {
      // [24] a skilled villager keeps a found thief for a trusted neighbour first (the thieves can't see who knows)
      const nb = besideMe(s.players, this.seat).filter((x) => x !== t && this.trusts(s, x));
      if (theirs === "T" && nb.length && this.roll(`hold:${t}`) < this.rate("hold")) { this.tells.push({ to: nb[0], talk: { t: "saw_role", target: t, role } }); return; }
      this.out.push(theirs === "T" || TRY.includes("k") ? { t: "saw_role", target: t, role } : { t: "vouch", target: t }); return;
    }
    // (owner 2026-11-21) the thieves' counter: a thief almost always LIES about its Kundli, so the village can't trust every report
    if (next(r) > Math.max(this.skill.lies, 0.85)) { this.out.push({ t: "vouch", target: t }); return; }
    if (theirs === "T") { this.out.push({ t: "vouch", target: t }); return; } // cover a partner: "with the village"
    if (theirs === "V") this.out.push({ t: "saw_role", target: t, role: THIEF_ROLES.find((x) => s.rolesInPlay.includes(x)) ?? "Chor" }); // frame
    else this.out.push({ t: "vouch", target: t }); // cover a partner it just found
  }

  private markSaid(k: Talk) {
    if (k.t === "claim" || (k.t === "vouch" && k.target === this.seat)) this.played.add("claim");
    if (k.t === "claim") this.myClaim = k.role;
    if (k.t === "accuse" && this.firstHunch === null) this.firstHunch = k.target;
    if (k.t === "stone" && k.target === this.seat) this.played.add("stone");
    if (k.t === "stone") this.played.add(k.target === this.seat ? "stone" : `went:${k.target}`);
    if (k.t === "vouch" && k.target !== this.seat) this.played.add(`cover:${k.target}`);
    if (k.t === "ask") { this.played.add(`asked:${k.what}:${k.target}`); this.played.add(`askq:${this.atRound}`); }
  }

  /** (owner 2026-11-22, game KU7KB: "bots reveal roles publicly and thieves use it") a player speaking for itself says
   *  only its SIDE, never its role — a villager role said out loud is a free Teer Kaman name. A thief says the same. */
  selfLine(s?: State): Talk {
    // experiment r: a villager under fire names its own role (one line, once — it is said only when accused or aimed at)
    if (TRY.includes("r") && s && this.side(s) === "V") return { t: "claim", role: this.me(s).role };
    return { t: "vouch", target: this.seat };
  }

  fakeRole(s: State, not?: string): string {
    const vs = s.rolesInPlay.filter((x) => sideOf(x) === "V" && x !== not);
    const free = vs.filter((x) => !Object.values(this.claims).includes(x));
    return free[0] ?? vs[0];
  }

  /** PRESSURE (owner 2026-11-22: "if villagers feel they are losing they must try risky moves… same with thieves"):
   *  0 = calm, 1 = desperate. Time running out, the table pointing at me or my partner, the Stones in the wrong hands. */
  pressure(s: State): number {
    const p = this.p(s), mine = this.side(s);
    const time = Math.min(1, (s.round - 1) / Math.max(1, s.rounds - 1)); // first round 0 … last round 1
    const live = living(s).map((q) => q.seat);
    if (mine === "V") {
      // the Stones look to be with thieves
      const bad = live.reduce((a, x) => a + (x === this.seat ? 0 : (this.stone[x] ?? 0) * p[x]), 0);
      return Math.min(1, 0.6 * time + 0.5 * Math.min(1, bad));
    }
    const friends = live.filter((x) => x === this.seat || (this.known[x] && sideOf(this.known[x]) === "T"));
    const heat = friends.reduce((a, x) => a + (this.pointed[x] ?? 0), 0) + Object.values(this.accusedMe).reduce((a, c) => a + c, 0);
    const iHold = this.me(s).hand.some(isStone) ? 0 : 0.25;
    return Math.min(1, 0.5 * time + 0.15 * heat + iHold * time);
  }

  /** LEVERAGE + TRUST (owner 2026-11-22): each said once, when the pressure makes it worth the risk */
  scheme(s: State, r: R) {
    const p = this.p(s), mine = this.side(s), press = this.pressure(s);
    const me = this.me(s);
    if (!me.alive) return;
    const once = (key: string, t: Talk) => { if (this.played.has(key)) return false; this.played.add(key); this.out.push(t); return true; };
    // I know where my Stone went
    for (const [k, st] of Object.entries(this.stoneWent)) {
      const x = Number(k);
      if (!s.players[x]?.alive || x === this.seat) continue;
      // a villager: "Raju has the Tunga Stone" once Raju looks like a thief — the table can vote him out (rule 6.2)
      if (mine === "V" && p[x] > 0.5 && press > 0.3) { once(`went:${x}`, { t: "stone", target: x, has: true, which: st[0] as "TUNGA_STONE" }); continue; }
      // a thief that lost a Stone to a villager: point at that villager — voted out with a Stone, it counts for us
      if (mine === "T" && !(this.known[x] && sideOf(this.known[x]) === "T") && press > 0.4 && next(r) < this.skill.lies) {
        if (once(`went:${x}`, { t: "accuse", target: x })) this.out.push({ t: "stone", target: x, has: true, which: st[0] as "TUNGA_STONE" });
      }
    }
    // TELL A FRIEND (owner 2026-11-22): roles go only by whisper, only to a player I trust, each secret once.
    // A villager tells its own role and the villager roles its Kundli found; a thief tells its known partners the same
    // (who it is, and the villager roles it learnt — their Teer Kaman names).
    {
      const live = besideMe(s.players, this.seat); // whispers go left or right only
      // trust = clearly less suspect than an unknown seat (the prior), not near-certainty: villagers rarely get below 0.3
      const prior = this.K / Math.max(1, this.n - 1);
      const bar = TRY.includes("t") ? prior * 0.75 : this.trust(0.2); void prior;
      const friend = (x: number) => (this.known[x] ? sideOf(this.known[x]) === mine : mine === "V" && p[x] < bar);
      const friends = live.filter(friend);
      // experiment w: a thief with no partner found whispers a false villager role to a neighbour, to be trusted back
      if ((TRY.includes("w") || this.roll("slip") < this.rate("slip")) && mine === "T" && !friends.length && live.length && s.round > 1) {
        // [126] a thief whispers a role to a neighbour — beginners a DIFFERENT one from what they said out loud
        const to = live[0], fake: Talk = { t: "claim", role: this.fakeRole(s, this.myClaim ?? undefined) }, key = `tell:${to}:fake`;
        if (!this.played.has(key) && this.tells.length < 2) { this.played.add(key); this.tells.push({ to, talk: fake }); }
      }
      if (friends.length) {
        const secrets: Talk[] = [{ t: "claim", role: me.role }];
        // (owner 2026-11-22: "a thief holding a Stone is a play — the village must read it") a villager on a Stone tells a
        // trusted neighbour, who then speaks for it out loud; a thief on a Stone gets no such cover
        const myStone = me.hand.find(isStone);
        if (mine === "V" && myStone && !TRY.includes("s")) secrets.unshift({ t: "stone", target: this.seat, has: true, which: myStone as "TUNGA_STONE" });
        for (const [k, role] of Object.entries(this.known)) {
          const x = Number(k);
          if (x !== this.seat && s.players[x]?.alive && sideOf(role) === "V") secrets.push({ t: "saw_role", target: x, role });
        }
        for (const to of friends) for (const k of secrets) {
          if ("target" in k && k.target === to) continue;
          const key = `tell:${to}:${tellKey(k)}`;
          if (this.played.has(key) || this.tells.length >= 2) continue;
          this.played.add(key); this.tells.push({ to, talk: k });
        }
      }
    }
    // ASK FOR A CARD: I hold ONE of a card I'd play — the player who passes to me may have its twin. Only a teammate
    // I trust is asked (asking tells them what I want). Once a round; more often when the pressure is on.
    if (EXP.includes("A") && !this.played.has(`ask:${s.round}`)) {
      const want: Action[] = mine === "V" ? ["KUNDLI", "TEER_KAMAN", "FAISLA"] : ["HERA_PHERI", "TEER_KAMAN", "FAISLA"];
      const single = want.find((c) => me.hand.filter((x) => x === c).length === 1);
      const live = living(s).map((q) => q.seat);
      const prev = live[(live.indexOf(this.seat) - 1 + live.length) % live.length];
      const trusted = prev !== this.seat && (this.known[prev] ? sideOf(this.known[prev]) === mine : mine === "V" && p[prev] < this.trust(0.2));
      if (single && trusted && next(r) < 0.3 + 0.6 * press) { this.played.add(`ask:${s.round}`); this.asks.push({ to: prev, card: single }); }
    }
    this.claimsAndAsks(s, r, press, once);
  }

  /** (owner 2026-11-22) ROLE AND STONE CLAIMS: never compulsory — they come with the game's progress and the team's
   *  desperation. A side that feels it is losing claims its role or Stone (out loud, or by whisper to a neighbour) and
   *  ASKS others for theirs. The asked player chooses: a villager tells the truth about a Stone; about its role it is
   *  mostly true but may lie to dodge a Teer Kaman; a thief lies, always with roles that are in the game. */
  private claimsAndAsks(s: State, r: R, press: number, once: (key: string, t: Talk) => boolean) {
    const mine = this.side(s), me = this.me(s), p = this.p(s);
    // (owner 2026-11-22: "it depends on the type of player — a talkative one asks early, a skilled one asks early to
    // finish the puzzle") the URGE to claim/ask = the pressure, or the player's own nature, whichever is bigger
    const chatty = (this.talky - 0.45) / 0.45;                                   // 0 quiet … 1 chatterbox
    const solver = this.skill.name === "sharp" ? 0.6 : this.skill.name === "average" ? 0.35 : 0.1;
    const urge = Math.max(press, 0.6 * chatty, solver * (s.round > 1 || this.turns > 2 ? 1 : 0.5));
    const st = me.hand.find(isStone) as "TUNGA_STONE" | "BHADRA_STONE" | undefined;
    const roleLine = (): Talk => {
      if (mine === "T") {
        // [39] claim the SAME role a likely villager claimed: now one of us "lies", and it may look like them
        if (this.roll("dup") < this.rate("dupClaim")) {
          const v = Object.entries(this.claims).find(([x, role]) => Number(x) !== this.seat && sideOf(role) === "V" && !(this.known[Number(x)] && sideOf(this.known[Number(x)]) === "T"));
          if (v) return { t: "claim", role: v[1] };
        }
        return { t: "claim", role: this.fakeRole(s) };
      }
      // a villager may lie about its role to dodge a Teer Kaman — less as the game gets desperate (the truth is needed then)
      if (next(r) < 0.25 * (1 - press)) return { t: "claim", role: this.fakeRole(s, me.role) };
      return { t: "claim", role: me.role };
    };
    const stoneLine = (): Talk => (mine === "V" ? (st ? { t: "stone", target: this.seat, has: true, which: st } : { t: "stone", target: this.seat, has: false }) : { t: "stone", target: this.seat, has: false });
    // 1. ANSWER what I was asked: whether at all is my choice (silence looks bad, more so under pressure)
    for (const q of this.askedMe.splice(0)) {
      // one role claim and one Stone word per game (kept from the log, so a rebuilt server bot stays consistent)
      const key = q.what === "role" ? "claim" : "stone";
      if (this.played.has(key)) continue;
      const willing = mine === "T" ? 0.85 : q.priv ? 0.9 : 0.45 + 0.5 * Math.max(press, 0.5 * chatty);
      if (next(r) > willing) { this.played.add(key); continue; }
      const line = q.what === "role" ? roleLine() : stoneLine();
      this.played.add(key);
      if (q.priv && besideMe(s.players, this.seat).includes(q.from)) this.tells.push({ to: q.from, talk: line });
      else this.out.push(line);
    }
    // [66] the LAST round: a villager tells the truth before the end
    if (mine === "V" && s.round >= s.rounds && !this.played.has("claim") && this.roll("last") < this.rate("lastClaim")) once("claim", { t: "claim", role: me.role });
    // 2. CLAIM unasked, when my side feels it is losing
    if (urge > 0.55 || (Object.keys(this.accusedMe).length && urge > 0.35)) {
      once("claim", roleLine());
      if (mine === "V" && st && press > 0.75) once("stone", stoneLine());
      if (mine === "T" && st && Object.keys(this.accusedMe).length) once("stone", stoneLine());
    }
    // 3. ASK someone, once a round when the pressure is on: a villager asks its top suspect (a lie can be caught);
    //    a thief asks the likeliest villager (a true answer is a Teer Kaman name)
    if (urge > 0.3 && !this.played.has(`askq:${s.round}`) && next(r) < 0.3 + 0.6 * urge) {
      const live = living(s).map((q) => q.seat).filter((x) => x !== this.seat && !this.known[x]);
      if (live.length) {
        const x = mine === "V" ? argmax(live, (y) => p[y]) : argmax(live, (y) => 1 - p[y]);
        const what: "role" | "stone" = this.claims[x] === undefined ? "role" : "stone";
        if (!this.played.has(`asked:${what}:${x}`)) {
          this.played.add(`askq:${s.round}`); this.played.add(`asked:${what}:${x}`);
          const q: Talk = { t: "ask", target: x, what };
          if (besideMe(s.players, this.seat).includes(x) && press < 0.7) this.tells.push({ to: x, talk: q }); else this.out.push(q);
        }
      }
    }
  }

  /** HUMAN HABITS IN TALK (owner 2026-11-23). Every line here is said at most once per vote / round / game, and that is
   *  read back from the log, so a bot rebuilt by the server never repeats itself. */
  private habitTalk(s: State, r: R, live: number[], p: number[], mine: Side) {
    const me = this.me(s), ph = s.phase, rs = this.roundStart(s);
    const say = (t: Talk) => this.out.push(t);
    // [65] OUT: a villager tells everything it knows (a thief keeps lying: rule 5.9, roles stay secret)
    if (!me.alive) {
      if (this.played.has("outtell") || this.saidSince(s, this.outAt) || next(r) > this.rate("outTell")) { this.played.add("outtell"); return; }
      this.played.add("outtell");
      for (const [k, role] of Object.entries(this.known)) {
        const x = Number(k); if (x === this.seat || !s.players[x]?.alive) continue;
        if (mine === "V") say(sideOf(role) === "T" ? { t: "saw_role", target: x, role } : { t: "vouch", target: x });
        else if (sideOf(role) === "V") say({ t: "accuse", target: x });
      }
      return;
    }
    if (ph.kind === "vote") {
      const bal = ph.ballots as Record<number, Ballot>;
      const cnt: Record<number, number> = {};
      for (const b of Object.values(bal)) if (b.for !== null) cnt[b.for] = (cnt[b.for] ?? 0) + 1;
      const lead = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a])[0];
      const talked = this.saidSince(s, ph.opened);
      // [107] FLAIL: the vote is on me — plead and point at anyone
      if (!talked && lead === this.seat && cnt[lead] >= 2 && this.roll(`flail:${ph.opened}`) < this.rate("flail")) {
        say(this.selfLine(s));
        const pick = live.filter((x) => !this.trusts(s, x)).sort((a, b) => this.roll(`fl:${a}:${ph.opened}`) - this.roll(`fl:${b}:${ph.opened}`)).slice(0, 2);
        for (const x of pick) say({ t: "accuse", target: x });
        return;
      }
      // [120] holding a result: "good thing I'm voting him!" — the vote again, out loud
      const mineB = bal[this.seat];
      if (!talked && mineB?.for != null && this.known[mineB.for] && sideOf(this.known[mineB.for]) !== mine && mine === "V" && this.roll(`conf:${ph.opened}`) < this.rate("confirm")) { say({ t: "accuse", target: mineB.for }); return; }
      // [111] FIGHT for a trusted player who is on the block
      if (!talked && mine === "V" && lead !== undefined && lead !== this.seat && this.trusts(s, lead) && cnt[lead] >= 2 && this.roll(`fight:${ph.opened}`) < this.rate("fight")) { say({ t: "vouch", target: lead }); return; }
      return;
    }
    const thisRound = this.saidSince(s, rs);
    if (mine === "T") {
      // [41+89] BUDDY one villager all game (an "audience of one" for the final vote)
      if (!this.played.has("buddy") && this.turns > this.n / 2 && this.roll("buddy") < this.rate("buddy")) {
        const cand = live.filter((x) => !(this.known[x] && sideOf(this.known[x]) === "T"));
        if (cand.length) { const b = cand.sort((a, c) => (this.pointed[a] ?? 0) - (this.pointed[c] ?? 0) || (this.vouched[c] ?? 0) - (this.vouched[a] ?? 0))[0]; this.played.add("buddy"); say({ t: "vouch", target: b }); return; }
      }
      // [79] "I have the Tunga Stone" — a lie that draws a Hera Pheri away from the real holder
      if (!this.played.has("stone") && s.round > 1 && !me.hand.some(isStone) && this.roll("bait") < this.rate("stoneBait")) { this.played.add("stone"); say({ t: "stone", target: this.seat, has: true, which: "TUNGA_STONE" }); return; }
      // [101] ACTIVE LURKING: sounds busy, names nobody
      if (!thisRound && this.roll(`lurk:${s.round}`) < this.rate("lurk")) { say({ t: "react", emoji: this.roll(`lk:${s.round}`) < 0.5 ? "doubt" : "shock" }); return; }
      // [84] a thief's cheer when a likely villager goes out
      if (this.lastOut !== null && this.outAt >= rs && !this.saidSince(s, this.outAt) && !(this.known[this.lastOut] && sideOf(this.known[this.lastOut]) === "T") && this.roll(`emo:${this.outAt}`) < this.rate("emoji")) { say({ t: "react", emoji: "cheer" }); return; }
    } else if (!thisRound && s.round > 1 && this.roll(`rv:${s.round}`) < this.rate("revouch")) {
      // [109] speak for the players I trust AGAIN (tables forget yesterday's good word)
      const tr = live.filter((x) => this.trusts(s, x));
      if (tr.length) { say({ t: "vouch", target: tr[Math.floor(this.roll(`rvx:${s.round}`) * tr.length)] }); return; }
      if ((this.pointed[this.seat] ?? 0) >= 1) { say(this.selfLine(s)); return; }
    }
  }

  /** HUNCHES (owner): said once when one forms; at a big moment (Faisla, final vote, Teer Kaman aim) the top hunch resurfaces */
  hunch(s: State, r: R, bigMoment: number | null) {
    const p = this.p(s), mine = this.side(s);
    const live = living(s).filter((q) => q.seat !== this.seat).map((q) => q.seat);
    if (!live.length) return;
    this.habitTalk(s, r, live, p, mine);
    if (!this.me(s).alive) return;
    const prior = this.K / Math.max(1, this.n - 1);
    const score = (x: number) => (mine === "V" ? p[x] : (1 - p[x]) * (1 + (this.stone[x] ?? 0) + (this.accusedMe[x] ?? 0)) * 0.5);
    const top = live.reduce((a, b) => (score(b) > score(a) ? b : a), live[0]);
    const strong = mine === "V" ? p[top] > (TRY.includes("a") ? prior + 0.4 * (1 - prior) : Math.max(0.55, prior * 1.8)) : score(top) > 0.6 && next(r) < this.skill.lies;
    if (!strong) return;
    if (!this.hunched.has(top) && this.hunchRound !== s.round && this.hunched.size < (TRY.includes("x") && mine === "V" ? 2 + Math.floor(this.K / 2) : 2) && next(r) < this.talky * 0.5) { this.hunched.add(top); this.hunchRound = s.round; this.out.push({ t: "accuse", target: top }); return; }
    if (bigMoment !== null && this.resurfaced !== bigMoment && this.hunched.has(top) && next(r) < this.talky * (TRY.includes("x") && mine === "V" ? 0.7 : 0.3)) { this.resurfaced = bigMoment; this.out.push({ t: "accuse", target: top }); }
  }
}

// ---------------------------------------------------------------- decisions
const count = (h: Card[], c: Card) => h.filter((x) => x === c).length;
const others = (s: State, seat: number) => living(s).filter((p) => p.seat !== seat).map((p) => p.seat);
const argmax = (xs: number[], f: (x: number) => number) => xs.reduce((a, b) => (f(b) > f(a) ? b : a), xs[0]);

/** how much I want x gone: villagers hunt thieves; thieves hunt villagers (most of all Stone-holders and accusers) */
function threat(b: Brain, s: State, p: number[], x: number) {
  if (b.side(s) === "V") return p[x] + (b.stone[x] ?? 0) * p[x];
  // [133] what makes a villager dangerous to thieves: the obvious villager, the persuader, the one hunting us (votes for
  // us), the quiet unreadable one — a skilled thief aims Teer Kaman, Hera Pheri and Faisla there
  const said = Object.values(b.said), avg = said.length ? said.reduce((a, c) => a + c, 0) / said.length : 1;
  const danger = Math.min(1, (b.vouched[x] ?? 0) / 2) * 0.3 + Math.min(1, (b.said[x] ?? 0) / Math.max(1, 2 * avg)) * 0.4
    + Math.min(1, (b.hunter[x] ?? 0) / 2) * 0.3 + (!(b.said[x] ?? 0) && b.turns > b.n ? 0.2 : 0);
  return (1 - p[x]) * (0.5 + (b.stone[x] ?? 0) + 0.5 * (b.accusedMe[x] ?? 0) + b.rate("target") * danger);
}

function keepScore(b: Brain, s: State, c: Card, hand: Card[]) {
  if (isStone(c)) return 10;
  if (c === "DAL_BADAL") return b.side(s) === "T" ? 8 : -1;
  return count(hand, c) >= 2 ? 3 : 1;
}
/** PASSING ON PURPOSE (owner 2026-11-22: "only coordination can happen to pass the Stone or specific cards") — the same
 *  3 face-down cards to the next player as always; a bot only CHOOSES them with a plan:
 *   · in danger, holding a Stone, and the next player is a teammate I trust → the Stone goes to them
 *   · to a teammate: the strong cards I can't use (they may make a pair); to a suspect: the weak ones */
function choosePass(b: Brain, s: State, keep: number, r: R): Card[] {
  const hand = [...b.me(s).hand], mine = b.side(s), p = b.p(s);
  const nx = nextLiving(s, b.seat);
  const friend = b.known[nx] ? sideOf(b.known[nx]) === mine : mine === "V" ? p[nx] < b.trust(0.15) : false;
  const foe = b.known[nx] ? sideOf(b.known[nx]) !== mine : mine === "V" ? p[nx] > 0.5 : false;
  const danger = (b.accusedMe ? Object.values(b.accusedMe).reduce((a, c) => a + c, 0) : 0) + (b.pointed[b.seat] ?? 0) >= 2 && b.pressure(s) > 0.5;
  const lastTurn = s.round >= s.rounds && living(s).every((q) => s.played.includes(q.seat));
  const strong = (c: Card) => c === "TEER_KAMAN" || c === "FAISLA" || c === "KUNDLI" || (mine === "T" && c === "HERA_PHERI");
  const score = (c: Card) => {
    let v = keepScore(b, s, c, hand);
    if (!EXP.includes("C")) return v;
    if (isStone(c) && friend && danger) v = -5; // hand the Stone to a safe pair of hands
    // [6.4] a Stone in the last pile counts for the village: a villager taking the game's LAST turn passes its Stones
    else if (isStone(c) && mine === "V" && lastTurn && EXP.includes("L")) v = -6;
    else if (b.askedBy[nx] === c && !isStone(c) && count(hand, c) < 2) v = friend ? -4 : foe ? v + 2 : v - 1; // they asked for it
    else if (!isStone(c) && count(hand, c) < 2) v += friend ? (strong(c) ? -0.5 : 0.3) : foe ? (strong(c) ? 0.5 : -0.3) : 0;
    return v;
  };
  const careless = next(r) < b.rate("careless"); // [21] no plan: keep the Stones and pairs, the rest is luck
  const ranked = hand.map((c) => ({ c, v: careless ? keepScore(b, s, c, hand) + next(r) * 2.5 : score(c) + next(r) * 0.3 })).sort((x, y) => y.v - x.v);
  return ranked.slice(keep).slice(0, Math.min(3, hand.length - keep)).map((x) => x.c);
}
function dbTargets(b: Brain, s: State, p: number[]): number[] {
  const o = others(s, b.seat);
  return [...o].sort((x, y) => threat(b, s, p, y) - threat(b, s, p, x)).slice(0, Math.min(3, o.length));
}

function chooseTurn(b: Brain, s: State, r: R): Move {
  const me = b.me(s), hand = me.hand, o = others(s, b.seat), p = b.p(s), mine = me.side;
  const late = s.round >= s.rounds;
  const pair = (a: Action) => count(hand, a) >= 2;
  const heat = Object.values(b.accusedMe).reduce((a, c) => a + c, 0);
  // [17] beginners forget Dal Badal, or fire it too early
  const dbForgot = b.roll("dbmiss") < b.rate("dbMiss");
  if (canDalBadal(s, b.seat) && !dbForgot && (heat >= (TRY.includes("d") ? 1 : 2) || (late && !hand.some(isStone) && next(r) < 0.5) || (s.round === 1 && next(r) < b.rate("dbMiss") * 0.3))) return { kind: "dal_badal", targets: dbTargets(b, s, p) };
  const sure = o.find((x) => b.known[x] && sideOf(b.known[x]) !== mine);
  if (pair("TEER_KAMAN") && sure !== undefined) return { kind: "teer_kaman", target: sure };
  // [2.4] playing a pair means passing ALL 3 cards left — a Stone too. (owner 2026-11-22) "villagers and thieves both
  // try to hold the Stone, they are the only person they can trust at the start; once info starts revealing they take
  // the call to pass the Stone or keep it." Early: hold. Later: play only when the next player is someone I trust.
  if ((EXP.includes("H") || (EXP.includes("h") && mine === "V")) && hand.some(isStone)) {
    const nx = nextLiving(s, b.seat);
    const trusted = b.known[nx] ? sideOf(b.known[nx]) === mine : mine === "V" ? p[nx] < b.trust(0.15) : false;
    const informed = Object.keys(b.known).length > 1 || b.pressure(s) > 0.5;
    // [9] a beginner sometimes plays its pair anyway — and its Stone goes left with the 3 cards
    if ((!informed || !trusted) && next(r) >= b.rate("stoneSlip")) return { kind: "pass" };
  }
  if (pair("HERA_PHERI")) {
    const bar = (EXP.includes("X") && mine === "V") || (TRY.includes("h") && mine === "T") ? 0.3 : 0.5;
    const rich = o.filter((x) => (b.stone[x] ?? 0) > bar && (mine === "V" ? p[x] > 0.4 : p[x] < 0.6));
    if (rich.length) return { kind: "play", card: "HERA_PHERI", target: argmax(rich, (x) => b.stone[x]!) };
  }
  const top = argmax(o, (x) => threat(b, s, p, x));
  const prior = b.K / Math.max(1, b.n - 1);
  const press = EXP.includes("P") ? b.pressure(s) : 0; // (owner 2026-11-22) losing → take risks
  const confident = mine === "V" ? p[top] > Math.max(0.6 - 0.2 * press, prior * (2 - press)) : threat(b, s, p, top) > 1 - 0.4 * press;
  const stoneThief = mine === "V" && EXP.includes("X") && o.some((x) => (b.known[x] ? sideOf(b.known[x]) === "T" : p[x] > 0.55) && (b.stone[x] ?? 0) > 0.4);
  // [16] a beginner sits on a weapon pair all game · [13] or calls a Faisla on one hunch
  const sits = (c: Action) => !late && b.roll(`sit:${c}`) < b.rate("sit");
  if (pair("FAISLA") && !sits("FAISLA") && (confident || stoneThief || (late && next(r) < 0.5 + 0.4 * press) || next(r) < b.rate("faislaEarly"))) return { kind: "play", card: "FAISLA" };
  const qw = (x: number) => (EXP.includes("X") ? (b.quiet[x] ?? 0) * 0.08 : 0); // the quiet-pass tell
  if (pair("KUNDLI")) { const unk = o.filter((x) => !b.known[x]); if (unk.length) return { kind: "play", card: "KUNDLI", target: argmax(unk, (x) => p[x] * (1 - p[x]) + qw(x) + next(r) * 0.05) }; }
  if (pair("TALASHI")) { const unk = o.filter((x) => b.stone[x] === undefined || (b.stone[x]! > 0 && b.stone[x]! < 1)); if (unk.length) return { kind: "play", card: "TALASHI", target: argmax(unk, (x) => (mine === "V" ? p[x] : 1 - p[x]) + qw(x) + next(r) * 0.2) }; }
  // (owner 2026-11-21, game NRMFZ: a bot held two Teer Kamans all game and never shot) a pair is a weapon: fire it when
  // the chance of a HIT is real — sooner in the last round, when a kept pair is a wasted pair
  if (pair("TEER_KAMAN") && EXP.includes("T")) {
    const best = argmax(o, (x) => tkOdds(b, s, p, x));
    // villagers need better odds than thieves (tuned on scripts/ab-brain.mts to keep the 46-53% balance)
    const bar = (mine === "V" ? (late ? 0.4 : 0.6) : (late ? 0.25 : 0.4) - (TRY.includes("j") ? 0.1 : 0)) - 0.15 * press - 0.3 * b.rate("tkGut"); // [14]
    if (!sits("TEER_KAMAN") && tkOdds(b, s, p, best) >= bar) return { kind: "teer_kaman", target: best };
  }
  if (pair("BHUKAMP") && next(r) < 0.25) return { kind: "play", card: "BHUKAMP" };
  // [7] a pair played "just to do something", on whoever
  if (next(r) < b.rate("pairAct")) {
    const held = (["FAISLA", "KUNDLI", "TALASHI", "HERA_PHERI", "TEER_KAMAN", "BHUKAMP"] as Action[]).filter(pair);
    if (held.length && o.length) {
      const c = held[Math.floor(next(r) * held.length)], x = o[Math.floor(next(r) * o.length)];
      if (c === "TEER_KAMAN") return { kind: "teer_kaman", target: x };
      return c === "FAISLA" || c === "BHUKAMP" ? { kind: "play", card: c } : { kind: "play", card: c, target: x };
    }
  }
  return { kind: "pass" };
}

/** the chance a Teer Kaman at x HITS: x is on the other side × the right role is among my guesses */
function tkOdds(b: Brain, s: State, p: number[], x: number): number {
  const k = tkRoles(s), mine = b.side(s);
  if (b.known[x]) return sideOf(b.known[x]) !== mine ? 1 : 0;
  const theirSide = mine === "V" ? p[x] : 1 - p[x];
  const other: Side = mine === "V" ? "T" : "V";
  // roles x cannot have: mine, and every role I know someone else holds
  const taken = new Set(Object.entries(b.known).filter(([seat]) => Number(seat) !== x).map(([, r]) => r));
  // + what players I trust told me: roles they saw on others, and their own claims (a trusted villager's claim is true)
  const trust = (y: number) => (mine === "V" ? p[y] < b.trust(0.3) : false);
  for (const [seat, t] of Object.entries(b.told)) if (Number(seat) !== x && trust(t.from)) taken.add(t.role);
  for (const [seat, r] of Object.entries(b.claims)) if (Number(seat) !== x && trust(Number(seat))) taken.add(r);
  if (b.told[x] && trust(b.told[x].from)) return sideOf(b.told[x].role) === other ? theirSide * 0.9 + 0.1 : 0;
  const pool = s.rolesInPlay.filter((r) => sideOf(r) === other && !taken.has(r));
  // a thief aiming at a villager whose role someone reported out loud: that's the role to name
  if (mine === "T" && b.told[x] && sideOf(b.told[x].role) === "V") return theirSide * 0.85;
  // a thief aiming at a villager: the villager's own claim is most likely true
  if (mine === "T" && b.claims[x] && sideOf(b.claims[x]) === "V" && !taken.has(b.claims[x])) return theirSide * 0.8;
  return pool.length ? theirSide * Math.min(1, k / pool.length) : 0;
}

function chooseShoot(b: Brain, s: State, target: number, r: R): Move {
  const k = tkRoles(s);
  const want = b.known[target] ? [b.known[target]] : b.told[target] && (b.side(s) === "T" ? sideOf(b.told[target].role) === "V" : sideOf(b.told[target].role) === "T") ? [b.told[target].role] : [];
  const other = b.side(s) === "V" ? "T" : "V";
  if (want.length && next(r) < b.rate("tkWrong")) want.shift(); // [15]
  if (other === "V" && b.claims[target] && sideOf(b.claims[target]) === "V" && !want.length) want.push(b.claims[target]); // a villager's claim is usually true
  const taken = new Set(Object.entries(b.known).filter(([seat]) => Number(seat) !== target).map(([, x]) => x));
  const pool = s.rolesInPlay.filter((x) => !want.includes(x) && sideOf(x) === other && !taken.has(x) && b.claims[target] !== x).sort(() => next(r) - 0.5);
  const rest = s.rolesInPlay.filter((x) => !want.includes(x) && !pool.includes(x));
  return { kind: "shoot", roles: [...new Set([...want, ...pool, ...rest])].slice(0, k) };
}

/** the live count of an open vote (the first ballot weighs `anchor` for a beginner: the first vote pulls the rest) */
function liveCount(b: Brain, s: State) {
  const ph = s.phase as Extract<State["phase"], { kind: "vote" }>;
  const ballots = ph.ballots as Record<number, Ballot>;
  const first = s.events.find((e) => e.n > ph.opened && e.type === "ballot" && (e.data as { for?: number | null }).for != null);
  const firstFor = first ? (first.data as { for: number }).for : null;
  const c: Record<number, number> = {};
  for (const [v, x] of Object.entries(ballots)) if (Number(v) !== b.seat && x.for !== null) c[x.for] = (c[x.for] ?? 0) + 1;
  if (firstFor !== null && c[firstFor]) c[firstFor] += b.rate("anchor") - 1;
  const L = Object.keys(c).map(Number).sort((x, y) => c[y] - c[x])[0];
  // [51] one loud "no": someone else vouched for the leader since the vote opened — the pile-on stalls
  const dissent = L !== undefined && s.events.some((e) => e.n > ph.opened && e.type === "say" && (e.data as { seat?: number; talk?: Talk }).talk?.t === "vouch" && ((e.data as { talk: { target: number } }).talk.target === L) && (e.data as { seat: number }).seat !== L);
  return { ph, ballots, c, L, top: L === undefined ? 0 : c[L], dissent };
}

/** HUMAN VOTING HABITS (owner 2026-11-23), before the reasoned vote: revenge, the caught liar, going with the group,
 *  a thief's bus, a thief waiting to join in the middle. null = no habit fired, vote by reason. */
function habitVote(b: Brain, s: State, final: boolean): Move | null {
  const { ph, c, L, top, dissent } = liveCount(b, s);
  const o = others(s, b.seat), mine = b.side(s), key = `${ph.opened}`;
  const partner = (x: number) => !!b.known[x] && sideOf(b.known[x]) === "T";
  if (mine === "V" && o.some((x) => b.known[x] && sideOf(b.known[x]) === "T")) return null; // I KNOW a thief: no habits
  // [53] revenge: vote whoever accused me
  const acc = o.filter((x) => (b.accusedMe[x] ?? 0) > 0 && !b.trusts(s, x));
  if (acc.length && b.roll(`rev:${key}`) < b.rate("revenge")) return { kind: "vote", for: argmax(acc, (x) => b.accusedMe[x]), extra: s.extraVote === b.seat && final };
  // [82] always vote a caught liar
  const liars = o.filter((x) => b.liars.has(x) && !b.trusts(s, x) && !(mine === "T" && partner(x)));
  if (mine === "V" && liars.length && b.roll(`liar:${key}`) < b.rate("liar")) return { kind: "vote", for: liars[0], extra: s.extraVote === b.seat && final };
  if (L !== undefined && L !== b.seat) {
    const living_ = living(s).length;
    // [58+115] a thief votes out a partner who is going anyway (to look clean) — beginners more than skilled
    if (mine === "T" && partner(L) && top >= Math.floor(living_ / 2) && b.roll(`bus:${key}`) < b.rate("bus")) return { kind: "vote", for: L, extra: false };
    // [49+50] go with the group: a beginner follows one vote, others two (the first ballot weighs more for beginners)
    if (!b.trusts(s, L) && !(mine === "T" && partner(L)) && top >= 2 - (b.rate("anchor") > 1.4 ? 1 : 0) && b.roll(`herd:${key}`) < b.rate("herd") * (dissent ? 0.15 : 1))
      return { kind: "vote", for: L, extra: s.extraVote === b.seat && final };
  }
  // [92] a skilled thief never starts a pile-on: it waits, then joins in the middle (see reconsider)
  if (mine === "T" && !final && !Object.keys(c).length && b.roll(`mid0:${key}`) < b.rate("middle")) return { kind: "vote", for: null };
  return null;
}

function chooseVote(b: Brain, s: State, final: boolean, r: R): Move {
  const habit = habitVote(b, s, final);
  if (habit) return habit;
  const o = others(s, b.seat), p = b.p(s), mine = b.side(s);
  const gut = b.rate("gut"), tunnel = (x: number) => (x === b.firstHunch ? 0.3 * b.rate("tunnel") : 0); // [54] [35]
  // the table's mood: real tables gang up on the most-pointed-at player (a split vote is a tie, and a tie does nothing)
  const mood = (x: number) => Math.min(3, b.pointed[x] ?? 0) * 0.08;
  const known = (x: number) => (b.known[x] ? (sideOf(b.known[x]) === mine ? -2 : 2) : 0);
  if (mine === "V") {
    // [6.2] the final vote moves the out player's Stones to the OTHER team: a thief out with a Stone = a Stone for us,
    // a villager out with a Stone = a Stone for them. So weigh who holds a Stone, both ways.
    const swing = (x: number) => ((final || EXP.includes("X")) && EXP.includes("F") ? (b.stone[x] ?? 0) * (2 * p[x] - 1) * (TRY.includes("o") ? 1.2 : 0.6) : 0);
    const top = argmax(o, (x) => p[x] + mood(x) * (TRY.includes("c") ? 3 : 1) + known(x) + swing(x) + tunnel(x) + next(r) * (0.02 + 0.6 * gut));
    const prior = b.K / Math.max(1, b.n - 1);
    // the FINAL vote: everyone votes (nothing to save the vote for); a Faisla: only when the case is real (a gut voter votes anyway)
    if (!final && p[top] + mood(top) < prior * 1.5 && known(top) <= 0 && next(r) >= gut) return { kind: "vote", for: null };
    return { kind: "vote", for: top, extra: s.extraVote === b.seat && (final || p[top] > 0.8) };
  }
  // a thief: never votes for a partner it knows; rides the table's mood onto a villager, most of all a Stone-holder
  const top = argmax(o, (x) => threat(b, s, p, x) + mood(x) * 2 + known(x) + (final ? (b.stone[x] ?? 0) * 0.5 : 0) + next(r) * (0.05 + 0.5 * gut));
  if (!final && threat(b, s, p, top) < 0.6) return { kind: "vote", for: null };
  return { kind: "vote", for: top, extra: s.extraVote === b.seat && final };
}

/** THE OPEN VOTE, LIVE (owner 2026-11-22: "why didn't bots tie my vote to save an elimination"). Every vote shows as it
 *  lands, so a bot that already voted looks again: a thief swings to make a TIE when it or a partner is leading (a tie
 *  does nothing [3.5]); a villager swings onto the leader when that is a real suspect, or makes a tie to save a player it
 *  KNOWS is a villager. At most 2 changes per vote. null = keep my vote. */
export function reconsider(b: Brain, s: State): Move | null {
  const ph = s.phase;
  if (!EXP.includes("V")) return null;
  if (ph.kind !== "vote" || !b.me(s).alive) return null;
  const ballots = ph.ballots as Record<number, Ballot>;
  const mine = ballots[b.seat];
  if (!mine) return null;
  const changes = s.events.filter((e) => e.n > ph.opened && e.type === "ballot" && (e.data as { seat?: number; changed?: boolean }).seat === b.seat && (e.data as { changed?: boolean }).changed).length;
  if (changes >= 2) return null;
  const weight = (v: number, x: Ballot) => (x.extra && s.extraVote === v ? 2 : 1);
  const counts: Record<number, number> = {};
  for (const [v, x] of Object.entries(ballots)) if (Number(v) !== b.seat && x.for !== null) counts[x.for] = (counts[x.for] ?? 0) + weight(Number(v), x);
  const myW = weight(b.seat, mine);
  const o = others(s, b.seat), p = b.p(s), side = b.side(s);
  const c = (x: number) => counts[x] ?? 0;
  const lead = [...o, b.seat].sort((x, y) => c(y) - c(x));
  const L = lead[0], top = c(L);
  if (top === 0) return null;
  const friendOf = (x: number) => x === b.seat || (b.known[x] !== undefined && sideOf(b.known[x]) === side);
  const vote = (x: number | null): Move | null => (mine.for === x ? null : { kind: "vote", for: x, extra: mine.extra });
  const key = `${ph.opened}`, { dissent } = liveCount(b, s);
  const allIn = living(s).every((q) => ballots[q.seat] !== undefined);
  // [92] a skilled thief that waited joins the pile-on in the middle, once it has started
  if (side === "T" && mine.for === null && L !== b.seat && !friendOf(L) && top >= 1 && b.roll(`mid:${key}`) < b.rate("middle")) return vote(L);
  // [52] the LAST-SECOND SWITCH: everyone has voted and the table leans another way
  if (allIn && mine.for !== L && L !== b.seat && !friendOf(L) && !b.trusts(s, L) && !dissent && b.roll(`sw:${key}`) < b.rate("switchy")) return vote(L);
  // who would be out if I voted for x
  const outIf = (x: number | null) => {
    const t = { ...counts }; if (x !== null) t[x] = (t[x] ?? 0) + myW;
    const best = Math.max(...Object.values(t)); const at = Object.keys(t).filter((k) => t[+k] === best);
    return at.length === 1 ? Number(at[0]) : null;
  };
  // SAVE a friend (or me): find a vote that leaves nobody out, or someone else out
  if (friendOf(L) && outIf(mine.for) !== null && friendOf(outIf(mine.for)!)) {
    const tries = o.filter((x) => !friendOf(x)).sort((x, y) => c(y) - c(x));
    for (const x of tries) { const w = outIf(x); if (w === null || !friendOf(w)) return vote(x); }
    // [58] can't be saved: a thief may bus its partner
    if (side === "T" && L !== b.seat && b.roll(`bus2:${key}`) < b.rate("bus")) return vote(L);
    return null;
  }
  // [111] a villager FIGHTS for a player it trusts: a vote that makes a tie
  if (side === "V" && L !== b.seat && b.trusts(s, L) && outIf(mine.for) === L && b.roll(`fightv:${key}`) < b.rate("fight")) {
    for (const x of o.filter((y) => !b.trusts(s, y) && y !== L).sort((x, y) => c(y) - c(x))) { const w = outIf(x); if (w === null || w !== L) return vote(x); }
  }
  // PILE ON: a villager joins a leading real suspect so the vote isn't wasted on a split
  if (side === "V" && mine.for !== L && L !== b.seat && !friendOf(L)) {
    const prior = b.K / Math.max(1, b.n - 1);
    if (p[L] >= prior * (1.1 - 0.3 * b.pressure(s)) && (mine.for === null || p[L] >= p[mine.for] * 0.8 || c(mine.for) + myW < top)) return vote(L);
  }
  // a thief happy to see a villager go: add its vote to make it stick
  if (side === "T" && mine.for !== L && !friendOf(L) && outIf(L) === L && outIf(mine.for) !== L) return vote(L);
  return null;
}

export function decide(b: Brain, s: State, r: R): Move {
  const ph = s.phase;
  switch (ph.kind) {
    case "turn": return chooseTurn(b, s, r);
    case "pass": return { kind: "give", cards: choosePass(b, s, ph.keep, r) };
    case "vote": return chooseVote(b, s, ph.final, r);
    case "aim": return chooseShoot(b, s, ph.target, r);
    case "bhukamp": { const h = b.me(s).hand; return { kind: "bhukamp", card: [...h].sort((x, y) => keepScore(b, s, x, h) - keepScore(b, s, y, h))[0] }; }
    case "gift": {
      // BOT_LOGIC: a villager gives it to whom it trusts most; a thief only to a partner it knows, else the least threatening
      const p = b.p(s), l = living(s).map((q) => q.seat);
      return { kind: "gift", to: argmax(l, (x) => (b.side(s) === "V" ? -p[x] : b.known[x] && sideOf(b.known[x]) === "T" ? 9 : -threat(b, s, p, x))) };
    }
    default: throw new Error("nothing to decide");
  }
}

// ---------------------------------------------------------------- one whole game
export interface GameStats { players: number; winner: Side; reason: string; turns: number; dalBadal: number; tkHit: number; tkMiss: number; faislaOut: number; says: number; talkKinds: Record<string, number>; end: string[] }

export function playGame(n: number, seed: number, skill: Skill | ((seat: number) => Skill), probe?: (s: State, bots: Brain[]) => void, done?: (s: State) => void): GameStats {
  // names differ per game, so personalities do too; a bot's talkiness comes from its name exactly as on the server
  let s = newGame(Array.from({ length: n }, (_, i) => `B${i}.${seed % 9973}`), seed);
  const r: R = { rng: (seed * 2654435761) >>> 0 };
  const bots = s.players.map((p) => new Brain(p.seat, typeof skill === "function" ? skill(p.seat) : skill, talkyOf(p.name), s));
  for (const b of bots) {
    b.read(s, r);
    if (next(r) < 0.3) s = move(s, b.seat, { kind: "say", talk: b.selfLine() });
  }
  let steps = 0, turns = 0, lastBig = -1;
  while (s.phase.kind !== "over" && steps++ < 4000) {
    const ph = s.phase;
    // a big moment opens: a Faisla vote, the final vote, a Teer Kaman aim
    const big = ph.kind === "vote" || ph.kind === "aim" ? s.events.length : null;
    const fresh = big !== null && lastBig === -1 ? big : null;
    if (big !== null && lastBig === -1) lastBig = big; if (big === null) lastBig = -1;
    // ONE VOICE AT A TIME, exactly as the server (owner 2026-11-23): one line out loud and at most one whisper per move
    const said: { seat: number; talk: Talk; prio: number }[] = [];
    const priv: (() => State)[] = [];
    for (const b of bots) {
      b.read(s, r);
      b.hunch(s, r, fresh);
      if (EXP.includes("S")) b.scheme(s, r);
      for (const a of b.asks.splice(0)) { const at = s; priv.push(() => ask(at, b.seat, a.to, a.card)); }
      for (const w of b.tells.splice(0)) { const at = s; priv.push(() => tell(at, b.seat, w.to, w.talk)); }
      for (const t of b.out.splice(0).slice(0, 2)) said.push({ seat: b.seat, talk: t, prio: talkPriority(s, b.seat, t) });
    }
    if (priv.length) { try { s = priv[Math.floor(next(r) * priv.length)](); } catch { /* seats moved */ } }
    if (said.length && (s.phase as { kind: string }).kind !== "over") {
      const top = Math.max(...said.map((l) => l.prio)), best = said.filter((l) => l.prio === top);
      const l = best[Math.floor(next(r) * best.length)];
      s = move(s, l.seat, { kind: "say", talk: l.talk });
    }
    if (s.phase.kind === "over") break;
    if (s.phase.kind === "aim") {
      const tb = bots[s.phase.target];
      if (next(r) < 0.7 && !s.events.slice(-4).some((e) => e.type === "say" && (e.data as { seat: number }).seat === tb.seat))
        s = move(s, tb.seat, { kind: "say", talk: tb.selfLine() });
    }
    if (s.phase.kind === "vote" && !waitingOn(s).length) {
      // the open vote: everyone sees the count and may swing (a few rounds of looking again), then the clock closes it
      for (let look = 0; look < 3; look++) {
        let moved = false;
        for (const b of bots) { b.read(s, r); const m = reconsider(b, s); if (m) { s = move(s, b.seat, m); moved = true; } }
        if (!moved) break;
      }
      s = closeVoteNow(s); continue;
    }
    const who = waitingOn(s)[0];
    if (s.phase.kind === "turn") turns++;
    if (probe) probe(s, bots);
    s = move(s, who, decide(bots[who], s, r));
  }
  done?.(s);
  const ev = s.events;
  const over = s.phase.kind === "over" ? s.phase : { winner: "T" as Side, reason: "stuck" };
  return {
    players: n, winner: over.winner, reason: over.reason, turns,
    dalBadal: ev.filter((e) => e.type === "dal_badal").length,
    tkHit: ev.filter((e) => e.type === "teer_kaman" && (e.data as { hit: boolean }).hit).length,
    tkMiss: ev.filter((e) => e.type === "teer_kaman" && !(e.data as { hit: boolean }).hit).length,
    faislaOut: ev.filter((e) => e.type === "out").length - ev.filter((e) => e.type === "teer_kaman").length,
    says: ev.filter((e) => e.type === "say").length,
    end: endNotes(s),
    talkKinds: ev.filter((e) => e.type === "say").reduce((a, e) => { const t = (e.data as { talk: Talk }).talk; const k = t.t === "react" ? `react:${t.emoji}` : t.t; a[k] = (a[k] ?? 0) + 1; return a; }, {} as Record<string, number>),
  };
}

/** DIAGNOSIS: where each Stone ended and what the final vote did */
function endNotes(s: State): string[] {
  const out: string[] = [];
  const fin = [...s.events].reverse().find((e) => e.type === "vote" && (e.data as { final?: boolean }).final);
  const finIdx = fin ? fin.n : -1;
  const votedOutEv = finIdx >= 0 ? s.events.find((e) => e.n > finIdx && e.type === "out") : undefined;
  const votedOut = votedOutEv ? (votedOutEv.data as { seat: number }).seat : null;
  if (s.phase.kind === "over" && s.phase.reason.startsWith("Every")) out.push("wipe:" + s.phase.winner);
  else if (finIdx < 0) out.push("other");
  else out.push(votedOut === null ? "final:tie" : `final:out_${s.players[votedOut].side}`);
  for (const c of ["TUNGA_STONE", "BHADRA_STONE"] as Card[]) {
    if (s.pile.includes(c)) { out.push("stone:pile"); continue; }
    const p = s.players.find((x) => x.hand.includes(c));
    if (!p) { out.push("stone:gone"); continue; }
    out.push(`stone:${p.side}${p.seat === votedOut ? "_votedout" : ""}`);
  }
  return out;
}

/** for scripts/teams.mts: the team table the bots' games use (tsx may load game.ts twice — this is the bots' copy) */
export { TABLE as BOT_TABLE } from "./game";

/** who gets the one line (owner 2026-11-23): answering about yourself 3 · hitting back at whoever accused you 2 ·
 *  news about someone else 1 · a reaction 0 */
export function talkPriority(s: State, seat: number, t: Talk): number {
  if (t.t === "claim" || (t.t === "stone" && t.target === seat)) return 3;
  if (t.t === "react") return 0;
  if (t.t === "accuse") {
    const back = s.events.slice(-30).some((e) => {
      const d = e.data as { seat?: number; talk?: Talk } | undefined;
      return e.type === "say" && d?.talk?.t === "accuse" && d.talk.target === seat && d.seat === t.target;
    });
    if (back) return 2;
  }
  return 1;
}
