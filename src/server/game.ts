// Room service: create / join / start / act / tick / view / chat. The engine is the only thing that changes state.
import { iceServers } from "./turn";
import { randomBytes, randomInt } from "node:crypto";
import { apply, closeVote, start, waitingOn } from "@/engine/engine";
import { botAction, defaultAction } from "@/engine/decisions";
import { botTalk, botVote } from "./botmind";
import { MIN_PLAYERS, ROLE_TABLE, THIEF_ROLES } from "@/engine/setup";
import { RuleError, type Action, type GameState } from "@/engine/types";
import { viewFor, type PlayerView } from "@/engine/view";
import { holdFor } from "@/lib/beats";
import { ping, store, type ChatMessage, type GameRow, type Timers } from "./store";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const DEFAULT_TIMERS: Timers = { turn: 60, vote: 45, elim: 45, debate: 90 };
const EXTEND_SECONDS = 30;
/** the open floor scales with who is still talking: 45s for a small table, up to the debate cap (90s) at 15+ */
export const debateSeconds = (living: number, cap: number) => Math.min(cap, Math.max(45, 5 * living + 15));
/** a bot's turn waits this long AFTER the table has watched the last beat */
// playtest 2026-10-07: 1.2s made a table of bots a blur
export const BOT_DELAY_MS = 3000;
/** open voting: everyone has voted and nobody has changed their mind for this long — the vote closes */
export const VOTE_SETTLE_MS = 10_000;
/** online tables seat at most this many (designer 2026-10-07): the seat ring and phone-to-phone voice are only proven
 *  this far. The engine plays 4-30; raise this once big tables have their own layout and a voice relay. */
export const ONLINE_MAX_PLAYERS = 12;
/** the intro every phone shows when the game starts (RoleReveal.tsx): role 15s, the Stones 10s, the deal 8.4s (DealIntro.tsx) */
export const INTRO_MS = 34_000;
const BOT_NAMES = ["Raju", "Shyam", "Babu Rao", "Pappu", "Munna", "Circuit", "Chintu", "Bunty", "Golu", "Tinku",
  "Gabbar", "Basanti", "Mogambo", "Jhumru", "Lallan", "Kallu", "Bholu", "Chhotu", "Guddu", "Sonu",
  "Monu", "Titu", "Bablu", "Pinky", "Dolly", "Rinku", "Mintu", "Sweety", "Lucky", "Happy"];
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
const newToken = () => randomBytes(24).toString("base64url");
const cleanName = (n: unknown) => {
  const s = String(n ?? "").replace(/\s+/g, " ").trim().slice(0, 20);
  if (!s) throw new HttpError(400, "Enter a name");
  return s;
};

async function load(code: string): Promise<GameRow> {
  const row = await store.get(code.toUpperCase());
  if (!row) throw new HttpError(404, "No game with that code");
  return row;
}

function seatOf(row: GameRow, token: string | null): number {
  const i = row.lobby.findIndex((p) => p.token === token);
  if (i < 0) throw new HttpError(403, "You are not in this game");
  return i;
}

function deadlineFor(state: GameState, timers: Timers): number | null {
  const k = state.phase.kind;
  if (k === "over") return null;
  const secs = k === "vote" && state.phase.debate
    ? debateSeconds(state.players.filter((p) => p.alive).length, timers.debate ?? DEFAULT_TIMERS.debate!)
    : k === "vote" || k === "batwara" ? timers.vote : k === "elim" ? timers.elim : timers.turn;
  return Date.now() + secs * 1000;
}

/** read-modify-write with optimistic concurrency; retried on a lost race */
/** A state change at a table with bots: after it lands, the bots say what they make of it (botmind). */
async function play(code: string, f: (row: GameRow) => GameRow): Promise<GameRow> {
  let from = 0;
  const next = await mutate(code, (row) => { from = row.state?.events.length ?? 0; return f(row); });
  const bots = next.lobby.flatMap((p, seat) => (p.bot ? [seat] : []));
  if (!next.state || !bots.length) return next;
  const lines = botTalk(next.state, from, bots, next.state.seed, Math.random);
  for (const l of lines) await store.addMessage(next.code, { seat: l.seat, name: next.lobby[l.seat].name, text: l.text, phase: next.state.phase.kind });
  if (lines.length) await ping(next.code, next.version);
  return next;
}

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

