// SOCIAL DEDUCTION TEST BATTERY (2026-10-12) — the final rules, checked the way established games are judged.
// ANALYSIS ONLY: the game code is untouched. Inside this script:
//   · (Bhukamp both ways is the game rule since 2026-10-12)
//   · Teer Kaman as the designer's table plays it: a villager holding a playable pair shoots a player whose ROLE was
//     named in an accusation ("he is Chor"), naming that role (+ one more thief role at a 3+-thief table)
//   npx tsx scripts/sdtests.mts [games=200] [counts=5-12] [extra=6:2]   (extra = n:thieves rows to add, e.g. 6:2)
import { apply, canPlay, passSize, start, waitingOn } from "@/engine/engine";
import { DEAL_HAND, ROLE_TABLE, THIEF_ROLES, tkGuesses } from "@/engine/setup";
import { isStone, type Action, type Card, type GameState, type Side } from "@/engine/types";
import { pushBotClaim, skilledAction, SKILLS, type Skill } from "@/server/belief";
import { readsOf } from "@/engine/decisions";
import { deduce } from "@/server/deduce";

const GAMES = Number(process.argv[2] ?? 200);
const [lo, hi] = (process.argv[3] ?? "5-12").split("-").map(Number);
const extra = (process.argv[4] ?? "").split(",").filter(Boolean).map((x) => x.split(":").map(Number) as [number, number]);
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pc = (x: number, d: number) => (d ? `${Math.round((100 * x) / d)}%` : "-");

/** the table's Teer Kaman: shoot the player whose role an accusation named */
function tableShot(s: GameState, seat: number, a: Action, skill: Skill): Action {
  if (s.phase.kind !== "turn" || !canPlay(s, seat, "TEER_KAMAN")) return a;
  const me = s.players[seat];
  if (me.side !== "V" || rnd() > skill.activity) return a;
  const reads = readsOf(s, seat);
  const named = s.events.filter((e) => e.type === "claim" && e.data?.side === "T" && typeof e.data?.role === "string"
    && e.data.seat !== seat && e.data.target !== seat && s.players[e.data.target as number]?.alive
    && reads.get(e.data.target as number)?.side !== "V");
  const c = named.at(-1);
  if (!c) return a;
  const role = String(c.data!.role);
  const others = s.rolesInPlay.filter((r) => THIEF_ROLES.includes(r) && r !== role);
  const roles = [role, others[Math.floor(rnd() * others.length)]].filter(Boolean).slice(0, tkGuesses(s.rolesInPlay));
  const rest = [...me.hand];
  rest.splice(rest.indexOf("TEER_KAMAN"), 1); rest.splice(rest.indexOf("TEER_KAMAN"), 1);
  const pass = [...rest.filter((x) => !isStone(x)), ...rest.filter(isStone)].slice(0, passSize(rest));
  return { type: "play", card: "TEER_KAMAN", target: c.data!.target as number, roles, pass };
}

const villageStones = (s: GameState) =>
  s.players.filter((p) => p.alive && p.side === "V").reduce((k, p) => k + p.hand.filter(isStone).length, 0)
  + (s.villagePot ?? []).filter(isStone).length + s.pile.filter(isStone).length;

