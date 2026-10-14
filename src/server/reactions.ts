// BOT REACTIONS — what a bot does the MOMENT it learns something (a Kundli read, a search, a player it put out, a Stone
// that didn't come back): marks for the table, whispers to a close friend, a villager's bluff. Shared by the online
// game (game.ts) and every simulation, so the bots measured are the bots people play against (2026-10-13).
import type { GameState } from "@/engine/types";
import { readsOf } from "@/engine/decisions";
import { keptMyStone, roleFor, RULES, thiefWord, type Skill } from "./belief";
import { ledger, partnersOf, stoneMemory, wordAboutRole, wordAboutSearch } from "./reason";
import { THIEF_ROLES } from "@/engine/setup";
import { viewFor } from "@/engine/view";
import type { LineClaim } from "./botmind";

type R = () => number;

const STONE_NAME: Record<string, string> = { STONE_1: "the Bhadra Stone", STONE_2: "the Tunga Stone" };
/** "X has the Tunga Stone" / "X has no Stone", on the table for everyone (designer 2026-10-14: say WHICH Stone) */
export function pushStoneClaim(s: GameState, seat: number, target: number, has: boolean, stone?: string | null) {
  const me = s.players[seat].name, them = s.players[target].name;
  const which = has && stone && STONE_NAME[stone] ? stone : null;
  s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${me}: "${them} ${has ? `has ${which ? STONE_NAME[which] : "a Stone"}` : "has no Stone"}."`,
    data: { seat, kind: "stone", target, has, role: null, side: null, ...(which ? { stone: which } : {}) } });
}

/** EVERY DISCOVERY BECOMES A MARK (designer 2026-10-12: "every info must trigger something — a Kundli revealing a
 *  villager must mark the villager as a villager, so the info is available to all via the marking"). The moment a bot
 *  learns something private, it puts a mark under that player for the whole table — 🌾/🫵 with the role 🔮 for a role
 *  it saw (its own Kundli read, the reader who read it back, a player it put out), 💎✓/✗ for a hand it searched.
 *  By skill: a villager marks the truth (beginner sometimes forgets, skilled always); a thief may mark a lie instead
 *  (more often the more skilled), or say nothing. */
/** CLOSE FRIENDS (designer 2026-10-13: "private chats, alliances, close friends"). A bot that saw a role whispers it to
 *  ONE friend — a living player it knows is a villager (a Kundli read either way), a person first — once a round. A
 *  villager whispers the truth; a thief whispers its lie to a villager who trusts it (a false friendship). The table
 *  sees only "X whispered to Y" — itself a tell (who confides in whom). */
/** WHOM A BOT TRUSTS WITH A SECRET (designer 2026-10-14: "bots should share info like real players — privately to
 *  people they can trust"): the players it KNOWS are on its side (its Kundli reads, either way); a villager also trusts
 *  players with something IN THEIR FAVOUR (vouched for, proven right — a score below 0), up to 2 friends. Nobody like
 *  that: the secret stays with it. A thief trusts only partners it knows. */
export function trustedFriends(s: GameState, seat: number, skill: Skill | null, not: number[] = []): number[] {
  const me = s.players[seat];
  const known = readsOf(s, seat);
  const ok = (x: number) => x !== seat && s.players[x]?.alive && !not.includes(x);
  const sure = s.players.filter((p) => ok(p.seat) && known.get(p.seat)?.side === me.side).map((p) => p.seat);
  if (me.side === "T" || !skill) return sure.slice(0, 2);
  const l = ledger(s, seat, skill);
  const clean = s.players.filter((p) => ok(p.seat) && !sure.includes(p.seat) && known.get(p.seat)?.side !== "T" && (l.score.get(p.seat) ?? 0) < 0)
    .map((p) => p.seat).sort((a, b) => (l.score.get(a) ?? 0) - (l.score.get(b) ?? 0));
  return [...sure, ...clean].slice(0, 2);
}

/** a private word from a bot to one friend — the table sees "A → B, privately" (once a round per pair), the friend the
 *  words. `data` carries what a bot friend reasons with (a Kundli read, or where a Stone went). Never twice the same. */
function tell(s: GameState, seat: number, to: number, line: string, data: Record<string, unknown>) {
  if (s.events.some((e) => e.type === "whisper_private" && e.data?.seat === seat && e.data?.to === to && e.msg.endsWith(line))) return;
  const me = s.players[seat].name, them = s.players[to].name;
  const pair = (e: GameState["events"][number]) => e.type === "whisper" && e.data?.round === s.round
    && ((e.data?.seat === seat && e.data?.target === to) || (e.data?.seat === to && e.data?.target === seat));
  if (!s.events.some(pair)) s.events.push({ n: s.events.length, type: "whisper", to: "all", msg: `${me} → ${them}, privately`, data: { seat, target: to, round: s.round, bot: true } });
  s.events.push({ n: s.events.length, type: "whisper_private", to: [seat, to], msg: `${me}: "${line}"`, data: { seat, to, ...data } });
}

/** a Kundli read (true for a villager, the thief's lie for a thief) goes to every friend it trusts */
function botWhisper(s: GameState, seat: number, about: number, role: string, side: "V" | "T", skill: Skill | null = null) {
  for (const to of trustedFriends(s, seat, skill, [about]))
    tell(s, seat, to, `I read ${s.players[about].name}'s Kundli — ${role}.`, { target: about, role, side, kind: "kundli" });
}

