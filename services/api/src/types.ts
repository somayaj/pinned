export interface Task {
  id: string;
  title: string;
  /** Map pin center; null for time-only reminders (no geofence). */
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  /** ISO 8601 — for pins: optional “not before” when in zone; for time-only: when to start nudging. */
  remindAt: string | null;
  createdAt: string;
}

export type WsOutboundMessage =
  | { type: "task_alert"; task: Task; reason: string }
  | { type: "tasks_updated"; tasks: Task[] }
  | { type: "connected"; clientId: string };
