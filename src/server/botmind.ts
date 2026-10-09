// Bot minds — "intelligent" without AI. Each bot reads ONLY its own seat's view (viewFor): its role, its own
// cards (Stones above all), its private Kundli reads, and what the table did in public. From that it keeps a
// suspicion score per player with a reason it can say out loud, votes on it, and speaks when something happens.
// Villager bots tell the truth about what they know. Thief bots don't know their partners (nobody does): they
// claim to be villagers, hide Stones, protect a partner they found, and frame villagers.
// Stones decide the end: villagers need BOTH with villagers, thieves need just one — so a villager with a Stone
// wants to be trusted, and a thief with a Stone wants nobody to know.
//
// SITUATIONS (each has villager and thief lines below)
//  S1  the deal: a first word, coloured by role and whether the bot holds a Stone
//  S2  bot passes (no pair worth playing)              S3  bot picks up the pile and finds a Stone
//  S4  bot plays a pair: Faisla · Talashi · Hera Pheri · Bhukamp · Teer Kaman (Kundli → S7)
//  S5  Hera Pheri on the bot (and whether a Stone was taken)
//  S6  Talashi on the bot (Stone found / clean)        S7  Kundli: the bot reads (thief/villager × own side) /
//                                                          is read / watches someone else get read
//  S8  Teer Kaman at the bot (miss = the shooter is out) S9  Dal Badal: the thief shows its role
//  S10 Bhukamp by someone else
//  S12 the debate (Faisla or the final vote): priority — confirmed thief from own Kundli → thief under suspicion
//      deflects → Stone claim/denial → accusation with a reason → threat from a pair in hand → vouching → hunch
//  S13 the final mandatory vote: the Stone question     S14 nobody voted out
//  S15 an elimination: last words (by side, with/without a Stone) and the table's reaction (who voted a villager out)
//  S16 dying power (a vote, both sides) and handoff aimed at the bot
// (2026-10-09) roles are hidden: an exit never says who was what — a bot going out claims the village either way
//  S18 game over: winners and losers
import type { ActionCard, Card, GameEvent, GameState, Side } from "@/engine/types";
import { viewFor, type PlayerView } from "@/engine/view";
import { beliefVote } from "./belief";

type R = () => number;
export interface BotLine { seat: number; text: string }
interface Read { score: number; why: string | null }

const pick = <T,>(r: R, xs: T[]): T => xs[Math.floor(r() * xs.length)];
const num = (d: Record<string, unknown> | undefined, k: string) => (typeof d?.[k] === "number" ? (d[k] as number) : null);
const isStone = (c: unknown) => c === "STONE_1" || c === "STONE_2";
const stonesIn = (cards: unknown) => (Array.isArray(cards) ? cards.filter(isStone).length : 0);
/** a small fixed lean per bot and target, so each bot has its own hunches instead of all agreeing */
const hunch = (seed: number, a: number, b: number) => (((seed ^ (a * 7919) ^ (b * 104729)) >>> 0) % 1000) / 1000;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// ------------------------------------------------------------------ what a bot knows
interface Mind {
  v: PlayerView;
  seat: number;
  thief: boolean;
  stones: number;
  /** action cards it holds a pair of — threats it can make (a thief may also bluff one) */
  pairs: ActionCard[];
  reads: Map<number, Read>;
  /** sides it KNOWS for certain right now, and how: its own Kundli, or a Dal Badal it was part of.
   *  A Dal Badal moves what anyone knew about the two swapped seats along with their roles. */
  known: Map<number, { side: Side; how: "kundli" | "swap" }>;
  /** known thieves / villagers among the living */
  sawThief: number[];
  sawVillager: number[];
  /** someone has voted for it before — it is under suspicion */
  suspected: boolean;
  /** the seat it last swapped roles with: that player now knows its role, as it knows theirs */
  swapPartner: number | null;
  name: (s: number | null) => string;
}

