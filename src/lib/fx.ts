"use client";
// THE JUICE (designer 2026-10-13: "particles, tweens, camera shake, audio and word effects, 2D lighting, depth, texture
// masks when a player is eliminated, outlined sprites, a hit-flash shader, wind sway at the end"). Every big moment gets
// weight — the same beat on every phone, so the whole table feels it together:
//   particles   one canvas over the screen (it only runs while something is in the air — battery): dust, sparks,
//               petals, embers, mystic glints, coins, a swirl, smoke
//   words       a stamped word punches in over the table — BHUKAMP! · HIT! · MISS · OUT! · FAISLA …
//   shake       the whole screen: strong (Bhukamp, an elimination), sharp (an arrow that hits), a thud (the gavel)
//   hit flash   the struck seat flashes white and punches (a flash "shader" done with filters)
//   burn        an eliminated seat's card burns away along a noise texture, a glowing ember edge eating it — a real
//               per-pixel dissolve mask, then ash
// Lighting, depth, outlines, the turn bounce and the end's wind sway are CSS (globals.css). Reduced motion: no
// particles, no shake, no burn — the words still say what happened.
import { flashesOn, motionReduced, shakeScale } from "./motion";
import type { Beat } from "./beats";

// (2026-10-14) the phone's reduce-motion OR the player's own (☰ → Motion & comfort, lib/motion.ts)
const reduced = () => motionReduced();

type Shape = "dot" | "spark" | "petal" | "puff";
interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; g: number; drag: number; shape: Shape; rot: number; vr: number; sway: number; flicker: boolean }
interface Burn { img: HTMLImageElement; x: number; y: number; w: number; h: number; t0: number; dur: number; noise: Float32Array; nw: number; nh: number; buf: HTMLCanvasElement }

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let parts: P[] = [];
let burns: Burn[] = [];
let raf = 0;
let last = 0;

function ensure() {
  if (canvas || typeof document === "undefined") return;
  canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:60";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  const size = () => {
    if (!canvas) return;
    const d = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * d); canvas.height = Math.round(window.innerHeight * d);
    ctx?.setTransform(d, 0, 0, d, 0, 0);
  };
  size();
  window.addEventListener("resize", size);
}

