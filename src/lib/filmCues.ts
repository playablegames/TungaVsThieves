// THE FILMS' SOUNDS (owner 2026-11-20: "each animation must have a sound"). The films are silent video files; the
// phone plays the table's own sounds (src/lib/sfx.ts, owner-approved board) ON CUE, timed to each film's beats.
// Sound from the phone, not the video: phones block a video's sound until a tap, the table's sound is already awake.
// Times are seconds from the film's first frame (30 fps: frame / 30). Keep in step with the film files in video/.
import type { Sound } from "./sfx";

export interface Cue { at: number; sound: Sound; arg?: number | boolean }

export const FILM_CUES: Record<string, Cue[]> = {
  // YourRole: lifts at frame 14, flips at 30
  "role": [{ at: 0.47, sound: "whoosh", arg: true }, { at: 1.0, sound: "flip" }],
  // the arrow sound has its own 0.36 s flight before the thud: start it so the thud lands on frame 34
  "teer-kaman-hit": [{ at: 0.4, sound: "arrow", arg: true }],  // 1.5x film: the thud lands on frame 23
  // the glance is frame 30; the clatter comes 0.38 s into the sound
  "teer-kaman-miss": [{ at: 0.62, sound: "arrow", arg: false }],
  // flips up at frame 10, down at 46, swirls 66–92
  "dal-badal": [{ at: 0.33, sound: "flip" }, { at: 1.53, sound: "flip" }, { at: 2.2, sound: "swirl" }],
  // the hands sweep in at frame 6, grab at 16
  "hera-pheri": [{ at: 0.2, sound: "whoosh" }, { at: 0.53, sound: "steal" }],
  // the glass slides in at frame 6; the lens is over the cards at frames 25 and 28 (Talashi.tsx TALASHI_GLINTS)
  "talashi": [{ at: 0.2, sound: "whoosh", arg: true }, { at: 0.83, sound: "flip" }, { at: 0.93, sound: "flip" }],
  // video/Moments.tsx — the chart spins in at frame 6, the gold thread joins you two at 16–30
  "kundli": [{ at: 0.2, sound: "whoosh", arg: true }, { at: 0.55, sound: "mystic" }],
  // the archer slides in at 4, the sight locks at 32: a heartbeat while everyone talks
  "teer-kaman-aim": [{ at: 0.13, sound: "whoosh" }, { at: 0.5, sound: "heartbeat" }, { at: 1.1, sound: "heartbeat" }],
  // the dhol pattern starts at 0.2 s; the rings in the film beat on frames 6, 11, 16, 21, 25, 29
  "faisla": [{ at: 0.2, sound: "faisla" }],
  // the red OUT stamps at frame 20
  "faisla-out": [{ at: 0.66, sound: "gong" }],
  // the two cards rock, NOBODY IS OUT lands at 16–20
  "faisla-nobody": [{ at: 0.1, sound: "whoosh", arg: true }, { at: 0.55, sound: "claim" }, { at: 0.68, sound: "claim" }],
  // the ground shakes from frame 2; the cards hop to the next player at 22–44
  "bhukamp": [{ at: 0.07, sound: "quake" }, { at: 0.75, sound: "whoosh", arg: true }],
  // the gold vote leaves at 10 and lands at 36, +1
  "vote-gift": [{ at: 0.33, sound: "whoosh" }, { at: 1.2, sound: "vote", arg: 7 }, { at: 1.22, sound: "claim" }],
  // the diyas light 4–30, ROUND n lands at 20–26
  "round": [{ at: 0.67, sound: "claim" }, { at: 0.87, sound: "yourMove" }],
  // the cards turn over at 10; the Stone flies to the middle at 24; the message pops at 38
  // (no Stone = the Faisla OUT film and its cues; a tie = Faisla NOBODY IS OUT)
  "final-vote": [{ at: 0.33, sound: "flip" }, { at: 0.8, sound: "whoosh" }, { at: 1.27, sound: "claim" }],
  // the same screen for everyone: the light bursts at 4, the Stones rise at 10–15
  "winner-village": [{ at: 0.4, sound: "fanfare" }],
  "winner-thieves": [{ at: 0.4, sound: "sting" }],
};

/** play a film's cues; returns a stop function (call it if the film is skipped) */
export function playCues(film: string, play: (s: Sound, arg?: number | boolean) => void): () => void {
  const ids = (FILM_CUES[film] ?? []).map((c) => setTimeout(() => play(c.sound, c.arg), c.at * 1000));
  return () => ids.forEach(clearTimeout);
}
