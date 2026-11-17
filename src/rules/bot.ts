// TEST BOTS for the balance check (2026-11-17) — NOT the in-game bots. They play docs/SITUATIONS.md: villagers mostly
// tell the truth, thieves lie and frame, both are sometimes silent; nobody knows anyone's team but their own (rule 1.4b).
// A bot only uses what its seat may know: its own cards and role, public events, and events sent to it.
import { int, next } from "@/engine/rng";
import {
  ACTIONS, type Action, type Card, canDalBadal, isStone, living, type Move, move, newGame, type Options, type Side,
  type State, type Talk, tkRoles, waitingOn,
} from "./game";

const THIEF_ROLES = new Set(["Chor", "Lootera", "Gunda", "Daku"]);
const sideOf = (role: string): Side => (THIEF_ROLES.has(role) ? "T" : "V");

/** how a bot sees the table */
export class Mind {
  seen = 0;
  /** >0 = thinks they're a thief */
  sus: Record<number, number> = {};
  /** roles this bot KNOWS (Kundli, a Teer Kaman card shown) — cleared by a Dal Badal shuffle */
  known: Record<number, string> = {};
  /** 0..1 belief that a seat holds a Stone */
  stone: Record<number, number> = {};
  claims: Record<number, string> = {};
  /** things to say, filled while reading events */
  out: Talk[] = [];
  constructor(public seat: number, public talky: number) {}

  me(s: State) { return s.players[this.seat]; }
  side(s: State) { return this.me(s).side; }
  cred(x: number) { return Math.max(0.1, Math.min(1, 1 - (this.sus[x] ?? 0) / 4)); }
  /** the team this bot believes a seat is on, if it knows */
  believed(s: State, x: number): Side | null {
    if (x === this.seat) return this.side(s);
    if (this.known[x]) return sideOf(this.known[x]);
    const v = this.sus[x] ?? 0;
    return v >= 2.5 ? "T" : v <= -2.5 ? "V" : null;
  }
  friend(s: State, x: number) { const b = this.believed(s, x); return b === this.side(s); }
  enemy(s: State, x: number) { const b = this.believed(s, x); return b !== null && b !== this.side(s); }
  /** how much this seat wants x gone: villagers hunt thieves; thieves hunt villagers (but never know their partners) */
  threat(s: State, x: number) {
    const v = this.sus[x] ?? 0;
    if (this.known[x]) return sideOf(this.known[x]) === this.side(s) ? -5 : 5 + (this.stone[x] ?? 0) * 3;
    return this.side(s) === "V" ? v + (this.stone[x] ?? 0) : -v + (this.stone[x] ?? 0) * 2 + (this.accusedMe[x] ?? 0);
  }
  accusedMe: Record<number, number> = {};

  /** read every event this seat may see since last time */
  read(s: State, r: { rng: number }) {
    const mine = this.side(s);
    for (; this.seen < s.events.length; this.seen++) {
      const e = s.events[this.seen];
      if (e.to !== "all" && !e.to.includes(this.seat)) continue;
      const d = (e.data ?? {}) as Record<string, unknown>;
      switch (e.type) {
        case "kundli": case "teer_kaman_shown": {
          const t = d.target as number, role = d.role as string;
          this.known[t] = role;
          this.sus[t] = sideOf(role) === "T" ? 5 : -5;
          if (e.type === "kundli" && t !== this.seat && next(r) < this.talky) this.speakAbout(s, t, role, r);
          break;
        }
        case "talashi": {
          const t = d.target as number, cards = d.cards as Card[];
          this.stone[t] = cards.some(isStone) ? 1 : 0;
          if (next(r) < this.talky * 0.6) {
            // villagers report truly unless it exposes a friend; thieves hide a Stone they plan to steal, or invent one
            if (mine === "V" && !(this.friend(s, t) && cards.some(isStone))) this.out.push({ t: "saw_cards", target: t, cards });
            if (mine === "T" && !cards.some(isStone) && next(r) < 0.4) this.out.push({ t: "saw_cards", target: t, cards: ["TUNGA_STONE", cards[0] ?? "FAISLA"] });
          }
          break;
        }
        case "stole": { const n = (d.cards as Card[]).some(isStone); if (n && mine === "V" && next(r) < 0.5) this.out.push({ t: "react", emoji: "cheer" }); break; }
        case "robbed": {
          const lost = (d.cards as Card[]).some(isStone);
          const by = s.events.slice(0, e.n).reverse().find((x) => x.type === "play" && (x.data as { card?: string })?.card === "HERA_PHERI");
          const stealer = (by?.data as { seat?: number })?.seat;
          if (stealer !== undefined) this.stone[stealer] = lost ? 1 : this.stone[stealer] ?? 0;
          if (lost && next(r) < this.talky) {
            this.out.push({ t: "react", emoji: "cry" });
            if (stealer !== undefined && !this.friend(s, stealer)) this.out.push({ t: "accuse", target: stealer });
          }
          break;
        }
        case "dal_badal": {
          const seats = [d.seat as number, ...(d.targets as number[])];
          for (const x of seats) if (x !== this.seat) { delete this.known[x]; this.sus[x] = 1; } // old knowledge is stale
          break;
        }
        case "role": this.known[this.seat] = d.role as string; break;
        case "say": {
          const from = d.seat as number, k = d.talk as Talk;
          if (from === this.seat) break;
          this.hear(s, from, k, r);
          break;
        }
        case "teer_kaman": {
          // a miss: the shooter guessed wrong (no info about the target's team); a hit: the target was what the shooter named
          break;
        }
        case "pass": case "play": break;
      }
    }
  }

