"use client";
// THE TABLE'S SOUNDS (owner approved the sound board 2026-11-19: "all good, wire them in"). Driven by the game's
// events, never by polling state: each NEW event plays its sound once. Events already there when the table opens
// stay silent. Music: calm while playing, tense during a vote, the win/lose piece at the end.
import { useEffect, useRef } from "react";
import { playSting, setMood, startMusicOnFirstTap, stopMusic } from "@/lib/music";
import { play, unlockOnFirstTap } from "@/lib/sfx";
import type { TableView } from "@/server/game";

type Ev = TableView["events"][number];

/** the sound for one event, if it has one */
export function soundFor(e: Ev, you: number) {
  const d = e.data ?? {};
  switch (e.type) {
    case "play":
      play("whoosh");
      switch (d.card) {
        case "TALASHI": return play("flip");
        case "KUNDLI": return play("mystic");
        case "HERA_PHERI": return play("steal");
        case "BHUKAMP": return play("quake");
      }
      return; // Faisla's dhol plays on its "vote" event; Teer Kaman's arrow on the shot
    case "pass": return play("whoosh", true);
    case "vote": return play("faisla");
    case "tally": {
      play("drumroll");
      const votes = Object.values((d.ballots ?? {}) as Record<string, { for: number | null }>).filter((b) => b.for !== null).length;
      for (let i = 0; i < votes; i++) setTimeout(() => play("vote", i), 1300 + i * 300);
      return;
    }
    case "teer_kaman": return play("arrow", d.hit === true);
    case "dal_badal": return play("swirl");
    case "out": return play("gong");
    case "over": {
      const me = (d.players as { seat: number; side: string }[] | undefined)?.find((p) => p.seat === you);
      const won = !!me && me.side === d.winner;
      play(won ? "fanfare" : "sting");
      setMood("silent");
      void playSting(won);
      return;
    }
  }
}

export function useTableSounds(view: TableView, left: number | null) {
  const seen = useRef<number | null>(null);
  const wasMyTurn = useRef(false);
  const lastBeat = useRef<number | null>(null);
  const you = view.you;
  const ph = view.phase;
  const myTurn = ph.kind === "turn" && ph.seat === you;
  const waitingOnMe = (ph.kind === "turn" || ph.kind === "pass" || ph.kind === "gift") ? ph.seat === you
    : ph.kind === "aim" ? ph.shooter === you
    : ph.kind === "vote" ? !(you in ph.ballots) && view.players[you]?.alive === true
    : ph.kind === "bhukamp" ? !(you in ph.picks) && view.players[you]?.alive === true : false;

  // browsers only allow sound after a tap: the first tap anywhere wakes the effects and the music
  useEffect(() => { unlockOnFirstTap(); startMusicOnFirstTap(); return () => stopMusic(); }, []);

  // each new event, once
  const lastN = view.events.at(-1)?.n ?? 0;
  useEffect(() => {
    if (seen.current === null) { seen.current = lastN; return; } // opening the table: the past stays quiet
    for (const e of view.events) if (e.n > seen.current) soundFor(e, you);
    seen.current = lastN;
  }, [lastN, view.events, you]);

  // it becomes your turn
  useEffect(() => {
    if (myTurn && !wasMyTurn.current) play("yourMove");
    wasMyTurn.current = myTurn;
  }, [myTurn]);

  // the music follows the game
  useEffect(() => {
    if (ph.kind === "over") return;
    setMood(ph.kind === "vote" ? "tense" : "calm");
  }, [ph.kind]);

  // the last 5 seconds of YOUR decision: one heartbeat a second
  const sec = left === null ? null : Math.ceil(left);
  useEffect(() => {
    if (!waitingOnMe || sec === null || sec > 5 || sec < 1) { lastBeat.current = null; return; }
    if (lastBeat.current !== sec) { lastBeat.current = sec; play("heartbeat"); }
  }, [sec, waitingOnMe]);
}