const STONE_WORD: Record<string, string> = { STONE_1: "the Bhadra Stone", STONE_2: "the Tunga Stone" };
/** A STONE LEFT MY HAND (designer 2026-10-14: "share the Stone's last location if it left their hand"): the bot tells
 *  the friends it trusts where it went. A villager also tells the whole table when it went to someone it suspects —
 *  the village needs to know a suspect holds a Stone. A thief tells only partners it knows. */
function shareStone(s: GameState, seat: number, skill: Skill, stone: string, to: number, how: string) {
  if (!s.players[to] || to === seat) return;
  for (const f of trustedFriends(s, seat, skill, [to]))
    tell(s, seat, f, `${how} ${STONE_WORD[stone]} to ${s.players[to].name}.`, { kind: "stone", target: to, stone, has: true });
  if (s.players[seat].side === "V" && s.players[to].alive) {
    const l = ledger(s, seat, skill);
    const suspect = (l.score.get(to) ?? 0) >= 1 || l.known.get(to)?.side === "T";
    const said = s.events.some((e) => e.type === "claim" && e.data?.seat === seat && e.data?.target === to && e.data?.kind === "stone" && e.data?.stone === stone);
    if (suspect && !said) pushStoneClaim(s, seat, to, true, stone);
  }
}

/** A VILLAGER'S BLUFF (designer 2026-10-13: "villagers can mimic thief skills — let a villager sabotage themselves").
 *  THE DECOY: a villager with no Stone says it holds one — a thief who then steals from it gives itself away (Hera
 *  Pheri on a "Stone holder" is a thief tell, tells.ts). THE COVER: a villager whose Stone the table has heard about
 *  denies it, so the thieves look elsewhere. Skilled villagers only, now and then, from round 2. */
function villagerBluff(s: GameState, seat: number, skill: Skill, r: R) {
  if (skill.name === "casual" || s.round < 2 || !s.players[seat].alive) return;
  if (s.events.some((e) => e.type === "claim" && e.data?.seat === seat && e.data?.target === seat && e.data?.kind === "stone")) return;
  const holds = s.players[seat].hand.some((c) => c === "STONE_1" || c === "STONE_2");
  const heard = s.events.some((e) => e.type === "claim" && e.data?.kind === "stone" && e.data?.target === seat && e.data?.has === true);
  if (!holds && r() < (skill.bluff ?? 0.15)) pushStoneClaim(s, seat, seat, true);
  else if (holds && heard && r() < 0.4) pushStoneClaim(s, seat, seat, false);
}

// ------------------------------------------------------------------ BOT TALK (designer 2026-10-14)
// "Bots should answer truthfully or lie as per their personality and role, and bots should speak with other bots too,
// to pass on information — without information transfer how will you solve a hidden role card game?"
// Research (Wolvesville / Mafia / Town of Salem guides): villagers confide in people they trust first; two players
// claiming the same role means one is lying; a liar picks a role that is hard to check and keeps the same story.

/** MY COVER STORY (designer 2026-10-14: "villagers will lie to protect their role, but within the village roles — and
 *  thieves lie within the village roles too"): ONE village role that isn't mine, kept all game — the story I told before,
 *  else a role I know belongs to a player who is out, else one nobody has claimed or been named (a coin flip among
 *  equally good ones). Chosen only from what MY phone saw. */
export function coverRole(s: GameState, seat: number, skill: Skill, r: R = Math.random): string {
  const mine = s.players[seat].role;
  const told = s.events.findLast((e) => e.data?.kind === "self" && e.data?.seat === seat && e.data?.side === "V" && typeof e.data?.role === "string" && e.data.role !== mine);
  if (told) return String(told.data!.role);
  const seen = viewFor(s, seat).events;
  const l = ledger(s, seat, skill);
  const pool = s.rolesInPlay.filter((x) => !THIEF_ROLES.includes(x) && x !== mine);
  const taken = new Set([...l.known].filter(([x, k]) => x !== seat && k.role).map(([, k]) => k.role!));
  const claimed = new Set(seen.filter((e) => e.data?.kind === "self" && e.data?.seat !== seat).map((e) => String(e.data?.role)));
  const named = new Set(seen.filter((e) => e.type === "claim" && typeof e.data?.role === "string" && e.data?.target !== seat).map((e) => String(e.data!.role)));
  const outRoles = pool.filter((x) => [...l.known].some(([y, k]) => k.role === x && !s.players[y].alive));
  const tiers = [outRoles.filter((x) => !claimed.has(x)), pool.filter((x) => !taken.has(x) && !claimed.has(x) && !named.has(x)),
    pool.filter((x) => !taken.has(x) && !claimed.has(x)), pool.filter((x) => !taken.has(x)), pool];
  const tier = tiers.find((xs) => xs.length) ?? [mine];
  return tier[Math.min(tier.length - 1, Math.floor(r() * tier.length))];
}

