"use client";
// The game's sound — every effect is synthesised with Web Audio (no files, no licences, ~0 KB). Research 2026-10-07
// ("Voice games and game feel"): stingers on phase changes, rising pitch for reveals, effects ducked under live voice.
// Browsers only allow sound after a tap, so the context starts suspended and wakes on the first touch anywhere.

const PREF = "tunga:sound";
type Ctx = { ac: AudioContext; master: GainNode; noise: AudioBuffer };
let ctx: Ctx | null = null;
let enabled = true;
let ducked = false;
try { enabled = localStorage.getItem(PREF) !== "off"; } catch {}

function get(): Ctx | null {
  if (typeof window === "undefined" || !enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    const ac = new AC();
    const master = ac.createGain();
    master.gain.value = ducked ? 0.3 : 0.8;
    master.connect(ac.destination);
    // one second of white noise, reused by every drum, whoosh and crowd
    const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    ctx = { ac, master, noise };
  }
  if (ctx.ac.state === "suspended") void ctx.ac.resume();
  return ctx;
}

/** call once: the first tap anywhere wakes the audio */
export function unlockOnFirstTap() {
  if (typeof window === "undefined") return;
  const wake = () => { get(); window.removeEventListener("pointerdown", wake); };
  window.addEventListener("pointerdown", wake, { once: true });
}

export const soundOn = () => enabled;
export function setSound(on: boolean) {
  enabled = on;
  try { localStorage.setItem(PREF, on ? "on" : "off"); } catch {}
  if (ctx) ctx.master.gain.value = on ? (ducked ? 0.3 : 0.8) : 0;
}

/** someone is talking: drop the effects ~8 dB so voices stay on top */
export function duck(on: boolean) {
  if (on === ducked) return;
  ducked = on;
  if (!ctx || !enabled) return;
  const t = ctx.ac.currentTime;
  ctx.master.gain.cancelScheduledValues(t);
  ctx.master.gain.setTargetAtTime(on ? 0.3 : 0.8, t, on ? 0.04 : 0.25);
}

// ---------------------------------------------------------------- building blocks
function tone(c: Ctx, { f, f2, type = "sine", at = 0, dur = 0.2, vol = 0.4, attack = 0.005 }:
  { f: number; f2?: number; type?: OscillatorType; at?: number; dur?: number; vol?: number; attack?: number }) {
  const t = c.ac.currentTime + at;
  const o = c.ac.createOscillator(), g = c.ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.master);
  o.start(t); o.stop(t + dur + 0.05);
}

