// TURN relay credentials for table voice. Phones on mobile data sit behind carrier NAT, where direct
// phone-to-phone audio often fails; a TURN relay carries it instead. Vercel can't relay (no long-lived
// UDP), so the relay is a free managed one and this only hands out short-lived credentials — the
// provider's secret never reaches a phone.
// Any mix of these may be set; phones get every configured relay and use whichever connects:
//   Static TURN (ExpressTURN free 1,000 GB/month, no card; or your own coturn):
//     TURN_URLS (comma-separated, e.g. "turn:relay1.expressturn.com:3478,turn:relay1.expressturn.com:443?transport=tcp")
//     + TURN_USERNAME + TURN_CREDENTIAL — only seated players receive them
//   metered.ca Open Relay (20 GB/month free, no card): METERED_TURN_APP (e.g. "tunga") + METERED_TURN_API_KEY
//   Cloudflare Realtime TURN (1,000 GB/month free, card required): CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN
// With none set, phones get public STUN only (fine on the same Wi-Fi / most home networks).

const STUN: RTCIceServer[] = [{ urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] }];
const TTL_S = 6 * 3600;
const REUSE_MS = 60 * 60 * 1000; // one credential set per hour is plenty for every table

let cache: { at: number; servers: RTCIceServer[] } | null = null;

// browsers block port 53, and a TURN URL on it only times out
const noPort53 = (s: RTCIceServer): RTCIceServer => ({
  ...s,
  urls: (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => !/:53(\?|$)/.test(u)),
});

async function cloudflare(): Promise<RTCIceServer[]> {
  const key = process.env.CLOUDFLARE_TURN_KEY_ID, token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!key || !token) return [];
  const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${key}/credentials/generate-ice-servers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl: TTL_S }),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`Cloudflare TURN ${r.status}`);
  return ((await r.json()) as { iceServers: RTCIceServer[] }).iceServers.filter((s) => [s.urls].flat().some((u) => u.startsWith("turn")));
}

async function metered(): Promise<RTCIceServer[]> {
  const app = process.env.METERED_TURN_APP, key = process.env.METERED_TURN_API_KEY;
  if (!app || !key) return [];
  const r = await fetch(`https://${app}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`, { cache: "no-store" });
  if (!r.ok) throw new Error(`Metered TURN ${r.status}`);
  return ((await r.json()) as RTCIceServer[]).filter((s) => [s.urls].flat().some((u) => u.startsWith("turn")));
}

function staticTurn(): RTCIceServer[] {
  const urls = process.env.TURN_URLS?.split(",").map((u) => u.trim()).filter(Boolean);
  if (!urls?.length) return [];
  return [{ urls, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL }];
}

/** Every configured relay; one provider failing never takes the others (or STUN) down. */
async function fetchServers(): Promise<RTCIceServer[]> {
  const results = await Promise.allSettled([cloudflare(), metered()]);
  results.forEach((r) => { if (r.status === "rejected") console.error(r.reason); });
  const relays = [...staticTurn(), ...results.flatMap((r) => (r.status === "fulfilled" ? r.value : []))];
  return [...STUN, ...relays.map(noPort53)];
}

export async function iceServers(): Promise<{ iceServers: RTCIceServer[]; relay: boolean }> {
  if (!cache || Date.now() - cache.at > REUSE_MS) {
    const servers = await fetchServers();
    const relay = servers.some((s) => [s.urls].flat().some((u) => u.startsWith("turn")));
    // only keep a set that has a relay — if every provider was down, ask again next time
    if (!relay) return { iceServers: servers, relay };
    cache = { at: Date.now(), servers };
  }
  return { iceServers: cache.servers, relay: true };
}
