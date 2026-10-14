"use client";
// Messages and voice notes (designer 2026-10-14, replacing the 2026-10-07 whisper sheet): tap a player to type to them or
// send a voice note (≤10 s); tap your own seat to type to everyone. The table sees the 👂 fly; only they get it.
import { useRef, useState } from "react";
import type { PlayerView } from "@/engine/view";
import { api } from "@/lib/client";
import { WHISPER_SECONDS, type WhisperBody } from "@/lib/whisper";
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

/** the most a chat line can say — what fits two lines of the centre (designer 2026-10-14: "100 if it fits, 50 if needed") */
export const CHAT_MAX = 50;

/** TYPE A MESSAGE (designer 2026-10-14): tap a player → private to them; tap your own seat → to everyone. Everything
 *  lands in the centre: a public line for all, a private one only for the two of you (the rest see "A → B, privately"). */
export function MessageSheet({ v, code, token, to, onClose }: { v: PlayerView; code: string; token: string; to: number | null; onClose: () => void }) {
  const [text, setText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const them = to === null ? null : v.players[to]?.name.replace(/\s*🤖$/, "") ?? "?";
  const priv = to !== null;
  const send = async () => {
    const t = text.replace(/\s+/g, " ").trim().slice(0, CHAT_MAX);
    if (!t || busy) return;
    setBusy(true); setErr(null);
    try {
      if (priv) await api.whisper(code, token, { to: to!, kind: "t", text: t });
      else await api.chat(code, token, t);
      play(priv ? "shh" : "tap"); onClose();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const ring = priv ? "border-jade" : "border-brass";
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-label={priv ? `Message ${them}` : "Message everyone"} onClick={(e) => e.stopPropagation()}
        className="stage-in flex w-full max-w-md flex-col gap-2 rounded-t-3xl border-t-2 border-brass/70 bg-ember px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <p className={`text-[13px] font-bold ${priv ? "text-jade-soft" : "text-[#f3c66b]"}`}>{priv ? `🤫 To ${them} — only ${them} sees this` : "💬 To everyone at the table"}</p>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <label className={`flex min-h-12 flex-1 items-center gap-2 rounded-full border-2 ${ring} bg-black/35 px-4`}>
            <input autoFocus value={text} maxLength={CHAT_MAX} onChange={(e) => setText(e.target.value)} enterKeyHint="send"
              placeholder={priv ? `Message ${them}…` : "Message everyone…"} aria-label="Your message"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-stock outline-none focus-visible:outline-none placeholder:text-stock/40" />
            <span className="text-[12px] tabular-nums text-stock/60" aria-hidden>{text.length}/{CHAT_MAX}</span>
          </label>
          <button type="submit" disabled={busy || !text.trim()} aria-label="Send"
            className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-[20px] font-black text-card-ink disabled:opacity-40 ${priv ? "bg-jade" : "bg-brass"}`}>➤</button>
        </form>
        {err && <p role="alert" className="rounded-xl bg-crimson-deep p-2 text-center text-[13px]">{err}</p>}
      </div>
    </div>
  );
}

/** A VOICE NOTE to one player: hold to record (up to 10 s), let go to send. Only they hear it. */
export function VoiceNoteSheet({ v, code, token, to, onClose }: { v: PlayerView; code: string; token: string; to: number; onClose: () => void }) {
  const [rec, setRec] = useState<number | null>(null); // seconds recorded while holding
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const r = useRef<{ mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; tick: ReturnType<typeof setInterval>; t0: number } | null>(null);
  const them = v.players[to]?.name.replace(/\s*🤖$/, "") ?? "?";

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
    } catch { setErr("Allow the microphone to send a voice note."); }
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

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" onClick={() => !busy && rec === null && onClose()}>
      <div role="dialog" aria-label={`Voice note to ${them}`} onClick={(e) => e.stopPropagation()}
        className="stage-in flex w-full max-w-md flex-col items-center gap-3 rounded-t-3xl border-t-2 border-brass/70 bg-ember px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <p className="text-[13px] font-bold text-jade-soft">🎙 Voice note to {them} — only {them} hears it</p>
        <button type="button" disabled={busy}
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); void start(); }}
          onPointerUp={stop} onPointerCancel={stop} onContextMenu={(e) => e.preventDefault()}
          className={`relative grid h-28 w-28 select-none place-items-center rounded-full border-4 text-[40px] [-webkit-touch-callout:none] ${rec !== null ? "border-crimson bg-crimson-deep shadow-[0_0_30px_6px_rgba(192,57,43,.5)]" : "border-jade/70 bg-[#0e2a18]"}`}
          aria-label="Hold to record a voice note">
          🎙️
          {rec !== null && (
            <svg viewBox="0 0 120 120" className="absolute inset-[-6px] -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r="56" fill="none" stroke="#ffb4a9" strokeWidth="4" strokeDasharray={352} strokeDashoffset={352 * (1 - Math.min(1, rec / WHISPER_SECONDS))} />
            </svg>
          )}
        </button>
        <p className="text-[13px] text-stock/60">{busy ? "Sending…" : rec !== null ? `${Math.ceil(WHISPER_SECONDS - rec)}s left — let go to send` : "Hold to talk"}</p>
        {err && <p role="alert" className="rounded-xl bg-crimson-deep p-2 text-center text-[13px]">{err}</p>}
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
      <p className="mt-1 font-display text-[18px] font-bold text-stock">🎙 {who} sent you a voice note</p>
      {text && <p className="mt-2 font-display text-[17px] italic text-[#f3c66b]">&ldquo;{text}&rdquo;</p>}
      <div className="mt-3 flex justify-center gap-2">
        {b.kind === "v" && <button type="button" onClick={listen} className="min-h-11 rounded-full border-2 border-jade/70 px-5 text-[14px] font-bold text-jade-soft">{playing ? "🔊 …" : "▶ Listen"}</button>}
        <button type="button" onClick={onDone} className="min-h-11 rounded-full border-2 border-brass/50 px-5 text-[14px] font-bold text-stock/80">Got it</button>
      </div>
    </div>
  );
}
