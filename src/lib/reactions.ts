"use client";
// Thrown reactions (2026-10-07, "viral like Among Us / Ludo King"): tap a seat, throw 🍅 😂 🤨 🙏 🔥 👀 at that player.
// They travel as table messages with a marker prefix, so every phone sees them; bot speech skips them.
// A plain external store (read with useSyncExternalStore) so React never sets state inside an effect.
import type { ChatMessage } from "@/server/store";
import { play } from "./sfx";
import { decodeWhisper, isWhisper, type Whisper } from "./whisper";

export const REACT_PREFIX = "\u0001r|";
// (2026-10-09, "simplify") three are enough
export const REACTIONS = ["🍅", "😂", "🔥"] as const;
export const isReaction = (text: string) => text.startsWith(REACT_PREFIX);
export const reactionText = (emoji: string, target: number) => `${REACT_PREFIX}${emoji}|${target}`;

export interface Throw { id: number; from: number; to: number; emoji: string }
/** a whisper that reached THIS phone, with what was said */
export interface Incoming extends Whisper { id: number; name: string }
const FLIGHT_MS = 1100;

export class ThrowQueue {
  private seen = -1;
  private flying: Throw[] = [];
  private inbox: Incoming[] = [];
  private listeners = new Set<() => void>();
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.flying;
  getInbox = () => this.inbox;
  /** the player has heard / read it */
  dismiss = (id: number) => { this.inbox = this.inbox.filter((w) => w.id !== id); this.listeners.forEach((f) => f()); };
  private emit() { this.flying = [...this.flying]; this.listeners.forEach((f) => f()); }

  /** the first feed only marks history as seen — old reactions are not replayed on reload */
  feed(messages: ChatMessage[], me = -1) {
    const top = messages.at(-1)?.id ?? 0;
    if (this.seen < 0) { this.seen = top; return; }
    const fresh = messages.filter((m) => m.id > this.seen && (isReaction(m.text) || isWhisper(m.text)));
    this.seen = top;
    if (!fresh.length) return;
    for (const m of fresh.slice(-6)) {
      // a whisper: everyone sees the 👂 travel; only the receiver gets what was said
      const w = isWhisper(m.text) ? decodeWhisper(m.seat, m.text) : null;
      if (w) {
        const t: Throw = { id: m.id, from: w.from, to: w.to, emoji: "👂" };
        this.flying.push(t);
        setTimeout(() => { this.flying = this.flying.filter((x) => x.id !== t.id); this.emit(); }, FLIGHT_MS + 50);
        if (w.body && w.to === me) { this.inbox = [...this.inbox, { ...w, id: m.id, name: m.name }]; setTimeout(() => play("shh"), FLIGHT_MS * 0.8); }
        continue;
      }
      const [emoji, to] = m.text.slice(REACT_PREFIX.length).split("|");
      if (!(REACTIONS as readonly string[]).includes(emoji)) continue;
      const t: Throw = { id: m.id, from: m.seat, to: Number(to), emoji };
      this.flying.push(t);
      setTimeout(() => play("splat"), FLIGHT_MS * 0.85);
      setTimeout(() => { this.flying = this.flying.filter((x) => x.id !== t.id); this.emit(); }, FLIGHT_MS + 50);
    }
    this.emit();
  }
}
