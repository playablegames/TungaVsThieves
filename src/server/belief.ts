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
import type { GameState, Side } from "@/engine/types";
import { viewFor } from "@/engine/view";
import { THIEF_ROLES } from "@/engine/setup";
import { randomAction, readsOf } from "@/engine/decisions";
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
}

export const SKILLS: Record<Skill["name"], Skill> = {
  casual: { name: "casual", activity: 0.6, sharp: 0.5, noise: 1.2, voteNoise: 0.35, lie: 0.4, claimRate: 0.5, blindShot: 0.3 },
  average: { name: "average", activity: 0.8, sharp: 1, noise: 0.7, voteNoise: 0.15, lie: 0.6, claimRate: 0.8, blindShot: 0 },
  sharp: { name: "sharp", activity: 0.85, sharp: 1.6, noise: 0.3, voteNoise: 0.05, lie: 0.8, claimRate: 1, blindShot: 0 },
};
export const DEFAULT_SKILL = SKILLS.average;

/** a small fixed lean per bot and target, so bots don't all agree */
const hunch = (seed: number, a: number, b: number) => (((seed ^ (a * 7919) ^ (b * 104729)) >>> 0) % 1000) / 1000;
const sig = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));
const pick = <T,>(r: R, xs: T[]): T => xs[Math.floor(r() * xs.length)];

export interface Claim { actor: number; target: number; side: Side; kind: string }
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
      case "claim": if (actor !== null && target !== null && actor !== seat) claims.push({ actor, target, side: d?.side as Side, kind: String(d?.kind) }); break;
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
    const shift = (logit(post) - logit(prior)) * (c.kind === "accuse" ? 0.5 : 1);
    if (L.has(c.target)) L.set(c.target, L.get(c.target)! + shift * Math.min(1, skill.sharp));
    if (c.kind === "was") {
      // a word about a player already out also judges the voters who put them out
      for (const [voter, t] of Object.entries(outBallots.get(c.target) ?? {})) if (t === c.target) bump(Number(voter), (c.side === "V" ? 0.6 : -0.4) * w);
    }
  }
  return { p: probs(), known, trust };
}

/** A ballot from beliefs. A villager votes a thief it knows, else its likeliest thief (with some noise). A thief votes
 *  with the table's suspicion — never a thief it knows, preferring a villager it knows, and hitting back at whoever
 *  called it a thief. */
export function beliefVote(s: GameState, seat: number, seed: number, r: R, skill: Skill = DEFAULT_SKILL): number | null {
  const alive = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat);
  if (!alive.length) return null;
  const thief = s.players[seat].side === "T";
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
  } else {
    const sure = alive.filter((x) => b.known.get(x) === "T");
    if (sure.length) return sure[0];
  }
  const order = [...pool].sort((x, y) => score(y) - score(x));
  // (a high draw means noise: tests drive bots with seeded draws that start near 0)
  const d = r();
  if (skill.name === "casual" && d >= 0.92) return null;
  return d >= 1 - skill.voteNoise ? pick(r, order.slice(0, 3)) : order[0];
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
  const thiefRoles = v.rolesInPlay.filter((x) => THIEF_ROLES.includes(x));
  const villagerRoles = v.rolesInPlay.filter((x) => !THIEF_ROLES.includes(x));
  const outs = v.events.filter((e) => e.type === "eliminated_private" && Array.isArray(e.to) && e.to.includes(seat))
    .map((e) => ({ target: e.data!.seat as number, role: e.data!.role as string, side: e.data!.side as Side }));
  const reads = [...readsOf(s, seat)].map(([target, k]) => ({ target, ...k }));
  if (me.side === "V") {
    for (const o of outs) if (fresh("was", o.target)) return { kind: "was", ...o };
    for (const k of reads) if (k.side === "T" && fresh("kundli", k.target)) return { kind: "kundli", ...k };
    for (const k of reads) if (k.side === "V" && fresh("kundli", k.target) && r() < 0.5) return { kind: "kundli", ...k };
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
  const me = s.players[seat].name, them = s.players[c.target].name;
  const what = c.side === "T" ? "a thief" : "a villager";
  const msg = c.kind === "was" ? `${me}: "${them} was ${c.role} — ${what}."`
    : c.kind === "kundli" ? `${me}: "I read ${them}'s Kundli — ${c.role}, ${what}."` : `${me}: "${them} is a thief."`;
  s.events.push({ n: s.events.length, type: "claim", to: "all", msg, data: { seat, ...c } });
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
  if (ph.kind === "vote" && ph.debate) return { type: "ready" };
  if (ph.kind === "vote") return { type: "vote", target: beliefVote(s, seat, seed, r, skill) };
  if (ph.kind === "surrender") return { type: "surrender", give: s.players[seat].side === "V" };
  const a = randomAction(s, seat, r, skill.activity, true);
  if (a.type !== "play" || a.card !== "TEER_KAMAN") return a;
  const me = s.players[seat];
  const foes = [...readsOf(s, seat)].filter(([x, k]) => k.side !== me.side && s.players[x].alive);
  if (foes.length) {
    const [target, k] = pick(r, foes);
    return { ...a, target, roles: [k.role, pick(r, s.rolesInPlay.filter((x) => x !== k.role))] };
  }
  if (r() < skill.blindShot) {
    const target = topSuspect(s, seat, seed, skill);
    const want = s.rolesInPlay.filter((x) => (me.side === "V") === THIEF_ROLES.includes(x));
    if (target !== null && want.length >= 2) {
      const r1 = pick(r, want);
      return { ...a, target, roles: [r1, pick(r, want.filter((x) => x !== r1))] };
    }
  }
  return { type: "pass", pass: a.pass };
}
