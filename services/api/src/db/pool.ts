import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set (e.g. postgresql://user:pass@localhost:5432/pinned)");
}

export const pool = new pg.Pool({
  connectionString,
  max: 10,
});
