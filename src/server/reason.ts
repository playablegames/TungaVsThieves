// THE BOT RULEBOOK — docs/BOT_LOGIC.md, approved by the designer 2026-10-14 ("it should mimic real life accurately, no
// manipulation"; "it's okay if it's unbalanced"). Bots reason the way a player at the table does: facts beat words, a
// word that contradicts a fact is a lie, one voice is one point, and every move has a purpose. Nothing here is tuned
// for balance. No random noise: the only coin flip is between options that are truly equal. Every rule below is the
// same rule, in the same words, as the doc — change one, change both.
import type { ActionCard, Card, GameEvent, GameState, Side } from "@/engine/types";
import { isStone } from "@/engine/types";
import type { Action } from "@/engine/types";
import { viewFor } from "@/engine/view";
import { THIEF_ROLES, tkGuesses } from "@/engine/setup";
import { canDalBadal, canPlay, dalBadalPick, passSize } from "@/engine/engine";
import type { Skill } from "./belief";

type R = () => number;
export type Decision = { action: Action; why: string };

const num = (d: Record<string, unknown> | undefined, k: string) => (typeof d?.[k] === "number" ? (d[k] as number) : null);
const pickOne = <T,>(r: R, xs: T[]): T => xs[Math.min(xs.length - 1, Math.floor(r() * xs.length))];
const plain = (s: GameState, x: number) => s.players[x]?.name.replace(/\s*🤖/g, "") ?? `seat ${x}`;
/** the options tied at the best value of f — a coin flip only among truly equal options */
function best<T>(r: R, xs: T[], f: (x: T) => number): T | undefined {
  if (!xs.length) return undefined;
  const top = Math.max(...xs.map(f));
  return pickOne(r, xs.filter((x) => f(x) === top));
}
const sharp = (k: Skill) => k.name === "sharp";
const noticesLies = (k: Skill) => k.name !== "casual";

// ------------------------------------------------------------------ 1–2. FACTS, WORDS, THE SCORE
export interface Ledger {
  known: Map<number, { side: Side; role?: string; why: string }>;
  /** roles a Teer Kaman miss ruled out, by seat */
  ruledOut: Map<number, Set<string>>;
  score: Map<number, number>;
  why: Map<number, string[]>;
  liars: Set<number>;
  /** how many players called each seat a thief (latest word per speaker) */
  accused: Map<number, number>;
  /** how much was said about each seat (any claim) */
  talk: Map<number, number>;
}

/** the latest word of each speaker about each seat (a newer word replaces the older one — designer 2026-10-12);
 *  a whisper to `me` counts as a word said to me */
function latestClaims(events: GameEvent[], me: number | null = null): GameEvent[] {
  const last = new Map<string, GameEvent>();
  for (const e0 of events) {
    const e = e0.type === "whisper_private" && me !== null && num(e0.data, "to") === me && e0.data?.side ? { ...e0, type: "claim" }
      // an accused player's answer "X is lying" is an accusation back (designer's Defend, 2026-10-14)
      : e0.type === "defend" && e0.data?.kind === "liar" ? { ...e0, type: "claim", data: { ...e0.data, side: "T", kind: "accuse", role: null } } : e0;
    if (e.type !== "claim" || e.data?.kind === "stone") continue;
    const a = num(e.data, "seat"), t = num(e.data, "target");
    if (a === null || t === null || a === t) continue;
    last.set(`${a}:${t}`, e);
  }
  return [...last.values()];
}

/** (designer 2026-10-14, bot talk) each player's latest word about THEIR OWN role that `me` heard: in the table chat
 *  (or a bot's public claim), or privately to me */
export function selfClaims(events: GameEvent[], me: number): { seat: number; role: string; side: Side; toMe: boolean; n: number }[] {
  const last = new Map<number, { seat: number; role: string; side: Side; toMe: boolean; n: number }>();
  for (const e of events) {
    const d = e.data;
    if (d?.kind !== "self" || typeof d.role !== "string") continue;
    const seat = num(d, "seat");
    if (seat === null) continue;
    const toMe = e.type === "whisper_private" ? num(d, "to") === me : e.to !== "all" && !d.public;
    if (e.type === "whisper_private" && !toMe && seat !== me) continue;
    if (e.type !== "claim" && e.type !== "whisper_private") continue;
    if (Array.isArray(e.to) && !e.to.includes(me)) continue;
    const was = last.get(seat);
    // the same story again keeps its first moment (who claimed a role FIRST matters below)
    last.set(seat, { seat, role: d.role, side: (d.side as Side) ?? (THIEF_ROLES.includes(d.role) ? "T" : "V"), toMe: toMe || Boolean(was?.toMe), n: was?.role === d.role ? was.n : e.n });
  }
  return [...last.values()];
}

/** THIEF SKILLS (designer 2026-10-14: "can't we model thief skills into the game to make the balance better?") — each
 *  on its own switch until the designer picks (BOT_FLAGS="tskill=B,C,D" in a simulation; the live game uses LIVE_TSKILLS):
 *    B  an AVERAGE thief defends like a villager when accused (only a beginner blames — the tell)
 *    C  SPLIT THE VOTE: a known partner leads the ballot → vote the leading non-partner (an honest-looking disagreement)
 *    D  STEER THE MANDATORY VOTE at a villager believed to hold a Stone (voted out, their Stone goes to the thieves)
 *    E  BELIEVED PARTNER BY EVIDENCE: a player with a strong case (2+) is most likely my partner — protected like one */
export const LIVE_TSKILLS: string[] = [];
export const tskill = (k: string): boolean => {
  const m = typeof process !== "undefined" ? /tskill=([A-Z,]+)/.exec(process.env.BOT_FLAGS ?? "") : null;
  return (m ? m[1].split(",") : LIVE_TSKILLS).includes(k);
};

/** measured 2026-10-14 (scripts/_counterclaims.mts, 16,000 games): the share of counterclaims where the FIRST claimer lied */
export const FIRST_CLAIMER_LIES = 0.641;

