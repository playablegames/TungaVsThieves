"use client";
// THE LOBBY IS THE TABLE (owner 2026-11-23): people sit round the table as they join, empty seats show "+" (tap to
// invite), and the roles in play sit face up below — each new seat adds the next role [1.4c: the roles in play are
// public]. Voice works here too, with safety: your mic starts OFF when you sit down, tap a person to mute them for
// yourself or report them, and the host can remove a person (they can't sit down again under that name).
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { play } from "@/lib/sfx";
import { roleArt, CARD_BACK } from "@/components/CardIcon";
import { THIEVES, VILLAGERS } from "@/rules/game";
import type { ClientState } from "@/server/game";
import { MicButton, REPORT_REASONS, type VoiceControls } from "./Table";

const gold = "inset 0 0 0 1.5px rgba(247,187,31,.6)";
const goldBtn = { background: "linear-gradient(#f7c94a, #e0a020)", boxShadow: "inset 0 1px 0 #ffe7a6, 0 3px 0 #8a5a08" };

/** the roles in play at a table of `n` (below the minimum: what the smallest table plays) */
function rolesAt(table: Record<number, [number, number, number]>, n: number, min: number) {
  const [v, t, rounds] = table[Math.max(n, min)];
  return { v: VILLAGERS.slice(0, v), t: THIEVES.slice(0, t), rounds };
}

