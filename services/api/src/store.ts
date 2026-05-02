import { nanoid } from "nanoid";
import type { GoogleProfile } from "./auth/googleVerify.js";
import type { Task } from "./types.js";
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
  latitude: string | number;
  longitude: string | number;
  radius_meters: number;
  remind_at: Date | null;
  created_at: Date;
}): Task {
  return {
    id: row.id,
    title: row.title,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMeters: row.radius_meters,
    remindAt: row.remind_at ? row.remind_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

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

export async function listTasks(userId: string): Promise<Task[]> {
  const result = await pool.query<{
    id: string;
    title: string;
    latitude: string;
    longitude: string;
    radius_meters: number;
    remind_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, title, latitude, longitude, radius_meters, remind_at, created_at
     FROM tasks
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
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
    latitude: string;
    longitude: string;
    radius_meters: number;
    remind_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, title, latitude, longitude, radius_meters, remind_at, created_at
     FROM tasks WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  const row = result.rows[0];
  return row ? rowToTask(row) : undefined;
}

export async function createTask(
  userId: string,
  input: {
    title: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    remindAt: Date | null;
  }
): Promise<Task> {
  const id = nanoid();
  const radiusMeters = Math.max(10, Math.round(input.radiusMeters));
  const result = await pool.query<{
    id: string;
    title: string;
    latitude: string;
    longitude: string;
    radius_meters: number;
    remind_at: Date | null;
    created_at: Date;
  }>(
    `INSERT INTO tasks (id, user_id, title, latitude, longitude, radius_meters, remind_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, title, latitude, longitude, radius_meters, remind_at, created_at`,
    [
      id,
      userId,
      input.title.trim(),
      input.latitude,
      input.longitude,
      radiusMeters,
      input.remindAt,
    ]
  );
  return rowToTask(result.rows[0]);
}

export async function deleteTask(userId: string, id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM tasks WHERE id = $1 AND user_id = $2`,
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

export async function pingDb(): Promise<boolean> {
  await pool.query("SELECT 1");
  return true;
}