export function ledger(s: GameState, seat: number, skill: Skill): Ledger {
  const v = viewFor(s, seat);
  const name = (x: number) => plain(s, x);
  const known: Ledger["known"] = new Map();
  const ruledOut: Ledger["ruledOut"] = new Map();
  const shuffled = new Map<number, string>();
  for (const e of v.events) {
    if (Array.isArray(e.to) && !e.to.includes(seat)) continue;
    const d = e.data, actor = num(d, "seat"), target = num(d, "target");
    switch (e.type) {
      case "kundli_private":
        if (target !== null) known.set(target, { side: d?.side as Side, role: String(d?.role), why: `I read ${name(target)}: ${String(d?.role)}` });
        break;
      case "eliminated_private":
        if (actor !== null) known.set(actor, { side: d?.side as Side, role: String(d?.role), why: `I put ${name(actor)} out: ${String(d?.role)}` });
        break;
      case "eliminated":
        if (actor !== null && d?.side) known.set(actor, { side: d.side as Side, role: String(d.role), why: `${name(actor)} was shown: ${String(d.role)}` });
        break;
      case "teer_kaman":
        if (target !== null && d?.hit === false) {
          const set = ruledOut.get(target) ?? new Set<string>();
          for (const x of (d?.roles as string[]) ?? []) set.add(x);
          ruledOut.set(target, set);
        }
        break;
      case "dal_badal":
        // the thief card went into a shuffle: every fact about those seats is gone
        for (const x of (d?.seats as number[]) ?? []) { known.delete(x); ruledOut.delete(x); shuffled.set(x, name(actor ?? x)); }
        break;
    }
  }
  known.set(seat, { side: v.me.side, role: v.me.role, why: "me" });

  // sharp: every thief accounted for → everyone else is a villager
  if (sharp(skill)) {
    const K = v.rolesInPlay.filter((x) => THIEF_ROLES.includes(x)).length;
    const found = [...known.values()].filter((k) => k.side === "T").length;
    if (found >= K) for (const p of v.players) if (!known.has(p.seat)) known.set(p.seat, { side: "V", why: "every thief is accounted for" });
  }

  const claims = latestClaims(v.events, seat);
  // a word that contradicts a fact I hold is a lie
  const liars = new Set<number>();
  if (noticesLies(skill)) for (const e of claims) {
    const a = num(e.data, "seat")!, t = num(e.data, "target")!;
    if (a === seat) continue;
    const k = known.get(t), role = typeof e.data?.role === "string" ? e.data.role : null;
    const elsewhere = role !== null && [...known].some(([x, kk]) => x !== t && kk.role === role);
    if ((k && e.data?.side && k.side !== e.data.side) || (k?.role && role && k.role !== role) || (role && ruledOut.get(t)?.has(role)) || elsewhere) liars.add(a);
  }

  // WORDS ABOUT THEMSELVES (designer 2026-10-14, bot talk): "I'm Kisaan" — said to the table, or privately to me. Every
  // role card is different, so a claim is checkable: my own role, a role I know is someone else's, a read that says
  // otherwise, a role ruled out by a miss — a lie. Anyone (casual too) knows their OWN role.
  const selfs = selfClaims(v.events, seat);
  const selfLie = new Map<number, string>();
  for (const c of selfs) {
    if (c.seat === seat) continue;
    const k = known.get(c.seat);
    const elsewhere = [...known].find(([x, kk]) => x !== c.seat && kk.role === c.role);
    if (c.role === v.me.role) selfLie.set(c.seat, `says they're ${c.role} — that's me`);
    else if (noticesLies(skill) && ((k?.role && k.role !== c.role) || (k && k.side !== c.side) || ruledOut.get(c.seat)?.has(c.role) || elsewhere))
      selfLie.set(c.seat, `says they're ${c.role} — ${elsewhere ? `${name(elsewhere[0])} is` : "not true"}`);
  }
  for (const a of selfLie.keys()) liars.add(a);

  const score = new Map<number, number>(), why = new Map<number, string[]>(), accused = new Map<number, number>(), talk = new Map<number, number>();
  const add = (x: number, pts: number, reason: string) => {
    if (x === seat || !score.has(x)) return;
    score.set(x, score.get(x)! + pts);
    why.get(x)!.push(`${pts > 0 ? "+" : ""}${pts} ${reason}`);
  };
  for (const p of v.players) if (p.seat !== seat) { score.set(p.seat, 0); why.set(p.seat, []); }
  for (const e of claims) {
    const a = num(e.data, "seat")!, t = num(e.data, "target")!;
    const side = e.data?.side as Side | undefined;
    talk.set(t, (talk.get(t) ?? 0) + 1);
    if (side === "T") accused.set(t, (accused.get(t) ?? 0) + 1);
    if (a === seat) continue; // my own words are not evidence to me
    if (t === seat) {
      // (real games 2026-10-14: bots hunted honest villagers who merely suspected them) a ROLE named for me that's wrong
      // is a certain lie; a plain suspicion of me is only a wrong guess — it counts like any accusation
      if (side === "T" && v.me.side === "V") {
        // "X told me they're Chor" about me, after I posed as a thief to them (a double agent) — I know why they said it
        const posed = e.data?.kind === "told" && v.events.some((w) => w.type === "whisper_private" && w.data?.handshake === true && w.data?.seat === seat && w.data?.to === a);
        if (posed) add(a, 1, "repeated what I told them as a double agent");
        else if (typeof e.data?.role === "string") { add(a, 3, `said I'm ${String(e.data.role)} — a lie, I'm a villager`); liars.add(a); }
        else add(a, 1, "suspects me — wrong, I'm a villager");
      } else if (side === "T") add(a, 1, "suspects me"); // (2026-10-14) a thief weighs its accuser as a villager would
      continue;
    }
    if (liars.has(a)) continue;
    // a KNOWN thief's word points the other way: whom it accuses is likely a villager, whom it vouches for a partner
    if (known.get(a)?.side === "T" && v.me.side === "V") {
      if (side === "T") add(t, -1, `accused by ${name(a)}, a known thief`);
      else if (side === "V") add(t, 1, `vouched for by ${name(a)}, a known thief`);
      continue;
    }
    // a word that names a ROLE ("I read X: Chor", "X told me they're Lootera") is an eyewitness's word: 1.5; a plain
    // "I suspect X": 1
    const seen = typeof e.data?.role === "string" ? 1.5 : 1;
    if (side === "T") add(t, seen, `${name(a)} called them ${typeof e.data?.role === "string" ? String(e.data.role) : "a thief"}`);
    else if (side === "V") add(t, -seen, `${name(a)} called them ${typeof e.data?.role === "string" ? String(e.data.role) : "a villager"}`);
  }
  // what the table SAW: a known thief's dying vote goes to a partner; a Teer Kaman that hit a thief was a villager's shot
  for (const e of v.events) {
    if (e.type === "gift") {
      const a = num(e.data, "seat"), t = num(e.data, "target");
      if (a !== null && t !== null && known.get(a)?.side === "T" && v.me.side === "V") add(t, 2, `got the dying vote of ${name(a)}, a known thief`);
    }
    if (e.type === "teer_kaman" && e.data?.hit === true) {
      const a = num(e.data, "seat"), t = num(e.data, "target");
      if (a !== null && t !== null && known.get(t)?.side) add(a, known.get(t)!.side === "T" ? -2 : 2, `shot ${name(t)}, ${known.get(t)!.side === "T" ? "a thief" : "a villager"}`);
    }
  }
  // a speaker proven RIGHT about someone is more believable (average and sharp keep that record)
  if (noticesLies(skill)) for (const e of claims) {
    const a = num(e.data, "seat")!, t = num(e.data, "target")!;
    if (a === seat || t === seat || liars.has(a) || !known.get(t)) continue;
    if (e.data?.side === known.get(t)!.side && known.get(a)?.side !== "T") add(a, -1, `was right about ${name(t)}`);
  }
  for (const a of liars) add(a, 2, "caught lying");
  // A CHANGED STORY (designer 2026-10-14): "I said X to stay safe — I'm really Y". The new story is what counts from now
  // on (selfClaims keeps the latest), checked against everything like any other — the change itself costs a little
  for (const e of v.events) {
    const a = num(e.data, "seat");
    if (e.type === "claim" && e.to === "all" && e.data?.kind === "self" && typeof e.data?.retract === "string" && a !== null && a !== seat)
      add(a, 0.5, `changed their story: ${String(e.data.retract)} → ${String(e.data.role)}`);
  }
  // THE BLAME TELL (designer 2026-10-14): accused out loud, and the answer was to blame the accuser back — without a
  // word in their own defence. Cornered thieves blame; villagers defend. Average and sharp bots notice it.
  if (noticesLies(skill)) for (const e of v.events) {
    if (e.type !== "claim" || e.to !== "all" || e.data?.side !== "T" || e.data?.kind === "stone") continue;
    const a = num(e.data, "seat"), b = num(e.data, "target");
    if (a === null || b === null || a === b || b === seat || e.data?.answer) continue;
    const later = v.events.filter((c) => c.n > e.n && c.data?.seat === b);
    const blamed = later.some((c) => c.type === "claim" && c.data?.target === a && c.data?.side === "T");
    const defended = later.some((c) => (c.type === "claim" && c.data?.kind === "self") || c.type === "defend");
    if (blamed && !defended) add(b, 1, `blamed ${name(a)} back instead of defending`);
  }
  for (const [a, w] of selfLie) add(a, 1, w);
  // a COUNTERCLAIM: two players say they're the same role — one of them is lying (who, more often: FIRST_CLAIMER_LIES)
  const byRole = new Map<string, { seat: number; n: number }[]>();
  for (const c of selfs) if (c.seat !== seat && !selfLie.has(c.seat) && c.side === "V") byRole.set(c.role, [...(byRole.get(c.role) ?? []), { seat: c.seat, n: c.n }]);
  for (const [role, xs] of byRole) if (xs.length >= 2) {
    // WHO LIES IN A COUNTERCLAIM — measured, not guessed (designer 2026-10-14: "do whatever the data says"): 16,000 bot
    // games, 72,179 contested roles, the FIRST claimer lied 64.1% of the time (a cover story told early; the real owner
    // corrects it later). One of the two lies: 1.5 points of suspicion split by that share
    const firstIn = [...xs].sort((a, b) => a.n - b.n)[0].seat;
    for (const x of xs) add(x.seat, x.seat === firstIn ? +(1.5 * FIRST_CLAIMER_LIES).toFixed(2) : +(1.5 * (1 - FIRST_CLAIMER_LIES)).toFixed(2),
      x.seat === firstIn ? `claimed ${role} first — ${xs.filter((y) => y.seat !== x.seat).map((y) => name(y.seat)).join(", ")} says the same` : `claimed ${role} after ${name(firstIn)}`);
  }
  // the open table, cross-checked: "Y is Teacher" (said by A) and "I'm Teacher" (said by Z) can't both be true — A or Z lies
  for (const e of claims) {
    const a = num(e.data, "seat")!, t = num(e.data, "target")!, role = typeof e.data?.role === "string" ? e.data.role : null;
    if (!role || a === seat || e.data?.side !== "V") continue;
    const z = selfs.find((c) => c.role === role && c.seat !== t && c.seat !== seat && !selfLie.has(c.seat));
    if (z && z.seat !== a) { add(a, 1, `says ${name(t)} is ${role}, but ${name(z.seat)} claims it`); add(z.seat, 1, `claims ${role}, but ${name(a)} says ${name(t)} is`); }
  }
  for (const c of selfs) {
    if (c.seat === seat || selfLie.has(c.seat)) continue;
    // owning up to a thief role is a strange thing to say — a joke, or the truth
    // "I'm also Chor" said to ME (the handshake): to a villager, the speaker has as good as owned up (+3 — a sharp
    // villager may be posing, so not a fact). Said to the table: a strange thing to say (+1)
    if (c.side === "T") { if (v.me.side === "V") add(c.seat, c.toMe ? 3 : 1, c.toMe ? `told me they're ${c.role}` : `says they're ${c.role}`); }
    // told ME their role privately: a small bond (a thief may use it — so do people)
    else if (c.toMe && (byRole.get(c.role)?.length ?? 0) < 2) add(c.seat, -0.5, `told me they're ${c.role}`);
  }
  // sharp: a Kundli, and then silence — a villager who saw something says it
  if (sharp(skill)) {
    const debates = v.events.filter((e) => e.type === "ballots_open").map((e) => e.n);
    for (const e of v.events) if (e.type === "kundli") {
      const a = num(e.data, "seat"), b = num(e.data, "target");
      if (a === null || b === null || !debates.some((n) => n > e.n)) continue;
      for (const [x, y] of [[a, b], [b, a]] as const) {
        if (x === seat || !v.players[x]?.alive) continue;
        const spoke = v.events.some((c) => c.n > e.n && c.type === "claim" && num(c.data, "seat") === x && num(c.data, "target") === y);
        if (!spoke) add(x, 1, `read ${name(y)} and said nothing`);
      }
    }
  }
  for (const [x, who] of shuffled) if (!known.has(x)) add(x, 1, `in ${who}'s Dal Badal shuffle`);
  return { known, ruledOut, score, why, liars, accused, talk };
}