/** WHAT A BOT SAYS WHEN ASKED ITS ROLE (designer 2026-10-14) — the same rules for both sides, by personality:
 *    Open Book / Hothead  the truth
 *    Detective            the truth to a player it has nothing against (score ≤ 0), its cover story to a suspect
 *    Quiet One            its cover story to anyone it isn't sure of
 *  "The truth" for a thief is its cover story — it says its real role only to a partner (known or believed). Anyone sure
 *  of the asker (a villager it read, or a partner) gets the truth. A villager tells a thief it KNOWS its cover story. */
export function roleWordFor(s: GameState, seat: number, skill: Skill, asker: number, r: R = Math.random): { role: string; side: "V" | "T" } {
  const me = s.players[seat];
  const l = ledger(s, seat, skill);
  const cover = () => ({ role: coverRole(s, seat, skill, r), side: "V" as const });
  const truth = () => (me.side === "V" ? { role: me.role, side: "V" as const } : cover());
  if (me.side === "T" && partnersOf(s, seat, skill).has(asker)) return { role: me.role, side: "T" };
  const sure = l.known.get(asker)?.side;
  if (sure === "V") return truth();
  if (sure === "T") return cover();
  const sc = l.score.get(asker) ?? 0;
  if (skill.personality === "quiet") return cover();
  if (skill.personality === "detective") return sc <= 0 ? truth() : cover();
  return truth();
}

const toldRole = (s: GameState, seat: number, to: number) => s.events.some((e) => e.type === "whisper_private" && e.data?.seat === seat && e.data?.to === to && e.data?.kind === "self" && !e.data?.handshake);

/** a bot answers "what are you?" privately — once per player (and always the same story to them) */
function answerRole(s: GameState, seat: number, to: number, skill: Skill, ask = false) {
  if (!s.players[seat].alive || toldRole(s, seat, to)) return;
  const w = roleWordFor(s, seat, skill, to, rr);
  tell(s, seat, to, ask ? `I'm ${w.role}. And you?` : `I'm ${w.role}.`, { kind: "self", target: seat, role: w.role, side: w.side });
}

/** BOTS TALK TO EACH OTHER: once a round (and in each debate), a bot tells one player it doesn't suspect its role — by
 *  the rules above — and asks theirs. A bot asked answers at once; a person answers if they like. Thieves do exactly the
 *  same (they blend in). */
function roundTalk(s: GameState, seat: number, skill: Skill, bot: (x: unknown) => boolean) {
  const me = s.players[seat];
  if (!me.alive) return;
  if (s.events.some((e) => e.type === "whisper_private" && e.data?.seat === seat && e.data?.ask === true && e.data?.round === s.round)) return;
  const l = ledger(s, seat, skill);
  const partners = partnersOf(s, seat, skill);
  const ally = (x: number) => (me.side === "T" ? partners.has(x) : l.known.get(x)?.side === "V");
  const pool = s.players.filter((p) => p.alive && p.seat !== seat && !toldRole(s, seat, p.seat) && (ally(p.seat) || (l.known.get(p.seat)?.side === undefined && (l.score.get(p.seat) ?? 0) <= 0)));
  if (!pool.length) return;
  // the one I trust most — a coin flip among equals
  const low = Math.min(...pool.map((p) => l.score.get(p.seat) ?? 0));
  const ties = pool.filter((p) => (l.score.get(p.seat) ?? 0) === low);
  const to = ties[Math.min(ties.length - 1, Math.floor(rr() * ties.length))].seat;
  const w = roleWordFor(s, seat, skill, to, rr);
  tell(s, seat, to, `I'm ${w.role}. What are you?`, { kind: "self", target: seat, role: w.role, side: w.side, ask: true, round: s.round });
  if (bot(to)) answerRole(s, to, seat, skillOf(to)!);
}

// ------------------------------------------------------------------ THE HANDSHAKE (designer 2026-10-14)
// "Unless someone has been outed by Kundli — by then bot thieves can try to speak with them to get them to spill the
// beans: 'hey, I'm also Chor, tell me about the Stone'. An advanced villager will play double agent, and the same with
// an advanced thief."

/** OUTED: a thief role named for a player, out loud, by someone the table SAW do a Kundli with them */
export function outedBy(s: GameState, e: GameState["events"][number]): number | null {
  if (e.type !== "claim" || e.to !== "all" || e.data?.side !== "T" || typeof e.data?.role !== "string") return null;
  const a = e.data.seat as number, t = e.data.target as number;
  if (typeof a !== "number" || typeof t !== "number" || a === t || !s.players[t]?.alive) return null;
  const saw = s.events.some((k) => k.type === "kundli" && k.n < e.n && ((k.data?.seat === a && k.data?.target === t) || (k.data?.seat === t && k.data?.target === a)));
  return saw ? t : null;
}

const handshook = (s: GameState, a: number, b: number) => s.events.some((e) => e.type === "whisper_private" && e.data?.handshake === true && e.data?.seat === a && e.data?.to === b);

/** "I'm also <role>. Where's the Stone?" — a thief says its REAL role; a double-agent villager names a thief role
 *  that isn't the one X was outed as */
