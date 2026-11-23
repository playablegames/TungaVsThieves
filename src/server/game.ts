// Room service: make / join / start / move / clock / view / chat. (2026-11-19, revamp step 1) The rules are
// src/rules/game.ts (docs/RULES_ABSOLUTE.md) — the only thing that changes a game. The bots are src/rules/brain.ts,
// driven by ./bots.ts. Everything here is plumbing: who sits where, the clock, and what each phone may see.
import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { mailReport } from "./mail";
import { iceServers } from "./turn";
import { livekitConfigured, voicePasses } from "./livekit";
import { sendPush, type Alert } from "./push";
import { BotTable, talkyOf, type BotSeat } from "./bots";
import { ping, store, type ChatMessage, type GameRow, type Timers } from "./store";
import { NAME_MAX } from "@/lib/names";
import { filmFor } from "@/components/table/films";
import { ACTIONS, besideMe, closeVoteNow, move, newGame, RuleError, TABLE, timeoutMove, view, waitingOn, type Move, type State } from "@/rules/game";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** [2.8] [3.4] [3.6] every decision gets 45 seconds (owner 2026-11-21; was 20) */
export const DECISION_SECONDS = 45; // owner 2026-11-21: 20 s was "unplayable", make it 45
const DEFAULT_TIMERS: Timers = { turn: DECISION_SECONDS };
/** a bot's turn waits this long, so the table can follow it */
export const BOT_DELAY_MS = 4000; // owner 2026-11-21: "pace down the game" (was 1.5 s)
/** [75] each bot keeps its own pace (owner 2026-11-23: bots like people): a chatty one is quick, a quiet one slower,
 *  and a thief takes a little longer — a tell a player can learn. 3-5.5 s around the 4 s. */
function botDelayMs(row: GameRow, s: State, waiting: number[]): number {
  if (waiting.length !== 1) return BOT_DELAY_MS;
  const seat = waiting[0], name = row.lobby[seat]?.name ?? "";
  const pace = 0.75 + (0.9 - talkyOf(name)) / 0.45 * 0.6;
  return Math.round(BOT_DELAY_MS * pace * (s.players[seat]?.side === "T" ? 1.15 : 1));
}
/** [3.4] open vote: once everyone has voted, it closes this long after the last change (owner 2026-11-20: "you tell") */
export const VOTE_QUIET_MS = 5000;
/** [1.1] online tables seat 4-12 */
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 12;
/** every phone opens on the intro (your role, the deal); the first clock waits for it */
export const INTRO_MS = 7_000;
/** a human who times out this many decisions in a row gets a stand-in that plays safe (pass, no vote) */
const AWAY_AFTER = 2;
const BOT_SKILLS = ["average", "casual", "sharp"] as const;
const BOT_NAMES = ["Raju", "Shyam", "Babu Rao", "Pappu", "Munna", "Circuit", "Chintu", "Bunty", "Golu", "Tinku", "Gabbar"];
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
const newToken = () => randomBytes(24).toString("base64url");
const cleanName = (n: unknown) => {
  // counted by character ([...s]), so an emoji is never cut in half
  const s = [...String(n ?? "").replace(/\s+/g, " ").trim()].slice(0, NAME_MAX).join("").trim();
  if (!s) throw new HttpError(400, "Enter a name");
  return s;
};
const botName = (lobby: GameRow["lobby"]) => {
  // never a bot with a person's name ("Munna 🤖" beside "Munna · you" — owner's table 2026-11-21)
  const taken = new Set(lobby.map((p) => p.name.replace(/\s*🤖$/u, "").toLowerCase()));
  return BOT_NAMES.map((n) => `${n} 🤖`).find((n) => !taken.has(n.replace(/\s*🤖$/u, "").toLowerCase())) ?? `Bot ${lobby.length + 1} 🤖`;
};

async function load(code: string): Promise<GameRow> {
  const row = await store.get(code.toUpperCase());
  if (!row) throw new HttpError(404, "No game with that code");
  // a table from before the new rules (2026-11-19) can't be played on — its state has a different shape
  if (row.state && !Array.isArray((row.state as Partial<State>).played)) throw new HttpError(410, "This table is from the old version of the game — start a new one");
  return row;
}

function seatOf(row: GameRow, token: string | null): number {
  const i = row.lobby.findIndex((p) => p.token === token);
  if (i < 0) throw new HttpError(403, "You are not in this game");
  return i;
}

