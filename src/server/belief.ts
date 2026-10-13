// Bot BELIEFS (2026-10-09, from reports/Bot behaviour modelling for social deduction.md): rule-based bots with an
// explicit belief model, the approach the published work finds most human-like (Secret Hitler rule agents agree with
// expert human votes 86.7%; LLMs 59.7%).
//   · each bot holds P(thief) for every other seat, held to the number of thieves in play (a count, not loose points)
//   · certainties are facts: its own role, its Kundli reads, any role it was shown (Faisla caller, Teer Kaman shooter)
//   · claims are evidence, believed as far as the speaker seems a villager — most speakers are, so most claims are
//     believed (the truth bias real tables show: truths believed 61%, lies caught 47%)
//   · trust moves when a claim meets a role: a liar becomes a suspect
//   · Dal Badal blends the three seats in the shuffle; "the game didn't end" means a thief is still alive
//   · thieves lie plausibly and vote with the table's suspicion (they don't know their partners)
// A bot reads ONLY viewFor(its seat) — no secrets. Three SKILL levels; every balance number is reported as a band.
// ⚠ The skill numbers are starting guesses until they are set from real playtest logs.
import type { Card, GameState, Side } from "@/engine/types";
import { canDalBadal, canPlay, dalBadalPick, passSize } from "@/engine/engine";
import { viewFor } from "@/engine/view";
import { THIEF_ROLES, tkGuesses } from "@/engine/setup";
import { randomAction, readsOf } from "@/engine/decisions";
import { deduce, unanswered, UNANSWERED, type Model } from "./deduce";
import type { Action } from "@/engine/types";

type R = () => number;

export interface Skill {
  name: "casual" | "average" | "sharp";
  /** chance of playing a pair when one is playable */
  activity: number;
  /** how hard evidence moves a belief */
  sharp: number;
  /** size of the bot's own fixed hunches */
  noise: number;
  /** chance a ballot goes to one of the top 3 suspects at random instead of the top one */
  voteNoise: number;
  /** chance a thief lies when it has something to say */
  lie: number;
  /** chance a bot speaks up with what it knows, each debate */
  claimRate: number;
  /** chance of firing Teer Kaman with no Kundli read (at its top suspect) */
  blindShot: number;
  /** EXACT DEDUCTION (deduce.ts, stage 1 of the DeepRole-style bots): weigh every placement of the thieves instead
   *  of nudging scores */
  exact?: boolean;
  /** the behaviour model deduce.ts weighs moves with (default MODEL) — passed here, never by mutating an import
   *  (tsx loads modules twice: a script's MODEL is not the bots' MODEL) */
  model?: Model;
  // ---- THE PLAYBOOK (designer 2026-10-12: "beginners gamble, skilful players hold"). Each line is a measured finding
  // (scripts/sdlab.mts): what a skilled player does, and how often a beginner does the opposite.
  /** a thief holding a Stone plays its pair anyway and lets the Stone go on, on luck. Measured: sitting on the Stone is
   *  worth +10..+13 to the thieves; the gamble pays nothing */
  stoneGamble?: number;
  /** a villager passes at random now and then, Stones and all (passing carelessly costs the village 3..13) */
  careless?: number;
  /** DAL BADAL: "random" = whenever, with anyone (how it was played before — costs the thieves); "exposed" = once
   *  called a thief or read, shuffle with the accusers; voted out → with the likeliest Stone holders. "full" = that,
   *  plus round 3 with no Stone ever seen → with the Stone holders, and in the mandatory debate once exposed
   *  (the designer's table: +10..+21 for the thieves) */
  dalBadal?: "random" | "exposed" | "full";
  /** never pass Dal Badal on: a thief banks it; a villager holds it so no thief gets it */
  keepDalBadal?: boolean;
  /** a villager holding a Teer Kaman pair shoots a player whose ROLE an accusation named (the designer's table) */
  accuseShot?: number;
  /** ... even when the bot itself doesn't believe the accusation (beginners follow the loudest voice) */
  followAnyAccusation?: boolean;
  /** a thief keeps its cards to itself: no Kundli (it shows its own role back) and no blind Teer Kaman — playing
   *  those costs the thieves (restricted play) */
  thiefRestraint?: boolean;
  /** chance a villager calls Faisla only with a suspect who stands out (forcing it costs the village ~10 at 6p) */
  faislaDiscipline?: number;
  /** THE QUIET TELL (the designer's "the table notices who stops playing"): a player who keeps passing while others
   *  play is likely sitting on a Stone — and a skilled thief does exactly that. How hard this bot reads it (0 = never):
   *  it raises their odds of holding a Stone and of being a thief, so Talashi, Hera Pheri and the votes go their way */
  readQuiet?: number;
}

export const SKILLS: Record<Skill["name"], Skill> = {
  // a BEGINNER: gambles the Stone, passes carelessly, uses Dal Badal whenever, follows any accusation, calls Faisla freely
  casual: { name: "casual", activity: 0.6, sharp: 0.5, noise: 1.2, voteNoise: 0.35, lie: 0.4, claimRate: 0.5, blindShot: 0.3,
    stoneGamble: 0.6, careless: 0.3, dalBadal: "random", keepDalBadal: false, accuseShot: 0.7, followAnyAccusation: true, thiefRestraint: false, faislaDiscipline: 0.5, readQuiet: 0 },
  // (designer 2026-10-09) average and sharp bots weigh every placement of the thieves (deduce.ts); casual bots keep the
  // rougher score-nudging, so a table still has bots that misjudge like people do
  average: { name: "average", activity: 0.8, sharp: 1, noise: 0.7, voteNoise: 0.15, lie: 0.6, claimRate: 0.8, blindShot: 0, exact: true,
    stoneGamble: 0.25, careless: 0, dalBadal: "exposed", keepDalBadal: true, accuseShot: 0.8, followAnyAccusation: false, thiefRestraint: false, faislaDiscipline: 1, readQuiet: 0.5 },
  // SKILLED: sits on the Stone, holds Dal Badal for the right moment (or so no thief gets it), keeps its cards close as a thief
  sharp: { name: "sharp", activity: 0.85, sharp: 1.6, noise: 0.3, voteNoise: 0.05, lie: 0.8, claimRate: 1, blindShot: 0, exact: true,
    stoneGamble: 0, careless: 0, dalBadal: "full", keepDalBadal: true, accuseShot: 0.9, followAnyAccusation: false, thiefRestraint: true, faislaDiscipline: 1, readQuiet: 1 },
};
export const DEFAULT_SKILL = SKILLS.average;

/** a small fixed lean per bot and target, so bots don't all agree */
const hunch = (seed: number, a: number, b: number) => (((seed ^ (a * 7919) ^ (b * 104729)) >>> 0) % 1000) / 1000;
const sig = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));
const pick = <T,>(r: R, xs: T[]): T => xs[Math.floor(r() * xs.length)];

