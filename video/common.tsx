// Shared pieces for the 2-second films (owner 2026-11-20: "keep films short", every film has its sound on cue —
// src/lib/filmCues.ts). Same look as the approved Teer Kaman films: the table's own night village, dimmed, real art.
import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, random, staticFile } from "remotion";
import { loadFont } from "@remotion/google-fonts/Cinzel";
import { VillageScene } from "../src/components/table/VillageScene";

export const { fontFamily: CINZEL } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });
export const GOLD = "#f7bb1f", GOLD_SOFT = "#ffe7a6", RED = "#e8434b";
export const S = 720 / 442;
export const CX = 360, CY = 330 * S;
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const BACK = "art/cards/back.webp";
/** films are 2 s at 30 fps unless they say otherwise */
export const SHORT = 60;

/** the dimmed night village; children fade out over the last 10 frames */
export function Scene({ f, total, children, tint = "rgba(1,6,18" }: { f: number; total: number; children: ReactNode; tint?: string }) {
  const dim = interpolate(f, [0, 10], [0, 0.55], clamp);
  const out = interpolate(f, [total - 10, total - 1], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: "#15142c", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 442, height: 884, transform: `scale(${S})`, transformOrigin: "0 0" }}>
        <VillageScene />
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% ${(CY / 1440) * 100}%, rgba(1,8,24,${dim * 0.4}) 0%, ${tint},${dim + 0.2}) 70%)` }} />
      <AbsoluteFill style={{ opacity: out }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

/** the box cover's night painting (the role film's background), dimmed so the middle owns the screen */
export function Cover({ f, total, children, light = false }: { f: number; total: number; children: ReactNode; light?: boolean }) {
  const out = interpolate(f, [total - 10, total - 1], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ background: "#021230", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${interpolate(f, [0, total], [1.12, 1.04])})` }}>
        <Img src={staticFile("art/cover-night.webp")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 70%" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: light ? "radial-gradient(ellipse at 50% 55%, rgba(2,18,48,0) 0%, rgba(1,8,24,.45) 85%)" : "radial-gradient(ellipse at 50% 50%, rgba(2,18,48,.55) 0%, rgba(1,8,24,.9) 75%)" }} />
      <AbsoluteFill style={{ opacity: out }}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
}

/** a card back (a player, or a card held face down), centred on x,y */
export function Back({ x, y, w, h, rot = 0, scale = 1, opacity = 1, glow = 0, color = "247,187,31", grey = 0 }: {
  x: number; y: number; w: number; h: number; rot?: number; scale?: number; opacity?: number; glow?: number; color?: string; grey?: number;
}) {
  return (
    <Img src={staticFile(BACK)} style={{
      position: "absolute", left: x - w / 2, top: y - h / 2, width: w, height: h, objectFit: "cover", borderRadius: Math.max(8, w * 0.06), opacity,
      transform: `rotate(${rot}deg) scale(${scale})`, filter: grey ? `grayscale(${grey}) brightness(${1 - grey * 0.6})` : undefined,
      boxShadow: `0 0 0 3px rgba(${color},${0.6 + glow * 0.4}), 0 0 ${glow * 44}px rgba(${color},${glow * 0.85}), 0 18px 36px rgba(0,0,0,.7)`,
    }} />
  );
}

/** a card's own art, centred on x,y */
export function Art({ name, x, y, w, ratio, rot = 0, scale = 1, opacity = 1 }: { name: string; x: number; y: number; w: number; ratio: number; rot?: number; scale?: number; opacity?: number }) {
  return (
    <Img src={staticFile(`art/v2/${name}-art.webp`)} style={{
      position: "absolute", left: x - w / 2, top: y - (w * ratio) / 2, width: w, opacity,
      transform: `rotate(${rot}deg) scale(${scale})`, filter: "drop-shadow(0 14px 24px rgba(0,0,0,.7))",
    }} />
  );
}

/** a burst of gold sparks from x,y starting at frame `at` */
export function Sparks({ f, at, x, y, n = 18, color = GOLD_SOFT, glow = GOLD, seed = "s" }: { f: number; at: number; x: number; y: number; n?: number; color?: string; glow?: string; seed?: string }) {
  const since = f - at;
  if (since < 0) return null;
  return (
    <>
      {Array.from({ length: n }, (_, i) => {
        const t = since - random(`${seed}d${i}`) * 3;
        if (t < 0) return null;
        const a = random(`${seed}a${i}`) * Math.PI * 2, v = 8 + random(`${seed}v${i}`) * 14;
        const px = x + Math.cos(a) * v * Math.min(t, 14), py = y + Math.sin(a) * v * Math.min(t, 14) + t * t * 0.15;
        const o = interpolate(t, [0, 2, 20], [0, 1, 0], clamp), r = 3 + random(`${seed}r${i}`) * 4;
        return <div key={i} style={{ position: "absolute", left: px, top: py, width: r, height: r, borderRadius: "50%", background: color, boxShadow: `0 0 ${r * 3}px ${glow}`, opacity: o }} />;
      })}
    </>
  );
}

/** a big Cinzel word that drops in at frame `at` */
export function Word({ f, fps, at, text, y = 190, size = 120, color = GOLD, shadow = "rgba(232,67,75,.8)", spring: sp }: {
  f: number; fps: number; at: number; text: string; y?: number; size?: number; color?: string; shadow?: string;
  spring: (o: { frame: number; fps: number; config: object }) => number;
}) {
  const w = sp({ frame: f - at, fps, config: { damping: 11, stiffness: 160 } });
  return (
    <div style={{
      position: "absolute", top: y, width: "100%", textAlign: "center", fontFamily: CINZEL, fontWeight: 700, fontSize: size, letterSpacing: size * 0.1,
      color, opacity: Math.min(1, w * 1.4), transform: `scale(${interpolate(w, [0, 1], [1.8, 1])})`, lineHeight: 1.05,
      textShadow: `0 0 40px ${shadow}, 0 6px 0 #5a1e04, 0 10px 30px rgba(0,0,0,.8)`,
    }}>{text}</div>
  );
}