/** read-modify-write with optimistic concurrency; retried on a lost race */
async function mutate(code: string, f: (row: GameRow) => GameRow): Promise<GameRow> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await load(code);
    const next = f(structuredClone(row));
    next.version = row.version + 1;
    if (await store.update(next, row.version)) {
      await ping(next.code, next.version);
      return next;
    }
  }
  throw new HttpError(409, "The table is busy — try again");
}

/** a change to a game in progress: afterwards, phones that must now decide and are switched away get an alert */
async function play(code: string, f: (row: GameRow) => GameRow): Promise<GameRow> {
  let before: number[] = [];
  const next = await mutate(code, (row) => { before = row.state ? waitingOn(row.state) : []; return f(row); });
  await alertNewlyWaiting(next, before);
  return next;
}

// ------------------------------------------------------------------ seats the server plays
const isBot = (row: GameRow, seat: number) => Boolean(row.lobby[seat]?.bot);
/** lobby bots, and players a stand-in is covering */
const isAuto = (row: GameRow, seat: number) => isBot(row, seat) || Boolean(row.lobby[seat]?.away);
const botSeats = (row: GameRow): BotSeat[] =>
  row.lobby.flatMap((p, seat) => (p.bot ? [{ seat, name: p.name, skill: p.skill ?? "average" }] : []));

/** the move the server makes for a seat: a bot thinks; a stand-in only plays safe, so it never gives a player away */
function autoMove(row: GameRow, bots: BotTable, s: State, seat: number): Move {
  return isBot(row, seat) ? bots.decide(seat, s) : timeoutMove(s, seat);
}

/** FILMS HOLD THE GAME (owner 2026-11-21: "game is too fast, films are too slow"): every phone plays a film for these
 *  new public moments, so the clock and the bots wait that long first. Seconds per film (public/video), +0.5 s to land. */
function filmSeconds(file: string) {
  return file.startsWith("dal-badal") ? 3.5 : file.startsWith("final-vote") || file.startsWith("winner") || file === "teer-kaman-miss" ? 2.5 : 2;
}
function filmHoldMs(s: State, from: number): number {
  const events = s.events.filter((e) => e.to === "all");
  const name = (seat: number) => s.players[seat]?.name ?? "";
  let sec = 0;
  for (const e of events) if (e.n >= from) { const f = filmFor(e as never, events as never, name); if (f) sec += filmSeconds(f.file) + 0.5; }
  return Math.min(12, sec) * 1000; // the phone queues at most 4 films
}

/** decisions that wait on nobody's turn (votes, Bhukamp): the server's seats answer at once */
const INSTANT = new Set(["vote", "bhukamp"]);

/**
 * After a change: bots talk, the server's seats answer what doesn't wait (votes, Bhukamp), and the clock is set.
 * `from` = the first new event, so bots know what is news.
 */
function settle(row: GameRow, s: State, from: number, bots = new BotTable(botSeats(row), from, s)): GameRow {
  for (let guard = 0; guard < 50 && s.phase.kind !== "over"; guard++) {
    s = bots.talk(s);
    s = bots.aimed(s);
    if (!INSTANT.has(s.phase.kind)) break;
    const auto = waitingOn(s).filter((x) => isAuto(row, x));
    if (!auto.length) break;
    for (const seat of auto) if (waitingOn(s).includes(seat)) s = move(s, seat, autoMove(row, bots, s, seat));
  }
  s = bots.revote(s); // [3.4] open vote: bots look at the live count after every ballot and may swing
  const waiting = waitingOn(s);
  const prev = row.state?.phase;
  row.state = bots.flush(s);
  row.status = s.phase.kind === "over" ? "over" : "playing";
  const hold = filmHoldMs(s, from);
  const full = Date.now() + hold + (row.timers.turn || DECISION_SECONDS) * 1000;
  if (s.phase.kind === "vote") {
    // [3.4] OPEN VOTE (owner 2026-11-20): the clock does NOT restart on each ballot — it runs from when the vote opened.
    // Once everyone has voted, it closes VOTE_QUIET_MS after the last change (any change restarts that), never later.
    const same = prev?.kind === "vote" && prev.opened === s.phase.opened && row.deadline !== null;
    let at = same ? row.deadline! : full;
    if (!waiting.length) at = Math.min(at, Date.now() + VOTE_QUIET_MS);
    else if (waiting.every((x) => isAuto(row, x))) at = Math.min(at, Date.now() + hold + botDelayMs(row, s, waiting));
    row.deadline = at;
    return row;
  }
  row.deadline = s.phase.kind === "over" ? null
    : waiting.length && waiting.every((x) => isAuto(row, x)) ? Date.now() + hold + botDelayMs(row, s, waiting)
    : full;
  return row;
}

