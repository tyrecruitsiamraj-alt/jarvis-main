/**
 * ═══ ใบสมัคร ต.ค. ที่ไม่มีช่องทาง → Webjob · เว็บสมัครงาน So Recruit (เจ้าของ 28 ต.ค. 2569 Choice) ═══
 * > *"ไม่มันต้องมีที่อยู่ ไม่เอาไม่ระบุ"* → Choice "ย้ายเข้า Webjob · เว็บสมัครงาน So Recruit"
 *
 *   npx tsx scripts/channel-web-so-recruit-2569-10-28.mts          ดูอย่างเดียว ไม่เขียน
 *   npx tsx scripts/channel-web-so-recruit-2569-10-28.mts --apply  เขียนจริง (ธุรกรรมเดียว)
 *
 * 1. ช่องทางรอง "เว็บสมัครงาน So Recruit" ใต้ Webjob (มีแล้ว = ใช้แถวเดิม)
 * 2. ใบที่กรอกเองตั้งแต่ 1 ต.ค. 2569 ไม่มีป้ายช่องทาง · ลิงก์ไม่มีช่องทาง · ไม่ได้เลือกในฟอร์ม (หรือเลือก "อื่น ๆ")
 *    วัดจริง 28 ต.ค.: 25 ใบ (19 กรอกหน้าประกาศตรง · 4 เลือกอื่น ๆ · 2 ลิงก์กลาง) — ทุกใบกรอกผ่านเว็บสมัครงานของเรา
 * 3. เขียนช่องทางให้ทีละ id + จด audit_logs ทุกใบ · ไม่แตะใบที่มีช่องทางแล้ว · ทำซ้ำได้ ผลเท่าเดิม
 */
import '../server/bootstrap-env.js';
import pg from 'pg';

const APPLY = process.argv.includes('--apply');
const schema = (process.env.PGSCHEMA || process.env.DATABASE_SCHEMA || 'jarvis_rm').trim();
const CH = `"${schema}".recruit_channels`;
const APPS = `"${schema}".public_job_applications`;
const LINKS = `"${schema}".recruit_posting_links`;
const AUDIT = `"${schema}".audit_logs`;
const SUB = 'เว็บสมัครงาน So Recruit';
const LABEL = `Webjob · ${SUB}`;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('begin');
  const main = (await client.query<{ id: string }>(`select id::text from ${CH} where parent_id is null and lower(btrim(name)) = 'webjob' and is_active order by sort_order limit 1`)).rows[0];
  if (!main) throw new Error('ไม่เจอช่องทางหลัก Webjob');
  let sub = (await client.query<{ id: string }>(`select id::text from ${CH} where parent_id = $1::uuid and btrim(name) = $2 limit 1`, [main.id, SUB])).rows[0];
  if (!sub) {
    console.log(`สร้างช่องทางรอง ${SUB} ใต้ Webjob`);
    sub = (
      await client.query<{ id: string }>(
        `insert into ${CH} (parent_id, name, sort_order)
         values ($1::uuid, $2, coalesce((select max(sort_order) from ${CH} where parent_id = $1::uuid), 0) + 1) returning id::text`,
        [main.id, SUB],
      )
    ).rows[0];
  }
  const { rows } = await client.query<{ id: string; full_name: string | null; created_at: Date; referral_source: string | null; link_id: string | null }>(
    `select a.id::text, a.full_name, a.created_at, a.referral_source, a.link_id::text
       from ${APPS} a
      where a.created_at >= '2026-09-30T17:00:00Z' and not coalesce(a.is_lead, false)
        and a.created_by_name is null
        and nullif(btrim(a.channel_label), '') is null
        and (a.link_id is null or (select nullif(btrim(l.channel_label), '') from ${LINKS} l where l.id = a.link_id) is null)
        and (a.referral_source is null or a.referral_source = 'other')
      order by a.created_at`,
  );
  console.log(`ใบที่จะใส่ช่องทาง "${LABEL}": ${rows.length} ใบ`);
  for (const r of rows) console.log(`  ${r.id} · ${r.full_name ?? '—'} · ${r.created_at.toISOString().slice(0, 10)} · referral=${r.referral_source ?? '-'} · link=${r.link_id ? 'มี' : '-'}`);
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    const upd = await client.query(
      `update ${APPS} set channel_id = $2::uuid, channel_label = $3, updated_at = now()
        where id = any($1::uuid[]) and nullif(btrim(channel_label), '') is null`,
      [ids, sub.id, LABEL],
    );
    console.log(`เขียนช่องทาง ${upd.rowCount} ใบ`);
    for (const id of ids) {
      await client.query(
        `insert into ${AUDIT} (user_name, action, entity_type, entity_id, old_value, new_value)
         values ($1, 'job_application.channel_backfill', 'job_application', $2, $3, $4)`,
        ['system · เจ้าของเลือก 28 ต.ค. 2569', id, JSON.stringify({ channel_label: null }), JSON.stringify({ channel_id: sub.id, channel_label: LABEL })],
      );
    }
  }
  if (APPLY) {
    await client.query('commit');
    console.log('บันทึกแล้ว');
  } else {
    await client.query('rollback');
    console.log('ดูอย่างเดียว — ยังไม่เขียน (ใส่ --apply เพื่อเขียนจริง)');
  }
} catch (e) {
  await client.query('rollback').catch(() => {});
  throw e;
} finally {
  await client.end();
}
