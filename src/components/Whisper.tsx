"use client";
// Whispers (designer 2026-10-07): hold to record a voice note (≤10 s) — or tap a quick line, or pass on a Kundli read —
// to ONE player, once per round. The table sees the 👂 fly; only they hear it, in their ear.
import { useRef, useState } from "react";
import type { PlayerView } from "@/engine/view";
import { api } from "@/lib/client";
import { QUICK_LINES, WHISPER_SECONDS, type WhisperBody } from "@/lib/whisper";
import type { Incoming } from "@/lib/reactions";
import { play } from "@/lib/sfx";

/** a whisper already sent this round? (public: the table saw it) */
export const whisperedThisRound = (v: PlayerView) =>
  v.events.some((e) => e.type === "whisper" && e.data?.seat === v.me.seat && e.data?.round === v.round);

function recorderType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  // AAC plays on every phone (iPhone included); Opus/WebM where AAC can't be recorded
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"]) if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

export function WhisperSheet({ v, code, token, to, onClose }: { v: PlayerView; code: string; token: string; to: number; onClose: () => void }) {
  const [rec, setRec] = useState<number | null>(null); // seconds recorded while holding
  const [err, setErr] = useState<string | null>(null);
  const [about, setAbout] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const r = useRef<{ mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; tick: ReturnType<typeof setInterval>; t0: number } | null>(null);
  const them = v.players[to]?.name.replace(/\s*🤖$/, "") ?? "?";
  const others = v.players.filter((p) => p.alive && p.seat !== v.me.seat);

  const send = async (b: WhisperBody) => {
    setBusy(true); setErr(null);
    try { await api.whisper(code, token, { to, ...b } as Parameters<typeof api.whisper>[2]); play("shh"); onClose(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };

  async function start() {
    const type = recorderType();
    if (!type) { setErr("This phone can't record — send a line instead."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mr = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 24_000 });
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const t0 = Date.now();
      const tick = setInterval(() => {
        const s = (Date.now() - t0) / 1000;
        setRec(s);
        if (s >= WHISPER_SECONDS) stop();
      }, 100);
      r.current = { mr, stream, chunks, tick, t0 };
      mr.start();
      setRec(0);
    } catch { setErr("Allow the microphone to whisper a voice note."); }
  }

  function stop() {
    const cur = r.current;
    if (!cur) return;
    r.current = null;
    clearInterval(cur.tick);
    const long = Date.now() - cur.t0;
    cur.mr.onstop = () => {
      cur.stream.getTracks().forEach((t) => t.stop());
      setRec(null);
      if (long < 600) return; // a tap, not a whisper
      const blob = new Blob(cur.chunks, { type: cur.mr.mimeType });
      const fr = new FileReader();
      fr.onload = () => void send({ kind: "v", audio: String(fr.result) });
      fr.readAsDataURL(blob);
    };
    cur.mr.stop();
  }

  const chip = "min-h-10 rounded-full border border-brass/40 bg-black/30 px-3 text-[13px] text-stock active:translate-y-px disabled:opacity-40";
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={() => !busy && rec === null && onClose()}>
      <div role="dialog" aria-label={`Whisper to ${them}`} onClick={(e) => e.stopPropagation()}
        className="stage-in flex w-full max-w-md flex-col gap-4 rounded-t-3xl border-t-2 border-brass/70 bg-ember px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <h2 className="text-center font-display text-[22px] font-bold text-stock">🤫 Whisper to {them}</h2>

        {/* hold to talk */}
        <button type="button" disabled={busy}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); void start(); }}
          onPointerUp={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
          className={`relative mx-auto grid h-28 w-28 select-none place-items-center rounded-full border-4 text-[40px] [-webkit-touch-callout:none] ${rec !== null ? "border-crimson bg-crimson-deep shadow-[0_0_30px_6px_rgba(192,57,43,.5)]" : "border-brass/70 bg-[#3a240c]"}`}
          aria-label="Hold to record a voice note">
          🎙️
          {rec !== null && (
            <svg viewBox="0 0 120 120" className="absolute inset-[-6px] -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r="56" fill="none" stroke="#ffb4a9" strokeWidth="4" strokeDasharray={352} strokeDashoffset={352 * (1 - Math.min(1, rec / WHISPER_SECONDS))} />
            </svg>
          )}
        </button>
        <p className="-mt-2 text-center text-[13px] text-stock/60">{rec !== null ? `${Math.ceil(WHISPER_SECONDS - rec)}s — let go to send` : "Hold to talk"}</p>

        <div className="flex flex-wrap justify-center gap-2">
          {QUICK_LINES.map((t) => <button key={t} type="button" disabled={busy} onClick={() => void send({ kind: "t", text: t })} className={chip}>{t}</button>)}
        </div>

        {/* pass on a Kundli read: who, then what you saw */}
        <div className="flex flex-col gap-2 rounded-2xl border border-brass/30 p-3">
          <p className="text-center text-[12px] font-semibold uppercase tracking-[0.15em] text-brass">I read the Kundli of…</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {others.map((p) => <button key={p.seat} type="button" onClick={() => setAbout(p.seat)} className={`${chip} ${about === p.seat ? "border-[#f0a32e] text-[#f3c66b]" : ""}`}>{p.name.replace(/\s*🤖$/, "")}</button>)}
          </div>
          {about !== null && (
            <div className="flex flex-wrap justify-center gap-1.5">
              {v.rolesInPlay.map((role) => <button key={role} type="button" disabled={busy} onClick={() => void send({ kind: "k", about, role })} className={`${chip} bg-[#3a240c]`}>{role}</button>)}
            </div>
          )}
        </div>
        {err && <p role="alert" className="rounded-xl bg-crimson-deep p-3 text-center text-[14px]">{err}</p>}
      </div>
    </div>
  );
}