export interface Claim { actor: number; target: number; side: Side; kind: string; /** an accusation not yet answered */ pending?: boolean }
export interface Belief {
  /** P(thief) for every seat but the bot's own (living and out) */
  p: Map<number, number>;
  /** sides it knows for certain */
  known: Map<number, Side>;
  /** trust record per speaker: + for claims that came true, − for lies */
  trust: Map<number, number>;
}

/** `asTable`: a thief's view of what the TABLE thinks — its own side is set aside and it spreads all the thieves
 *  over the others (it doesn't know its partners), which is what it votes with to blend in */
/** THE QUIET TELL (2026-10-12): each living player's share of turns spent passing, against the table's average
 *  (only once they have had 2 turns) — positive = quieter than the table */
export function quietness(s: GameState): Map<number, number> {
  const turns = new Map<number, number>(), passes = new Map<number, number>();
  for (const e of s.events) {
    const x = e.data?.seat;
    if (typeof x !== "number") continue;
    if (e.type === "pickup") turns.set(x, (turns.get(x) ?? 0) + 1);
    if (e.type === "pass") passes.set(x, (passes.get(x) ?? 0) + 1);
  }
  const seen = s.players.filter((p) => p.alive && (turns.get(p.seat) ?? 0) >= 2).map((p) => p.seat);
  if (seen.length < 2) return new Map();
  const rate = (x: number) => (passes.get(x) ?? 0) / (turns.get(x) ?? 1);
  const mean = seen.reduce((a, x) => a + rate(x), 0) / seen.length;
  return new Map(seen.map((x) => [x, rate(x) - mean]));
}

/** a skilled reader leans toward the quiet player being a thief (never against what it knows for certain) */
function readQuietTell(s: GameState, seat: number, skill: Skill, known: Map<number, Side>, p: Map<number, number>): Map<number, number> {
  if (!skill.readQuiet) return p;
  for (const [x, q] of quietness(s)) {
    if (x === seat || known.has(x) || !p.has(x)) continue;
    const v = Math.min(0.98, Math.max(0.02, p.get(x)!));
    p.set(x, sig(logit(v) + 2 * skill.readQuiet * q));
  }
  return p;
}

export function beliefOf(s: GameState, seat: number, seed: number, skill: Skill = DEFAULT_SKILL, asTable = false): Belief {
  const v = viewFor(s, seat);
  const n = v.players.length;
  const thiefSide = v.me.side === "T";
  const K = v.rolesInPlay.filter((x) => THIEF_ROLES.includes(x)).length;
  const L = new Map<number, number>();
  for (let x = 0; x < n; x++) if (x !== seat) L.set(x, (hunch(seed, seat, x) - 0.5) * 2 * skill.noise);
  const bump = (x: number | null | undefined, d: number) => { if (x !== null && x !== undefined && L.has(x)) L.set(x, L.get(x)! + d * skill.sharp); };
  const known = new Map<number, Side>();
  const trust = new Map<number, number>();
  const claims: Claim[] = [];
  const outBallots = new Map<number, Record<string, number | null>>();
  let ballots: Record<string, number | null> = {};
  const num = (d: Record<string, unknown> | undefined, k: string) => (typeof d?.[k] === "number" ? (d[k] as number) : null);

  for (const e of v.events) {
    if (Array.isArray(e.to) && !e.to.includes(seat)) continue; // after the game every secret is public — use only its own
    const d = e.data, actor = num(d, "seat"), target = num(d, "target");
    switch (e.type) {
      case "kundli_private": if (target !== null) known.set(target, d?.side as Side); break;
      case "dal_badal": {
        // a thief role was shown, then the three role cards were shuffled: one of these three holds it now
        for (const x of (d?.seats as number[]) ?? []) { known.delete(x); bump(x, 1.0); }
        break;
      }
      case "vote_result":
        ballots = (d?.ballots as Record<string, number | null>) ?? {};
        if (!thiefSide) for (const [voter, t] of Object.entries(ballots)) if (t === seat) bump(Number(voter), 0.5);
        break;
      case "teer_kaman": if (target === seat && !thiefSide) bump(actor, 1.2); break;
      case "hera_pheri": if (target === seat) bump(actor, 0.3); break;
      // a player's newer word about a seat replaces the older one (designer 2026-10-12)
      case "claim": if (actor !== null && target !== null && actor !== seat && d?.kind !== "stone") {
        const old = claims.findIndex((c) => c.actor === actor && c.target === target);
        if (old >= 0) claims.splice(old, 1);
        // (2026-10-13) every claim names a role now; one with nothing behind it weighs like the old bare accusation
        const kind = d?.kind === "accuse" || d?.kind === "trust" || !backedClaim(s.events, actor, target, e.n) ? "accuse" : String(d?.kind);
        claims.push({ actor, target, side: d?.side as Side, kind, pending: d?.side === "T" && unanswered(s.events, e.n, target) }); }
        break;
      // a word whispered to this bot alone (playtest 2026-10-07) weighs like a claim out loud
      case "whisper_private":
        if (actor !== null && target !== null && actor !== seat && num(d, "to") === seat && d?.side) claims.push({ actor, target, side: d.side as Side, kind: "kundli" });
        break;
      case "eliminated_private":
      case "eliminated": {
        if (actor === null) break;
        if (!outBallots.has(actor)) outBallots.set(actor, ballots);
        ballots = {};
        const side = d?.side as Side | undefined;
        if (!side) break; // a hidden exit tells nothing about the role
        known.set(actor, side);
        for (const c of claims) if (c.target === actor) trust.set(c.actor, (trust.get(c.actor) ?? 0) + (c.side === side ? 1 : -2));
        for (const [voter, t] of Object.entries(outBallots.get(actor) ?? {})) if (t === actor) bump(Number(voter), side === "V" ? 0.6 : -0.4);
        const killer = num(d, "killer");
        if (side === "V" && killer !== null) bump(killer, 0.8);
        break;
      }
    }
  }
  known.set(seat, v.me.side);

  // probabilities held to the count: the thieves not yet placed spread over the seats whose side is unknown
  const self = asTable && thiefSide; // spread all K thieves over the others, as the table would
  const unknown = [...L.keys()].filter((x) => !known.has(x));
  const placed = [...known].filter(([x, sd]) => sd === "T" && !(self && x === seat)).length;
  const R0 = Math.max(0, K - placed);
  const probs = () => {
    const odds = new Map(unknown.map((x) => [x, Math.exp(L.get(x)!)]));
    const fit = (target: number, xs: number[]) => {
      if (!xs.length) return new Map<number, number>();
      let lo = -30, hi = 30;
      for (let i = 0; i < 50; i++) {
        const mid = (lo + hi) / 2, c = Math.exp(mid);
        const sum = xs.reduce((a, x) => a + (c * odds.get(x)!) / (1 + c * odds.get(x)!), 0);
        if (sum > target) hi = mid; else lo = mid;
      }
      const c = Math.exp((lo + hi) / 2);
      return new Map(xs.map((x) => [x, (c * odds.get(x)!) / (1 + c * odds.get(x)!)]));
    };
    let pu = fit(Math.min(R0, unknown.length), unknown);
    // the game didn't end, so at least one thief is alive
    const aliveKnownThief = [...known].some(([x, sd]) => sd === "T" && v.players[x]?.alive && !(self && x === seat));
    const aliveUnknown = unknown.filter((x) => v.players[x]?.alive);
    const aliveMass = aliveUnknown.reduce((a, x) => a + pu.get(x)!, 0);
    if (!aliveKnownThief && !(thiefSide && !self) && aliveUnknown.length && aliveMass < 1) {
      const deadUnknown = unknown.filter((x) => !v.players[x]?.alive);
      pu = new Map([...fit(1, aliveUnknown), ...fit(Math.max(0, Math.min(R0 - 1, deadUnknown.length)), deadUnknown)]);
    }
    const p = new Map<number, number>();
    for (const x of L.keys()) p.set(x, known.has(x) && !(self && x === seat) ? (known.get(x) === "T" ? 1 : 0) : pu.get(x) ?? sig(L.get(x)!));
    return p;
  };

  // claims: a speaker is believed as far as the bot thinks they are a villager (villagers tell the truth) — so with
  // few thieves most claims are believed, the truth bias real tables show — moved by their record of claims that came
  // true or false. A known villager is believed; a known thief is not.
  for (const [who, t] of trust) if (t < 0) bump(who, -0.8 * t); // caught lying: suspect
  const base = probs();
  const credence = (who: number) => {
    const k = known.get(who);
    if (k === "V" && who !== seat) return 0.95;
    if (k === "T" && who !== seat) return thiefSide && !asTable ? 0.5 : 0.05;
    return Math.min(0.95, Math.max(0.05, 1 - (base.get(who) ?? 0.5) + 0.12 * (trust.get(who) ?? 0)));
  };
  for (const c of claims) {
    if (c.target === seat) { if (c.side === "T" && !thiefSide) bump(c.actor, 1.5); continue; } // a lie about me
    const cr = credence(c.actor);
    const w = 2 * cr - 1; // -1 … 1
    // Bayes on the target: true with the speaker's credence, otherwise the bot's own prior stands.
    // "X is a thief" → P = cr + (1 − cr)·prior; "X is a villager" → P = (1 − cr)·prior. A bare accusation (no Kundli
    // behind it) counts half.
    const prior = Math.min(0.98, Math.max(0.02, base.get(c.target) ?? 0.3));
    const post = Math.min(0.98, Math.max(0.02, c.side === "T" ? cr + (1 - cr) * prior : (1 - cr) * prior));
    // a word from a player already out counts half (2026-10-12): nobody can question them any more
    const gone = !v.players[c.actor]?.alive && known.get(c.actor) !== "V" ? 0.5 : 1;
    const shift = (logit(post) - logit(prior)) * (c.kind === "accuse" ? 0.5 : 1) * (c.pending ? UNANSWERED : 1) * gone;
    if (L.has(c.target)) L.set(c.target, L.get(c.target)! + shift * Math.min(1, skill.sharp));
    if (c.kind === "was") {
      // a word about a player already out also judges the voters who put them out
      for (const [voter, t] of Object.entries(outBallots.get(c.target) ?? {})) if (t === c.target) bump(Number(voter), (c.side === "V" ? 0.6 : -0.4) * w);
    }
  }
  if (skill.exact) {
    // every placement of the thieves, weighed (deduce.ts); the trust record above still decides whose word to take
    const ex = deduce(s, seat, skill.model, asTable && thiefSide).p;
    ex.delete(seat);
    if (self) ex.set(seat, 0);
    return { p: readQuietTell(s, seat, skill, known, ex), known, trust };
  }
  return { p: readQuietTell(s, seat, skill, known, probs()), known, trust };
}