export function mindOf(s: GameState, seat: number, seed: number): Mind {
  const v = viewFor(s, seat);
  const thief = v.me.side === "T";
  const name = (x: number | null) => (x === null ? "?" : v.players[x]?.name ?? "?");
  const reads = new Map<number, Read>();
  for (const p of v.players) if (p.seat !== seat) reads.set(p.seat, { score: hunch(seed, seat, p.seat) * 1.5, why: null });
  const add = (x: number | null, pts: number, why: string | null) => {
    const r = x === null || x === seat ? undefined : reads.get(x);
    if (!r) return;
    r.score += pts;
    if (why && pts > 0 && (!r.why || pts >= 2)) r.why = why;
  };
  const known = new Map<number, { side: Side; how: "kundli" | "swap" }>();
  let mySide: Side | null = null;
  // no partner since the 3-way shuffle (2026-10-07): a shuffle tells you only your own new role
  const swapPartner: number | null = null;
  let suspected = false;
  let ballots: Record<string, number | null> = {};
  for (const e of v.events) {
    // once the game is over every secret is public — a bot still only knows what was addressed to it
    if (Array.isArray(e.to) && !e.to.includes(seat)) continue;
    const d = e.data, actor = num(d, "seat"), target = num(d, "target");
    switch (e.type) {
      case "role": mySide = d?.side as Side; break;
      case "kundli_private": known.set(target!, { side: d?.side as Side, how: "kundli" }); break;
      case "dal_badal": {
        // (2026-10-07) up to 3 roles shuffled and picked back blind: nothing anyone knew about those seats holds now,
        // and being in the shuffle tells you only your own new role
        for (const x of (d?.seats as number[]) ?? []) known.delete(x);
        // (2026-10-09) the thief showed their role first: one of the three now holds it
        for (const x of (d?.seats as number[]) ?? []) add(x, thief ? 0 : 1.5, "was in the Dal Badal");
        void swapPartner; void mySide;
        break;
      }
      case "hera_pheri": if (target === seat) add(actor, 2, "took my cards"); break;
      case "teer_kaman": if (target === seat) add(actor, 3, "shot an arrow at me"); break;
      case "last_shot": if (target === seat) add(actor, 2, "aimed the last shot at me"); break;
      case "talashi": if (target === seat) add(actor, 1, "searched me"); break;
      // (2026-10-09) a private search: only the searcher sees the hand
      case "talashi_private":
        if (stonesIn(d?.hand) && target !== seat) add(target, thief ? 0.5 : 1.5, "I saw a Stone in their hand");
        break;
      // a claim out loud: a villager weighs it by who said it; a thief only cares when it is aimed at itself
      case "claim": {
        if (actor === null || target === null || actor === seat || d?.kind === "stone") break;
        const saysThief = d?.side === "T";
        const k = known.get(actor);
        if (target === seat) { if (saysThief) add(actor, 4, thief ? "accused me" : "falsely called me a thief"); break; }
        if (thief) break;
        const sure = known.get(target);
        if (sure && sure.side === "V" && saysThief) { add(actor, 3, `called ${name(target)} a thief, but they're a villager`); break; }
        if (k?.side === "T") break; // a thief I know is talking: ignore it
        const strong = k?.side === "V" ? 3 : 1; // a villager I know is believed outright
        const pts = (d?.kind === "kundli" ? 4 : 2) * strong;
        add(target, saysThief ? pts : -pts / 2, saysThief ? `${name(actor)} called them a thief${d?.kind === "kundli" ? " after a Kundli" : ""}` : null);
        break;
      }
      case "whisper_private": {
        if (actor === null || target === null || actor === seat || num(d, "to") !== seat || thief) break;
        const k = known.get(actor);
        if (k?.side === "T") break;
        if (target === seat) { if (d?.side === "T") add(actor, 4, "falsely called me a thief"); break; }
        add(target, d?.side === "T" ? 5 : -2.5, d?.side === "T" ? `${name(actor)} whispered to me — a thief` : null);
        break;
      }
      case "vote_result":
        ballots = (d?.ballots as Record<string, number | null>) ?? {};
        for (const [voter, t] of Object.entries(ballots)) if (t === seat) { suspected = true; add(Number(voter), 2, "voted for me"); }
        break;
      // (2026-10-09) the Faisla caller alone learns the role: they read it like a public reveal
      case "eliminated_private":
      case "eliminated": {
        // (2026-10-09) the public line never shows the role — there is nothing to learn from it
        if (d?.side === undefined) { ballots = {}; break; }
        const villager = d?.side === "V";
        for (const [voter, t] of Object.entries(ballots)) if (t === actor) add(Number(voter), villager ? 3 : -2, villager ? `voted out ${name(actor)}, who was a villager` : null);
        const killer = num(d, "killer");
        if (villager && killer !== null) add(killer, 4, `took out ${name(actor)}, a villager`);
        ballots = {};
        break;
      }
    }
  }
  known.delete(seat);
  // certainty outweighs every hunch: a villager hunts a thief it knows and trusts a villager it knows;
  // a thief protects a partner it knows and is happy to frame a villager it knows
  for (const [x, k] of known) {
    const how = k.how === "swap" ? "the Dal Badal showed me" : "I saw it in the Kundli";
    if (k.side === "T") add(x, thief ? -100 : 100, thief ? null : `${how} — a thief`);
    else add(x, thief ? 4 : -100, thief ? "seems very clever" : null);
  }
  for (const p of v.players) if (!p.alive) { reads.delete(p.seat); known.delete(p.seat); }
  const count = new Map<Card, number>();
  for (const c of v.me.hand) count.set(c, (count.get(c) ?? 0) + 1);
  const pairs = [...count.entries()].filter(([c, k]) => k >= 2 && !isStone(c) && c !== "DAL_BADAL").map(([c]) => c as ActionCard);
  const sawThief = [...known].filter(([, k]) => k.side === "T").map(([x]) => x);
  const sawVillager = [...known].filter(([, k]) => k.side === "V").map(([x]) => x);
  return { v, seat, thief, stones: stonesIn(v.me.hand), pairs, reads, known, sawThief, sawVillager, suspected, swapPartner, name };
}

