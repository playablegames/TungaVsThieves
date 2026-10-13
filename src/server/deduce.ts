// EXACT DEDUCTION (2026-10-09, stage 1 of the DeepRole-style bots — Serrino et al., "Finding Friend and Foe in
// Multi-Agent Games", NeurIPS 2019). Instead of nudging a suspicion score per player, a bot holds EVERY possible answer
// to "who are the thieves?" — each way of placing the thieves round the table — and weighs them:
//   · facts DELETE the answers they contradict: its own role, its Kundli reads, a role it was shown, a Dal Badal
//     thief's public reveal, a Teer Kaman that hit or missed two named roles, "the game isn't over, so a thief is alive"
//   · everything else WEIGHS them by how likely that move is under that answer (a behaviour model): claims (a villager
//     who read a role tells the truth; a thief says anything), accusations, ballots, Teer Kaman targets, surrenders
//   · a Dal Badal shuffles three role cards: every answer is spread over the 6 ways the three could have been dealt
// P(thief) for a seat = the share of the weight in the answers that make it a thief. At most C(12,4) = 495 answers at
// an online table — exact, every move, no sampling. A bot reads ONLY viewFor(its seat): no secrets.
import type { GameState, Side } from "@/engine/types";
import { viewFor } from "@/engine/view";
import { THIEF_ROLES } from "@/engine/setup";
import { clampLR, tellsOf, TELLS } from "./tells";

/** behaviour model: how a VILLAGER and a THIEF act, as likelihoods (starting values — tune from playtest logs) */
export interface Model {
  /** a villager reporting what it SAW (Kundli read, a role shown) tells the truth */
  honest: number;
  /** a villager's bare accusation lands on a thief this much more often than on a villager */
  hunch: number;
  /** a villager's ballot lands on a thief this much more often */
  ballot: number;
  /** a Teer Kaman is aimed at the other side this often */
  aim: number;
  /** a holder who surrenders a Stone is a villager this often */
  surrender: number;
  /** how often a THIEF makes a "I saw it" claim, against a villager who really saw (1) — a thief has nothing behind it,
   *  so it speaks up less; without this a claim makes the SPEAKER look like the thief (test: botmind "claims out loud") */
  liar: number;
  /** the same for a bare accusation — thieves point fingers almost as freely as villagers */
  liarHunch: number;
}
/** WAIT FOR THE ANSWER (designer 2026-10-12, after a screen check where one lying Kundli mark had four bots
 *  accusing within seconds): an accusation counts only this much until the accused has had the chance to answer —
 *  until they say anything at all, or the floor closes (their silence is an answer too) */
export const UNANSWERED = 0.3;
export function unanswered(events: { n: number; type: string; data?: Record<string, unknown> }[], n: number, target: number): boolean {
  return !events.some((x) => x.n > n && ((x.type === "claim" && x.data?.seat === target) || x.type === "ballots_open"));
}

export const MODEL: Model = { honest: 0.9, hunch: 1.6, ballot: 1.4, aim: 0.7, surrender: 0.9, liar: 0.6, liarHunch: 0.9 };

const num = (d: Record<string, unknown> | undefined, k: string) => (typeof d?.[k] === "number" ? (d[k] as number) : null);

/** every placement of k thieves among n seats, as bitmasks */
function placements(n: number, k: number): number[] {
  const out: number[] = [];
  const go = (start: number, left: number, mask: number) => {
    if (!left) { out.push(mask); return; }
    for (let i = start; i <= n - left; i++) go(i + 1, left - 1, mask | (1 << i));
  };
  go(0, k, 0);
  return out;
}

export interface Deduction {
  /** P(thief) for every seat (its own included: 0 or 1) */
  p: Map<number, number>;
  /** how many answers are still standing (with any weight) */
  live: number;
}

/** `publicOnly`: what the TABLE can deduce — no private reads, own role unknown (a thief blending in votes with this) */
export function deduce(s: GameState, seat: number, m: Model = MODEL, publicOnly = false): Deduction {
  const { H, w, n } = scenarios(s, seat, m, publicOnly);
  const isT = (h: number, x: number) => (h >> x) & 1;
  const p = new Map<number, number>();
  for (let x = 0; x < n; x++) {
    let t = 0;
    for (let i = 0; i < H.length; i++) if (isT(H[i], x)) t += w[i];
    p.set(x, t);
  }
  let live = 0;
  for (const x of w) if (x > 1e-9) live++;
  return { p, live };
}

