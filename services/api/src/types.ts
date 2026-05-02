/** A saved place (map zone). Tasks can be attached to a location. */
export interface Location {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  /** Optional extra detail for map pins (nickname); null for time-only or unset. */
  description: string | null;
  /** When set, lat/lon/radius are resolved from this location. */
  locationId: string | null;
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