  private speakAbout(s: State, t: number, role: string, r: { rng: number }) {
    const mine = this.side(s), theirs = sideOf(role);
    if (mine === "V") this.out.push(theirs === "T" ? { t: "saw_role", target: t, role } : { t: "vouch", target: t });
    else if (theirs === "V" && next(r) < 0.6) this.out.push({ t: "saw_role", target: t, role: [...THIEF_ROLES].filter((x) => s.rolesInPlay.includes(x))[0] ?? "Chor" }); // frame
    else if (theirs === "T" && next(r) < 0.4) this.out.push({ t: "vouch", target: t }); // a new hidden ally
  }

  private hear(s: State, from: number, k: Talk, r: { rng: number }) {
    const c = this.cred(from), mine = this.side(s);
    const lie = (w: number) => { this.sus[from] = (this.sus[from] ?? 0) + w; };
    switch (k.t) {
      case "claim": {
        if (!s.rolesInPlay.includes(k.role)) lie(3); // [1.4c] a role not in play: a provable lie
        const dup = Object.entries(this.claims).find(([x, role]) => role === k.role && Number(x) !== from);
        if (dup) { lie(1.5); this.sus[Number(dup[0])] = (this.sus[Number(dup[0])] ?? 0) + 1.5; }
        if (from in this.known && this.known[from] !== k.role) lie(4);
        if (k.role === this.known[this.seat]) lie(4); // they claim MY role
        this.claims[from] = k.role;
        break;
      }
      case "accuse": {
        if (k.target === this.seat) {
          this.accusedMe[from] = (this.accusedMe[from] ?? 0) + 1;
          if (mine === "V") lie(2); // I know it's false
          if (next(r) < this.talky) this.out.push(mine === "V" ? { t: "claim", role: this.me(s).role } : { t: "claim", role: this.fakeRole(s) }, { t: "accuse", target: from });
          break;
        }
        if (this.known[k.target]) { if (sideOf(this.known[k.target]) === "V") lie(3); break; }
        this.sus[k.target] = (this.sus[k.target] ?? 0) + 1.2 * c;
        break;
      }
      case "vouch": {
        if (this.known[k.target] && sideOf(this.known[k.target]) === "T") lie(3);
        else this.sus[k.target] = (this.sus[k.target] ?? 0) - 0.8 * c;
        break;
      }
      case "saw_role": {
        if (k.target === this.seat) { if (k.role !== this.me(s).role) lie(4); break; }
        if (!s.rolesInPlay.includes(k.role)) { lie(3); break; }
        if (this.known[k.target]) { if (this.known[k.target] !== k.role) lie(4); break; }
        this.sus[k.target] = (this.sus[k.target] ?? 0) + (sideOf(k.role) === "T" ? 2.2 : -1.5) * c;
        break;
      }
      case "saw_cards": {
        if (k.target === this.seat) { const real = this.me(s).hand; if (k.cards.some((x) => !real.includes(x))) lie(3); break; }
        this.stone[k.target] = k.cards.some(isStone) ? Math.max(this.stone[k.target] ?? 0, c) : (this.stone[k.target] ?? 0) * (1 - c);
        break;
      }
      case "stone": this.stone[k.target] = k.has ? Math.max(this.stone[k.target] ?? 0, 0.5 * c) : (this.stone[k.target] ?? 0) * 0.7; break;
      case "react": break;
    }
  }

  fakeRole(s: State): string {
    const vs = s.rolesInPlay.filter((x) => sideOf(x) === "V");
    const free = vs.filter((x) => !Object.values(this.claims).includes(x));
    return (free[0] ?? vs[0]) as string;
  }
}

// ---------------------------------------------------------------- decisions
const has = (h: Card[], c: Card) => h.filter((x) => x === c).length;
function others(s: State, seat: number) { return living(s).filter((p) => p.seat !== seat).map((p) => p.seat); }
function best(xs: number[], f: (x: number) => number) { return xs.reduce((a, b) => (f(b) > f(a) ? b : a), xs[0]); }

