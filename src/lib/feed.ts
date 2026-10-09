"use client";
// THE TABLE FEED (designer 2026-10-09: "every little thing must be displayed at the center — accusations, updates,
// everything"). One running list in the middle of the table, in the order this phone learned of it: every public play
// and result, every claim and accusation, every bot line, every spoken sentence (captions), every quick line, every
// ballot as it is cast, every thrown reaction. (Whispers arrive as game events: who → whom only.)
// Research note (reports/Social deduction table UI.md): kill-feed style — newest at the bottom, biggest; older lines
// shrink and fade; who → what → whom in the speaker's seat colour; nothing disappears, tap for the whole list.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { ChatMessage } from "@/server/store";
import type { Beat, Tone } from "./beats";
import { isReaction, REACT_PREFIX } from "./reactions";
import { CAPTION_PREFIX, QUICK_PREFIX, isCaption, isQuick, isSystemMessage } from "./whisper";

export { CAPTION_PREFIX, QUICK_PREFIX } from "./whisper";

export type FeedKind = "event" | "claim" | "talk" | "caption" | "vote" | "react" | "whisper";
export interface FeedItem {
  id: string;
  kind: FeedKind;
  /** who said / did it */
  seat?: number;
  /** at whom */
  target?: number;
  text: string;
  detail?: string;
  tone: Tone;
  /** arrived before this phone opened the table — never read aloud */
  old: boolean;
  /** only this phone sees it (your Kundli read, what you took) */
  mine?: boolean;
}

const KEEP = 200;

export class FeedLog {
  items: FeedItem[] = [];
  private lastBeat = -1;
  private lastMsg = -1;
  private ballots: Record<string, number | null> | null = null;
  private started = false;
  private listeners = new Set<() => void>();
  private onFresh: ((it: FeedItem) => void) | null = null;
  /** called for every NEW item (not history) — the table reads talk aloud from here */
  listen(fn: (it: FeedItem) => void) { this.onFresh = fn; }

  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getSnapshot = () => this.items;

  private push(fresh: FeedItem[]) {
    if (!fresh.length) return;
    this.items = [...this.items, ...fresh].slice(-KEEP);
    if (this.started) for (const it of fresh) this.onFresh?.(it);
    this.listeners.forEach((f) => f());
  }

  /** `caughtUp` = this phone's stage has shown every public play so far. Until it has, new talk waits — a bot's
   *  reply to a play must never appear above the play itself. */
  ingest(beats: Beat[], messages: ChatMessage[], ballots: Record<string, number | null> | null, names: string[], caughtUp = true) {
    const old = !this.started;
    const out: FeedItem[] = [];
    for (const b of beats) {
      if (b.n <= this.lastBeat) continue;
      this.lastBeat = b.n;
      out.push(b.type === "claim"
        ? { id: `b${b.n}`, kind: "claim", seat: b.actor, target: b.target, text: b.title, tone: b.tone, old }
        : { id: `b${b.n}`, kind: "event", seat: b.actor, target: b.target, text: b.title, detail: b.detail, tone: b.tone, old, mine: b.private });
    }
    for (const m of caughtUp || old ? messages : []) {
      if (m.id <= this.lastMsg) continue;
      this.lastMsg = m.id;
      const it = fromMessage(m, names, old);
      if (it) out.push(it);
    }
    // open voting: every ballot shows the moment it lands, and every change of mind
    if (ballots) {
      const was = this.ballots ?? {};
      for (const [k, to] of Object.entries(ballots)) {
        if (k in was && was[k] === to) continue;
        const voter = Number(k);
        const changed = k in was;
        out.push({
          id: `v${k}:${to}:${Date.now()}`, kind: "vote", seat: voter, target: to ?? undefined, tone: "vote", old,
          text: to === null ? `${nm(names, voter)} skips the vote` : `${nm(names, voter)} ${changed ? "switched to" : "voted for"} ${nm(names, to)}`,
        });
      }
    }
    this.ballots = ballots ? { ...ballots } : null;
    this.push(out);
    this.started = true;
  }
}

const nm = (names: string[], seat: number) => (names[seat] ?? "?").replace(/\s*🤖$/, "");

function fromMessage(m: ChatMessage, names: string[], old: boolean): FeedItem | null {
  const id = `m${m.id}`;
  if (isCaption(m.text)) return { id, kind: "caption", seat: m.seat, text: m.text.slice(CAPTION_PREFIX.length), tone: "neutral", old };
  if (isQuick(m.text)) return { id, kind: "talk", seat: m.seat, text: m.text.slice(QUICK_PREFIX.length), tone: "neutral", old };
  if (isReaction(m.text)) {
    const [emoji, to] = m.text.slice(REACT_PREFIX.length).split("|");
    return { id, kind: "react", seat: m.seat, target: Number(to), text: `${nm(names, m.seat)} threw ${emoji} at ${nm(names, Number(to))}`, tone: "neutral", old };
  }
  if (isSystemMessage(m.text)) return null;
  return { id, kind: "talk", seat: m.seat, text: m.text, tone: "neutral", old };
}

export function useFeed(beats: Beat[], messages: ChatMessage[], ballots: Record<string, number | null> | null, names: string[], caughtUp: boolean, onFresh: (it: FeedItem) => void) {
  const [log] = useState(() => new FeedLog());
  useEffect(() => { log.listen(onFresh); }, [log, onFresh]);
  useEffect(() => { log.ingest(beats, messages, ballots, names, caughtUp); }, [log, beats, messages, ballots, names, caughtUp]);
  return useSyncExternalStore(log.subscribe, log.getSnapshot, log.getSnapshot);
}
