/**
 * ═══ จัดช่องทางรับสมัครเหลือ 4 หลัก (เจ้าของ 28 ต.ค. 2569 สั่งตรง ๆ พร้อมลิสต์) ═══
 *
 *   npx tsx scripts/channels-four-mains-2569-10-28.mts          ดูอย่างเดียว ไม่เขียน
 *   npx tsx scripts/channels-four-mains-2569-10-28.mts --apply  เขียนจริง (ธุรกรรมเดียว)
 *
 * หลัก → รอง ตามที่เจ้าของพิมพ์มา · ใช้แถวเดิมด้วยชื่อ (ไม่ลบ ไม่สร้างซ้ำ — id เดิมยังผูกใบสมัคร/ลิงก์เก่า)
 * ชื่อในลิสต์ที่สะกดต่างจากของเดิม (Facebbok Ads · JobDb · Jonfinfin · Linkin) = แถวเดิม Facebook Ads · JobsDB · Jobfinfin · LinkedIn
 * ช่องทางหลักเดิมที่ไม่อยู่ในลิสต์ (Call in · Lemon8) = ปิดใช้งาน ไม่ลบ (ข้อมูลเก่ายังอ่านชื่อได้)
 * ⚠️ รัน `import-recruit-channels.mts` ซ้ำจะดึงโครงเก่าจาก iRecruit กลับมา — ถ้ารันต้องจัดใหม่
 * ทำซ้ำได้ ผลเท่าเดิม · แก้ทีหลังได้ที่หน้า /recruit/channels (ตัวเลือก "ย้ายไปอยู่ใต้")
 */
import '../server/bootstrap-env.js';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const schema = (process.env.PGSCHEMA || process.env.DATABASE_SCHEMA || 'jarvis_rm').trim();
const T = `"${schema}".recruit_channels`;

/** ชื่อในลิสต์ → ชื่อแถวเดิม (ไม่มีในนี้ = ใช้ชื่อตามลิสต์) */
const PLAN: Array<{ main: string; children: string[] }> = [
  { main: 'Facebook', children: ['Facebook Ads', 'Facebook Group', 'Facebook Page'] },
  { main: 'Tiktok', children: ['Tiktok', 'Tiktok Live', 'Line AI LBD', 'Line AI LBA'] },
  { main: 'Webjob', children: ['Google Ads', 'Jobthai', 'JobsDB', 'JOBBKK', 'Jobfinfin', 'LinkedIn'] },
  { main: 'Offline', children: ['เจ้าหน้าที่แนะนำ', 'บอกต่อ', 'ป้าย/ใบปลิว', 'พนักงานเก่า', 'พนักงานแนะนำ', 'Academe'] },
];

type Row = { id: string; parent_id: string | null; name: string; is_active: boolean; sort_order: number };
const norm = (s: string) => s.trim().toLowerCase();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const log: string[] = [];
try {
  await client.query('begin');
  const all = async () => (await client.query<Row>(`select id::text, parent_id::text, name, is_active, sort_order from ${T}`)).rows;
  let rows = await all();

  const mainIds = new Map<string, string>();
  for (const [i, p] of PLAN.entries()) {
    const roots = rows.filter((r) => !r.parent_id && norm(r.name) === norm(p.main));
    let id = roots.find((r) => r.is_active)?.id ?? roots[0]?.id;
    if (!id) {
      log.push(`สร้างช่องทางหลัก ${p.main}`);
      id = (await client.query<{ id: string }>(`insert into ${T} (parent_id, name, sort_order) values (null, $1, $2) returning id::text`, [p.main, i + 1])).rows[0].id;
    } else {
      await client.query(`update ${T} set sort_order = $2, is_active = true, updated_at = now() where id = $1`, [id, i + 1]);
    }
    mainIds.set(p.main, id);
  }
  rows = await all();

  const placed = new Set<string>(mainIds.values());
  for (const p of PLAN) {
    const parentId = mainIds.get(p.main)!;
    for (const [j, name] of p.children.entries()) {
      // แถวเดิมชื่อนี้: ใต้พ่อตัวนี้อยู่แล้วก่อน · ไม่งั้นเอาช่องทางหลักเดิมชื่อนี้ (ที่ยังไม่ใช่ 4 หลัก)
      const cand =
        rows.find((r) => r.parent_id === parentId && norm(r.name) === norm(name)) ??
        rows.find((r) => !r.parent_id && norm(r.name) === norm(name) && !placed.has(r.id));
      if (cand) {
        if (cand.parent_id !== parentId) log.push(`ย้าย ${cand.name} → ใต้ ${p.main}`);
        if (!cand.is_active) log.push(`เปิดใช้ ${cand.name}`);
        await client.query(`update ${T} set parent_id = $2, sort_order = $3, is_active = true, updated_at = now() where id = $1`, [cand.id, parentId, j + 1]);
        placed.add(cand.id);
      } else {
        log.push(`สร้าง ${name} ใต้ ${p.main}`);
        const id = (await client.query<{ id: string }>(`insert into ${T} (parent_id, name, sort_order) values ($1, $2, $3) returning id::text`, [parentId, name, j + 1])).rows[0].id;
        placed.add(id);
      }
    }
  }
  rows = await all();

  // ช่องทางหลักเดิมที่ไม่อยู่ในลิสต์ = ปิดใช้ (ไม่ลบ)
  for (const r of rows.filter((x) => !x.parent_id && !placed.has(x.id) && x.is_active)) {
    log.push(`ปิดใช้ ${r.name} (ไม่อยู่ในลิสต์)`);
    await client.query(`update ${T} set is_active = false, updated_at = now() where id = $1`, [r.id]);
  }

  rows = await all();
  const tree = PLAN.map((p) => {
    const id = mainIds.get(p.main)!;
    const kids = rows.filter((r) => r.parent_id === id && r.is_active).sort((a, b) => a.sort_order - b.sort_order).map((r) => r.name);
    return `${p.main}: ${kids.join(' · ')}`;
  });
  const otherActive = rows.filter((r) => !r.parent_id && r.is_active && !mainIds.has(r.name) && ![...mainIds.values()].includes(r.id)).map((r) => r.name);

  console.log(log.join('\n') || '(ไม่มีอะไรต้องเปลี่ยน)');
  console.log('\nผลลัพธ์:\n' + tree.join('\n'));
  console.log('ช่องทางหลักอื่นที่ยังเปิดอยู่:', otherActive.length ? otherActive.join(', ') : 'ไม่มี');
  if (APPLY) {
    await client.query('commit');
    console.log('\nเขียนจริงแล้ว');
  } else {
    await client.query('rollback');
    console.log('\nดูอย่างเดียว — ยังไม่เขียน (ใส่ --apply เพื่อเขียนจริง)');
  }
} catch (e) {
  await client.query('rollback');
  throw e;
} finally {
  await client.end();
}
