"use client";
// DEV ONLY — every film back to back, for screen checks (recorded to video for the designer). Production: 404.
import { useEffect, useState } from "react";
import { CardFilm, FinaleBackdrop, FinalVoteOverlay, NightfallOverlay, type CineKind } from "@/components/Cinematic";

function card(kind: CineKind, hit = true) {
  return function CardReel() { return <div className="fixed inset-0"><CardFilm kind={kind} hit={hit} /></div>; };
}
const REEL: { label: string; ms: number; el: () => React.ReactNode }[] = [
  { label: "Round 2 intro", ms: 4000, el: () => <NightfallOverlay round={2} rounds={3} /> },
  { label: "Round 3 intro — the last round", ms: 4000, el: () => <NightfallOverlay round={3} rounds={3} /> },
  { label: "Mandatory vote intro — the Stone rules", ms: 8400, el: () => <FinalVoteOverlay /> },
  { label: "Card film (How to play) — Teer Kaman HIT", ms: 4700, el: card("teer_kaman") },
  { label: "Card film — Teer Kaman MISS", ms: 4700, el: card("teer_kaman", false) },
  { label: "Card film — Kundli", ms: 4700, el: card("kundli") },
  { label: "Card film — Bhukamp", ms: 4700, el: card("batwara") },
  { label: "Card film — Hera Pheri", ms: 4700, el: card("hera_pheri") },
  { label: "Card film — Talashi", ms: 4700, el: card("talashi") },
  { label: "Card film — Faisla", ms: 4700, el: card("faisla") },
  { label: "Card film — Dal Badal", ms: 4700, el: card("dal_badal") },
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