/** A ballot from beliefs. A villager votes a thief it knows, else its likeliest thief (with some noise). A thief votes
 *  with the table's suspicion — never a thief it knows, preferring a villager it knows, and hitting back at whoever
 *  called it a thief. */
/** the game as a bot that ignores bare words: every "X is a thief / a villager" someone else said with nothing behind
 *  it (no Kundli read, no exit seen) is dropped. (designer 2026-10-12, today's games: a first accusation with no
 *  evidence — often a thief's lie — and the bots piled on: villagers out 10–1, 8–1, 9–1.) */
export function withoutHearsay(s: GameState, seat: number): GameState {
  const bare = (e: GameState["events"][number]) => e.type === "claim" && e.data?.seat !== seat && e.data?.kind !== "stone"
    && (e.data?.kind === "accuse" || e.data?.kind === "trust" || !backedClaim(s.events, e.data?.seat as number, e.data?.target as number, e.n));
  return { ...s, events: s.events.filter((e) => !bare(e)) };
}

export function beliefVote(s: GameState, seat: number, seed: number, r: R, skill: Skill = DEFAULT_SKILL): number | null {
  const alive = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat);
  if (!alive.length) return null;
  const thief = s.players[seat].side === "T";
  // a Faisla ballot from an experienced villager weighs evidence, not who shouted first (beginners still follow the
  // loudest voice — followAnyAccusation)
  const faisla = s.phase.kind === "vote" && s.phase.reason !== "final";
  if (!thief && faisla && !skill.followAnyAccusation) s = withoutHearsay(s, seat);
  const b = beliefOf(s, seat, seed, skill, thief);
  let pool = alive;
  let score = (x: number) => b.p.get(x) ?? 0;
  if (thief) {
    const mine = beliefOf(s, seat, seed, skill);
    pool = alive.filter((x) => mine.known.get(x) !== "T");
    if (!pool.length) pool = alive;
    // a thief called out in public hits back at whoever called it a thief (playtest 2026-10-07)
    const accusers = new Set(s.events.filter((e) => e.type === "claim" && e.data?.target === seat && e.data?.side === "T").map((e) => e.data!.seat as number));
    score = (x: number) => (b.p.get(x) ?? 0) + (mine.known.get(x) === "V" ? 0.2 : 0) + (accusers.has(x) ? 0.6 : 0);
    if (s.phase.kind === "vote" && s.phase.reason === "final") {
      // (2026-10-12) a villager voted out hands its Stones to the thieves — so hunt the villager most likely holding one
      const st = stoneOdds(s, seat, seed, skill);
      score = (x: number) => (st.get(x) ?? 0) * (1 - (mine.p.get(x) ?? 0.3)) + (accusers.has(x) ? 0.1 : 0);
    }
  } else {
    const sure = alive.filter((x) => b.known.get(x) === "T");
    // a Faisla with nobody standing out: abstain rather than pile onto noise (playtest WJ9J9 — 0.46 against 0.42 and
    // all 8 bots voted the same villager out). The mandatory vote still always names someone.
    const final = s.phase.kind === "vote" && s.phase.reason === "final";
    if (!final && !sure.length && skill.exact) {
      const ranked = [...alive].sort((x, y) => (b.p.get(y) ?? 0) - (b.p.get(x) ?? 0));
      const [t1, t2] = ranked.map((x) => b.p.get(x) ?? 0);
      const mean = ranked.reduce((a, x) => a + (b.p.get(x) ?? 0), 0) / Math.max(1, ranked.length);
      if (t1 - (t2 ?? 0) < 0.05 && t1 < mean * 1.25) return null;
    }
    // the mandatory vote (2026-10-12): the out player's Stones go to the OTHER team — catching a thief holding one wins
    // it, voting out a villager holding one loses it. Worth = P(holds) x (P(thief) - P(villager)); when nobody is worth
    // the risk, vote the player least likely to hold one (a harmless ballot)
    if (s.phase.kind === "vote" && s.phase.reason === "final") {
      const st = stoneOdds(s, seat, seed, skill);
      const worth = (x: number) => (st.get(x) ?? 0) * (2 * (b.p.get(x) ?? 0) - 1);
      const sureHolder = sure.filter((x) => (st.get(x) ?? 0) > 0.05);
      if (sureHolder.length) return sureHolder.sort((x, y) => (st.get(y) ?? 0) - (st.get(x) ?? 0))[0];
      const best = Math.max(...alive.map(worth));
      score = best > 0 ? worth : (x: number) => -(st.get(x) ?? 0) + 0.01 * (b.p.get(x) ?? 0);
    } else if (sure.length) return sure[0];
  }
  const order = [...pool].sort((x, y) => score(y) - score(x));
  // (a high draw means noise: tests drive bots with seeded draws that start near 0)
  const d = r();
  if (skill.name === "casual" && d >= 0.92) return null;
  return d >= 1 - skill.voteNoise ? pick(r, order.slice(0, 3)) : order[0];
}

