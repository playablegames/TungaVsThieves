// REAL GAMES vs THE BOT RULEBOOK (2026-10-14, designer: "analyse real games and improve bot logic").
// Reads every real-player game in analysis/logs (pulled from Supabase, git-ignored) and measures what HUMANS do next to
// what BOTS do in the same games — pairs played, Teer Kaman, Faisla, claims, votes — and replays every human ballot
// through today's rulebook (reason.ts) to see where the bots would have voted differently, and who was right.
//   npx tsx scripts/real-games.mts [since=2026-10-12] [botsSince=2026-10-14T04:14]
import { readdirSync, readFileSync } from "node:fs";
import type { GameEvent, GameState } from "@/engine/types";
import { ruleVote } from "@/server/reason";
import { SKILLS } from "@/server/belief";

const since = process.argv[2] ?? "2026-10-12";
// bot behaviour is counted only from games played under today's rulebook (pushed 2026-10-14 ~04:15 UTC)
const botsSince = process.argv[3] ?? "2026-10-14T04:14";
const REAL = /^(adi|aditya|chirag|chilyy|chilly|vj|pallavi)/i;
type G = { code: string; created_at: string; lobby: { name: string; bot?: boolean; skill?: string }[]; state: GameState };
const games: G[] = readdirSync("analysis/logs").filter((f) => /^2026-\d\d-\d\d_/.test(f) && f.slice(0, 10) >= since)
  .map((f) => JSON.parse(readFileSync(`analysis/logs/${f}`, "utf8")) as G)
  .filter((g) => g.lobby.some((p) => !p.bot && REAL.test(p.name)));

const num = (d: Record<string, unknown> | undefined, k: string) => (typeof d?.[k] === "number" ? (d[k] as number) : null);
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");
type Who = "human" | "bot";

// ---- 1. turns: pairs played when one was playable, by side and Stone
const turns: Record<string, { can: number; play: number }> = {};
const cardPlay: Record<string, Record<string, { can: number; play: number }>> = { human: {}, bot: {} };
// ---- 2. Teer Kaman: what was behind the shot
const tk: Record<string, { n: number; hit: number }> = {};
// ---- 3. Faisla: who went out
const faisla: Record<string, { calls: number; outT: number; outV: number; none: number }> = {};
// ---- 4. claims: true / false by side
const claims: Record<string, { n: number; truth: number }> = {};
// ---- 5. ballots: hit a thief?
const ballots: Record<string, { n: number; thief: number; abstain: number }> = {};
// ---- 6. human ballot vs the rulebook's ballot at that moment
const replay = { n: 0, same: 0, humanRight: 0, botRight: 0, bothRight: 0, botAbstain: 0, examples: [] as string[] };