function hiss(c: Ctx, { at = 0, dur = 0.2, vol = 0.3, from = 800, to = 800, q = 1, type = "bandpass" as BiquadFilterType }) {
  const t = c.ac.currentTime + at;
  const s = c.ac.createBufferSource(), f = c.ac.createBiquadFilter(), g = c.ac.createGain();
  s.buffer = c.noise;
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(from, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(c.master);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
}

/** a dhol stroke: the bass "dha" (pitch drop) or the bright "na" (slap) */
function dhol(c: Ctx, at: number, bass: boolean, vol = 0.7) {
  if (bass) { tone(c, { f: 120, f2: 52, at, dur: 0.45, vol }); hiss(c, { at, dur: 0.06, vol: vol * 0.4, from: 400, to: 200, type: "lowpass" }); }
  else { tone(c, { f: 330, f2: 210, at, dur: 0.12, vol: vol * 0.6, type: "triangle" }); hiss(c, { at, dur: 0.08, vol: vol * 0.5, from: 2500, to: 1500 }); }
}

// ---------------------------------------------------------------- the sounds
const SOUNDS = {
  tap: (c: Ctx) => tone(c, { f: 900, dur: 0.05, vol: 0.15 }),
  /** a card leaving the hand */
  whoosh: (c: Ctx) => hiss(c, { dur: 0.28, vol: 0.35, from: 400, to: 3200, q: 0.8 }),
  /** a card turned over */
  flip: (c: Ctx) => { hiss(c, { dur: 0.06, vol: 0.4, from: 3000, to: 2000 }); hiss(c, { at: 0.07, dur: 0.06, vol: 0.3, from: 2600, to: 1800 }); },
  /** it's your move */
  yourMove: (c: Ctx) => { tone(c, { f: 660, dur: 0.15, vol: 0.25, type: "triangle" }); tone(c, { f: 990, at: 0.12, dur: 0.25, vol: 0.25, type: "triangle" }); },
  /** Faisla! — dha dhin dhin dha */
  faisla: (c: Ctx) => { [[0, 1], [0.18, 0], [0.32, 0], [0.5, 1], [0.64, 0], [0.78, 1]].forEach(([at, b]) => dhol(c, at, b === 1)); },
  /** the ballots open — a drumroll that builds */
  drumroll: (c: Ctx) => { for (let i = 0; i < 24; i++) hiss(c, { at: i * 0.05, dur: 0.05, vol: 0.12 + i * 0.012, from: 1800, to: 900 }); dhol(c, 1.2, true); },
  /** one vote counted — pass the index for a rising pitch */
  vote: (c: Ctx, i = 0) => tone(c, { f: 440 * 2 ** (Math.min(i, 14) / 12), dur: 0.16, vol: 0.3, type: "triangle" }),
  /** someone is out — a temple gong */
  gong: (c: Ctx) => { [1, 2.76, 5.4, 8.9].forEach((m, k) => tone(c, { f: 92 * m, dur: 2.6 - k * 0.5, vol: 0.35 / (k + 1), attack: 0.01 })); },
  /** the Teer Kaman arrow in flight, then the thud (hit) or the clatter (miss) */
  arrow: (c: Ctx, hit = true) => {
    hiss(c, { dur: 0.35, vol: 0.3, from: 5000, to: 1200, q: 4 });
    if (hit) { tone(c, { f: 160, f2: 60, at: 0.36, dur: 0.25, vol: 0.7 }); hiss(c, { at: 0.36, dur: 0.1, vol: 0.4, from: 600, to: 200, type: "lowpass" }); }
    else { tone(c, { f: 1200, f2: 900, at: 0.38, dur: 0.08, vol: 0.2, type: "square" }); tone(c, { f: 900, f2: 700, at: 0.48, dur: 0.08, vol: 0.15, type: "square" }); }
  },
  /** Kundli — a mystic shimmer */
  mystic: (c: Ctx) => { [0, 0.07, 0.14, 0.21, 0.28].forEach((at, k) => tone(c, { f: 880 * 2 ** ([0, 3, 7, 10, 14][k] / 12), at, dur: 0.6, vol: 0.12, type: "sine" })); },
  /** Hera Pheri — a sly swipe */
  steal: (c: Ctx) => { hiss(c, { dur: 0.18, vol: 0.4, from: 3500, to: 600, q: 1.5 }); tone(c, { f: 520, f2: 260, at: 0.05, dur: 0.18, vol: 0.2, type: "sawtooth" }); },
  /** Bhukamp — the ground rumbles */
  quake: (c: Ctx) => { hiss(c, { dur: 1.4, vol: 0.6, from: 120, to: 60, type: "lowpass" }); tone(c, { f: 45, f2: 38, dur: 1.2, vol: 0.5 }); },
  /** Maya Jaal — time runs backwards */
  rewind: (c: Ctx) => { tone(c, { f: 1600, f2: 300, dur: 0.6, vol: 0.2, type: "triangle" }); tone(c, { f: 300, f2: 1600, at: 0.55, dur: 0.5, vol: 0.2, type: "triangle" }); },
  /** Dal Badal — everything spins */
  swirl: (c: Ctx) => { for (let i = 0; i < 6; i++) tone(c, { f: 300 + i * 120, f2: 700 + i * 120, at: i * 0.08, dur: 0.25, vol: 0.12, type: "triangle" }); },
  /** the clock is running out */
  heartbeat: (c: Ctx) => { tone(c, { f: 70, f2: 50, dur: 0.12, vol: 0.6 }); tone(c, { f: 65, f2: 45, at: 0.16, dur: 0.14, vol: 0.45 }); },
  /** a reaction lands */
  splat: (c: Ctx) => { hiss(c, { dur: 0.15, vol: 0.4, from: 900, to: 200, type: "lowpass" }); tone(c, { f: 220, f2: 110, dur: 0.12, vol: 0.25 }); },
  /** the ejection — falling away into the night */
  eject: (c: Ctx) => { hiss(c, { dur: 1.8, vol: 0.25, from: 2000, to: 150, q: 0.7 }); tone(c, { f: 600, f2: 120, dur: 1.6, vol: 0.18, type: "sine" }); },
  /** you won */
  fanfare: (c: Ctx) => { [523, 659, 784, 1047].forEach((f, k) => tone(c, { f, at: k * 0.13, dur: k === 3 ? 0.9 : 0.2, vol: 0.28, type: "triangle" })); dhol(c, 0.52, true); },
  /** you lost — wah wah */
  sting: (c: Ctx) => { [[392, 370], [370, 349], [349, 262]].forEach(([f, f2], k) => tone(c, { f, f2, at: k * 0.32, dur: k === 2 ? 0.9 : 0.3, vol: 0.25, type: "sawtooth" })); },
  /** a claim out loud */
  claim: (c: Ctx) => tone(c, { f: 740, f2: 880, dur: 0.18, vol: 0.2, type: "triangle" }),
} as const;

export type Sound = keyof typeof SOUNDS;
export function play(name: Sound, arg?: number | boolean) {
  const c = get();
  if (!c) return;
  try { (SOUNDS[name] as (c: Ctx, a?: number | boolean) => void)(c, arg); } catch { /* never let a sound break the table */ }
}

/** Android buzzes; iPhones ignore it (no browser there supports vibration) */
export function buzz(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch {}
}