/** TIE-BREAK (designer 2026-10-12, game 9NAQM: the mandatory vote tied 6–6 and nobody went out): as the clock ends,
 *  a bot whose ballot isn't on one of the tied leaders — or is, but on the wrong one — moves to the leader it wants out:
 *  a villager the likelier thief (in the mandatory vote: the one whose Stones are worth taking), a thief the likelier
 *  villager. Returns the new target, or null to stay. A beginner doesn't count the ballots. */
export function botTieBreak(s: GameState, seat: number, seed: number, skill: Skill = DEFAULT_SKILL): number | null {
  const ph = s.phase;
  if (ph.kind !== "vote" || ph.debate || !ph.voters.includes(seat) || skill.followAnyAccusation) return null;
  const tally = new Map<number, number>();
  for (const [voter, t] of Object.entries(ph.ballots)) if (t !== null && t !== undefined) tally.set(t, (tally.get(t) ?? 0) + (s.players[Number(voter)]?.votes ?? 1));
  const max = Math.max(0, ...tally.values());
  const leaders = [...tally].filter(([, v]) => v === max && max > 0).map(([x]) => x).filter((x) => x !== seat);
  if (leaders.length < 2) return null;
  const thief = s.players[seat].side === "T";
  const b = beliefOf(s, seat, seed, skill);
  const final = ph.reason === "final";
  const st = final ? stoneOdds(s, seat, seed, skill) : null;
  const want = (x: number) => {
    const pT = b.known.get(x) === "T" ? 1 : b.known.get(x) === "V" ? 0 : b.p.get(x) ?? 0.3;
    const stone = st?.get(x) ?? 0;
    return thief ? (b.known.get(x) === "T" ? -9 : (1 - pT) + (final ? stone : 0)) : final ? stone * (2 * pT - 1) + 0.01 * pT : pT;
  };
  const best = [...leaders].sort((x, y) => want(y) - want(x))[0];
  return ph.ballots[seat] === best ? null : best;
}

// ------------------------------------------------------------------ STONES (2026-10-09)
// "Every action at the table must keep updating the bots' knowledge": besides who is a thief, each bot tracks WHERE
// THE STONES ARE — P(holds a Stone) for every living seat — from everything it alone could see: its own hand, what it
// searched (Talashi), what it took or lost (Hera Pheri), the card it passed or got in a Bhukamp, a hand-off, cards
// going to the village, a surrender, and Stone claims (believed as far as it trusts the speaker). Cards move: a turn
// sends 3 cards on (a pair played sends them ALL), so a sighting fades as the holder plays, and the next player to
// pick up the pile inherits the doubt. Recomputed from the events every time a bot decides — never stale.
const STONE = (c: unknown) => c === "STONE_1" || c === "STONE_2";
export function stoneOdds(s: GameState, seat: number, seed: number, skill: Skill = DEFAULT_SKILL): Map<number, number> {
  const v = viewFor(s, seat);
  const n = v.players.length;
  const p = new Map<number, number>();
  for (let x = 0; x < n; x++) p.set(x, Math.min(0.9, 2 / Math.max(2, n)));
  let inPile = 0; // chance the pile on its way carries a Stone
  let village = 0;
  const num = (d: Record<string, unknown> | undefined, k: string) => (typeof d?.[k] === "number" ? (d[k] as number) : null);
  const has = (cards: unknown) => Array.isArray(cards) && cards.some(STONE);
  const trustOf = beliefOf(s, seat, seed, skill);
  const credence = (who: number) => (who === seat ? 1 : trustOf.known.get(who) === "V" ? 0.95 : trustOf.known.get(who) === "T" ? 0.05 : Math.max(0.05, 1 - (trustOf.p.get(who) ?? 0.5)));
  for (const e of v.events) {
    if (Array.isArray(e.to) && !e.to.includes(seat)) continue;
    const d = e.data, actor = num(d, "seat"), target = num(d, "target");
    switch (e.type) {
      case "pickup": if (actor !== null) { p.set(actor, 1 - (1 - p.get(actor)!) * (1 - inPile)); inPile = 0; } break;
      case "pickup_private": if (has(d?.cards)) p.set(seat, 1); break;
      case "pass": if (actor !== null) { const moved = p.get(actor)! * 0.4; p.set(actor, p.get(actor)! - moved); inPile = moved; } break;
      case "play": if (actor !== null) { inPile = p.get(actor)!; p.set(actor, 0.1); } break; // the pair goes down, the rest goes on
      case "conduit": break; // the pile passes through a player who is out — its chance travels on
      case "talashi_private": if (target !== null && actor === seat) p.set(target, has(d?.hand) ? 1 : 0); break;
      case "hera_pheri_private": if (has(d?.taken) && actor !== null) { p.set(actor, 1); } break;
      case "batwara": {
        // (2026-10-12) everyone passes 1 card left and 1 right: with 2 in hand both leave, one each way — a seat's
        // chance comes half from each neighbour
        const was = new Map(p);
        for (let x = 0; x < n; x++) p.set(x, 0.5 * was.get((x - 1 + n) % n)! + 0.5 * was.get((x + 1) % n)!);
        break;
      }
      case "batwara_private": { const from = num(d, "from"), to = num(d, "to"); if (from !== null && to !== null && STONE(d?.card)) { p.set(to, 1); } break; }
      // the table sees only that the cards moved — their chance moves with them; the receiver sees the cards
      case "handoff": if (actor !== null && target !== null) { p.set(target, 1 - (1 - p.get(target)!) * (1 - p.get(actor)!)); p.set(actor, 0); } break;
      case "handoff_private": if (target !== null && has(d?.cards)) p.set(target, 1); break;
      case "to_village": if (actor !== null) { p.set(actor, 0); village += ((d?.cards as unknown[]) ?? []).filter(STONE).length; } break;
      case "to_thieves": if (actor !== null) { p.set(actor, 0); village += ((d?.cards as unknown[]) ?? []).filter(STONE).length; } break;
      case "surrender": if (actor !== null) { p.set(actor, 0); village += ((d?.cards as unknown[]) ?? []).filter(STONE).length; } break;
      case "eliminated": if (actor !== null) p.set(actor, 0); break;
      case "claim":
        if (d?.kind === "stone" && target !== null && actor !== null && actor !== seat) {
          const cr = credence(actor);
          p.set(target, cr * (d?.has ? 1 : 0) + (1 - cr) * p.get(target)!);
        }
        break;
    }
  }
  // the quiet tell: a player who keeps passing is likelier to be sitting on a Stone
  if (skill.readQuiet) for (const [x, q] of quietness(s)) if (x !== seat) p.set(x, Math.min(0.95, Math.max(0, p.get(x)! * (1 + 1.5 * skill.readQuiet * q))));
  // your own hand is the truth
  p.set(seat, v.me.hand.some(STONE) ? 1 : 0);
  // no more Stones than are left out of the village
  const left = Math.max(0, 2 - village);
  const others = [...p.keys()].filter((x) => x !== seat && v.players[x]?.alive);
  const mine = v.me.hand.filter(STONE).length;
  // a seat it KNOWS holds one stays certain; the guesses share what room is left
  const certain = others.filter((x) => p.get(x)! >= 1);
  const guesses = others.filter((x) => p.get(x)! < 1);
  const sum = guesses.reduce((a, x) => a + p.get(x)!, 0);
  const room = Math.max(0, left - mine - certain.length);
  if (sum > room && sum > 0) for (const x of guesses) p.set(x, (p.get(x)! * room) / sum);
  for (const x of p.keys()) if (!v.players[x]?.alive && x !== seat) p.set(x, 0);
  return p;
}