/** WHO MY PARTNERS ARE (a thief): known (a Kundli read either way, a role shown) — or BELIEVED, after a handshake
 *  (designer 2026-10-14): a player I took at their word ("I'm also Chor") or who took me at mine */
export function partnersOf(s: GameState, seat: number, skill: Skill | null): Set<number> {
  const out = new Set<number>();
  if (s.players[seat]?.side !== "T") return out;
  const l = skill ? ledger(s, seat, skill) : null;
  if (l) for (const [x, k] of l.known) if (x !== seat && k.side === "T") out.add(x);
  // E (thief skill switch) · BELIEVED BY EVIDENCE: "unless he found his teammate or BELIEVES he's his teammate" — a
  // player my own reasoning gives a strong case of being a thief (2+, not a known villager) is most likely my partner
  if (l && tskill("E")) for (const [x, v] of l.score) if (v >= 2 && x !== seat && s.players[x]?.alive && l.known.get(x)?.side !== "V") out.add(x);
  for (const e of s.events) {
    if (e.type !== "whisper_private" || e.data?.believe !== true) continue;
    const a = e.data.seat as number, b = e.data.to as number;
    if (a === seat) out.add(b);
    else if (b === seat) out.add(a);
  }
  return out;
}

export function reasonFor(l: Ledger, x: number): string {
  const k = l.known.get(x);
  if (k) return k.why;
  const w = l.why.get(x) ?? [];
  return `${l.score.get(x) ?? 0} (${w.join(", ") || "nothing said"})`;
}

