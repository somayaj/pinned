export interface Task {
  id: string;
  title: string;
  /** Extra detail for map pins; optional. */
  description?: string | null;
  /** When set, coordinates come from this saved location. */
  locationId?: string | null;
  /** Map pin; null for time-only reminders. */
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  /** Pin: optional “not before” in zone. Time-only: when reminders start. */
  remindAt?: string | null;
  createdAt: string;
}
