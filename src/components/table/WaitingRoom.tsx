"use client";
// THE LOBBY IS THE GAME TABLE (owner 2026-11-23: "the lobby looks like a different table, not the same table"; "roles
// must be mentioned below as buttons not cards"; "no music in the lobby"; bot tables use this lobby too). The same
// night village, courtyard, seats and garland as the game: people sit in their real seats as they join, empty seats
// show "+" (tap to invite). The centre: table code (tap = copy link), who is seated, Add bot + Start game (host).
// The roles in this game lie FACE UP in the seats [1.4c: the roles in play are public]; the bottom: Add bots,
// Invite friends, Start the game, one below another. The start: the cards flip to their backs (no table spin: owner 2026-11-24).
// Voice safety: your mic starts OFF; tap a person to mute them for yourself, report them, or (host) remove them.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { play, unlockOnFirstTap } from "@/lib/sfx";
import { setMood, startMusicOnFirstTap, stopMusic } from "@/lib/music";
import { THIEVES, VILLAGERS } from "@/rules/game";
import type { ClientState } from "@/server/game";
import { CY, HAND_TOP, W, H, seatSpot } from "./layout";
import { MatEdge, VillageScene } from "./VillageScene";
import { Seats } from "./Seats";
import { GearButton, SettingsSheet } from "./SettingsSheet";
import { MicButton, REPORT_REASONS, useScale, type VoiceControls } from "./Table";
import { roleArt } from "@/components/CardIcon";

const gold = "inset 0 0 0 1.5px rgba(247,187,31,.6)";
const goldBtn = "rounded-2xl bg-gradient-to-b from-[#f7c94a] to-[#e0a020] font-bold text-[#2a1404] shadow-[inset_0_1px_0_#ffe7a6,0_4px_0_#8a5a08] active:translate-y-0.5 disabled:opacity-45";
const lineBtn = "rounded-2xl bg-gradient-to-b from-[#0d1f4a] to-[#061538] font-semibold text-[#ffe7a6] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)] active:scale-95 disabled:opacity-40";

/** villagers and thieves laid round the table, the thieves spread out (display only) */
function spread(v: string[], th: string[]): string[] {
  const all = v.length + th.length, out: string[] = new Array(all).fill("");
  th.forEach((r, k) => { out[Math.floor(((k + 0.5) * all) / th.length)] = r; });
  let i = 0;
  return out.map((r) => r || v[i++]);
}

/** the roles in play at a table of `n` (below the minimum: what the smallest table plays) */
function rolesAt(table: Record<number, [number, number, number]>, n: number, min: number) {
  const [v, t, rounds] = table[Math.max(n, min)];
  return { v: VILLAGERS.slice(0, v), t: THIEVES.slice(0, t), rounds };
}

