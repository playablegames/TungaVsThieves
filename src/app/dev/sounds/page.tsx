"use client";
// DEV ONLY: the sound board (owner 2026-11-19) — tap each moment of the game and hear its sound, before the sounds
// are wired into the table. The list is the one the owner approved. Not served in production.
import { notFound } from "next/navigation";
import { useEffect, useState } from "react";
import { playSting, setMood, startMusicOnFirstTap, type Mood } from "@/lib/music";
import { play, unlockOnFirstTap, type Sound } from "@/lib/sfx";

const MOMENTS: { what: string; sound: string; run: () => void }[] = [
  { what: "It becomes YOUR turn", sound: "two rising chimes", run: () => play("yourMove") },
  { what: "Last 5 seconds on the clock", sound: "heartbeat", run: () => play("heartbeat") },
  { what: "You tap a card", sound: "soft tap", run: () => play("tap") },
  { what: "Someone plays a pair", sound: "card whoosh", run: () => play("whoosh") },
  { what: "Someone passes 3 cards", sound: "card whoosh (quieter)", run: () => play("whoosh") },
  { what: "Talashi", sound: "card flip", run: () => play("flip") },
  { what: "Kundli", sound: "mystic shimmer", run: () => play("mystic") },
  { what: "Hera Pheri", sound: "sly swipe", run: () => play("steal") },
  { what: "Bhukamp", sound: "ground rumble", run: () => play("quake") },
  { what: "Teer Kaman — HIT", sound: "arrow, then thud", run: () => play("arrow", true) },
  { what: "Teer Kaman — MISS", sound: "arrow, then clatter", run: () => play("arrow", false) },
  { what: "Dal Badal", sound: "swirl", run: () => play("swirl") },
  { what: "Faisla called", sound: "dhol: dha dhin dhin dha", run: () => play("faisla") },
  { what: "Votes counted", sound: "drumroll, then rising notes", run: () => { play("drumroll"); for (let i = 0; i < 5; i++) setTimeout(() => play("vote" satisfies Sound, i), 1500 + i * 350); } },
  { what: "Someone is out", sound: "temple gong", run: () => play("gong") },
  { what: "Your side wins", sound: "fanfare", run: () => play("fanfare") },
  { what: "Your side loses", sound: "wah wah", run: () => play("sting") },
];

const MUSIC: { what: string; mood: Mood | "win" | "lose" }[] = [
  { what: "While playing (calm loop)", mood: "calm" },
  { what: "During a vote (tense loop)", mood: "tense" },
  { what: "End — you won", mood: "win" },
  { what: "End — you lost", mood: "lose" },
];

export default function SoundBoard() {
  if (process.env.NODE_ENV === "production") notFound();
  const [last, setLast] = useState<string | null>(null);
  // browsers only allow sound after a tap: the first tap anywhere wakes the effects and the music
  useEffect(() => { unlockOnFirstTap(); startMusicOnFirstTap(); }, []);
  return (
    <main className="min-h-dvh bg-[#021230] px-4 pb-10 pt-6 text-white" style={{ fontFamily: "var(--font-poppins), Poppins, sans-serif" }}>
      <h1 className="font-[family-name:var(--font-cinzel)] text-xl font-bold tracking-wider text-[#f7bb1f]">SOUND BOARD</h1>
      <p className="mt-1 text-sm text-[#ffe7a6cc]">Tap a moment to hear it. Turn your phone&apos;s volume up.</p>
      <ul className="mt-4 grid gap-2">
        {MOMENTS.map((m) => (
          <li key={m.what}>
            <button onClick={() => { m.run(); setLast(m.what); }}
              className="flex w-full items-center justify-between rounded-xl bg-[#0c2c6b] px-4 py-3 text-left shadow-[inset_0_0_0_1px_rgba(247,187,31,.4)] active:scale-[.98]"
              style={last === m.what ? { boxShadow: "inset 0 0 0 2px #f7bb1f" } : undefined}>
              <span className="text-[15px] font-semibold">{m.what}</span>
              <span className="ml-3 text-right text-[12px] text-[#ffe7a6b3]">{m.sound}</span>
            </button>
          </li>
        ))}
      </ul>
      <h2 className="mt-8 font-[family-name:var(--font-cinzel)] text-lg font-bold tracking-wider text-[#f7bb1f]">MUSIC</h2>
      <ul className="mt-3 grid gap-2">
        {MUSIC.map((m) => (
          <li key={m.what}>
            <button onClick={() => { if (m.mood === "win" || m.mood === "lose") { setMood("silent"); void playSting(m.mood === "win"); } else setMood(m.mood); setLast(m.what); }}
              className="w-full rounded-xl bg-[#0c2c6b] px-4 py-3 text-left text-[15px] font-semibold shadow-[inset_0_0_0_1px_rgba(247,187,31,.4)] active:scale-[.98]"
              style={last === m.what ? { boxShadow: "inset 0 0 0 2px #f7bb1f" } : undefined}>
              {m.what}
            </button>
          </li>
        ))}
        <li><button onClick={() => { setMood("silent"); setLast(null); }} className="w-full rounded-xl px-4 py-3 text-[15px] font-semibold text-[#ffe7a6] shadow-[inset_0_0_0_1.5px_rgba(247,187,31,.6)]">Stop music</button></li>
      </ul>
    </main>
  );
}