/** what this bot keeps when it must keep `keep` cards */
function keepScore(m: Mind, s: State, c: Card, hand: Card[]): number {
  if (isStone(c)) return 10;                                    // both teams want the Stones with themselves
  if (c === "DAL_BADAL") return m.side(s) === "T" ? 8 : -1;      // useless to a villager
  return has(hand, c) >= 2 ? 3 : 1 + (c === "TEER_KAMAN" || c === "KUNDLI" ? 0.5 : 0);
}
function choosePass(m: Mind, s: State, keep: number, r: { rng: number }): Card[] {
  const hand = [...m.me(s).hand];
  const ranked = hand.map((c, i) => ({ c, i, v: keepScore(m, s, c, hand) + next(r) * 0.3 })).sort((a, b) => b.v - a.v);
  return ranked.slice(keep).slice(0, Math.min(3, hand.length - keep)).map((x) => x.c);
}

function chooseTurn(m: Mind, s: State, r: { rng: number }): Move {
  const me = m.me(s), mine = me.side, hand = me.hand, o = others(s, m.seat);
  const late = s.round >= s.rounds;
  const pair = (a: Action) => has(hand, a) >= 2;
  const enemies = o.filter((x) => m.enemy(s, x));
  const topThreat = best(o, (x) => m.threat(s, x));
  // Dal Badal on my own turn when I'm under pressure (accused) or late without a Stone
  if (canDalBadal(s, m.seat)) {
    const heat = Object.values(m.accusedMe).reduce((a, b) => a + b, 0);
    if (heat >= 2 || (late && !hand.some(isStone) && next(r) < 0.5)) return { kind: "dal_badal", targets: dbTargets(m, s) };
  }
  // a sure Teer Kaman: I KNOW an enemy's exact role
  const sure = o.find((x) => m.known[x] && sideOf(m.known[x]) !== mine);
  if (pair("TEER_KAMAN") && sure !== undefined) return { kind: "teer_kaman", target: sure };
  if (pair("HERA_PHERI")) {
    const rich = o.filter((x) => (m.stone[x] ?? 0) > 0.5 && !m.friend(s, x));
    if (rich.length) return { kind: "play", card: "HERA_PHERI", target: best(rich, (x) => m.stone[x]!) };
  }
  if (pair("FAISLA") && enemies.length && (late || next(r) < 0.6)) return { kind: "play", card: "FAISLA" };
  if (pair("KUNDLI")) { const unk = o.filter((x) => !m.known[x]); if (unk.length) return { kind: "play", card: "KUNDLI", target: best(unk, (x) => Math.abs(m.sus[x] ?? 0) * -1 + (m.sus[x] ?? 0) + next(r)) }; }
  if (pair("TALASHI")) { const unk = o.filter((x) => m.stone[x] === undefined); if (unk.length) return { kind: "play", card: "TALASHI", target: unk[int(r, unk.length)] }; }
  if (pair("TEER_KAMAN") && mine === "V" && (m.sus[topThreat] ?? 0) >= 3) return { kind: "teer_kaman", target: topThreat };
  if (pair("FAISLA") && (m.threat(s, topThreat) >= 2.5)) return { kind: "play", card: "FAISLA" };
  if (pair("BHUKAMP") && next(r) < 0.25) return { kind: "play", card: "BHUKAMP" };
  if (pair("HERA_PHERI") && next(r) < 0.3) return { kind: "play", card: "HERA_PHERI", target: o[int(r, o.length)] };
  return { kind: "pass" };
}

function dbTargets(m: Mind, s: State): number[] {
  const o = others(s, m.seat);
  const n = Math.min(3, o.length);
  // accusers first, then villagers believed to hold a Stone, then anyone
  return [...o].sort((a, b) => ((m.accusedMe[b] ?? 0) * 3 + (m.stone[b] ?? 0) * 2) - ((m.accusedMe[a] ?? 0) * 3 + (m.stone[a] ?? 0) * 2)).slice(0, n);
}

function chooseShoot(m: Mind, s: State, target: number, r: { rng: number }): Move {
  const k = tkRoles(s);
  const want = m.known[target] ? [m.known[target]] : [];
  const pool = s.rolesInPlay.filter((x) => !want.includes(x) && (m.side(s) === "V" ? sideOf(x) === "T" : sideOf(x) === "V") && m.claims[target] !== x);
  const rest = s.rolesInPlay.filter((x) => !want.includes(x) && !pool.includes(x));
  const order = [...want, ...pool.sort(() => next(r) - 0.5), ...rest];
  return { kind: "shoot", roles: [...new Set(order)].slice(0, k) };
}

