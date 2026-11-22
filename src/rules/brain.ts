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
  type State, type Talk, tkRoles, waitingOn, ask,
} from "./game";

const THIEF_ROLES = ["Chor", "Lootera", "Gunda", "Daku", "Aawara"];
const sideOf = (role: string): Side => (THIEF_ROLES.includes(role) ? "T" : "V");
type R = { rng: number };

export type SkillName = "casual" | "average" | "sharp";
export interface Skill {
  name: SkillName;
  /** how much a turn-old SMALL piece of evidence still counts (claims, ballots) */
  memory: number;
  /** big moments (Kundli, Teer Kaman, a Stone stolen, a Dal Badal, a Faisla) fade this much slower */
  bigSlower: number;
  /** spots provable lies (a role not in play, two claims of one role, a word against a fact) */
  catchesLies: boolean;
  /** chance of pinning a remembered accusation on the wrong player (a neighbour) */
  mixUp: number;
  /** chance a thief bot tells a lie where it could (else silent) */
  lies: number;
}
export const SKILLS: Record<SkillName, Skill> = {
  casual: { name: "casual", memory: 0.8, bigSlower: 0.4, catchesLies: false, mixUp: 0.06, lies: 0.5 },
  average: { name: "average", memory: 0.9, bigSlower: 0.4, catchesLies: true, mixUp: 0.03, lies: 0.75 },
  sharp: { name: "sharp", memory: 0.97, bigSlower: 0.3, catchesLies: true, mixUp: 0, lies: 0.95 },
};

