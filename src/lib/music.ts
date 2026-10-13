"use client";
// THE SCORE OF TUNGA (designer 2026-10-13: "super fun background music" — "it needs to be music from the village Tunga").
// Recorded loops made by scripts/music/make_music.py — the Malnad sound of the Tunga and the Bhadra: nadaswaram,
// thavil, dollu, the Yakshagana chande, taala, the pungi (the Serpent's voice), a shruti drone, temple bells, the kombu.
// Three moods follow the game:
//   calm   — turns: village.mp3 (Raag Mohanam, the procession)
//   tense  — a Faisla, the last vote, the surrender: faisla.mp3 (Raag Punnagavarali on the pungi, a heartbeat thavil)
//   silent — the ejection and the end: the score steps aside (the end plays its own sting: playSting)
// Voice is the heart of this game: the score sits well below the effects and drops further whenever anyone talks.
// Browsers only allow sound after a tap, so it starts on the first touch anywhere; "Music off" in the menu stops it.

export type Mood = "calm" | "tense" | "silent";

const PREF = "tunga:music";
const LEVEL: Record<Mood, number> = { calm: 0.22, tense: 0.26, silent: 0 };
const DUCKED = 0.3; // × the level while someone talks
const FILES = { calm: "/audio/music/village.mp3", tense: "/audio/music/faisla.mp3", win: "/audio/music/win.mp3", lose: "/audio/music/lose.mp3" };

let enabled = true;
try { enabled = localStorage.getItem(PREF) !== "off"; } catch {}

interface Score {
  ac: AudioContext;
  bus: GainNode;                                   // the whole score (level + ducking)
  loops: Partial<Record<"calm" | "tense", { gain: GainNode }>>;
  buffers: Map<string, Promise<AudioBuffer | null>>;
}

let score: Score | null = null;
let mood: Mood = "silent";
let ducked = false;

function level() { return !enabled ? 0 : (mood === "silent" ? 0 : LEVEL[mood]) * (ducked ? DUCKED : 1); }

function load(s: Score, url: string): Promise<AudioBuffer | null> {
  let p = s.buffers.get(url);
  if (!p) {
    p = fetch(url).then((r) => r.arrayBuffer()).then((b) => s.ac.decodeAudioData(b)).catch(() => null);
    s.buffers.set(url, p);
  }
  return p;
}

/** start a loop silently; its own gain fades it in and out as the mood changes */
async function startLoop(s: Score, which: "calm" | "tense") {
  if (s.loops[which]) return;
  const gain = s.ac.createGain(); gain.gain.value = 0; gain.connect(s.bus);
  s.loops[which] = { gain };
  const buf = await load(s, FILES[which]);
  if (!buf || score !== s) return;
  const src = s.ac.createBufferSource(); src.buffer = buf; src.loop = true;
  src.connect(gain); src.start();
  apply();
}

function apply(fast = false) {
  if (!score) return;
  const t = score.ac.currentTime;
  score.bus.gain.cancelScheduledValues(t);
  score.bus.gain.setTargetAtTime(level(), t, fast ? 0.05 : 0.8);
  // crossfade: the mood's loop up, the other down (each keeps its place, so coming back resumes the phrase)
  for (const k of ["calm", "tense"] as const) {
    const g = score.loops[k]?.gain;
    if (!g) continue;
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(mood === k ? 1 : 0, t, 1.2);
  }
}

function build(): Score | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ac = new AC();
  const bus = ac.createGain(); bus.gain.value = 0; bus.connect(ac.destination);
  return { ac, bus, loops: {}, buffers: new Map() };
}

function wake() {
  if (!enabled) return;
  if (!score) {
    score = build();
    if (score) { void startLoop(score, "calm"); void startLoop(score, "tense"); }
    apply();
  }
  if (score && score.ac.state === "suspended") void score.ac.resume();
}

/** call once: the first tap anywhere starts the score */
export function startMusicOnFirstTap() {
  if (typeof window === "undefined") return;
  const go = () => { wake(); window.removeEventListener("pointerdown", go); };
  window.addEventListener("pointerdown", go);
}

/** what the game is doing now */
export function setMood(m: Mood) {
  if (m === mood) return;
  mood = m;
  apply();
}

/** the end of the game: the village's flourish or the thieves' fall, once, over the silence */
export async function playSting(won: boolean) {
  if (!enabled || !score) return;
  const buf = await load(score, won ? FILES.win : FILES.lose);
  if (!buf || !score) return;
  const g = score.ac.createGain(); g.gain.value = (ducked ? DUCKED : 1) * 0.5;
  const src = score.ac.createBufferSource(); src.buffer = buf;
  src.connect(g).connect(score.ac.destination); src.start();
}

/** someone is talking: the score drops well under them */
export function musicDuck(on: boolean) {
  if (on === ducked) return;
  ducked = on;
  apply(on);
}

export const musicOn = () => enabled;
export function setMusic(on: boolean) {
  enabled = on;
  try { localStorage.setItem(PREF, on ? "on" : "off"); } catch {}
  if (on) wake();
  apply(true);
  // BATTERY (2026-10-12): music off = the audio engine sleeps, not just goes quiet
  if (!on && score) setTimeout(() => { if (!enabled && score) void score.ac.suspend(); }, 600);
}

// BATTERY (2026-10-12): the app in the background (another app, screen off) — the score's audio engine sleeps, and
// wakes when the table is back in front
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => {
  if (!score) return;
  if (document.visibilityState === "hidden") void score.ac.suspend();
  else if (enabled) void score.ac.resume();
});

/** leaving the table: stop everything */
export function stopMusic() {
  if (!score) return;
  void score.ac.close().catch(() => {});
  score = null;
  mood = "silent";
}
