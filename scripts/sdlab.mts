// SOCIAL DEDUCTION LAB (2026-10-12) — 14 tests from game-AI and social deduction research, on the FINAL rules.
// ANALYSIS ONLY — the game code is untouched. Inside this script only:
//   · role table: the designer's final counts (6 players = 2 thieves)
//   · (Bhukamp both ways and Dal Badal in the mandatory vote are game rules since 2026-10-12 — the vote uses below
//     were simulated here before the engine had them)
//   · Teer Kaman as the designer's table plays it: a villager holding a playable pair shoots a player whose ROLE was
//     named in an accusation, naming that role (+ one more thief role at a 3+-thief table)
//   npx tsx scripts/sdlab.mts <test> [counts=6,8,10] [games=300]
//   tests: record (9 kingmaking · 10 bandwagons · 11 persuasion · 13 Stone tracing) · restrict (1) · skill (2) ·
//          drama (3 + 5) · curve (4) · talk (6 + 7) · trust (8) · blind (12) · pass (14)
import { apply, canDalBadal, canPlay, passSize, start, waitingOn } from "@/engine/engine";
import { DEAL_HAND, ROLE_TABLE, THIEF_ROLES, tkGuesses } from "@/engine/setup";
import { isStone, type Action, type Card, type GameState, type Side } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS, stoneOdds, topSuspect, type Skill } from "@/server/belief";
import { readsOf } from "@/engine/decisions";
import { deduce, MODEL } from "@/server/deduce";

const TEST = process.argv[2] ?? "record";
const COUNTS = (process.argv[3] ?? "6,8,10").split(",").map(Number);
const GAMES = Number(process.argv[4] ?? 300);
const TABLE: Record<number, [number, number, number]> = { ...ROLE_TABLE, 6: [4, 2, 3] }; // designer 2026-10-12: 6p = 2 thieves

let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
let seed2 = 7;
const rnd2 = () => { seed2 = (seed2 * 48271) % 2147483647; return seed2 / 2147483647; };
const pc = (x: number, d: number) => (d ? `${Math.round((100 * x) / d)}%` : "-");
const AVG: Skill = { ...SKILLS.average, exact: true };
const SHARP: Skill = { ...SKILLS.sharp, exact: true };
const CAS: Skill = SKILLS.casual;

// ------------------------------------------------------------------ the table's Teer Kaman
function tableShot(s: GameState, seat: number, a: Action, skill: Skill, r: () => number): Action {
  if (s.phase.kind !== "turn" || !canPlay(s, seat, "TEER_KAMAN")) return a;
  const me = s.players[seat];
  if (me.side !== "V" || r() > skill.activity) return a;
  const reads = readsOf(s, seat);
  const c = s.events.filter((e) => e.type === "claim" && e.data?.side === "T" && typeof e.data?.role === "string"
    && e.data.seat !== seat && e.data.target !== seat && s.players[e.data.target as number]?.alive
    && reads.get(e.data.target as number)?.side !== "V").at(-1);
  if (!c) return a;
  const role = String(c.data!.role);
  const others = s.rolesInPlay.filter((x) => THIEF_ROLES.includes(x) && x !== role);
  const roles = [role, others[Math.floor(r() * others.length)]].filter(Boolean).slice(0, tkGuesses(s.rolesInPlay));
  const rest = [...me.hand];
  rest.splice(rest.indexOf("TEER_KAMAN"), 1); rest.splice(rest.indexOf("TEER_KAMAN"), 1);
  return { type: "play", card: "TEER_KAMAN", target: c.data!.target as number, roles, pass: stonesLast(rest, passSize(rest)) };
}
const stonesLast = (h: Card[], k: number) => [...h.filter((x) => !isStone(x)), ...h.filter(isStone)].slice(0, k);
const sample = <T,>(xs: T[], k: number, r: () => number) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k); };
const plainPass = (s: GameState, seat: number): Action => ({ type: "pass", pass: stonesLast(s.players[seat].hand, passSize(s.players[seat].hand)) });

// ------------------------------------------------------------------ one game
interface Opt {
  skillOf?: (s: GameState, seat: number) => Skill;
  restrict?: (s: GameState, seat: number, a: Action) => Action;
  claims?: (s: GameState, seat: number) => boolean;
  setup?: (s: GameState) => void;
  onTurn?: (s: GameState) => void; // at every pickup
  onFinal?: (s: GameState) => void; // once, when the mandatory vote opens
}
function step(s: GameState, o: Opt, r: () => number): GameState {
  const seat = waitingOn(s)[0];
  const ph = s.phase;
  const sk = o.skillOf?.(s, seat) ?? AVG;
  if (ph.kind === "vote" && ph.debate && (o.claims?.(s, seat) ?? true)) pushBotClaim(s, seat, s.seed, r, sk);
  let a = tableShot(s, seat, skilledAction(s, seat, s.seed, r, sk), sk, r);
  if (o.restrict) a = o.restrict(s, seat, a);
  return apply(s, seat, a);
}
function play(n: number, g: number, o: Opt = {}, thieves?: number): GameState {
  const t = thieves ?? TABLE[n][1];
  const table = { ...TABLE, [n]: [n - t, t, 3] as [number, number, number] };
  let s = start(Array.from({ length: n }, (_, i) => `P${i}`), 900_000 * n + 1000 * t + g, table, DEAL_HAND);
  o.setup?.(s);
  let seen = 0, finalDone = false;
  for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
    if (o.onTurn) { for (; seen < s.events.length; seen++) if (s.events[seen].type === "pickup") o.onTurn(s); }
    if (!finalDone && s.phase.kind === "vote" && s.phase.reason === "final") { finalDone = true; o.onFinal?.(s); }
    s = step(s, o, rnd);
    // NO_MUTUAL=1: Kundli one-way, as before 2026-10-12 — the target's half of the read reaches nobody
    if (process.env.NO_MUTUAL === "1") for (const e of s.events) if (e.type === "kundli_private" && e.data?.mutual) e.to = [];
  }
  if (s.phase.kind !== "over") throw new Error(`${n}p game ${g} did not end`);
  return s;
}
const winner = (s: GameState) => (s.phase as { winner: Side }).winner;
function rate(n: number, o: Opt = {}, thieves?: number, games = GAMES): number {
  let v = 0;
  for (let g = 0; g < games; g++) if (winner(play(n, g, o, thieves)) === "V") v++;
  return v / games;
}
const P = (x: number) => `${Math.round(100 * x)}%`;
const D = (x: number) => `${x >= 0 ? "+" : ""}${Math.round(100 * x)}`;

