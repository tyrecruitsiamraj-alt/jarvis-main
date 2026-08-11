/**
 * ยกช่องทางรับสมัครจาก iRecruit → `recruit_channels`
 *
 *   npx tsx scripts/import-recruit-channels.mts --dry     ดูอย่างเดียว ไม่เขียน
 *   npx tsx scripts/import-recruit-channels.mts           ยกจริง
 *
 * ต้นทาง: `recruit_master_channel` (หลัก) → `recruit_master_sub_channel` (รอง)
 * ปลายทาง: `recruit_channels` โครง 2 ระดับเดิม + `source`/`source_id` จาก migration 075
 *
 * ⚠️ กติกาที่สคริปต์นี้ยึด
 *  1) **ยกซ้ำได้** — upsert ตาม (`source`, `source_id`) ไม่ใช่ตามชื่อ
 *     รันซ้ำแล้วได้จำนวนเท่าเดิม ชื่อที่แก้ที่ต้นทางไหลตามมา
 *  2) **ยกตามจริง ไม่ยุบชื่อซ้ำ** (เจ้าของเคาะ 11 ส.ค. 2569) — ต้นทางมีพ่อชื่อซ้ำจริง
 *     2 แถว และลูกชื่อซ้ำในพ่อเดียวกัน 53 คู่ · migration 075 ผ่อน unique index ให้แล้ว
 *  3) **สถานะปิดก็ยกมา** ติดธง `is_active = false` — ไม่งั้นรายงานย้อนหลังหาชื่อช่องทางเก่าไม่เจอ
 *  4) **ไม่แตะแถวที่คนคีย์เอง** (`source is null`) — แตะเฉพาะ `source = 'irecruit'`
 *  5) **ลูกที่พ่อหาย ข้ามทิ้ง** พร้อมรายงานจำนวน — ไม่เดาพ่อให้
 */
import '../server/bootstrap-env.js';
import { irecruitSqlQuery } from '../api/_lib/irecruitSqlServer.js';
import { dbQuery } from '../api/_lib/postgres.js';

const SOURCE = 'irecruit';
const dryRun = process.argv.includes('--dry');

type SrcChannel = { id: string | number; name: string | null; status: string | null };
type SrcSub = SrcChannel & { channel_id: string | number };

function cleanName(v: string | null): string {
  return String(v ?? '').trim();
}

/** ต้นทางเก็บ status เป็น '1'/'0' (พ่อ) และ 1/0 (ลูก) — ทั้งคู่แปลว่า "ใช้งานอยู่" เมื่อเป็น 1 */
function isActive(v: unknown): boolean {
  return String(v ?? '').trim() === '1';
}

async function upsert(
  sourceId: string,
  parentId: string | null,
  name: string,
  active: boolean,
): Promise<string> {
  const { rows } = await dbQuery<{ id: string }>(
    `INSERT INTO recruit_channels (source, source_id, parent_id, name, is_active)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (source, source_id) WHERE source IS NOT NULL
     DO UPDATE SET parent_id = excluded.parent_id,
                   name = excluded.name,
                   is_active = excluded.is_active,
                   updated_at = now()
     RETURNING id`,
    [SOURCE, sourceId, parentId, name, active],
  );
  return rows[0].id;
}

async function main() {
  const before = await dbQuery<{ n: number }>(
    `select count(*)::int n, count(*) filter (where source = $1)::int imported
       from recruit_channels`,
    [SOURCE],
  );
  console.log(`ก่อนยก: recruit_channels ${before.rows[0].n} แถว`);

  const parents = await irecruitSqlQuery<SrcChannel>(
    `SELECT id, name, status FROM recruit_master_channel ORDER BY id`,
  );
  const subs = await irecruitSqlQuery<SrcSub>(
    `SELECT id, channel_id, name, status FROM recruit_master_sub_channel ORDER BY channel_id, id`,
  );
  console.log(`ต้นทาง: ช่องทางหลัก ${parents.length} · ช่องทางรอง ${subs.length}`);

  if (dryRun) {
    const activeParents = parents.filter((p) => isActive(p.status)).length;
    const activeSubs = subs.filter((s) => isActive(s.status)).length;
    const noName = [...parents, ...subs].filter((r) => !cleanName(r.name)).length;
    const parentIds = new Set(parents.map((p) => String(p.id)));
    const orphan = subs.filter((s) => !parentIds.has(String(s.channel_id))).length;
    console.log(`  ใช้งานอยู่: หลัก ${activeParents} · รอง ${activeSubs}`);
    console.log(`  ชื่อว่าง ${noName} · ลูกที่พ่อหาย ${orphan}`);
    console.log('--dry: ไม่เขียนอะไรลงฐาน');
    return;
  }

  /** id ต้นทางของพ่อ → uuid ฝั่งเรา */
  const parentMap = new Map<string, string>();
  let skippedNoName = 0;
  for (const p of parents) {
    const name = cleanName(p.name);
    if (!name) {
      skippedNoName += 1;
      continue;
    }
    parentMap.set(String(p.id), await upsert(String(p.id), null, name, isActive(p.status)));
  }
  console.log(`ยกช่องทางหลักแล้ว ${parentMap.size} ช่อง`);

  let done = 0;
  let orphan = 0;
  for (const s of subs) {
    const name = cleanName(s.name);
    if (!name) {
      skippedNoName += 1;
      continue;
    }
    const parentUuid = parentMap.get(String(s.channel_id));
    if (!parentUuid) {
      orphan += 1;
      continue;
    }
    // source_id ของลูกใส่ prefix กันชนกับ id ของพ่อ (สอง sequence ทับช่วงกันจริง 12–98)
    await upsert(`sub:${s.id}`, parentUuid, name, isActive(s.status));
    done += 1;
    if (done % 500 === 0) console.log(`  … ${done}/${subs.length}`);
  }
  console.log(`ยกช่องทางรองแล้ว ${done} ช่อง · ข้ามเพราะพ่อหาย ${orphan} · ชื่อว่าง ${skippedNoName}`);

  const after = await dbQuery<{ n: number; imported: number; active: number }>(
    `select count(*)::int n,
            count(*) filter (where source = $1)::int imported,
            count(*) filter (where is_active)::int active
       from recruit_channels`,
    [SOURCE],
  );
  const a = after.rows[0];
  console.log(`หลังยก: ${a.n} แถว (ยกมา ${a.imported} · ใช้งานอยู่ ${a.active})`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
