"use client";
// The narrator — "the Sutradhar" — announces the big moments in Hindi with the phone's own voice (free, offline).
// Research 2026-10-07: a voiced host is what players remember (Jackbox, One Night's narrator), and no Werewolf/Mafia
// app speaks Hindi. Lines are in Devanagari so hi-IN voices pronounce them properly; a studio voice (e.g. Sarvam
// Bulbul) can replace these later as pre-rendered clips with the same keys.
import type { Beat } from "./beats";

const PREF = "tunga:narrator";
let on = true;
try { on = localStorage.getItem(PREF) !== "off"; } catch {}

export const narratorOn = () => on;
export function setNarrator(v: boolean) {
  on = v;
  try { localStorage.setItem(PREF, v ? "on" : "off"); } catch {}
  if (!v) try { speechSynthesis.cancel(); } catch {}
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** what the Sutradhar says for a beat everyone sees (null = stays quiet) */
function lineFor(b: Beat, names: string[]): string | null {
  const who = (s?: number) => (s === undefined ? "" : names[s]?.replace(/\s*🤖$/, "") ?? "");
  switch (b.type) {
    case "faisla": return pick(["फ़ैसला! सब बोलो — चोर कौन है?", "फ़ैसले की घड़ी आ गई!", "अब होगा फ़ैसला!"]);
    case "ballots_open": return pick(["वोट करो!", "अब वोट का समय है!"]);
    case "surrender_open": return "आख़िरी मौक़ा! जिसके पास पत्थर है, गाँव को सौंप दो।";
    case "surrender": return pick(["एक पत्थर गाँव को मिला!", "पत्थर सौंप दिया गया!"]);
    case "surrender_result": return null;
    case "final_vote": return "आख़िरी फ़ैसला! आज रात तय होगा, पत्थर किसके पास है।";
    case "talashi": return pick(["तलाशी! जेबें ख़ाली करो।", "तलाशी हो रही है!"]);
    case "kundli": return pick(["कुंडली खुल रही है…", "किसी की कुंडली पढ़ी जा रही है।"]);
    case "hera_pheri": return pick(["हेरा फेरी!", "पत्ते उड़ गए!"]);
    case "batwara": return pick(["भूकंप! सब हिलाओ!", "धरती हिल गई!"]);
    case "dal_badal": return `दल बदल! ${who(b.actor)} चोर निकला… अब कौन किसके साथ है?`;
    case "teer_kaman": return b.result === "hit" ? "निशाना सही लगा!" : "निशाना चूक गया!";
    case "eliminated": return b.tone === "relic" ? pick(["चोर पकड़ा गया!", "एक चोर गया!"]) : pick(["अरे! गाँव वाला निकला।", "गाँव ने अपना ही खो दिया।"]);
    case "over": return b.title.startsWith("Tunga") ? "तुंगा जीत गया! पत्थर गाँव में सुरक्षित हैं।" : "चोर जीत गए! पत्थर ले उड़े।";
    default: return null;
  }
}

let hiVoice: SpeechSynthesisVoice | null | undefined;
function voice(): SpeechSynthesisVoice | null {
  if (hiVoice !== undefined) return hiVoice;
  try {
    const vs = speechSynthesis.getVoices();
    if (!vs.length) return null; // not loaded yet — try again next time
    hiVoice = vs.find((v) => v.lang === "hi-IN") ?? vs.find((v) => v.lang.startsWith("hi")) ?? null;
  } catch { hiVoice = null; }
  return hiVoice;
}

export function narrate(b: Beat, names: string[]) {
  if (!on || b.private || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const text = lineFor(b, names);
  if (!text) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    const v = voice();
    if (v) u.voice = v;
    u.lang = "hi-IN";
    u.rate = 1.05; u.pitch = 0.9; u.volume = 0.9;
    speechSynthesis.cancel(); // the newest moment wins; never a backlog of announcements
    speechSynthesis.speak(u);
  } catch {}
}
