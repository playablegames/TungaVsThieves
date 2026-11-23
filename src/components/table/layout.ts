// THE TABLE STAGE (owner 2026-11-19): one fixed design size, scaled to fit the phone (game-ui-ux: one reference
// resolution, scaled). Everything on the table is placed in these units.
export const W = 442;
export const H = 884;
/** centre of the courtyard circle and its radius */
export const CY = 352; // (owner 2026-11-23 "make the table bigger": was 330)
export const R = 148;
/** the ellipse the players stand on */
export const RX = 180;
export const RY = 222; // was 196
/** where your area (the mat with your cards) begins */
export const HAND_TOP = 650; // (owner 2026-11-23 "cards and buttons smaller, table bigger": was 588)

/** you sit at the bottom; the others go round CLOCKWISE in seat order (the pile travels this way) */
export function seatSpot(seat: number, you: number, n: number) {
  const rel = (seat - you + n) % n;
  const a = Math.PI / 2 + (rel * 2 * Math.PI) / n;
  return { x: W / 2 + RX * Math.cos(a), y: CY + RY * Math.sin(a) };
}
