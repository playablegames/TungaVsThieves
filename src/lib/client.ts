"use client";
// Phone-side API + live updates. The phone only ever holds its own token and its own redacted view.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Action } from "@/engine/types";
import type { ClientState } from "@/server/game";
import type { ChatMessage } from "@/server/store";

const KEY = (code: string) => `tunga:${code.toUpperCase()}`;
// per-tab copy first (so several test tabs in one browser can each be a different player), then the phone-wide copy
export const saveToken = (code: string, token: string) => {
  sessionStorage.setItem(KEY(code), token);
  localStorage.setItem(KEY(code), token);
};
export const loadToken = (code: string) =>
  typeof window === "undefined" ? null : sessionStorage.getItem(KEY(code)) ?? localStorage.getItem(KEY(code));

async function call<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.token ? { "x-player-token": init.token } : {}) },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Error ${res.status}`);
  return json as T;
}

export const api = {
  create: (name: string) => call<{ code: string; token: string }>("/api/games", { method: "POST", body: JSON.stringify({ name }) }),
  join: (code: string, name: string) =>
    call<{ code: string; token: string }>(`/api/games/${code}/join`, { method: "POST", body: JSON.stringify({ name }) }),
  start: (code: string, token: string) => call(`/api/games/${code}/start`, { method: "POST", token }),
  act: (code: string, token: string, a: Action) => call(`/api/games/${code}/act`, { method: "POST", token, body: JSON.stringify(a) }),
  addBot: (code: string, token: string) => call(`/api/games/${code}/bots`, { method: "POST", token }),
  removeBot: (code: string, token: string, index: number) =>
    call(`/api/games/${code}/bots`, { method: "DELETE", token, body: JSON.stringify({ index }) }),
  tick: (code: string) => call<{ applied: boolean }>(`/api/games/${code}/tick`, { method: "POST" }),
  chat: (code: string, token: string, text: string) =>
    call(`/api/games/${code}/chat`, { method: "POST", token, body: JSON.stringify({ text }) }),
  state: (code: string, token: string, since: number) => call<ClientState>(`/api/games/${code}/state?since=${since}`, { token }),
  log: (code: string, token: string) => call<unknown>(`/api/games/${code}/log`, { token }),
};

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SB_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const realtime = SB_URL && SB_ANON ? createClient(SB_URL, SB_ANON) : null;

const noop = () => () => {};
/** false during server render and hydration, true once running in the browser */
export const useHydrated = () => useSyncExternalStore(noop, () => true, () => false);

/** Live game state: Realtime "version" pings when Supabase is configured, else polling. */
export function useGame(code: string) {
  const hydrated = useHydrated();
  const token = hydrated ? loadToken(code) : null;
  const [state, setState] = useState<ClientState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastMsg = useRef(0);
  const skew = useRef(0);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (!token || busy.current) return;
    busy.current = true;
    try {
      const s = await api.state(code, token, lastMsg.current);
      skew.current = s.serverNow - Date.now();
      if (s.messages.length) {
        lastMsg.current = Math.max(lastMsg.current, ...s.messages.map((m) => m.id));
        setMessages((old) => [...old, ...s.messages].slice(-300));
      }
      setState((old) => (old && old.version === s.version && !s.messages.length ? old : s));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      busy.current = false;
    }
  }, [code, token]);

  useEffect(() => {
    if (!token) return;
    refresh();
    const fallback = setInterval(refresh, realtime ? 5000 : 1200);
    const ch = realtime?.channel(`game:${code.toUpperCase()}`).on("broadcast", { event: "v" }, () => refresh()).subscribe();
    return () => { clearInterval(fallback); if (ch) realtime?.removeChannel(ch); };
  }, [code, token, refresh]);

  // when the clock runs out, nudge the server (it checks the deadline itself)
  useEffect(() => {
    if (!state?.deadline) return;
    const ms = state.deadline - (Date.now() + skew.current) + 300;
    let t: ReturnType<typeof setTimeout>;
    let tries = 0;
    // a nudge that lands a little early is refused, so try again rather than stall the table
    const fire = () => api.tick(code).then((r) => (r.applied || ++tries > 10 ? refresh() : void (t = setTimeout(fire, 1000)))).catch(() => {});
    t = setTimeout(fire, Math.max(0, ms));
    return () => clearTimeout(t);
  }, [code, state?.deadline, refresh]);

  const act = useCallback(async (a: Action) => {
    if (!token) return;
    try { await api.act(code, token, a); await refresh(); } catch (e) { setError((e as Error).message); }
  }, [code, token, refresh]);

  const say = useCallback(async (text: string) => {
    if (!token) return;
    try { await api.chat(code, token, text); await refresh(); } catch (e) { setError((e as Error).message); }
  }, [code, token, refresh]);

  const now = () => Date.now() + skew.current;
  return { hydrated, token, state, messages, error, setError, act, say, refresh, now };
}