// ------------------------------------------------------------------ the tests
const out = (line: string) => console.log(line);

if (TEST === "record") {
  // 9 kingmaking · 10 bandwagons · 11 persuasion · 13 Stone tracing — read from the record of ordinary games
  for (const n of COUNTS) {
    const R: Record<string, number> = {};
    const add = (k: string, v = 1) => { R[k] = (R[k] ?? 0) + v; };
    for (let g = 0; g < GAMES; g++) {
      const s = play(n, g, {
        onFinal: (st) => {
          // 13: every living villager's guess of where the Stones are
          const holders = st.players.filter((p) => p.alive && p.hand.some(isStone)).map((p) => p.seat);
          if (!holders.length) return;
          for (const v of st.players.filter((p) => p.alive && p.side === "V")) {
            const odds = stoneOdds(st, v.seat, st.seed, AVG);
            const others = st.players.filter((p) => p.alive && p.seat !== v.seat).map((p) => p.seat);
            const truth = holders.filter((x) => x !== v.seat);
            if (!truth.length) continue;
            const guess = [...others].sort((x, y) => (odds.get(y) ?? 0) - (odds.get(x) ?? 0)).slice(0, truth.length);
            add("stoneHit", guess.filter((x) => truth.includes(x)).length); add("stoneN", truth.length);
            add("stoneChance", truth.length * truth.length / others.length);
          }
        },
      });
      const side = (x: number) => s.players[x].side;
      let debate: { reason: string; firstAcc?: { by: number; target: number } } | null = null;
      for (const e of s.events) {
        const d = e.data;
        if (e.type === "faisla" || e.type === "final_vote") debate = { reason: e.type };
        if (e.type === "claim" && debate && !debate.firstAcc && d?.side === "T" && d?.kind !== "stone") debate.firstAcc = { by: d!.seat as number, target: d!.target as number };
        if (e.type !== "vote_result") continue;
        const ballots = (d?.ballots ?? {}) as Record<string, number | null>;
        const tally = (d?.tally ?? {}) as Record<string, number>;
        const outSeat = d?.out as number | null;
        const cast = Object.values(tally).reduce((a, b) => a + b, 0);
        // 10 bandwagon: share of the votes on the top target
        if (cast > 0 && outSeat !== null) {
          const share = Math.max(...Object.values(tally)) / cast;
          const k = share >= 0.75 ? "pile" : "split";
          add(`${k}N`); if (side(outSeat) === "T") add(`${k}T`);
        }
        // 9 kingmaking (mandatory vote): one vote each — would someone else have gone out?
        if (d?.reason === "final") {
          add("finalN");
          const weight = (v: number) => (s.players[v].alive ? s.players[v].votes : s.players[v].votesAtDeath);
          const heavy = Object.entries(ballots).some(([v, t]) => t !== null && weight(Number(v)) > 1);
          const flat = new Map<number, number>();
          for (const t of Object.values(ballots)) if (t !== null) flat.set(t, (flat.get(t) ?? 0) + 1);
          const max = Math.max(0, ...flat.values());
          const top = [...flat.entries()].filter(([, v]) => v === max && v > 0).map(([x]) => x);
          const out1 = top.length === 1 ? top[0] : null;
          if (heavy) add("finalHeavy");
          if (out1 !== outSeat) add("kingmade");
        }
        // 11 persuasion: the first accusation of the debate — did the table follow it?
        if (debate?.firstAcc) {
          const { by, target } = debate.firstAcc;
          const k = side(by) === "T" ? "accT" : "accV";
          add(`${k}N`); if (outSeat === target) { add(`${k}Follow`); if (side(target) === "T") add(`${k}FollowThief`); }
        }
        debate = null;
      }
    }
    out(`## ${n}p ${TABLE[n][1]}T — from the record of ${GAMES} games`);
    out(`T9  kingmaking   final votes with a gifted (extra) vote cast: ${pc(R.finalHeavy ?? 0, R.finalN ?? 0)} · decided by it (one vote each would put out someone else): ${pc(R.kingmade ?? 0, R.finalN ?? 0)}`);
    out(`T10 bandwagons   pile-on votes (≥75% on one player) put out a thief ${pc(R.pileT ?? 0, R.pileN ?? 0)} (n=${R.pileN ?? 0}) · split votes ${pc(R.splitT ?? 0, R.splitN ?? 0)} (n=${R.splitN ?? 0})`);
    out(`T11 persuasion   the table votes out the player first accused BY A THIEF ${pc(R.accTFollow ?? 0, R.accTN ?? 0)} (n=${R.accTN ?? 0}) · BY A VILLAGER ${pc(R.accVFollow ?? 0, R.accVN ?? 0)} (n=${R.accVN ?? 0}) · of those followed, a thief: thief-led ${pc(R.accTFollowThief ?? 0, R.accTFollow ?? 0)}, villager-led ${pc(R.accVFollowThief ?? 0, R.accVFollow ?? 0)}`);
    out(`T13 Stone trace  at the final vote a villager points at the Stone holders ${pc(R.stoneHit ?? 0, R.stoneN ?? 0)} of the time (chance ${pc(R.stoneChance ?? 0, R.stoneN ?? 0)})`);
  }
}