// ------------------------------------------------------------------ 5. WHERE THE STONES ARE
/** for each Stone, the seats it may be with now (a sighting holds until a newer one replaces it); empty = no idea */
export function stoneMemory(s: GameState, seat: number, skill: Skill, l: Ledger = ledger(s, seat, skill)): Map<Card, Set<number>> {
  const v = viewFor(s, seat);
  const n = s.players.length;
  const aliveAt = new Set(s.players.map((p) => p.seat));
  const nextAlive = (x: number) => { for (let k = 1; k < n; k++) { const y = (x + k) % n; if (aliveAt.has(y)) return y; } return x; };
  const prevAlive = (x: number) => { for (let k = 1; k < n; k++) { const y = (x - k + n) % n; if (aliveAt.has(y)) return y; } return x; };
  const at = new Map<Card, Set<number>>([["STONE_1", new Set()], ["STONE_2", new Set()]]);
  const put = (c: Card, x: number) => at.set(c, new Set([x]));
  const moveFrom = (x: number, to: number) => { for (const [c, set] of at) if (set.size === 1 && set.has(x)) at.set(c, new Set([to])); };
  let hp: { seat: number; target: number } | null = null;
  let played: { x: number; stones: Card[] } | null = null;
  // THE QUIET STONE TELL (designer 2026-10-14, sharp only): turns in a row a player passed without playing a pair
  const quiet = new Map<number, number>();
  for (const e of v.events) {
    if (Array.isArray(e.to) && !e.to.includes(seat)) continue;
    const d = e.data;
    if (e.type === "pass") quiet.set(num(d, "seat")!, (quiet.get(num(d, "seat")!) ?? 0) + 1);
    if (e.type === "play" || (e.type === "dal_badal" && d?.when === "turn")) quiet.set(num(d, "seat")!, 0);
    switch (e.type) {
      case "pickup_private": for (const c of (d?.cards as Card[]) ?? []) if (isStone(c)) put(c, seat); break;
      case "talashi_private": {
        const t = num(d, "target")!;
        const hand = (d?.hand as Card[]) ?? [];
        for (const c of ["STONE_1", "STONE_2"] as Card[]) if (hand.includes(c)) put(c, t); else at.get(c)!.delete(t);
        if (!hand.some(isStone)) quiet.set(t, 0); // I saw their hand: no Stone there
        break;
      }
      case "hera_pheri": hp = { seat: num(d, "seat")!, target: num(d, "target")! }; break;
      case "hera_pheri_private": if (hp) for (const c of (d?.taken as Card[]) ?? []) if (isStone(c)) put(c, hp.seat); break;
      case "batwara":
        // everyone passes both cards: a Stone seen with X is now with one of X's neighbours (unless I see the pass)
        for (const [c, set] of at) if (set.size === 1) { const x = [...set][0]; if (x !== seat) at.set(c, new Set([nextAlive(x), prevAlive(x)])); }
        break;
      case "batwara_private": { const c = d?.card as Card; if (isStone(c)) put(c, num(d, "to")!); break; }
      case "handoff_private": for (const c of (d?.cards as Card[]) ?? []) if (isStone(c)) put(c, num(d, "target")!); break;
      case "to_village": for (const c of (d?.cards as Card[]) ?? []) if (isStone(c)) at.set(c, new Set()); break;
      // (2026-10-14 play, then pass) a pair played: the cards held then go on once the effect is over — a Stone too.
      // Cards won from an out player arrive after the pass and stay.
      case "play": { const x = num(d, "seat"); played = x !== null ? { x, stones: [...at].filter(([, set]) => set.size === 1 && set.has(x)).map(([c]) => c) } : null; break; }
      case "pass_after": {
        const x = num(d, "seat");
        if (played && played.x === x && x !== seat && !d?.out) for (const c of played.stones) if (at.get(c)!.size === 1 && at.get(c)!.has(x)) at.set(c, new Set([nextAlive(x)]));
        played = null;
        break;
      }
      case "eliminated": {
        const x = num(d, "seat")!, k = num(d, "killer");
        aliveAt.delete(x);
        moveFrom(x, k ?? nextAlive(x));
        break;
      }
      case "whisper_private":
        // a friend told me privately where a Stone went
        if (d?.kind === "stone" && num(d, "to") === seat && (d?.stone === "STONE_1" || d?.stone === "STONE_2")) {
          const a = num(d, "seat")!;
          if (!l.liars.has(a) && !(l.known.get(a)?.side === "T" && v.me.side === "V")) put(d.stone as Card, num(d, "target")!);
        }
        break;
      case "claim":
        // "X has a Stone" from someone I don't take for a liar (a casual bot believes every word)
        if (d?.kind === "stone" && d?.has === true) {
          const a = num(d, "seat")!, t = num(d, "target")!;
          if (a === seat || l.liars.has(a) || (l.known.get(a)?.side === "T" && v.me.side === "V")) break;
          const named = d?.stone === "STONE_1" || d?.stone === "STONE_2" ? (d.stone as Card) : null;
          if (named) { put(named, t); break; }
          if ([...at.values()].some((set) => set.size === 1 && set.has(t))) break;
          const free = [...at].find(([, set]) => set.size !== 1);
          if (free) put(free[0], t);
        }
        break;
    }
  }
  // sharp: a Stone I have no idea about is probably with whoever has passed their last 3 turns — people sit on a Stone
  if (sharp(skill)) {
    const sitters = [...quiet].filter(([x, k]) => k >= 3 && x !== seat && aliveAt.has(x)).map(([x]) => x);
    const placed = new Set([...at.values()].filter((set) => set.size === 1).flatMap((set) => [...set]));
    const open = sitters.filter((x) => !placed.has(x));
    if (open.length) for (const [c, set] of at) if (set.size === 0 && !v.me.hand.includes(c)) at.set(c, new Set(open));
  }
  // my own hand is the last word
  for (const c of ["STONE_1", "STONE_2"] as Card[]) {
    if (v.me.hand.includes(c)) put(c, seat);
    else if (at.get(c)!.size === 1 && at.get(c)!.has(seat)) put(c, nextAlive(seat));
  }
  return at;
}

/** how sure this bot is that x holds a Stone: 1 = seen there, ½ = one of two places, 0 = no reason to think so */
export function holds(mem: Map<Card, Set<number>>, x: number): number {
  let p = 0;
  for (const set of mem.values()) if (set.has(x)) p += 1 / set.size;
  return Math.min(1, p);
}

// ------------------------------------------------------------------ 4. VOTING
export function ruleVote(s: GameState, seat: number, skill: Skill, r: R): { target: number | null; why: string } {
  const l = ledger(s, seat, skill);
  const ph = s.phase;
  const final = ph.kind === "vote" && ph.reason === "final";
  const mem = final ? stoneMemory(s, seat, skill, l) : null;
  const stone = (x: number) => (mem ? holds(mem, x) : 0);
  const alive = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat);
  if (!alive.length) return { target: null, why: "nobody to vote" };
  const sc = (x: number) => l.score.get(x) ?? 0;
  // (designer 2026-10-14) A THIEF VOTES EXACTLY LIKE A VILLAGER — its partners (known or believed) stand where a
  // villager's known villagers stand, and it knows no "thief" to vote for
  const thief = s.players[seat].side === "T";
  const partners = thief ? partnersOf(s, seat, skill) : new Set<number>();
  {
    const sure = thief ? [] : alive.filter((x) => l.known.get(x)?.side === "T");
    if (sure.length) { const t = best(r, sure, stone)!; return { target: t, why: l.known.get(t)!.why }; }
    let pool = alive.filter((x) => (thief ? !partners.has(x) : l.known.get(x)?.side !== "V"));
    if (!pool.length) return { target: null, why: "everyone left is a known villager" };
    if (thief) {
      const tally = new Map<number, number>();
      if (ph.kind === "vote") for (const [vtr, b] of Object.entries(ph.ballots)) if (b !== null && b !== undefined && Number(vtr) !== seat) tally.set(b, (tally.get(b) ?? 0) + (s.players[Number(vtr)]?.votes ?? 1));
      const lead = Math.max(0, ...tally.values());
      // C · SPLIT THE VOTE: my partner leads the ballot — I back the leading non-partner, so it ties or tips away
      if (tskill("C") && lead > 0 && [...partners].some((x) => (tally.get(x) ?? 0) === lead)) {
        const t = best(r, pool, (x) => (tally.get(x) ?? 0) * 100 + sc(x))!;
        return { target: t, why: `thief: my partner leads the vote — I back ${plain(s, t)} instead` };
      }
      // D · STEER THE MANDATORY VOTE: a villager believed to hold a Stone — voted out, their Stone comes to us
      if (tskill("D") && final) {
        const holders = pool.filter((x) => stone(x) >= 0.5);
        if (holders.length) { const t = best(r, holders, (x) => stone(x) * 10 + sc(x))!; return { target: t, why: `thief: ${plain(s, t)} holds a Stone — voted out, it comes to us` }; }
      }
    }
    // the mandatory vote is about the Stones: a Stone holder I have a case against (1+) goes first — if they're a thief
    // that Stone comes to the village; one I have nothing against stays (its Stone would go to the thieves)
    const val = (x: number) => sc(x) + (final && stone(x) >= 0.5 && sc(x) >= 1 ? 1 : 0);
    if (final) { const safe = pool.filter((x) => stone(x) < 0.5 || sc(x) >= 1); if (safe.length) pool = safe; }
    const top = Math.max(...pool.map(val));
    const leaders = pool.filter((x) => val(x) === top);
    if (!final) {
      if (top <= 0) return { target: null, why: "no case against anyone" };
      // (real games 2026-10-14: bots sat out half the Faisla ballots on ties, and the thieves' ballots decided) a tie
      // with a case goes to the ballot the table is gathering on, then the most accused
      if (leaders.length > 1) {
        const tallyF = new Map<number, number>();
        if (ph.kind === "vote") for (const [vtr, b] of Object.entries(ph.ballots)) if (b !== null && b !== undefined && Number(vtr) !== seat) tallyF.set(b, (tallyF.get(b) ?? 0) + 1);
        const t = best(r, leaders, (x) => (tallyF.get(x) ?? 0) * 100 + (l.accused.get(x) ?? 0))!;
        return { target: t, why: `${reasonFor(l, t)} — tie: with the table's ballot` };
      }
      return { target: leaders[0], why: reasonFor(l, leaders[0]) };
    }
    // a tie: go with the ballot the table is already gathering on, then the most accused — a split vote puts nobody out
    const tally = new Map<number, number>();
    if (ph.kind === "vote") for (const [vtr, b] of Object.entries(ph.ballots)) if (b !== null && b !== undefined && Number(vtr) !== seat) tally.set(b, (tally.get(b) ?? 0) + 1);
    const t = best(r, leaders, (x) => (tally.get(x) ?? 0) * 100 + (l.accused.get(x) ?? 0))!;
    return { target: t, why: `${reasonFor(l, t)}${final && stone(t) >= 0.5 ? " + holds a Stone" : ""}${leaders.length > 1 ? " — tie: with the table's ballot" : ""}` };
  }
}