export function WaitingRoom({ state, token, onStarted, voice, spinning = false }: {
  state: ClientState; token: string; onStarted: () => void; voice: VoiceControls | null;
  /** THE GAME STARTS: the role cards flip to their backs. The table does NOT spin (owner 2026-11-24: "people will leave at that point") */
  spinning?: boolean;
}) {
  const lobby = state.lobby;
  const router = useRouter();
  const scale = useScale();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [settings, setSettings] = useState(false);
  // the start: 0-700ms the cards flip (faces -> backs at the half)
  const [backs, setBacks] = useState(false);
  useEffect(() => {
    if (!spinning) return;
    const a = setTimeout(() => setBacks(true), 350);
    return () => clearTimeout(a);
  }, [spinning]);
  // MUSIC (owner 2026-11-23): the table's score plays in the lobby too (after the first tap, as browsers require)
  useEffect(() => { unlockOnFirstTap(); startMusicOnFirstTap(); setMood("calm"); }, []);
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
  const me = state.you.seat;
  const link = typeof location === "undefined" ? "" : `${location.origin}/?code=${state.code}`;
  const now = rolesAt(lobby.table, n, lobby.min);
  // the seats round the table: everyone here, then a few empty ones (at least up to the smallest table)
  const seats = Math.min(lobby.max, Math.max(lobby.min, n + (n < 8 ? 2 : 1)));
  // THE ROLES ON THE TABLE (owner 2026-11-23): the roles in this game lie face up in the seats, thieves spread round.
  // Only what is in the game, not who gets what (that is dealt face down at the start).
  const shown = spread(now.v, now.t);
  const players = lobby.names.map((name, seat) => ({ seat, name, alive: true, role: backs ? null : shown[seat] ?? null }));

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
  const sel = open !== null && open < n ? open : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#15142c]">
      <div className="absolute left-1/2 top-1/2 origin-center" style={{ width: W, height: H, transform: `translate(-50%,-50%) scale(${scale})`, fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
        <VillageScene />

        {/* the same top bar as the game: voice + settings · the table code (tap = copy the link) · leave */}
        <div className="absolute inset-x-3.5 top-3 z-10 flex h-[46px] items-center justify-between">
          <div className="flex gap-2">
            {voice && <MicButton voice={voice} />}
            <GearButton onTap={() => setSettings(true)} />
          </div>
          <button onClick={() => { play("tap"); stopMusic(); router.push("/"); }} aria-label="Leave the table"
            className="grid size-11 place-items-center rounded-xl bg-[#021230d1] text-[#f7bb1f]" style={{ boxShadow: gold }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        </div>

        {/* the centre (owner 2026-11-23): the table code, who is seated, and the host's two buttons */}
        <div className="absolute z-[3] w-[196px] -translate-x-1/2 -translate-y-1/2 rounded-[16px] px-3.5 pb-3.5 pt-3 text-center shadow-[inset_0_0_0_1px_rgba(247,187,31,.55),0_10px_24px_rgba(0,0,0,.55)]"
          style={{ left: W / 2, top: CY, background: "linear-gradient(rgba(12,44,107,.95), rgba(2,18,48,.97))" }} role="status" aria-live="polite">
          <span className="absolute -top-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-[#f7bb1f]" aria-hidden />
          <span className="absolute -bottom-[5px] left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-[#f7bb1f]" aria-hidden />
          <button onClick={() => { play("tap"); copy(); }} aria-label="Copy the table link" className="font-[family-name:var(--font-cinzel)] text-[12px] font-bold tracking-[2px] text-[#f7bb1f]">
            {copied ? "LINK COPIED ✓" : `TABLE ${state.code}`}
          </button>
          <p className="mt-0.5 text-[13px] text-[#ffe7a6e6]">{n} seated</p>
          {!host && (
            <p className="font-display mt-2 rounded-lg bg-[#021230bf] px-2 py-[7px] text-[15px] font-black leading-tight text-white shadow-[inset_0_0_0_1px_rgba(247,187,31,.3)]">
              Waiting for {lobby.names[state.host] ?? "the host"}
            </p>
          )}
          {err && <p role="alert" className="mt-2 rounded-lg bg-[#5a1010e6] px-2 py-1 text-[11.5px] text-white">{err}</p>}
        </div>

        <div className={`pointer-events-none absolute inset-0 z-[2] [&>*]:pointer-events-auto ${spinning ? "tt-flip" : ""}`}>
        <Seats players={players} you={me} myRole={backs ? null : shown[me] ?? null} reveal={!backs} active={[]} total={seats} talking={voice?.talking} muted={voice?.muted}
          onSeat={spinning ? undefined : (s) => { play("tap"); setOpen(s === me ? null : s); }} />
        {/* the empty seats: tap to invite */}
        {Array.from({ length: seats - n }, (_, k) => {
          const { x, y } = seatSpot(n + k, me, seats);
          const r = backs ? null : shown[n + k];
          return (
            <button key={`e${k}`} onClick={invite} aria-label={r ? `Empty seat (${r}): invite a friend` : "Empty seat: invite a friend"}
              className="absolute z-[2] grid h-[86px] w-[60px] -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-[6px] border-[1.5px] border-dashed border-[#f7bb1f99] bg-[#02123080] text-[26px] text-[#f7bb1f] active:scale-95"
              style={{ left: x, top: y }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {r && <img src={roleArt(r) ?? ""} alt="" className="absolute inset-0 size-full object-cover opacity-45" />}
              <span className="relative grid size-8 place-items-center rounded-full bg-[#021230e6] text-[22px] leading-none shadow-[0_0_0_1.5px_#f7bb1f]">+</span>
            </button>
          );
        })}
        </div>

        {/* where your cards will be: ONLY the roles in this game, big and bold (owner 2026-11-23) */}
        <div className="absolute inset-x-0 bottom-0 z-[1]" style={{ top: HAND_TOP }}>
          <div className="absolute inset-0 shadow-[0_-10px_24px_rgba(0,0,0,.5)]" style={{ background: "linear-gradient(rgba(2,10,30,.35), rgba(2,8,24,.9)), repeating-linear-gradient(90deg, rgba(255,231,166,.035) 0 1px, transparent 1px 12px), repeating-linear-gradient(0deg, #0e1a3c 0 6px, #0a1532 6px 12px)" }} />
          {/* (owner 2026-11-23) one below another: Add bots, Invite friends, Start the game */}
          <div className="absolute inset-x-4 top-[30px] bottom-[16px] flex flex-col justify-center gap-2.5">
            {host && (
              <button disabled={busy || spinning || n >= lobby.max} onClick={() => run(() => api.addBot(state.code, token))} className={`h-[50px] text-[16px] ${lineBtn}`}>
                {n >= lobby.max ? "The table is full" : "Add bots"}
              </button>
            )}
            <button disabled={spinning} onClick={invite} className={`h-[50px] text-[16px] ${lineBtn}`}>Invite friends</button>
            {host && (
              <button disabled={busy || spinning || n < lobby.min} onClick={() => run(() => api.start(state.code, token))} className={`h-[54px] text-[17px] ${goldBtn}`}>
                {n < lobby.min ? `${lobby.min - n} more to start` : busy || spinning ? "Shuffling..." : "Start the game"}
              </button>
            )}
          </div>
        </div>
        <MatEdge />
      </div>

      {sel !== null && (
        <SeatSheet key={sel} name={lobby.names[sel]} bot={lobby.bots[sel]} host={host} isHost={sel === state.host} busy={busy}
          voice={voice} muted={Boolean(voice?.muted.includes(sel))}
          onMute={(on) => voice?.mute(sel, on)}
          onReport={(reason) => voice ? voice.report(sel, reason) : Promise.resolve()}
          onRemove={() => { setOpen(null); run(() => api.removeBot(state.code, token, sel)); }}
          onClose={() => setOpen(null)} />
      )}
      {settings && <SettingsSheet onClose={() => setSettings(false)} />}
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
    <div className="fixed inset-0 z-50 flex items-end justify-center text-[#ffe7a6]" role="dialog" aria-label={name} style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
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
            <button onClick={() => { play("tap"); onRemove(); }} className={`h-[52px] text-[16px] ${goldBtn}`}>Remove {name}</button>
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
                className={`h-[52px] text-[16px] ${goldBtn}`}>
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