const ranked = (m: Mind) => [...m.reads.entries()].sort((a, b) => b[1].score - a[1].score);
const top = (m: Mind) => ranked(m)[0] ?? null;
const aliveSeat = (m: Mind, x: number) => Boolean(m.v.players[x]?.alive);

/** A bot's ballot (2026-10-09): from its beliefs — see belief.ts. */
export function botVote(s: GameState, seat: number, seed: number, r: R): number | null {
  return beliefVote(s, seat, seed, r);
}

// ------------------------------------------------------------------ S12/S13 the debate
const THREAT: Partial<Record<ActionCard, (t: string) => string>> = {
  KUNDLI: (t) => `I have a Kundli — next turn I'm reading ${t}.`,
  TEER_KAMAN: (t) => `I'm holding Teer Kaman. ${t}, careful.`,
  TALASHI: (t) => `I have a Talashi — ${t}, empty your pockets.`,
  FAISLA: () => "I'm calling the next Faisla. Be ready.",
  HERA_PHERI: (t) => `${t}, I've got my eye on your cards.`,
};

export function debateLine(m: Mind, final: boolean, r: R): string {
  const t = top(m);
  const tn = t ? m.name(t[0]) : "someone";
  // a villager who SAW a thief says so, every time
  const seen = m.thief ? [] : m.sawThief.filter((x) => aliveSeat(m, x));
  if (seen.length) {
    const t0 = m.name(seen[0]);
    return m.known.get(seen[0])?.how === "swap"
      ? pick(r, [`After the Dal Badal I know for sure — ${t0} is a THIEF. Everyone vote ${t0}!`, `I know the truth about ${t0} — a thief, I guarantee it.`])
      : pick(r, [`I read ${t0}'s Kundli — a THIEF. Everyone vote ${t0}!`, `${t0} is a thief, the Kundli was clear. End of debate.`]);
  }
  // a thief whose swap partner is a villager: that partner KNOWS — discredit them before they speak
  const partner = m.swapPartner !== null && aliveSeat(m, m.swapPartner) ? m.swapPartner : null;
  if (m.thief && partner !== null && m.known.get(partner)?.side === "V")
    return pick(r, [`Don't trust ${m.name(partner)} — after the Dal Badal they'll falsely accuse me.`, `Watch, ${m.name(partner)} will call me a thief now. They're the real thief!`]);
  // a thief under suspicion turns it around
  if (m.thief && m.suspected && t) return pick(r, [`Me? I'm a villager! The real thief is ${tn} — ${t[1].why ?? "look how quiet they are"}.`, `You're chasing the wrong person. Look at ${tn} — ${t[1].why ?? "they're the clever one"}.`]);
  if (final) {
    if (!m.thief && m.stones) return `I have a Stone, and I'm a villager. Who has the other Stone? Speak up!`;
    if (m.thief && m.stones) return pick(r, [`I don't have a Stone. I suspect ${tn}.`, "The villagers must have the Stones… I certainly don't."]);
    if (!m.thief) return `Last vote. Both Stones must end with the village — ${tn}, what are you holding?`;
  }
  // Stones: a villager wants protection, a thief wants nobody to know
  if (m.stones && r() < 0.6) return m.thief
    ? pick(r, ["A Stone? Not me, I swear.", `I don't have a Stone. ${tn} might.`])
    : pick(r, ["I have a Stone and I'm a villager — don't vote me out, that's how the village wins.", "One Stone is safe with me. Trust me."]);
  if (t && t[1].score >= 2 && t[1].why) return pick(r, [`I suspect ${tn} — ${t[1].why}.`, `My vote goes to ${tn}. ${cap(t[1].why)}.`, `${tn}, explain this: ${t[1].why}.`]);
  const threat = m.pairs.find((c) => THREAT[c]) ?? (m.thief && r() < 0.25 ? "TEER_KAMAN" : undefined);
  if (threat && r() < 0.6) return THREAT[threat]!(tn);
  const vouch = m.thief ? m.sawThief : m.sawVillager;
  const clean = vouch.filter((x) => aliveSeat(m, x));
  if (clean.length) return m.known.get(clean[0])?.how === "swap" ? `${m.name(clean[0])} is clean — the Dal Badal showed me.` : `${m.name(clean[0])} is clean, I read their Kundli.`;
  if (t && r() < 0.4) return `I'm a little suspicious of ${tn}… not sure.`;
  return pick(r, r() < 0.5
    ? ["I'm a villager, I swear.", "Don't suspect me, I'm straight.", "I'm just playing my cards, friends."]
    : ["Nothing certain yet… why is everyone so quiet?", "Something is off here.", "The quietest one is the thief.", "Think before you vote."]);
}