/** what was whispered to YOU: plays in your ear (voice), or shows the line — then it's gone */
/** `up`: while it's your move the bubble sits under the header, clear of your choices (2026-10-09 collisions sweep) */
export function WhisperBubble({ w, names, onDone, up = false }: { w: Incoming; names: string[]; onDone: () => void; up?: boolean }) {
  const [playing, setPlaying] = useState(false);
  const who = w.name.replace(/\s*🤖$/, "");
  const b = w.body!;
  const text = b.kind === "t" ? b.text : b.kind === "k" ? `I read ${names[b.about]?.replace(/\s*🤖$/, "")}'s Kundli: ${b.role}` : null;
  const listen = () => {
    if (b.kind !== "v") return;
    const a = new Audio(b.audio);
    a.volume = 1;
    setPlaying(true);
    a.onended = () => setPlaying(false);
    a.play().catch(() => setPlaying(false));
  };
  return (
    <div className={`stage-in fixed inset-x-3 ${up ? "top-16" : "bottom-[42%]"} z-40 mx-auto max-w-sm rounded-2xl border-2 border-jade/70 bg-[#0e1a12]/95 p-4 text-center shadow-[0_12px_40px_rgba(0,0,0,.8)]`} role="status">
      <p className="font-[family-name:var(--font-engraved)] text-[11px] font-semibold uppercase tracking-[0.2em] text-jade-soft">Only you hear this</p>
      <p className="mt-1 font-display text-[18px] font-bold text-stock">🤫 {who} whispers…</p>
      {text && <p className="mt-2 font-display text-[17px] italic text-[#f3c66b]">&ldquo;{text}&rdquo;</p>}
      <div className="mt-3 flex justify-center gap-2">
        {b.kind === "v" && <button type="button" onClick={listen} className="min-h-11 rounded-full border-2 border-jade/70 px-5 text-[14px] font-bold text-jade-soft">{playing ? "🔊 …" : "▶ Listen"}</button>}
        <button type="button" onClick={onDone} className="min-h-11 rounded-full border-2 border-brass/50 px-5 text-[14px] font-bold text-stock/80">Got it</button>
      </div>
    </div>
  );
}
