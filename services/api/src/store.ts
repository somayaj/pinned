import { nanoid } from "nanoid";
import type { Task } from "./types.js";
import { pool } from "./db/pool.js";

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

export async function listTasks(): Promise<Task[]> {
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
     ORDER BY created_at DESC`
  );
  return result.rows.map(rowToTask);
}

export async function getTask(id: string): Promise<Task | undefined> {
  const result = await pool.query<{
    id: string;
    title: string;
    latitude: string;
    longitude: string;
    radius_meters: number;
    created_at: Date;
  }>(
    `SELECT id, title, latitude, longitude, radius_meters, created_at
     FROM tasks WHERE id = $1`,
    [id]
  );
  const row = result.rows[0];
  return row ? rowToTask(row) : undefined;
}

export async function createTask(input: {
  title: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}): Promise<Task> {
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
    `INSERT INTO tasks (id, title, latitude, longitude, radius_meters)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, latitude, longitude, radius_meters, created_at`,
    [id, input.title.trim(), input.latitude, input.longitude, radiusMeters]
  );
  return rowToTask(result.rows[0]);
}

export async function deleteTask(id: string): Promise<boolean> {
  const result = await pool.query(`DELETE FROM tasks WHERE id = $1`, [id]);
  return result.rowCount !== null && result.rowCount > 0;
}

export async function pingDb(): Promise<boolean> {
  await pool.query("SELECT 1");
  return true;
}