function reachOut(s: GameState, seat: number, x: number, role: string) {
  if (handshook(s, seat, x) || !s.players[seat].alive) return;
  tell(s, seat, x, `I'm also ${role}. Where's the Stone?`, { kind: "self", target: seat, role, side: "T", handshake: true });
}

const STONE_SAY: Record<string, string> = { STONE_1: "the Bhadra Stone", STONE_2: "the Tunga Stone" };
/** what a player tells a partner about the Stones: what it knows for sure (in hand, or one place only), or "no idea" */
function stoneNews(s: GameState, seat: number, skill: Skill): { line: string; target: number | null; stone: string | null } {
  const mine = s.players[seat].hand.find((c) => c === "STONE_1" || c === "STONE_2");
  if (mine) return { line: `I have ${STONE_SAY[mine]}.`, target: seat, stone: mine };
  const mem = stoneMemory(s, seat, skill);
  for (const [c, set] of mem) if (set.size === 1) { const y = [...set][0]; if (y !== seat) return { line: `${STONE_SAY[c]} is with ${s.players[y].name}.`, target: y, stone: c }; }
  return { line: "No idea where the Stones are.", target: null, stone: null };
}

/** DOUBLE AGENT (designer 2026-10-14): only a SHARP bot can pull it off, and its personality decides whether it wants to —
 *  the Quiet One always; the Detective only about its top suspect (it's fishing for proof); the Hothead and the Open
 *  Book never (they say it out loud instead) */
export function playsDoubleAgent(s: GameState, me: number, skill: Skill, about: number): boolean {
  if (skill.name !== "sharp") return false;
  if (skill.personality === "quiet") return true;
  if (skill.personality !== "detective") return false;
  const l = ledger(s, me, skill);
  const others = s.players.filter((p) => p.alive && p.seat !== me).map((p) => p.seat);
  const top = Math.max(...others.map((x) => l.score.get(x) ?? 0));
  return (l.score.get(about) ?? 0) === top && top > 0;
}

