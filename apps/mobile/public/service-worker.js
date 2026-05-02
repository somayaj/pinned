/* global self */
/* Pin it — Web Push. OS shows banners outside the tab (not inside the page). */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {
    title: "Pin it",
    body: "Reminder",
    taskId: null,
  };
  try {
    if (event.data) {
      const t = event.data.text();
      if (t) Object.assign(payload, JSON.parse(t));
    }
  } catch (e) {
    console.error("[pinned-sw] push payload parse", e);
  }
  const title = payload.title || "Pin it";
  const body = payload.body || "You have a pin reminder";
  const origin = self.location.origin;
  const iconUrl = `${origin}/pin-it-logo.svg`;
  event.waitUntil(
    self.registration
      .showNotification(title, {
        body,
        icon: iconUrl,
        badge: iconUrl,
        tag: payload.taskId ? String(payload.taskId) : "pinned-reminder",
        renotify: true,
        requireInteraction: false,
        data: payload,
        vibrate: [180, 80, 180],
      })
      .catch((err) => console.error("[pinned-sw] showNotification", err))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
