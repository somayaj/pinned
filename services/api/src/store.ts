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
  created_at: Date;
}): Task {
  return {
    id: row.id,
    title: row.title,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    radiusMeters: row.radius_meters,
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
    created_at: Date;
  }>(
    `SELECT id, title, latitude, longitude, radius_meters, created_at
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
    created_at: Date;
  }>(
    `SELECT id, title, latitude, longitude, radius_meters, created_at
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
    created_at: Date;
  }>(
    `INSERT INTO tasks (id, user_id, title, latitude, longitude, radius_meters)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, title, latitude, longitude, radius_meters, created_at`,
    [id, userId, input.title.trim(), input.latitude, input.longitude, radiusMeters]
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

export async function pingDb(): Promise<boolean> {
  await pool.query("SELECT 1");
  return true;
}