/** THE BOTS' SKILLS, set at the deal (owner 2026-11-23, steps 4+5). Skills go to SEATS before the roles are dealt, so
 *  neither side is helped. The share of skilled bots comes from the table size (measured on human-habit bots: a skilled
 *  table pulls 7p from 59% to 52% village, a beginner table pulls 8p from 42% to 47% and 6p from 45% to 48%), then
 *  moves with the least experienced person at the table: their first 3 games gentler, 10+ games tougher. */
export function skilledShare(players: number, games: number | undefined): number {
  const base = players === 7 ? 0.85 : players === 6 || players === 8 ? 0.15 : 0.5;
  const shift = games === undefined ? 0 : games < 3 ? -0.3 : games >= 10 ? 0.3 : 0;
  return Math.max(0, Math.min(1, base + shift));
}
function seatBotSkills(row: GameRow) {
  const bots = row.lobby.filter((p) => p.bot);
  const known = row.lobby.filter((p) => !p.bot && p.games !== undefined).map((p) => p.games!);
  const sharp = Math.round(skilledShare(row.lobby.length, known.length ? Math.min(...known) : undefined) * bots.length);
  // which bot seats get skill: a fair shuffle, so it isn't always the same names
  const order = bots.map((b, i) => ({ b, k: randomInt(1000) + i / 1000 })).sort((x, y) => x.k - y.k).map((x) => x.b);
  order.forEach((b, i) => { b.skill = i < sharp ? "sharp" : "casual"; });
}

/** deal a new game for this lobby and open it */
function deal(row: GameRow): GameRow {
  seatBotSkills(row);
  let s = newGame(row.lobby.map((p) => p.name), randomInt(2 ** 31));
  const bots = new BotTable(botSeats(row), 0, s);
  s = bots.opening(s);
  const next = settle(row, s, 0, bots);
  if (next.deadline !== null) next.deadline += INTRO_MS;
  return next;
}

// ------------------------------------------------------------------ lobby
/** a person's games played, as sent by their phone (a number 0-999, else unknown) */
const gamesOf = (g: unknown) => { const n = Math.floor(Number(g)); return Number.isFinite(n) && n >= 0 ? Math.min(999, n) : undefined; };

export async function createRoom(name: unknown, games?: unknown) {
  const token = newToken();
  for (let i = 0; i < 10; i++) {
    const row: GameRow = {
      code: newCode(), version: 1, status: "lobby", hostToken: token, lobby: [{ name: cleanName(name), token, games: gamesOf(games) }],
      state: null, deadline: null, timers: DEFAULT_TIMERS, createdAt: new Date().toISOString(),
    };
    if (await store.create(row)) return { code: row.code, token };
  }
  throw new HttpError(500, "Could not allocate a room code");
}

/** PLAY WITH BOTS in one call: you and the bots seated, dealt and started in a single write */
export async function createBotGame(name: unknown, count: unknown, games?: unknown) {
  const token = newToken();
  const k = Math.max(MIN_PLAYERS - 1, Math.min(MAX_PLAYERS - 1, Math.floor(Number(count) || MIN_PLAYERS - 1)));
  const lobby: GameRow["lobby"] = [{ name: cleanName(name), token, games: gamesOf(games) }];
  for (let i = 0; i < k; i++) lobby.push({ name: botName(lobby), token: newToken(), bot: true, skill: BOT_SKILLS[i % BOT_SKILLS.length] });
  shuffleSeats(lobby);
  for (let attempt = 0; attempt < 10; attempt++) {
    const row: GameRow = {
      code: newCode(), version: 1, status: "lobby", hostToken: token, lobby: structuredClone(lobby),
      state: null, deadline: null, timers: DEFAULT_TIMERS, createdAt: new Date().toISOString(),
    };
    if (await store.create(deal(row))) return { code: row.code, token };
  }
  throw new HttpError(500, "Could not allocate a room code");
}

/** seats are shuffled so join order never decides where you sit */
function shuffleSeats(lobby: GameRow["lobby"]) {
  for (let i = lobby.length - 1; i > 0; i--) { const j = randomInt(i + 1); [lobby[i], lobby[j]] = [lobby[j], lobby[i]]; }
}

