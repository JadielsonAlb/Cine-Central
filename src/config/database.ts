import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const database = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000
});