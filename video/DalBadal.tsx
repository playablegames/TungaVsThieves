// "Dal Badal" — 3.5 s (owner OK'd 2026-11-19), same style as the Teer Kaman films. One film per thief role, so the
// thief's real card shows:
//   1. the thief's card back rises in the courtyard and flips — their role, in a red glow (rule 4.1: shown to all)
//   2. it turns face down again and joins three card backs that fly in (rule 4.2: thief + 3 = 4 cards in the shuffle)
//   3. the four swirl round the courtyard in a gold whirl, then land in new places, face down — nobody sees the new roles
// No sound of its own (the table plays the swirl). Render one per role: --props='{"role":"chor"}'
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/Cinzel";
import { VillageScene } from "../src/components/table/VillageScene";

const { fontFamily } = loadFont("normal", { weights: ["700"], subsets: ["latin"] });

export type DalBadalProps = { role: string };

const GOLD = "#f7bb1f", GOLD_SOFT = "#ffe7a6";
const S = 720 / 442;
const CX = 360, CY = 330 * S;
const BIG_W = 270, BIG_H = 382;            // the shown role card
const SM_W = 132, SM_H = 187;              // the four in the swirl
const RING = 190;
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const io = Easing.bezier(0.65, 0, 0.35, 1);

/** where card i sits on the ring at swirl angle t (radians); card 0 = the thief's, starting at the top */
const onRing = (i: number, t: number) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 2 + t;
  return { x: CX + RING * Math.cos(a), y: CY + RING * Math.sin(a) };
};
/** the three others fly in from off the edges */
const FROM = [{ x: 900, y: CY }, { x: CX, y: 1700 }, { x: -200, y: CY }];

function CardImg({ src, w, h, glow, red }: { src: string; w: number; h: number; glow: number; red?: boolean }) {
  const c = red ? "232,67,75" : "247,187,31";
  return (
    <Img src={staticFile(src)} style={{
      width: w, height: h, objectFit: "cover", borderRadius: w * 0.06, display: "block",
      boxShadow: `0 0 0 ${w > 200 ? 4 : 3}px rgba(247,187,31,.9), 0 20px 44px rgba(0,0,0,.7), 0 0 ${glow}px rgba(${c},.75)`,
    }} />
  );
}

