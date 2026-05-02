import type { Task } from "../types/task";

export function isPinTask(task: Task): boolean {
  return (
    task.latitude != null &&
    task.longitude != null &&
    task.radiusMeters != null
  );
}