/** the clock is ending on a tie: move to the tied leader the rulebook wants out, or stay */
export function ruleTieBreak(s: GameState, seat: number, skill: Skill, leaders: number[], current: number | null | undefined): number | null {
  const l = ledger(s, seat, skill);
  const thief = s.players[seat].side === "T";
  const partners = thief ? partnersOf(s, seat, skill) : new Set<number>();
  const ok = leaders.filter((x) => (thief ? !partners.has(x) : l.known.get(x)?.side !== "V"));
  const sure = thief ? [] : ok.filter((x) => l.known.get(x)?.side === "T");
  const pick = sure[0] ?? [...ok].sort((x, y) => (l.score.get(y) ?? 0) - (l.score.get(x) ?? 0))[0];
  return pick === undefined || current === pick ? null : pick;
}

// ------------------------------------------------------------------ 3. TALKING
export type RuleClaim = { kind: "kundli" | "accuse" | "was"; target: number; role: string | null; side: Side; why: string };

export function ruleClaim(s: GameState, seat: number, skill: Skill): RuleClaim | null {
  const me = s.players[seat];
  if (!me.alive) return null;
  const v = viewFor(s, seat);
  const l = ledger(s, seat, skill);
  const said = new Set(v.events.filter((e) => e.type === "claim" && e.data?.seat === seat).map((e) => num(e.data, "target")));
  const fresh = (t: number) => !said.has(t);
  const mine = (type: string) => v.events.filter((e) => e.type === type && Array.isArray(e.to) && e.to.includes(seat));
  const outs = mine("eliminated_private").map((e) => ({ target: num(e.data, "seat")!, role: String(e.data?.role), side: e.data?.side as Side }));
  const reads = mine("kundli_private").map((e) => ({ target: num(e.data, "target")!, role: String(e.data?.role), side: e.data?.side as Side }))
    .filter((k) => l.known.get(k.target)?.role === k.role); // a Dal Badal since then wiped it
  const alive = (x: number) => Boolean(s.players[x]?.alive);
  const name = (x: number) => plain(s, x);
  const accusers = latestClaims(v.events, seat).filter((e) => num(e.data, "target") === seat && e.data?.side === "T").map((e) => num(e.data, "seat")!);

  // (designer 2026-10-14) A THIEF TALKS EXACTLY LIKE A VILLAGER: it says what it saw — except about a partner (known or
  // believed), whom it covers with a village role — and never accuses a partner
  const partners = me.side === "T" ? partnersOf(s, seat, skill) : new Set<number>();
  const cover = (x: number) => fittingRole(l, rolesBut(s, me.role).villageRoles, x, s.events);
  for (const o of outs) if (fresh(o.target)) return { kind: "was", ...o, why: `I put ${name(o.target)} out and saw ${o.role}` };
  for (const k of [...reads].sort((a, b) => (a.side === "T" ? 0 : 1) - (b.side === "T" ? 0 : 1))) {
    if (!fresh(k.target) || !alive(k.target)) continue;
    if (partners.has(k.target)) return { kind: "kundli", target: k.target, role: cover(k.target), side: "V", why: `cover ${name(k.target)}, a partner I read` };
    return { kind: "kundli", ...k, why: `I read ${name(k.target)}` };
  }
  // accused: answer by naming the accuser
  for (const a of accusers) if (fresh(a) && alive(a) && !partners.has(a)) return { kind: "accuse", target: a, role: null, side: "T", why: `${name(a)} called me a thief` };
  const pool = s.players.filter((p) => p.alive && p.seat !== seat && !partners.has(p.seat) && !(me.side === "V" && l.known.get(p.seat)?.side === "V")).map((p) => p.seat);
  const top = Math.max(-Infinity, ...pool.map((x) => l.score.get(x) ?? 0));
  const leaders = pool.filter((x) => (l.score.get(x) ?? 0) === top);
  if (top >= 2 && leaders.length === 1 && fresh(leaders[0])) return { kind: "accuse", target: leaders[0], role: null, side: "T", why: reasonFor(l, leaders[0]) };
  return null;
}

/** a role for a lie, chosen the way a careful liar would, from the roles dealt in this game only: never one ruled out
 *  for that player, never one known to be someone else's, and — to keep the story straight — a role nobody has been
 *  called yet before one the table already pinned on someone else (designer 2026-10-14: "no inventing roles") */
function fittingRole(l: Ledger, pool: string[], t: number, events: GameEvent[]): string | null {
  const taken = new Set([...l.known].filter(([x, k]) => x !== t && k.role).map(([, k]) => k.role!));
  const claimed = new Set(latestClaims(events).filter((e) => num(e.data, "target") !== t && typeof e.data?.role === "string").map((e) => String(e.data!.role)));
  const ok = pool.filter((x) => !l.ruledOut.get(t)?.has(x));
  return ok.find((x) => !taken.has(x) && !claimed.has(x)) ?? ok.find((x) => !taken.has(x)) ?? ok[0] ?? null;
}
const rolesBut = (s: GameState, own: string) => ({
  thiefRoles: s.rolesInPlay.filter((x) => THIEF_ROLES.includes(x) && x !== own),
  villageRoles: s.rolesInPlay.filter((x) => !THIEF_ROLES.includes(x) && x !== own),
});

/** THE MOMENT A BOT SEES A ROLE (its Kundli read either way, a player it put out) it marks it for the table: a villager
 *  says the truth, always; a thief says the lie that fits (a villager → a thief role, a partner → a village role) — a
 *  casual thief sometimes says nothing. */