export const DalBadal = ({ role }: DalBadalProps) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  const dim = interpolate(f, [0, 12], [0, 0.55], clamp);
  const rise = spring({ frame: f, fps, config: { damping: 14, stiffness: 110 } });
  const flipUp = interpolate(f, [10, 22], [0, 180], { ...clamp, easing: io });   // shows the role
  const flipDown = interpolate(f, [46, 56], [0, 180], { ...clamp, easing: io }); // hides it again
  const toRing = interpolate(f, [52, 64], [0, 1], { ...clamp, easing: io });      // big centre card → slot 0
  const flyIn = (i: number) => interpolate(f, [54 + i * 3, 66 + i * 3], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const swirl = interpolate(f, [66, 92], [0, Math.PI * 2 + Math.PI / 2], { ...clamp, easing: io }); // one and a quarter turns
  // the cards lean into the spin and come out of it upright
  const lean = Math.sin((swirl / (Math.PI * 2.5)) * Math.PI) * 22;
  const settle = f >= 92 ? interpolate(f, [92, 97, 104], [0, 1, 0], clamp) : 0;
  const title = spring({ frame: f - 14, fps, config: { damping: 12, stiffness: 140 } });
  const whirl = interpolate(f, [62, 70, 88, 98], [0, 1, 1, 0], clamp);
  const red = interpolate(f, [16, 24, 46, 58], [0, 1, 1, 0], clamp);

  // the thief's card: face-up between the two flips (rotateY 0..180 shows the back, then the face, then the back)
  const rot = flipUp - flipDown;           // 0 → 180 → 0
  const showFace = rot > 90;
  const p0 = onRing(0, swirl);
  const tx = interpolate(toRing, [0, 1], [CX, p0.x]), ty = interpolate(toRing, [0, 1], [CY, p0.y]);
  const w = interpolate(toRing, [0, 1], [BIG_W, SM_W]), h = interpolate(toRing, [0, 1], [BIG_H, SM_H]);

  return (
    <AbsoluteFill style={{ background: "#15142c", overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: 442, height: 884, transform: `scale(${S})`, transformOrigin: "0 0" }}>
        <VillageScene />
      </div>
      <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% ${(CY / 1440) * 100}%, rgba(1,8,24,${dim * 0.4}) 0%, rgba(1,6,18,${dim + 0.2}) 70%)` }} />

      {/* the thief's red light while the role shows */}
      <div style={{
        position: "absolute", left: CX - 400, top: CY - 400, width: 800, height: 800, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(232,67,75,.55) 0%, rgba(232,67,75,.15) 38%, transparent 64%)", opacity: red,
      }} />

      {/* the gold whirl under the swirl */}
      <div style={{
        position: "absolute", left: CX - 330, top: CY - 330, width: 660, height: 660, borderRadius: "50%", opacity: whirl * 0.8,
        background: `repeating-conic-gradient(from ${f * 9}deg, rgba(247,187,31,.35) 0deg 10deg, transparent 10deg 30deg)`,
        maskImage: "radial-gradient(circle, transparent 30%, black 45%, black 58%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(circle, transparent 30%, black 45%, black 58%, transparent 70%)",
      }} />
      {f > 62 && f < 100 && Array.from({ length: 18 }, (_, i) => {
        const a = random(`a${i}`) * Math.PI * 2 + f * 0.16, r = RING + (random(`r${i}`) - 0.5) * 90;
        const s = 3 + random(`s${i}`) * 4;
        return <div key={i} style={{ position: "absolute", left: CX + r * Math.cos(a), top: CY + r * Math.sin(a), width: s, height: s, borderRadius: "50%", background: GOLD_SOFT, boxShadow: `0 0 ${s * 3}px ${GOLD}`, opacity: whirl }} />;
      })}

      {/* the three others: fly in, then ride the ring */}
      {[1, 2, 3].map((i) => {
        const k = flyIn(i - 1);
        if (k <= 0) return null;
        const p = onRing(i, swirl), from = FROM[i - 1];
        const x = interpolate(k, [0, 1], [from.x, p.x]), y = interpolate(k, [0, 1], [from.y, p.y]);
        return (
          <div key={i} style={{ position: "absolute", left: x - SM_W / 2, top: y - SM_H / 2, transform: `rotate(${lean}deg) scale(${1 + settle * 0.06})` }}>
            <CardImg src="art/cards/back.webp" w={SM_W} h={SM_H} glow={settle * 40 + whirl * 14} />
          </div>
        );
      })}

      {/* the thief's card */}
      <div style={{
        position: "absolute", left: tx - w / 2, top: ty - h / 2 + interpolate(rise, [0, 1], [500, 0]), perspective: 1400, opacity: Math.min(1, rise * 2),
        transform: `scale(${1 + settle * 0.06}) rotate(${toRing > 0 ? lean : 0}deg)`,
      }}>
        <div style={{ transform: `rotateY(${rot}deg)` }}>
          <div style={{ transform: showFace ? "scaleX(-1)" : undefined }}>
            <CardImg src={showFace ? `art/roles/${role}.webp` : "art/cards/back.webp"} w={w} h={h} glow={showFace ? 60 * red : settle * 40 + whirl * 14} red={showFace} />
          </div>
        </div>
      </div>

      {/* DAL BADAL */}
      <div style={{
        position: "absolute", top: 120, width: "100%", textAlign: "center", fontFamily, fontWeight: 700, fontSize: 78, letterSpacing: 8,
        color: GOLD, opacity: Math.min(1, title * 1.4), transform: `scale(${interpolate(title, [0, 1], [1.25, 1])})`,
        textShadow: "0 0 34px rgba(232,67,75,.6), 0 5px 0 #5a1e04, 0 10px 28px rgba(0,0,0,.8)",
      }}>DAL BADAL</div>
    </AbsoluteFill>
  );
};
