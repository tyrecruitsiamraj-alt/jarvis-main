/**
 * Seed default users (idempotent). Run after db:migrate.
 * Password: SEED_USER_PASSWORD from env or default "ChangeMe123!" (change in production).
 *
 * Optional single real admin (ไม่ commit รหัส — ใส่ใน .env.local เท่านั้น):
 *   SEED_SOLE_ADMIN_EMAIL, SEED_SOLE_ADMIN_PASSWORD
 *   SEED_SOLE_ADMIN_NAME (optional)
 *   SEED_SOLE_ADMIN_DEMOTE_OTHERS=true (default) → ลด role ของ admin คนอื่นเป็น staff
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnvFromFiles() {
  const merged = { ...process.env };
  for (const name of [".env", ".env.local"]) {
    const p = path.join(root, name);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i <= 0) continue;
      const key = t.slice(0, i).trim();
      let val = t.slice(i + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      merged[key] = val;
    }
  }
  return merged;
}

const env = loadEnvFromFiles();
const databaseUrl = (env.DATABASE_URL || env.POSTGRES_URL || "").trim();
const pgSsl = ["true", "1", "yes"].includes(String(env.PG_SSL || "").toLowerCase());
const schema = String(env.PGSCHEMA || env.DATABASE_SCHEMA || "").trim();
const validSchema = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema) ? schema : "";

if (!databaseUrl) {
  console.error("Missing DATABASE_URL or POSTGRES_URL");
  process.exit(1);
}

const defaultPassword = (env.SEED_USER_PASSWORD || "ChangeMe123!").trim();

const users = [
  { email: "admin@example.com", role: "admin", full_name: "Admin User" },
  { email: "supervisor@example.com", role: "supervisor", full_name: "Supervisor User" },
  { email: "staff@example.com", role: "staff", full_name: "Staff User" },
];

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: pgSsl ? { rejectUnauthorized: false } : undefined,
  max: 1,
});

try {
  const client = await pool.connect();
  try {
    if (validSchema) {
      await client.query(`SET search_path TO "${validSchema}", public`);
    }
    const hash = await bcrypt.hash(defaultPassword, 12);
    for (const u of users) {
      const email = u.email.toLowerCase();
      await client.query(
        `
        INSERT INTO users (email, password_hash, role, full_name)
        VALUES (lower($1::text), $2, $3, $4)
        ON CONFLICT ((lower(email))) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          full_name = EXCLUDED.full_name,
          updated_at = now()
        `,
        [email, hash, u.role, u.full_name],
      );
      console.log("Seeded user:", email);
    }
    const soleEmail = (env.SEED_SOLE_ADMIN_EMAIL || "").trim().toLowerCase();
    const solePassword = (env.SEED_SOLE_ADMIN_PASSWORD || "").trim();
    const soleName = (env.SEED_SOLE_ADMIN_NAME || "").trim() || "Administrator";
    const demoteOthers = !["false", "0", "no"].includes(
      String(env.SEED_SOLE_ADMIN_DEMOTE_OTHERS || "true").toLowerCase().trim(),
    );

    if (soleEmail && solePassword) {
      if (solePassword.length < 8) {
        console.error("SEED_SOLE_ADMIN_PASSWORD must be at least 8 characters");
        process.exit(1);
      }
      const soleHash = await bcrypt.hash(solePassword, 12);
      await client.query(
        `
        INSERT INTO users (email, password_hash, role, full_name)
        VALUES (lower($1::text), $2, 'admin', $3)
        ON CONFLICT ((lower(email))) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          role = 'admin',
          full_name = EXCLUDED.full_name,
          updated_at = now()
        `,
        [soleEmail, soleHash, soleName],
      );
      console.log("Sole admin upserted:", soleEmail);
      if (demoteOthers) {
        const { rowCount } = await client.query(
          `
          UPDATE users
          SET role = 'staff', updated_at = now()
          WHERE role = 'admin' AND lower(email) <> lower($1::text)
          `,
          [soleEmail],
        );
        console.log("Demoted other admin users to staff:", rowCount);
      }
    } else if (soleEmail || solePassword) {
      console.warn("Set both SEED_SOLE_ADMIN_EMAIL and SEED_SOLE_ADMIN_PASSWORD to enable sole-admin bootstrap.");
    }

    console.log("Seed complete. Default password for all seeded users:", defaultPassword);
  } finally {
    client.release();
  }
} catch (e) {
  console.error("Seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
} finally {
  await pool.end();
}