export async function joinRoom(code: string, name: unknown, hops = 0, games?: unknown): Promise<{ code: string; token: string }> {
  const n = cleanName(name);
  const row = await load(code);
  // an old code after PLAY AGAIN leads on to the new table
  if (row.status === "over" && row.next && hops < 5) return joinRoom(row.next, name, hops + 1, games);
  // YOUR NAME IS YOUR SEAT: a player already here (new phone, cleared browser) gets their seat back by typing the same name
  const mine = row.lobby.find((p) => !p.bot && p.name.toLowerCase() === n.toLowerCase());
  if (mine) return { code: row.code, token: mine.token };
  const token = newToken();
  await mutate(row.code, (r) => {
    if (r.status !== "lobby") throw new HttpError(409, r.status === "over" ? "This game is over — ask the host for the new table's code" : "This game has already started — join with the name you played under to take your seat back");
    if (r.lobby.length >= MAX_PLAYERS) throw new HttpError(409, `The table is full (${MAX_PLAYERS})`);
    if (r.lobby.some((p) => p.name.toLowerCase() === n.toLowerCase())) throw new HttpError(409, "That name belongs to a bot here — pick another");
    r.lobby.push({ name: n, token, games: gamesOf(games) });
    return r;
  });
  return { code: row.code, token };
}

export async function addBot(code: string, token: string | null, count = 1) {
  const k = Math.max(1, Math.min(MAX_PLAYERS, Math.floor(Number(count) || 1)));
  await mutate(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can add bots");
    if (row.status !== "lobby") throw new HttpError(409, "This game has already started");
    for (let i = 0; i < k; i++) {
      if (row.lobby.length >= MAX_PLAYERS) throw new HttpError(409, `The table is full (${MAX_PLAYERS})`);
      const n = row.lobby.filter((p) => p.bot).length;
      row.lobby.push({ name: botName(row.lobby), token: newToken(), bot: true, skill: BOT_SKILLS[n % BOT_SKILLS.length] });
    }
    return row;
  });
}

/** you can rename yourself; the host can rename a bot */
export async function renameSeat(code: string, token: string | null, index: unknown, name: unknown) {
  const n = cleanName(name);
  await mutate(code, (row) => {
    if (row.status !== "lobby") throw new HttpError(409, "This game has already started");
    const i = Number(index);
    const p = row.lobby[i];
    if (!p) throw new HttpError(400, "No such seat");
    if (p.token !== token && !(p.bot && row.hostToken === token)) throw new HttpError(403, "You can only rename yourself");
    if (row.lobby.some((q, j) => j !== i && q.name.toLowerCase() === n.toLowerCase())) throw new HttpError(409, "That name is taken at this table");
    p.name = n;
    return row;
  });
}

/** the host takes a seat away in the lobby — a bot, or a player who shouldn't be there */
export async function removeBot(code: string, token: string | null, index: unknown) {
  await mutate(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can remove players");
    if (row.status !== "lobby") throw new HttpError(409, "This game has already started");
    const i = Number(index);
    if (!row.lobby[i]) throw new HttpError(400, "No such seat");
    if (row.lobby[i].token === row.hostToken) throw new HttpError(400, "The host can't remove themselves");
    row.lobby.splice(i, 1);
    return row;
  });
}

export async function startGame(code: string, token: string | null) {
  await play(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can start");
    if (row.status !== "lobby") throw new HttpError(409, "Already started");
    if (row.lobby.length < MIN_PLAYERS) throw new HttpError(409, `Tunga needs at least ${MIN_PLAYERS} players`);
    shuffleSeats(row.lobby);
    return deal(row);
  });
}

/** PLAY AGAIN: the host takes the same group (same names, same phones) to a fresh table; the old code points at it */
export async function rematch(code: string, token: string | null): Promise<{ code: string }> {
  const row = await load(code);
  if (row.hostToken !== token) throw new HttpError(403, "Only the host can start the next game");
  if (row.status !== "over" || !row.state) throw new HttpError(409, "The game isn't over yet");
  if (row.next) return { code: row.next };
  for (let i = 0; i < 10; i++) {
    const fresh: GameRow = {
      code: newCode(), version: 1, status: "lobby", hostToken: row.hostToken,
      lobby: row.lobby.map((p) => ({ name: p.name, token: p.token, ...(p.bot ? { bot: true, skill: p.skill ?? "average" } : {}), ...(p.push ? { push: p.push } : {}), ...(p.games !== undefined ? { games: p.games + 1 } : {}) })),
      state: null, deadline: null, timers: row.timers, createdAt: new Date().toISOString(),
    };
    if (!(await store.create(fresh))) continue;
    const moved = await mutate(code, (r) => { r.next ??= fresh.code; return r; });
    return { code: moved.next! };
  }
  throw new HttpError(500, "Could not allocate a room code");
}

