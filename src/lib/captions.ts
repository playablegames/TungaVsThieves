"use client";
// LIVE CAPTIONS (designer 2026-10-09: "no voice is heard, no text is shown"): while your mic is live, your own phone
// writes down what you say (the browser's speech recognition — free, no AI service of ours) and puts each sentence in
// the centre of every phone's table, under your name. A voice that never reached someone still reaches them as words.
// Research: Xbox party-chat transcription — every line tagged with the speaker, in the speaker's colour.
// Chrome (desktop + Android) and Safari have it; Firefox does not — then this stays off and nothing changes.
import { useEffect, useRef, useSyncExternalStore } from "react";

const PREF = "tunga:captions";
const LANG = "tunga:captions-lang";
export type CaptionLang = "en-IN" | "hi-IN";

type Rec = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function ctor(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

class Captioner {
  private rec: Rec | null = null;
  private want = false;
  private restarts: number[] = [];
  private listeners = new Set<() => void>();
  private send: ((text: string) => void) | null = null;
  snap = { supported: false, on: false, lang: "en-IN" as CaptionLang, listening: false, broken: false };

  constructor() {
    try {
      this.snap = {
        ...this.snap,
        supported: Boolean(ctor()),
        on: localStorage.getItem(PREF) === "on", // designer 2026-10-09: off unless the player turns it on
        lang: (localStorage.getItem(LANG) as CaptionLang) || "en-IN",
      };
    } catch { this.snap = { ...this.snap, supported: Boolean(ctor()) }; }
  }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.snap;
  private set(p: Partial<Captioner["snap"]>) { this.snap = { ...this.snap, ...p }; this.listeners.forEach((f) => f()); }

  setOn(on: boolean) { try { localStorage.setItem(PREF, on ? "on" : "off"); } catch {} this.set({ on, broken: false }); if (!on) this.stop(); }
  setLang(lang: CaptionLang) { try { localStorage.setItem(LANG, lang); } catch {} this.set({ lang }); this.stop(); }

  /** listen while `active` (mic live, your floor, alive); each finished sentence goes to `send` */
  run(active: boolean, send: (text: string) => void) {
    this.send = send;
    if (active && this.snap.on && this.snap.supported && !this.snap.broken) this.start();
    else this.stop();
  }

  private start() {
    this.want = true;
    if (this.rec) return;
    const C = ctor();
    if (!C) return;
    const r = new C();
    r.lang = this.snap.lang;
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0]?.transcript?.trim();
        if (res.isFinal && t && t.length > 1) this.send?.(t.slice(0, 200));
      }
    };
    r.onerror = (e) => {
      // refused, or the phone cannot share the mic with the call: stop for good this game, quietly
      if (["not-allowed", "service-not-allowed", "audio-capture", "language-not-supported"].includes(e.error)) this.set({ broken: true });
    };
    r.onend = () => {
      this.rec = null;
      this.set({ listening: false });
      if (!this.want || this.snap.broken) return;
      // the engine stops after silence — start it again, but never loop (some phones beep on every start)
      const now = Date.now();
      this.restarts = this.restarts.filter((t) => now - t < 60_000);
      if (this.restarts.length >= 8) { this.set({ broken: true }); return; }
      this.restarts.push(now);
      setTimeout(() => { if (this.want) this.start(); }, 300);
    };
    try { r.start(); this.rec = r; this.set({ listening: true }); } catch { this.rec = null; }
  }

  stop() {
    this.want = false;
    if (this.rec) try { this.rec.abort(); } catch {}
    this.rec = null;
    if (this.snap.listening) this.set({ listening: false });
  }
}

let one: Captioner | null = null;
const get = () => (one ??= new Captioner());
const OFF = { supported: false, on: false, lang: "en-IN" as CaptionLang, listening: false, broken: false };

export function useCaptions(active: boolean, send: (text: string) => void) {
  const c = get();
  const snap = useSyncExternalStore(c.subscribe, c.getSnapshot, () => OFF);
  const out = useRef(send);
  useEffect(() => { out.current = send; }, [send]);
  useEffect(() => { c.run(active, (t) => out.current(t)); }, [c, active, snap.on, snap.lang, snap.broken]);
  useEffect(() => () => c.stop(), [c]);
  return { ...snap, setOn: (on: boolean) => c.setOn(on), setLang: (l: CaptionLang) => c.setLang(l) };
}
