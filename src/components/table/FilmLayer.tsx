"use client";
// THE FILMS ON THE TABLE (owner 2026-11-20). Each NEW public moment plays its ~2 s film over the table (src/components/
// table/films.ts picks it); the phone plays the film's sounds on cue (src/lib/filmCues.ts); the line ("Raju robs Pappu")
// is written under it as plain text. A tap skips. Moments that come quickly queue up (at most 3 waiting). Events that
// were already there when the table opened stay quiet. The game clock keeps running — a film never blocks a move.
import { useEffect, useRef, useState } from "react";
import { playCues } from "@/lib/filmCues";
import { play } from "@/lib/sfx";
import type { TableView } from "@/server/game";
import { filmFor, type Film } from "./films";

const MAX_WAITING = 3;

export function FilmLayer({ view }: { view: TableView }) {
  const seen = useRef<number | null>(null);
  const stop = useRef<() => void>(() => {});
  const [queue, setQueue] = useState<Film[]>([]);
  const lastN = view.events.at(-1)?.n ?? 0;

  useEffect(() => {
    if (seen.current === null) { seen.current = lastN; return; } // opening the table: the past stays quiet
    const name = (seat: number) => view.players[seat]?.name ?? "";
    const fresh = view.events.filter((e) => e.n > seen.current!).map((e) => filmFor(e, view.events, name)).filter((f): f is Film => f !== null);
    seen.current = lastN;
    if (fresh.length) setQueue((q) => [...q, ...fresh].slice(-MAX_WAITING - 1));
  }, [lastN, view.events, view.players]);

  // the film on screen stops its sounds if it is skipped or the table closes
  useEffect(() => () => stop.current(), []);

  const now = queue[0];
  if (!now) return null;
  const next = () => { stop.current(); stop.current = () => {}; setQueue((q) => q.slice(1)); };

  return (
    <div className="absolute inset-0 z-30 cursor-pointer bg-[#15142c]" onClick={next} role="dialog" aria-label={now.line}>
      <video key={now.key} src={`/video/${now.file}.mp4`} muted playsInline autoPlay preload="auto"
        className="absolute inset-0 size-full object-cover"
        onPlaying={() => { stop.current(); stop.current = playCues(now.cues, play); }}
        onEnded={next} onError={next} />
      {now.line && <p className="tt-pop absolute inset-x-6 text-center text-[19px] font-semibold leading-snug text-[#ffe7a6]"
        style={{ top: 744, animationDelay: ".5s", textShadow: "0 2px 12px rgba(0,0,0,.95)" }}>{now.line}</p>}
      <p className="absolute inset-x-0 bottom-6 text-center text-[11px] text-[#ffe7a680]">Tap to skip</p>
    </div>
  );
}
