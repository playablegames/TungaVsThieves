// LiveKit voice (research 2026-10-07: a phone-to-phone mesh won't hold 8-12 players on mobile; an SFU sends each voice
// once and lets the SERVER decide who hears whom). Each seated player gets short-lived passes:
//   everyone → the table room. A player who is out (designer 2026-10-12) gets a LISTEN-ONLY pass (listenPass): they
//   hear everything and see everything, and speak only in their last words. (The old Gone room is unused.)
// Off until LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET are set; the phones then use the old mesh voice.
import { createHash } from "node:crypto";
import { AccessToken } from "livekit-server-sdk";

export const livekitConfigured = () =>
  Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);

const TTL = "6h";

async function pass(room: string, identity: string, name: string, speak: boolean): Promise<string> {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!, { identity, name, ttl: TTL });
  at.addGrant({ room, roomJoin: true, canPublish: speak, canPublishData: false, canSubscribe: true });
  return at.toJwt();
}

/** (designer 2026-10-12) a player who is out: hears the table, can never publish */
export async function listenPass(code: string, seat: number, name: string, playerToken: string): Promise<string> {
  const id = `s${seat}-${createHash("sha256").update(playerToken).digest("hex").slice(0, 8)}`;
  return pass(`tunga-${code}`, id, name, false);
}

export interface VoicePasses { url: string; table: string; gone: string | null; alive: boolean }

/** identity = "s<seat>-<player>": the seat so every phone can map a voice to a seat, the player part so two people can
 *  never share one (seats are re-shuffled when the game starts — a seat-only identity would knock someone out) */
export async function voicePasses(code: string, seat: number, name: string, alive: boolean, playerToken: string): Promise<VoicePasses> {
  const id = `s${seat}-${createHash("sha256").update(playerToken).digest("hex").slice(0, 8)}`;
  const base = `tunga-${code}`;
  return {
    url: process.env.LIVEKIT_URL!,
    table: await pass(base, id, name, alive),
    gone: alive ? null : await pass(`${base}-gone`, id, name, true),
    alive,
  };
}
