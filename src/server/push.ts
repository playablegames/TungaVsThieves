// Turn alerts (2026-10-09): web push to a phone that has switched away from the game when it's that player's move.
// Off until NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are set (Vercel env). The subscription
// lives on the player's lobby seat — no table change. A dead subscription (404/410) is dropped.
import webpush, { type PushSubscription } from "web-push";

const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, priv = process.env.VAPID_PRIVATE_KEY, subject = process.env.VAPID_SUBJECT;
export const pushConfigured = Boolean(pub && priv && subject);
if (pushConfigured) webpush.setVapidDetails(subject!, pub!, priv!);

export interface Alert { title: string; body: string; url: string; tag: string }

/** true = delivered (or not configured); false = the subscription is gone and should be forgotten */
export async function sendPush(sub: PushSubscription, a: Alert): Promise<boolean> {
  if (!pushConfigured) return true;
  try {
    await webpush.sendNotification(sub, JSON.stringify(a), { TTL: 120, urgency: "high" });
    return true;
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return !(code === 404 || code === 410);
  }
}
