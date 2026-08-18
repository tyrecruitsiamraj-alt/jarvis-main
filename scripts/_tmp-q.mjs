import fs from "fs"; import path from "path"; import { fileURLToPath } from "url"; import sql from "mssql";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const name of [".env", ".env.local"]) { const p = path.join(root, name); if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("="); if (i <= 0) continue; process.env[t.slice(0,i).trim()] = t.slice(i+1).trim().replace(/^["']|["']$/g, ""); } }
