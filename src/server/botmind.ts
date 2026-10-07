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
//  S4  bot plays a pair: Faisla · Talashi · Hera Pheri · Bhukamp · Maya Jaal · Teer Kaman (Kundli → S7)
//  S5  Hera Pheri on the bot (and whether a Stone was taken)
//  S6  Talashi on the bot (Stone found / clean)        S7  Kundli: the bot reads (thief/villager × own side) /
//                                                          is read / watches someone else get read
//  S8  Teer Kaman at the bot (miss)                    S9  Maya Jaal brings the bot back
//  S10 Bhukamp by someone else
//  S12 the debate (Faisla or the final vote): priority — confirmed thief from own Kundli → thief under suspicion
//      deflects → Stone claim/denial → accusation with a reason → threat from a pair in hand → vouching → hunch
//  S13 the final mandatory vote: the Stone question     S14 nobody voted out
//  S15 an elimination: last words (by side, with/without a Stone) and the table's reaction (who voted a villager out)
//  S16 dying powers aimed at the bot: gift · Dal Badal · last shot · handoff     S17 bot loses a vote
//  S18 game over: winners and losers
import type { ActionCard, Card, GameEvent, GameState, Side } from "@/engine/types";
import { viewFor, type PlayerView } from "@/engine/view";

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
        void swapPartner; void mySide;
        break;
      }
      case "hera_pheri": if (target === seat) add(actor, 2, "mere cards uthaye"); break;
      case "teer_kaman": if (target === seat) add(actor, 3, "mujh pe teer chalaya"); break;
      case "last_shot": if (target === seat) add(actor, 2, "aakhri teer mujh pe chalaya"); break;
      case "talashi":
        if (target === seat) add(actor, 1, "meri talashi li");
        if (stonesIn(d?.hand) && target !== seat) add(target, thief ? 0.5 : 1.5, "Stone uske haath mein dikha");
        break;
      // a claim out loud: a villager weighs it by who said it; a thief only cares when it is aimed at itself
      case "claim": {
        if (actor === null || target === null || actor === seat) break;
        const saysThief = d?.side === "T";
        const k = known.get(actor);
        if (target === seat) { if (saysThief) add(actor, 4, thief ? "mujh pe ilzaam lagaya" : "mujhe jhootha chor bola"); break; }
        if (thief) break;
        const sure = known.get(target);
        if (sure && sure.side === "V" && saysThief) { add(actor, 3, `${name(target)} ko chor bola, woh gaon wala hai`); break; }
        if (k?.side === "T") break; // a thief I know is talking: ignore it
        const strong = k?.side === "V" ? 3 : 1; // a villager I know is believed outright
        const pts = (d?.kind === "kundli" ? 4 : 2) * strong;
        add(target, saysThief ? pts : -pts / 2, saysThief ? `${name(actor)} ne ${d?.kind === "kundli" ? "Kundli dekh ke" : ""} chor bataya` : null);
        break;
      }
      case "vote_result":
        ballots = (d?.ballots as Record<string, number | null>) ?? {};
        for (const [voter, t] of Object.entries(ballots)) if (t === seat) { suspected = true; add(Number(voter), 2, "mujhe vote kiya"); }
        break;
      case "eliminated": {
        const villager = d?.side === "V";
        for (const [voter, t] of Object.entries(ballots)) if (t === actor) add(Number(voter), villager ? 3 : -2, villager ? `${name(actor)} ko vote kiya, woh gaon wala nikla` : null);
        const killer = num(d, "killer");
        if (villager && killer !== null) add(killer, 4, `${name(actor)} ko maara, woh gaon wala tha`);
        ballots = {};
        break;
      }
    }
  }
  known.delete(seat);
  // certainty outweighs every hunch: a villager hunts a thief it knows and trusts a villager it knows;
  // a thief protects a partner it knows and is happy to frame a villager it knows
  for (const [x, k] of known) {
    const how = k.how === "swap" ? "Dal Badal se pata chala" : "Kundli mein dikha";
    if (k.side === "T") add(x, thief ? -100 : 100, thief ? null : `${how} — chor hai`);
    else add(x, thief ? 4 : -100, thief ? "bahut chalaak lagta hai" : null);
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

/** A bot's ballot: a thief it saw first, then its top suspect with a real reason, otherwise a hunch. */
export function botVote(s: GameState, seat: number, seed: number, r: R): number | null {
  const m = mindOf(s, seat, seed);
  const seen = m.thief ? [] : m.sawThief.filter((x) => aliveSeat(m, x));
  if (seen.length) return seen[0];
  const order = ranked(m);
  if (!order.length) return null;
  const [t, read] = order[0];
  if (read.score >= 2 && r() < 0.85) return t;
  if (r() < 0.15) return null;
  return pick(r, order.slice(0, 3))[0];
}

// ------------------------------------------------------------------ S12/S13 the debate
const THREAT: Partial<Record<ActionCard, (t: string) => string>> = {
  KUNDLI: (t) => `Mere paas Kundli hai — agle turn ${t} ki dekh lunga.`,
  TEER_KAMAN: (t) => `Mere haath mein Teer Kaman hai. ${t}, sambhal ke.`,
  TALASHI: (t) => `Talashi hai mere paas — ${t}, jeb khaali rakhna.`,
  FAISLA: () => "Agla Faisla main bulaunga, tayyar raho.",
  HERA_PHERI: (t) => `${t}, tumhare cards pe meri nazar hai.`,
};

export function debateLine(m: Mind, final: boolean, r: R): string {
  const t = top(m);
  const tn = t ? m.name(t[0]) : "koi";
  // a villager who SAW a thief says so, every time
  const seen = m.thief ? [] : m.sawThief.filter((x) => aliveSeat(m, x));
  if (seen.length) {
    const t0 = m.name(seen[0]);
    return m.known.get(seen[0])?.how === "swap"
      ? pick(r, [`Dal Badal ke baad mujhe pakka pata hai — ${t0} CHOR hai. Sab ${t0} ko vote karo!`, `${t0} ka sach mujhe pata hai — woh chor hai, main guarantee deta hoon.`])
      : pick(r, [`Maine ${t0} ki Kundli dekhi thi — woh CHOR hai. Sab ${t0} ko vote karo!`, `${t0} chor hai, Kundli mein saaf dikha. Bahas khatam.`]);
  }
  // a thief whose swap partner is a villager: that partner KNOWS — discredit them before they speak
  const partner = m.swapPartner !== null && aliveSeat(m, m.swapPartner) ? m.swapPartner : null;
  if (m.thief && partner !== null && m.known.get(partner)?.side === "V")
    return pick(r, [`${m.name(partner)} pe bharosa mat karna — Dal Badal ke baad woh mujh pe jhootha ilzaam lagayega.`, `Dekhna, ${m.name(partner)} ab mujhe chor bolega. Wahi asli chor hai!`]);
  // a thief under suspicion turns it around
  if (m.thief && m.suspected && t) return pick(r, [`Mujh pe shak? Main gaon wala hoon! Asli chor ${tn} hai — ${t[1].why ?? "dekho kitna chup hai"}.`, `Galat aadmi ke peeche pade ho. ${tn} ko dekho — ${t[1].why ?? "sabse zyada chalaak wahi hai"}.`]);
  if (final) {
    if (!m.thief && m.stones) return `Ek Stone mere paas hai, main gaon wala hoon. Dusra Stone kiske paas hai? Bolo!`;
    if (m.thief && m.stones) return pick(r, [`Mere paas koi Stone nahi. ${tn} pe shak hai mujhe.`, "Stone gaon walon ke paas hi hoga… mere paas toh nahi."]);
    if (!m.thief) return `Aakhri vote hai. Dono Stone gaon ke paas hone chahiye — ${tn}, tumhare paas kya hai?`;
  }
  // Stones: a villager wants protection, a thief wants nobody to know
  if (m.stones && r() < 0.6) return m.thief
    ? pick(r, ["Stone? Mere paas nahi hai, kasam se.", `Mere paas Stone nahi. ${tn} ke paas ho sakta hai.`])
    : pick(r, ["Stone mere paas hai, main gaon wala hoon — mujhe mat nikalna, isi se gaon jeetega.", "Ek Stone mere paas safe hai. Mujh pe bharosa karo."]);
  if (t && t[1].score >= 2 && t[1].why) return pick(r, [`${tn} pe shak hai mujhe — ${t[1].why}.`, `Mera vote ${tn} ko. ${cap(t[1].why)}.`, `${tn}, jawab do — ${t[1].why}?`]);
  const threat = m.pairs.find((c) => THREAT[c]) ?? (m.thief && r() < 0.25 ? "TEER_KAMAN" : undefined);
  if (threat && r() < 0.6) return THREAT[threat]!(tn);
  const vouch = m.thief ? m.sawThief : m.sawVillager;
  const clean = vouch.filter((x) => aliveSeat(m, x));
  if (clean.length) return m.known.get(clean[0])?.how === "swap" ? `${m.name(clean[0])} saaf hai — Dal Badal ne bata diya.` : `${m.name(clean[0])} saaf hai, maine Kundli dekhi hai.`;
  if (t && r() < 0.4) return `Mujhe ${tn} pe thoda shak hai… pakka nahi.`;
  return pick(r, r() < 0.5
    ? ["Main gaon wala hoon, kasam se.", "Mujh pe shak mat karo, main seedha aadmi hoon.", "Main toh bas khel raha hoon yaar."]
    : ["Abhi tak kuch pakka nahi… sab itne chup kyun ho?", "Kuch toh gadbad hai yahan.", "Jo sabse zyada chup hai, wahi chor hai.", "Soch samajh ke vote karna."]);
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
  const nm = (x: number | null) => (x === null ? "koi" : s.players[x]?.name ?? "?");
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
          ? (m.thief ? pick(r, ["Haath kuch khaas nahi aaya.", "Bekaar cards mile hain mujhe."]) : pick(r, ["Mera haath achha hai 😉", "Is baar gaon jeetega, dekhna."]))
          : pick(r, ["Chalo shuru karein. Chor log, sambhal jao!", "Sab ek doosre pe nazar rakho.", "Main sabko dekh raha hoon…"]));
        break;
      }
      // S2 bot passes
      case "pass":
        if (r() < 0.25) say(actor, pick(r, ["Kuch khaas nahi, aage badhao.", "Abhi chup rehna theek hai.", "Mera time aayega."]));
        break;
      // S3 picking up the pile — a Stone arrives
      case "pickup_private": {
        const me = Array.isArray(e.to) ? e.to[0] : null;
        if (!isBot(me) || !stonesIn(d?.cards) || r() > 0.5) break;
        say(me, side(me) === "V" ? pick(r, ["Kuch achha aaya mere paas.", "Ab mere paas kuch keemti hai."]) : pick(r, ["Bekaar pile hai yeh.", "Kuch kaam ka nahi mila."]));
        break;
      }
      // S4 the bot's own pairs
      case "faisla": {
        // the caller speaks first, then up to two more — S12
        const talkers = [actor, ...bots.filter((b) => b !== actor && living(b)).sort(() => r() - 0.5)].filter((b): b is number => isBot(b) && living(b)).slice(0, 3);
        for (const b of talkers) say(b, b === actor ? `Maine Faisla bulaya. ${debateLine(mind(b), false, r)}` : debateLine(mind(b), false, r));
        break;
      }
      // someone made a claim: the one it is aimed at answers; a villager bot may back a thief claim
      case "claim": {
        const saysThief = d?.side === "T";
        if (isBot(target) && living(target) && saysThief) {
          say(target, side(target) === "V"
            ? pick(r, ["Jhooth! Main gaon wala hoon.", `Galat, ${nm(actor)}. Main chor nahi hoon.`])
            : pick(r, [`${nm(actor)} jhooth bol raha hai — usi pe nazar rakho!`, "Mujhe fasaya ja raha hai."]));
        } else if (saysThief && r() < 0.6) {
          const b = someBot([actor, target]);
          if (b !== null && side(b) === "V") say(b, d?.kind === "kundli" ? `Kundli ki baat hai — ${nm(target)}, ab bolo?` : `Hmm, ${nm(target)} pe mujhe bhi shak hai.`);
        }
        break;
      }
      case "final_vote":
        for (const b of bots.filter(living).sort(() => r() - 0.5).slice(0, 3)) say(b, debateLine(mind(b), true, r));
        break;
      case "talashi": {
        const found = stonesIn(d?.hand) > 0;
        if (isBot(actor) && r() < 0.7) say(actor, found
          ? (side(actor) === "V" ? `${nm(target)} ke paas Stone hai! ${nm(target)}, tum gaon wale ho na?` : `${nm(target)} ke paas Stone hai — chor ke paas hi hoga!`)
          : `${nm(target)} ke haath mein kuch khaas nahi.`);
        // S6 searched
        if (isBot(target)) say(target, found
          ? (side(target) === "V" ? "Haan, Stone mere paas hai — gaon ke liye sambhal ke rakha hai." : "Haan Stone hai. Toh? Main gaon wala hoon.")
          : "Le, dekh le sab. Kuch nahi milega.");
        break;
      }
      case "hera_pheri": {
        // S5 — the private line right after says what was taken
        const nxt = events[i + 1];
        const tookStone = nxt?.type === "hera_pheri_private" && stonesIn(nxt.data?.taken) > 0;
        if (isBot(target)) say(target, tookStone
          ? (side(target) === "V" ? `${nm(actor)} ne mera Stone le liya! Woh chor hai, pakka.` : pick(r, [`Arre ${nm(actor)}! Mere cards wapas karo!`, `Yeh Hera Pheri yaad rahega, ${nm(actor)}.`]))
          : pick(r, [`Arre ${nm(actor)}! Mere cards wapas karo!`, `Yeh Hera Pheri yaad rahega, ${nm(actor)}.`, `Chor ki tarah cards uthata hai ${nm(actor)}…`]));
        if (isBot(actor) && r() < 0.5) say(actor, pick(r, [`Shukriya ${nm(target)}, cards ke liye 😏`, "Achhe cards the, thank you."]));
        break;
      }
      case "batwara":
        if (isBot(actor)) say(actor, pick(r, ["Bhukamp! Sab cards hilao!", "Thoda hila dete hain sabko."]));
        else say(someBot([actor]), pick(r, ["Arre, mere achhe cards chale gaye!", "Bhukamp… ab kaun kya pakad raha hai, kaun jaane."])); // S10
        break;
      case "maya_jaal":
        if (isBot(target)) say(target, pick(r, ["Wapas aa gaya! Ab hisaab hoga.", `Shukriya ${nm(actor)}. Ab sach saamne aayega.`])); // S9
        else if (isBot(actor)) say(actor, `${nm(target)}, wapas aao — tumhari zarurat hai.`);
        break;
      case "teer_kaman":
        if (isBot(actor)) say(actor, d?.hit ? `Bola tha na! ${nm(target)} pe shak sahi tha.` : "Chook gaya… par shak abhi bhi hai.");
        if (isBot(target) && !d?.hit) say(target, pick(r, [`Nishana chook gaya, ${nm(actor)}!`, `Mujh pe teer? ${nm(actor)}, tu khud chor hai.`])); // S8
        break;
      // S7 Kundli
      case "kundli":
        if (isBot(target) && r() < 0.7) say(target, side(target) === "V"
          ? `Dekh liya, ${nm(actor)}? Ab sabko batao main saaf hoon.`
          : `${nm(actor)} ne meri Kundli dekhi… ab jo bhi bole, jhooth hoga.`);
        else if (!isBot(actor) && r() < 0.4) say(someBot([target]), `${nm(actor)}, kya dikha ${nm(target)} ki Kundli mein? Sach bolna.`);
        break;
      case "kundli_private": {
        const reader = Array.isArray(e.to) ? e.to[0] : null;
        if (!isBot(reader) || r() > 0.8) break;
        const thiefSeen = d?.side === "T";
        if (side(reader) === "V") say(reader, thiefSeen ? `Maine ${nm(target)} ki Kundli dekhi — CHOR hai!` : `${nm(target)} ki Kundli saaf hai. Woh gaon wala hai.`);
        else say(reader, thiefSeen ? `${nm(target)} saaf hai, maine Kundli dekhi.` : r() < 0.6 ? `Maine ${nm(target)} ki Kundli dekhi — chor hai, pakka!` : null);
        break;
      }
      // S14
      case "vote_result":
        if (d?.out === null && r() < 0.5) say(someBot(), "Kisi ko nahi nikala… chor hans raha hoga.");
        break;
      // S15
      case "eliminated": {
        const villager = d?.side === "V";
        const withStone = stonesIn(d?.hand) > 0;
        say(actor, villager
          ? pick(r, ["Main gaon wala tha! Galat aadmi pakda tumne.", "Yaad rakhna — main sach bol raha tha.", withStone ? "Mera Stone sambhal ke rakhna, gaon walon." : "Asli chor abhi bhi tumhare beech hai."])
          : pick(r, ["Haan, main chor tha… par akela nahi hoon.", withStone ? "Stone le jao… par baaki chor abhi bhi hain." : "Pakad liya… par baaki abhi bhi tumhare beech hain."]));
        if (villager) {
          const ballots = [...s.events.slice(0, e.n)].reverse().find((x) => x.type === "vote_result")?.data?.ballots as Record<string, number | null> | undefined;
          const voter = ballots ? Number(Object.entries(ballots).find(([, t]) => t === actor)?.[0] ?? NaN) : NaN;
          if (!Number.isNaN(voter) && living(voter)) say(someBot([actor, voter]), `${nm(actor)} gaon wala tha! ${nm(voter)} ne usko vote kiya — yaad rakhna.`);
        } else say(someBot([actor]), pick(r, ["Ek chor gaya! Baaki bhi pakdenge.", "Shabash gaon! Ab agla chor."]));
        break;
      }
      // S16 dying powers aimed at a bot
      case "gift": if (target !== null) say(target, `Shukriya ${nm(actor)}! Is vote ka sahi istemaal karunga.`); break;
      case "dal_badal": {
        // in the shuffle: everyone claims the village, whatever card they drew
        for (const me of (d?.seats as number[]) ?? []) {
          if (!isBot(me)) continue;
          say(me, pick(r, ["Naya role mila… main ab bhi gaon ke saath hoon.", "Kuch nahi badla, sab theek hai.", "Dal Badal se darr nahi lagta. Main gaon wala hoon."]));
        }
        break;
      }
      case "last_shot": if (target !== null && !d?.hit && living(target)) say(target, "Aakhri teer bhi chook gaya. Main saaf hoon."); break;
      case "handoff": if (target !== null) say(target, stonesIn(d?.cards) && side(target) === "V" ? `Stone mil gaya! Shukriya ${nm(actor)}, sambhal ke rakhunga.` : `Itne saare cards! Dhanyavaad ${nm(actor)}.`); break;
      // S17
      case "vote_lost": if (r() < 0.6) say(actor, "Mera ek vote gaya… ab dhyaan se khelna padega."); break;
      // S18
      case "over": {
        const winners = bots.filter((b) => side(b) === d?.winner);
        const losers = bots.filter((b) => side(b) !== d?.winner);
        if (winners.length) say(winners[0], d?.winner === "V" ? "Gaon jeet gaya! Chor pakde gaye." : "Hum chor jeet gaye! Agli baar dhyaan rakhna.");
        if (losers.length) say(losers[0], d?.winner === "V" ? "Agli baar main nahi pakda jaunga…" : "Chor jeet gaye… humne galat logon ko nikala.");
        break;
      }
    }
  }
  return out;
}
