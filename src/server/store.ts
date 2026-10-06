// Persistence. Two implementations behind one interface:
//   memory   - dev/tests, one Node process (`npm run dev`), clients poll
//   supabase - production; service-role key only, RLS on with NO policies (clients never touch tables)
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GameState } from "@/engine/types";

export interface Timers { turn: number; vote: number; elim: number }

export interface GameRow {
  code: string;
  version: number;
  status: "lobby" | "playing" | "over";
  hostToken: string;
  lobby: { name: string; token: string; bot?: boolean }[];
  state: GameState | null;
  deadline: number | null;
  timers: Timers;
  createdAt: string;
}

export interface ChatMessage { id: number; seat: number; name: string; text: string; at: string; phase: string }

export interface Store {
  get(code: string): Promise<GameRow | null>;
  create(row: GameRow): Promise<boolean>;
  /** optimistic write: succeeds only if the stored version is still `expected` */
  update(row: GameRow, expected: number): Promise<boolean>;
  addMessage(code: string, m: Omit<ChatMessage, "id" | "at">): Promise<void>;
  messages(code: string, sinceId: number): Promise<ChatMessage[]>;
}

// ------------------------------------------------------------------ memory
type Mem = { games: Map<string, GameRow>; chat: Map<string, ChatMessage[]>; seq: number };
const mem: Mem = ((globalThis as unknown as { __tunga?: Mem }).__tunga ??= { games: new Map(), chat: new Map(), seq: 0 });

export const memoryStore: Store = {
  async get(code) { const r = mem.games.get(code); return r ? structuredClone(r) : null; },
  async create(row) { if (mem.games.has(row.code)) return false; mem.games.set(row.code, structuredClone(row)); return true; },
  async update(row, expected) {
    const cur = mem.games.get(row.code);
    if (!cur || cur.version !== expected) return false;
    mem.games.set(row.code, structuredClone(row));
    return true;
  },
  async addMessage(code, m) {
    const list = mem.chat.get(code) ?? [];
    list.push({ ...m, id: ++mem.seq, at: new Date().toISOString() });
    mem.chat.set(code, list.slice(-500));
  },
  async messages(code, since) { return (mem.chat.get(code) ?? []).filter((m) => m.id > since); },
};

// ------------------------------------------------------------------ supabase
function supabaseStore(sb: SupabaseClient): Store {
  const toRow = (d: Record<string, unknown>): GameRow => ({
    code: d.code as string, version: d.version as number, status: d.status as GameRow["status"],
    hostToken: d.host_token as string, lobby: d.lobby as GameRow["lobby"], state: d.state as GameState | null,
    deadline: d.deadline as number | null, timers: d.timers as Timers, createdAt: d.created_at as string,
  });
  const fromRow = (r: GameRow) => ({
    code: r.code, version: r.version, status: r.status, host_token: r.hostToken, lobby: r.lobby,
    state: r.state, deadline: r.deadline, timers: r.timers,
  });
  return {
    async get(code) {
      const { data, error } = await sb.from("games").select("*").eq("code", code).maybeSingle();
      if (error) throw error;
      return data ? toRow(data) : null;
    },
    async create(row) {
      const { error } = await sb.from("games").insert(fromRow(row));
      if (error && error.code === "23505") return false; // code taken
      if (error) throw error;
      return true;
    },
    async update(row, expected) {
      const { data, error } = await sb.from("games").update(fromRow(row)).eq("code", row.code).eq("version", expected).select("code");
      if (error) throw error;
      return (data ?? []).length === 1;
    },
    async addMessage(code, m) {
      const { error } = await sb.from("messages").insert({ code, seat: m.seat, name: m.name, text: m.text, phase: m.phase });
      if (error) throw error;
    },
    async messages(code, since) {
      const { data, error } = await sb.from("messages").select("*").eq("code", code).gt("id", since).order("id").limit(200);
      if (error) throw error;
      return (data ?? []).map((d) => ({ id: d.id, seat: d.seat, name: d.name, text: d.text, at: d.created_at, phase: d.phase }));
    },
  };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const usingSupabase = Boolean(url && service);
export const store: Store = usingSupabase
  ? supabaseStore(createClient(url!, service!, { auth: { persistSession: false } }))
  : memoryStore;

/** Tell every phone in the game that something changed. Carries NO game information. */
export async function ping(code: string, version: number): Promise<void> {
  if (!usingSupabase) return; // memory mode: clients poll
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: service!, Authorization: `Bearer ${service}` },
      body: JSON.stringify({ messages: [{ topic: `game:${code}`, event: "v", payload: { version } }] }),
    });
  } catch {
    /* a missed ping only delays an update until the client's fallback poll */
  }
}