/** behaviour model (from deduce.ts MODEL) */
// feature switches for scripts/ab-brain.mts: K Kundli always spoken · S scheme (leverage + trust) · T Teer Kaman fired ·
// V live vote · P pressure · C passing on purpose · A asking for cards (owner 2026-11-21/22)
// L last pile safe · F final vote weighs Stones
// H hold the Stone (no pair play that would pass it on) · Q read the quiet-pass tell · X villagers hunt a quiet suspect
const EXP = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BRAIN_EXP ?? "KSTVPCALFHQX";
const M = { honest: 0.9, hunch: 1.6, ballot: 1.4, aim: 0.7, liar: 0.6, steal: 1.5 };
const BIG = new Set(["kundli", "teer_kaman", "robbed", "dal_badal", "tally"]);

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
  claims: Record<number, string> = {};
  /** (owner 2026-11-21: "why can't bots pass info to bots they trust") roles OTHERS say they saw (Kundli): seat → { role, from } */
  told: Record<number, { role: string; from: number }> = {};
  accusedMe: Record<number, number> = {};
  /** (owner 2026-11-22: "whoever loses the Stone knows where it is — leverage") Stones I passed or lost: seat → which */
  stoneWent: Record<number, Card[]> = {};
  /** the big plays I have already made with what I know (said once each) */
  played = new Set<string>();
  /** whose turn it is, did they play, and how often each player has passed without playing (the Stone tell) */
  turnOf = -1; turnPlayed = false; quiet: Record<number, number> = {};
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

  constructor(public seat: number, public skill: Skill, public talky: number, s: State) {
    this.n = s.players.length;
    this.K = s.rolesInPlay.filter((r) => sideOf(r) === "T").length; // [1.4c] the count is public
    this.H = placements(this.n, this.K);
    this.index = new Map(this.H.map((h, i) => [h, i]));
    this.fact = new Float64Array(this.H.length).fill(1);
    this.small = new Float64Array(this.H.length);
    this.big = new Float64Array(this.H.length);
  }
  isT(h: number, x: number) { return (h >> x) & 1; }
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

  read(s: State, r: R) {
    for (; this.seen < s.events.length; this.seen++) {
      const e = s.events[this.seen];
      if (e.to !== "all" && !e.to.includes(this.seat)) continue;
      const d = (e.data ?? {}) as Record<string, unknown>;
      const actor = d.seat as number | undefined;
      let target = d.target as number | undefined;
      if ((e.type === "play" || e.type === "dal_badal") && actor === this.turnOf) this.turnPlayed = true;
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
          if (next(r) < this.talky * 0.7) {
            const mine = this.side(s), pr = this.p(s)[target!];
            // BOT_LOGIC §3: a villager says what it saw (unless it exposes a likely friend's Stone); a thief says
            // "no Stone" either way — it wants the Stone for itself
            if (mine === "V" && !(cards.some(isStone) && pr < 0.25)) this.out.push({ t: "saw_cards", target: target!, cards });
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
            this.stone[by] = lost ? 1 : this.stone[by] ?? 0;
            if (lost) this.stoneWent[by] = (d.cards as Card[]).filter(isStone);
            // I'm a villager robbed of a Stone: the robber is more likely a thief (big moment)
            if (lost && this.sideThen(s) === "V") this.weigh("robbed", (h) => (this.isT(h, by) ? 2 : 1));
            if (lost && next(r) < this.talky) { this.out.push({ t: "react", emoji: "cry" }); if (this.p(s)[by] > 0.2 || this.side(s) === "V") this.out.push({ t: "accuse", target: by }); }
          }
          break;
        }
        case "whisper": { // an ask for a card, to me
          if (d.ask && d.to === this.seat && typeof actor === "number") this.askedBy[actor] = d.ask as Card;
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
            this.weigh("small", (h) => (this.isT(h, voter) ? 1 : this.isT(h, t) ? M.ballot : 1) / M.ballot);
          }
          break;
        }
        case "say": {
          if (actor === undefined || actor === this.seat) break;
          const k = d.talk as Talk;
          // MIX-UP: rarely a bot pins what it heard on the wrong (neighbouring) player
          if ("target" in k && this.coin(e.n) < this.skill.mixUp) target = (k.target + 1) % this.n; else target = "target" in k ? k.target : undefined;
          this.hear(s, actor, k, target, e.n, r);
          break;
        }
      }
    }
  }

  private hear(s: State, from: number, k: Talk, target: number | undefined, n: number, r: R) {
    const lieCaught = () => this.weigh("small", (h) => (this.isT(h, from) ? 1 : 0.15));
    switch (k.t) {
      case "claim": {
        if (this.skill.catchesLies) {
          if (!s.rolesInPlay.includes(k.role)) lieCaught();                                         // [1.4c] not in play
          const dup = Object.entries(this.claims).find(([x, role]) => role === k.role && Number(x) !== from && sideOf(role) === "V");
          if (dup) { const o = Number(dup[0]); this.weigh("small", (h) => (this.isT(h, from) || this.isT(h, o) ? 1 : 0.1)); } // one of them lies
          if (this.known[from] && this.known[from] !== k.role) lieCaught();
          if (k.role === this.known[this.seat] && sideOf(k.role) === "V") lieCaught();               // they claim MY role
        }
        this.claims[from] = k.role;
        break;
      }
      case "accuse": case "vouch": case "saw_role": {
        const says: Side = k.t === "vouch" ? "V" : k.t === "accuse" ? "T" : sideOf(k.role);
        if (target === this.seat) {
          if (says === "T") { this.accusedMe[from] = (this.accusedMe[from] ?? 0) + 1; this.pointed[this.seat] = (this.pointed[this.seat] ?? 0) + 1;
            if (this.sideThen(s) === "V") this.weigh("small", (h) => (this.isT(h, from) ? 1.6 : 1)); // a wrong guess about me — maybe a lie
            if (!this.answered.has(from) && next(r) < this.talky * 0.7) this.answered.add(from), this.out.push(this.side(s) === "V" ? { t: "claim", role: this.me(s).role } : { t: "claim", role: this.fakeRole(s) }, { t: "accuse", target: from });
          }
          break;
        }
        if (target === undefined) break;
        if (says === "T") this.pointed[target] = (this.pointed[target] ?? 0) + 1;
        if (this.skill.catchesLies && this.known[target] && sideOf(this.known[target]) !== says) { lieCaught(); break; } // a word against a fact
        const seen = k.t === "saw_role";
        if (seen) { this.told[target] = { role: k.role, from }; this.weigh("small", (h) => (this.isT(h, from) ? M.liar : (this.isT(h, target) === 1) === (says === "T") ? M.honest : 1 - M.honest)); break; }
        // a hunch: leans toward the truth when a villager says it; a thief's pick is anyone (deduce.ts)
        const others = this.n - 1, K = this.K;
        this.weigh("small", (h) => {
          if (this.isT(h, from)) return 1 / others;
          const lT = says === "T" ? M.hunch : 1, lV = says === "T" ? 1 : M.hunch;
          return (this.isT(h, target) ? lT : lV) / (K * lT + (others - K) * lV);
        });
        break;
      }
      case "saw_cards": {
        if (target === undefined) break;
        if (target === this.seat) {
          if (this.skill.catchesLies) {
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
      case "react": break;
    }
  }

  /** BOT_LOGIC §3: a villager says only what it saw; a thief lies that fit the table */
  private speakAboutRole(s: State, t: number, role: string, r: R) {
    const mine = this.side(s), theirs = sideOf(role);
    // a villager says exactly what it saw — "I checked X: Teacher" — so the village can count roles off for Teer Kaman
    if (mine === "V") { this.out.push(EXP.includes("S") || theirs === "T" ? { t: "saw_role", target: t, role } : { t: "vouch", target: t }); return; }
    // (owner 2026-11-21) the thieves' counter: a thief almost always LIES about its Kundli, so the village can't trust every report
    if (next(r) > Math.max(this.skill.lies, 0.85)) { this.out.push(theirs === "V" ? { t: "saw_role", target: t, role } : { t: "vouch", target: t }); return; }
    if (theirs === "T") { this.out.push({ t: "saw_role", target: t, role: this.fakeRole(s) }); return; } // cover a partner: "they're Kisaan"
    if (theirs === "V") this.out.push({ t: "saw_role", target: t, role: THIEF_ROLES.find((x) => s.rolesInPlay.includes(x)) ?? "Chor" }); // frame
    else this.out.push({ t: "vouch", target: t }); // cover a partner it just found
  }

  fakeRole(s: State): string {
    const vs = s.rolesInPlay.filter((x) => sideOf(x) === "V");
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
    // ASK FOR A CARD: I hold ONE of a card I'd play — the player who passes to me may have its twin. Only a teammate
    // I trust is asked (asking tells them what I want). Once a round; more often when the pressure is on.
    if (EXP.includes("A") && !this.played.has(`ask:${s.round}`)) {
      const want: Action[] = mine === "V" ? ["KUNDLI", "TEER_KAMAN", "FAISLA"] : ["HERA_PHERI", "TEER_KAMAN", "FAISLA"];
      const single = want.find((c) => me.hand.filter((x) => x === c).length === 1);
      const live = living(s).map((q) => q.seat);
      const prev = live[(live.indexOf(this.seat) - 1 + live.length) % live.length];
      const trusted = prev !== this.seat && (this.known[prev] ? sideOf(this.known[prev]) === mine : mine === "V" && p[prev] < 0.2);
      if (single && trusted && next(r) < 0.3 + 0.6 * press) { this.played.add(`ask:${s.round}`); this.asks.push({ to: prev, card: single }); }
    }
    // TRUST: a villager under fire shows its hand — its role, and (when desperate) its Stone
    if (mine === "V" && Object.keys(this.accusedMe).length && press > 0.45) {
      once("claim", { t: "claim", role: me.role });
      const st = me.hand.find(isStone);
      if (st && press > 0.7) once("stone", { t: "stone", target: this.seat, has: true, which: st as "TUNGA_STONE" });
    }
    // a thief under fire: a calm cover story, and its Stone hidden
    if (mine === "T" && Object.keys(this.accusedMe).length && press > 0.45 && next(r) < this.skill.lies) {
      once("claim", { t: "claim", role: this.fakeRole(s) });
      if (me.hand.some(isStone)) once("stone", { t: "stone", target: this.seat, has: false });
    }
  }

  /** HUNCHES (owner): said once when one forms; at a big moment (Faisla, final vote, Teer Kaman aim) the top hunch resurfaces */
  hunch(s: State, r: R, bigMoment: number | null) {
    const p = this.p(s), mine = this.side(s);
    const live = living(s).filter((q) => q.seat !== this.seat).map((q) => q.seat);
    if (!live.length) return;
    const prior = this.K / Math.max(1, this.n - 1);
    const score = (x: number) => (mine === "V" ? p[x] : (1 - p[x]) * (1 + (this.stone[x] ?? 0) + (this.accusedMe[x] ?? 0)) * 0.5);
    const top = live.reduce((a, b) => (score(b) > score(a) ? b : a), live[0]);
    const strong = mine === "V" ? p[top] > Math.max(0.55, prior * 1.8) : score(top) > 0.6 && next(r) < this.skill.lies;
    if (!strong) return;
    if (!this.hunched.has(top) && this.hunchRound !== s.round && this.hunched.size < 2 && next(r) < this.talky * 0.5) { this.hunched.add(top); this.hunchRound = s.round; this.out.push({ t: "accuse", target: top }); return; }
    if (bigMoment !== null && this.resurfaced !== bigMoment && this.hunched.has(top) && next(r) < this.talky * 0.3) { this.resurfaced = bigMoment; this.out.push({ t: "accuse", target: top }); }
  }
}

// ---------------------------------------------------------------- decisions
const count = (h: Card[], c: Card) => h.filter((x) => x === c).length;
const others = (s: State, seat: number) => living(s).filter((p) => p.seat !== seat).map((p) => p.seat);
const argmax = (xs: number[], f: (x: number) => number) => xs.reduce((a, b) => (f(b) > f(a) ? b : a), xs[0]);

/** how much I want x gone: villagers hunt thieves; thieves hunt villagers (most of all Stone-holders and accusers) */
function threat(b: Brain, s: State, p: number[], x: number) {
  if (b.side(s) === "V") return p[x] + (b.stone[x] ?? 0) * p[x];
  return (1 - p[x]) * (0.5 + (b.stone[x] ?? 0) + 0.5 * (b.accusedMe[x] ?? 0));
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
  const friend = b.known[nx] ? sideOf(b.known[nx]) === mine : mine === "V" ? p[nx] < 0.15 : false;
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
  const ranked = hand.map((c) => ({ c, v: score(c) + next(r) * 0.3 })).sort((x, y) => y.v - x.v);
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
  if (canDalBadal(s, b.seat) && (heat >= 2 || (late && !hand.some(isStone) && next(r) < 0.5))) return { kind: "dal_badal", targets: dbTargets(b, s, p) };
  const sure = o.find((x) => b.known[x] && sideOf(b.known[x]) !== mine);
  if (pair("TEER_KAMAN") && sure !== undefined) return { kind: "teer_kaman", target: sure };
  // [2.4] playing a pair means passing ALL 3 cards left — a Stone too. (owner 2026-11-22) "villagers and thieves both
  // try to hold the Stone, they are the only person they can trust at the start; once info starts revealing they take
  // the call to pass the Stone or keep it." Early: hold. Later: play only when the next player is someone I trust.
  if ((EXP.includes("H") || (EXP.includes("h") && mine === "V")) && hand.some(isStone)) {
    const nx = nextLiving(s, b.seat);
    const trusted = b.known[nx] ? sideOf(b.known[nx]) === mine : mine === "V" ? p[nx] < 0.15 : false;
    const informed = Object.keys(b.known).length > 1 || b.pressure(s) > 0.5;
    if (!informed || !trusted) return { kind: "pass" };
  }
  if (pair("HERA_PHERI")) {
    const bar = EXP.includes("X") && mine === "V" ? 0.3 : 0.5;
    const rich = o.filter((x) => (b.stone[x] ?? 0) > bar && (mine === "V" ? p[x] > 0.4 : p[x] < 0.6));
    if (rich.length) return { kind: "play", card: "HERA_PHERI", target: argmax(rich, (x) => b.stone[x]!) };
  }
  const top = argmax(o, (x) => threat(b, s, p, x));
  const prior = b.K / Math.max(1, b.n - 1);
  const press = EXP.includes("P") ? b.pressure(s) : 0; // (owner 2026-11-22) losing → take risks
  const confident = mine === "V" ? p[top] > Math.max(0.6 - 0.2 * press, prior * (2 - press)) : threat(b, s, p, top) > 1 - 0.4 * press;
  const stoneThief = mine === "V" && EXP.includes("X") && o.some((x) => (b.known[x] ? sideOf(b.known[x]) === "T" : p[x] > 0.55) && (b.stone[x] ?? 0) > 0.4);
  if (pair("FAISLA") && (confident || stoneThief || (late && next(r) < 0.5 + 0.4 * press))) return { kind: "play", card: "FAISLA" };
  const qw = (x: number) => (EXP.includes("X") ? (b.quiet[x] ?? 0) * 0.08 : 0); // the quiet-pass tell
  if (pair("KUNDLI")) { const unk = o.filter((x) => !b.known[x]); if (unk.length) return { kind: "play", card: "KUNDLI", target: argmax(unk, (x) => p[x] * (1 - p[x]) + qw(x) + next(r) * 0.05) }; }
  if (pair("TALASHI")) { const unk = o.filter((x) => b.stone[x] === undefined || (b.stone[x]! > 0 && b.stone[x]! < 1)); if (unk.length) return { kind: "play", card: "TALASHI", target: argmax(unk, (x) => (mine === "V" ? p[x] : 1 - p[x]) + qw(x) + next(r) * 0.2) }; }
  // (owner 2026-11-21, game NRMFZ: a bot held two Teer Kamans all game and never shot) a pair is a weapon: fire it when
  // the chance of a HIT is real — sooner in the last round, when a kept pair is a wasted pair
  if (pair("TEER_KAMAN") && EXP.includes("T")) {
    const best = argmax(o, (x) => tkOdds(b, s, p, x));
    // villagers need better odds than thieves (tuned on scripts/ab-brain.mts to keep the 46-53% balance)
    const bar = (mine === "V" ? (late ? 0.4 : 0.6) : (late ? 0.25 : 0.4)) - 0.15 * press;
    if (tkOdds(b, s, p, best) >= bar) return { kind: "teer_kaman", target: best };
  }
  if (pair("BHUKAMP") && next(r) < 0.25) return { kind: "play", card: "BHUKAMP" };
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
  const trust = (y: number) => (mine === "V" ? p[y] < 0.3 : false);
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
  if (other === "V" && b.claims[target] && sideOf(b.claims[target]) === "V" && !want.length) want.push(b.claims[target]); // a villager's claim is usually true
  const taken = new Set(Object.entries(b.known).filter(([seat]) => Number(seat) !== target).map(([, x]) => x));
  const pool = s.rolesInPlay.filter((x) => !want.includes(x) && sideOf(x) === other && !taken.has(x) && b.claims[target] !== x).sort(() => next(r) - 0.5);
  const rest = s.rolesInPlay.filter((x) => !want.includes(x) && !pool.includes(x));
  return { kind: "shoot", roles: [...new Set([...want, ...pool, ...rest])].slice(0, k) };
}

function chooseVote(b: Brain, s: State, final: boolean, r: R): Move {
  const o = others(s, b.seat), p = b.p(s), mine = b.side(s);
  // the table's mood: real tables gang up on the most-pointed-at player (a split vote is a tie, and a tie does nothing)
  const mood = (x: number) => Math.min(3, b.pointed[x] ?? 0) * 0.08;
  const known = (x: number) => (b.known[x] ? (sideOf(b.known[x]) === mine ? -2 : 2) : 0);
  if (mine === "V") {
    // [6.2] the final vote moves the out player's Stones to the OTHER team: a thief out with a Stone = a Stone for us,
    // a villager out with a Stone = a Stone for them. So weigh who holds a Stone, both ways.
    const swing = (x: number) => ((final || EXP.includes("X")) && EXP.includes("F") ? (b.stone[x] ?? 0) * (2 * p[x] - 1) * 0.6 : 0);
    const top = argmax(o, (x) => p[x] + mood(x) + known(x) + swing(x) + next(r) * 0.02);
    const prior = b.K / Math.max(1, b.n - 1);
    // the FINAL vote: everyone votes (nothing to save the vote for); a Faisla: only when the case is real
    if (!final && p[top] + mood(top) < prior * 1.5 && known(top) <= 0) return { kind: "vote", for: null };
    return { kind: "vote", for: top, extra: s.extraVote === b.seat && (final || p[top] > 0.8) };
  }
  // a thief: never votes for a partner it knows; rides the table's mood onto a villager, most of all a Stone-holder
  const top = argmax(o, (x) => threat(b, s, p, x) + mood(x) * 2 + known(x) + (final ? (b.stone[x] ?? 0) * 0.5 : 0) + next(r) * 0.05);
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
    return null;
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

export function playGame(n: number, seed: number, skill: Skill, probe?: (s: State, bots: Brain[]) => void): GameStats {
  let s = newGame(Array.from({ length: n }, (_, i) => `B${i}`), seed);
  const r: R = { rng: (seed * 2654435761) >>> 0 };
  const bots = s.players.map((p) => new Brain(p.seat, skill, 0.45 + next(r) * 0.45, s));
  for (const b of bots) {
    b.read(s, r);
    if (next(r) < 0.3) s = move(s, b.seat, { kind: "say", talk: { t: "claim", role: b.side(s) === "V" ? b.me(s).role : b.fakeRole(s) } });
  }
  let steps = 0, turns = 0, lastBig = -1;
  while (s.phase.kind !== "over" && steps++ < 4000) {
    const ph = s.phase;
    // a big moment opens: a Faisla vote, the final vote, a Teer Kaman aim
    const big = ph.kind === "vote" || ph.kind === "aim" ? s.events.length : null;
    const fresh = big !== null && lastBig === -1 ? big : null;
    if (big !== null && lastBig === -1) lastBig = big; if (big === null) lastBig = -1;
    for (const b of bots) {
      b.read(s, r);
      b.hunch(s, r, fresh);
      if (EXP.includes("S")) b.scheme(s, r);
      for (const a of b.asks.splice(0)) if (s.phase.kind !== "over") s = ask(s, b.seat, a.to, a.card);
      for (const t of b.out.splice(0)) { if (s.phase.kind === "over") break; s = move(s, b.seat, { kind: "say", talk: t }); }
    }
    if (s.phase.kind === "over") break;
    if (s.phase.kind === "aim") {
      const tb = bots[s.phase.target];
      if (next(r) < 0.7 && !s.events.slice(-4).some((e) => e.type === "say" && (e.data as { seat: number }).seat === tb.seat))
        s = move(s, tb.seat, { kind: "say", talk: { t: "claim", role: tb.side(s) === "V" ? tb.me(s).role : tb.fakeRole(s) } });
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