function chooseVote(m: Mind, s: State, final: boolean, r: { rng: number }): Move {
  const o = others(s, m.seat);
  const target = best(o, (x) => m.threat(s, x) + (final ? (m.stone[x] ?? 0) * 2 : 0) + next(r) * 0.4);
  const t = m.threat(s, target);
  if (t < (final ? 0.3 : 1)) return { kind: "vote", for: null };
  return { kind: "vote", for: target, extra: s.extraVote === m.seat && (final || t >= 4) };
}

export function decide(m: Mind, s: State, r: { rng: number }): Move {
  const ph = s.phase;
  switch (ph.kind) {
    case "turn": return chooseTurn(m, s, r);
    case "pass": return { kind: "give", cards: choosePass(m, s, ph.keep, r) };
    case "vote": return chooseVote(m, s, ph.final, r);
    case "aim": return chooseShoot(m, s, ph.target, r);
    case "bhukamp": {
      const hand = m.me(s).hand;
      const worst = [...hand].sort((a, b) => keepScore(m, s, a, hand) - keepScore(m, s, b, hand))[0];
      return { kind: "bhukamp", card: worst };
    }
    case "gift": {
      const o = living(s).map((p) => p.seat);
      return { kind: "gift", to: best(o, (x) => -m.threat(s, x) + next(r) * 0.2) };
    }
    default: throw new Error("nothing to decide");
  }
}

/** (B) out of turn: a thief under fire shuffles — aimed at, or about to be voted out */
function outOfTurnDalBadal(m: Mind, s: State): Move | null {
  if (!canDalBadal(s, m.seat)) return null;
  const ph = s.phase;
  if (ph.kind === "aim" && ph.target === m.seat) return { kind: "dal_badal", targets: dbTargets(m, s) };
  if (ph.kind === "vote" && Object.values(m.accusedMe).reduce((a, b) => a + b, 0) >= 2) return { kind: "dal_badal", targets: dbTargets(m, s) };
  return null;
}

// ---------------------------------------------------------------- one whole game
export interface GameStats {
  players: number; winner: Side; reason: string; turns: number; rounds: number;
  dalBadal: number; tkHit: number; tkMiss: number; faislaOut: number; says: number; lies: number;
}

export function playGame(n: number, seed: number, opts: Options): GameStats {
  let s = newGame(Array.from({ length: n }, (_, i) => `B${i}`), seed, opts);
  const r = { rng: (seed * 2654435761) >>> 0 };
  const minds = s.players.map((p) => new Mind(p.seat, 0.4 + next(r) * 0.5));
  // opening claims: some villagers say their role; some thieves claim a villager role
  for (const m of minds) {
    m.read(s, r);
    if (next(r) < 0.35) s = move(s, m.seat, { kind: "say", talk: { t: "claim", role: m.side(s) === "V" ? m.me(s).role : m.fakeRole(s) } });
  }
  let steps = 0, turns = 0;
  while (s.phase.kind !== "over" && steps++ < 4000) {
    // everyone reads, then says what they decided to say
    for (const m of minds) {
      m.read(s, r);
      for (const t of m.out.splice(0)) { if (s.phase.kind === "over") break; s = move(s, m.seat, { kind: "say", talk: t }); }
    }
    if (s.phase.kind === "over") break;
    // (B) a thief under fire may shuffle out of turn
    if (opts.dalBadalAnytime) {
      let fired = false;
      for (const m of minds) { const mv = outOfTurnDalBadal(m, s); if (mv) { s = move(s, m.seat, mv); fired = true; break; } }
      if (fired) continue;
    }
    // the aimed-at target pleads (a true or false role claim) before the shot
    if (s.phase.kind === "aim") {
      const tm = minds[s.phase.target];
      if (!tm.out.length && next(r) < 0.8 && !s.events.slice(-3).some((e) => e.type === "say" && (e.data as { seat: number }).seat === tm.seat))
        s = move(s, tm.seat, { kind: "say", talk: { t: "claim", role: tm.side(s) === "V" ? tm.me(s).role : tm.fakeRole(s) } });
    }
    const who = waitingOn(s)[0];
    if (s.phase.kind === "turn") turns++;
    s = move(s, who, decide(minds[who], s, r));
  }
  const ev = s.events;
  const over = s.phase.kind === "over" ? s.phase : { winner: "T" as Side, reason: "stuck" };
  const truth = new Map<number, string>();
  return {
    players: n, winner: over.winner, reason: over.reason, turns, rounds: s.round,
    dalBadal: ev.filter((e) => e.type === "dal_badal").length,
    tkHit: ev.filter((e) => e.type === "teer_kaman" && (e.data as { hit: boolean }).hit).length,
    tkMiss: ev.filter((e) => e.type === "teer_kaman" && !(e.data as { hit: boolean }).hit).length,
    faislaOut: ev.filter((e) => e.type === "out").length - ev.filter((e) => e.type === "teer_kaman").length,
    says: ev.filter((e) => e.type === "say").length,
    lies: truth.size,
  };
}
export { ACTIONS };
