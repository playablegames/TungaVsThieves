// Turn alerts (2026-10-09): the server sends a web push when it's your move and your phone isn't showing the game.
// Tapping the notification brings the game back (or opens it).
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "Tunga vs Thieves", body: event.data && event.data.text() }; }
  event.waitUntil(self.registration.showNotification(d.title || "Tunga vs Thieves", {
    body: d.body || "Your move",
    tag: d.tag || "tunga-turn",
    renotify: true,
    icon: "/icon.png",
    badge: "/icon.png",
    vibrate: [80, 50, 80],
    data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) if (new URL(c.url).pathname === new URL(url, self.location.origin).pathname && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  })());
});
