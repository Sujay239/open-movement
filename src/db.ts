import dotenv from "dotenv";
import pkg from "pg";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "..", ".env"),
});

const { Pool } = pkg;

console.log("DB CONFIG:", {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
});

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root",
  database: process.env.DB_NAME || "openmovement",
});
