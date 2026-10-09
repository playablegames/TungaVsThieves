"use client";
// Bot lines on the phone: one at a time, the speaking seat lights up. The words themselves go in the centre feed,
// which also reads them aloud (lib/feed.ts). A plain external store so React never
// sets state inside an effect.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ChatMessage } from "@/server/store";
import { isSystemMessage } from "./whisper";
import { hush } from "./speech";

const SHOW_MS = 3400;
const PREF = "tunga:botvoice";

export interface Speech { seat: number; name: string; text: string }

class SpeechQueue {
  private seen = -1;
  private queue: Speech[] = [];
  private current: Speech | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  /** read the table aloud (designer 2026-10-09: "no voice is heard") — ON unless this phone turned it off.
   *  The reading itself happens in the table feed (lib/feed.ts → lib/speech.ts), one queue with the narrator. */
  voice = true;

  constructor() {
    try { this.voice = localStorage.getItem(PREF) !== "off"; } catch {}
  }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.current;
  private emit() { this.listeners.forEach((f) => f()); }

  /** The first feed only marks history as heard — no replay of old lines on reload. */
  feed(messages: ChatMessage[]) {
    const top = messages.at(-1)?.id ?? 0;
    if (this.seen < 0) { this.seen = top; return; }
    // reactions (thrown emojis) travel as messages too, but they are not speech
    const fresh = messages.filter((m) => m.id > this.seen && !isSystemMessage(m.text));
    if (!fresh.length) return;
    this.seen = top;
    this.queue.push(...fresh.map((m) => ({ seat: m.seat, name: m.name, text: m.text })));
    if (this.queue.length > 6) this.queue.splice(0, this.queue.length - 6); // a phone that fell behind skips ahead
    if (!this.current) this.next();
  }

  private next() {
    this.current = this.queue.shift() ?? null;
    if (this.current) {
      this.timer = setTimeout(() => this.next(), SHOW_MS);
    }
    this.emit();
  }

  setVoice(on: boolean) {
    this.voice = on;
    try { localStorage.setItem(PREF, on ? "on" : "off"); } catch {}
    if (!on) hush();
    this.emit();
  }

  dispose() { clearTimeout(this.timer); }
}

export function useBotSpeech(messages: ChatMessage[]) {
  const [q] = useState(() => new SpeechQueue());
  useEffect(() => { q.feed(messages); }, [q, messages]);
  useEffect(() => () => q.dispose(), [q]);
  const current = useSyncExternalStore(q.subscribe, q.getSnapshot, () => null);
  const voice = useSyncExternalStore(q.subscribe, () => q.voice, () => false);
  return { current, voice, setVoice: (on: boolean) => q.setVoice(on) };
}
