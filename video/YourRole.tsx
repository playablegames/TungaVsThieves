// "Your role" — 3.5 s. The card lands face down on the night painting, lifts, flips, and your team's light bursts out
// behind it. Ends on a still, floating card; the game puts "Keep it hidden" and the tap-to-go-on under it as plain text.
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Cinzel";

const { fontFamily } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });

export type YourRoleProps = { role: string; thief: boolean };

const GOLD = "#f7bb1f", GOLD_SOFT = "#ffe7a6", NIGHT = "#021230";
const CARD_W = 440, CARD_H = 623;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const YourRole = ({ role, thief }: YourRoleProps) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const team = thief ? { glow: "220,40,40", word: "TEAM THIEVES", color: "#ff6b5b" } : { glow: "255,190,60", word: "TEAM TUNGA", color: GOLD };

  // 1) lands face down (0-14)  2) lifts (14-30)  3) flips (30-44)  4) light + words (40-60)  5) floats (60-105)
  const land = spring({ frame: f, fps, config: { damping: 14, stiffness: 120 } });
  const lift = interpolate(f, [14, 30], [0, 1], { ...clamp, easing: Easing.bezier(0.33, 0, 0.2, 1) });
  const flip = interpolate(f, [30, 44], [0, 180], { ...clamp, easing: Easing.bezier(0.65, 0, 0.35, 1) });
  const burst = spring({ frame: f - 38, fps, config: { damping: 18, stiffness: 90 } });
  const words = spring({ frame: f - 46, fps, config: { damping: 16, stiffness: 110 } });
  const float = f > 60 ? Math.sin((f - 60) / 14) * 6 : 0;
  // a thief's card shudders as it lifts — the only hint before the face shows
  const shake = thief && f > 20 && f < 30 ? Math.sin(f * 2.6) * 4 * (1 - (f - 20) / 10) : 0;

  const y = interpolate(land, [0, 1], [900, 0]) - lift * 40 + float;
  const tilt = interpolate(land, [0, 1], [-8, 0]) + shake * 0.4;
  const scale = 1 + lift * 0.06 - interpolate(flip, [0, 90, 180], [0, 0.05, 0]);
  const showFace = flip >= 90;

  return (
    <AbsoluteFill style={{ background: NIGHT, overflow: "hidden" }}>
      {/* the box's night painting, pushed back and dimmed so the card owns the screen */}
      <AbsoluteFill style={{ transform: `scale(${interpolate(f, [0, 105], [1.12, 1.02])})` }}>
        <Img src={staticFile("art/cover-night.webp")} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 70%" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, rgba(2,18,48,.55) 0%, rgba(1,8,24,${interpolate(f, [0, 30], [0.8, 0.9], clamp)}) 75%)` }} />

      {/* the team's light: a soft bloom and slow rays behind the card */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: burst }}>
        <div style={{
          position: "absolute", width: 1400, height: 1400, borderRadius: "50%",
          background: `radial-gradient(circle, rgba(${team.glow},.75) 0%, rgba(${team.glow},.25) 28%, rgba(${team.glow},0) 60%)`,
          transform: `scale(${interpolate(burst, [0, 1], [0.2, 1]) * (1 + Math.sin(f / 10) * 0.03)})`,
        }} />
        <div style={{
          position: "absolute", width: 1600, height: 1600,
          background: `repeating-conic-gradient(from ${f * 0.6}deg, rgba(${team.glow},.22) 0deg 6deg, transparent 6deg 24deg)`,
          maskImage: "radial-gradient(circle, black 10%, transparent 55%)", WebkitMaskImage: "radial-gradient(circle, black 10%, transparent 55%)",
          transform: `scale(${interpolate(burst, [0, 1], [0.3, 1])})`,
        }} />
      </AbsoluteFill>

      {/* sparks thrown out at the flip, drifting up like the home screen's fireflies */}
      {Array.from({ length: 26 }, (_, i) => {
        const t = f - 40 - random(`d${i}`) * 6;
        if (t < 0) return null;
        const ang = random(`a${i}`) * Math.PI * 2, speed = 7 + random(`s${i}`) * 9;
        const x = 360 + Math.cos(ang) * speed * Math.min(t, 18) + Math.sin(t / 8 + i) * 6;
        const yy = 720 + Math.sin(ang) * speed * Math.min(t, 18) - t * 2.2;
        const o = interpolate(t, [0, 4, 50], [0, 1, 0], clamp);
        const r = 3 + random(`r${i}`) * 5;
        return <div key={i} style={{ position: "absolute", left: x, top: yy, width: r, height: r, borderRadius: "50%", background: thief && i % 3 === 0 ? "#ff8a7a" : GOLD_SOFT, boxShadow: `0 0 ${r * 3}px rgba(${team.glow},.9)`, opacity: o }} />;
      })}

      {/* YOU ARE */}
      <div style={{
        position: "absolute", top: 150, width: "100%", textAlign: "center", fontFamily, fontWeight: 700, fontSize: 58,
        letterSpacing: interpolate(words, [0, 1], [30, 10]), color: GOLD_SOFT, opacity: words,
        transform: `translateY(${interpolate(words, [0, 1], [-24, 0])}px)`, textShadow: "0 4px 18px rgba(0,8,30,.9)",
      }}>YOU ARE</div>

      {/* the card: back until it turns past edge-on, then the printed role card */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", perspective: 1600 }}>
        <div style={{
          width: CARD_W, height: CARD_H, position: "relative",
          transform: `translateX(${shake}px) translateY(${y}px) rotate(${tilt}deg) rotateY(${flip}deg) scale(${scale})`,
        }}>
          <Img src={staticFile(showFace ? `art/roles/${role}.webp` : "art/cards/back.webp")} style={{
            width: "100%", height: "100%", objectFit: "cover", borderRadius: 22,
            transform: showFace ? "scaleX(-1)" : undefined,
            boxShadow: `0 30px 60px rgba(0,0,0,.65), 0 0 ${interpolate(burst, [0, 1], [0, 70])}px rgba(${team.glow},.7)`,
          }} />
        </div>
      </AbsoluteFill>

      {/* TEAM TUNGA / TEAM THIEVES */}
      <div style={{
        position: "absolute", bottom: 210, width: "100%", textAlign: "center", fontFamily, fontWeight: 700, fontSize: 50,
        letterSpacing: 6, color: team.color, opacity: words,
        transform: `scale(${interpolate(words, [0, 1], [1.4, 1])})`, textShadow: `0 0 28px rgba(${team.glow},.8), 0 4px 14px rgba(0,8,30,.9)`,
      }}>{team.word}</div>
    </AbsoluteFill>
  );
};
