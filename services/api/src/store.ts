import { nanoid } from "nanoid";
import type { GoogleProfile } from "./auth/googleVerify.js";
import type { Location, Task } from "./types.js";
import { pool } from "./db/pool.js";

export type AppUser = {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
};

function rowToTask(row: {
  id: string;
  title: string;
  description: string | null;
  location_id: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  radius_meters: number | null;
  remind_at: Date | null;
  created_at: Date;
}): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    locationId: row.location_id ?? null,
    latitude:
      row.latitude === null || row.latitude === undefined
        ? null
        : Number(row.latitude),
    longitude:
      row.longitude === null || row.longitude === undefined
        ? null
        : Number(row.longitude),
    radiusMeters: row.radius_meters,
    remindAt: row.remind_at ? row.remind_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

function rowToLocation(row: {
  id: string;
  name: string;
  description: string | null;
  latitude: string | number;
  longitude: string | number;
  radius_meters: number;
  created_at: Date;
}): Location {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMeters: row.radius_meters,
    createdAt: row.created_at.toISOString(),
  };
}

const taskSelect = `
  SELECT
    t.id,
    t.title,
    t.description,
    t.location_id,
    t.remind_at,
    t.created_at,
    COALESCE(l.latitude, t.latitude) AS latitude,
    COALESCE(l.longitude, t.longitude) AS longitude,
    COALESCE(l.radius_meters, t.radius_meters) AS radius_meters
  FROM tasks t
  LEFT JOIN locations l ON l.id = t.location_id
`;

export async function findOrCreateUserFromGoogle(
  profile: GoogleProfile
): Promise<AppUser> {
  const found = await pool.query<{
    id: string;
    email: string | null;
    name: string | null;
    picture: string | null;
  }>(`SELECT id, email, name, picture FROM users WHERE google_sub = $1`, [
    profile.googleSub,
  ]);
  const row = found.rows[0];
  if (row) {
    await pool.query(
      `UPDATE users SET
         email = COALESCE($1, email),
         name = COALESCE($2, name),
         picture = COALESCE($3, picture)
       WHERE id = $4`,
      [profile.email, profile.name, profile.picture, row.id]
    );
    return {
      id: row.id,
      email: profile.email ?? row.email,
      name: profile.name ?? row.name,
      picture: profile.picture ?? row.picture,
    };
  }
  const id = nanoid();
  await pool.query(
    `INSERT INTO users (id, google_sub, email, name, picture)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, profile.googleSub, profile.email, profile.name, profile.picture]
  );
  return {
    id,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  };
}

export async function listTasks(
  userId: string,
  opts?: { locationId?: string }
): Promise<Task[]> {
  const hasLoc = opts?.locationId != null && opts.locationId !== "";
  const result = await pool.query<{
    id: string;
    title: string;
    description: string | null;
    location_id: string | null;
    latitude: string | null;
    longitude: string | null;
    radius_meters: number | null;
    remind_at: Date | null;
    created_at: Date;
  }>(
    hasLoc
      ? `${taskSelect}
         WHERE t.user_id = $1 AND t.location_id = $2
         ORDER BY t.created_at DESC`
      : `${taskSelect}
         WHERE t.user_id = $1
         ORDER BY t.created_at DESC`,
    hasLoc ? [userId, opts!.locationId] : [userId]
  );
  return result.rows.map(rowToTask);
}

export async function getTask(
  userId: string,
  id: string
): Promise<Task | undefined> {
  const result = await pool.query<{
    id: string;
    title: string;
    description: string | null;
    location_id: string | null;
    latitude: string | null;
    longitude: string | null;
    radius_meters: number | null;
    remind_at: Date | null;
    created_at: Date;
  }>(
    `${taskSelect}
     WHERE t.id = $1 AND t.user_id = $2`,
    [id, userId]
  );
  const row = result.rows[0];
  return row ? rowToTask(row) : undefined;
}

export async function createTask(
  userId: string,
  input: {
    title: string;
    description: string | null;
    remindAt: Date | null;
    locationId?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters?: number | null;
  }
): Promise<Task> {
  const id = nanoid();
  const desc =
    input.description == null || input.description.trim() === ""
      ? null
      : input.description.trim();

  if (input.locationId != null && input.locationId !== "") {
    const own = await pool.query<{ n: string }>(
      `SELECT id AS n FROM locations WHERE id = $1 AND user_id = $2`,
      [input.locationId, userId]
    );
    if (own.rows.length === 0) {
      throw new Error("location_not_found");
    }
    const result = await pool.query<{
      id: string;
      title: string;
      description: string | null;
      location_id: string | null;
      latitude: string | null;
      longitude: string | null;
      radius_meters: number | null;
      remind_at: Date | null;
      created_at: Date;
    }>(
      `INSERT INTO tasks (id, user_id, location_id, title, description, latitude, longitude, radius_meters, remind_at)
       VALUES ($1, $2, $3, $4, $5, NULL, NULL, NULL, $6)
       RETURNING id, title, description, location_id, latitude, longitude, radius_meters, remind_at, created_at`,
      [id, userId, input.locationId, input.title.trim(), desc, input.remindAt]
    );
    const full = await pool.query<{
      id: string;
      title: string;
      description: string | null;
      location_id: string | null;
      latitude: string | null;
      longitude: string | null;
      radius_meters: number | null;
      remind_at: Date | null;
      created_at: Date;
    }>(
      `${taskSelect} WHERE t.id = $1`,
      [result.rows[0].id]
    );
    return rowToTask(full.rows[0]);
  }

  const radiusMeters =
    input.radiusMeters == null
      ? null
      : Math.max(10, Math.round(input.radiusMeters));
  const result = await pool.query<{
    id: string;
    title: string;
    description: string | null;
    location_id: string | null;
    latitude: string | null;
    longitude: string | null;
    radius_meters: number | null;
    remind_at: Date | null;
    created_at: Date;
  }>(
    `INSERT INTO tasks (id, user_id, location_id, title, description, latitude, longitude, radius_meters, remind_at)
     VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8)
     RETURNING id, title, description, location_id, latitude, longitude, radius_meters, remind_at, created_at`,
    [
      id,
      userId,
      input.title.trim(),
      desc,
      input.latitude,
      input.longitude,
      radiusMeters,
      input.remindAt,
    ]
  );
  const full = await pool.query<{
    id: string;
    title: string;
    description: string | null;
    location_id: string | null;
    latitude: string | null;
    longitude: string | null;
    radius_meters: number | null;
    remind_at: Date | null;
    created_at: Date;
  }>(`${taskSelect} WHERE t.id = $1`, [result.rows[0].id]);
  return rowToTask(full.rows[0]);
}

export async function deleteTask(userId: string, id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM tasks WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

/** Deletes every task for the user. Locations are unchanged. */
export async function deleteAllTasksForUser(userId: string): Promise<number> {
  const result = await pool.query(`DELETE FROM tasks WHERE user_id = $1`, [
    userId,
  ]);
  return result.rowCount ?? 0;
}

export async function listLocations(userId: string): Promise<Location[]> {
  const result = await pool.query<{
    id: string;
    name: string;
    description: string | null;
    latitude: string;
    longitude: string;
    radius_meters: number;
    created_at: Date;
  }>(
    `SELECT id, name, description, latitude, longitude, radius_meters, created_at
     FROM locations
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map(rowToLocation);
}

