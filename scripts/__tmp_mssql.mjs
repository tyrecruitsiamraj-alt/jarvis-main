import fs from 'fs'; import path from 'path'; import sql from 'mssql';
const root = process.cwd(); const env = { ...process.env };
for (const name of ['.env', '.env.local']) {
  const p = path.join(root, name); if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('='); if (i <= 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
    env[t.slice(0,i).trim()] = v;
  }
}
const host = env.DB_HOST.trim();
const [server, portStr] = host.includes(',') ? host.split(',') : [host, env.DB_PORT || '1433'];
const pool = await sql.connect({ server, port: Number(portStr)||1433, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, options: { encrypt: false, trustServerCertificate: true }, requestTimeout: 60000 });
const r = await pool.request().query(fs.readFileSync(process.argv[2],'utf8'));
console.log(JSON.stringify(r.recordset));
await pool.close();