/** DID IT COME BACK? (designer 2026-10-12) A Bhukamp handed `seat`'s Stone to the player before it; that player's pile
 *  comes to `seat` next. Read at `seat`'s pickup (event index `at`): if the pile came straight from that player and the
 *  Stone isn't in it, they KEPT it — returns their seat. Null when there is nothing to conclude. */
export function keptMyStone(s: GameState, seat: number, at: number): number | null {
  const ev = s.events;
  const pick = ev[at];
  if (pick?.type !== "pickup_private" || !Array.isArray(pick.to) || pick.to[0] !== seat) return null;
  if (((pick.data?.cards as Card[]) ?? []).some(STONE)) return null;
  // the last Bhukamp: did it hand this seat's Stone on? (this seat may have had its own turn since — the check comes
  // with the first pile from that neighbour)
  let gave: { to: number; i: number } | null = null;
  for (let i = at - 1; i >= 0; i--) {
    const e = ev[i];
    if (e.type === "batwara_private" && e.data?.from === seat && STONE(e.data?.card)) { gave = { to: e.data!.to as number, i }; break; }
    if (e.type === "batwara") break; // the last Bhukamp handed no Stone of ours
  }
  if (!gave || !s.players[gave.to]?.alive) return null;
  // the pile came from them (their own turn ended just before), and nothing else took the Stone off them meanwhile
  let passer: number | null = null;
  for (let i = at - 1; i > gave.i; i--) {
    const e = ev[i];
    if (passer === null && (e.type === "pass" || e.type === "play")) passer = e.data?.seat as number;
    if ((e.type === "hera_pheri" && e.data?.target === gave.to) || e.type === "batwara" || (e.type === "handoff" && e.data?.seat === gave.to)) return null;
    // only the FIRST pile from them since the Bhukamp tells (later ones are a new story)
    if (i < at - 1 && e.type === "pickup_private" && Array.isArray(e.to) && e.to[0] === seat) {
      const before = ev.slice(gave.i, i).reverse().find((x) => x.type === "pass" || x.type === "play");
      if (before?.data?.seat === gave.to) return null;
    }
  }
  return passer === gave.to ? gave.to : null;
}

// ------------------------------------------------------------------ every word names a role (designer 2026-10-13)
/** "X is a thief" is no longer something anyone can say: an accusation names a THIEF ROLE, a clear names a VILLAGE
 *  ROLE. When a bot means only a side, it names the likeliest role for it — never its own, preferring one nobody has
 *  claimed yet (a role already claimed for someone else is probably not this player's). */
export function roleFor(s: GameState, seat: number, target: number, side: Side, r: () => number = Math.random): string | null {
  const pool = s.rolesInPlay.filter((x) => THIEF_ROLES.includes(x) === (side === "T") && x !== s.players[seat]?.role);
  if (!pool.length) return null;
  const said = new Map<string, number>();
  for (const e of s.events) if (e.type === "claim" && typeof e.data?.role === "string" && e.data.target !== target) said.set(e.data.role, (said.get(e.data.role) ?? 0) + 1);
  const free = pool.filter((x) => !said.has(x));
  const from = free.length ? free : pool;
  return from[Math.floor(r() * from.length)] ?? null;
}

/** is a claim BACKED by something the table saw this speaker do to that player — their Kundli on them (either way:
 *  Kundli is mutual), putting them out (Faisla caller / Teer Kaman hit)? A role named without that is only a word. */
export function backedClaim(events: GameState["events"], actor: number, target: number, before = Infinity): boolean {
  return events.some((e) => e.n < before && (
    (e.type === "kundli" && ((e.data?.seat === actor && e.data?.target === target) || (e.data?.seat === target && e.data?.target === actor)))
    || (e.type === "eliminated" && e.data?.seat === target && e.data?.killer === actor)
    || (e.type === "teer_kaman" && e.data?.seat === actor && e.data?.target === target && e.data?.hit === true)));
}

// ------------------------------------------------------------------ claims
export type ClaimData = { kind: "kundli" | "accuse" | "was"; target: number; role: string | null; side: Side };

