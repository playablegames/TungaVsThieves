// "Talashi" — 2 s (owner approved the storyboard 2026-11-20). The night village dims; the searched player's card back
// in the middle, their 2 cards FACE DOWN in front of it. The magnifying glass (the card's own art) glides over the 2
// cards, left to right; a gold glint shines in the lens as it passes each one. The cards are NEVER turned over [3.1]:
// only the searcher sees them, in their own screen. Sound comes from the table, on cue (src/lib/filmCues.ts).
// The bottom third stays empty: the game writes "Raju searched Pappu".
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Word } from "./common";
import { VillageScene } from "../src/components/table/VillageScene";

const GOLD = "#f7bb1f", GOLD_SOFT = "#ffe7a6";
const S = 720 / 442;
const CX = 360, CY = 330 * S;
const P_W = 230, P_H = 330;                  // the searched player's card back
const C_W = 120, C_H = 172;                  // their 2 cards, face down
const HELD_Y = CY + 110;
const CARDS = [CX - 72, CX + 72];
const GLASS_W = 300;
/** the glass is in from frame 6 to 46; its lens centre sits at ~43% across, 40% down the art */
const IN = 6, OUT = 46;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const BACK = "art/cards/back.webp";

/** the lens centre's x at frame f */
const lensX = (f: number) => interpolate(f, [IN, OUT], [-160, 880], { ...clamp, easing: Easing.inOut(Easing.sin) });
/** the frame the lens is over each card (used by the sound cues too) */
export const TALASHI_GLINTS = CARDS.map((x) => {
  for (let f = IN; f <= OUT; f++) if (lensX(f) >= x) return f;
  return OUT;
});

export const Talashi = () => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const dim = interpolate(f, [0, 10], [0, 0.55], clamp);
  const pIn = spring({ frame: f, fps, config: { damping: 15, stiffness: 120 } });
  const out = interpolate(f, [durationInFrames - 10, durationInFrames - 1], [1, 0], clamp);
  const lx = lensX(f), ly = HELD_Y - 10 + Math.sin(interpolate(f, [IN, OUT], [0, Math.PI], clamp)) * -30;

  return (
    <AbsoluteFill style={{ background: "#15142c", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 442, height: 884, transform: `scale(${S})`, transformOrigin: "0 0" }}>
        <VillageScene />
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% ${(CY / 1440) * 100}%, rgba(1,8,24,${dim * 0.4}) 0%, rgba(1,6,18,${dim + 0.2}) 70%)` }} />

      <AbsoluteFill style={{ opacity: out }}>
        <Img src={staticFile(BACK)} style={{
          position: "absolute", left: CX - P_W / 2, top: CY - P_H / 2 - 60, width: P_W, height: P_H, objectFit: "cover", borderRadius: 14,
          opacity: pIn, transform: `scale(${interpolate(pIn, [0, 1], [0.8, 1])})`,
          boxShadow: "0 0 0 3px rgba(247,187,31,.7), 0 20px 40px rgba(0,0,0,.7)",
        }} />

        {/* the 2 cards, face down — they light up a little as the lens passes, never turn */}
        {CARDS.map((x, i) => {
          const g = interpolate(f, [TALASHI_GLINTS[i] - 4, TALASHI_GLINTS[i], TALASHI_GLINTS[i] + 10], [0, 1, 0], clamp);
          return (
            <Img key={i} src={staticFile(BACK)} style={{
              position: "absolute", left: x - C_W / 2, top: HELD_Y - C_H / 2, width: C_W, height: C_H, objectFit: "cover", borderRadius: 10,
              opacity: pIn, transform: `rotate(${(i - 0.5) * 12}deg)`,
              boxShadow: `0 0 0 3px rgba(247,187,31,${0.6 + g * 0.4}), 0 0 ${g * 36}px rgba(247,187,31,${g * 0.9}), 0 14px 28px rgba(0,0,0,.7)`,
            }} />
          );
        })}

        {/* the glass */}
        <Img src={staticFile("art/v2/talashi-art.webp")} style={{
          position: "absolute", left: lx - GLASS_W * 0.43, top: ly - GLASS_W * 0.4 * (535 / 640), width: GLASS_W,
          transform: `rotate(${interpolate(f, [IN, OUT], [-8, 8], clamp)}deg)`, filter: "drop-shadow(0 14px 24px rgba(0,0,0,.7))",
        }} />

        {/* the glint in the lens over each card */}
        {TALASHI_GLINTS.map((gf, i) => {
          const t = f - gf;
          if (t < 0 || t > 12) return null;
          const o = interpolate(t, [0, 2, 12], [0, 1, 0], clamp), s = interpolate(t, [0, 12], [0.4, 1.3], clamp);
          return (
            <svg key={i} width={140} height={140} viewBox="-70 -70 140 140" style={{ position: "absolute", left: lx - 70 - 20, top: ly - 70 - 40, opacity: o, transform: `scale(${s}) rotate(${t * 4}deg)` }}>
              <path d="M0 -60 L9 -9 L60 0 L9 9 L0 60 L-9 9 L-60 0 L-9 -9Z" fill={GOLD_SOFT} style={{ filter: `drop-shadow(0 0 12px ${GOLD})` }} />
            </svg>
          );
        })}
        <Word f={f} fps={fps} at={10} text="TALASHI" y={CY + 240} spring={spring} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