for (const g of games) {
  const s = g.state;
  const who = (x: number): Who => (g.lobby[x]?.bot ? "bot" : "human");
  const counted = (x: number) => who(x) === "human" ? REAL.test(g.lobby[x].name) : g.created_at >= botsSince;
  // a seat's side at event n: its last private "role" event before n (the deal, then any Dal Badal), else its final side
  const sideAt = (x: number, n: number): "V" | "T" => {
    const r = s.events.findLast((e) => e.type === "role" && e.n < n && Array.isArray(e.to) && e.to[0] === x);
    return (r?.data?.side as "V" | "T" | undefined) ?? s.players[x].side;
  };
  for (const e of s.events) {
    const d = e.data;
    if (e.type === "analytics_turn") {
      const x = num(d, "seat")!; if (!counted(x) || !((d?.playable as string[]) ?? []).length) continue;
      const k = `${who(x)} ${d?.side === "T" ? "thief" : "villager"} ${(d?.stones as number) > 0 ? "WITH a Stone" : "no Stone"}`;
      turns[k] ??= { can: 0, play: 0 }; turns[k].can++; if (d?.played) turns[k].play++;
      for (const c of (d?.playable as string[]) ?? []) { const cp = (cardPlay[who(x)][c] ??= { can: 0, play: 0 }); cp.can++; if (d?.played === c) cp.play++; }
    }
    if (e.type === "teer_kaman") {
      const a = num(d, "seat")!, t = num(d, "target")!; if (!counted(a)) continue;
      const before = s.events.slice(0, e.n);
      const read = before.some((x) => x.type === "kundli_private" && Array.isArray(x.to) && x.to[0] === a && num(x.data, "target") === t);
      const openK = before.some((x) => x.type === "claim" && num(x.data, "target") === t && x.data?.side === "T" && typeof x.data?.role === "string" && num(x.data, "seat") !== a
        && before.some((k) => k.type === "kundli" && ((num(k.data, "seat") === num(x.data, "seat") && num(k.data, "target") === t) || (num(k.data, "seat") === t && num(k.data, "target") === num(x.data, "seat")))));
      const accused = before.some((x) => x.type === "claim" && num(x.data, "target") === t && x.data?.side === "T" && num(x.data, "seat") !== a);
      const why = read ? "own Kundli read" : openK ? "an open-Kundli accusation" : accused ? "someone accused them" : "nothing said";
      const k = `${who(a)} ${sideAt(a, e.n) === "T" ? "thief" : "villager"} — ${why}`;
      tk[k] ??= { n: 0, hit: 0 }; tk[k].n++; if (d?.hit) tk[k].hit++;
    }
    if (e.type === "faisla") {
      const a = num(d, "seat")!; if (!counted(a)) continue;
      const res = s.events.find((x) => x.n > e.n && x.type === "vote_result");
      const k = `${who(a)} ${sideAt(a, e.n) === "T" ? "thief" : "villager"}`;
      faisla[k] ??= { calls: 0, outT: 0, outV: 0, none: 0 }; faisla[k].calls++;
      const out = num(res?.data, "out");
      if (out === null) faisla[k].none++; else if (sideAt(out, res!.n) === "T") faisla[k].outT++; else faisla[k].outV++;
    }
    if (e.type === "claim" && d?.kind !== "stone" && d?.side) {
      const a = num(d, "seat")!, t = num(d, "target")!; if (a === t || !counted(a) || d?.heard) continue;
      const k = `${who(a)} ${sideAt(a, e.n) === "T" ? "thief" : "villager"}`;
      claims[k] ??= { n: 0, truth: 0 }; claims[k].n++; if (sideAt(t, e.n) === d.side) claims[k].truth++;
    }
    if (e.type === "vote_result") {
      const final = d?.reason === "final";
      for (const [vs, t] of Object.entries((d?.ballots ?? {}) as Record<string, number | null>)) {
        const v = Number(vs); if (!counted(v)) continue;
        const k = `${who(v)} ${sideAt(v, e.n) === "T" ? "thief" : "villager"} — ${final ? "mandatory vote" : "Faisla"}`;
        ballots[k] ??= { n: 0, thief: 0, abstain: 0 }; ballots[k].n++;
        if (t === null) ballots[k].abstain++; else if (sideAt(t, e.n) === "T") ballots[k].thief++;
        // replay a real VILLAGER's ballot through the rulebook at the same moment
        if (who(v) !== "human" || sideAt(v, e.n) !== "V") continue;
        const open = s.events.slice(0, e.n).findLast((x) => x.type === "ballots_open" || x.type === "final_vote" || x.type === "faisla");
        const cut = open ? open.n + 1 : e.n;
        const evs = s.events.slice(0, cut) as GameEvent[];
        const gone = new Set(evs.filter((x) => x.type === "eliminated").map((x) => x.data!.seat as number));
        const st = { ...s, events: evs, players: s.players.map((p) => ({ ...p, alive: !gone.has(p.seat), side: sideAt(p.seat, cut), role: p.role })),
          phase: { kind: "vote", reason: final ? "final" : "faisla", caller: null, debate: false, voters: [], ballots: {}, ready: [] } } as unknown as GameState;
        const bot = ruleVote(st, v, SKILLS.sharp, () => 0.5);
        replay.n++;
        const hRight = t !== null && sideAt(t, e.n) === "T", bRight = bot.target !== null && sideAt(bot.target, e.n) === "T";
        if (bot.target === t) replay.same++;
        if (bot.target === null) replay.botAbstain++;
        if (hRight && bRight) replay.bothRight++; else if (hRight) replay.humanRight++; else if (bRight) replay.botRight++;
        if (hRight && !bRight && replay.examples.length < 12) {
          const nm = (x: number | null) => (x === null ? "nobody" : s.players[x].name.replace(/ 🤖/, ""));
          replay.examples.push(`${g.code} ${final ? "final" : "Faisla"}: ${nm(v)} voted ${nm(t)} (a thief) — the bot would vote ${nm(bot.target)}: ${bot.why}`);
        }
      }
    }
  }
}

const table = (title: string, rows: [string, string][]) => { console.log(`\n${title}`); for (const [k, v] of rows.sort()) console.log(`  ${k.padEnd(52)} ${v}`); };
console.log(`${games.length} real-player games since ${since} (bots counted only since ${botsSince})`);
table("PAIRS PLAYED when one was playable", Object.entries(turns).map(([k, v]) => [k, `${pct(v.play, v.can)} of ${v.can} turns`]));
table("PAIR PLAYED, by card (when that card was playable)", (["human", "bot"] as const).flatMap((w) => Object.entries(cardPlay[w]).map(([c, v]): [string, string] => [`${w} ${c}`, `${pct(v.play, v.can)} of ${v.can}`])));
table("TEER KAMAN — what was behind the shot", Object.entries(tk).map(([k, v]) => [k, `${v.n} shots, ${v.hit} hit (${pct(v.hit, v.n)})`]));
table("FAISLA called — who went out", Object.entries(faisla).map(([k, v]) => [k, `${v.calls} calls: thief out ${v.outT}, villager out ${v.outV}, nobody ${v.none}`]));
table("CLAIMS (thief/villager) — true", Object.entries(claims).map(([k, v]) => [k, `${pct(v.truth, v.n)} true of ${v.n}`]));
table("BALLOTS — on a thief", Object.entries(ballots).map(([k, v]) => [k, `${pct(v.thief, v.n - v.abstain)} on a thief of ${v.n - v.abstain} (abstained ${v.abstain})`]));
console.log(`\nHUMAN VILLAGERS' BALLOTS REPLAYED THROUGH THE RULEBOOK (sharp): ${replay.n}`);
console.log(`  same ballot ${pct(replay.same, replay.n)} · both on a thief ${replay.bothRight} · only the HUMAN on a thief ${replay.humanRight} · only the BOT ${replay.botRight} · bot abstains ${replay.botAbstain}`);
for (const x of replay.examples) console.log(`  · ${x}`);