function run() {
  if (raf || !ctx) return;
  last = performance.now();
  const step = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const c = ctx!;
    c.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (const b of burns) drawBurn(c, b, now);
    burns = burns.filter((b) => now - b.t0 < b.dur);
    for (const p of parts) {
      p.life += dt;
      p.vx *= 1 - p.drag * dt; p.vy = p.vy * (1 - p.drag * dt) + p.g * dt;
      p.x += (p.vx + Math.sin(p.life * 3 + p.rot) * p.sway) * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const k = 1 - p.life / p.max;
      const a = Math.max(0, Math.min(1, k * 1.6)) * (p.flicker ? 0.6 + 0.4 * Math.sin(p.life * 30 + p.rot * 10) : 1);
      c.globalAlpha = a; c.fillStyle = p.color; c.strokeStyle = p.color;
      if (p.shape === "spark") { c.lineWidth = p.size * 0.5; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); c.stroke(); }
      else if (p.shape === "petal") { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); c.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
      else if (p.shape === "puff") { c.beginPath(); c.arc(p.x, p.y, p.size * (1.5 - k * 0.5), 0, Math.PI * 2); c.fill(); }
      else { c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1;
    parts = parts.filter((p) => p.life < p.max);
    if (parts.length || burns.length) raf = requestAnimationFrame(step);
    else { raf = 0; c.clearRect(0, 0, window.innerWidth, window.innerHeight); }
  };
  raf = requestAnimationFrame(step);
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pickOf = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function emit(n: number, f: () => Partial<P> & { x: number; y: number }) {
  if (reduced() || typeof document === "undefined" || document.visibilityState === "hidden") return;
  ensure();
  for (let i = 0; i < n; i++) parts.push({ vx: 0, vy: 0, life: 0, max: 1, size: 3, color: "#fff", g: 0, drag: 0, shape: "dot", rot: rnd(0, 6.28), vr: 0, sway: 0, flicker: false, ...f() });
  if (parts.length > 900) parts.splice(0, parts.length - 900);
  run();
}

/** where a seat sits on screen (its card's centre) */
export function seatXY(seat: number | undefined): { x: number; y: number } | null {
  if (seat === undefined || typeof document === "undefined") return null;
  const el = document.querySelector(`[data-seat="${seat}"] img`) ?? document.querySelector(`[data-seat="${seat}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
const centre = () => ({ x: window.innerWidth / 2, y: window.innerHeight * 0.42 });

// ---------------------------------------------------------------- the effects
const FX = {
  dust(at: { x: number; y: number }, n = 26) {
    emit(n, () => ({ x: at.x + rnd(-18, 18), y: at.y + rnd(-10, 14), vx: rnd(-70, 70), vy: rnd(-90, -20), g: 60, drag: 1.6, max: rnd(0.8, 1.6), size: rnd(1.5, 4), color: pickOf(["#8a6a45", "#a8875e", "#6e5236", "#c2a378"]), shape: "puff" }));
  },
  sparks(at: { x: number; y: number }, n = 34) {
    emit(n, () => { const a = rnd(0, 6.28), v = rnd(160, 420); return { x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 520, drag: 1.2, max: rnd(0.35, 0.8), size: rnd(1.5, 3), color: pickOf(["#fff4c2", "#ffd36b", "#ff9a3c"]), shape: "spark" }; });
  },
  embers(at: { x: number; y: number }, n = 22) {
    emit(n, () => ({ x: at.x + rnd(-16, 16), y: at.y + rnd(-6, 10), vx: rnd(-25, 25), vy: rnd(-110, -40), g: -20, drag: 0.6, max: rnd(1, 2.2), size: rnd(1.2, 2.8), color: pickOf(["#ff8a2a", "#ffb347", "#ff5e1a"]), flicker: true, sway: 18 }));
  },
  mystic(at: { x: number; y: number }, n = 24) {
    emit(n, () => { const a = rnd(0, 6.28), rr = rnd(6, 26); return { x: at.x + Math.cos(a) * rr, y: at.y + Math.sin(a) * rr, vx: rnd(-20, 20), vy: rnd(-60, -15), drag: 0.8, max: rnd(0.9, 1.8), size: rnd(1.2, 2.6), color: pickOf(["#b48cff", "#7fe3d0", "#e7d6ff"]), flicker: true, sway: 25 }; });
  },
  coins(from: { x: number; y: number }, to: { x: number; y: number }, n = 14) {
    const t = 0.7;
    emit(n, () => { const dx = to.x - from.x, dy = to.y - from.y; return { x: from.x + rnd(-8, 8), y: from.y + rnd(-8, 8), vx: dx / t + rnd(-30, 30), vy: dy / t - 260 + rnd(-40, 40), g: 740, max: t + rnd(0, 0.15), size: rnd(2, 3.5), color: pickOf(["#ffd36b", "#f0a32e", "#fff1b8"]) }; });
  },
  swirl(at: { x: number; y: number }, n = 46) {
    emit(n, () => { const a = rnd(0, 6.28), v = rnd(90, 200); return { x: at.x, y: at.y, vx: Math.cos(a) * v - Math.sin(a) * v, vy: Math.sin(a) * v + Math.cos(a) * v, drag: 2.2, max: rnd(0.8, 1.4), size: rnd(1.5, 3), color: pickOf(["#e05a5a", "#f3c66b", "#7fe3d0", "#b48cff"]) }; });
  },
  petals(n = 70) {
    const W = window.innerWidth;
    emit(n, () => ({ x: rnd(0, W), y: rnd(-120, -10), vx: rnd(-20, 20), vy: rnd(60, 130), drag: 0.2, max: rnd(4, 7), size: rnd(3.5, 6.5), color: pickOf(["#ff9f1c", "#ffbf00", "#ff7b00", "#ffd166"]), shape: "petal", vr: rnd(-3, 3), sway: 40 }));
  },
  smoke(n = 40) {
    const W = window.innerWidth, H = window.innerHeight;
    emit(n, () => ({ x: rnd(0, W), y: H + rnd(0, 40), vx: rnd(-15, 15), vy: rnd(-90, -40), drag: 0.3, max: rnd(3, 5.5), size: rnd(10, 26), color: pickOf(["rgba(40,30,30,.5)", "rgba(70,50,45,.4)", "rgba(25,18,18,.55)"]), shape: "puff", sway: 12 }));
  },

  /** (2026-10-14, Balatro study: the shake grows with the score) a shake of any size, 0 = a tremor, 1 = the biggest:
   *  2→10 px, 150→420 ms, a little turn at the top end, dying away */
  rumble(amount: number) {
    if (reduced() || typeof document === "undefined") return;
    const root = document.querySelector<HTMLElement>("[data-juice-root]") ?? document.body;
    // scaled by the player's shake setting (off · gentle · full); sliding only — no turning, which sickens more
    const k = Math.max(0, Math.min(1, amount)) * shakeScale();
    if (k <= 0) return;
    const px = 2 + 8 * k;
    const frames = [0, 1, 2, 3, 4, 5].map((i) => {
      const f = 1 - i / 6, sx = (i % 2 ? -1 : 1) * px * f, sy = (i % 3 ? 1 : -1) * px * 0.5 * f;
      return { transform: `translate(${sx}px, ${sy}px)` };
    });
    root.animate([...frames, { transform: "none" }], { duration: 150 + 270 * k, easing: "ease-out" });
  },

  /** the whole screen shakes: strong · sharp · thud */
  shake(kind: "strong" | "sharp" | "thud") {
    if (reduced() || typeof document === "undefined") return;
    // (2026-10-14) one shake for everything, so the player's setting governs them all
    FX.rumble(kind === "strong" ? 0.8 : kind === "sharp" ? 0.6 : 0.45);
  },

  /** a word stamped over the table */
  word(text: string, tone: "lethal" | "gold" | "relic" | "vote" | "neutral" = "gold") {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.className = `word-stamp word-${tone}`;
    el.setAttribute("aria-hidden", "true");
    el.textContent = text;
    // long words shrink to fit a phone's width (DAL BADAL! / HERA PHERI! ran off a 360 px screen)
    el.style.fontSize = `min(64px, 11vw, ${Math.floor(92 / Math.max(4, text.length))}vw)`;
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 2600);
  },

  /** the struck seat flashes white and punches */
  flash(seat: number | undefined) {
    if (seat === undefined || typeof document === "undefined" || !flashesOn()) return;
    const el = document.querySelector<HTMLElement>(`[data-seat="${seat}"]`);
    if (!el) return;
    el.classList.remove("hit-flash"); void el.offsetWidth; el.classList.add("hit-flash");
  },

  /** the eliminated seat's card burns away: a per-pixel dissolve along a noise texture, an ember edge eating it */
  burn(seat: number | undefined, src = "/art/cards/back.webp") {
    if (seat === undefined || reduced() || typeof document === "undefined") return;
    const el = document.querySelector(`[data-seat="${seat}"] img`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    ensure();
    const img = new Image();
    img.src = src;
    img.onload = () => {
      const nw = Math.max(8, Math.round(r.width)), nh = Math.max(8, Math.round(r.height));
      const buf = document.createElement("canvas"); buf.width = nw; buf.height = nh;
      burns.push({ img, x: r.left, y: r.top, w: r.width, h: r.height, t0: performance.now(), dur: 1500, noise: noiseField(nw, nh), nw, nh, buf });
      FX.embers({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, 30);
      run();
    };
  },
};

/** smooth value noise (a few octaves), 0..1, biased so the burn starts at the bottom edge and climbs */
function noiseField(w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  const grid = (cell: number) => {
    const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
    const g = Float32Array.from({ length: gw * gh }, () => Math.random());
    return (x: number, y: number) => {
      const fx0 = x / cell, fy0 = y / cell, ix = Math.floor(fx0), iy = Math.floor(fy0), tx = fx0 - ix, ty = fy0 - iy;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const at = (a: number, b: number) => g[b * gw + a];
      return (at(ix, iy) * (1 - sx) + at(ix + 1, iy) * sx) * (1 - sy) + (at(ix, iy + 1) * (1 - sx) + at(ix + 1, iy + 1) * sx) * sy;
    };
  };
  const o1 = grid(14), o2 = grid(6), o3 = grid(3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = 0.55 * o1(x, y) + 0.3 * o2(x, y) + 0.15 * o3(x, y);
    out[y * w + x] = 0.65 * n + 0.35 * (y / h); // the bottom (high y) survives longest; the flame climbs from the top edge's noise
  }
  return out;
}

function drawBurn(c: CanvasRenderingContext2D, b: Burn, now: number) {
  const t = Math.min(1, (now - b.t0) / b.dur);
  const bc = b.buf.getContext("2d");
  if (!bc) return;
  bc.clearRect(0, 0, b.nw, b.nh);
  bc.drawImage(b.img, 0, 0, b.nw, b.nh);
  const data = bc.getImageData(0, 0, b.nw, b.nh);
  const d = data.data;
  const th = t * 1.08; // the threshold sweeps past every value
  for (let i = 0; i < b.noise.length; i++) {
    const n = b.noise[i];
    const p = i * 4;
    if (n < th - 0.06) { d[p + 3] = 0; continue; }         // burnt away
    if (n < th) {                                          // the glowing edge
      const e = (n - (th - 0.06)) / 0.06;
      d[p] = 255; d[p + 1] = Math.round(110 + 120 * e); d[p + 2] = Math.round(30 * e); d[p + 3] = 255;
    } else if (n < th + 0.05) {                            // scorched just ahead of the flame
      const s = (n - th) / 0.05;
      d[p] = Math.round(d[p] * (0.35 + 0.65 * s)); d[p + 1] = Math.round(d[p + 1] * (0.3 + 0.7 * s)); d[p + 2] = Math.round(d[p + 2] * (0.25 + 0.75 * s));
    }
  }
  bc.putImageData(data, 0, 0);
  c.globalAlpha = 1;
  c.drawImage(b.buf, b.x, b.y, b.w, b.h);
}

/** THE MOMENTS — what each beat does to the table */
/** `filmed`: a cinematic plays this moment (Cinematic.tsx) — it carries the moment's word, so no stamp on top */
export function juiceFor(b: Beat, filmed = false) {
  const fx = filmed ? { ...FX, word: () => {} } : FX;
  const at = seatXY(b.target), from = seatXY(b.actor), mid = typeof window !== "undefined" ? centre() : { x: 0, y: 0 };
  switch (b.type) {
    case "batwara":
      fx.word("BHUKAMP!", "gold"); fx.shake("strong");
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-seat]"))) {
        const r = el.getBoundingClientRect();
        fx.dust({ x: r.left + r.width / 2, y: r.top + r.height * 0.8 }, 14);
      }
      break;
    case "teer_kaman":
      if (b.result === "hit") { fx.word("HIT!", "lethal"); fx.shake("sharp"); fx.flash(b.target); if (at) fx.sparks(at); }
      else { fx.word("MISS", "neutral"); if (at) fx.dust(at, 12); }
      break;
    case "hera_pheri":
      fx.word("HERA PHERI!", "lethal"); fx.flash(b.target); if (at && from) fx.coins(at, from);
      break;
    case "faisla":
      fx.word("FAISLA", "vote"); fx.shake("thud");
      break;
    case "kundli":
      fx.word("KUNDLI", "relic"); if (from) fx.mystic(from); if (at) fx.mystic(at);
      break;
    case "talashi":
      fx.word("TALASHI", "relic"); if (at) fx.mystic(at, 12);
      break;
    case "dal_badal":
      fx.word("DAL BADAL!", "lethal"); fx.shake("strong"); fx.swirl(mid);
      break;
    case "eliminated":
      fx.word("OUT!", "lethal"); fx.shake("strong"); fx.burn(b.target);
      break;
    case "vote_result":
      if (b.result === "none") fx.word("NOBODY OUT", "neutral");
      break;
    case "batwara_done": // your own Bhukamp line (private): a Stone moving leaves embers
      if (b.private && /Stone/.test(b.title)) { const me = document.querySelector<HTMLElement>("[data-me-seat]"); const r = me?.getBoundingClientRect(); if (r) fx.embers({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, 18); }
      break;
  }
}

export const fx = FX;

// screen checks only (next dev): fire any effect from a recorder — never in a production build
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") (window as unknown as { __fx: unknown }).__fx = { fx, juiceFor };