interface Row { [k: string]: number }
function run(n: number, thieves: number, skill: Skill, randomVote: boolean, detail: boolean): Row {
  const table = { ...ROLE_TABLE, [n]: [n - thieves, thieves, 3] as [number, number, number] };
  const R: Row = {};
  const add = (k: string, v = 1) => { R[k] = (R[k] ?? 0) + v; };
  for (let g = 0; g < GAMES; g++) {
    let s: GameState = start(Array.from({ length: n }, (_, i) => `P${i}`), 700_000 * n + 1000 * thieves + g, table, DEAL_HAND);
    const dealV = s.players.filter((p) => p.side === "V").reduce((k, p) => k + p.hand.filter(isStone).length, 0);
    let before: Side | null = null;
    for (let k = 0; k < 20000 && s.phase.kind !== "over"; k++) {
      const seat = waitingOn(s)[0];
      const ph = s.phase;
      if (detail && before === null && ph.kind === "vote" && ph.reason === "final") {
        // T4 public solvability: an observer with ONLY the public record ranks the living players
        before = villageStones(s) === 2 ? "V" : "T";
        const alive = s.players.filter((p) => p.alive);
        const aliveT = alive.filter((p) => p.side === "T").length;
        const v = alive.find((p) => p.side === "V");
        if (v && aliveT > 0) {
          const d = deduce(s, v.seat, undefined, true).p;
          const top = alive.map((p) => p.seat).sort((x, y) => (d.get(y) ?? 0) - (d.get(x) ?? 0)).slice(0, aliveT);
          add("obsHit", top.filter((x) => s.players[x].side === "T").length); add("obsN", aliveT);
          add("baseHit", aliveT * aliveT / alive.length);
        }
      }
      if (ph.kind === "vote" && ph.debate) pushBotClaim(s, seat, s.seed, rnd, skill);
      let a: Action;
      if (randomVote && ph.kind === "vote" && !ph.debate) {
        const others = s.players.filter((p) => p.alive && p.seat !== seat).map((p) => p.seat);
        a = { type: "vote", target: others[Math.floor(rnd() * others.length)] ?? null };
      } else a = tableShot(s, seat, skilledAction(s, seat, s.seed, rnd, skill), skill);
      s = apply(s, seat, a);
    }
    if (s.phase.kind !== "over") throw new Error(`${n}p game ${g} did not end`);
    const w = s.phase.winner;
    add("games"); if (w === "V") add("vWin");
    if (!detail) continue;
    // T5 endgame decisiveness
    if (before !== null) { add("final"); if (before !== w) add(w === "T" ? "flipT" : "flipV"); }
    // T7 deal luck
    add(`deal${dealV}`); if (w === "V") add(`deal${dealV}V`);
    // T8 seat: each seat's own win (its side won)
    s.players.forEach((p) => { if (p.seat === 0 || p.seat === n - 1) { add(`seat${p.seat === 0 ? "First" : "Last"}`); if (p.side === w) add(`seat${p.seat === 0 ? "First" : "Last"}W`); } add("seatAll"); if (p.side === w) add("seatAllW"); });
    // walk the record
    let pendingFaisla = false, firstOut: Side | null = null, finalSeen = false;
    for (const e of s.events) {
      const d = e.data;
      switch (e.type) {
        case "pickup": add("turns"); pendingFaisla = false; break;
        case "conduit": add("satOut"); pendingFaisla = false; break;
        case "play": {
          add("plays");
          const side = s.players[d!.seat as number].side; // (Dal Badal can move sides — close enough)
          add(`card_${d!.card}_${side}`); if (side === w) add(`card_${d!.card}_${side}_W`);
          break;
        }
        case "faisla": add("faisla"); pendingFaisla = true; break;
        case "final_vote": finalSeen = true; break;
        case "eliminated": {
          const side = s.players[d!.seat as number].side;
          if (!firstOut) firstOut = side;
          if (!finalSeen) add("outBefore");
          if (pendingFaisla) { add("faislaOut"); if (side === "T") add("faislaThief"); }
          if (finalSeen) { add("finalOut"); if (side === "T") add("finalThief"); }
          break;
        }
        case "teer_kaman": add("tk"); if (d?.hit) add("tkHit"); break;
        case "claim": add("claims"); { const t = s.players[d!.target as number]; if (t && d!.kind !== "stone" && d!.kind !== "accuse" && t.side !== d!.side) add("lies"); } break;
      }
    }
    if (firstOut) { add(`first${firstOut}`); if (w === "V") add(`first${firstOut}V`); }
    add("thiefAliveEnd", s.players.filter((p) => p.side === "T" && p.alive).length);
    add("thieves", thieves);
  }
  return R;
}

