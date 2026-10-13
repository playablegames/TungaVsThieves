"use client";
// MOTION SETTINGS (designer 2026-10-14: "the shake shouldn't harm anyone — make the settings accessible"). Research:
// vestibular disorders and motion sickness come from the screen moving while the body doesn't; games answer with a shake
// intensity setting down to OFF (Cult of the Lamb's slider), a reduced-motion switch that honours the phone's own setting,
// no turning in a shake (rotation sickens more than sliding), and never more than 3 flashes a second (WCAG 2.3).
// One small store on this phone; every effect asks it (lib/fx.ts, Cinematic.tsx, TableMoment.tsx, globals.css).
import { useSyncExternalStore } from "react";

export type Shake = 0 | 0.5 | 1;
export interface MotionPrefs { shake: Shake; reduced: boolean; flashes: boolean }
const KEY = "tunga:motion";
const DEFAULT: MotionPrefs = { shake: 0.5, reduced: false, flashes: true };

const osReduced = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
function load(): MotionPrefs {
  try { return { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<MotionPrefs>) }; } catch { return DEFAULT; }
}
let prefs: MotionPrefs = typeof window === "undefined" ? DEFAULT : load();
const listeners = new Set<() => void>();

/** mark the page so CSS can stop its own motion too (idle cards, stamped words, shakes) */
function apply() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.motion = motionReduced() ? "reduced" : "full";
  document.documentElement.dataset.flashes = prefs.flashes && !motionReduced() ? "on" : "off";
}

export function setMotion(p: Partial<MotionPrefs>) {
  prefs = { ...prefs, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
  apply();
  listeners.forEach((f) => f());
}
export const motionPrefs = () => prefs;
/** the phone asks for less motion, or the player did */
export const motionReduced = () => osReduced() || prefs.reduced;
/** how hard a shake may be: 0 = none, 1 = full */
export const shakeScale = () => (motionReduced() ? 0 : prefs.shake);
export const flashesOn = () => prefs.flashes && !motionReduced();

const subscribe = (f: () => void) => { listeners.add(f); return () => { listeners.delete(f); }; };
export const useMotion = () => useSyncExternalStore(subscribe, () => prefs, () => DEFAULT);

// last, once everything above exists (calling it earlier crashed the page: motionReduced was not defined yet)
apply();
