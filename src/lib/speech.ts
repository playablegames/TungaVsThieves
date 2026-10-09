"use client";
// One voice queue for the phone's own text-to-speech (free, offline): the Sutradhar and the table talk share it,
// so neither cuts the other off mid-sentence. The narrator jumps the queue; talk waits its turn; a phone that fell
// behind drops the oldest talk rather than reading a backlog.
// With voice chat (designer 2026-10-09):
//  · an UPDATE (the Sutradhar, `urgent`) has priority over voice chat: it speaks AT ONCE, the same moment its line
//    lands in the centre — it interrupts a talk line, the table's voices duck under it and your mic is held for it.
//  · TALK (bot lines, claims) waits for a QUIET moment — nobody talking, your talk button not held — holds your mic
//    while it plays, and push-to-talk cuts it. A talk line that has waited 8 s is FORCED through like an update
//    (designer 2026-10-09: bots must be heard at a chatty table) — voices duck, mic held.
import { useSyncExternalStore } from "react";

export interface Line { text: string; lang: string; pitch?: number; rate?: number; urgent?: boolean }
interface Waiting extends Line { at: number }

const MAX_WAITING = 3;
const STALE_MS = 8000;
let waiting: Waiting[] = [];
let busy = false;
let poll: ReturnType<typeof setTimeout> | undefined;
let quiet: () => boolean = () => true;

// ---- `reading`: what this phone is speaking right now (the mic is held for it; an update also ducks the table)
export type Reading = "update" | "talk" | null;
let reading: Reading = null;
const listeners = new Set<() => void>();
const setReading = (v: Reading) => { if (reading !== v) { reading = v; listeners.forEach((f) => f()); } };
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useReading = () => useSyncExternalStore(subscribe, () => reading, () => null);
export const readingState = () => reading;

const ok = () => typeof window !== "undefined" && "speechSynthesis" in window;

function voiceFor(lang: string): SpeechSynthesisVoice | null {
  try {
    const vs = speechSynthesis.getVoices();
    const base = lang.split("-")[0];
    return vs.find((v) => v.lang === lang) ?? vs.find((v) => v.lang.startsWith(base)) ?? vs.find((v) => v.lang.startsWith("en")) ?? null;
  } catch { return null; }
}

let current: Waiting | null = null;

function next() {
  clearTimeout(poll);
  busy = false;
  current = null;
  setReading(null);
  if (!waiting.length) return;
  // talk waits for the gap (someone talking, or your talk button held) — for 8 s at most; an update never waits
  const forced = !waiting[0].urgent && Date.now() - waiting[0].at >= STALE_MS;
  if (!waiting[0].urgent && !forced && !quiet()) { poll = setTimeout(next, 250); return; }
  const l = forced ? { ...waiting.shift()!, urgent: true } : waiting.shift()!;
  busy = true;
  current = l;
  setReading(l.urgent ? "update" : "talk");
  try {
    const u = new SpeechSynthesisUtterance(l.text.replace(/\p{Extended_Pictographic}/gu, ""));
    const v = voiceFor(l.lang);
    if (v) u.voice = v;
    u.lang = v?.lang ?? l.lang;
    u.pitch = l.pitch ?? 1;
    u.rate = l.rate ?? 1.05;
    // a stuck engine (it happens on Android) must not freeze the queue or hold the mic
    const guard = setTimeout(next, 9000);
    u.onend = u.onerror = () => { clearTimeout(guard); next(); };
    speechSynthesis.speak(u);
  } catch { next(); }
}

export function say(l: Line) {
  if (!ok() || !l.text.trim()) return;
  const w = { ...l, at: Date.now() };
  if (l.urgent) {
    // an update goes first — after any update already queued, and cutting off a talk line mid-sentence
    const i = waiting.findIndex((x) => !x.urgent);
    waiting.splice(i < 0 ? waiting.length : i, 0, w);
    if (busy && current && !current.urgent) { try { speechSynthesis.cancel(); } catch {} return; }
  }
  else {
    waiting.push(w);
    // a phone that fell behind drops its oldest TALK; updates are never dropped
    while (waiting.filter((x) => !x.urgent).length > MAX_WAITING) waiting.splice(waiting.findIndex((x) => !x.urgent), 1);
  }
  if (!busy) next();
}

/** the table tells the queue when it is quiet enough to speak */
export function setQuiet(fn: () => boolean) { quiet = fn; }

/** push-to-talk pressed: stop a TALK line now (the rest wait for the next gap). An update is never cut. */
export function cut() {
  if (!busy || !ok() || current?.urgent) return;
  try { speechSynthesis.cancel(); } catch {}
}

export function hush() {
  waiting = [];
  clearTimeout(poll);
  busy = false;
  current = null;
  setReading(null);
  if (ok()) try { speechSynthesis.cancel(); } catch {}
}
