// ANIMATION MATHS (2026-10-14, "the game loads slowly"): the three things the films used from Remotion — interpolate,
// spring, AbsoluteFill — in a few lines of our own, so Remotion's 260 KB never reaches the phone.
import { createElement, type CSSProperties, type ReactNode } from "react";

type Extrapolate = "clamp" | "extend";
export interface InterpolateOptions { extrapolateLeft?: Extrapolate; extrapolateRight?: Extrapolate; easing?: (t: number) => number }

/** map `x` through the points `input` → `output` (piecewise linear, optional easing per segment), like Remotion's */
export function interpolate(x: number, input: number[], output: number[], o: InterpolateOptions = {}): number {
  const n = input.length;
  if (x <= input[0] && o.extrapolateLeft === "clamp") return output[0];
  if (x >= input[n - 1] && o.extrapolateRight === "clamp") return output[n - 1];
  let i = 1;
  while (i < n - 1 && x > input[i]) i++;
  const a = input[i - 1], b = input[i];
  let t = b === a ? 1 : (x - a) / (b - a);
  if (o.easing && t >= 0 && t <= 1) t = o.easing(t);
  return output[i - 1] + (output[i] - output[i - 1]) * t;
}

/** a damped spring from 0 to 1 over frames (analytic; 0 before frame 0) — the physics Remotion's spring() uses */
export function spring({ frame, fps, config = {} }: { frame: number; fps: number; config?: { damping?: number; stiffness?: number; mass?: number } }): number {
  if (frame <= 0) return 0;
  const { damping = 10, stiffness = 100, mass = 1 } = config;
  const t = frame / fps, w = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass));
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w * t) * (1 + w * t);
}

/** a box that fills its parent */
export function AbsoluteFill({ style, children }: { style?: CSSProperties; children?: ReactNode }) {
  return createElement("div", { style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", ...style } }, children);
}