export function wordAboutRole(s: GameState, seat: number, skill: Skill, r: R, target: number, role: string, side: Side): { role: string | null; side: Side } | null {
  const me = s.players[seat];
  if (me.side === "V") return { role, side };
  if (skill.name === "casual" && r() >= skill.lie) return null;
  const l = ledger(s, seat, skill);
  const { thiefRoles, villageRoles } = rolesBut(s, me.role);
  return side === "V" ? { role: fittingRole(l, thiefRoles, target, s.events), side: "T" } : { role: fittingRole(l, villageRoles, target, s.events), side: "V" };
}

/** THE MOMENT A BOT SEARCHES A HAND: a villager says what it saw, always; a thief says "no Stone" either way (it wants
 *  to take the Stone it found); a casual thief just says what it saw. */
export function wordAboutSearch(s: GameState, seat: number, skill: Skill, found: boolean): boolean {
  if (s.players[seat].side === "V" || skill.name === "casual") return found;
  return false;
}

// ------------------------------------------------------------------ 6. YOUR TURN
/** what to keep when cards must go: a Stone first, then Dal Badal, then cards that could make a pair */
function keepRank(hand: Card[], c: Card): number {
  if (isStone(c)) return 100;
  if (c === "DAL_BADAL") return 50;
  return hand.filter((x) => x === c).length >= 2 ? 20 : 10;
}
export function passCards(hand: Card[], k: number): Card[] {
  return [...hand].sort((a, b) => keepRank(hand, a) - keepRank(hand, b)).slice(0, k);
}
function withoutPair(hand: Card[], card: Card): Card[] {
  const rest = [...hand];
  rest.splice(rest.indexOf(card), 1); rest.splice(rest.indexOf(card), 1);
  return rest;
}

/** the roles a Teer Kaman names: the one I know or the table named for them (never a ruled-out one), then the other
 *  team's remaining roles in printed order */
function tkRoles(s: GameState, seat: number, l: Ledger, target: number, first: string | null, theirSide?: Side): string[] {
  const mySide = s.players[seat].side;
  // (designer 2026-10-14) Teer Kaman may name ANY role: the roles of the side I believe the target is on
  const side = theirSide ?? (mySide === "V" ? "T" : "V");
  const other = s.rolesInPlay.filter((x) => THIEF_ROLES.includes(x) === (side === "T") && x !== s.players[seat].role);
  const out = l.ruledOut.get(target) ?? new Set<string>();
  const elsewhere = new Set([...l.known].filter(([x, k]) => x !== target && k.role).map(([, k]) => k.role!));
  const named = latestClaims(s.events).filter((e) => num(e.data, "target") === target && typeof e.data?.role === "string").map((e) => String(e.data!.role)).reverse();
  const order = [...(first ? [first] : []), ...named, ...other].filter((x, i, a) => other.includes(x) && !out.has(x) && !elsewhere.has(x) && a.indexOf(x) === i);
  const fill = other.filter((x) => !order.includes(x));
  return [...order, ...fill].slice(0, tkGuesses(s.rolesInPlay));
}

