"use client";
// CINEMATICS (designer 2026-10-13: "do the video animations"): short, skippable films for the big moments, made with
// Remotion's animation maths and played live in the browser (no video files — they're React, drawn from the box's own card art):
//   every one   letterbox bars slide in · the card's art pushes in from the dark with a glow · light rays turn behind
//               it · its name writes itself in · it fades back to the table (1.8 s; tap to skip; 2× halves it)
//   TEER KAMAN  an arrow streak tears across — HIT: a white flash and a jolt · MISS: the art drains to grey
//   KUNDLI      a mandala turns round the art in violet light       BHUKAMP   the art quakes, cracks draw across
//   HERA PHERI  the art is snatched sideways                         TALASHI   a searching spotlight sweeps it
//   FAISLA      the gavel: a zoom punch and a flash on the thud       DAL BADAL the card spins round twice
//   NIGHTFALL   each new round: the shrine at sunset sinks into night and the stars come out
//   FINALE      behind the end screen: the Stones drop onto the shrine steps and glow (village) — or flicker and
//               vanish in smoke (thieves)
// Reduced motion: no films at all — the table and its words say what happened.
// Plain <img>, not Remotion's <Img>: these play live, and <Img> holds the film on frame 0 until the image "decodes" —
// which some browsers refuse (screen check 2026-10-13: a black screen until tapped).
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AbsoluteFill, interpolate, spring } from "remotion";
import type { Beat } from "@/lib/beats";

const FPS = 30;
const LEN = 54; // 1.8 s
const W = 400, H = 760;

export type CineKind = "teer_kaman" | "kundli" | "batwara" | "hera_pheri" | "talashi" | "faisla" | "dal_badal";
const ART: Record<CineKind, { src: string; word: string; color: string; glow: string }> = {
  teer_kaman: { src: "/art/v2/teer_kaman-art.webp", word: "TEER KAMAN", color: "#ffd36b", glow: "255,170,60" },
  kundli: { src: "/art/v2/kundli-art.webp", word: "KUNDLI", color: "#d9c2ff", glow: "160,110,255" },
  batwara: { src: "/art/v2/bhukamp-art.webp", word: "BHUKAMP", color: "#ffbf69", glow: "255,140,40" },
  hera_pheri: { src: "/art/v2/hera_pheri-art.webp", word: "HERA PHERI", color: "#ff8a7a", glow: "255,80,60" },
  talashi: { src: "/art/v2/talashi-art.webp", word: "TALASHI", color: "#9ff0d2", glow: "90,220,180" },
  faisla: { src: "/art/v2/faisla-art.webp", word: "FAISLA", color: "#f3c66b", glow: "240,163,46" },
  dal_badal: { src: "/art/v2/dal_badal-art.webp", word: "DAL BADAL", color: "#ff6b5b", glow: "255,70,50" },
};
/** the beats that get a film */
export const CINEMATIC = new Set<string>(Object.keys(ART));
/** THE FILM CLOCK. Remotion's <Player> sat frozen on frame 0 inside the app (screen check 2026-10-13: autoplay never
 *  started, a black screen until tapped), so the films keep Remotion's animation maths (interpolate, spring) but run on
 *  this: one animation-frame timer counting 30 fps frames, on a 400x760 stage scaled to fit the phone. At the last
 *  frame it calls `onEnd` (or, with `hold`, stays on it). */
