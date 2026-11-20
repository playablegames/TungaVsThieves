"use client";
// DEV ONLY (localhost:3210/dev/films): watch each film WITH its sounds, the way the phone will play it (silent video + the table's sounds on cue).
import { notFound } from "next/navigation";
import { useRef, useState } from "react";
import { FILM_CUES, playCues } from "@/lib/filmCues";
import { play } from "@/lib/sfx";

const FILMS: { name: string; file: string; cues: string }[] = [
  { name: "Kundli", file: "kundli", cues: "kundli" },
  { name: "Talashi", file: "talashi", cues: "talashi" },
  { name: "Hera Pheri", file: "hera-pheri", cues: "hera-pheri" },
  { name: "Bhukamp", file: "bhukamp", cues: "bhukamp" },
  { name: "Teer Kaman aim", file: "teer-kaman-aim", cues: "teer-kaman-aim" },
  { name: "Teer Kaman hit", file: "teer-kaman-hit", cues: "teer-kaman-hit" },
  { name: "Teer Kaman miss", file: "teer-kaman-miss", cues: "teer-kaman-miss" },
  { name: "Dal Badal", file: "dal-badal-chor", cues: "dal-badal" },
  { name: "Faisla", file: "faisla", cues: "faisla" },
  { name: "Faisla: out", file: "faisla-out", cues: "faisla-out" },
  { name: "Faisla: nobody out", file: "faisla-nobody", cues: "faisla-nobody" },
  { name: "Extra vote gift", file: "vote-gift", cues: "vote-gift" },
  { name: "Round 2", file: "round-2", cues: "round" },
  { name: "Final vote: no Stone (= Faisla out)", file: "faisla-out", cues: "faisla-out" },
  { name: "Final vote: Tunga → village", file: "final-vote-tunga-village", cues: "final-vote" },
  { name: "Final vote: both → thieves", file: "final-vote-both-thieves", cues: "final-vote" },
  { name: "Final vote: Bhadra → village", file: "final-vote-bhadra-village", cues: "final-vote" },
  { name: "Village wins", file: "winner-village", cues: "winner-village" },
  { name: "Thieves win", file: "winner-thieves", cues: "winner-thieves" },
  { name: "Role: Kisaan", file: "role-kisaan", cues: "role" },
  { name: "Role: Sarpanch", file: "role-sarpanch", cues: "role" },
  { name: "Role: Baba", file: "role-baba", cues: "role" },
  { name: "Role: Teacher", file: "role-teacher", cues: "role" },
  { name: "Role: Police", file: "role-police", cues: "role" },
  { name: "Role: Doctor", file: "role-doctor", cues: "role" },
  { name: "Role: NRI", file: "role-nri", cues: "role" },
  { name: "Role: Deewani", file: "role-deewani", cues: "role" },
  { name: "Role: Chor", file: "role-chor", cues: "role" },
  { name: "Role: Lootera", file: "role-lootera", cues: "role" },
  { name: "Role: Gunda", file: "role-gunda", cues: "role" },
  { name: "Role: Daku", file: "role-daku", cues: "role" },
];

/** when this page loaded: part of each video url, so a reload always fetches the newest render */
const LOADED = Date.now();

export default function DevFilms() {
  const video = useRef<HTMLVideoElement>(null);
  const stop = useRef<() => void>(() => {});
  const plays = useRef(0);
  const [on, setOn] = useState<string | null>(null);
  if (process.env.NODE_ENV === "production") notFound();

  const start = (f: (typeof FILMS)[number]) => {
    play("tap"); // wakes the sound inside the tap, so the cues that follow are heard
    stop.current();
    setOn(f.name);
    const v = video.current!;
    v.src = `/video/${f.file}.mp4?v=${LOADED}-${++plays.current}`; // a fresh url each play, so the newest render shows
    v.onplaying = () => { stop.current(); stop.current = playCues(f.cues, play); };
    void v.play();
  };

  return (
    <main className="flex min-h-dvh flex-col items-center gap-3 bg-[#021230] p-3 text-[#ffe7a6]">
      <video ref={video} muted playsInline className="h-[52dvh] rounded-xl bg-black" />
      <p className="text-sm">{on ?? "Tap a film"} {on && `· ${FILM_CUES[FILMS.find((x) => x.name === on)!.cues]?.length ?? 0} sounds`}</p>
      <div className="grid w-full max-w-[420px] grid-cols-2 gap-2">
        {FILMS.map((f) => (
          <button key={f.name} onClick={() => start(f)} className="min-h-11 rounded-xl px-2 text-[13.5px] font-semibold shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)]">{f.name}</button>
        ))}
      </div>
    </main>
  );
}