export function ruleTurn(s: GameState, seat: number, skill: Skill, r: R): Decision {
  const me = s.players[seat];
  const hand = me.hand;
  const l = ledger(s, seat, skill);
  const mem = stoneMemory(s, seat, skill, l);
  const thief = me.side === "T";
  const others = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat);
  const sc = (x: number) => l.score.get(x) ?? 0;
  // (designer 2026-10-14) A THIEF PLAYS EXACTLY LIKE A VILLAGER — its partners (known, or believed after a handshake) are
  // its "village"; it knows no "thief" to hunt, so it hunts whoever the evidence points at, as a villager would
  const partners = thief ? partnersOf(s, seat, skill) : new Set<number>();
  const ally = (x: number) => (thief ? partners.has(x) : l.known.get(x)?.side === "V");
  const foe = (x: number) => !thief && l.known.get(x)?.side === "T";
  const name = (x: number) => plain(s, x);
  const lastRound = s.round >= s.rounds;
  const n = s.players.length;
  const step = (d: 1 | -1) => { for (let k = 1; k < n; k++) { const y = (seat + d * k + n * n) % n; if (s.players[y].alive) return y; } return seat; };
  const next = step(1), prev = step(-1);
  const pass = (why: string): Decision => ({ action: { type: "pass", pass: passCards(hand, passSize(hand)) }, why });

  // 2. a thief with Dal Badal
  const db = ruleDalBadal(s, seat, skill, r, "turn", l, mem);
  if (db) return db;

  // 1. holding a Stone: a pair sends it to the next player. (Real games 2026-10-14: villagers holding a Stone still
  // played their pair 46% of the time, bots 5% — the Stones froze.) Never to a player I suspect or know is the other
  // side; to a player I have nothing against, only for a pair that does something (not Bhukamp, not Faisla without a case)
  const holding = hand.some(isStone);
  // (2026-10-14 PLAY, THEN PASS) Hera Pheri leaves 5 cards before the pass — the one pair that lets me KEEP my Stone
  if (holding && canPlay(s, seat, "HERA_PHERI")) {
    const mem0 = mem;
    const rich = others.filter((x) => s.players[x].hand.length > 0 && !(l.known.get(x)?.side === me.side));
    const t0 = best(r, rich, (x) => holds(mem0, x) * 10 + (l.score.get(x) ?? 0) * (thief ? -1 : 1));
    if (t0 !== undefined) {
      const rest = withoutPair(hand, "HERA_PHERI");
      return { action: { type: "play", card: "HERA_PHERI", target: t0, pass: passCards(rest, passSize(rest)) }, why: `play Hera Pheri on ${name(t0)} — the steal leaves me 5 cards, so my Stone stays` };
    }
  }
  const nextSuspect = foe(next) || (l.score.get(next) ?? 0) > 0;
  if (holding && !ally(next) && nextSuspect) return pass(`keep my Stone — ${name(next)} is next and I suspect them`);
  const stoneRisk = holding && !ally(next);
  // a thief keeps its Stone unless the next player is a partner it knows — a Stone in a villager's hand is lost
  if (thief && stoneRisk) return pass(`thief: keep my Stone — ${name(next)} is next and I don't know they're a partner`);

  const play = (card: ActionCard, why: string, target?: number, roles?: string[]): Decision => {
    const rest = withoutPair(hand, card);
    return { action: { type: "play", card, pass: passCards(rest, passSize(rest)), ...(target !== undefined ? { target } : {}), ...(roles ? { roles } : {}) }, why };
  };
  const can = (c: ActionCard) => canPlay(s, seat, c);
  const top = Math.max(-Infinity, ...others.map(sc));
  const leaders = others.filter((x) => sc(x) === top && !ally(x));
  const clearTop = leaders.length === 1 ? leaders[0] : undefined;
  const withCards = others.filter((x) => s.players[x].hand.length > 0);
  const hp = (x: number) => holds(mem, x);

  // A THIEF'S OWN GOALS (they look like any villager's move): bus an exposed partner, shoot a Stone-holding villager
  if (thief && can("TEER_KAMAN")) {
    // (designer 2026-10-14: "a thief can try to eliminate another thief") BUS A PARTNER: a partner I know whom the
    // table has already caught (called a thief by 2+) goes out anyway — my arrow takes their cards and buys me the
    // table's trust. Average and sharp thieves only.
    const exposed = others.filter((x) => l.known.get(x)?.side === "T" && l.known.get(x)?.role && (l.accused.get(x) ?? 0) >= 2);
    if (exposed.length && skill.name !== "casual") {
      const t = best(r, exposed, (x) => (l.accused.get(x) ?? 0) + hp(x))!;
      return play("TEER_KAMAN", `thief: shoot my partner ${name(t)} — the table caught them anyway; I take the cards and look like a villager`, t, tkRoles(s, seat, l, t, l.known.get(t)!.role!, "T"));
    }
    if (lastRound) {
      // a villager whose role I know — my read, or what they told me (bot talk) — holding a Stone
      const told = new Map(selfClaims(s.events, seat).filter((c) => c.toMe && c.side === "V").map((c) => [c.seat, c.role]));
      const roleOf = (x: number) => (l.known.get(x)?.side === "V" ? l.known.get(x)!.role : undefined) ?? told.get(x);
      const t = best(r, others.filter((x) => roleOf(x) && !ally(x) && hp(x) >= 0.5), hp);
      if (t !== undefined) return play("TEER_KAMAN", `thief: shoot ${name(t)}, a villager (${roleOf(t)}) who holds a Stone — the cards come to me`, t, tkRoles(s, seat, l, t, roleOf(t)!, "V"));
    }
  }
  {
    if (can("TEER_KAMAN")) {
      const sure = others.filter((x) => foe(x));
      if (sure.length) { const t = best(r, sure, hp)!; return play("TEER_KAMAN", `shoot ${name(t)} — ${l.known.get(t)!.why}`, t, tkRoles(s, seat, l, t, l.known.get(t)!.role ?? null)); }
      // an OPEN-KUNDLI accusation (the designer's table: "I said this guy is Chor, next Teer Kaman targeted him"): a role
      // named by someone the table SAW do a Kundli with them — from a speaker I don't doubt, not answered by the target
      // accusing them back, and not a role ruled out for the target
      const all = latestClaims(s.events, seat);
      const open = all.filter((e) => {
        const a = num(e.data, "seat")!, t = num(e.data, "target")!;
        if (e.data?.side !== "T" || typeof e.data?.role !== "string" || !others.includes(t) || ally(t) || a === seat) return false;
        if (l.liars.has(a) || foe(a) || l.ruledOut.get(t)?.has(e.data.role)) return false;
        // contested: someone else has called the SPEAKER a thief (the target answering back is the standoff below)
        if (all.some((c) => num(c.data, "target") === a && c.data?.side === "T" && num(c.data, "seat") !== t && !foe(num(c.data, "seat")!))) return false;
        const sawKundli = s.events.some((k) => k.type === "kundli" && k.n < e.n && ((num(k.data, "seat") === a && num(k.data, "target") === t) || (num(k.data, "seat") === t && num(k.data, "target") === a)));
        const standoff = all.some((c) => num(c.data, "seat") === t && num(c.data, "target") === a && c.data?.side === "T");
        return sawKundli && !standoff;
      });
      if (open.length) {
        const e = open[open.length - 1], t = num(e.data, "target")!;
        return play("TEER_KAMAN", `shoot ${name(t)} — ${name(num(e.data, "seat")!)} read them and said ${String(e.data!.role)}`, t, tkRoles(s, seat, l, t, String(e.data!.role)));
      }
      if (clearTop !== undefined && top >= 3) {
        const said = all.some((e) => num(e.data, "target") === clearTop && e.data?.side === "T" && typeof e.data?.role === "string");
        if (said) return play("TEER_KAMAN", `shoot ${name(clearTop)} — ${reasonFor(l, clearTop)}`, clearTop, tkRoles(s, seat, l, clearTop, null));
      }
    }
    if (can("FAISLA")) {
      const sure = others.filter(foe);
      if (sure.length) return play("FAISLA", `call a vote — I know ${sure.map(name).join(", ")} is a thief`);
      if (clearTop !== undefined && top >= 2) return play("FAISLA", `call a vote on ${name(clearTop)} — ${reasonFor(l, clearTop)}`);
    }
    if (can("HERA_PHERI")) {
      const t = best(r, withCards.filter((x) => (sc(x) >= 1 || foe(x)) && hp(x) > 0), (x) => hp(x) * 10 + sc(x));
      if (t !== undefined) return play("HERA_PHERI", `steal from ${name(t)} — a suspect who may hold a Stone`, t);
    }
    if (can("BATWARA") && !holding) {
      const near = [next, prev].filter((x) => x !== seat && (sc(x) >= 1 || foe(x)) && hp(x) >= 0.5);
      if (near.length) return play("BATWARA", `shake ${name(near[0])}'s Stone loose — a suspect next to me`);
    }
    if (can("TALASHI")) {
      const hunt = best(r, withCards.filter((x) => sc(x) >= 1 && hp(x) > 0 && hp(x) < 1), (x) => hp(x) * 10 + sc(x));
      if (hunt !== undefined) return play("TALASHI", `search ${name(hunt)} — a suspect who may hold a Stone`, hunt);
    }
    if (can("KUNDLI") && !(thief && skill.name !== "casual")) {
      const unread = others.filter((x) => !l.known.has(x));
      const t = best(r, unread.length ? unread : others, (x) => (l.talk.get(x) ?? 0) * 10 + sc(x));
      if (t !== undefined) return play("KUNDLI", `read ${name(t)} — the most talked-about player I haven't read`, t);
    }
    if (can("TALASHI")) {
      const t = best(r, withCards.filter((x) => !ally(x)), (x) => sc(x) * 10 + (l.talk.get(x) ?? 0));
      if (t !== undefined) return play("TALASHI", `search ${name(t)} — my top suspect`, t);
    }
    // with my Stone at stake, only a pair that does something — not a filler move that hands it on
    if (stoneRisk) return pass(`keep my Stone — no pair worth sending it to ${name(next)}`);
    // PLAY THE PAIR YOU HOLD (designer 2026-10-14, from 39 human games: without a Stone people played their pair ~88% of
    // the time) — the reasoning picks the target, not whether to play
    const suspect = (xs: number[]) => best(r, xs.filter((x) => !ally(x)), (x) => sc(x) * 10 + (l.talk.get(x) ?? 0));
    if (can("HERA_PHERI")) { const t = suspect(withCards); if (t !== undefined) return play("HERA_PHERI", `steal from ${name(t)} — my top suspect`, t); }
    if (can("FAISLA")) return play("FAISLA", "call a vote — let the table talk");
    if (can("BATWARA")) return play("BATWARA", "shake the table");
    // Teer Kaman is the exception: a miss puts ME out — never a blind shot; hold the pair until there's a case
    return pass(can("TEER_KAMAN") ? "hold my Teer Kaman — no case against anyone yet" : "no pair to play");
  }

}

