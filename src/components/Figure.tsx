// THE PLAYER FIGURE (owner 2026-11-19): a Warli figure, kept plain — a big solid head, two solid triangles meeting at
// the waist, smooth curved limbs, tiny forked hands. One colour per seat (src/lib/seats.ts). It always stands calm;
// the FACE carries the feeling — a player's reaction (Talk "react") shows on their own figure, then back to calm.
// Pure SVG, no images, safe to render on the server.
import type { React as Reaction } from "@/rules/game";

export type Face = "calm" | Reaction;

const NAVY = "#021230";
const line = { stroke: NAVY, fill: "none", strokeLinecap: "round", strokeLinejoin: "round" } as const;

/** drawn on a head centred at (20, 11.2); the wrapper scales it up to the big head */
function FaceMarks({ face }: { face: Face }) {
  switch (face) {
    case "calm":
      return <><circle cx="17.6" cy="10.6" r="1.15" fill={NAVY} /><circle cx="22.4" cy="10.6" r="1.15" fill={NAVY} /><path d="M18 14.2 Q20 15.2 22 14.2" {...line} strokeWidth={1.1} /></>;
    case "cry":
      return <><path d="M16.6 10.8 Q17.6 9.6 18.6 10.8 M21.4 10.8 Q22.4 9.6 23.4 10.8" {...line} strokeWidth={1.1} /><path d="M18 15.2 Q20 13.4 22 15.2" {...line} strokeWidth={1.1} /><path d="M17.2 12 Q16.5 13.8 17.2 14.4 Q17.9 13.8 17.2 12Z" fill="#8fd3ff" /></>;
    case "cheer":
      return <><path d="M16.6 11 L17.6 9.8 L18.6 11 M21.4 11 L22.4 9.8 L23.4 11" {...line} strokeWidth={1.1} /><path d="M17.4 13.2 Q20 16.8 22.6 13.2Z" fill={NAVY} /></>;
    case "shock":
      return <><circle cx="17.6" cy="10.4" r="1.6" {...line} strokeWidth={1} /><circle cx="22.4" cy="10.4" r="1.6" {...line} strokeWidth={1} /><ellipse cx="20" cy="14.6" rx="1.1" ry="1.5" fill={NAVY} /></>;
    case "doubt":
      return <><path d="M16.6 8.6 L18.6 9.2 M21.4 8.2 Q22.4 7.6 23.4 8.4" {...line} strokeWidth={1} /><circle cx="18.2" cy="10.8" r="1.05" fill={NAVY} /><circle cx="23" cy="10.8" r="1.05" fill={NAVY} /><path d="M18 14.4 Q20 14.8 22.4 13.6" {...line} strokeWidth={1.1} /></>;
    case "angry":
      return <><path d="M16.4 8.6 L18.8 9.8 M23.6 8.6 L21.2 9.8" {...line} strokeWidth={1.2} /><circle cx="17.8" cy="11" r="1.05" fill={NAVY} /><circle cx="22.2" cy="11" r="1.05" fill={NAVY} /><path d="M18 15 Q20 13.4 22 15" {...line} strokeWidth={1.1} /></>;
    case "shh":
      return <><path d="M16.6 10.6 Q17.6 11.4 18.6 10.6 M21.4 10.6 Q22.4 11.4 23.4 10.6" {...line} strokeWidth={1.1} /><path d="M18.2 14.2 L21.8 14.2" {...line} strokeWidth={1.1} /><path d="M20 16.8 L20 12.6" {...line} strokeWidth={1.4} /></>;
  }
}

export function Figure({ colour, face = "calm", size = 44, label }: { colour: string; face?: Face; size?: number; label?: string }) {
  const limb = { stroke: colour, fill: "none", strokeWidth: 2.1, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const hand = { ...limb, strokeWidth: 1.3 };
  return (
    <svg width={size} height={size * 1.32} viewBox="0 -0.6 40 52.6" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d="M12.6 21 L27.4 21 L20 32Z" fill={colour} />
      <path d="M20 32 L26.2 42.4 L13.8 42.4Z" fill={colour} />
      <path d="M20 19.6 L20 21.4" {...limb} />
      <path d="M13.4 22 Q9.4 26.6 10.6 32.6" {...limb} /><path d="M26.6 22 Q30.6 26.6 29.4 32.6" {...limb} />
      <path d="M10.6 32.6 L9.2 34.4 M10.6 32.6 L10.4 34.8 M10.6 32.6 L11.8 34.4" {...hand} />
      <path d="M29.4 32.6 L30.8 34.4 M29.4 32.6 L29.6 34.8 M29.4 32.6 L28.2 34.4" {...hand} />
      <path d="M17.2 42.2 Q15.4 46.6 13.2 50.2 L11 50.4" {...limb} /><path d="M22.8 42.2 Q24.6 46.6 26.8 50.2 L29 50.4" {...limb} />
      <circle cx="20" cy="10.4" r="9.6" fill={colour} />
      <g transform="translate(20 10.4) scale(1.33) translate(-20 -11.2)"><FaceMarks face={face} /></g>
    </svg>
  );
}
