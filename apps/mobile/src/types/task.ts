export interface Task {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  /** ISO 8601 — only remind after this moment when in the zone. Null/omit = any time. */
  remindAt?: string | null;
  createdAt: string;
}