/** every placement of the thieves (bitmasks `H`) and its weight `w` (summing to 1) — what the FLOWSHEET samples its
 *  hidden worlds from (flowsheet.ts) */
export function scenarios(s: GameState, seat: number, m: Model = MODEL, publicOnly = false): { H: number[]; w: Float64Array; n: number } {
  const v = viewFor(s, seat);
  const n = v.players.length;
  const thiefRoles = v.rolesInPlay.filter((r) => THIEF_ROLES.includes(r));
  const villagerRoles = v.rolesInPlay.filter((r) => !THIEF_ROLES.includes(r));
  const K = thiefRoles.length;
  const H = placements(n, K);
  const w = new Float64Array(H.length).fill(1);
  const isT = (h: number, x: number) => (h >> x) & 1;
  const scale = (f: (h: number) => number) => { for (let i = 0; i < H.length; i++) if (w[i]) w[i] *= f(H[i]); };
  const fact = (x: number, side: Side) => scale((h) => (isT(h, x) === (side === "T" ? 1 : 0) ? 1 : 0));
  const norm = () => { let t = 0; for (const x of w) t += x; if (t > 0) for (let i = 0; i < w.length; i++) w[i] /= t; };
  const mine = (e: { to: "all" | number[] }) => e.to === "all" || (!publicOnly && Array.isArray(e.to) && e.to.includes(seat));
  const index = new Map(H.map((h, i) => [h, i]));
  const said = new Set<string>();

  for (const e of v.events) {
    if (!mine(e)) continue;
    const d = e.data, actor = num(d, "seat"), target = num(d, "target");
    switch (e.type) {
      case "role": if (!publicOnly) fact(seat, d?.side as Side); break;
      case "kundli_private": if (target !== null) fact(target, d?.side as Side); break;
      case "eliminated_private": if (actor !== null && d?.side) fact(actor, d.side as Side); break;
      case "eliminated": if (actor !== null && d?.side) fact(actor, d.side as Side); break;
      case "dal_badal": {
        // the thief showed its role, then the role cards were shuffled and dealt back: spread every answer over
        // every deal of those seats (3 seats → 6 deals; a probe may shuffle more)
        if (actor !== null) fact(actor, "T");
        const seats = (d?.seats as number[]) ?? [];
        if (seats.length < 2) break;
        const perms = permutations(seats.length);
        const out = new Float64Array(H.length);
        for (let i = 0; i < H.length; i++) {
          if (!w[i]) continue;
          const bits = seats.map((x) => isT(H[i], x));
          for (const pm of perms) {
            let h = H[i];
            seats.forEach((x, j) => { h = bits[pm[j]] ? h | (1 << x) : h & ~(1 << x); });
            out[index.get(h)!] += w[i] / perms.length;
          }
        }
        w.set(out);
        break;
      }
      case "teer_kaman": {
        // the two named roles are public, and so is HIT / MISS: P(the target's role is one of them | its side)
        if (target === null || actor === null) break;
        const named = (d?.roles as string[]) ?? [];
        const pT = K ? named.filter((r) => thiefRoles.includes(r)).length / K : 0;
        const pV = villagerRoles.length ? named.filter((r) => villagerRoles.includes(r)).length / villagerRoles.length : 0;
        const hit = Boolean(d?.hit);
        scale((h) => { const q = isT(h, target) ? pT : pV; return hit ? q : 1 - q; });
        // and a shot is aimed across the table: the shooter and target are likely on opposite sides
        scale((h) => (isT(h, actor) !== isT(h, target) ? m.aim : 1 - m.aim));
        break;
      }
      case "claim": {
        if (actor === null || target === null || actor === seat || d?.kind === "stone") break;
        const says = d?.side as Side | undefined;
        if (!says) break;
        // the same thing said again by the same speaker is not new evidence (playtest WJ9J9: "Circuit is a thief" ×3)
        const key = `${actor}:${d?.kind}:${target}:${says}`;
        if (said.has(key)) break;
        said.add(key);
        const seen = d?.kind === "kundli" || d?.kind === "was";
        // an accusation the accused hasn't answered yet weighs less (tempered: the factor to a power below 1)
        const k = says === "T" && unanswered(v.events, e.n, target) ? UNANSWERED : 1;
        const tempered = (f: (h: number) => number) => scale(k === 1 ? f : (h) => Math.pow(f(h), k));
        if (seen) {
          // a villager who SAW tells the truth; a thief says it less often, and when it does it is noise
          tempered((h) => {
            if (isT(h, actor)) return m.liar;
            const right = (isT(h, target) === 1) === (says === "T");
            return right ? m.honest : 1 - m.honest;
          });
          break;
        }
        // a HUNCH ("X is a thief" / "X is a villager" with nothing seen behind it), as a choice of whom to name: a
        // villager's pick leans toward the truth, a thief's is anyone. Normalised over the seats it could have named,
        // so on average a hunch says nothing about the SPEAKER — only about the target (playtest WJ9J9: two vouches
        // made Chilyy the bots' top suspect and all 8 voted her out)
        const others = n - 1;
        tempered((h) => {
          if (isT(h, actor)) return 1 / others;
          const thievesOthers = K; // the speaker is a villager here, so all K thieves are among the others
          const leanT = says === "T" ? m.hunch : 1, leanV = says === "T" ? 1 : m.hunch;
          const total = thievesOthers * leanT + (others - thievesOthers) * leanV;
          return (isT(h, target) ? leanT : leanV) / total;
        });
        break;
      }
      case "whisper_private": {
        if (actor === null || target === null || num(d, "to") !== seat || !d?.side) break;
        const says = d.side as Side;
        scale((h) => (isT(h, actor) ? m.liar : ((isT(h, target) === 1) === (says === "T") ? m.honest : 1 - m.honest)));
        break;
      }
      case "vote_result": {
        for (const [k, t] of Object.entries((d?.ballots as Record<string, number | null>) ?? {})) {
          const voter = Number(k);
          if (t === null || voter === seat) continue;
          scale((h) => (isT(h, voter) ? 1 : isT(h, t) ? m.ballot : 1) / m.ballot);
        }
        break;
      }
      case "surrender": if (actor !== null) scale((h) => (isT(h, actor) ? 1 - m.surrender : m.surrender)); break;
    }
    norm();
  }
  // TELLS (2026-10-13): every public action, weighed by how often each side takes it (tells.ts, learned from games)
  for (const t of tellsOf(v.events, n)) {
    if (t.actor === seat) continue;
    if (t.kind === "outcome") {
      const o = TELLS.outcome[t.group]?.[t.key];
      if (!o) continue;
      const lr = clampLR(o[0] / o[1]);
      scale((h) => (isT(h, t.actor) ? lr : 1));
    } else {
      const lean = TELLS.aim[t.card];
      if (!lean) continue;
      const mask = t.cands.reduce((a, x) => a | (1 << x), 0);
      scale((h) => {
        const l = clampLR(lean[isT(h, t.actor) ? 0 : 1]);
        let kc = 0; for (let m = h & mask; m; m &= m - 1) kc++;
        return (isT(h, t.target) ? l : 1) / (kc * l + (t.cands.length - kc));
      });
    }
    norm();
  }
  // the game isn't over: at least one thief is still alive
  const alive = v.players.reduce((a, p) => (p.alive ? a | (1 << p.seat) : a), 0);
  if (s.phase.kind !== "over") scale((h) => ((h & alive) ? 1 : 0));
  norm();
  // if every answer was deleted (a lie dressed as a fact can't do this — facts here are only what the bot saw), fall
  // back to the count alone
  let total = 0;
  for (const x of w) total += x;
  if (!total) w.fill(1 / H.length);
  return { H, w, n };
}

/** every ordering of 0..n-1 */
function permutations(n: number): number[][] {
  if (n <= 1) return [[0]];
  return permutations(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]));
}