/** someone said "I'm also <thief role>" to me (a bot). What I do depends on what I am and how sharp I am. */
function answerHandshake(s: GameState, me: number, from: number, role: string, skill: Skill) {
  if (!s.players[me].alive || handshook(s, me, from)) return;
  const l = ledger(s, me, skill);
  const fits = s.rolesInPlay.includes(role) && THIEF_ROLES.includes(role) && role !== s.players[me].role
    && ![...l.known].some(([y, k]) => y !== from && k.role === role);
  if (s.players[me].side === "T") {
    // a THIEF: a partner, it seems. A sharp thief trusts only a messenger who never accused or voted against it —
    // anyone else gets a false Stone location (the double agent's own medicine)
    const hostile = s.events.some((e) => (e.type === "claim" && e.to === "all" && e.data?.seat === from && e.data?.target === me && e.data?.side === "T")
      || (e.type === "vote_result" && (e.data?.ballots as Record<string, number | null> | undefined)?.[from] === me));
    const believe = fits && !(skill.name === "sharp" && hostile);
    if (believe) {
      const news = stoneNews(s, me, skill);
      tell(s, me, from, `Yes — I'm ${s.players[me].role}. ${news.line}`, { kind: "self", target: me, role: s.players[me].role, side: "T", handshake: true, believe: true });
      if (news.target !== null) tell(s, me, from, news.line, { kind: "stone", target: news.target, stone: news.stone, has: true });
      return;
    }
    // not believed: a double agent plays along with a cover — a thief role that isn't mine, and a Stone somewhere it
    // isn't; anyone else just doesn't answer
    if (!playsDoubleAgent(s, me, skill, from)) return;
    const decoy = s.players.filter((p) => p.alive && p.seat !== me && p.seat !== from).map((p) => p.seat).sort((a, b) => (l.score.get(a) ?? 0) - (l.score.get(b) ?? 0))[0];
    const fake = s.rolesInPlay.find((x) => THIEF_ROLES.includes(x) && x !== s.players[me].role && x !== role) ?? s.players[me].role;
    tell(s, me, from, decoy !== undefined ? `I'm ${fake}. The Tunga Stone is with ${s.players[decoy].name}.` : `I'm ${fake}. No idea about the Stones.`,
      { kind: "self", target: me, role: fake, side: "T", handshake: true });
    if (decoy !== undefined) tell(s, me, from, `The Tunga Stone is with ${s.players[decoy].name}.`, { kind: "stone", target: decoy, stone: "STONE_2", has: true });
    return;
  }
  // a VILLAGER (outed wrongly, or approached): the messenger has just told me they're a thief
  if (playsDoubleAgent(s, me, skill, from)) {
    // DOUBLE AGENT: play the thief to learn where the Stone is
    const fake = s.rolesInPlay.find((x) => THIEF_ROLES.includes(x) && x !== role) ?? role;
    tell(s, me, from, `I'm ${fake}. No Stone with me — where's yours?`, { kind: "self", target: me, role: fake, side: "T", handshake: true, agent: true });
    return;
  }
  // otherwise: say it out loud
  s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${s.players[me].name}: "${s.players[from].name} told me they're ${role}."`,
    data: { seat: me, kind: "told", target: from, role, side: "T", told: true } });
}

/** a player was just outed: thief bots reach out with their real role; sharp villager bots reach out as double agents */
function onOuted(s: GameState, x: number, outedAs: string, accuser: number, botSkill: (seat: number) => Skill | null) {
  for (const p of s.players) {
    const sk = botSkill(p.seat);
    if (!sk || !p.alive || p.seat === x || p.seat === accuser) continue;
    if (p.side === "T") { if (!partnersOf(s, p.seat, sk).has(x)) reachOut(s, p.seat, x, p.role); }
    else if (playsDoubleAgent(s, p.seat, sk, x) && ledger(s, p.seat, sk).known.get(x)?.side !== "V") {
      const fake = s.rolesInPlay.find((r) => THIEF_ROLES.includes(r) && r !== outedAs);
      if (fake) reachOut(s, p.seat, x, fake);
    }
  }
}

let skillOf: (x: number) => Skill | null = () => null;
let rr: R = Math.random;

/** (2026-10-14) a reaction can start a conversation — a reach-out gets an answer, a Kundli mark outs a thief and the
 *  thieves reach out — so the bots react until the table goes quiet (each line is said once: every reply is guarded) */
export function botReactions(s: GameState, from: number, botSkill: (seat: number) => Skill | null, r: R = Math.random) {
  for (let pass = 0, at = from; pass < 12; pass++) {
    const end = s.events.length;
    if (at >= end) break;
    reactOnce(s, at, botSkill, r);
    at = end;
  }
}

function reactOnce(s: GameState, from: number, botSkill: (seat: number) => Skill | null, r: R) {
  const bot = (x: unknown) => typeof x === "number" && botSkill(x) !== null;
  skillOf = botSkill; rr = r;
  if (RULES) for (const e of s.events.slice(from)) {
    const d = e.data;
    // a question to a bot
    if (e.type === "ask" && bot(d?.target) && s.players[d!.target as number]?.alive) answerRole(s, d!.target as number, d!.seat as number, botSkill(d!.target as number)!);
    // THE HANDSHAKE: a player outed by an open Kundli — thieves reach out, sharp villagers pose as thieves
    { const x = outedBy(s, e); if (x !== null) onOuted(s, x, String(d!.role), d!.seat as number, botSkill); }
    if (e.type === "whisper_private" && d?.handshake === true && bot(d.to) && typeof d.seat === "number") {
      const to = d.to as number, from = d.seat as number;
      if (!handshook(s, to, from)) answerHandshake(s, to, from, String(d.role), botSkill(to)!);
      // a double agent answered my reach-out with "where's yours?" — a thief that believes them tells the truth
      else if (d.agent === true && s.players[to].side === "T" && !partnersOf(s, to, botSkill(to)).has(from)) {
        const sk = botSkill(to)!;
        if (sk.name !== "sharp") {
          const news = stoneNews(s, to, sk);
          tell(s, to, from, news.line, { kind: "stone", target: news.target, stone: news.stone, has: news.target !== null, believe: true });
        }
      }
    }
    // someone told a bot their role privately: it answers with its own (the same rules)
    if (d?.kind === "self" && typeof d.seat === "number" && !d.handshake && d.side !== "T") {
      const to = e.type === "whisper_private" ? (d.to as number) : Array.isArray(e.to) && !d.public && e.to.length === 1 ? e.to[0] : null;
      if (to !== null && bot(to) && to !== d.seat && s.players[to]?.alive) answerRole(s, to, d.seat as number, botSkill(to)!);
      // MY ROLE, CLAIMED BY SOMEONE ELSE: a villager bot says so out loud, once — "X is lying — I'm Kisaan"
      const owner = s.players.findIndex((p) => p.role === d.role);
      const heardBy = e.to === "all" || d.public || (Array.isArray(e.to) && e.to.includes(owner)) || (e.type === "whisper_private" && d.to === owner);
      if (owner >= 0 && owner !== d.seat && bot(owner) && heardBy && s.players[owner].alive && s.players[owner].side === "V"
        && !s.events.some((c) => c.type === "claim" && c.data?.seat === owner && c.data?.target === d.seat && c.data?.side === "T")) {
        const liar = d.seat as number;
        s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${s.players[owner].name}: "${s.players[liar].name} is lying — I'm ${d.role}."`, data: { seat: owner, kind: "accuse", target: liar, role: null, side: "T", counter: true } });
        if (!s.events.some((c) => c.type === "claim" && c.to === "all" && c.data?.kind === "self" && c.data?.seat === owner))
          s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${s.players[owner].name}: "I'm ${d.role}."`, data: { seat: owner, kind: "self", target: owner, role: d.role, side: "V" } });
      }
    }
    // a new round, or a debate: the bots talk among themselves
    if ((e.type === "pickup" && (s.events.slice(0, e.n).findLast((x) => x.type === "pickup")?.data?.round ?? 0) !== d?.round) || e.type === "faisla" || e.type === "final_vote")
      for (const p of s.players) if (bot(p.seat)) roundTalk(s, p.seat, botSkill(p.seat)!, bot);
  }
  const mark = (seat: number, kind: "kundli" | "was", target: number, role: string | null, side: "V" | "T") => {
    if (s.events.some((e) => e.type === "claim" && e.data?.seat === seat && e.data?.target === target && e.data?.kind === kind)) return;
    const them = s.players[target].name;
    s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${s.players[seat].name}: "${them} ${kind === "was" ? "was" : "is"} ${role ?? (side === "T" ? "a thief" : "a villager")}."`,
      data: { seat, kind, target, role, side } });
  };
  for (const e of s.events.slice(from)) {
    if (RULES) {
      const stones = (cs: unknown) => ((cs as string[]) ?? []).filter((c) => c === "STONE_1" || c === "STONE_2");
      // the pile I passed was picked up: my Stone is with them now
      if (e.type === "pickup_private" && Array.isArray(e.to)) {
        const got = stones(e.data?.cards), taker = e.to[0];
        const passer = s.events.slice(0, e.n).findLast((x) => (x.type === "pass" || x.type === "pass_after"))?.data?.seat as number | undefined;
        if (got.length && passer !== undefined && bot(passer) && passer !== taker) for (const c of got) shareStone(s, passer, botSkill(passer)!, c, taker, "I passed");
      }
      if (e.type === "batwara_private" && bot(e.data?.from) && stones([e.data?.card]).length)
        shareStone(s, e.data!.from as number, botSkill(e.data!.from as number)!, String(e.data!.card), e.data!.to as number, "In the Bhukamp I gave");
      if (e.type === "handoff_private" && bot(e.data?.seat))
        for (const c of stones(e.data?.cards)) shareStone(s, e.data!.seat as number, botSkill(e.data!.seat as number)!, c, e.data!.target as number, "My cards went with");
    }
    // (designer 2026-10-14: "make the bots do the same") ACCUSED → ANSWER AT ONCE, the way a player taps the accuser:
    // a bot called a thief (or named with a thief role) calls the accuser out in return — a villager because it knows
    // the word is wrong, a thief to hit back. Once per accuser; a role only if the bot SAW the accuser's card.
    if (RULES && e.type === "claim" && e.to === "all" && e.data?.side === "T" && e.data?.kind !== "stone" && bot(e.data?.target)) {
      const me = e.data!.target as number, accuser = e.data!.seat as number;
      if (accuser !== me && s.players[me]?.alive && s.players[accuser]?.alive
        && !s.events.some((c) => c.type === "claim" && c.data?.seat === me && c.data?.target === accuser && c.data?.side === "T")) {
        const read = s.events.findLast((k) => k.type === "kundli_private" && Array.isArray(k.to) && k.to[0] === me && k.data?.target === accuser);
        const villager = s.players[me].side === "V";
        // a villager who read the accuser says the truth; otherwise a plain "suspects" — no invented role
        const role = read && villager ? (read.data?.side === "T" ? String(read.data?.role) : null) : null;
        if (!(villager && read?.data?.side === "V")) {
          s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${s.players[me].name}: "${role ? `${s.players[accuser].name} is ${role}` : `${s.players[accuser].name} is lying`}."`,
            data: { seat: me, kind: role ? "kundli" : "accuse", target: accuser, role, side: "T", answer: true } });
        }
        // (designer 2026-10-14, bot talk) under pressure — called a thief by 2 players, or the Open Book / Hothead at once —
        // a bot claims a role out loud: a villager its own, a thief its lie (the same story it told before). Once.
        const sk = botSkill(me)!;
        const pressed = new Set(s.events.filter((c) => c.type === "claim" && c.data?.target === me && c.data?.side === "T" && c.data?.seat !== me).map((c) => c.data!.seat)).size;
        if ((pressed >= 2 || sk.personality === "open" || sk.personality === "hothead")
          && !s.events.some((c) => c.type === "claim" && c.to === "all" && c.data?.kind === "self" && c.data?.seat === me)) {
          const role2 = villager ? s.players[me].role : coverRole(s, me, sk, r);
          s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${s.players[me].name}: "I'm ${role2}."`, data: { seat: me, kind: "self", target: me, role: role2, side: "V" } });
        }
      }
      continue;
    }
    // DID IT COME BACK? (designer 2026-10-12) a villager bot whose Stone a Bhukamp handed on, and which didn't come back
    // down the pile, knows its neighbour kept it — and marks it for the table. (A thief bot keeps that to itself.)
    // (2026-10-13) a HUMAN learns it too — privately: "Your Stone didn't come back — Raju kept it"
    if (e.type === "pickup_private" && Array.isArray(e.to) && !bot(e.to[0])) {
      const kept = keptMyStone(s, e.to[0], e.n);
      if (kept !== null) s.events.push({ n: s.events.length, type: "kept_private", to: [e.to[0]], msg: `Your Stone didn't come back — ${s.players[kept].name} kept it.`, data: { seat: kept, target: e.to[0] } });
      continue;
    }
    // (2026-10-14) the bot rulebook has no bluffing — docs/BOT_LOGIC.md
    if (!RULES && e.type === "pickup_private" && Array.isArray(e.to) && bot(e.to[0]) && s.players[e.to[0]]?.side === "V") villagerBluff(s, e.to[0] as number, botSkill(e.to[0] as number)!, r);
    if (e.type === "pickup_private" && Array.isArray(e.to) && bot(e.to[0]) && s.players[e.to[0]]?.side === "V") {
      const kept = keptMyStone(s, e.to[0], e.n);
      if (kept !== null && !s.events.some((c) => c.type === "claim" && c.data?.seat === e.to[0] && c.data?.target === kept && c.data?.kind === "stone" && c.n > e.n - 40)) pushStoneClaim(s, e.to[0] as number, kept, true);
      continue;
    }
    // (2026-10-14, bot rulebook) a villager robbed of a Stone says who took it — the way anyone would
    if (RULES && e.type === "hera_pheri_private" && ((e.data?.taken as string[]) ?? []).some((c) => c === "STONE_1" || c === "STONE_2")) {
      const hp = s.events.slice(0, e.n).reverse().find((x) => x.type === "hera_pheri");
      const thiefSeat = hp?.data?.seat as number | undefined, victim = hp?.data?.target as number | undefined;
      const taken = ((e.data?.taken as string[]) ?? []).find((c) => c === "STONE_1" || c === "STONE_2");
      if (thiefSeat !== undefined && victim !== undefined && bot(victim) && s.players[victim].side === "V" && s.players[victim].alive) pushStoneClaim(s, victim, thiefSeat, true, taken);
      continue;
    }
    const seen = e.type === "talashi_private" ? (e.data?.seat as number)
      : e.type === "kundli_private" || e.type === "eliminated_private" ? (Array.isArray(e.to) ? e.to[0] : undefined) : undefined;
    if (seen === undefined || !bot(seen) || !s.players[seen]?.alive) continue;
    const skill = botSkill(seen)!;
    const thief = s.players[seen].side === "T";
    if (RULES) {
      // the bot rulebook (reason.ts): no dice on whether a bot speaks — a villager says what it saw, a thief the lie
      if (e.type === "talashi_private") {
        const target = e.data?.target as number;
        const found = ((e.data?.hand as string[]) ?? []).find((c) => c === "STONE_1" || c === "STONE_2");
        const says = wordAboutSearch(s, seen, skill, Boolean(found));
        if (s.players[target]?.alive) pushStoneClaim(s, seen, target, says, says ? found : null);
        continue;
      }
      const target = (e.type === "eliminated_private" ? e.data?.seat : e.data?.target) as number;
      if (!s.players[target] || target === seen) continue;
      const kind = e.type === "eliminated_private" ? "was" : "kundli";
      if (kind === "kundli" && !s.players[target].alive) continue;
      const w = wordAboutRole(s, seen, skill, r, target, e.data?.role as string, e.data?.side as "V" | "T");
      if (w) { mark(seen, kind, target, w.role, w.side); if (w.role && (!thief || skill.name !== "casual")) botWhisper(s, seen, target, w.role, w.side, skill); }
      continue;
    }
    const speaks = r() < skill.claimRate;
    const lies = thief && r() < skill.lie;
    if (e.type === "talashi_private") {
      const target = e.data?.target as number;
      const found = ((e.data?.hand as string[]) ?? []).some((c) => c === "STONE_1" || c === "STONE_2");
      // (2026-10-12, game HTKV9: Bunty saw the Tunga Stone with a thief and said nothing) a villager who SEES a Stone
      // always marks it, at every skill level
      // a skilled thief keeps a Stone it found to itself — it means to steal it (thief skills, belief.ts)
      if (thief && found && skill.name !== "casual") continue;
      if (!s.players[target]?.alive || (!speaks && !lies && !(found && !thief))) continue;
      pushStoneClaim(s, seen, target, lies ? !found : found);
      continue;
    }
    // a role it saw: its own read, the reader who read it back (Mutual Kundli), or a player it put out
    const target = (e.type === "eliminated_private" ? e.data?.seat : e.data?.target) as number;
    const role = e.data?.role as string, side = e.data?.side as "V" | "T";
    if (!s.players[target] || target === seen) continue;
    const kind = e.type === "eliminated_private" ? "was" : "kundli";
    if (kind === "kundli" && !s.players[target].alive) continue;
    // (designer 2026-10-13: "there's mutual Kundli now — you shouldn't stay silent, you're missing out on creating chaos")
    // a villager ALWAYS says what it saw — the reader and the one read, both — and tells a close friend privately too
    if (!thief) { if (kind === "kundli" || speaks) mark(seen, kind, target, role, side); botWhisper(s, seen, target, role, side); continue; }
    // a thief: a lie (the other side, a believable role — never its own, which the player it read may now know) —
    // or nothing at all
    const w = thiefWord(s, seen, target, role, side, skill, r);
    if (w) { mark(seen, kind, target, w.role, w.side); if (skill.name !== "casual") botWhisper(s, seen, target, w.role, w.side); }
  }
}