// ------------------------------------------------------------------ DAL BADAL (thief)
export function ruleDalBadal(s: GameState, seat: number, skill: Skill, r: R, when: "turn" | "debate" | "votedOut",
  l: Ledger = ledger(s, seat, skill), mem: Map<Card, Set<number>> = stoneMemory(s, seat, skill, l)): Decision | null {
  const me = s.players[seat];
  if (me.side !== "T" || !me.hand.includes("DAL_BADAL")) return null;
  if (when !== "votedOut" && !canDalBadal(s, seat)) return null;
  const k = dalBadalPick(s, seat);
  if (k < 2) return null;
  const others = s.players.filter((p) => p.alive && p.seat !== seat && l.known.get(p.seat)?.side !== "T").map((p) => p.seat);
  if (others.length < k) return null;
  const claims = latestClaims(s.events).filter((e) => num(e.data, "target") === seat);
  const accusers = claims.filter((e) => e.data?.side === "T").map((e) => num(e.data, "seat")!).filter((x) => others.includes(x));
  const against = accusers.length - claims.filter((e) => e.data?.side === "V").length;
  // someone named my TRUE role — I know it's true, so the table may believe it: I'm exposed
  const named = claims.filter((e) => e.data?.side === "T" && e.data?.role === me.role).map((e) => num(e.data, "seat")!).filter((x) => others.includes(x));
  const hp = (x: number) => holds(mem, x);
  const fill = (first: number[]) => {
    const rest = others.filter((x) => !first.includes(x));
    const out = first.slice(0, k);
    while (out.length < k && rest.length) { const t = best(r, rest, hp)!; out.push(t); rest.splice(rest.indexOf(t), 1); }
    return out;
  };
  const turnPass = () => { const rest = [...me.hand]; rest.splice(rest.indexOf("DAL_BADAL"), 1); return passCards(rest, passSize(rest)); };
  const act = (seats: number[], why: string): Decision => ({ action: { type: "dal_badal", seats, pass: when === "turn" ? turnPass() : [] }, why });
  const names = (xs: number[]) => xs.map((x) => plain(s, x)).join(" and ");
  if (when === "votedOut") { const seats = fill(accusers); return act(seats, `thief, voted out: shuffle with ${names(seats)} — my accusers`); }
  if (against >= 2 || named.length) {
    const seats = fill([...named, ...accusers.filter((x) => !named.includes(x))]);
    return act(seats, `thief: exposed (${named.length ? "my true role was named" : `${against} against me`}) — shuffle with ${names(seats)}`);
  }
  if (when === "turn" && sharp(skill) && s.round >= s.rounds && !me.hand.some(isStone)) {
    const holders = others.filter((x) => hp(x) >= 0.5);
    if (holders.length) { const seats = fill(holders); return act(seats, `thief: last round, no Stone with us — make a Stone holder a thief (${names(seats)})`); }
  }
  return null;
}

// ------------------------------------------------------------------ DAL BADAL AS A SHIELD (designer 2026-10-14, dbShield)
/** shot at, read, or voted out by a Faisla while holding Dal Badal — a thief uses it when the moment would cost it:
 *  · Teer Kaman: only if the shot names my TRUE role (it would hit); otherwise it misses and the shooter goes out
 *  · Kundli: the reader would see I'm a thief — unless the reader is a partner I know
 *  · Faisla out: always, like the mandatory vote — the seat goes out with whatever role card it picks
 *  It shuffles with the player acting on it first, then my accusers, then whoever I think holds a Stone. */
export function ruleShield(s: GameState, seat: number, skill: Skill, r: R): Decision {
  const ph = s.phase;
  const keep: Decision = { action: { type: "ready" }, why: "let it happen" };
  if (ph.kind !== "react") return keep;
  const me = s.players[seat];
  const l = ledger(s, seat, skill);
  const mem = stoneMemory(s, seat, skill, l);
  const others = s.players.filter((p) => p.alive && p.seat !== seat && l.known.get(p.seat)?.side !== "T").map((p) => p.seat);
  const k = dalBadalPick(s, seat);
  if (others.length < k) return keep;
  const actor = ph.on.kind === "tk" ? ph.on.shooter : ph.on.kind === "kundli" ? ph.on.reader : null;
  if (ph.on.kind === "tk" && !ph.on.roles.includes(me.role)) return { action: { type: "ready" }, why: "the shot names the wrong role — it misses, the shooter goes out" };
  if (ph.on.kind === "kundli" && actor !== null && l.known.get(actor)?.side === "T") return { action: { type: "ready" }, why: "a partner reads me — no harm" };
  const accusers = latestClaims(s.events).filter((e) => num(e.data, "target") === seat && e.data?.side === "T").map((e) => num(e.data, "seat")!);
  const first = [...(actor !== null ? [actor] : []), ...accusers].filter((x, i, a) => others.includes(x) && a.indexOf(x) === i);
  const seats = first.slice(0, k);
  const rest = others.filter((x) => !seats.includes(x));
  while (seats.length < k && rest.length) { const t = best(r, rest, (x) => holds(mem, x))!; seats.push(t); rest.splice(rest.indexOf(t), 1); }
  const what = ph.on.kind === "tk" ? "the shot names my role" : ph.on.kind === "kundli" ? "the read would show I'm a thief" : "voted out";
  return { action: { type: "dal_badal", seats, pass: [] }, why: `thief: shield — ${what}; shuffle with ${seats.map((x) => plain(s, x)).join(" and ")}` };
}

// ------------------------------------------------------------------ 7. BHUKAMP
export function ruleBhukamp(s: GameState, seat: number, skill: Skill, r: R): Decision {
  const me = s.players[seat];
  const h = [...me.hand];
  if (h.length < 2) return { action: { type: "batwara", card: h[0] }, why: "one card" };
  const l = ledger(s, seat, skill);
  const n = s.players.length;
  const step = (d: 1 | -1) => { for (let k = 1; k < n; k++) { const y = (seat + d * k + n * n) % n; if (s.players[y].alive) return y; } return seat; };
  const left = step(1), right = step(-1);
  const sc = (x: number) => l.score.get(x) ?? 0;
  // the neighbour I trust more with something precious (a thief: a partner it knows, else the one the table suspects)
  const trust = (x: number) => me.side === "V"
    ? (l.known.get(x)?.side === "V" ? 100 : l.known.get(x)?.side === "T" ? -100 : -sc(x))
    : (l.known.get(x)?.side === "T" ? 100 : l.known.get(x)?.side === "V" ? -100 : sc(x));
  const [precious, other] = [...h].sort((a, b) => keepRank(h, b) - keepRank(h, a));
  if (!isStone(precious) && precious !== "DAL_BADAL") {
    const [a, b] = r() < 0.5 ? [h[0], h[1]] : [h[1], h[0]];
    return { action: { type: "batwara", card: a, right: b }, why: "nothing precious — either way" };
  }
  const toLeft = trust(left) > trust(right) || (trust(left) === trust(right) && r() < 0.5);
  return { action: toLeft ? { type: "batwara", card: precious, right: other } : { type: "batwara", card: other, right: precious },
    why: `${isStone(precious) ? "my Stone" : "Dal Badal"} to ${plain(s, toLeft ? left : right)}, the neighbour I trust more` };
}

// ------------------------------------------------------------------ GOING OUT: the vote I give, the cards I hand on
export function ruleGift(s: GameState, seat: number, skill: Skill, r: R): Decision {
  const l = ledger(s, seat, skill);
  const me = s.players[seat];
  const alive = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat);
  const sc = (x: number) => l.score.get(x) ?? 0;
  const friends = alive.filter((x) => l.known.get(x)?.side === me.side);
  if (friends.length) { const t = best(r, friends, (x) => -sc(x))!; return { action: { type: "gift", target: t }, why: `my vote to ${plain(s, t)} — on my side for sure` }; }
  // a thief that knows no partner gives it to nobody — a vote thrown at a stranger may arm a villager
  if (me.side === "T") return { action: { type: "gift", target: null }, why: "thief: no partner I know" };
  const pool = alive.filter((x) => l.known.get(x)?.side === undefined);
  const t = best(r, pool, (x) => -sc(x));
  if (t === undefined || sc(t) > 0) return { action: { type: "gift", target: null }, why: "nobody I trust" };
  return { action: { type: "gift", target: t }, why: `my vote to ${plain(s, t)} — the player I trust most` };
}

export function ruleHandoff(s: GameState, seat: number, skill: Skill, r: R): Decision {
  const g = ruleGift(s, seat, skill, r);
  const alive = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat);
  const t = g.action.type === "gift" && g.action.target !== null ? g.action.target : pickOne(r, alive);
  return { action: { type: "handoff", target: t }, why: `my cards to ${plain(s, t)}` };
}
