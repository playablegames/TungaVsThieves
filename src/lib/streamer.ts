"use client";
// STREAMER MODE (designer 2026-10-14: "YouTubers streaming these games are one of the best sources of marketing").
// On this phone only: the table code and the invite link never show on screen (viewers can't crash the table), and the
// streamer's OWN role sits in a corner badge for the audience — the dramatic irony that makes social deduction streams
// fun to watch (the viewers know; the table doesn't).
import { useSyncExternalStore } from "react";

const KEY = "tunga:streamer";
let on = false;
try { on = localStorage.getItem(KEY) === "on"; } catch {}
const listeners = new Set<() => void>();
export function setStreamer(v: boolean) { on = v; try { localStorage.setItem(KEY, v ? "on" : "off"); } catch {} listeners.forEach((f) => f()); }
const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useStreamer = () => useSyncExternalStore(subscribe, () => on, () => false);