/** what a bot's line asserts goes on the table as a claim — every bot reads it, the seat counts it (playtest LLE3Q) */
export function pushTalkClaims(s: GameState, said: { seat: number; c: LineClaim }[]) {
  for (const { seat, c } of said) {
    if (!s.players[c.target]) continue;
    // already marked: a discovery becomes one mark, not a mark and a line (botsSayWhatTheyFound)
    if (s.events.some((e) => e.type === "claim" && e.data?.seat === seat && e.data?.target === c.target && (e.data?.kind === "stone") === (c.kind === "stone"))) continue;
    const them = s.players[c.target].name;
    if (c.kind === "stone") {
      s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${s.players[seat].name}: "${them} ${c.has ? "has a Stone" : "has no Stone"}."`,
        data: { seat, kind: "stone", target: c.target, role: null, side: null, has: c.has, fromLine: true } });
      continue;
    }
    // (2026-10-13) every word names a role
    const role = c.role ?? (c.side ? roleFor(s, seat, c.target, c.side) : null);
    if (!role || !c.side) continue;
    const was = !s.players[c.target].alive;
    s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${s.players[seat].name}: "${them} ${was ? "was" : "is"} ${role}."`,
      data: { seat, kind: was ? "was" : "kundli", target: c.target, role, side: THIEF_ROLES.includes(role) ? "T" : "V", fromLine: true } });
  }
}

