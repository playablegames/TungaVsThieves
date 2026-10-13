// Card icons after the designer's reference (2026-10-07): a coloured disc with a white glyph, one per card.
// Plain SVG on a 24-unit grid so they stay crisp at any size; the disc colour is the card's own.
import type { Card } from "@/engine/types";

const DISC: Record<Card, string> = {
  FAISLA: "#5b3a8c",     // the vote: royal purple
  TALASHI: "#1f4e79",    // the search: deep blue
  KUNDLI: "#2e6b3a",     // the role: forest green
  HERA_PHERI: "#8e2a14", // the steal: brick red
  BATWARA: "#9a5a12",    // Bhukamp: earth amber
  TEER_KAMAN: "#7a1020", // the arrow: crimson
  DAL_BADAL: "#4a4a52",  // the swap of sides: slate
  STONE_1: "#2a56b8",    // Bhadra Stone: blue
  STONE_2: "#b8860b",    // Tunga Stone: gold
};

const W = { fill: "none", stroke: "#fff", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Glyph({ c }: { c: Card }) {
  switch (c) {
    case "FAISLA": // scales of judgement
      return <g {...W}><path d="M12 4v15M7 19h10M5 7h14" /><path d="M5 7l-2.5 5a2.5 2.5 0 0 0 5 0z" fill="#fff" /><path d="M19 7l-2.5 5a2.5 2.5 0 0 0 5 0z" fill="#fff" /></g>;
    case "TALASHI": // magnifying glass
      return <g {...W} strokeWidth={2.2}><circle cx="10.5" cy="10.5" r="5.5" /><path d="M15 15l5 5" /></g>;
    case "KUNDLI": // the open eye that sees a role
      return <g {...W}><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="2.8" fill="#fff" /></g>;
    case "HERA_PHERI": // two arrows chasing each other — cards changing hands
      return <g {...W} strokeWidth={2.2}><path d="M5 10a7 7 0 0 1 12.2-3.5M19 14a7 7 0 0 1-12.2 3.5" /><path d="M17.5 3v4h-4M6.5 21v-4h4" /></g>;
    case "BATWARA": // the ground cracking
      return <g {...W}><path d="M3 18h18" /><path d="M12 4l-2 4 3 3-2.5 4 1.5 3" /><path d="M5 12l2-2M19 12l-2-2M6 7l1.5 1M18 7l-1.5 1" /></g>;
    case "TEER_KAMAN": // bow and arrow
      return <g {...W}><path d="M6 3c7 2 11 7 11 15" /><path d="M6 3l11 15" strokeWidth={1} /><path d="M3 21L19 5M19 5h-4M19 5v4" strokeWidth={2} /></g>;
    case "DAL_BADAL": // two people trading places
      return <g {...W}><circle cx="8" cy="7" r="2.5" fill="#fff" /><circle cx="16" cy="7" r="2.5" fill="#fff" /><path d="M4.5 15a3.5 3.5 0 0 1 7 0M12.5 15a3.5 3.5 0 0 1 7 0" /><path d="M7 19h10M15 17l2 2-2 2M9 17l-2 2 2 2" strokeWidth={1.4} /></g>;
    case "STONE_1":
    case "STONE_2": // a cut gem
      return <g {...W}><path d="M7 4h10l4 5-9 11L3 9z" fill="rgba(255,255,255,.18)" /><path d="M3 9h18M9 4l3 5 3-5M12 9v11" strokeWidth={1.2} /></g>;
  }
}

/** (designer 2026-10-12) the PRINTED card art, cut from the print files — the online game looks like the box */
export const CARD_ART: Record<Card, string> = {
  FAISLA: "/art/v2/faisla-art.webp", TALASHI: "/art/v2/talashi-art.webp", KUNDLI: "/art/v2/kundli-art.webp",
  HERA_PHERI: "/art/v2/hera_pheri-art.webp", BATWARA: "/art/v2/bhukamp-art.webp", TEER_KAMAN: "/art/v2/teer_kaman-art.webp",
  DAL_BADAL: "/art/v2/dal_badal-art.webp", STONE_1: "/art/v2/stone_bhadra-art.webp", STONE_2: "/art/v2/stone_tunga-art.webp",
};
export function CardIcon({ c, className = "" }: { c: Card; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={CARD_ART[c]} alt="" aria-hidden draggable={false} className={`aspect-square object-contain ${className}`} />;
}
/** the old drawn glyph (kept for anything that still wants a flat icon) */
export function CardGlyph({ c, className = "" }: { c: Card; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill={DISC[c]} />
      <g transform="translate(3.6 3.6) scale(.7)"><Glyph c={c} /></g>
    </svg>
  );
}

/** (designer 2026-10-12) the NEW card faces as the designer's files arrive: in the hand a card shows only its ART and
 *  TITLE (the designer's own frame); tapping it opens the full rules. A card listed here uses the real face. */
export const CARD_FACE: Partial<Record<Card, string>> = {
  FAISLA: "/art/v2/faisla-face.webp", TALASHI: "/art/v2/talashi-face.webp", KUNDLI: "/art/v2/kundli-face.webp",
  HERA_PHERI: "/art/v2/hera_pheri-face.webp", BATWARA: "/art/v2/bhukamp-face.webp", TEER_KAMAN: "/art/v2/teer_kaman-face.webp",
  DAL_BADAL: "/art/v2/dal_badal-face.webp", STONE_1: "/art/v2/stone_bhadra-face.webp", STONE_2: "/art/v2/stone_tunga-face.webp",
};
/** the title sits in the frame's space above its divider (designer 2026-10-13: the card shows only its title and art) */
export function CardTitle({ c, name, className = "" }: { c: Card; name: string; className?: string }) {
  void c;
  return (
    <span className={`absolute inset-x-[6%] top-[64%] grid h-[15%] place-items-center text-center font-display font-black uppercase leading-none tracking-wide text-[#ef7a14] [text-shadow:0_1px_0_#7a2e0c,0_0_1px_#7a2e0c] ${className}`}>
      {name}
    </span>
  );
}

/** the role cards that exist in print */
const ROLE_ART = new Set(["kisaan", "sarpanch", "baba", "teacher", "police", "doctor", "nri", "deewani", "chor", "lootera", "gunda", "daku"]);
export const roleArt = (role: string | null | undefined) => (role && ROLE_ART.has(role.toLowerCase()) ? `/art/roles/${role.toLowerCase()}.webp` : null);
export const CARD_BACK = "/art/cards/back.webp";

/** the gold flourish in each corner of a card (reference: filigree corners) */
export function Corners() {
  const one = "absolute h-3 w-3 border-[#b8863b]";
  return (
    <span aria-hidden className="pointer-events-none absolute inset-[4px]">
      <span className={`${one} left-0 top-0 rounded-tl-md border-l-2 border-t-2`} />
      <span className={`${one} right-0 top-0 rounded-tr-md border-r-2 border-t-2`} />
      <span className={`${one} bottom-0 left-0 rounded-bl-md border-b-2 border-l-2`} />
      <span className={`${one} bottom-0 right-0 rounded-br-md border-b-2 border-r-2`} />
    </span>
  );
}
