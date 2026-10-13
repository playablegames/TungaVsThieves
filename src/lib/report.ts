"use client";
// Reports from the phone (release checklist 2026-10-14): crashes it catches by itself, and problems a player types.
// The game code comes from the URL (/g/<code>); nothing else about the player is sent.
let sent = 0;
const codeHere = () => (typeof location !== "undefined" ? location.pathname.match(/^\/g\/([A-Za-z0-9]+)/)?.[1] ?? null : null);

export function report(kind: "crash" | "player", text: string, where = "") {
  if (kind === "crash" && ++sent > 5) return Promise.resolve(); // one bad loop never floods the server
  return fetch("/api/report", {
    method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
    body: JSON.stringify({ kind, code: codeHere(), text: text.slice(0, 2000), where: where || (typeof location !== "undefined" ? location.pathname : "") }),
  }).then(() => undefined).catch(() => undefined);
}

export const crashText = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}\n${(e.stack ?? "").split("\n").slice(0, 6).join("\n")}` : String(e));
