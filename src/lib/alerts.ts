"use client";
// TURN ALERTS (2026-10-09): the phone subscribes to web push; while it is switched away from the game it tells the
// server so, and the server pushes "Your turn" / "Vote now". iPhones only allow it once the game is on the Home Screen.
import { useEffect } from "react";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type AlertSupport = "yes" | "home-screen" | "no";
export function alertSupport(): AlertSupport {
  if (typeof window === "undefined" || !KEY) return "no";
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) return "yes";
  // iPhone Safari outside the Home Screen: push exists only for installed web apps
  return /iPhone|iPad/.test(navigator.userAgent) ? "home-screen" : "no";
}

const post = (code: string, token: string, body: unknown) =>
  fetch(`/api/games/${code}/alerts`, { method: "POST", keepalive: true, headers: { "Content-Type": "application/json", "x-player-token": token }, body: JSON.stringify(body) });

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** asks the browser (a tap must start this), subscribes, and tells the table. Returns whether alerts are on. */
export async function enableAlerts(code: string, token: string): Promise<boolean> {
  if (alertSupport() !== "yes") return false;
  const reg = await navigator.serviceWorker.register("/sw.js");
  if ((await Notification.requestPermission()) !== "granted") return false;
  const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) });
  const r = await post(code, token, { sub: sub.toJSON(), hidden: document.hidden });
  return r.ok;
}

export async function disableAlerts(code: string, token: string) {
  await post(code, token, { sub: null });
}

/** while alerts are on: tell the table when this phone switches away from the game, and when it comes back */
export function useAlertPresence(code: string, token: string | null, on: boolean) {
  useEffect(() => {
    if (!on || !token) return;
    const send = () => { post(code, token, { hidden: document.hidden }).catch(() => {}); };
    const away = () => { post(code, token, { hidden: true }).catch(() => {}); };
    document.addEventListener("visibilitychange", send);
    window.addEventListener("pagehide", away);
    return () => { document.removeEventListener("visibilitychange", send); window.removeEventListener("pagehide", away); };
  }, [code, token, on]);
}
