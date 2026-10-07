"use client";
// Bot lines on the phone: shown one at a time on the centre stage (the speaking seat lights up), and — if the
// player turns it on — read aloud by the phone's own voice (free, no AI). A plain external store so React never
// sets state inside an effect.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ChatMessage } from "@/server/store";
import { isReaction } from "./reactions";

const SHOW_MS = 3400;
const PREF = "tunga:botvoice";

export interface Speech { seat: number; name: string; text: string }

class SpeechQueue {
  private seen = -1;
  private queue: Speech[] = [];
  private current: Speech | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  voice = false;

  constructor() {
    try { this.voice = localStorage.getItem(PREF) === "on"; } catch {}
  }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.current;
  private emit() { this.listeners.forEach((f) => f()); }

  /** The first feed only marks history as heard — no replay of old lines on reload. */
  feed(messages: ChatMessage[]) {
    const top = messages.at(-1)?.id ?? 0;
    if (this.seen < 0) { this.seen = top; return; }
    // reactions (thrown emojis) travel as messages too, but they are not speech
    const fresh = messages.filter((m) => m.id > this.seen && !isReaction(m.text));
    if (!fresh.length) return;
    this.seen = top;
    this.queue.push(...fresh.map((m) => ({ seat: m.seat, name: m.name, text: m.text })));
    if (this.queue.length > 6) this.queue.splice(0, this.queue.length - 6); // a phone that fell behind skips ahead
    if (!this.current) this.next();
  }

  private next() {
    this.current = this.queue.shift() ?? null;
    if (this.current) {
      this.speak(this.current);
      this.timer = setTimeout(() => this.next(), SHOW_MS);
    }
    this.emit();
  }

  private speak(s: Speech) {
    if (!this.voice || typeof speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(`${s.name}: ${s.text}`.replace(/\p{Extended_Pictographic}/gu, ""));
    const voices = speechSynthesis.getVoices();
    u.voice = voices.find((v) => v.lang === "en-IN") ?? voices.find((v) => v.lang.startsWith("hi")) ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
    u.lang = u.voice?.lang ?? "en-IN";
    // every bot sounds a little different
    u.pitch = 0.75 + ((s.seat * 37) % 60) / 100;
    u.rate = 0.95 + ((s.seat * 13) % 20) / 100;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  setVoice(on: boolean) {
    this.voice = on;
    try { localStorage.setItem(PREF, on ? "on" : "off"); } catch {}
    if (!on && typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this.emit();
  }

  dispose() { clearTimeout(this.timer); if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel(); }
}

export function useBotSpeech(messages: ChatMessage[]) {
  const [q] = useState(() => new SpeechQueue());
  useEffect(() => { q.feed(messages); }, [q, messages]);
  useEffect(() => () => q.dispose(), [q]);
  const current = useSyncExternalStore(q.subscribe, q.getSnapshot, () => null);
  const voice = useSyncExternalStore(q.subscribe, () => q.voice, () => false);
  return { current, voice, setVoice: (on: boolean) => q.setVoice(on) };
}
