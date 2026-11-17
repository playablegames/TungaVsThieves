"use client";
// BLOCK A PLAYER (2026-11-17, Google Play user-content policy): per table, on this phone only. A blocked player's
// messages are hidden from you and their voice is muted for you; the game itself goes on as normal.
import { useSyncExternalStore } from "react";

const key = (code: string) => `tunga:blocked:${code.toUpperCase()}`;
const subs = new Set<() => void>();
const cache = new Map<string, number[]>();

export function blockedSeats(code: string): number[] {
  if (!cache.has(code)) {
    let v: unknown = [];
    try { v = JSON.parse(localStorage.getItem(key(code)) ?? "[]"); } catch {}
    cache.set(code, Array.isArray(v) ? (v as number[]) : []);
  }
  return cache.get(code)!;
}

export function setBlocked(code: string, seat: number, on: boolean) {
  const now = blockedSeats(code).filter((s) => s !== seat).concat(on ? [seat] : []);
  cache.set(code, now);
  try { localStorage.setItem(key(code), JSON.stringify(now)); } catch {}
  subs.forEach((f) => f());
}

const NONE: number[] = [];
export function useBlocked(code: string): number[] {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => blockedSeats(code), () => NONE);
}
