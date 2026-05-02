import { distanceMeters } from "./geo.js";
import type { Task } from "./types.js";

function isPinTask(task: Task): boolean {
  return (
    task.latitude != null &&
    task.longitude != null &&
    task.radiusMeters != null
  );
}

/**
 * - **center** — pin tasks whose center lies within `radiusMeters` of the given point
 *   (“everything I saved near this place”).
 * - **containsPoint** — pin tasks whose geofence circle contains the given point
 *   (“which reminders apply at this GPS fix”).
 * When both are set, a task must satisfy both.
 */
export function filterTasksByLocation(
  tasks: Task[],
  opts: {
    center?: { lat: number; lon: number; radiusMeters: number };
    containsPoint?: { lat: number; lon: number };
  }
): Task[] {
  let out = tasks;
  if (opts.center) {
    const { lat, lon, radiusMeters } = opts.center;
    out = out.filter((t) => {
      if (!isPinTask(t)) return false;
      return (
        distanceMeters(lat, lon, t.latitude as number, t.longitude as number) <=
        radiusMeters
      );
    });
  }
  if (opts.containsPoint) {
    const { lat, lon } = opts.containsPoint;
    out = out.filter((t) => {
      if (!isPinTask(t)) return false;
      const d = distanceMeters(
        lat,
        lon,
        t.latitude as number,
        t.longitude as number
      );
      return d <= (t.radiusMeters as number);
    });
  }
  return out;
}
