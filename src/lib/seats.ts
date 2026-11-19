// SEAT COLOURS (owner 2026-11-19): one per seat, chosen to read on the night navy. No gold and no bright blue —
// those belong to the Tunga and Bhadra Stones. Every place a player appears (seat, chat, vote, log) uses this colour.
export const SEAT_COLOURS = [
  { name: "Red", hex: "#ef5a43" },
  { name: "Saffron", hex: "#f59a3a" },
  { name: "Mint", hex: "#7fe3b4" },
  { name: "Emerald", hex: "#3cc27a" },
  { name: "Peacock", hex: "#2cc4c4" },
  { name: "Cream", hex: "#f5ead6" },
  { name: "Purple", hex: "#a98cf8" },
  { name: "Rani pink", hex: "#f06ba6" },
  { name: "Clay", hex: "#d98b5e" },
  { name: "Lilac", hex: "#e0b4f5" },
  { name: "Ash", hex: "#b4bccb" },
  { name: "Lime", hex: "#c6e86a" },
] as const;

export const seatColour = (seat: number) => SEAT_COLOURS[seat % SEAT_COLOURS.length];