// ------------------------------------------------------------------ everything else
/** What the bots say about the events from index `from` on. At most 3 lines a batch, one per bot. */
export function botTalk(s: GameState, from: number, bots: number[], seed: number, r: R): BotLine[] {
  const out: BotLine[] = [];
  const spoke = new Set<number>();
  const living = (x: number | null) => x !== null && Boolean(s.players[x]?.alive);
  const isBot = (x: number | null): x is number => x !== null && bots.includes(x);
  const say = (x: number | null, text: string | null) => {
    if (!isBot(x) || !text || out.length >= 3 || spoke.has(x)) return;
    spoke.add(x);
    out.push({ seat: x, text });
  };
  const nm = (x: number | null) => (x === null ? "someone" : s.players[x]?.name ?? "?");
  const mind = (x: number) => mindOf(s, x, seed);
  const side = (x: number) => s.players[x].side;
  const someBot = (not: (number | null)[] = []) => bots.filter((b) => living(b) && !not.includes(b)).sort(() => r() - 0.5)[0] ?? null;

  const events = s.events.slice(from) as GameEvent[];
  for (const [i, e] of events.entries()) {
    const d = e.data, actor = num(d, "seat"), target = num(d, "target");
    switch (e.type) {
      // S1 the deal
      case "setup": {
        const b = someBot();
        if (b === null) break;
        const m = mind(b);
        say(b, m.stones
          ? (m.thief ? pick(r, ["Nothing special in my hand.", "I got useless cards."]) : pick(r, ["My hand is good 😉", "The village wins this time, watch."]))
          : pick(r, ["Let's begin. Thieves, watch out!", "Everyone keep an eye on each other.", "I'm watching all of you…"]));
        break;
      }
      // S2 bot passes
      case "pass":
        if (r() < 0.25) say(actor, pick(r, ["Nothing much, pass it on.", "Better to stay quiet for now.", "My time will come."]));
        break;
      // S3 picking up the pile — a Stone arrives
      case "pickup_private": {
        const me = Array.isArray(e.to) ? e.to[0] : null;
        if (!isBot(me) || !stonesIn(d?.cards) || r() > 0.5) break;
        say(me, side(me) === "V" ? pick(r, ["Something good came my way.", "Now I have something valuable."]) : pick(r, ["Useless pile.", "Nothing worth keeping."]));
        break;
      }
      // S4 the bot's own pairs
      case "faisla": {
        // the caller speaks first, then up to two more — S12
        const talkers = [actor, ...bots.filter((b) => b !== actor && living(b)).sort(() => r() - 0.5)].filter((b): b is number => isBot(b) && living(b)).slice(0, 3);
        for (const b of talkers) say(b, b === actor ? `I called the Faisla. ${debateLine(mind(b), false, r)}` : debateLine(mind(b), false, r));
        break;
      }
      // someone made a claim: the one it is aimed at answers; a villager bot may back a thief claim
      case "claim": {
        const saysThief = d?.side === "T";
        if (isBot(target) && living(target) && saysThief) {
          say(target, side(target) === "V"
            ? pick(r, ["Lies! I'm a villager.", `Wrong, ${nm(actor)}. I'm not a thief.`])
            : pick(r, [`${nm(actor)} is lying — watch them!`, "I'm being framed."]));
        } else if (saysThief && r() < 0.6) {
          const b = someBot([actor, target]);
          if (b !== null && side(b) === "V") say(b, d?.kind === "kundli" ? `That's a Kundli read — ${nm(target)}, what do you say now?` : `Hmm, I suspect ${nm(target)} too.`);
        }
        break;
      }
      // someone whispered to a bot: it reacts out loud — without giving away what was said
      case "whisper":
        if (isBot(target) && living(target) && r() < 0.6) say(target, pick(r, [`${nm(actor)} whispered something to me… 🤔`, "Psst? Okay, got it.", `Hmm, ${nm(actor)}, we'll see.`]));
        break;
      case "final_vote":
        for (const b of bots.filter(living).sort(() => r() - 0.5).slice(0, 3)) say(b, debateLine(mind(b), true, r));
        break;
      // (2026-10-09) Talashi is private: a bot that searched says what it found as a Stone CLAIM (server/game.ts
      // botsSayWhatTheyFound) — on the table, on the seat, read aloud — not as a chat line here
      case "talashi": {
        // S6 searched
        if (!isBot(target)) break;
        const found = stonesIn(s.players[target].hand) > 0;
        say(target, found
          ? (side(target) === "V" ? "Yes, I have a Stone — keeping it safe for the village." : "Seen enough? Now keep quiet.")
          : "Go on, look. You won't find anything.");
        break;
      }
      case "hera_pheri": {
        // S5 — the private line right after says what was taken
        const nxt = events[i + 1];
        const tookStone = nxt?.type === "hera_pheri_private" && stonesIn(nxt.data?.taken) > 0;
        if (isBot(target)) say(target, tookStone
          ? (side(target) === "V" ? `${nm(actor)} took my Stone! A thief, for sure.` : pick(r, [`Hey ${nm(actor)}! Give my cards back!`, `I'll remember that Hera Pheri, ${nm(actor)}.`]))
          : pick(r, [`Hey ${nm(actor)}! Give my cards back!`, `I'll remember that Hera Pheri, ${nm(actor)}.`, `${nm(actor)} grabs cards like a thief…`]));
        if (isBot(actor) && r() < 0.5) say(actor, pick(r, [`Thanks for the cards, ${nm(target)} 😏`, "Nice cards, thank you."]));
        break;
      }
      case "batwara":
        if (isBot(actor)) say(actor, pick(r, ["Bhukamp! Shake those cards!", "Let's shake everyone up a little."]));
        else say(someBot([actor]), pick(r, ["Oh no, my good cards are gone!", "Bhukamp… now who knows who holds what."])); // S10
        break;
      case "teer_kaman":
        // a miss puts the shooter out (2026-10-09); a hit tells only the shooter the role
        if (isBot(actor)) say(actor, d?.hit ? `Hit! I was right about ${nm(target)}.` : "Missed… I'm out.");
        if (isBot(target) && !d?.hit) say(target, pick(r, [`You missed, ${nm(actor)}!`, `An arrow at me? ${nm(actor)}, you're the thief.`])); // S8
        break;
      // S7 Kundli
      case "kundli":
        if (isBot(target) && r() < 0.7) say(target, side(target) === "V"
          ? `Seen it, ${nm(actor)}? Now tell everyone I'm clean.`
          : `${nm(actor)} read my Kundli… whatever they say now will be a lie.`);
        else if (!isBot(actor) && r() < 0.4) say(someBot([target]), `${nm(actor)}, what did ${nm(target)}'s Kundli show? Tell the truth.`);
        break;
      case "kundli_private": {
        const reader = Array.isArray(e.to) ? e.to[0] : null;
        if (!isBot(reader) || r() > 0.8) break;
        const thiefSeen = d?.side === "T";
        if (side(reader) === "V") say(reader, thiefSeen ? `I read ${nm(target)}'s Kundli — a THIEF!` : `${nm(target)}'s Kundli is clean. A villager.`);
        else say(reader, thiefSeen ? `${nm(target)} is clean, I read the Kundli.` : r() < 0.6 ? `I read ${nm(target)}'s Kundli — a thief, for sure!` : null);
        break;
      }
      // S14
      case "vote_result":
        if (d?.out === null && r() < 0.5) say(someBot(), "Nobody went out… the thieves must be laughing.");
        break;
      // S15
      case "eliminated": {
        const withStone = stonesIn(d?.hand) > 0;
        if (d?.side === undefined) {
          // a hidden exit: last words claim the village whatever the truth; the table only wonders
          say(actor, side(actor ?? 0) === "V" || r() < 0.8
            ? pick(r, ["I was a villager! You got the wrong one.", "Remember — I was telling the truth.", withStone ? "Look after my Stone, villagers." : "The real thief is still among you."])
            : "Now you'll never know who I was…");
          say(someBot([actor]), pick(r, [`${nm(actor)} is gone… thief or not, who knows.`, "One fewer. Right or wrong?"]));
          break;
        }
        const villager = d?.side === "V";
        say(actor, villager
          ? pick(r, ["I was a villager! You got the wrong one.", "Remember — I was telling the truth.", withStone ? "Look after my Stone, villagers." : "The real thief is still among you."])
          : pick(r, ["Yes, I was a thief… but I'm not alone.", withStone ? "Take the Stone… but the other thieves are still here." : "You caught me… but the rest are still among you."]));
        if (villager) {
          const ballots = [...s.events.slice(0, e.n)].reverse().find((x) => x.type === "vote_result")?.data?.ballots as Record<string, number | null> | undefined;
          const voter = ballots ? Number(Object.entries(ballots).find(([, t]) => t === actor)?.[0] ?? NaN) : NaN;
          if (!Number.isNaN(voter) && living(voter)) say(someBot([actor, voter]), `${nm(actor)} was a villager! ${nm(voter)} voted them out — remember that.`);
        } else say(someBot([actor]), pick(r, ["One thief down! We'll catch the rest.", "Well done, village! Next thief."]));
        break;
      }
      // S16 dying powers aimed at a bot
      case "gift": if (target !== null) say(target, `Thank you, ${nm(actor)}! I'll use this vote well.`); break;
      case "dal_badal": {
        // S9 the thief showed its role; then in the shuffle everyone claims the village, whatever card they drew
        if (isBot(actor)) say(actor, pick(r, ["Yes, I was a thief… now find me!", "Guess now… who's the thief?"]));
        for (const me of (d?.seats as number[]) ?? []) {
          if (!isBot(me) || me === actor) continue;
          say(me, pick(r, ["New role… I'm still with the village.", "Nothing changed, all good.", "Dal Badal doesn't scare me. I'm a villager."]));
        }
        break;
      }
      case "handoff": if (target !== null) say(target, stonesIn(d?.cards) && side(target) === "V" ? `Got a Stone! Thanks ${nm(actor)}, I'll keep it safe.` : `So many cards! Thank you, ${nm(actor)}.`); break;
      // S18
      case "over": {
        const winners = bots.filter((b) => side(b) === d?.winner);
        const losers = bots.filter((b) => side(b) !== d?.winner);
        if (winners.length) say(winners[0], d?.winner === "V" ? "The village wins! Thieves caught." : "We thieves win! Watch out next time.");
        if (losers.length) say(losers[0], d?.winner === "V" ? "Next time I won't get caught…" : "The thieves won… we voted out the wrong people.");
        break;
      }
    }
  }
  return out;
}