if (TEST === "restrict") {
  // 1 RESTRICTED PLAY (Jaffe): take one move away from one side; the drop in that side's wins is what the move is worth
  const CARDS: Card[] = ["FAISLA", "TALASHI", "KUNDLI", "HERA_PHERI", "BATWARA", "TEER_KAMAN"];
  const never = (card: Card | "DAL_BADAL", side: Side): Opt => ({
    restrict: (s, seat, a) => (s.players[seat].side !== side ? a
      : card === "DAL_BADAL" ? (a.type === "dal_badal" ? plainPass(s, seat) : a)
      : a.type === "play" && a.card === card ? plainPass(s, seat) : a),
  });
  for (const n of COUNTS) {
    const base = rate(n);
    const rows: string[] = [];
    for (const c of CARDS) for (const side of ["V", "T"] as Side[]) {
      const v = rate(n, never(c, side));
      const own = side === "V" ? v - base : base - v; // the restricted side's change in wins (negative = the move was worth that much)
      rows.push(`${side === "V" ? "villagers" : "thieves"} never ${c.toLowerCase().replace("_", " ")}: ${D(own)}`);
    }
    const db = rate(n, never("DAL_BADAL", "T"));
    rows.push(`thieves never dal badal: ${D(base - db)}`);
    // a thief who never lies (truthful claims only) and a villager bot that never claims anything
    const noLie = rate(n, { skillOf: (s, seat) => (s.players[seat].side === "T" ? { ...AVG, lie: 0 } : AVG) });
    rows.push(`thieves never lie: ${D(base - noLie)}`);
    const vSilent = rate(n, { claims: (s, seat) => s.players[seat].side !== "V" });
    rows.push(`villagers never speak: ${D(vSilent - base)}`);
    out(`## ${n}p ${TABLE[n][1]}T — T1 RESTRICTED PLAY (Tunga wins ${P(base)} unrestricted). Change in the RESTRICTED side's wins, points:`);
    out("   " + rows.join(" · "));
  }
}

if (TEST === "skill") {
  // 2 SKILL SPREAD (Duersch et al.): every seat a random skill; does an individual's skill change its own wins?
  for (const n of COUNTS) {
    const R: Record<string, number> = {};
    const add = (k: string, v = 1) => { R[k] = (R[k] ?? 0) + v; };
    const SK = [CAS, AVG, SHARP];
    for (let g = 0; g < GAMES; g++) {
      const mine = Array.from({ length: n }, () => SK[Math.floor(rnd2() * 3)]);
      const s = play(n, g, { skillOf: (_s, seat) => mine[seat] });
      const w = winner(s);
      s.players.forEach((p) => { const k = `${p.side}_${mine[p.seat].name}`; add(`${k}N`); if (p.side === w) add(`${k}W`); });
      const vs = s.players.filter((p) => p.side === "V");
      const edge = vs.filter((p) => mine[p.seat].name === "sharp").length - vs.filter((p) => mine[p.seat].name === "casual").length;
      const b = edge > 0 ? "more sharp" : edge < 0 ? "more casual" : "even";
      add(`team_${b}N`); if (w === "V") add(`team_${b}W`);
    }
    const row = (side: Side) => ["casual", "average", "sharp"].map((k) => `${k} ${pc(R[`${side}_${k}W`] ?? 0, R[`${side}_${k}N`] ?? 0)}`).join(" / ");
    out(`## ${n}p ${TABLE[n][1]}T — T2 SKILL SPREAD (${GAMES} mixed tables)`);
    out(`   a VILLAGER wins: ${row("V")}   ·   a THIEF wins: ${row("T")}`);
    out(`   village wins when its villagers are: more casual ${pc(R["team_more casualW"] ?? 0, R["team_more casualN"] ?? 0)} · even ${pc(R.team_evenW ?? 0, R.team_evenN ?? 0)} · more sharp ${pc(R["team_more sharpW"] ?? 0, R["team_more sharpN"] ?? 0)}`);
  }
}

