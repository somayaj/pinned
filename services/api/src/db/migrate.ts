import { pool } from "./pool.js";

export async function migrate(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      google_sub TEXT NOT NULL UNIQUE,
      email TEXT,
      name TEXT,
      picture TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS users_google_sub_idx ON users (google_sub);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      radius_meters INTEGER NOT NULL CHECK (radius_meters >= 10 AND radius_meters <= 50000),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks (created_at DESC);
  `);

  const col = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'user_id'
     ) AS exists`
  );
  if (!col.rows[0]?.exists) {
    await pool.query(`
      ALTER TABLE tasks
      ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE
    `);
  }

  await pool.query(`DELETE FROM tasks WHERE user_id IS NULL`);

  await pool.query(`
    ALTER TABLE tasks ALTER COLUMN user_id SET NOT NULL
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS tasks_user_created_idx ON tasks (user_id, created_at DESC);
  `);

  const remindCol = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'remind_at'
     ) AS exists`
  );
  if (!remindCol.rows[0]?.exists) {
    await pool.query(`
      ALTER TABLE tasks
      ADD COLUMN remind_at TIMESTAMPTZ
    `);
  }

  /** Time-only reminders: no map pin — lat/lon/radius NULL, remind_at required. */
  const pinOrTime = await pool.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'tasks_pin_or_time'
     ) AS exists`
  );
  if (!pinOrTime.rows[0]?.exists) {
    await pool.query(`
      ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_radius_meters_check
    `);
    await pool.query(`
      ALTER TABLE tasks ALTER COLUMN latitude DROP NOT NULL
    `);
    await pool.query(`
      ALTER TABLE tasks ALTER COLUMN longitude DROP NOT NULL
    `);
    await pool.query(`
      ALTER TABLE tasks ALTER COLUMN radius_meters DROP NOT NULL
    `);
    await pool.query(`
      ALTER TABLE tasks ADD CONSTRAINT tasks_radius_meters_valid CHECK (
        radius_meters IS NULL OR (radius_meters >= 10 AND radius_meters <= 50000)
      )
    `);
    await pool.query(`
      ALTER TABLE tasks ADD CONSTRAINT tasks_pin_or_time CHECK (
        (latitude IS NOT NULL AND longitude IS NOT NULL AND radius_meters IS NOT NULL)
        OR
        (latitude IS NULL AND longitude IS NULL AND radius_meters IS NULL AND remind_at IS NOT NULL)
      )
    `);
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS web_push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS web_push_user_idx ON web_push_subscriptions (user_id);
  `);
}
