"use client";
// WAITING FOR PLAYERS (owner 2026-11-21: build routine screens in the table look). The code big, one tap to invite
// (the phone's share sheet — WhatsApp first — or copy the link: paste it in your video call's chat too), who sits here
// and what this table size means (villagers · thieves · rounds), the host adds/removes bots and starts.
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/client";
import { play } from "@/lib/sfx";
import type { ClientState } from "@/server/game";
import { MicButton, type VoiceControls } from "./Table";

const gold = "inset 0 0 0 1.5px rgba(247,187,31,.6)";

export function WaitingRoom({ state, token, onStarted, voice }: { state: ClientState; token: string; onStarted: () => void; voice: VoiceControls | null }) {
  const lobby = state.lobby;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  if (!lobby) return null;
  const n = lobby.names.length;
  const size = lobby.table[Math.min(Math.max(n, lobby.min), lobby.max)];
  const host = state.you.host;
  const link = typeof location === "undefined" ? "" : `${location.origin}/?code=${state.code}`;

  async function run(f: () => Promise<unknown>) {
    play("tap"); setBusy(true); setErr(null);
    try { await f(); onStarted(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function invite() {
    play("tap");
    const text = `Come play Tunga vs Thieves with me! Table ${state.code}`;
    try {
      if (navigator.share) { await navigator.share({ title: "Tunga vs Thieves", text, url: link }); return; }
    } catch { return; } // they closed the share sheet
    copy();
  }
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr(link); }
  }

  return (
    <main className="relative flex min-h-dvh flex-col items-center bg-[#15142c] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] text-[#ffe7a6]"
      style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", background: "radial-gradient(120% 70% at 50% 30%, #2a2236 0%, #1b1628 55%, #110e1c 100%)" }}>
      <div className="flex w-full max-w-[420px] flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Leave" className="grid size-11 place-items-center rounded-xl text-[#f7bb1f]" style={{ boxShadow: gold, background: "#021230d1" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </Link>
          <p className="font-[family-name:var(--font-cinzel)] text-[12.5px] font-bold tracking-[2px] text-[#f7bb1f]">WAITING FOR PLAYERS</p>
          {voice ? <MicButton voice={voice} /> : <span className="size-11" />}
        </div>

        <div className="rounded-2xl px-4 py-4 text-center" style={{ background: "#021230d1", boxShadow: gold }}>
          <p className="text-[12px] tracking-[2px] opacity-75">TABLE CODE</p>
          <p className="font-[family-name:var(--font-cinzel)] text-[40px] font-bold leading-tight tracking-[8px] text-[#f7bb1f]">{state.code}</p>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <button onClick={invite} className="h-12 rounded-xl text-[15px] font-bold text-[#2a1404] active:translate-y-0.5"
              style={{ background: "linear-gradient(#f7c94a, #e0a020)", boxShadow: "inset 0 1px 0 #ffe7a6, 0 3px 0 #8a5a08" }}>
              Invite friends
            </button>
            <button onClick={() => { play("tap"); copy(); }} className="h-12 rounded-xl px-4 text-[14px] font-semibold active:scale-95" style={{ boxShadow: gold }}>
              {copied ? "Copied ✓" : "Copy link"}
            </button>
          </div>
          <p className="mt-2 text-[12px] opacity-70">On a video call? Paste the link in the call&apos;s chat.</p>
        </div>

        <div className="flex items-baseline justify-between px-1">
          <p className="text-[15px] font-semibold">{n} at the table</p>
          {size && n >= lobby.min && <p className="text-[12.5px] opacity-80">{size[0]} villagers · {size[1]} {size[1] === 1 ? "thief" : "thieves"} · {size[2]} rounds</p>}
        </div>
        <ul className="flex flex-col gap-1.5">
          {lobby.names.map((name, i) => {
            const me = i === state.you.seat, isHost = i === state.host, bot = lobby.bots[i], talk = Boolean(voice?.talking.includes(i));
            return (
              <li key={`${i}:${name}`} className="flex h-12 items-center gap-3 rounded-xl px-3" style={{ background: me ? "#3a2a0899" : "#0212309e", boxShadow: me ? "inset 0 0 0 1.5px #f7bb1f" : "inset 0 0 0 1px rgba(247,187,31,.3)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
                <img src="/art/cards/back.webp" alt="" className="h-8 w-[34px] rounded-[4px] object-cover" style={talk ? { boxShadow: "0 0 0 3px #7ee0a1, 0 0 12px rgba(126,224,161,.7)" } : undefined} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{name}{me && <span className="font-normal opacity-70"> · you</span>}</span>
                {isHost && <span className="text-[11px] tracking-[1px] text-[#f7bb1f]">HOST</span>}
                {host && !isHost && (
                  <button disabled={busy} aria-label={`Remove ${name}`} onClick={() => run(() => api.removeBot(state.code, token, i))}
                    className="grid size-9 place-items-center rounded-lg text-[#f7bb1f] active:scale-95" style={{ boxShadow: gold }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
                  </button>
                )}
                {!host && bot && <span className="text-[11px] opacity-60">bot</span>}
              </li>
            );
          })}
        </ul>
        {host && n < lobby.max && (
          <button disabled={busy} onClick={() => run(() => api.addBot(state.code, token))}
            className="h-11 rounded-xl text-[14px] font-semibold active:scale-95 disabled:opacity-50" style={{ boxShadow: gold }}>
            + Add a bot
          </button>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-2">
          {err && <p role="alert" className="rounded-xl bg-[#5a1010e6] px-3 py-2 text-center text-[13px] text-white">{err}</p>}
          {host ? (
            <button disabled={busy || n < lobby.min} onClick={() => run(() => api.start(state.code, token))}
              className="h-[52px] rounded-2xl text-[16px] font-bold text-[#2a1404] active:translate-y-0.5 disabled:opacity-45"
              style={{ background: "linear-gradient(#f7c94a, #e0a020)", boxShadow: "inset 0 1px 0 #ffe7a6, 0 4px 0 #8a5a08" }}>
              {n < lobby.min ? `${lobby.min - n} more to start` : busy ? "One moment…" : "Start the game"}
            </button>
          ) : (
            <p className="py-3 text-center text-[14px] opacity-80">Waiting for {lobby.names[state.host] ?? "the host"} to start…</p>
          )}
        </div>
      </div>
    </main>
  );
}