if (TEST === "curve") {
  // 4 THE UNCERTAINTY CURVE: one villager's uncertainty about who the thieves are (entropy), turn by turn
  for (const n of COUNTS) {
    const bins = Array.from({ length: 10 }, () => [] as number[]);
    let solvedEarly = 0, finals = 0, flat = 0, steps = 0;
    const mids: number[] = [];
    for (let g = 0; g < GAMES; g++) {
      const trace: number[] = [];
      let obs = -1, h0 = 0, atFinal = -1;
      const H = (st: GameState) => {
        if (obs < 0 || !st.players[obs].alive) return null;
        const p = deduce(st, obs, MODEL).p;
        let h = 0;
        for (let x = 0; x < n; x++) if (x !== obs) { const q = Math.min(1 - 1e-9, Math.max(1e-9, p.get(x) ?? 0)); h += -(q * Math.log2(q) + (1 - q) * Math.log2(1 - q)); }
        return h;
      };
      play(n, g, {
        setup: (st) => { obs = st.players.find((p) => p.side === "V")!.seat; h0 = H(st) ?? 1; },
        onTurn: (st) => { const h = H(st); if (h !== null) trace.push(h / h0); },
        onFinal: (st) => { const h = H(st); if (h !== null) atFinal = h / h0; },
      });
      if (trace.length < 3) continue;
      trace.forEach((h, i) => bins[Math.min(9, Math.floor((10 * i) / trace.length))].push(h));
      for (let i = 1; i < trace.length; i++) { steps++; if (Math.abs(trace[i] - trace[i - 1]) < 0.01) flat++; }
      mids.push(trace[Math.floor(trace.length / 2)]);
      if (atFinal >= 0) { finals++; if (atFinal < 0.1) solvedEarly++; }
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    const m = mean(mids), sd = Math.sqrt(mean(mids.map((x) => (x - m) ** 2)));
    out(`## ${n}p ${TABLE[n][1]}T — T4 UNCERTAINTY CURVE (a villager's uncertainty about the thieves, 100% = knows nothing)`);
    out(`   by tenth of the game: ${bins.map((b) => P(mean(b))).join(" → ")}`);
    out(`   turns where it barely moved (<1 pt): ${pc(flat, steps)} · mid-game spread across games ±${Math.round(100 * sd)} pts · already solved (<10%) when the final vote opens: ${pc(solvedEarly, finals)}`);
  }
}

if (TEST === "drama") {
  // 3 DRAMA + 5 DEAD TIME (Browne): from every turn, play the rest out K times to estimate who is winning
  const K = Number(process.env.DRAMA_K ?? 12);
  for (const n of COUNTS) {
    let leadChanges = 0, games = 0, comeback = 0, behind = 0, dead = 0, turnsAll = 0;
    for (let g = 0; g < GAMES; g++) {
      const est: number[] = [];
      const s = play(n, g, {
        onTurn: (st) => {
          let v = 0;
          for (let k = 0; k < K; k++) {
            let c = structuredClone(st);
            for (let i = 0; i < 20000 && c.phase.kind !== "over"; i++) c = step(c, { skillOf: () => CAS }, rnd2);
            if (c.phase.kind === "over" && c.phase.winner === "V") v++;
          }
          est.push(v / K);
        },
      });
      const w = winner(s);
      games++;
      // lead changes with a band: a change counts when the estimate crosses from ≥60% one way to ≥60% the other
      let lead: Side | null = null;
      for (const e of est) {
        const now: Side | null = e >= 0.6 ? "V" : e <= 0.4 ? "T" : null;
        if (now && lead && now !== lead) leadChanges++;
        if (now) lead = now;
      }
      // comeback: the eventual winner was clearly behind (≤30%) at some point after the first third
      const third = Math.floor(est.length / 3);
      const winnerOdds = est.map((e) => (w === "V" ? e : 1 - e));
      if (winnerOdds.slice(third).some((e) => e <= 0.3)) comeback++;
      if (est.slice(third).some((e) => e <= 0.3 || e >= 0.7)) behind++;
      // dead time: turns after the estimate settles for good beyond 95% either way
      let settled = est.length;
      for (let i = est.length - 1; i >= 0; i--) { if (est[i] >= 0.95 || est[i] <= 0.05) settled = i; else break; }
      dead += est.length - settled; turnsAll += est.length;
    }
    out(`## ${n}p ${TABLE[n][1]}T — T3 DRAMA + T5 DEAD TIME (${games} games, ${K} play-outs per turn)`);
    out(`   lead changes per game ${(leadChanges / games).toFixed(2)} · the winner came back from ≤30% after the first third: ${pc(comeback, games)} of games (${pc(comeback, behind)} of games where someone fell that far behind)`);
    out(`   dead time — turns played after the result is settled (≥95%): ${pc(dead, turnsAll)} of all turns`);
  }
}

if (TEST === "talk") {
  // 6 THE SILENT TABLE (Werewolf Arena) · 7 DO LIES PAY
  for (const n of COUNTS) {
    const base = rate(n);
    const silent = rate(n, { claims: () => false });
    const T = (sk: Partial<Skill>): Opt => ({ skillOf: (s, seat) => (s.players[seat].side === "T" ? { ...AVG, ...sk } : AVG) });
    const always = rate(n, T({ lie: 1, claimRate: 1 }));
    const truth = rate(n, T({ lie: 0 }));
    const mute = rate(n, { claims: (s, seat) => s.players[seat].side !== "T" });
    out(`## ${n}p ${TABLE[n][1]}T — T6 SILENT TABLE + T7 LIES (Tunga wins)`);
    out(`   everyone talks ${P(base)} · nobody talks ${P(silent)}  →  talk is worth ${D(base - silent)} pts to the village`);
    out(`   thieves: lie as usual ${P(base)} · ALWAYS lie ${P(always)} · NEVER lie ${P(truth)} · NEVER speak ${P(mute)}  (lower = better for thieves)`);
  }
}

if (TEST === "trust") {
  // 8 HUMAN-LEVEL TRUST (Bond & DePaulo: people catch 54% of lies, a truth bias): bots that believe claims more
  const TRUSTING = { ...MODEL, liar: 0.25, liarHunch: 0.5 };
  const SKEPTIC = { ...MODEL, liar: 0.95, liarHunch: 1 };
  for (const n of COUNTS) {
    const base = rate(n);
    const trusting = rate(n, { skillOf: () => ({ ...AVG, model: TRUSTING }) });
    const skeptic = rate(n, { skillOf: () => ({ ...AVG, model: SKEPTIC }) });
    out(`## ${n}p ${TABLE[n][1]}T — T8 TRUST (Tunga wins): trusting table (believes most claims) ${P(trusting)} · bots as today ${P(base)} · skeptical table ${P(skeptic)}`);
  }
}

if (TEST === "blind") {
  // 12 THE PRICE OF BLIND THIEVES (Carminati et al., "price of hidden roles"): thieves who know each other
  const know: Opt = {
    setup: (s) => {
      const ts = s.players.filter((p) => p.side === "T");
      for (const a of ts) for (const b of ts) if (a.seat !== b.seat)
        s.events.push({ n: s.events.length, type: "kundli_private", to: [a.seat], msg: "", data: { target: b.seat, role: b.role, side: "T" } });
    },
  };
  for (const n of COUNTS) {
    const t = TABLE[n][1];
    const cells = [`${t}T blind ${P(rate(n, {}, t))}`, `${t}T knowing ${P(rate(n, know, t))}`];
    if (t > 1) cells.push(`${t - 1}T knowing ${P(rate(n, know, t - 1))}`);
    out(`## ${n}p — T12 BLIND THIEVES (Tunga wins): ${cells.join(" · ")}`);
  }
}

if (TEST === "pass") {
  // 14 DOES PASSING MATTER: players who pass at random, ignoring the Stones
  const careless = (side: Side | "all"): Opt => ({
    restrict: (s, seat, a) => {
      if (side !== "all" && s.players[seat].side !== side) return a;
      const h = s.players[seat].hand;
      if (a.type === "pass") return { ...a, pass: sample(h, passSize(h), rnd2) };
      if (a.type === "play") { const rest = [...h]; rest.splice(rest.indexOf(a.card), 1); rest.splice(rest.indexOf(a.card), 1); return { ...a, pass: sample(rest, passSize(rest), rnd2) }; }
      if (a.type === "batwara") return { ...a, card: sample(h, 1, rnd2)[0] };
      return a;
    },
  });
  for (const n of COUNTS) {
    const base = rate(n);
    out(`## ${n}p ${TABLE[n][1]}T — T14 PASSING (Tunga wins): everyone careful ${P(base)} · villagers pass at random ${P(rate(n, careless("V")))} · thieves pass at random ${P(rate(n, careless("T")))} · everyone at random ${P(rate(n, careless("all")))}`);
  }
}

if (TEST === "dalbadal") {
  // DAL BADAL TIMING (designer 2026-10-12: "people bank cards for the optimal time"). The engine allows Dal Badal on
  // the thief's own turn; the designer's table ALSO plays it in the mandatory vote — during the debate, or when voted
  // out (before the reveal, sides counted after the shuffle). The vote uses are simulated here, in the script only.
  // The thief picks THE ACCUSERS (designer's table): players who called it a thief or read its Kundli.
  const accusers = (s: GameState, me: number) => {
    const xs = new Set<number>();
    for (const e of s.events) {
      if (e.type === "claim" && e.data?.target === me && e.data?.side === "T") xs.add(e.data.seat as number);
      if (e.type === "kundli_private" && e.data?.mutual && Array.isArray(e.to) && e.to.includes(me)) xs.add(e.data.target as number);
    }
    return [...xs].filter((x) => x !== me && s.players[x].alive);
  };
  const exposed = (s: GameState, me: number) => accusers(s, me).length > 0;
  const pickTwo = (s: GameState, me: number, smart: boolean) => {
    const others = s.players.filter((p) => p.alive && p.seat !== me).map((p) => p.seat);
    const first = smart ? sample(accusers(s, me), 2, rnd2) : [];
    return [...first, ...sample(others.filter((x) => !first.includes(x)), 2 - first.length, rnd2)];
  };
  // the shuffle, done by hand for the vote-time uses (the same events the engine writes, so bots read it the same way)
  const shuffleNow = (s: GameState, me: number, seats: number[]) => {
    const n = s.players.length;
    const pickers = [me, ...seats].sort((x, y) => ((x - me + n) % n) - ((y - me + n) % n));
    const p = s.players[me];
    s.events.push({ n: s.events.length, type: "dal_badal", to: "all", msg: `DAL BADAL — ${p.name} shows ${p.role}`, data: { seat: me, role: p.role, seats: pickers } });
    const pool = sample(pickers.map((x) => ({ role: s.players[x].role, side: s.players[x].side })), pickers.length, rnd2);
    pickers.forEach((x, i) => {
      s.players[x].role = pool[i].role; s.players[x].side = pool[i].side;
      s.events.push({ n: s.events.length, type: "role", to: [x], msg: "", data: { role: pool[i].role, side: pool[i].side, swapped: true } });
    });
    p.hand.splice(p.hand.indexOf("DAL_BADAL"), 1);
    s.events.push({ n: s.events.length, type: "analytics_db", to: [], msg: "", data: { when: "vote" } });
  };
  const keepDB = (s: GameState, seat: number, a: Action): Action => {
    // a banking thief never passes Dal Badal away
    const h = s.players[seat].hand;
    if ((a.type === "pass" || a.type === "play") && (a.pass ?? []).includes("DAL_BADAL")) {
      const used = a.type === "play" ? [a.card, a.card] : [];
      const free = [...h]; for (const c of [...used, ...(a.pass ?? [])]) free.splice(free.indexOf(c), 1);
      const swap = free.find((c) => c !== "DAL_BADAL");
      if (swap) { const p = [...(a.pass ?? [])]; p[p.indexOf("DAL_BADAL")] = swap; return { ...a, pass: p }; }
    }
    return a;
  };
  interface Pol { name: string; turn?: (s: GameState, me: number) => boolean; debate?: (s: GameState, me: number) => boolean; votedOut?: boolean; smart: boolean; bank: boolean }
  const POLS: Pol[] = [
    { name: "never use it", smart: false, bank: true, turn: () => false },
    { name: "bots today (random moment, random picks)", smart: false, bank: false },
    { name: "first chance, picks accusers", smart: true, bank: true, turn: () => true },
    { name: "on turn once exposed, picks accusers", smart: true, bank: true, turn: exposed },
    { name: "on turn once exposed, random picks", smart: false, bank: true, turn: exposed },
    { name: "last round's turn, picks accusers", smart: true, bank: true, turn: (s) => s.round >= s.rounds },
    { name: "bank → final debate, picks accusers", smart: true, bank: true, turn: () => false, debate: () => true },
    { name: "bank → only if voted out", smart: true, bank: true, turn: () => false, votedOut: true },
    { name: "bank → debate if exposed, else if voted out", smart: true, bank: true, turn: () => false, debate: exposed, votedOut: true },
    { name: "exposed on turn, else voted out", smart: true, bank: true, turn: exposed, votedOut: true },
  ];
  const policyOpt = (pol: Pol): Opt => ({
    onFinal: (s) => {
      if (!pol.debate) return;
      for (const p of s.players) if (p.alive && p.side === "T" && p.hand.includes("DAL_BADAL") && pol.debate(s, p.seat)
        && s.players.filter((x) => x.alive).length >= 3) shuffleNow(s, p.seat, pickTwo(s, p.seat, pol.smart));
    },
    restrict: (s, seat, a) => {
      const me = s.players[seat];
      // voted out in the mandatory vote: the last ballot is about to land — if it puts out this thief, shuffle first
      if (pol.votedOut && s.phase.kind === "vote" && s.phase.reason === "final" && !s.phase.debate && waitingOn(s).length === 1) {
        try {
          const c = apply(s, seat, a);
          const r = c.events.filter((e) => e.type === "vote_result").at(-1);
          const out = r?.data?.out as number | null | undefined;
          if (out != null && s.players[out].side === "T" && s.players[out].hand.includes("DAL_BADAL") && s.players.filter((x) => x.alive).length >= 3)
            shuffleNow(s, out, pickTwo(s, out, pol.smart));
        } catch { /* not a decisive ballot */ }
        return a;
      }
      if (me.side !== "T" || !me.hand.includes("DAL_BADAL") || s.phase.kind !== "turn") return a;
      if (!pol.turn) return a; // bots today: leave the bot's own choice
      if (canDalBadal(s, seat) && pol.turn(s, seat)) {
        const rest = [...me.hand]; rest.splice(rest.indexOf("DAL_BADAL"), 1);
        return { type: "dal_badal", seats: pickTwo(s, seat, pol.smart), pass: stonesLast(rest, passSize(rest)) };
      }
      if (a.type === "dal_badal") {
        // the bot wanted it now; the policy waits — decide again without it in hand
        const i = me.hand.indexOf("DAL_BADAL"); me.hand.splice(i, 1);
        let b: Action;
        try { b = skilledAction(s, seat, s.seed, rnd, AVG); } finally { me.hand.push("DAL_BADAL"); }
        if (b.type === "play") { const after = [...me.hand]; after.splice(after.indexOf(b.card), 1); after.splice(after.indexOf(b.card), 1); if ((b.pass ?? []).length !== passSize(after)) b = plainPass(s, seat); }
        if (b.type === "pass" && b.pass.length !== passSize(me.hand)) b = plainPass(s, seat);
        return pol.bank ? keepDB(s, seat, b) : b;
      }
      return pol.bank ? keepDB(s, seat, a) : a;
    },
  });
  for (const n of COUNTS) {
    const rows: string[] = [];
    for (const pol of POLS) {
      let v = 0, used = 0;
      for (let g = 0; g < GAMES; g++) {
        const s = play(n, g, policyOpt(pol));
        if (winner(s) === "V") v++;
        if (s.events.some((e) => e.type === "dal_badal")) used++;
      }
      rows.push(`   ${pol.name.padEnd(46)} Tunga ${P(v / GAMES)} · used in ${P(used / GAMES)} of games`);
    }
    out(`## ${n}p ${TABLE[n][1]}T — DAL BADAL TIMING (${GAMES} games each; LOWER Tunga = better for thieves)`);
    rows.forEach((r) => out(r));
  }
}

if (TEST.startsWith("timing")) {
  // CARD TIMING (designer 2026-10-12: "people bank cards for the optimal time"; "test timings for all cards").
  // Each variant changes ONE behaviour for ONE side; everything else plays as the bots do.
  //   timing-V / timing-T : every card, played at the first chance vs banked to round 3 (pair kept when passing)
  //   timing-DB           : Dal Badal — when, and whom to pick (accusers vs Stone holders); vote uses simulated
  //   timing-G            : the Stone gamble — a thief holding a Stone plays its pair anyway (the Stone goes on)
  const others = (s: GameState, me: number) => s.players.filter((p) => p.alive && p.seat !== me).map((p) => p.seat);
  const protect = (s: GameState, seat: number, a: Action, keep: Card[]): Action => {
    if (a.type !== "pass" && a.type !== "play") return a;
    const h = s.players[seat].hand;
    const free = [...h];
    for (const c of [...(a.type === "play" ? [a.card, a.card] : []), ...(a.pass ?? [])]) free.splice(free.indexOf(c), 1);
    const p = [...(a.pass ?? [])];
    for (const k of keep) {
      const i = p.indexOf(k); if (i < 0) continue;
      const j = free.findIndex((c) => !keep.includes(c)); if (j < 0) continue;
      p[i] = free[j]; free.splice(j, 1, k);
    }
    return { ...a, pass: p };
  };
  const forcePlay = (s: GameState, seat: number, card: Card): Action | null => {
    if (!canPlay(s, seat, card as never)) return null;
    const me = s.players[seat];
    const rest = [...me.hand]; rest.splice(rest.indexOf(card), 1); rest.splice(rest.indexOf(card), 1);
    const pass = stonesLast(rest, passSize(rest));
    const os = others(s, seat);
    const odds = stoneOdds(s, seat, s.seed, AVG);
    const byOdds = (xs: number[]) => [...xs].sort((x, y) => (odds.get(y) ?? 0) - (odds.get(x) ?? 0))[0];
    const reads = readsOf(s, seat);
    switch (card) {
      case "FAISLA": case "BATWARA": return { type: "play", card, pass };
      case "KUNDLI": { const t = topSuspect(s, seat, s.seed, AVG); const un = os.filter((x) => !reads.has(x)); return { type: "play", card, pass, target: t !== null && !reads.has(t) ? t : un[0] ?? os[0] }; }
      case "TALASHI": return { type: "play", card, pass, target: byOdds(os) };
      case "HERA_PHERI": { const t = byOdds(os.filter((x) => s.players[x].hand.length > 0)); return t === undefined ? null : { type: "play", card, pass, target: t }; }
      case "TEER_KAMAN": {
        const foe = [...reads].find(([x, k]) => k.side !== me.side && s.players[x].alive);
        if (foe) return { type: "play", card, pass, target: foe[0], roles: [foe[1].role, ...s.rolesInPlay.filter((r) => r !== foe[1].role && THIEF_ROLES.includes(r))].slice(0, tkGuesses(s.rolesInPlay)) };
        const shot = tableShot(s, seat, { type: "pass", pass: [] }, { ...AVG, activity: 1 }, rnd);
        return shot.type === "play" ? shot : null;
      }
    }
    return null;
  };
  const cardVariant = (card: Card, side: Side, mode: "asap" | "bank3"): Opt => ({
    restrict: (s, seat, a) => {
      if (s.phase.kind !== "turn" || s.players[seat].side !== side || !canPlay(s, seat, card as never)) return a;
      const late = s.round >= s.rounds;
      if (mode === "asap" || late) return a.type === "play" && a.card === card ? a : forcePlay(s, seat, card) ?? a;
      if (a.type === "play" && a.card === card) {
        // bank it: pass 3 of the other cards, keep the pair
        const h = s.players[seat].hand;
        const rest = [...h]; rest.splice(rest.indexOf(card), 1); rest.splice(rest.indexOf(card), 1);
        const k = passSize(h);
        const pass = rest.length >= k ? stonesLast(rest, k) : [...rest, card, card].slice(0, k);
        return { type: "pass", pass };
      }
      return protect(s, seat, a, [card, card]);
    },
  });

  // ---------- Dal Badal: whom to pick
  const accusersOf = (s: GameState, me: number) => {
    const xs = new Set<number>();
    for (const e of s.events) {
      if (e.type === "claim" && e.data?.target === me && e.data?.side === "T") xs.add(e.data.seat as number);
      if (e.type === "kundli_private" && e.data?.mutual && Array.isArray(e.to) && e.to.includes(me)) xs.add(e.data.target as number);
    }
    return [...xs].filter((x) => x !== me && s.players[x].alive);
  };
  const exposed = (s: GameState, me: number) => accusersOf(s, me).length > 0;
  const sawStone = (s: GameState, me: number) => s.players[me].hand.some(isStone)
    || s.events.some((e) => Array.isArray(e.to) && e.to.includes(me) && JSON.stringify(e.data ?? {}).includes("STONE"));
  type Pick = "accusers" | "stones" | "random";
  const pickTwo = (s: GameState, me: number, how: Pick) => {
    const os = others(s, me);
    let first: number[] = [];
    if (how === "accusers") first = sample(accusersOf(s, me), 2, rnd2);
    if (how === "stones") { const odds = stoneOdds(s, me, s.seed, AVG); first = [...os].sort((x, y) => (odds.get(y) ?? 0) - (odds.get(x) ?? 0)).slice(0, 2); }
    return [...first, ...sample(os.filter((x) => !first.includes(x)), 2 - first.length, rnd2)];
  };
  const shuffleNow = (s: GameState, me: number, seats: number[]) => {
    const n = s.players.length;
    const pickers = [me, ...seats].sort((x, y) => ((x - me + n) % n) - ((y - me + n) % n));
    const p = s.players[me];
    s.events.push({ n: s.events.length, type: "dal_badal", to: "all", msg: `DAL BADAL — ${p.name} shows ${p.role}`, data: { seat: me, role: p.role, seats: pickers } });
    const pool = sample(pickers.map((x) => ({ role: s.players[x].role, side: s.players[x].side })), pickers.length, rnd2);
    pickers.forEach((x, i) => {
      s.players[x].role = pool[i].role; s.players[x].side = pool[i].side;
      s.events.push({ n: s.events.length, type: "role", to: [x], msg: "", data: { role: pool[i].role, side: pool[i].side, swapped: true } });
    });
    p.hand.splice(p.hand.indexOf("DAL_BADAL"), 1);
  };
  interface DB { name: string; turn?: (s: GameState, me: number) => Pick | null; debate?: Pick; votedOut?: Pick }
  const lastNoStone = (s: GameState, me: number) => s.round >= s.rounds && !sawStone(s, me);
  const DBS: DB[] = [
    { name: "never", turn: () => null },
    { name: "bots today (random moment, random picks)" },
    { name: "once exposed -> accusers", turn: (s, me) => (exposed(s, me) ? "accusers" : null) },
    { name: "once exposed -> Stone holders", turn: (s, me) => (exposed(s, me) ? "stones" : null) },
    { name: "round 3, never saw a Stone -> Stone holders", turn: (s, me) => (lastNoStone(s, me) ? "stones" : null) },
    { name: "round 3 always -> Stone holders", turn: (s) => (s.round >= s.rounds ? "stones" : null) },
    { name: "bank -> final debate -> Stone holders", turn: () => null, debate: "stones" },
    { name: "bank -> final debate -> accusers", turn: () => null, debate: "accusers" },
    { name: "bank -> only when voted out -> Stone holders", turn: () => null, votedOut: "stones" },
    { name: "HUMAN PLAN: exposed->accusers, r3 no Stone->holders, voted out->holders",
      turn: (s, me) => (exposed(s, me) ? "accusers" : lastNoStone(s, me) ? "stones" : null), votedOut: "stones" },
  ];
  const dbOpt = (d: DB): Opt => ({
    onFinal: (s) => {
      if (!d.debate) return;
      for (const p of s.players) if (p.alive && p.side === "T" && p.hand.includes("DAL_BADAL") && s.players.filter((x) => x.alive).length >= 3)
        shuffleNow(s, p.seat, pickTwo(s, p.seat, d.debate));
    },
    restrict: (s, seat, a) => {
      const me = s.players[seat];
      if (d.votedOut && s.phase.kind === "vote" && s.phase.reason === "final" && !s.phase.debate && waitingOn(s).length === 1) {
        try {
          const c = apply(s, seat, a);
          const out = c.events.filter((e) => e.type === "vote_result").at(-1)?.data?.out as number | null | undefined;
          if (out != null && s.players[out].side === "T" && s.players[out].hand.includes("DAL_BADAL") && s.players.filter((x) => x.alive).length >= 3)
            shuffleNow(s, out, pickTwo(s, out, d.votedOut));
        } catch { /* not decisive */ }
        return a;
      }
      if (me.side !== "T" || !me.hand.includes("DAL_BADAL") || s.phase.kind !== "turn" || !d.turn) return a;
      const how = canDalBadal(s, seat) ? d.turn(s, seat) : null;
      if (how) { const rest = [...me.hand]; rest.splice(rest.indexOf("DAL_BADAL"), 1); return { type: "dal_badal", seats: pickTwo(s, seat, how), pass: stonesLast(rest, passSize(rest)) }; }
      if (a.type === "dal_badal") {
        const i = me.hand.indexOf("DAL_BADAL"); me.hand.splice(i, 1);
        let b: Action;
        try { b = skilledAction(s, seat, s.seed, rnd, AVG); } finally { me.hand.push("DAL_BADAL"); }
        if (b.type === "play") { const after = [...me.hand]; after.splice(after.indexOf(b.card), 1); after.splice(after.indexOf(b.card), 1); if ((b.pass ?? []).length !== passSize(after)) b = plainPass(s, seat); }
        if (b.type === "pass" && b.pass.length !== passSize(me.hand)) b = plainPass(s, seat);
        return protect(s, seat, b, ["DAL_BADAL"]);
      }
      return protect(s, seat, a, ["DAL_BADAL"]);
    },
  });

  // ---------- the Stone gamble
  const gamble = (mode: "play" | "keep"): Opt => ({
    restrict: (s, seat, a) => {
      const me = s.players[seat];
      if (s.phase.kind !== "turn" || me.side !== "T" || !me.hand.some(isStone)) return a;
      if (mode === "keep") return a.type === "play" && (a.pass ?? []).some(isStone) ? plainPass(s, seat) : a;
      if (a.type === "play") return a;
      for (const c of ["HERA_PHERI", "TALASHI", "KUNDLI", "BATWARA", "FAISLA"] as Card[]) {
        const f = forcePlay(s, seat, c);
        if (f && f.type === "play") { const rest = [...me.hand]; rest.splice(rest.indexOf(c), 1); rest.splice(rest.indexOf(c), 1); return { ...f, pass: sample(rest, passSize(rest), rnd2) }; }
      }
      return a;
    },
  });

  const CARDS: Card[] = ["FAISLA", "TALASHI", "KUNDLI", "HERA_PHERI", "BATWARA", "TEER_KAMAN"];
  for (const n of COUNTS) {
    const base = TEST === "timing-BAL" ? 0 : rate(n);
    const rows: string[] = [];
    const sideGain = (side: Side, v: number) => (side === "V" ? v - base : base - v);
    if (TEST === "timing-V" || TEST === "timing-T") {
      const side: Side = TEST === "timing-V" ? "V" : "T";
      for (const c of CARDS) {
        const asap = rate(n, cardVariant(c, side, "asap")), bank = rate(n, cardVariant(c, side, "bank3"));
        rows.push(`   ${c.toLowerCase().replace("_", " ").padEnd(11)} first chance ${D(sideGain(side, asap)).padStart(4)} · bank to round 3 ${D(sideGain(side, bank)).padStart(4)}`);
      }
      out(`## ${n}p ${TABLE[n][1]}T — CARD TIMING for ${side === "V" ? "VILLAGERS" : "THIEVES"} (${GAMES} games each; points for THAT side vs bots as they are, Tunga ${P(base)}; ±10 is noise)`);
    }
    if (TEST === "timing-DB") {
      for (const d of DBS) {
        let v = 0, used = 0;
        for (let g = 0; g < GAMES; g++) { const s = play(n, g, dbOpt(d)); if (winner(s) === "V") v++; if (s.events.some((e) => e.type === "dal_badal")) used++; }
        rows.push(`   ${d.name.padEnd(72)} thieves ${D(base - v / GAMES).padStart(4)} · used ${P(used / GAMES)}`);
      }
      out(`## ${n}p ${TABLE[n][1]}T — DAL BADAL TIMING + PICKS (${GAMES} games each; points for the THIEVES vs bots as they are, Tunga ${P(base)}; ±10 is noise)`);
    }
    if (TEST === "timing-BAL") {
      // balance with thieves using Dal Badal like the designer's table (exposed -> accusers, round 3 no Stone -> holders, voted out -> holders)
      const human = DBS[DBS.length - 1];
      const th = Number(process.env.THIEVES ?? TABLE[n][1]); // RETUNE: try another thief count
      const r = [CAS, AVG, SHARP].map((sk) => { let v = 0; for (let g = 0; g < GAMES; g++) if (winner(play(n, g, { ...dbOpt(human), skillOf: () => sk }, th)) === "V") v++; return P(v / GAMES); });
      out(`${n}p ${th}T  Tunga wins casual / average / sharp: ${r.join(" / ")}`);
    }
    if (TEST === "timing-G") {
      rows.push(`   thief holding a Stone plays its pair anyway (Stone passes on, luck): thieves ${D(base - rate(n, gamble("play")))}`);
      rows.push(`   thief holding a Stone never plays a pair while holding it:          thieves ${D(base - rate(n, gamble("keep")))}`);
      out(`## ${n}p ${TABLE[n][1]}T — THE STONE GAMBLE (${GAMES} games each; Tunga ${P(base)} with bots as they are; ±10 is noise)`);
    }
    rows.forEach((r) => out(r));
  }
}