export async function createLocation(
  userId: string,
  input: {
    name: string;
    description: string | null;
    latitude: number;
    longitude: number;
    radiusMeters: number;
  }
): Promise<Location> {
  const id = nanoid();
  const r = Math.max(10, Math.round(input.radiusMeters));
  const result = await pool.query<{
    id: string;
    name: string;
    description: string | null;
    latitude: string;
    longitude: string;
    radius_meters: number;
    created_at: Date;
  }>(
    `INSERT INTO locations (id, user_id, name, description, latitude, longitude, radius_meters)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, description, latitude, longitude, radius_meters, created_at`,
    [
      id,
      userId,
      input.name.trim(),
      input.description,
      input.latitude,
      input.longitude,
      r,
    ]
  );
  return rowToLocation(result.rows[0]);
}

export async function deleteLocation(
  userId: string,
  id: string
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM locations WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export type WebPushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function upsertWebPushSubscription(
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string }
): Promise<void> {
  const id = nanoid();
  await pool.query(
    `INSERT INTO web_push_subscriptions (id, user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth`,
    [id, userId, input.endpoint, input.p256dh, input.auth]
  );
}

export async function listWebPushSubscriptions(
  userId: string
): Promise<WebPushSubscriptionRow[]> {
  const r = await pool.query<WebPushSubscriptionRow>(
    `SELECT endpoint, p256dh, auth FROM web_push_subscriptions WHERE user_id = $1`,
    [userId]
  );
  return r.rows;
}

export async function deleteWebPushSubscriptionByEndpoint(
  endpoint: string
): Promise<void> {
  await pool.query(`DELETE FROM web_push_subscriptions WHERE endpoint = $1`, [
    endpoint,
  ]);
}

export async function deleteAllWebPushSubscriptionsForUser(
  userId: string
): Promise<void> {
  await pool.query(`DELETE FROM web_push_subscriptions WHERE user_id = $1`, [
    userId,
  ]);
}

export type UserSmsSettings = {
  phoneE164: string | null;
  smsAlerts: boolean;
};

export async function getUserSmsSettings(
  userId: string
): Promise<UserSmsSettings> {
  const r = await pool.query<{
    phone_e164: string | null;
    sms_alerts: boolean;
  }>(
    `SELECT phone_e164, COALESCE(sms_alerts, false) AS sms_alerts
     FROM users WHERE id = $1`,
    [userId]
  );
  const row = r.rows[0];
  return {
    phoneE164: row?.phone_e164 ?? null,
    smsAlerts: row?.sms_alerts ?? false,
  };
}

export type UserProfile = AppUser & UserSmsSettings;

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const r = await pool.query<{
    id: string;
    email: string | null;
    name: string | null;
    picture: string | null;
    phone_e164: string | null;
    sms_alerts: boolean;
  }>(
    `SELECT id, email, name, picture, phone_e164, COALESCE(sms_alerts, false) AS sms_alerts
     FROM users WHERE id = $1`,
    [userId]
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error("user_not_found");
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    phoneE164: row.phone_e164,
    smsAlerts: row.sms_alerts,
  };
}

const e164 = /^\+[1-9]\d{7,14}$/;

function normalizePhone(raw: string | null): string | null {
  if (raw == null || raw.trim() === "") return null;
  const t = raw.trim();
  return e164.test(t) ? t : null;
}

export async function updateUserProfile(
  userId: string,
  input: { phoneE164: string | null; smsAlerts: boolean }
): Promise<void> {
  const phone = normalizePhone(input.phoneE164);
  if (input.phoneE164 != null && input.phoneE164.trim() !== "" && phone === null) {
    throw new Error("invalid_phone_e164");
  }
  const smsOn = Boolean(input.smsAlerts && phone);
  await pool.query(
    `UPDATE users SET phone_e164 = $2, sms_alerts = $3 WHERE id = $1`,
    [userId, phone, smsOn]
  );
}

export async function pingDb(): Promise<boolean> {
  await pool.query("SELECT 1");
  return true;
}
