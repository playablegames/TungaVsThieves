"use client";
// Push-to-talk (research 2026-10-07): for a noisy room or a shy player — the mic opens only while the talk button is held.
// A tiny external store: the menu switch and the big talk button share it without React state in effects.
import { useSyncExternalStore } from "react";

const PREF = "tunga:ptt";
let on = false, down = false;
try { on = localStorage.getItem(PREF) === "on"; } catch {}
const listeners = new Set<() => void>();
let snap = { on, down };
const emit = () => { snap = { on, down }; listeners.forEach((f) => f()); };

export function setPtt(v: boolean) { on = v; down = false; try { localStorage.setItem(PREF, v ? "on" : "off"); } catch {} emit(); }
export function setTalking(v: boolean) { if (down !== v) { down = v; emit(); } }

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
const OFF = { on: false, down: false };
export const usePtt = () => useSyncExternalStore(subscribe, () => snap, () => OFF);