// ------------------------------------------------------------------ play
const seat = z.number().int().min(0).max(MAX_PLAYERS - 1);
const card = z.enum([...ACTIONS, "DAL_BADAL", "TUNGA_STONE", "BHADRA_STONE"]);
const talk = z.discriminatedUnion("t", [
  z.object({ t: z.literal("claim"), role: z.string().max(20) }),
  z.object({ t: z.literal("accuse"), target: seat, role: z.string().max(20).optional() }),
  z.object({ t: z.literal("vouch"), target: seat }),
  z.object({ t: z.literal("stone"), target: seat, has: z.boolean(), which: z.enum(["TUNGA_STONE", "BHADRA_STONE"]).optional() }),
  z.object({ t: z.literal("saw_cards"), target: seat, cards: z.array(card).max(3) }),
  z.object({ t: z.literal("saw_role"), target: seat, role: z.string().max(20) }),
  z.object({ t: z.literal("ask"), target: seat, what: z.enum(["role", "stone"]) }),
  z.object({ t: z.literal("retract"), target: seat }),
  z.object({ t: z.literal("react"), emoji: z.enum(["cry", "cheer", "shock", "doubt", "angry", "shh"]) }),
]);
/** the shape of a move from a phone; the rules then check whether it is legal */
export const MoveSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("play"), card: z.enum(["FAISLA", "TALASHI", "KUNDLI", "HERA_PHERI", "BHUKAMP"]), target: seat.optional() }),
  z.object({ kind: z.literal("teer_kaman"), target: seat }),
  z.object({ kind: z.literal("shoot"), roles: z.array(z.string().max(20)).min(1).max(2) }),
  z.object({ kind: z.literal("say"), talk }),
  z.object({ kind: z.literal("dal_badal"), targets: z.array(seat).max(3) }),
  z.object({ kind: z.literal("pass") }),
  z.object({ kind: z.literal("give"), cards: z.array(card).max(3) }),
  z.object({ kind: z.literal("vote"), for: seat.nullable(), extra: z.boolean().optional() }),
  z.object({ kind: z.literal("bhukamp"), card }),
  z.object({ kind: z.literal("gift"), to: seat }),
]);

/** a phone makes a move — a card, a vote, a pass, or a line of talk */
export async function act(code: string, token: string | null, body: unknown) {
  const parsed = MoveSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(422, "That isn't a move");
  const m = parsed.data as Move;
  await play(code, (row) => {
    if (!row.state) throw new HttpError(409, "The game hasn't started");
    const at = seatOf(row, token);
    const p = row.lobby[at];
    const from = row.state.events.length;
    let s: State;
    try { s = move(row.state, at, m); } catch (e) {
      if (e instanceof RuleError) throw new HttpError(422, e.message);
      throw e;
    }
    // talk never touches the clock or the stand-in; a real move means the player is here
    if (m.kind === "say") { row.state = s; return settleTalk(row, s, from); }
    p.strikes = 0;
    if (p.away) { p.away = false; push(s, "back", `${p.name} is back.`, { seat: at }); }
    return settle(row, s, from);
  });
}

/** a line of talk: bots may answer it, but the clock keeps running as it was */
function settleTalk(row: GameRow, s: State, from: number): GameRow {
  const bots = new BotTable(botSeats(row), from, s);
  row.state = bots.flush(bots.talk(s));
  return row;
}

/** a server-side event every phone sees (stand-ins, time-outs) */
function push(s: State, type: string, msg: string, data?: Record<string, unknown>) {
  s.events.push({ n: s.events.length, to: "all", type, msg, data });
}

