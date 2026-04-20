/**
 * One-off: fetch province + district JSON (UTF-8) and write
 * src/data/thaiDistrictsByProvince.json — Record<provinceNameThai, districtNameThai[]>
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
  });
}

const base = 'https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/latest';
const prov = await fetchJson(`${base}/province.json`);
const dist = await fetchJson(`${base}/district.json`);

const idToName = new Map(prov.filter((p) => !p.deleted_at).map((p) => [p.id, p.name_th]));
const byProvince = new Map();
for (const p of prov) {
  if (!p.deleted_at) byProvince.set(p.name_th, []);
}
for (const d of dist) {
  if (d.deleted_at) continue;
  const pn = idToName.get(d.province_id);
  if (!pn) continue;
  byProvince.get(pn).push(d.name_th);
}
for (const arr of byProvince.values()) {
  arr.sort((a, b) => a.localeCompare(b, 'th'));
}
const out = Object.fromEntries([...byProvince.entries()].sort((a, b) => a[0].localeCompare(b[0], 'th')));

const outPath = path.join(root, 'src', 'data', 'thaiDistrictsByProvince.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out), { encoding: 'utf8' });
console.log('Wrote', outPath, 'provinces', Object.keys(out).length);
