"use client";
// THE DOOR (2026-11-16): before a first game the phone asks when you were born and shows the Terms of use.
//  - Only "18 or over: yes / no" is remembered, on this phone. The birth date itself is never stored or sent.
//  - Under 18 = BOTS ONLY: no tables with other people, no voice, no chat, no typed name, no turn alerts — so the game
//    holds nothing personal about a child (India's DPDP Act asks a parent's consent for that; Google Play asks that
//    children are kept from open chat).
//  - The answer can't be changed from inside the game (a neutral age check must not invite a second try).
import { ADULT_AGE, TERMS_VERSION } from "./legal";

const KEY = "tunga:gate";
export type Gate = { adult: boolean; terms: number };

export function readGate(): Gate | null {
  try {
    const g = JSON.parse(localStorage.getItem(KEY) ?? "null") as Gate | null;
    return g && typeof g.adult === "boolean" && g.terms === TERMS_VERSION ? g : null;
  } catch { return null; }
}

/** the age answer alone, kept even when the Terms of use change (they are agreed to again, the age is not asked again) */
export function readAge(): boolean | null {
  try {
    const g = JSON.parse(localStorage.getItem(KEY) ?? "null") as Gate | null;
    return g && typeof g.adult === "boolean" ? g.adult : null;
  } catch { return null; }
}

export function saveGate(adult: boolean) {
  try { localStorage.setItem(KEY, JSON.stringify({ adult, terms: TERMS_VERSION } satisfies Gate)); } catch {}
}

export const isMinor = () => readAge() === false;

/** whole years between a birth month and today; the birth month itself counts as not yet reached */
export function ageFrom(year: number, month: number, now = new Date()): number {
  const years = now.getFullYear() - year;
  return now.getMonth() + 1 > month ? years : years - 1;
}
export const isAdult = (year: number, month: number, now = new Date()) => ageFrom(year, month, now) >= ADULT_AGE;

/** a child never types a name: one of these is theirs for the game */
export const NICKNAMES = ["Moon", "Lantern", "Marigold", "Banyan", "River", "Kite", "Peacock", "Mango"];