/** Any phone (or the server's sweep) may call this when the clock runs out; nothing happens unless it really ran out. */
export async function tick(code: string) {
  const row = await load(code);
  if (!row.state || row.deadline === null || Date.now() < row.deadline) return { applied: false };
  await play(code, (r) => {
    if (!r.state || r.deadline === null || Date.now() < r.deadline) return r;
    let s = r.state;
    const from = s.events.length;
    const bots = new BotTable(botSeats(r), from, s);
    const waiting = waitingOn(s);
    const humans = waiting.filter((x) => !isAuto(r, x));
    for (const x of waiting) {
      if (!waitingOn(s).includes(x)) continue;
      if (isAuto(r, x)) { s = move(s, x, autoMove(r, bots, s, x)); continue; }
      // [2.8] time ran out on a turn: the app passes for them AND picks the 3 to pass, in one go
      const wasTurn = s.phase.kind === "turn";
      s = move(s, x, timeoutMove(s, x));
      if (wasTurn && s.phase.kind === "pass" && s.phase.seat === x) s = move(s, x, timeoutMove(s, x));
    }
    // [3.4] the vote's clock ran out, or everyone voted and the table went quiet: count it
    if (s.phase.kind === "vote" && !waitingOn(s).length) s = closeVoteNow(s);
    if (humans.length && s.phase.kind !== "vote") push(s, "timeout", "Time ran out.", { seats: humans });
    // a human who keeps timing out gets a stand-in: the game never stalls on one phone
    for (const x of humans) {
      const p = r.lobby[x];
      p.strikes = (p.strikes ?? 0) + 1;
      if (p.strikes >= AWAY_AFTER && !p.away && s.phase.kind !== "over") {
        p.away = true;
        push(s, "away", `${p.name} has gone quiet — the game plays safe for them until they're back.`, { seat: x });
      }
    }
    return settle(r, s, from, bots);
  });
  return { applied: true };
}

/** the player taps "I'm back": the stand-in leaves their seat */
export async function reclaim(code: string, token: string | null) {
  await play(code, (row) => {
    const at = seatOf(row, token);
    const p = row.lobby[at];
    if (!p.away || !row.state) return row;
    p.away = false; p.strikes = 0;
    const s = row.state;
    const from = s.events.length;
    push(s, "back", `${p.name} is back.`, { seat: at });
    return settle(row, s, from);
  });
}

/** The server's clock: every room whose deadline has passed. Supabase pg_cron calls it every few seconds. */
export async function sweep(limit = 50) {
  const codes = await store.due(Date.now(), limit);
  let closed = 0;
  for (const code of codes) {
    try { if ((await tick(code)).applied) closed++; } catch { /* a lost race: a phone got there first */ }
  }
  return { due: codes.length, closed };
}

// ------------------------------------------------------------------ alerts
/** TURN ALERTS: a player who must now decide, whose phone has switched away, gets a web push. Never bots or stand-ins. */
async function alertNewlyWaiting(row: GameRow, before: number[]) {
  const s = row.state;
  if (!s || s.phase.kind === "over") return;
  const fresh = waitingOn(s).filter((x) => !before.includes(x));
  const k = s.phase.kind;
  const body = k === "turn" ? "Your turn — play a pair or pass."
    : k === "vote" ? (s.phase.final ? "The final vote — who goes out?" : "Faisla — vote now.")
    : k === "bhukamp" ? "Bhukamp — pass one card."
    : k === "gift" ? "You're out — give your extra vote."
    : "Your move.";
  const gone: number[] = [];
  await Promise.all(fresh.map(async (x) => {
    const p = row.lobby[x];
    if (!p || p.bot || p.away || !p.push || !p.hidden) return;
    const a: Alert = { title: "Tunga vs Thieves", body, url: `/g/${row.code}`, tag: `tunga-${row.code}` };
    if (!(await sendPush(p.push, a))) gone.push(x);
  }));
  if (gone.length) await mutate(row.code, (r) => { for (const x of gone) if (r.lobby[x]) r.lobby[x].push = null; return r; }).catch(() => {});
}

/** a phone turns its alerts on or off, or says it switched away / came back. Writes only when something changes. */
export async function setAlerts(code: string, token: string | null, body: { sub?: unknown; hidden?: unknown }) {
  const row = await load(code);
  const p = row.lobby[seatOf(row, token)];
  const sub = body.sub === undefined ? undefined : body.sub === null ? null : body.sub as GameRow["lobby"][number]["push"];
  if (sub && (typeof sub.endpoint !== "string" || !sub.endpoint.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth)) throw new HttpError(400, "Bad subscription");
  const hidden = body.hidden === undefined ? undefined : Boolean(body.hidden);
  if ((sub === undefined || JSON.stringify(sub) === JSON.stringify(p.push ?? null)) && (hidden === undefined || hidden === Boolean(p.hidden))) return;
  await mutate(code, (r) => {
    const q = r.lobby[seatOf(r, token)];
    if (sub !== undefined) q.push = sub;
    if (hidden !== undefined) q.hidden = hidden;
    return r;
  });
}

