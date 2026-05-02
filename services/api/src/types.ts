export interface Task {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  /** ISO 8601 — reminder only after this instant (in zone). Null = any time. */
  remindAt: string | null;
  createdAt: string;
}

export type WsOutboundMessage =
  | { type: "task_alert"; task: Task; reason: string }
  | { type: "tasks_updated"; tasks: Task[] }
  | { type: "connected"; clientId: string };