// ------------------------------------------------------------------ lobby
export async function createRoom(name: unknown, timers?: Partial<Timers>) {
  const token = newToken();
  for (let i = 0; i < 10; i++) {
    const row: GameRow = {
      code: newCode(), version: 1, status: "lobby", hostToken: token,
      lobby: [{ name: cleanName(name), token }], state: null, deadline: null,
      timers: { ...DEFAULT_TIMERS, ...sanitizeTimers(timers) }, createdAt: new Date().toISOString(),
    };
    if (await store.create(row)) return { code: row.code, token };
  }
  throw new HttpError(500, "Could not allocate a room code");
}

function sanitizeTimers(t?: Partial<Timers>): Partial<Timers> {
  const out: Partial<Timers> = {};
  for (const k of ["turn", "vote", "elim", "debate"] as const) {
    const v = Number(t?.[k]);
    if (Number.isFinite(v) && v >= 15 && v <= 600) out[k] = Math.round(v);
  }
  return out;
}

export async function joinRoom(code: string, name: unknown) {
  const n = cleanName(name);
  const token = newToken();
  await mutate(code, (row) => {
    if (row.status !== "lobby") throw new HttpError(409, "This game has already started");
    if (row.lobby.length >= ONLINE_MAX_PLAYERS) throw new HttpError(409, `The table is full (${ONLINE_MAX_PLAYERS})`);
    if (row.lobby.some((p) => p.name.toLowerCase() === n.toLowerCase())) throw new HttpError(409, "That name is taken at this table");
    row.lobby.push({ name: n, token });
    return row;
  });
  return { code: code.toUpperCase(), token };
}

export async function addBot(code: string, token: string | null) {
  await mutate(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can add bots");
    if (row.status !== "lobby") throw new HttpError(409, "This game has already started");
    if (row.lobby.length >= ONLINE_MAX_PLAYERS) throw new HttpError(409, `The table is full (${ONLINE_MAX_PLAYERS})`);
    const taken = new Set(row.lobby.map((p) => p.name.toLowerCase()));
    const name = BOT_NAMES.map((n) => `${n} 🤖`).find((n) => !taken.has(n.toLowerCase())) ?? `Bot ${row.lobby.length + 1} 🤖`;
    row.lobby.push({ name, token: newToken(), bot: true });
    return row;
  });
}

/** The pencil in the lobby: you can rename yourself, and the host can rename a bot. */
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

export async function removeBot(code: string, token: string | null, index: unknown) {
  await mutate(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can remove bots");
    if (row.status !== "lobby") throw new HttpError(409, "This game has already started");
    const i = Number(index);
    if (!row.lobby[i]?.bot) throw new HttpError(400, "That seat isn't a bot");
    row.lobby.splice(i, 1);
    return row;
  });
}

export async function startGame(code: string, token: string | null) {
  await play(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can start");
    if (row.status !== "lobby") throw new HttpError(409, "Already started");
    if (row.lobby.length < MIN_PLAYERS) throw new HttpError(409, `Tunga needs at least ${MIN_PLAYERS} players`);
    // shuffle seats so join order doesn't decide who goes first
    for (let i = row.lobby.length - 1; i > 0; i--) { const j = randomInt(i + 1); [row.lobby[i], row.lobby[j]] = [row.lobby[j], row.lobby[i]]; }
    const first = start(row.lobby.map((p) => p.name), randomInt(2 ** 31));
    first.voteUntilClock = true; // open voting: change your vote until the clock runs out
    const next = commitState(row, first);
    // every phone opens on the intro (role, then the Stones), so the first clock waits for it
    if (next.deadline !== null) next.deadline += INTRO_MS;
    return next;
  });
}