// ------------------------------------------------------------------ read
export type TableView = ReturnType<typeof view>;
export interface ClientState {
  code: string;
  version: number;
  status: GameRow["status"];
  you: { seat: number; name: string; host: boolean; away: boolean; alerts: boolean };
  /** before the game: who sits here, and the team sizes per table size ([1.2]) */
  lobby: { names: string[]; bots: boolean[]; table: typeof TABLE; min: number; max: number } | null;
  /** the game as this seat may see it (src/rules/game.ts view) */
  view: TableView | null;
  deadline: number | null;
  serverNow: number;
  messages: ChatMessage[];
  timers: Timers;
  voice: "livekit" | "mesh";
  /** which seat is the host's (seats are shuffled at the start) */
  host: number;
  /** seats a stand-in is covering */
  away: number[];
  bots: number[];
  /** seats the host has muted */
  muted: number[];
  /** PLAY AGAIN: the table the group moved on to */
  next: string | null;
}

export async function getState(code: string, token: string | null, sinceMsg: number): Promise<ClientState> {
  const row = await load(code);
  const at = seatOf(row, token);
  return {
    code: row.code,
    version: row.version,
    status: row.status,
    you: { seat: at, name: row.lobby[at].name, host: row.hostToken === token, away: Boolean(row.lobby[at].away), alerts: Boolean(row.lobby[at].push) },
    lobby: row.status === "lobby" ? { names: row.lobby.map((p) => p.name), bots: row.lobby.map((p) => Boolean(p.bot)), table: TABLE, min: MIN_PLAYERS, max: MAX_PLAYERS } : null,
    view: row.state ? view(row.state, at) : null,
    deadline: row.deadline,
    serverNow: Date.now(),
    messages: await store.messages(row.code, sinceMsg),
    timers: row.timers,
    voice: livekitConfigured() ? "livekit" : "mesh",
    host: row.lobby.findIndex((p) => p.token === row.hostToken),
    away: row.lobby.flatMap((p, i) => (p.away ? [i] : [])),
    bots: row.lobby.flatMap((p, i) => (p.bot ? [i] : [])),
    muted: row.lobby.flatMap((p, i) => (p.muted ? [i] : [])),
    next: row.next ?? null,
  };
}

// ------------------------------------------------------------------ chat, voice, moderation
/** one typed message every 2 seconds per player */
export const chatLimit = { gapMs: 2000 }; // tests set it to 0
const lastChat = new Map<string, number>();

/** typed chat — anyone at the table, out players too. Bots read only structured talk (a "say" move), not chat. */
export async function chat(code: string, token: string | null, text: unknown) {
  const row = await load(code);
  const at = seatOf(row, token);
  const t = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 50);
  if (!t) throw new HttpError(400, "Empty message");
  const key = `${row.code}:${at}`, now = Date.now();
  if (now - (lastChat.get(key) ?? 0) < chatLimit.gapMs) throw new HttpError(429, "Slow down — one message every 2 seconds");
  lastChat.set(key, now);
  await store.addMessage(row.code, { seat: at, name: row.lobby[at].name, text: t, phase: row.state?.phase.kind ?? "lobby" });
  await ping(row.code, row.version);
}

/** WHISPER (owner 2026-11-22: "chat is for coordination and scheming"): typed chat between TWO players. The words go
 *  only to the two of them; everyone sees THAT they whispered (a public `whisper_seen`), never what. Kept in the game's
 *  own log so view() hides it like any private event — no new table. Bots don't read chat (multiplayer first). */
