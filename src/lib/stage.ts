"use client";
// The phone's beat queue: new events → beats, played one after another, each held for its time.
// A plain external store (read with useSyncExternalStore) so React never sets state inside an effect.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { GameEvent } from "@/engine/types";
import { beatsFor, type Beat } from "./beats";

export interface StageSnapshot {
  current: Beat | null;   // on stage right now
  last: Beat | null;      // the most recent big beat — stays visible as "last play"
  pending: number;        // beats still waiting
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export class BeatQueue {
  private seen = -1;
  private queue: Beat[] = [];
  private current: Beat | null = null;
  private last: Beat | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private snap: StageSnapshot = { current: null, last: null, pending: 0 };

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.snap;

  /** Feed every event this phone can see. The first feed only marks history as seen (no replay on reload). */
  feed(events: GameEvent[], names: string[]) {
    if (!events.length) return;
    const top = events[events.length - 1].n;
    if (top <= this.seen) return;
    if (this.seen < 0) {
      this.seen = top;
      this.last = beatsFor(events, names).filter((b) => b.big).at(-1) ?? null;
      return this.emit();
    }
    const fresh = events.filter((e) => e.n > this.seen);
    this.seen = top;
    this.queue.push(...beatsFor(fresh, names));
    if (!this.current) this.next();
    else this.emit();
  }

  /** tap to move on */
  skip = () => { clearTimeout(this.timer); this.next(); };

  dispose() { clearTimeout(this.timer); }

  private next() {
    this.current = this.queue.shift() ?? null;
    if (this.current) {
      if (this.current.big) this.last = this.current;
      // a phone that fell behind (or came back from the background) catches up fast
      const hold = this.queue.length > 2 ? 500 : this.current.hold;
      this.timer = setTimeout(() => this.next(), reducedMotion() ? Math.min(hold, 1800) : hold);
    }
    this.emit();
  }

  private emit() {
    this.snap = { current: this.current, last: this.last, pending: this.queue.length };
    this.listeners.forEach((fn) => fn());
  }
}

/** The stage for one phone. `events` are this phone's visible events (PlayerView.events). */
export function useStage(events: GameEvent[] | undefined, names: string[]) {
  const [queue] = useState(() => new BeatQueue());
  const count = events?.length ?? 0;
  const key = names.join("\u0000");
  useEffect(() => { if (events) queue.feed(events, key.split("\u0000")); }, [queue, events, count, key]);
  useEffect(() => () => queue.dispose(), [queue]);
  const snap = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  return { ...snap, skip: queue.skip };
}