/** What a bot says out loud in a debate — one thing it hasn't said before, or nothing. A villager tells the truth
 *  (the side of a player it saw put out, a thief it read, sometimes a villager it read). A thief lies plausibly: it
 *  turns a villager it saw put out into a thief, calls a villager it read a thief, vouches for a thief it read, or
 *  points at whoever the table already suspects. */
export function botClaim(s: GameState, seat: number, seed: number, r: R, skill: Skill = DEFAULT_SKILL): ClaimData | null {
  const me = s.players[seat];
  if (!me.alive || r() > skill.claimRate) return null;
  const v = viewFor(s, seat);
  const said = new Set(v.events.filter((e) => e.type === "claim" && e.data?.seat === seat).map((e) => `${e.data?.kind}:${e.data?.target}`));
  const fresh = (kind: string, t: number) => !said.has(`${kind}:${t}`);
  // a lie never names the liar's own role (Mutual Kundli: the player it read may know it)
  const thiefRoles = v.rolesInPlay.filter((x) => THIEF_ROLES.includes(x) && x !== me.role);
  const villagerRoles = v.rolesInPlay.filter((x) => !THIEF_ROLES.includes(x) && x !== me.role);
  const outs = v.events.filter((e) => e.type === "eliminated_private" && Array.isArray(e.to) && e.to.includes(seat))
    .map((e) => ({ target: e.data!.seat as number, role: e.data!.role as string, side: e.data!.side as Side }));
  const reads = [...readsOf(s, seat)].map(([target, k]) => ({ target, ...k }));
  if (me.side === "V") {
    for (const o of outs) if (fresh("was", o.target)) return { kind: "was", ...o };
    for (const k of reads) if (k.side === "T" && fresh("kundli", k.target)) return { kind: "kundli", ...k };
    for (const k of reads) if (k.side === "V" && fresh("kundli", k.target) && r() < 0.5) return { kind: "kundli", ...k };
    // (playtest LLE3Q 2026-10-09: no bot ever accused anyone) a villager says who it suspects when the suspicion stands
    // out — well above the rest — the way a real player speaks up
    // (2026-10-12) on its OWN evidence only — another player's bare accusation never becomes this bot's accusation
    const bel = beliefOf(withoutHearsay(s, seat), seat, seed, skill);
    const order = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat).sort((x, y) => (bel.p.get(y) ?? 0) - (bel.p.get(x) ?? 0));
    const [a, b] = order.map((x) => bel.p.get(x) ?? 0);
    if (order.length && a >= 0.5 && a - (b ?? 0) >= 0.1 && fresh("accuse", order[0])) return { kind: "accuse", target: order[0], role: null, side: "T" };
    return null;
  }
  for (const o of outs) if (fresh("was", o.target) && r() < skill.lie) {
    return o.side === "V"
      ? { kind: "was", target: o.target, role: pick(r, thiefRoles), side: "T" }
      : { kind: "was", target: o.target, role: pick(r, villagerRoles), side: "V" };
  }
  for (const k of reads) if (fresh("kundli", k.target) && r() < skill.lie) {
    return k.side === "V"
      ? { kind: "kundli", target: k.target, role: pick(r, thiefRoles), side: "T" }
      : { kind: "kundli", target: k.target, role: pick(r, villagerRoles), side: "V" };
  }
  if (r() < 0.3 * skill.lie) {
    // point at the table's favourite suspect — the most believable lie
    const table = beliefOf(s, seat, seed, skill, true);
    const mine = new Map(reads.map((k) => [k.target, k.side]));
    const order = s.players.filter((p) => p.alive && p.seat !== seat && mine.get(p.seat) !== "T")
      .map((p) => p.seat).sort((x, y) => (table.p.get(y) ?? 0) - (table.p.get(x) ?? 0));
    if (order.length && fresh("accuse", order[0])) return { kind: "accuse", target: order[0], role: null, side: "T" };
  }
  return null;
}

