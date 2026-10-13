// BOT REACTIONS — what a bot does the MOMENT it learns something (a Kundli read, a search, a player it put out, a Stone
// that didn't come back): marks for the table, whispers to a close friend, a villager's bluff. Shared by the online
// game (game.ts) and every simulation, so the bots measured are the bots people play against (2026-10-13).
import type { GameState } from "@/engine/types";
import { readsOf } from "@/engine/decisions";
import { keptMyStone, roleFor, thiefWord, type Skill } from "./belief";
import { THIEF_ROLES } from "@/engine/setup";
import type { LineClaim } from "./botmind";

type R = () => number;

/** "X has a Stone" / "X has no Stone", on the table for everyone */
export function pushStoneClaim(s: GameState, seat: number, target: number, has: boolean) {
  const me = s.players[seat].name, them = s.players[target].name;
  s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${me}: "${them} ${has ? "has a Stone" : "has no Stone"}."`,
    data: { seat, kind: "stone", target, has, role: null, side: null } });
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
function botWhisper(s: GameState, seat: number, about: number, role: string, side: "V" | "T") {
  if (s.events.some((e) => e.type === "whisper" && e.data?.seat === seat && e.data?.round === s.round)) return;
  const friends = [...readsOf(s, seat)].filter(([x, k]) => k.side === "V" && x !== about && s.players[x]?.alive).map(([x]) => x);
  if (!friends.length) return;
  const to = friends[0];
  const me = s.players[seat].name, them = s.players[to].name;
  s.events.push({ n: s.events.length, type: "whisper", to: "all", msg: `${me} whispered to ${them}.`, data: { seat, target: to, round: s.round } });
  s.events.push({ n: s.events.length, type: "whisper_private", to: [seat, to], msg: `${me} whispers: "I read ${s.players[about].name}'s Kundli — ${role}."`,
    data: { seat, target: about, role, side, kind: "kundli", to } });
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

export function botReactions(s: GameState, from: number, botSkill: (seat: number) => Skill | null, r: R = Math.random) {
  const bot = (x: unknown) => typeof x === "number" && botSkill(x) !== null;
  const mark = (seat: number, kind: "kundli" | "was", target: number, role: string | null, side: "V" | "T") => {
    if (s.events.some((e) => e.type === "claim" && e.data?.seat === seat && e.data?.target === target && e.data?.kind === kind)) return;
    const them = s.players[target].name;
    s.events.push({ n: s.events.length, type: "claim", to: "all", msg: `${s.players[seat].name}: "${them} ${kind === "was" ? "was" : "is"} ${role ?? (side === "T" ? "a thief" : "a villager")}."`,
      data: { seat, kind, target, role, side } });
  };
  for (const e of s.events.slice(from)) {
    // DID IT COME BACK? (designer 2026-10-12) a villager bot whose Stone a Bhukamp handed on, and which didn't come back
    // down the pile, knows its neighbour kept it — and marks it for the table. (A thief bot keeps that to itself.)
    // (2026-10-13) a HUMAN learns it too — privately: "Your Stone didn't come back — Raju kept it"
    if (e.type === "pickup_private" && Array.isArray(e.to) && !bot(e.to[0])) {
      const kept = keptMyStone(s, e.to[0], e.n);
      if (kept !== null) s.events.push({ n: s.events.length, type: "kept_private", to: [e.to[0]], msg: `Your Stone didn't come back — ${s.players[kept].name} kept it.`, data: { seat: kept, target: e.to[0] } });
      continue;
    }
    if (e.type === "pickup_private" && Array.isArray(e.to) && bot(e.to[0]) && s.players[e.to[0]]?.side === "V") villagerBluff(s, e.to[0] as number, botSkill(e.to[0] as number)!, r);
    if (e.type === "pickup_private" && Array.isArray(e.to) && bot(e.to[0]) && s.players[e.to[0]]?.side === "V") {
      const kept = keptMyStone(s, e.to[0], e.n);
      if (kept !== null && !s.events.some((c) => c.type === "claim" && c.data?.seat === e.to[0] && c.data?.target === kept && c.data?.kind === "stone" && c.n > e.n - 40)) pushStoneClaim(s, e.to[0] as number, kept, true);
      continue;
    }
    const seen = e.type === "talashi_private" ? (e.data?.seat as number)
      : e.type === "kundli_private" || e.type === "eliminated_private" ? (Array.isArray(e.to) ? e.to[0] : undefined) : undefined;
    if (seen === undefined || !bot(seen) || !s.players[seen]?.alive) continue;
    const skill = botSkill(seen)!;
    const thief = s.players[seen].side === "T";
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
