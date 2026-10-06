// Card copy — from the v15 rulebook / card-copy sheet. Shared by the UI.
import type { Card } from "@/engine/types";

export const CARD: Record<Card, { name: string; text: string; tone: string }> = {
  FAISLA: { name: "Faisla", text: "Voting begins. Most votes is out — a tie, nobody. Draw 2.", tone: "bg-blue-700" },
  TALASHI: { name: "Talashi", text: "A player shows ALL their cards to everyone — never their role. Draw 2.", tone: "bg-orange-600" },
  KUNDLI: { name: "Kundli", text: "Look at one player's role card in secret. Say anything — or nothing. Draw 2.", tone: "bg-purple-700" },
  HERA_PHERI: { name: "Hera Pheri", text: "Swap action cards: steal 2 face down from any one player. They draw 2.", tone: "bg-amber-700" },
  BATWARA: { name: "Bhukamp", text: "Split your cards: draw 2. Every OTHER player passes 1 card left and 1 right.", tone: "bg-teal-700" },
  MAYA_JAAL: { name: "Mayajaal", text: "Turn back time: revive any one eliminated player. They draw 2 fresh. Draw 2.", tone: "bg-fuchsia-700" },
  TEER_KAMAN: { name: "Teer Kaman", text: "Point at ONE player, say TWO roles. Either is theirs: they are OUT. Miss: lose 1 vote for good. Draw 2.", tone: "bg-red-700" },
  DAL_BADAL: { name: "Dal Badal", text: "Never played. Villagers pass it, thieves hold it. A THIEF eliminated holding it swaps two living players' roles.", tone: "bg-stone-700" },
  STONE_1: { name: "Bhadra Stone", text: "Villagers need BOTH Stones. Thieves need any ONE. Can be passed, never discarded.", tone: "bg-blue-800" },
  STONE_2: { name: "Tunga Stone", text: "Villagers need BOTH Stones. Thieves need any ONE. Can be passed, never discarded.", tone: "bg-amber-600" },
};

export const isStoneCard = (c: Card) => c === "STONE_1" || c === "STONE_2";
export const sideName = (s: "V" | "T") => (s === "V" ? "Tunga" : "Thief");