const rows: string[] = [];
const counts: [number, number][] = [];
for (let n = lo; n <= hi; n++) counts.push([n, ROLE_TABLE[n][1]]);
counts.push(...extra);
const CARDS = ["FAISLA", "TALASHI", "KUNDLI", "HERA_PHERI", "BATWARA", "TEER_KAMAN"];
for (const [n, t] of counts) {
  const floor = run(n, t, { ...SKILLS.average, exact: true }, true, false);
  const cas = run(n, t, SKILLS.casual, false, false);
  const A = run(n, t, { ...SKILLS.average, exact: true }, false, true);
  const sh = run(n, t, { ...SKILLS.sharp, exact: true }, false, false);
  const G = A.games;
  const card = (c: string, side: Side) => pc(A[`card_${c}_${side}_W`] ?? 0, A[`card_${c}_${side}`] ?? 0);
  rows.push([
    `## ${n}p ${t}T`,
    `T1 balance   Tunga wins: random ballots ${pc(floor.vWin, floor.games)} · casual ${pc(cas.vWin, cas.games)} · average ${pc(A.vWin, G)} · sharp ${pc(sh.vWin, sh.games)}`,
    `T3 votes     Faisla outs a thief ${pc(A.faislaThief ?? 0, A.faislaOut ?? 0)} (thieves are ${pc(t, n)} of the table) · final vote outs a thief ${pc(A.finalThief ?? 0, A.finalOut ?? 0)}`,
    `T4 public    observer with only the public record names the living thieves ${pc(A.obsHit ?? 0, A.obsN ?? 0)} (chance ${pc(A.baseHit ?? 0, A.obsN ?? 0)})`,
    `T5 endgame   final vote reached ${pc(A.final ?? 0, G)} · it CHANGED the winner ${pc((A.flipT ?? 0) + (A.flipV ?? 0), A.final ?? 0)} (to thieves ${pc(A.flipT ?? 0, A.final ?? 0)}, to village ${pc(A.flipV ?? 0, A.final ?? 0)})`,
    `T6 snowball  Tunga wins when the FIRST player out is a thief ${pc(A.firstTV ?? 0, A.firstT ?? 0)} (n=${A.firstT ?? 0}) · a villager ${pc(A.firstVV ?? 0, A.firstV ?? 0)} (n=${A.firstV ?? 0})`,
    `T7 deal      Tunga wins with 0/1/2 Stones dealt to villagers: ${pc(A.deal0V ?? 0, A.deal0 ?? 0)} / ${pc(A.deal1V ?? 0, A.deal1 ?? 0)} / ${pc(A.deal2V ?? 0, A.deal2 ?? 0)} (games ${A.deal0 ?? 0}/${A.deal1 ?? 0}/${A.deal2 ?? 0})`,
    `T8 seat      a player wins: first seat ${pc(A.seatFirstW ?? 0, A.seatFirst ?? 0)} · last seat ${pc(A.seatLastW ?? 0, A.seatLast ?? 0)} · any seat ${pc(A.seatAllW ?? 0, A.seatAll ?? 0)}`,
    `T9 out       out before the final vote ${((A.outBefore ?? 0) / G).toFixed(1)} of ${n} · turns sat out ${pc(A.satOut ?? 0, (A.turns ?? 0) + (A.satOut ?? 0))} · thieves alive at the end ${pc(A.thiefAliveEnd ?? 0, A.thieves ?? 0)}`,
    `T10 agency   a pair played on ${pc(A.plays ?? 0, A.turns ?? 0)} of turns · Teer Kaman ${((A.tk ?? 0) / G).toFixed(2)} shots/game, hit ${pc(A.tkHit ?? 0, A.tk ?? 0)}`,
    `T11 cards    the player's side wins (villager / thief): ${CARDS.map((c) => `${c.toLowerCase().replace("_", " ")} ${card(c, "V")}/${card(c, "T")}`).join(" · ")}`,
    `T12 claims   ${((A.claims ?? 0) / G).toFixed(1)} per game, false ${pc(A.lies ?? 0, A.claims ?? 0)}`,
  ].join("\n"));
  console.log(rows.at(-1) + "\n");
}
console.log(`${GAMES} games per row per skill. Bhukamp two ways (everyone), Teer Kaman at a role-named accusation.`);