// ------------------------------------------------------------------ play
const isBot = (row: GameRow, seat: number) => Boolean(row.lobby[seat]?.bot);
/** seats the server plays: lobby bots, and players who went quiet */
const isAuto = (row: GameRow, seat: number) => isBot(row, seat) || Boolean(row.lobby[seat]?.away);
/** a bot plays like a player; a stand-in for someone who went quiet only plays safe (pass, abstain) so it never leaks their role */
const autoAction = (row: GameRow, s: GameState, seat: number): Action => {
  if (!isBot(row, seat)) return defaultAction(s, seat);
  // a bot votes on what it has seen and heard (botmind), not at random
  if (s.phase.kind === "vote" && !s.phase.debate) return { type: "vote", target: botVote(s, seat, s.seed, Math.random) };
  return botAction(s, seat);
};
const AWAY_AFTER = 2; // consecutive timeouts before a stand-in takes the seat

/** Bots answer votes and Batwara at once; their turns and eliminations wait BOT_DELAY_MS for a tick. */
function runBots(row: GameRow, s: GameState): GameState {
  for (let guard = 0; guard < 100; guard++) {
    const k = s.phase.kind;
    if (k !== "vote" && k !== "batwara") break;
    const bots = waitingOn(s).filter((seat) => isAuto(row, seat));
    if (!bots.length) break;
    for (const seat of bots) if (waitingOn(s).includes(seat)) s = apply(s, seat, autoAction(row, s, seat));
  }
  return s;
}

function commitState(row: GameRow, state: GameState): GameRow {
  const before = row.state?.events.length ?? 0;
  // open voting: a ballot (or a changed one) never restarts the clock — the vote runs until its deadline
  const ballotsWereOpen = row.state?.phase.kind === "vote" && !row.state.phase.debate;
  const prevBallots = row.state?.phase.kind === "vote" ? JSON.stringify(row.state.phase.ballots) : null;
  const prevDeadline = row.deadline;
  state = runBots(row, state);
  // the Table Stage: no clock runs while every phone is still showing what just happened
  const hold = holdFor(state.events.slice(before), row.lobby.map((p) => p.name));
  const waiting = waitingOn(state);
  row.state = state;
  row.status = state.phase.kind === "over" ? "over" : "playing";
  const base = waiting.length && waiting.every((seat) => isAuto(row, seat))
    ? Date.now() + BOT_DELAY_MS
    : deadlineFor(state, row.timers);
  row.deadline = base === null ? null : base + hold;
  if (state.voteUntilClock && state.phase.kind === "vote" && !state.phase.debate && row.deadline !== null) {
    // the clock the ballot opened with; a ballot (or a changed one) never extends it
    if (!ballotsWereOpen || state.voteClockEnd === undefined) state.voteClockEnd = row.deadline;
    row.deadline = state.voteClockEnd;
    // (designer 2026-10-07) once everyone has voted, it closes after VOTE_SETTLE_MS with no change; a change restarts the wait
    if (waiting.length === 0) {
      // the same vote sent again is not a change: it doesn't restart the wait
      const changed = !ballotsWereOpen || JSON.stringify(state.phase.ballots) !== prevBallots || prevDeadline === null;
      row.deadline = Math.min(state.voteClockEnd, changed ? Date.now() + VOTE_SETTLE_MS : prevDeadline!);
    }
  } else if (state.voteClockEnd !== undefined) delete state.voteClockEnd;
  return row;
}

export async function act(code: string, token: string | null, action: Action) {
  await play(code, (row) => {
    if (!row.state) throw new HttpError(409, "The game hasn't started");
    const seat = seatOf(row, token);
    const p = row.lobby[seat];
    p.strikes = 0;
    try {
      const next = apply(row.state, seat, action);
      if (p.away) { p.away = false; next.events.push({ n: next.events.length, type: "back", to: "all", msg: `${p.name} is back.`, data: { seat } }); }
      return commitState(row, next);
    } catch (e) {
      if (e instanceof RuleError) throw new HttpError(422, e.message);
      throw e;
    }
  });
}

