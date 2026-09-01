import fs from "fs"; import path from "path"; import pg from "pg";
const root = process.cwd();
const env = { ...process.env };
for (const name of [".env", ".env.local"]) {
  const p = path.join(root, name); if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim(); if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("="); if (i <= 0) continue;
    let v = t.slice(i+1).trim();
    if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
    env[t.slice(0,i).trim()] = v;
  }
}
const c = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(process.argv[2]);
console.log(JSON.stringify(r.rows, null, 1));
await c.end();