/** put a bot's claim on the table — the same "claim" event a player's 🗣 Tell makes. Returns whether it spoke. */
export function pushBotClaim(s: GameState, seat: number, seed: number, r: R, skill: Skill = DEFAULT_SKILL): boolean {
  const c = botClaim(s, seat, seed, r, skill);
  if (!c) return false;
  // one mark per player and side: "X is Lootera" already says "X is a thief" (screen check 2026-10-12)
  if (s.events.some((e) => e.type === "claim" && e.data?.seat === seat && e.data?.target === c.target && e.data?.side === c.side)) return false;
  // (designer 2026-10-13) every word names a role: an accusation a thief role, a clear a village role
  const role = c.role ?? roleFor(s, seat, c.target, c.side, r);
  if (!role) return false;
  const me = s.players[seat].name, them = s.players[c.target].name;
  const was = c.kind === "was" || !s.players[c.target].alive;
  s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${me}: "${them} ${was ? "was" : "is"} ${role}."`,
    data: { seat, ...c, kind: was ? "was" : c.kind === "accuse" ? "kundli" : c.kind, role } });
  return true;
}

/** the bot's top suspect among the living (for a blind Teer Kaman) */
export function topSuspect(s: GameState, seat: number, seed: number, skill: Skill = DEFAULT_SKILL): number | null {
  const b = beliefOf(s, seat, seed, skill, s.players[seat].side === "T");
  const alive = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat);
  return alive.sort((x, y) => (b.p.get(y) ?? 0) - (b.p.get(x) ?? 0))[0] ?? null;
}

/** A bot's move outside the ballot, at its skill: the random pair policy at its activity (keeping Stones), Teer Kaman
 *  only on a Kundli read — or, for a casual bot, sometimes blind at its top suspect — and Dal Badal half the time. */
export function skilledAction(s: GameState, seat: number, seed: number, r: R, skill: Skill = DEFAULT_SKILL): Action {
  const ph = s.phase;
  const me = s.players[seat];
  if (ph.kind === "vote" && ph.debate) return dalBadalMove(s, seat, seed, r, skill, "debate") ?? { type: "ready" };
  if (ph.kind === "vote") return { type: "vote", target: beliefVote(s, seat, seed, r, skill) };
  if (ph.kind === "surrender") return { type: "surrender", give: me.side === "V" };
  if (ph.kind === "elim" && ph.step === "dal_badal") return dalBadalMove(s, seat, seed, r, skill, "votedOut") ?? { type: "dal_badal", seats: [], pass: [] };
  if (ph.kind === "batwara") return bhukampMove(s, seat, seed, r, skill);
  if (ph.kind !== "turn") return randomAction(s, seat, r, skill.activity, true);

  // ---- your turn
  const db = dalBadalMove(s, seat, seed, r, skill, "turn");
  if (db) return db;
  const shot = me.side === "V" ? accusationShot(s, seat, seed, r, skill) : null;
  if (shot) return shot;
  // the random pair policy — with Dal Badal out of reach when the plan is to hold it (banked by a thief, kept from the
  // thieves by a villager)
  const hide = skill.dalBadal !== "random" || (skill.keepDalBadal ?? false);
  let a = withoutDalBadal(s, seat, hide, () => randomAction(s, seat, r, skill.activity, true));
  // the Stone gamble: a thief holding a Stone either plays a pair anyway (luck) or sits on it
  if (me.side === "T" && me.hand.some((c) => c === "STONE_1" || c === "STONE_2")) {
    if (r() < (skill.stoneGamble ?? 0)) {
      if (a.type === "pass") a = withoutDalBadal(s, seat, hide, () => randomAction(s, seat, r, 1, false));
    } else if (a.type === "play" && a.pass.some((c) => c === "STONE_1" || c === "STONE_2")) {
      a = { type: "pass", pass: stonesLastOf(me.hand.filter((c) => !hide || c !== "DAL_BADAL"), passSize(me.hand)) };
      if (a.pass.length < passSize(me.hand)) a = { type: "pass", pass: stonesLastOf(me.hand, passSize(me.hand)) };
    }
  }
  // a careless villager passes at random
  if (me.side === "V" && (a.type === "pass" || a.type === "play") && r() < (skill.careless ?? 0)) {
    const rest = [...me.hand];
    if (a.type === "play") { rest.splice(rest.indexOf(a.card), 1); rest.splice(rest.indexOf(a.card), 1); }
    a = { ...a, pass: sampleOf(r, rest, a.pass.length) };
  }
  // a skilled thief keeps its cards close: no Kundli (Mutual Kundli shows its own role back)
  if (me.side === "T" && skill.thiefRestraint && a.type === "play" && a.card === "KUNDLI") a = { type: "pass", pass: a.pass };
  if (a.type === "play" && a.card !== "TEER_KAMAN") a = withReason(s, seat, seed, r, skill, a);
  if (a.type !== "play" || a.card !== "TEER_KAMAN") return a;
  const foes = [...readsOf(s, seat)].filter(([x, k]) => k.side !== me.side && s.players[x].alive);
  if (foes.length) {
    const [target, k] = pick(r, foes);
    return { ...a, target, roles: [k.role, pick(r, s.rolesInPlay.filter((x) => x !== k.role))].slice(0, tkGuesses(s.rolesInPlay)) };
  }
  if (!(me.side === "T" && skill.thiefRestraint) && r() < skill.blindShot) {
    const target = topSuspect(s, seat, seed, skill);
    const want = s.rolesInPlay.filter((x) => (me.side === "V") === THIEF_ROLES.includes(x));
    if (target !== null && want.length >= 2) {
      const r1 = pick(r, want);
      return { ...a, target, roles: [r1, pick(r, want.filter((x) => x !== r1))].slice(0, tkGuesses(s.rolesInPlay)) };
    }
  }
  return { type: "pass", pass: a.pass };
}

// ------------------------------------------------------------------ THE PLAYBOOK (2026-10-12)
const isStoneCard = (c: Card) => c === "STONE_1" || c === "STONE_2";
const stonesLastOf = (h: Card[], k: number) => [...h.filter((c) => !isStoneCard(c)), ...h.filter(isStoneCard)].slice(0, k);
const sampleOf = <T,>(r: R, xs: T[], k: number) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k); };

/** decide as if Dal Badal were not in hand (it stays there — never passed on) */
function withoutDalBadal(s: GameState, seat: number, hide: boolean, f: () => Action): Action {
  const h = s.players[seat].hand;
  const i = h.indexOf("DAL_BADAL");
  if (!hide || i < 0) return f();
  h.splice(i, 1);
  try {
    const a = f();
    // a pass sized for the smaller hand must still be a legal pass for the real one
    if (a.type === "pass" && a.pass.length !== passSize([...h, "DAL_BADAL"])) return { type: "pass", pass: stonesLastOf([...h, "DAL_BADAL"], passSize([...h, "DAL_BADAL"])) };
    if (a.type === "play") {
      const after = [...h]; after.splice(after.indexOf(a.card), 1); after.splice(after.indexOf(a.card), 1);
      if (a.pass.length !== passSize([...after, "DAL_BADAL"])) return { ...a, pass: [...a.pass, "DAL_BADAL" as Card].slice(0, passSize([...after, "DAL_BADAL"])) };
    }
    return a;
  } finally { h.splice(i, 0, "DAL_BADAL"); }
}

/** who called this player a thief, or read its Kundli as a villager (Mutual Kundli shows the thief who read it) */
function accusersOf(s: GameState, seat: number): number[] {
  const xs = new Set<number>();
  for (const e of s.events) {
    if (e.type === "claim" && e.data?.target === seat && e.data?.side === "T" && typeof e.data?.seat === "number") xs.add(e.data.seat);
    if (e.type === "kundli_private" && e.data?.mutual && e.data?.side === "V" && Array.isArray(e.to) && e.to.includes(seat)) xs.add(e.data.target as number);
  }
  return [...xs].filter((x) => x !== seat && s.players[x]?.alive);
}

/** has this player ever seen a Stone (in hand, passed to it, searched, shown)? */
const sawStone = (s: GameState, seat: number) => s.players[seat].hand.some(isStoneCard)
  || s.events.some((e) => (e.to === "all" || (Array.isArray(e.to) && e.to.includes(seat))) && JSON.stringify(e.data ?? {}).includes("STONE"));

/** DAL BADAL — when, and with whom (the designer's table: once exposed → the accusers; round 3 having never seen a
 *  Stone → the likeliest Stone holders, so the thief card may land on a Stone; voted out → the Stone holders) */
function dalBadalMove(s: GameState, seat: number, seed: number, r: R, skill: Skill, when: "turn" | "debate" | "votedOut"): Action | null {
  const me = s.players[seat];
  if (me.side !== "T" || !me.hand.includes("DAL_BADAL")) return null;
  if (when !== "votedOut" && !canDalBadal(s, seat)) return null;
  const k = dalBadalPick(s, seat);
  const others = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat);
  if (k < 2) return null;
  const plan = skill.dalBadal ?? "random";
  const turnPass = () => { const rest = [...me.hand]; rest.splice(rest.indexOf("DAL_BADAL"), 1); return stonesLastOf(rest, passSize(rest)); };
  const random = () => sampleOf(r, others, k);
  if (plan === "random") {
    // a beginner: the random policy decides on its turn (half the time); in the vote, now and then
    if (when === "turn") return null;
    if (r() < (when === "votedOut" ? 0.5 : 0.15)) return { type: "dal_badal", seats: random(), pass: [] };
    return null;
  }
  const acc = accusersOf(s, seat);
  const st = stoneOdds(s, seat, seed, skill);
  const holders = () => [...others].sort((x, y) => (st.get(y) ?? 0) - (st.get(x) ?? 0)).slice(0, k);
  const fill = (first: number[]) => [...first, ...sampleOf(r, others.filter((x) => !first.includes(x)), k - first.length)].slice(0, k);
  let seats: number[] | null = null;
  if (when === "votedOut") seats = holders();
  else if (acc.length && (when === "turn" || plan === "full")) seats = fill(sampleOf(r, acc, k));
  else if (when === "turn" && plan === "full" && s.round >= s.rounds && !sawStone(s, seat)) seats = holders();
  if (!seats) return null;
  return { type: "dal_badal", seats, pass: when === "turn" ? turnPass() : [] };
}

/** TEER KAMAN the way the designer's table plays it: a villager holding the pair shoots the player whose ROLE an
 *  accusation named ("she is Chor"), naming that role (+ one more thief role at a table of 3+ thieves) */
function accusationShot(s: GameState, seat: number, seed: number, r: R, skill: Skill): Action | null {
  if (!canPlay(s, seat, "TEER_KAMAN") || r() > (skill.accuseShot ?? 0)) return null;
  const me = s.players[seat];
  const reads = readsOf(s, seat);
  const bel = skill.followAnyAccusation ? null : beliefOf(s, seat, seed, skill, false);
  const c = s.events.filter((e) => e.type === "claim" && e.data?.side === "T" && typeof e.data?.role === "string"
    && e.data.seat !== seat && e.data.target !== seat && s.players[e.data.target as number]?.alive
    && reads.get(e.data.target as number)?.side !== "V"
    && (!bel || (bel.p.get(e.data.target as number) ?? 0) >= 0.5)).at(-1);
  if (!c) return null;
  const role = String(c.data!.role);
  const more = s.rolesInPlay.filter((x) => THIEF_ROLES.includes(x) && x !== role);
  const rest = [...me.hand]; rest.splice(rest.indexOf("TEER_KAMAN"), 1); rest.splice(rest.indexOf("TEER_KAMAN"), 1);
  return { type: "play", card: "TEER_KAMAN", target: c.data!.target as number, pass: stonesLastOf(rest, passSize(rest)),
    roles: [role, ...(more.length ? [pick(r, more)] : [])].slice(0, tkGuesses(s.rolesInPlay)) };
}

/** BHUKAMP: 1 card left, 1 right. A skilled player keeps Dal Badal if it can; a Stone it must give goes to the
 *  neighbour it trusts (a villager) or, as a thief, the neighbour it takes for a partner. A beginner deals at random. */
function bhukampMove(s: GameState, seat: number, seed: number, r: R, skill: Skill): Action {
  const me = s.players[seat];
  const h = [...me.hand];
  if (h.length < 2) return { type: "batwara", card: h[0] };
  if (skill.dalBadal === "random") { const [a, b] = sampleOf(r, h, 2); return { type: "batwara", card: a, right: b }; }
  // what to give: non-Stones and not Dal Badal first
  const order = [...h].sort((x, y) => rank(x) - rank(y));
  const [g1, g2] = order.slice(0, 2);
  const left = nb(s, seat, 1), right = nb(s, seat, -1);
  // (2026-10-12, game 9NAQM: Raju gave the Tunga Stone to a thief because an out player had called them a villager)
  // an experienced player trusts evidence, not bare words, with a Stone
  const bel = beliefOf(skill.followAnyAccusation ? s : withoutHearsay(s, seat), seat, seed, skill, me.side === "T");
  const pT = (x: number) => bel.p.get(x) ?? 0.5;
  // the "precious" card of the two (a Stone, else Dal Badal) goes to the friendlier side
  const precious = [g1, g2].find(isStoneCard) ?? [g1, g2].find((c) => c === "DAL_BADAL");
  if (!precious) return { type: "batwara", card: g1, right: g2 };
  const other = precious === g1 ? g2 : g1;
  const friendLeft = me.side === "V" ? pT(left) <= pT(right) : pT(left) >= pT(right);
  return friendLeft ? { type: "batwara", card: precious, right: other } : { type: "batwara", card: other, right: precious };
  function rank(c: Card) { return isStoneCard(c) ? 2 : c === "DAL_BADAL" ? 1 : 0; }
}
const nb = (s: GameState, seat: number, dir: 1 | -1) => {
  const n = s.players.length;
  for (let k = 1; k < n; k++) { const x = (seat + dir * k + n * n) % n; if (s.players[x].alive) return x; }
  return seat;
};

/** PLAYS WITH A REASON (playtest LLE3Q 2026-10-09: a Faisla in round 1 with no suspect; random targets). The pair the
 *  random policy picked keeps its card, but:
 *   · Faisla only when there is someone to vote out (a villager: a suspect who stands out; a thief: a villager the table
 *     already suspects) — or in the last round. Otherwise the bot passes instead.
 *   · Kundli reads the most suspected player not yet read (a thief: the one the table suspects least — a likely partner)
 *   · Talashi searches whoever most likely holds a Stone it isn't sure of
 *   · Hera Pheri: a thief steals from the likeliest Stone holder; a villager from the likeliest thief holding a Stone */
function withReason(s: GameState, seat: number, seed: number, r: R, skill: Skill, a: Extract<Action, { type: "play" }>): Action {
  const me = s.players[seat];
  const thief = me.side === "T";
  const others = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat);
  const bel = beliefOf(s, seat, seed, skill, thief);
  const p = (x: number) => bel.p.get(x) ?? 0;
  const best = (xs: number[], f: (x: number) => number) => [...xs].sort((x, y) => f(y) - f(x))[0];
  const lastRound = s.round >= s.rounds;
  switch (a.card) {
    case "FAISLA": {
      const top = best(others, p);
      const ok = lastRound || (!thief && r() > (skill.faislaDiscipline ?? 1))
        || (top !== undefined && (thief ? me.side !== s.players[top]?.side && p(top) >= 0.45 : p(top) >= 0.5));
      return ok ? a : randomAction(s, seat, r, 0, true);
    }
    case "KUNDLI": {
      const read = readsOf(s, seat);
      const fresh = others.filter((x) => !read.has(x));
      const pool = fresh.length ? fresh : others;
      return { ...a, target: thief ? best(pool, (x) => -p(x)) : best(pool, p) };
    }
    case "TALASHI": {
      const st = stoneOdds(s, seat, seed, skill);
      const unsure = others.filter((x) => (st.get(x) ?? 0) > 0.02 && (st.get(x) ?? 0) < 0.98);
      return { ...a, target: best(unsure.length ? unsure : others, (x) => st.get(x) ?? 0) };
    }
    case "HERA_PHERI": {
      const st = stoneOdds(s, seat, seed, skill);
      const withCards = others.filter((x) => s.players[x].hand.length > 0);
      if (!withCards.length) return a;
      return { ...a, target: thief ? best(withCards, (x) => st.get(x) ?? 0) : best(withCards, (x) => p(x) * (0.3 + (st.get(x) ?? 0))) };
    }
    default: return a;
  }
}
