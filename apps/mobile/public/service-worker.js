/* global self */
self.addEventListener("push", (event) => {
  let payload = {
    title: "Pinned",
    body: "Reminder",
    taskId: null,
  };
  try {
    if (event.data) {
      const t = event.data.text();
      if (t) Object.assign(payload, JSON.parse(t));
    }
  } catch (_) {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Pinned", {
      body: payload.body || "",
      tag: payload.taskId ? String(payload.taskId) : "pinned-reminder",
      data: payload,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow("/"));
});