/** The host adds time to the open floor — once per debate. Everyone sees it happen. */
export async function extendDebate(code: string, token: string | null) {
  await mutate(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can add time");
    const ph = row.state?.phase;
    if (!ph || ph.kind !== "vote" || !ph.debate) throw new HttpError(409, "The floor isn't open");
    if (ph.extended) throw new HttpError(409, "Time was already added to this debate");
    ph.extended = true;
    row.deadline = (row.deadline ?? Date.now()) + EXTEND_SECONDS * 1000;
    const s = row.state!;
    s.events.push({ n: s.events.length, type: "floor_extended", to: "all", msg: `The host adds ${EXTEND_SECONDS} seconds to the debate.` });
    return row;
  });
}

/** Any phone may call this when the clock runs out; it does nothing unless the deadline really passed. */
export async function tick(code: string) {
  const row = await load(code);
  if (!row.state || row.deadline === null || Date.now() < row.deadline) return { applied: false };
  await play(code, (r) => {
    if (!r.state || r.deadline === null || Date.now() < r.deadline) return r;
    let s = r.state;
    const waiting = waitingOn(s);
    const floorClosing = s.phase.kind === "vote" && s.phase.debate; // the debate ending on time is normal, not a timeout
    for (const seat of waiting) s = apply(s, seat, isAuto(r, seat) ? autoAction(r, s, seat) : defaultAction(s, seat));
    // a human who keeps timing out gets a stand-in (BGA's "zombie"): the game never stalls on one phone
    if (!floorClosing) for (const seat of waiting.filter((x) => !isAuto(r, x))) {
      const p = r.lobby[seat];
      p.strikes = (p.strikes ?? 0) + 1;
      if (p.strikes >= AWAY_AFTER && s.phase.kind !== "over") {
        p.away = true;
        s.events.push({ n: s.events.length, type: "away", to: "all", msg: `${p.name} has gone quiet — a stand-in plays safe for them until they're back.`, data: { seat } });
      }
    }
    // open voting: time is up — the vote stands as it is now
    if (s.voteUntilClock && s.phase.kind === "vote" && !s.phase.debate) s = closeVote(s);
    if (!floorClosing && waiting.some((seat) => !isAuto(r, seat))) s.events.push({ n: s.events.length, type: "timeout", to: "all", msg: "Time ran out — the default was played for anyone still deciding." });
    return commitState(r, s);
  });
  return { applied: true };
}

/** The player taps "I'm back" — the stand-in leaves their seat. */
export async function reclaim(code: string, token: string | null) {
  await play(code, (row) => {
    const seat = seatOf(row, token);
    const p = row.lobby[seat];
    if (!p.away || !row.state) return row;
    p.away = false; p.strikes = 0;
    const s = row.state;
    s.events.push({ n: s.events.length, type: "back", to: "all", msg: `${p.name} is back.`, data: { seat } });
    return commitState(row, s);
  });
}

/** The server's clock: close every room whose deadline has passed. Safe to call from anywhere, any time —
 *  tick() does nothing unless a deadline really passed. Supabase pg_cron calls it every few seconds. */
export async function sweep(limit = 50) {
  const codes = await store.due(Date.now(), limit);
  let closed = 0;
  for (const code of codes) {
    try { if ((await tick(code)).applied) closed++; } catch { /* a lost race: a phone got there first */ }
  }
  return { due: codes.length, closed };
}

// ------------------------------------------------------------------ read
export interface ClientState {
  code: string;
  version: number;
  status: GameRow["status"];
  you: { seat: number; name: string; host: boolean; away: boolean };
  lobby: { names: string[]; bots: boolean[]; roleTable: Record<number, [number, number, number]>; max: number } | null;
  view: PlayerView | null;
  deadline: number | null;
  serverNow: number;
  messages: ChatMessage[];
  timers: Timers;
}