export function WaitingRoom({ state, token, onStarted, voice }: { state: ClientState; token: string; onStarted: () => void; voice: VoiceControls | null }) {
  const lobby = state.lobby;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  // SAFETY: the mic starts OFF in the lobby — nobody is heard until they choose to talk
  const quieted = useRef(false);
  useEffect(() => {
    if (!voice || quieted.current || voice.status !== "on") return;
    quieted.current = true;
    if (voice.micOn && !voice.micBlocked) voice.onTap();
  }, [voice]);
  if (!lobby) return null;
  const n = lobby.names.length;
  const host = state.you.host;
  const link = typeof location === "undefined" ? "" : `${location.origin}/?code=${state.code}`;
  const now = rolesAt(lobby.table, n, lobby.min);
  const after = n < lobby.max && n >= lobby.min ? rolesAt(lobby.table, n + 1, lobby.min) : null;
  const adds = after ? [...after.v.filter((r) => !now.v.includes(r)), ...after.t.filter((r) => !now.t.includes(r))][0] : null;
  // the seats round the table: everyone here, then a few empty ones (at least up to the smallest table)
  const seats = Math.min(lobby.max, Math.max(lobby.min, n + (n < 8 ? 2 : 1)));

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

  // you at the bottom, the others clockwise in seat order, empty seats after the last person
  const me = state.you.seat;
  const spot = (k: number) => {
    const rel = (k - me + seats) % seats;
    const a = Math.PI / 2 + (rel * 2 * Math.PI) / seats;
    return { left: `${50 + 41 * Math.cos(a)}%`, top: `${50 + 41 * Math.sin(a)}%` };
  };
  const sel = open !== null && open < n ? open : null;

  return (
    <main className="relative flex min-h-dvh flex-col items-center px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(16px,env(safe-area-inset-top))] text-[#ffe7a6]"
      style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif", background: "radial-gradient(120% 70% at 50% 30%, #2a2236 0%, #1b1628 55%, #110e1c 100%)" }}>
      <div className="flex w-full max-w-[420px] flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="Leave" className="grid size-11 place-items-center rounded-xl text-[#f7bb1f]" style={{ boxShadow: gold, background: "#021230d1" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </Link>
          <div className="text-center">
            <p className="text-[11px] tracking-[2px] opacity-75">TABLE</p>
            <p className="font-[family-name:var(--font-cinzel)] text-[26px] font-bold leading-none tracking-[6px] text-[#f7bb1f]">{state.code}</p>
          </div>
          {voice ? <MicButton voice={voice} /> : <span className="size-11" />}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button onClick={invite} className="h-11 rounded-xl text-[15px] font-bold text-[#2a1404] active:translate-y-0.5" style={goldBtn}>Invite friends</button>
          <button onClick={() => { play("tap"); copy(); }} className="h-11 rounded-xl px-4 text-[14px] font-semibold active:scale-95" style={{ boxShadow: gold }}>
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>

        {/* THE TABLE */}
        <div className="relative mx-auto aspect-square w-full max-w-[380px]">
          <div className="absolute inset-[25%] grid place-items-center rounded-full text-center"
            style={{ background: "radial-gradient(circle, #3a2c18 0%, #241a10 70%, #160f08 100%)", boxShadow: "inset 0 0 0 2px rgba(247,187,31,.45), 0 0 40px rgba(0,0,0,.5)" }}>
            <div>
              <p className="font-[family-name:var(--font-cinzel)] text-[13px] font-bold tracking-[2px] text-[#f7bb1f]">THE VILLAGE</p>
              <p className="mt-1 text-[13px] opacity-85">{n} seated</p>
              {n < lobby.min && <p className="mt-0.5 text-[12px] opacity-70">{lobby.min - n} more to play</p>}
            </div>
          </div>
          {Array.from({ length: seats }, (_, k) => {
            const pos = spot(k);
            if (k >= n) return (
              <button key={`e${k}`} onClick={invite} aria-label="Empty seat: invite a friend"
                className="absolute grid size-[46px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[22px] text-[#f7bb1f] active:scale-95"
                style={{ ...pos, boxShadow: "inset 0 0 0 1.5px rgba(247,187,31,.45)", background: "#02123080", borderStyle: "dashed" }}>+</button>
            );
            const name = lobby.names[k], bot = lobby.bots[k], you = k === me, isHost = k === state.host;
            const talk = Boolean(voice?.talking.includes(k)), muted = Boolean(voice?.muted.includes(k));
            return (
              <button key={`${k}:${name}`} onClick={() => { play("tap"); setOpen(you ? null : k); }} aria-label={you ? `${name} (you)` : name}
                className="absolute flex w-[72px] -translate-x-1/2 -translate-y-1/2 flex-col items-center active:scale-95" style={{ ...pos, marginTop: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
                <img src={CARD_BACK} alt="" className="h-[46px] w-[38px] rounded-[5px] object-cover"
                  style={{ boxShadow: talk ? "0 0 0 3px #7ee0a1, 0 0 12px rgba(126,224,161,.7)" : you ? "0 0 0 2px #f7bb1f" : "0 0 0 1px rgba(247,187,31,.4)" }} />
                <span className="mt-0.5 max-w-full truncate text-[12px] font-semibold leading-tight">{you ? "You" : name}</span>
                <span className="text-[10px] leading-tight opacity-75">{isHost ? "★ host" : muted && !bot ? "🔇 muted" : ""}</span>
              </button>
            );
          })}
        </div>

        {/* THE ROLES IN PLAY — face up, growing with the table */}
        <div className="rounded-2xl px-3 py-3" style={{ background: "#021230d1", boxShadow: gold }}>
          <p className="text-center text-[12px] tracking-[1.5px] opacity-85">
            IN THIS GAME · {Math.max(n, lobby.min)} players · {now.rounds} rounds{n < lobby.min ? ` (at ${lobby.min})` : ""}
          </p>
          <div className="mt-2 flex items-end justify-center gap-3">
            <RoleRow roles={now.v} label={`${now.v.length} villagers`} />
            <span className="mb-6 h-12 w-px bg-[#f7bb1f55]" />
            <RoleRow roles={now.t} label={`${now.t.length} ${now.t.length === 1 ? "thief" : "thieves"}`} />
          </div>
          {adds && <p className="mt-1.5 text-center text-[12.5px]">Next seat adds: <b className="text-[#f7bb1f]">{adds}</b></p>}
          {n >= lobby.max && <p className="mt-1.5 text-center text-[12.5px] opacity-80">The table is full</p>}
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {err && <p role="alert" className="rounded-xl bg-[#5a1010e6] px-3 py-2 text-center text-[13px] text-white">{err}</p>}
          {host ? (
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button disabled={busy || n >= lobby.max} onClick={() => run(() => api.addBot(state.code, token))}
                className="h-[52px] rounded-2xl px-4 text-[15px] font-semibold active:scale-95 disabled:opacity-40" style={{ boxShadow: gold }}>+ Bot</button>
              <button disabled={busy || n < lobby.min} onClick={() => run(() => api.start(state.code, token))}
                className="h-[52px] rounded-2xl text-[16px] font-bold text-[#2a1404] active:translate-y-0.5 disabled:opacity-45" style={goldBtn}>
                {n < lobby.min ? `${lobby.min - n} more to start` : busy ? "One moment…" : "Start the game"}
              </button>
            </div>
          ) : (
            <p className="py-3 text-center text-[14px] opacity-80">Waiting for {lobby.names[state.host] ?? "the host"} to start…</p>
          )}
        </div>
      </div>

      {sel !== null && (
        <SeatSheet key={sel} name={lobby.names[sel]} bot={lobby.bots[sel]} host={host} isHost={sel === state.host} busy={busy}
          voice={voice} muted={Boolean(voice?.muted.includes(sel))}
          onMute={(on) => voice?.mute(sel, on)}
          onReport={(reason) => voice ? voice.report(sel, reason) : Promise.resolve()}
          onRemove={() => { setOpen(null); run(() => api.removeBot(state.code, token, sel)); }}
          onClose={() => setOpen(null)} />
      )}
    </main>
  );
}

function RoleRow({ roles, label }: { roles: string[]; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-wrap justify-center gap-1">
        {roles.map((r) => (
          <div key={r} className="flex w-[38px] flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- static art */}
            <img src={roleArt(r) ?? CARD_BACK} alt="" className="h-[50px] w-[36px] rounded-[4px] object-cover" style={{ boxShadow: "0 0 0 1px rgba(247,187,31,.5)" }} />
            <span className="mt-0.5 w-full truncate text-center text-[9.5px] leading-tight">{r}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[11.5px] opacity-80">{label}</p>
    </div>
  );
}

/** TAP A SEAT: mute a person for yourself, report them, or (host) remove them / a bot */
function SeatSheet({ name, bot, host, isHost, busy, voice, muted, onMute, onReport, onRemove, onClose }: {
  name: string; bot: boolean; host: boolean; isHost: boolean; busy: boolean; voice: VoiceControls | null; muted: boolean;
  onMute: (on: boolean) => void; onReport: (reason: string) => Promise<void>; onRemove: () => void; onClose: () => void;
}) {
  const [step, setStep] = useState<"menu" | "report" | "sent" | "remove">("menu");
  const [reason, setReason] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const pill = (on: boolean) => on
    ? { background: "linear-gradient(#3a2a08, #241804)", color: "#ffe7a6", boxShadow: "inset 0 0 0 2px #f7bb1f" }
    : { background: "linear-gradient(#0d1f4a, #061538)", color: "#fff", boxShadow: "inset 0 0 0 1px rgba(247,187,31,.5)" };
  const canRemove = host && !isHost;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-label={name}>
      <button aria-label="Close" className="absolute inset-0 bg-black/55" onClick={onClose} />
      <div className="relative w-full max-w-[420px] rounded-t-3xl px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-4"
        style={{ background: "linear-gradient(#020a1e, #020818)", boxShadow: "inset 0 1.5px 0 rgba(247,187,31,.6)" }}>
        <p className="truncate px-12 text-center text-[16px] font-semibold">
          {step === "report" ? `Report ${name}` : step === "sent" ? "Thanks for telling us" : step === "remove" ? `Remove ${name}?` : name}
        </p>
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-2.5 grid size-11 place-items-center rounded-xl text-[#f7bb1f]" style={{ boxShadow: gold }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M5 5l14 14M19 5L5 19" /></svg>
        </button>
        {step === "menu" && (
          <div className="mt-5 flex flex-col gap-2">
            {bot && <p className="text-center text-[13px] opacity-80">A bot plays by the same rules and sees only its own cards.</p>}
            {!bot && voice && (
              <button onClick={() => { play("tap"); onMute(!muted); onClose(); }} className="h-12 rounded-xl text-[15px] font-semibold active:scale-95" style={pill(false)}>
                {muted ? `Unmute ${name}` : `Mute ${name} for me`}
              </button>
            )}
            {!bot && (
              <button onClick={() => { play("tap"); setStep("report"); }} className="h-12 rounded-xl text-[15px] font-semibold active:scale-95" style={pill(false)}>Report {name}</button>
            )}
            {canRemove && (
              <button disabled={busy} onClick={() => { play("tap"); if (bot) onRemove(); else setStep("remove"); }}
                className="h-12 rounded-xl text-[15px] font-semibold active:scale-95 disabled:opacity-50" style={pill(false)}>Remove {name} from the table</button>
            )}
            {!bot && <p className="px-2 text-center text-[12px] opacity-65">Muting: only you stop hearing them.</p>}
          </div>
        )}
        {step === "remove" && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-center text-[13.5px] opacity-85">{name} leaves the table and can&apos;t sit down here again under this name.</p>
            <button onClick={() => { play("tap"); onRemove(); }} className="h-[52px] rounded-2xl text-[16px] font-bold text-[#2a1404] active:translate-y-0.5" style={goldBtn}>Remove {name}</button>
          </div>
        )}
        {step === "report" && (
          <div className="mt-4 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {REPORT_REASONS.map((r) => (
                <button key={r} onClick={() => setReason(r)} aria-pressed={reason === r}
                  className="h-11 truncate rounded-xl px-2 text-[13px] font-semibold active:scale-95" style={pill(reason === r)}>{r}</button>
              ))}
            </div>
            {reason ? (
              <button disabled={sending} onClick={async () => { play("tap"); setSending(true); await onReport(reason); if (voice) onMute(true); setStep("sent"); }}
                className="h-[52px] rounded-2xl text-[16px] font-bold text-[#2a1404] active:translate-y-0.5 disabled:opacity-60" style={goldBtn}>
                {sending ? "Sending…" : `Report ${name}`}
              </button>
            ) : <p className="grid h-[52px] place-items-center text-[13px] opacity-70">What happened?</p>}
          </div>
        )}
        {step === "sent" && (
          <p className="mt-5 pb-4 text-center text-[14px] leading-relaxed opacity-90">
            We got your report and will look at it within 24 hours.{voice ? ` ${name} is muted for you.` : ""}
            {canRemove ? " As the host you can also remove them." : ""}
          </p>
        )}
      </div>
    </div>
  );
}