function Film({ len, speed = 1, hold = false, onEnd, children }: { len: number; speed?: number; hold?: boolean; onEnd?: () => void; children: (frame: number) => ReactNode }) {
  const [frame, setFrame] = useState(0);
  const [k, setK] = useState(1);
  const end = useRef(onEnd);
  useEffect(() => { end.current = onEnd; }, [onEnd]);
  useEffect(() => {
    const fit = () => setK(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const f = Math.floor(((now - t0) / 1000) * FPS * speed);
      if (f >= len - 1) { setFrame(len - 1); if (!hold) end.current?.(); return; }
      setFrame(f);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", fit); };
  }, [len, speed, hold]);
  return (
    <div style={{ position: "absolute", left: "50%", top: "50%", width: W, height: H, transform: `translate(-50%,-50%) scale(${k})`, overflow: "hidden" }}>
      {children(frame)}
    </div>
  );
}
const reduced = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

const font: CSSProperties = { fontFamily: "var(--font-engraved), serif", fontWeight: 900, letterSpacing: "0.12em" };

function Letterbox({ frame, len }: { frame: number; len: number }) {
  const bar = interpolate(frame, [0, 8, len - 8, len], [0, 11, 11, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (<>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${bar}%`, background: "#000" }} />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${bar}%`, background: "#000" }} />
  </>);
}

function Title({ text, frame, color, glow }: { text: string; frame: number; color: string; glow: string }) {
  const shown = Math.round(interpolate(frame, [10, 26], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
  const fade = interpolate(frame, [44, LEN], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: "16%", textAlign: "center", opacity: fade }}>
      <span style={{ ...font, fontSize: Math.min(56, 560 / Math.max(5, text.length)), color, textShadow: `0 0 22px rgba(${glow},.85), 0 4px 0 #1a0e06` }}>
        {text.slice(0, shown)}<span style={{ opacity: 0 }}>{text.slice(shown)}</span>
      </span>
    </div>
  );
}

function Moment({ kind, hit, frame }: { kind: CineKind; hit: boolean; frame: number }) {
  const fps = FPS;
  const a = ART[kind];
  const inOut = interpolate(frame, [0, 10, LEN - 10, LEN], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  let scale = interpolate(frame, [0, LEN], [1.18, 1.0]);
  let x = 0, y = 0, rotY = 0, blur = 0, gray = 0, flash = 0;
  if (kind === "teer_kaman") {
    if (hit) { const j = interpolate(frame, [22, 32], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); x = Math.sin(frame * 3.1) * 9 * j; flash = interpolate(frame, [21, 23, 30], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); }
    else gray = interpolate(frame, [22, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  }
  if (kind === "batwara") { const k = interpolate(frame, [6, 40], [1, 0.15], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); x = Math.sin(frame * 2.3) * 12 * k; y = Math.cos(frame * 3.1) * 8 * k; }
  if (kind === "hera_pheri") { x = interpolate(frame, [18, 27], [0, -W * 1.3], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => t * t }); blur = interpolate(frame, [18, 24], [0, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); }
  if (kind === "faisla") { const p = spring({ frame: frame - 18, fps, config: { damping: 9, stiffness: 220 } }); scale = 1.25 - 0.22 * p; flash = interpolate(frame, [18, 20, 26], [0, 0.7, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }); }
  if (kind === "dal_badal") rotY = interpolate(frame, [4, 44], [0, 720], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (t) => 1 - (1 - t) ** 3 });
  const rays = frame * 1.4;
  const spot = interpolate(frame, [6, 44], [18, 82]);
  return (
    <AbsoluteFill style={{ background: "radial-gradient(70% 55% at 50% 45%, #2a1608 0%, #0b0502 75%)", opacity: inOut }}>
      {/* the rays turning behind */}
      <div style={{ position: "absolute", inset: "-30%", background: `repeating-conic-gradient(from ${rays}deg at 50% 45%, rgba(${a.glow},.16) 0deg 8deg, transparent 8deg 22deg)`, maskImage: "radial-gradient(circle at 50% 45%, #000 0%, transparent 60%)", WebkitMaskImage: "radial-gradient(circle at 50% 45%, #000 0%, transparent 60%)" }} />
      {kind === "kundli" && (
        <svg viewBox="-100 -100 200 200" style={{ position: "absolute", left: "50%", top: "45%", width: W * 1.05, transform: `translate(-50%,-50%) rotate(${frame * 2.4}deg)` }}>
          {[78, 64].map((rr, i) => <circle key={rr} r={rr} fill="none" stroke={`rgba(${a.glow},.55)`} strokeWidth={i ? 1.2 : 2} strokeDasharray={i ? "2 6" : "14 8 2 8"} />)}
          {Array.from({ length: 12 }, (_, i) => <circle key={i} cx={Math.cos((i * Math.PI) / 6) * 71} cy={Math.sin((i * Math.PI) / 6) * 71} r={2.2} fill={a.color} />)}
        </svg>
      )}
      <div style={{ position: "absolute", left: "50%", top: "45%", width: W * 0.86, transform: `translate(-50%,-50%) translate(${x}px,${y}px) scale(${scale}) perspective(700px) rotateY(${rotY}deg)` }}>
        <img alt="" src={a.src} style={{ width: "100%", borderRadius: 18, filter: `drop-shadow(0 0 26px rgba(${a.glow},.65)) grayscale(${gray}) blur(${blur}px)` }} />
      </div>
      {kind === "teer_kaman" && (
        <div style={{ position: "absolute", top: "45%", left: 0, width: "60%", height: 4, borderRadius: 2, background: "linear-gradient(90deg, transparent, #fff3c4 70%, #fff)",
          boxShadow: "0 0 14px #ffd36b", transform: `translateX(${interpolate(frame, [12, 22], [-W * 0.8, W * 1.4], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}px)` }} />
      )}
      {kind === "batwara" && (
        <svg viewBox="0 0 400 760" style={{ position: "absolute", inset: 0 }}>
          {["M200 0 L180 120 L215 220 L170 360 L205 470", "M0 400 L90 380 L150 430 L240 395", "M400 300 L320 340 L290 300 L215 330"].map((d, i) => (
            <path key={i} d={d} fill="none" stroke="rgba(255,200,120,.85)" strokeWidth={2.5} strokeDasharray={600}
              strokeDashoffset={interpolate(frame, [8 + i * 3, 24 + i * 3], [600, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
          ))}
        </svg>
      )}
      {kind === "talashi" && (
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle 120px at ${spot}% 44%, transparent 0%, transparent 60%, rgba(0,0,0,.72) 100%)` }} />
      )}
      {flash > 0 && <div style={{ position: "absolute", inset: 0, background: "#fff", opacity: flash }} />}
      <Title text={kind === "teer_kaman" ? (hit ? "HIT!" : "MISS") : a.word} frame={frame} color={kind === "teer_kaman" && !hit ? "#e8dcc4" : a.color} glow={a.glow} />
      <Letterbox frame={frame} len={LEN} />
    </AbsoluteFill>
  );
}

function Night({ round, frame }: { round: number; frame: number }) {
  const dark = interpolate(frame, [4, 40], [0, 0.78], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const out = interpolate(frame, [0, 8, 50, 60], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity: out, background: "#000" }}>
      <img alt="" src="/art/v2/shrine.webp" style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${interpolate(frame, [0, 60], [1.08, 1])})` }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(#0a1030, #120a2a 60%, #050308)", opacity: dark }} />
      {Array.from({ length: 34 }, (_, i) => {
        const sx = (i * 73) % 100, sy = (i * 37) % 48, t = 16 + (i % 9) * 2;
        return <div key={i} style={{ position: "absolute", left: `${sx}%`, top: `${sy}%`, width: 2 + (i % 3), height: 2 + (i % 3), borderRadius: 9, background: "#fff7d6",
          opacity: interpolate(frame, [t, t + 10], [0, 0.4 + 0.6 * Math.abs(Math.sin(frame / 5 + i))], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />;
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: "40%", textAlign: "center" }}>
        <div style={{ ...font, fontSize: 18, color: "#f3c66b", opacity: interpolate(frame, [14, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>NIGHT FALLS ON TUNGA</div>
        <div style={{ ...font, fontSize: 52, color: "#fff1c9", textShadow: "0 0 22px rgba(255,190,90,.7)", opacity: interpolate(frame, [20, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>ROUND {round}</div>
      </div>
      <Letterbox frame={frame} len={60} />
    </AbsoluteFill>
  );
}

function Finale({ village, frame }: { village: boolean; frame: number }) {
  const fps = FPS;
  const stones = ["/art/v2/stone_tunga-art.webp", "/art/v2/stone_bhadra-art.webp"];
  return (
    <AbsoluteFill style={{ background: "#120903" }}>
      <img alt="" src="/art/v2/shrine.webp" style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.55, transform: `scale(${interpolate(frame, [0, 90], [1.06, 1])})` }} />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(18,9,3,.25), rgba(18,9,3,.15) 50%, rgba(18,9,3,.85))" }} />
      {stones.map((src, i) => {
        const at = 20 + i * 10;
        if (village) {
          const drop = spring({ frame: frame - at, fps, config: { damping: 10, stiffness: 120 } });
          const glow = 0.5 + 0.5 * Math.sin((frame - at) / 6);
          return <img alt="" key={src} src={src} style={{ position: "absolute", width: "26%", left: i ? "52%" : "22%", top: `${interpolate(drop, [0, 1], [-30, 77])}%`,
            filter: `drop-shadow(0 0 ${12 + 14 * glow}px rgba(255,200,90,.9))`, opacity: frame < at ? 0 : 1 }} />;
        }
        const flick = frame < at ? 1 : frame < at + 24 ? (Math.sin(frame * 1.7) > 0 ? 1 : 0.25) * interpolate(frame, [at, at + 24], [1, 0.5]) : interpolate(frame, [at + 24, at + 34], [0.5, 0], { extrapolateRight: "clamp" });
        return <div key={src}>
          <img alt="" src={src} style={{ position: "absolute", width: "26%", left: i ? "52%" : "22%", top: "77%", opacity: flick, filter: "drop-shadow(0 0 10px rgba(255,60,40,.7)) saturate(.6)" }} />
          {frame > at + 18 && Array.from({ length: 6 }, (_, k) => {
            const t = frame - at - 18 - k * 2;
            return <div key={k} style={{ position: "absolute", left: `${(i ? 64 : 34) + (k - 3) * 2}%`, top: `${82 - t * 0.6}%`, width: 20 + t * 1.5, height: 20 + t * 1.5, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(60,45,40,.55), transparent 70%)", opacity: interpolate(t, [0, 30], [0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }), transform: "translate(-50%,-50%)" }} />;
          })}
        </div>;
      })}
    </AbsoluteFill>
  );
}

/** a big moment's film, over the table. Tap to skip; it removes itself when it ends. */
export function CinematicOverlay({ beat, speed = 1 }: { beat: Beat; speed?: number }) {
  const [done, setDone] = useState(false);
  if (done || reduced() || !CINEMATIC.has(beat.type)) return null;
  return (
    <button type="button" aria-label="Skip" onClick={() => setDone(true)} className="fixed inset-0 z-[55] block bg-black/70">
      <Film len={LEN} speed={speed} onEnd={() => setDone(true)}>{(f) => <Moment kind={beat.type as CineKind} hit={beat.result === "hit"} frame={f} />}</Film>
    </button>
  );
}

/** NIGHTFALL: the start of a new round */
export function NightfallOverlay({ round, speed = 1 }: { round: number; speed?: number }) {
  const [done, setDone] = useState(false);
  if (done || reduced()) return null;
  return (
    <button type="button" aria-label="Skip" onClick={() => setDone(true)} className="fixed inset-0 z-[55] block bg-black">
      <Film len={60} speed={speed} onEnd={() => setDone(true)}>{(f) => <Night round={round} frame={f} />}</Film>
    </button>
  );
}

/** the end screen's backdrop: the shrine at sunset, the Stones landing on its steps — or vanishing */
export function FinaleBackdrop({ village }: { village: boolean }) {
  if (reduced()) return <div aria-hidden className="fixed inset-0 -z-10 bg-[url(/art/v2/shrine.webp)] bg-cover bg-center opacity-50" />;
  return (
    <div aria-hidden className="fixed inset-0 -z-10">
      <Film len={90} hold>{(f) => <Finale village={village} frame={f} />}</Film>
    </div>
  );
}