export async function getState(code: string, token: string | null, sinceMsg: number): Promise<ClientState> {
  const row = await load(code);
  const seat = seatOf(row, token);
  return {
    code: row.code,
    version: row.version,
    status: row.status,
    you: { seat, name: row.lobby[seat].name, host: row.hostToken === token, away: Boolean(row.lobby[seat].away) },
    lobby: row.status === "lobby" ? { names: row.lobby.map((p) => p.name), bots: row.lobby.map((p) => Boolean(p.bot)), roleTable: ROLE_TABLE, max: ONLINE_MAX_PLAYERS } : null,
    view: row.state ? viewFor(row.state, seat) : null,
    deadline: row.deadline,
    serverNow: Date.now(),
    messages: await store.messages(row.code, sinceMsg),
    timers: row.timers,
  };
}

export async function chat(code: string, token: string | null, text: unknown) {
  const row = await load(code);
  const seat = seatOf(row, token);
  const t = String(text ?? "").trim().slice(0, 300);
  if (!t) throw new HttpError(400, "Empty message");
  const s = row.state;
  if (s && s.phase.kind !== "over" && !s.players[seat].alive) throw new HttpError(403, "Eliminated players stay silent");
  await store.addMessage(row.code, { seat, name: row.lobby[seat].name, text: t, phase: s ? s.phase.kind : "lobby" });
  await ping(row.code, row.version);
}

/** A claim out loud — "I read X's Kundli: Lootera", "X is a thief", "X is with the village". A public event the
 *  whole table (and every bot) reads; it changes nothing in the game itself, and a claim may be a lie. */
export type ClaimKind = "kundli" | "accuse" | "trust";
export async function claim(code: string, token: string | null, body: { kind?: unknown; target?: unknown; role?: unknown }) {
  await play(code, (row) => {
    const s = row.state;
    if (!s || s.phase.kind === "over") throw new HttpError(409, "No game in progress");
    const seat = seatOf(row, token);
    if (!s.players[seat].alive) throw new HttpError(403, "Eliminated players stay silent");
    const kind = String(body.kind) as ClaimKind;
    if (!["kundli", "accuse", "trust"].includes(kind)) throw new HttpError(400, "Unknown claim");
    const target = Number(body.target);
    if (!s.players[target]?.alive || target === seat) throw new HttpError(400, "Pick another living player");
    let role: string | undefined;
    if (kind === "kundli") {
      role = String(body.role ?? "");
      if (!s.rolesInPlay.includes(role)) throw new HttpError(400, "Name a role in this game");
    }
    const side = kind === "accuse" ? "T" : kind === "trust" ? "V" : THIEF_ROLES.includes(role!) ? "T" : "V";
    const me = s.players[seat].name, them = s.players[target].name;
    const msg = kind === "kundli" ? `${me}: "I read ${them}'s Kundli — ${role}, ${side === "T" ? "a thief" : "a villager"}."`
      : kind === "accuse" ? `${me}: "${them} is a thief."` : `${me}: "${them} is with the village."`;
    s.events.push({ n: s.events.length, type: "claim", to: "all", msg, data: { seat, kind, target, role: role ?? null, side } });
    row.state = s;
    return row;
  });
}

/** TURN/STUN servers for table voice; seated players only. */
export async function voiceServers(code: string, token: string | null) {
  seatOf(await load(code), token);
  return iceServers();
}

/** Full-information game record for analysis — host only, and only once the game is over. */
export async function exportLog(code: string, token: string | null) {
  const row = await load(code);
  if (row.hostToken !== token) throw new HttpError(403, "Only the host can download the log");
  if (row.status !== "over") throw new HttpError(409, "Available when the game is over");
  const bots = row.lobby.flatMap((p, seat) => (p.bot ? [seat] : []));
  return { code: row.code, createdAt: row.createdAt, timers: row.timers, bots, state: row.state, messages: await store.messages(row.code, 0) };
}
