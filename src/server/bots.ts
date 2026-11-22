// THE BOTS AT A SERVER TABLE (2026-11-19, revamp step 1). The bot brain is src/rules/brain.ts; this file only drives it
// from a stored game. A server call has no memory between requests, so each call rebuilds every bot's brain from the
// game's own log: it reads the OLD events quietly (beliefs only, no talk), then the NEW ones out loud (it may answer).
// What a bot already said is read back from the log, so a rebuilt bot never says the same hunch twice.
import { Brain, decide, reconsider, SKILLS, type SkillName } from "@/rules/brain";
import { next } from "@/rules/rng";
import { ask, move, type Move, type State, type Talk } from "@/rules/game";

/** how many lines one bot may say in one go — nobody blabbers (SITUATIONS.md) */
const MAX_LINES = 2;

/** a small stable number per name: how talkative that bot is (0.45-0.9, like playGame) */
export function talkyOf(name: string): number {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return 0.45 + (h % 1000) / 1000 * 0.45;
}

export interface BotSeat { seat: number; name: string; skill: SkillName }

/** The brains for one server call. `from`: the first event this call is about (everything before it is old news). */
export class BotTable {
  private brains = new Map<number, Brain>();
  /** one random stream per call, fixed by the game and where it is — the same call replays the same way */
  r: { rng: number };

  constructor(private bots: BotSeat[], private from: number, s: State) {
    this.r = { rng: (s.rng ^ Math.imul(from + 1, 2654435761)) >>> 0 };
  }

  has(seat: number) { return this.bots.some((b) => b.seat === seat); }

  /** the bot's brain, caught up with `s` */
  brain(seat: number, s: State): Brain {
    let b = this.brains.get(seat);
    if (!b) {
      const bot = this.bots.find((x) => x.seat === seat);
      if (!bot) throw new Error(`seat ${seat} is not a bot`);
      b = rebuild(bot, s, this.from, notesFrom(s, seat));
      this.brains.set(seat, b);
    }
    b.read(s, this.r);
    return b;
  }

  /** verdicts the bots reached this call that a later rebuild can't redo (they needed the bot's hand at the time):
   *  kept in the game's log as server-only lines (`to: []` — no phone ever sees them) */
  flush(s: State): State {
    for (const [seat, b] of this.brains) {
      for (const [n, lie] of b.noted.splice(0)) {
        if (n < this.from || b.notes.has(n)) continue;
        b.notes.set(n, lie);
        s.events.push({ n: s.events.length, to: [], type: "bot_note", msg: "", data: { seat, n, lie } });
      }
    }
    return s;
  }

  /** a bot's move now */
  decide(seat: number, s: State): Move {
    return decide(this.brain(seat, s), s, this.r);
  }

  /** every bot reads what just happened and may say up to MAX_LINES; run twice so a bot can answer another bot */
  talk(s: State): State {
    for (let pass = 0; pass < 2; pass++) {
      let said = false;
      for (const bot of this.bots) {
        if (s.phase.kind === "over") return s;
        const b = this.brain(bot.seat, s);
        b.hunch(s, this.r, bigMoment(s));
        b.scheme(s, this.r);
        for (const a of b.asks.splice(0)) { if (s.phase.kind === "over") return s; s = ask(s, bot.seat, a.to, a.card); said = true; }
        for (const t of b.out.splice(0).slice(0, MAX_LINES)) {
          if (s.phase.kind === "over") return s;
          s = move(s, bot.seat, { kind: "say", talk: t });
          said = true;
        }
      }
      if (!said) break;
    }
    return s;
  }

  /** THE OPEN VOTE (owner 2026-11-22): bots that already voted look at the live count and may swing (reconsider) */
  revote(s: State): State {
    for (let look = 0; look < 3 && s.phase.kind === "vote"; look++) {
      let moved = false;
      for (const bot of this.bots) {
        if (s.phase.kind !== "vote") return s;
        const m = reconsider(this.brain(bot.seat, s), s);
        if (m) { s = move(s, bot.seat, m); moved = true; }
      }
      if (!moved) break;
    }
    return s;
  }

  /** the start of the game: some bots say who they are (a thief lies), as in playGame */
  opening(s: State): State {
    for (const bot of this.bots) {
      const b = this.brain(bot.seat, s);
      if (next(this.r) < 0.3) s = move(s, bot.seat, { kind: "say", talk: claimFor(b, s) });
    }
    return s;
  }

  /** a Teer Kaman is aimed at a bot: it usually says who it is before the shot (once per aim) */
  aimed(s: State): State {
    const ph = s.phase;
    if (ph.kind !== "aim" || !this.has(ph.target)) return s;
    const since = lastIndex(s, (e) => e.type === "play" && (e.data as { card?: string })?.card === "TEER_KAMAN");
    if (s.events.slice(since).some((e) => e.type === "say" && (e.data as { seat?: number })?.seat === ph.target)) return s;
    const b = this.brain(ph.target, s);
    if (next(this.r) < 0.7) s = move(s, ph.target, { kind: "say", talk: claimFor(b, s) });
    return s;
  }
}

/** a bot's brain from the log: everything before `from` read quietly (beliefs only, no talk), then what it already said */
export function rebuild(bot: BotSeat, s: State, from: number, notes: Map<number, boolean>): Brain {
  const b = new Brain(bot.seat, SKILLS[bot.skill] ?? SKILLS.average, talkyOf(bot.name), s);
  b.notes = notes;
  // the random stream used here is thrown away, and so is any talk it would have made
  b.read({ ...s, events: s.events.slice(0, Math.min(from, s.events.length)) }, { rng: 1 });
  b.out = []; b.noted = [];
  remember(b, s);
  return b;
}

function notesFrom(s: State, seat: number): Map<number, boolean> {
  const m = new Map<number, boolean>();
  for (const e of s.events) if (e.type === "bot_note" && e.data?.seat === seat) m.set(e.data.n as number, Boolean(e.data.lie));
  return m;
}

const claimFor = (b: Brain, s: State): Talk => ({ t: "claim", role: b.side(s) === "V" ? b.me(s).role : b.fakeRole(s) });

function lastIndex(s: State, f: (e: State["events"][number]) => boolean): number {
  for (let i = s.events.length - 1; i >= 0; i--) if (f(s.events[i])) return i;
  return 0;
}

/** a big moment is open (a vote, a Teer Kaman aim): the event it opened with, so a hunch resurfaces once per moment */
function bigMoment(s: State): number | null {
  const k = s.phase.kind;
  if (k === "vote") return lastIndex(s, (e) => e.type === "vote");
  if (k === "aim") return lastIndex(s, (e) => e.type === "play" && (e.data as { card?: string })?.card === "TEER_KAMAN");
  return null;
}

/** what this bot already said, read back from the log: hunches said, accusers answered, the moment last resurfaced at */
function remember(b: Brain, s: State) {
  b.hunched.clear(); b.answered.clear(); b.resurfaced = -1; b.hunchRound = 0;
  let round = 1, moment = -1;
  for (const e of s.events) {
    if (e.type === "round") round = (e.data as { round: number }).round;
    if (e.type === "vote" || (e.type === "play" && (e.data as { card?: string })?.card === "TEER_KAMAN")) moment = e.n;
    if (e.type !== "say" || (e.data as { seat?: number })?.seat !== b.seat) continue;
    const t = (e.data as { talk: Talk }).talk;
    if (t.t !== "accuse") continue;
    if (b.hunched.size < 2) b.hunched.add(t.target);
    b.answered.add(t.target);
    b.hunchRound = round;
    if (moment >= 0) b.resurfaced = moment;
  }
}
