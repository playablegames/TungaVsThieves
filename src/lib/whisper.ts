// Whispers (designer 2026-10-07): a private voice note (≤10 s) or a quick line to ONE player, once per round.
// The table sees "Yh whispered to Shyam" and a 👂 fly across — never what was said. Shared by server and phones.
// Carried in the messages table (no schema change): "\u0001w|<to>|<kind>|<payload>"; kind v = voice (a data URL),
// t = a quick line, k = a Kundli read "<about>|<role>". Anyone but the two players gets "\u0001w|<to>|" only.

export const SYSTEM = "\u0001";
export const WHISPER_PREFIX = "\u0001w|";
export const WHISPER_MAX_AUDIO = 240_000; // characters of data URL ≈ 10 s of compressed voice
export const WHISPER_SECONDS = 10;
export const QUICK_LINES = ["Trust me 🙏", "I'm with the village", "Vote with me", "Be careful", "I have a Stone 🤫"] as const;

export type WhisperBody = { kind: "v"; audio: string } | { kind: "t"; text: string } | { kind: "k"; about: number; role: string };
export interface Whisper { from: number; to: number; body: WhisperBody | null }

/** a spoken sentence, written down by the speaker's own phone (live captions) */
export const CAPTION_PREFIX = `${SYSTEM}s|`;
/** a ready-made line ("Not me!") — tap your own seat */
export const QUICK_PREFIX = `${SYSTEM}q|`;
export const isCaption = (t: string) => t.startsWith(CAPTION_PREFIX);
export const isQuick = (t: string) => t.startsWith(QUICK_PREFIX);

export const isSystemMessage = (text: string) => text.startsWith(SYSTEM);
export const isWhisper = (text: string) => text.startsWith(WHISPER_PREFIX);

export function encodeWhisper(to: number, b: WhisperBody): string {
  const payload = b.kind === "v" ? b.audio : b.kind === "t" ? b.text : `${b.about}|${b.role}`;
  return `${WHISPER_PREFIX}${to}|${b.kind}|${payload}`;
}

/** what a seat that is neither sender nor receiver gets: who to whom, nothing else */
export const redactWhisper = (text: string) => {
  const [to] = text.slice(WHISPER_PREFIX.length).split("|", 1);
  return `${WHISPER_PREFIX}${to}|`;
};

export function decodeWhisper(from: number, text: string): Whisper | null {
  if (!isWhisper(text)) return null;
  const rest = text.slice(WHISPER_PREFIX.length);
  const i = rest.indexOf("|");
  const to = Number(rest.slice(0, i));
  const tail = rest.slice(i + 1);
  if (!tail) return { from, to, body: null };
  const kind = tail[0], payload = tail.slice(2);
  if (kind === "v") return { from, to, body: { kind: "v", audio: payload } };
  if (kind === "t") return { from, to, body: { kind: "t", text: payload } };
  if (kind === "k") { const [about, role] = payload.split("|"); return { from, to, body: { kind: "k", about: Number(about), role } }; }
  return { from, to, body: null };
}