// ------------------------------------------------------------------ THE TIE MOMENT (designer 2026-10-14)
// "Tie breaks are the opportunities to spill the beans and sway votes — 'hey, X said he's Chor', 'Y said he's
// Lootera' — so advanced moves can be punished, but give high rewards too."
/** the vote is tied as the clock ends: bots holding a secret about a tied player say it out loud, before the tie-break
 *  - a villager a tied player confided in ("I'm also Chor" — the handshake) says so, and where they said the Stone was
 *  - a SHARP thief whose partner is in the tie frames the other tied player: "Y told me they're <a thief role>" — a lie
 *    (Y knows it, says so, and anyone who knows better marks the thief a liar) */
export function tieSpill(s: GameState, botSkill: (seat: number) => Skill | null, r: R = Math.random) {
  const ph = s.phase;
  if (ph.kind !== "vote" || ph.debate) return;
  const tally = new Map<number, number>();
  for (const [v, t] of Object.entries(ph.ballots)) if (t !== null && t !== undefined) tally.set(t, (tally.get(t) ?? 0) + (s.players[Number(v)]?.votes ?? 1));
  const max = Math.max(0, ...tally.values());
  const leaders = [...tally].filter(([, k]) => k === max && max > 0).map(([x]) => x);
  if (leaders.length < 2) return;
  const said = (a: number, t: number) => s.events.some((e) => e.type === "claim" && e.data?.seat === a && e.data?.target === t && e.data?.told === true);
  const order = s.players.filter((p) => p.alive && botSkill(p.seat)).map((p) => p.seat).sort(() => r() - 0.5);
  for (const me of order) {
    const sk = botSkill(me)!;
    if (s.players[me].side === "V") {
      for (const x of leaders) {
        if (x === me || said(me, x)) continue;
        const conf = s.events.findLast((e) => e.type === "whisper_private" && e.data?.handshake === true && e.data?.side === "T" && e.data?.seat === x && e.data?.to === me);
        if (!conf) continue;
        s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${s.players[me].name}: "${s.players[x].name} told me they're ${String(conf.data!.role)}."`,
          data: { seat: me, kind: "told", target: x, role: conf.data!.role, side: "T", told: true } });
        const stone = s.events.findLast((e) => e.type === "whisper_private" && e.data?.kind === "stone" && e.data?.seat === x && e.data?.to === me && e.data?.has === true);
        if (stone && typeof stone.data?.target === "number" && s.players[stone.data.target as number]?.alive) pushStoneClaim(s, me, stone.data.target as number, true, stone.data.stone as string);
      }
    } else {
      const partners = partnersOf(s, me, sk);
      // (designer 2026-10-14: "sharp villagers can be punished as thieves if they posed as thieves") a tied player
      // who told me "I'm also <thief role>" and isn't my partner — a double agent I didn't trust, or one who turned on
      // me — gets their own words read back to the table
      for (const x of leaders) {
        if (x === me || partners.has(x) || said(me, x)) continue;
        const conf = s.events.findLast((e) => e.type === "whisper_private" && e.data?.handshake === true && e.data?.side === "T" && e.data?.seat === x && e.data?.to === me);
        if (conf) s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${s.players[me].name}: "${s.players[x].name} told me they're ${String(conf.data!.role)}."`,
          data: { seat: me, kind: "told", target: x, role: conf.data!.role, side: "T", told: true } });
      }
      if (sk.name !== "sharp" || !leaders.some((x) => partners.has(x))) continue;
      const mark = leaders.find((x) => x !== me && !partners.has(x) && !said(me, x));
      if (mark === undefined) continue;
      const known = new Set([s.players[me].role, ...[...partners].map((x) => s.players[x].role)]);
      const role = s.rolesInPlay.find((x) => THIEF_ROLES.includes(x) && !known.has(x));
      if (!role) continue;
      s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${s.players[me].name}: "${s.players[mark].name} told me they're ${role}."`,
        data: { seat: me, kind: "told", target: mark, role, side: "T", told: true } });
    }
  }
}