export async function whisper(code: string, token: string | null, to: unknown, text: unknown) {
  const t = String(text ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!t) throw new HttpError(400, "Empty message");
  await mutate(code, (row) => {
    const s = row.state;
    if (!s || s.phase.kind === "over") throw new HttpError(409, "The game isn't on");
    const at = seatOf(row, token), seat = Number(to);
    const key = `${row.code}:${at}`, now = Date.now();
    if (now - (lastChat.get(key) ?? 0) < chatLimit.gapMs / 2) throw new HttpError(429, "Slow down");
    lastChat.set(key, now);
    if (!Number.isInteger(seat) || seat === at || !row.lobby[seat]) throw new HttpError(422, "Pick another player");
    if (row.lobby[seat].bot) throw new HttpError(422, "Bots don't read chat");
    if (!besideMe(s.players, at).includes(seat)) throw new HttpError(422, "Whisper only to the player on your left or right");
    s.events.push({ n: s.events.length, to: [at, seat], type: "whisper", msg: t, data: { seat: at, to: seat } });
    s.events.push({ n: s.events.length, to: "all", type: "whisper_seen", msg: `${row.lobby[at].name} whispers to ${row.lobby[seat].name}.`, data: { seat: at, to: seat } });
    return row;
  });
}

/** the host mutes or unmutes a player's voice for everyone (messages stay open) */
export async function mutePlayer(code: string, token: string | null, at: unknown, muted: unknown) {
  await mutate(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can mute");
    const p = row.lobby[Number(at)];
    if (!p || p.token === token) throw new HttpError(400, "Pick another player");
    p.muted = Boolean(muted);
    return row;
  });
}

/** LiveKit passes for this seat (null when LiveKit isn't set up — the phones fall back to the mesh). Out players speak too. */
export async function livekitPasses(code: string, token: string | null) {
  if (!livekitConfigured()) return null;
  const row = await load(code);
  const at = seatOf(row, token);
  return voicePasses(row.code, at, row.lobby[at].name, true, token!);
}

/** TURN/STUN servers for table voice; seated players only */
export async function voiceServers(code: string, token: string | null) {
  seatOf(await load(code), token);
  return iceServers();
}

/** REPORTS: a crash a phone caught, or a problem / player a person reported. People's reports are emailed to the owner
 *  (IT Rules 2021); with a code, kept in that game's log as a server-only line no phone ever sees. Never a token. */
export async function report(body: { kind?: unknown; code?: unknown; text?: unknown; where?: unknown }) {
  const kind = body.kind === "player" ? "player" : "crash";
  const text = String(body.text ?? "").slice(0, 2000).trim();
  if (!text) throw new HttpError(400, "Say what happened");
  const where = String(body.where ?? "").slice(0, 300);
  console.error(JSON.stringify({ report: kind, code: body.code ?? null, where, text: text.slice(0, 500) }));
  const code = typeof body.code === "string" ? body.code.toUpperCase().slice(0, 8) : "";
  if (kind === "player") {
    const head = text.startsWith("PLAYER REPORT") ? "Player reported" : "Problem reported";
    await mailReport(`[Tunga] ${head}${code ? ` at table ${code}` : ""}`, `${text}\n\nTable: ${code || "(none)"}\nPage: ${where}\nTime: ${new Date().toISOString()}\n\nAcknowledge within 24 hours, answer within 15 days (IT Rules 2021).`);
  }
  if (!code) return;
  await mutate(code, (row) => {
    if (!row.state || row.state.events.filter((e) => e.type === "report").length >= 50) return row;
    row.state.events.push({ n: row.state.events.length, to: [], type: "report", msg: text, data: { kind, where } });
    return row;
  }).catch(() => {});
}

/** the full game record for analysis — host only, once the game is over */
export async function exportLog(code: string, token: string | null) {
  const row = await load(code);
  if (row.hostToken !== token) throw new HttpError(403, "Only the host can download the log");
  if (row.status !== "over") throw new HttpError(409, "Available when the game is over");
  return { code: row.code, createdAt: row.createdAt, timers: row.timers, bots: botSeats(row).map((b) => b.seat), state: row.state, messages: await store.messages(row.code, 0) };
}

/** what a code leads to BEFORE you type your name: only whether it takes players and how many sit there */
export async function peekRoom(code: string, hops = 0): Promise<{ code: string; open: boolean; players: number; max: number; reason: string | null }> {
  const row = await load(code);
  if (row.status === "over" && row.next && hops < 5) return peekRoom(row.next, hops + 1);
  const full = row.lobby.length >= MAX_PLAYERS;
  const reason = row.status === "over" ? "This game is over — ask for the new table's code"
    : row.status !== "lobby" ? "This game has already started — join with the name you played under to take your seat back"
    : full ? `The table is full (${MAX_PLAYERS})` : null;
  return { code: row.code, open: row.status === "lobby" && !full, players: row.lobby.length, max: MAX_PLAYERS, reason };
}
