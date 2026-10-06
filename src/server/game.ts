// Room service: create / join / start / act / tick / view / chat. The engine is the only thing that changes state.
import { randomBytes, randomInt } from "node:crypto";
import { apply, start, waitingOn } from "@/engine/engine";
import { botAction, defaultAction } from "@/engine/decisions";
import { MAX_PLAYERS, MIN_PLAYERS, ROLE_TABLE } from "@/engine/setup";
import { RuleError, type Action, type GameState } from "@/engine/types";
import { viewFor, type PlayerView } from "@/engine/view";
import { ping, store, type ChatMessage, type GameRow, type Timers } from "./store";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const DEFAULT_TIMERS: Timers = { turn: 60, vote: 45, elim: 45 };
/** a bot's turn waits this long so the humans can follow what happened */
const BOT_DELAY_MS = 2500;
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
  const secs = k === "vote" || k === "batwara" ? timers.vote : k === "elim" ? timers.elim : timers.turn;
  return Date.now() + secs * 1000;
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
  for (const k of ["turn", "vote", "elim"] as const) {
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
    if (row.lobby.length >= MAX_PLAYERS) throw new HttpError(409, `The table is full (${MAX_PLAYERS})`);
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
    if (row.lobby.length >= MAX_PLAYERS) throw new HttpError(409, `The table is full (${MAX_PLAYERS})`);
    const taken = new Set(row.lobby.map((p) => p.name.toLowerCase()));
    const name = BOT_NAMES.map((n) => `${n} 🤖`).find((n) => !taken.has(n.toLowerCase())) ?? `Bot ${row.lobby.length + 1} 🤖`;
    row.lobby.push({ name, token: newToken(), bot: true });
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
  await mutate(code, (row) => {
    if (row.hostToken !== token) throw new HttpError(403, "Only the host can start");
    if (row.status !== "lobby") throw new HttpError(409, "Already started");
    if (row.lobby.length < MIN_PLAYERS) throw new HttpError(409, `Tunga needs at least ${MIN_PLAYERS} players`);
    // shuffle seats so join order doesn't decide who goes first
    for (let i = row.lobby.length - 1; i > 0; i--) { const j = randomInt(i + 1); [row.lobby[i], row.lobby[j]] = [row.lobby[j], row.lobby[i]]; }
    return commitState(row, start(row.lobby.map((p) => p.name), randomInt(2 ** 31)));
  });
}

// ------------------------------------------------------------------ play
const isBot = (row: GameRow, seat: number) => Boolean(row.lobby[seat]?.bot);

/** Bots answer votes and Batwara at once; their turns and eliminations wait BOT_DELAY_MS for a tick. */
function runBots(row: GameRow, s: GameState): GameState {
  for (let guard = 0; guard < 100; guard++) {
    const k = s.phase.kind;
    if (k !== "vote" && k !== "batwara") break;
    const bots = waitingOn(s).filter((seat) => isBot(row, seat));
    if (!bots.length) break;
    for (const seat of bots) if (waitingOn(s).includes(seat)) s = apply(s, seat, botAction(s, seat));
  }
  return s;
}

function commitState(row: GameRow, state: GameState): GameRow {
  state = runBots(row, state);
  const waiting = waitingOn(state);
  row.state = state;
  row.status = state.phase.kind === "over" ? "over" : "playing";
  row.deadline = waiting.length && waiting.every((seat) => isBot(row, seat))
    ? Date.now() + BOT_DELAY_MS
    : deadlineFor(state, row.timers);
  return row;
}

export async function act(code: string, token: string | null, action: Action) {
  await mutate(code, (row) => {
    if (!row.state) throw new HttpError(409, "The game hasn't started");
    const seat = seatOf(row, token);
    try {
      return commitState(row, apply(row.state, seat, action));
    } catch (e) {
      if (e instanceof RuleError) throw new HttpError(422, e.message);
      throw e;
    }
  });
}

/** Any phone may call this when the clock runs out; it does nothing unless the deadline really passed. */
export async function tick(code: string) {
  const row = await load(code);
  if (!row.state || row.deadline === null || Date.now() < row.deadline) return { applied: false };
  await mutate(code, (r) => {
    if (!r.state || r.deadline === null || Date.now() < r.deadline) return r;
    let s = r.state;
    const waiting = waitingOn(s);
    for (const seat of waiting) s = apply(s, seat, isBot(r, seat) ? botAction(s, seat) : defaultAction(s, seat));
    if (waiting.some((seat) => !isBot(r, seat))) s.events.push({ n: s.events.length, type: "timeout", to: "all", msg: "Time ran out — the default was played for anyone still deciding." });
    return commitState(r, s);
  });
  return { applied: true };
}

// ------------------------------------------------------------------ read
export interface ClientState {
  code: string;
  version: number;
  status: GameRow["status"];
  you: { seat: number; name: string; host: boolean };
  lobby: { names: string[]; bots: boolean[]; roleTable: Record<number, [number, number, number]> } | null;
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
    you: { seat, name: row.lobby[seat].name, host: row.hostToken === token },
    lobby: row.status === "lobby" ? { names: row.lobby.map((p) => p.name), bots: row.lobby.map((p) => Boolean(p.bot)), roleTable: ROLE_TABLE } : null,
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

/** Full-information game record for analysis — host only, and only once the game is over. */
export async function exportLog(code: string, token: string | null) {
  const row = await load(code);
  if (row.hostToken !== token) throw new HttpError(403, "Only the host can download the log");
  if (row.status !== "over") throw new HttpError(409, "Available when the game is over");
  const bots = row.lobby.flatMap((p, seat) => (p.bot ? [seat] : []));
  return { code: row.code, createdAt: row.createdAt, timers: row.timers, bots, state: row.state, messages: await store.messages(row.code, 0) };
}
