"use client";
// The background score (designer 2026-10-09: "a background score running through the entire game"). Synthesised with
// Web Audio like the effects (no files, no licences): a tanpura drone (Pa–Sa–Sa–low Sa, plucked and buzzing) over a
// village night — crickets and a little wind. Three moods follow the game:
//   calm   — turns: the tanpura and the night
//   tense  — a Faisla or the last vote, surrender: a soft heartbeat pulse and a low string swell join in
//   silent — the ejection and the end: the score steps aside for the moment
// Voice is the heart of this game: the score sits far below the effects and drops further whenever anyone talks.
// Browsers only allow sound after a tap, so it starts on the first touch anywhere; "Music off" in the menu stops it.

export type Mood = "calm" | "tense" | "silent";

const PREF = "tunga:music";
const LEVEL: Record<Mood, number> = { calm: 0.16, tense: 0.2, silent: 0 };
const DUCKED = 0.3; // × the level while someone talks

let enabled = true;
try { enabled = localStorage.getItem(PREF) !== "off"; } catch {}

interface Score {
  ac: AudioContext;
  bus: GainNode;      // the whole score
  tension: GainNode;  // the tense layer (pulse + swell)
  noise: AudioBuffer;
  timer: ReturnType<typeof setInterval>;
  nextPluck: number; step: number;
  nextCricket: number;
  nextPulse: number;
}

let score: Score | null = null;
let mood: Mood = "silent";
let ducked = false;

const SA = 130.81; // C3 — the tonic
const TANPURA = [SA * 0.75, SA, SA, SA / 2]; // Pa (below), Sa, Sa, low Sa
const PLUCK_GAP = 1.15; // seconds between strings
const PULSE_GAP = 60 / 66; // a slow heartbeat, 66 bpm

function level() { return !enabled ? 0 : LEVEL[mood] * (ducked ? DUCKED : 1); }

function apply(fast = false) {
  if (!score) return;
  const t = score.ac.currentTime;
  score.bus.gain.cancelScheduledValues(t);
  score.bus.gain.setTargetAtTime(level(), t, fast ? 0.05 : 0.8);
  score.tension.gain.cancelScheduledValues(t);
  score.tension.gain.setTargetAtTime(mood === "tense" ? 1 : 0, t, 1.5);
}

/** one tanpura string: three slightly detuned saws through a closing lowpass, with the jawari buzz (a resonant peak) */
function pluck(s: Score, at: number, f: number) {
  const { ac } = s;
  const out = ac.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(0.11, at + 0.03);
  out.gain.exponentialRampToValueAtTime(0.0001, at + 4.2);
  const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.7;
  lp.frequency.setValueAtTime(2600, at); lp.frequency.exponentialRampToValueAtTime(700, at + 3);
  const jawari = ac.createBiquadFilter(); jawari.type = "peaking"; jawari.gain.value = 9; jawari.Q.value = 6;
  jawari.frequency.setValueAtTime(f * 9, at); jawari.frequency.exponentialRampToValueAtTime(f * 5, at + 2.5);
  lp.connect(jawari).connect(out).connect(s.bus);
  for (const d of [-3, 0, 4]) {
    const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = d;
    o.connect(lp); o.start(at); o.stop(at + 4.4);
  }
}

/** a cricket: a few quick high chirps */
function cricket(s: Score, at: number) {
  const { ac } = s;
  const f = 4200 + Math.random() * 500;
  const n = 3 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const t = at + i * 0.065;
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.018, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g).connect(s.bus); o.start(t); o.stop(t + 0.04);
  }
}

/** the tense heartbeat: a soft low thump-thump */
function pulse(s: Score, at: number) {
  for (const [dt, v] of [[0, 0.16], [0.17, 0.1]]) {
    const o = s.ac.createOscillator(), g = s.ac.createGain();
    o.frequency.setValueAtTime(62, at + dt); o.frequency.exponentialRampToValueAtTime(38, at + dt + 0.18);
    g.gain.setValueAtTime(0.0001, at + dt); g.gain.exponentialRampToValueAtTime(v, at + dt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dt + 0.22);
    o.connect(g).connect(s.tension); o.start(at + dt); o.stop(at + dt + 0.25);
  }
}

function build(): Score | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ac = new AC();
  const bus = ac.createGain(); bus.gain.value = 0; bus.connect(ac.destination);
  const tension = ac.createGain(); tension.gain.value = 0; tension.connect(bus);
  const noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // the wind: soft low noise that breathes
  const wind = ac.createBufferSource(); wind.buffer = noise; wind.loop = true;
  const wlp = ac.createBiquadFilter(); wlp.type = "lowpass"; wlp.frequency.value = 380;
  const wg = ac.createGain(); wg.gain.value = 0.022;
  const lfo = ac.createOscillator(); lfo.frequency.value = 0.07;
  const lfoAmt = ac.createGain(); lfoAmt.gain.value = 0.014;
  lfo.connect(lfoAmt).connect(wg.gain);
  wind.connect(wlp).connect(wg).connect(bus); wind.start(); lfo.start();

  // the tense swell: Sa and Pa low, bowed
  const swell = ac.createGain(); swell.gain.value = 0.035;
  const slp = ac.createBiquadFilter(); slp.type = "lowpass"; slp.frequency.value = 320;
  for (const f of [SA / 2, (SA * 0.75) / 2 * 2]) {
    const o = ac.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; o.detune.value = Math.random() * 6 - 3;
    o.connect(slp); o.start();
  }
  slp.connect(swell).connect(tension);

  const now = ac.currentTime + 0.1;
  const s: Score = { ac, bus, tension, noise, timer: 0 as unknown as ReturnType<typeof setInterval>, nextPluck: now, step: 0, nextCricket: now + 1, nextPulse: now };
  // a small look-ahead scheduler: anything due in the next 0.4 s is placed on the audio clock
  s.timer = setInterval(() => {
    if (!enabled || mood === "silent") return;
    const ahead = ac.currentTime + 0.4;
    while (s.nextPluck < ahead) { pluck(s, s.nextPluck, TANPURA[s.step % 4]); s.step++; s.nextPluck += PLUCK_GAP; }
    while (s.nextCricket < ahead) { cricket(s, s.nextCricket); s.nextCricket += 0.9 + Math.random() * 2.2; }
    if (mood === "tense") while (s.nextPulse < ahead) { pulse(s, s.nextPulse); s.nextPulse += PULSE_GAP; }
    else s.nextPulse = ahead;
  }, 120);
  return s;
}

function wake() {
  if (!enabled) return;
  if (!score) {
    score = build();
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
  if (score) {
    // pick the strings up again on the beat after a silence
    if (m !== "silent") { const t = score.ac.currentTime + 0.1; score.nextPluck = Math.max(score.nextPluck, t); score.nextCricket = Math.max(score.nextCricket, t + 0.5); }
    apply();
  }
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
}

/** leaving the table: stop everything */
export function stopMusic() {
  if (!score) return;
  clearInterval(score.timer);
  void score.ac.close().catch(() => {});
  score = null;
  mood = "silent";
}
