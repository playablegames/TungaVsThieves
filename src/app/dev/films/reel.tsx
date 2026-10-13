"use client";
import { useEffect, useState } from "react";
import type { Beat } from "@/lib/beats";
import { CinematicOverlay, FinaleBackdrop, NightfallOverlay } from "@/components/Cinematic";

const beat = (type: string, result?: Beat["result"]): Beat => ({ n: 0, type, title: "", tone: "neutral", big: true, hold: 0, private: false, result });
const REEL: { label: string; ms: number; el: () => React.ReactNode }[] = [
  { label: "Teer Kaman — HIT", ms: 2100, el: () => <CinematicOverlay beat={beat("teer_kaman", "hit")} /> },
  { label: "Teer Kaman — MISS", ms: 2100, el: () => <CinematicOverlay beat={beat("teer_kaman", "miss")} /> },
  { label: "Kundli", ms: 2100, el: () => <CinematicOverlay beat={beat("kundli")} /> },
  { label: "Bhukamp", ms: 2100, el: () => <CinematicOverlay beat={beat("batwara")} /> },
  { label: "Hera Pheri", ms: 2100, el: () => <CinematicOverlay beat={beat("hera_pheri")} /> },
  { label: "Talashi", ms: 2100, el: () => <CinematicOverlay beat={beat("talashi")} /> },
  { label: "Faisla", ms: 2100, el: () => <CinematicOverlay beat={beat("faisla")} /> },
  { label: "Dal Badal", ms: 2100, el: () => <CinematicOverlay beat={beat("dal_badal")} /> },
  { label: "Nightfall — round 2", ms: 2400, el: () => <NightfallOverlay round={2} /> },
  { label: "Game over — village wins", ms: 3600, el: () => <FinaleBackdrop village /> },
  { label: "Game over — thieves win", ms: 3600, el: () => <FinaleBackdrop village={false} /> },
];

export function FilmReel() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setTimeout(() => setI((x) => (x + 1) % REEL.length), REEL[i].ms); return () => clearTimeout(t); }, [i]);
  return (
    <main className="min-h-dvh">
      <div key={i}>{REEL[i].el()}</div>
      <p className="fixed left-0 right-0 top-2 z-[70] text-center text-[12px] text-white/60">{i + 1}/{REEL.length} · {REEL[i].label}</p>
    </main>
  );
}
