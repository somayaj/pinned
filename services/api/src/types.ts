export interface Task {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  createdAt: string;
}

export type WsOutboundMessage =
  | { type: "task_alert"; task: Task; reason: string }
  | { type: "tasks_updated"; tasks: Task[] }
  | { type: "connected"; clientId: string };
