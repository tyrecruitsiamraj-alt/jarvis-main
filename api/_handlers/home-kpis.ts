/**
 * GET /api/home-kpis — เลข KPI แถวบนหน้าหลัก + ตัวเลือก BU (read-only · Phase 10)
 *
 * เจ้าของเคาะ 24 ส.ค. 2569: *"ทำตัวเทียบจริงเลย"* (วันนี้เทียบเมื่อวาน) และ
 * *"เห็นเหมือนกันอะแต่แยกตาม BU"*
 *
 * 🔴 กติกาของเส้นนี้:
 * 1. **นับได้เฉพาะเหตุการณ์ที่มีเวลา** — ใบสมัครกรอกเมื่อไหร่ · ผลโทรกลับเมื่อไหร่ ·
 *    นัดเมื่อไหร่ ⇒ เทียบวันต่อวันได้จริง · ตัวที่เป็น "สถานะปัจจุบัน" (ใบขอเปิดกี่ใบ)
 *    เทียบไม่ได้เพราะไม่มี snapshot รายวัน จึง **ไม่อยู่ในเส้นนี้เลย** (ห้ามแต่งตัวเลข)
 * 2. **BU มาจาก `site_code` ไม่ใช่ prefix เลขที่ใบขอ** — วัดจริง 24 ส.ค. 2569: prefix
 *    เป็นชนิดใบขอ (OPL/LMO/LAO/DSO…) ไม่มี LBA/LBD เลย · ตัว BU อยู่ที่ site_code
 *    ตำแหน่ง 3-5 (`65LBDL0143` → LBD) เก็บใน `job_site_map` ที่ feed เติมเอง
 * 3. **ไม่แตะ ERP (MSSQL)** — หน้าแรกต้องเบา เหมือน `/api/office-floor`
 * 4. **ไม่คืนข้อมูลบุคคล** — ตัวนับล้วน จึงครอบ `withAuth` เฉย ๆ ไม่ผูก rbac key
 * 5. **ตารางที่ยังไม่ migrate ต้องไม่ทำทั้งเส้นล้ม** — แต่ละก้อนกลืน error ของตัวเอง
 *    แล้วคืน 0/undefined (fail-safe ไปทาง "ไม่มีข้อมูล" ไม่ใช่ 500)
 */
import { sendError, withAuth, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import type { KpiKey, KpiPair } from '@/lib/homeKpi';

const APPS = tableInAppSchema('public_job_applications');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const MAP = tableInAppSchema('job_site_map');
const CONTACTS = tableInAppSchema('application_contact_logs');
const SELECTION = tableInAppSchema('selection_progress');
const FOLLOW = tableInAppSchema('follow_entries');
const AFTERCARE = tableInAppSchema('aftercare_people');
const POSTING_REQ = tableInAppSchema('job_posting_requests');

const QUEUE_OUTCOME = `coalesce(q.last_outcome, q.result->>'outcome')`;
const QUEUE_RESULT_AT = `coalesce(q.first_result_at, q.updated_at)`;

/**
 * "มีคนรับสาย" — ผลที่แปลว่าคุยกับคนจริงได้ (ไม่ว่าจะตอบรับหรือปฏิเสธ)
 * ตรงข้ามคือ no_answer/busy/unresponsive/failed/cancelled = ไม่ได้คุย
 * ⚠️ ชุดคำมาจาก `src/lib/callOutcomeTone.ts` — เพิ่มผลใหม่ต้องมาแก้ที่นี่ด้วย
 */
const CONNECTED = `('confirmed','acknowledged','declined','reschedule_requested','wrong_person')`;

/** ช่วงวันแบบวันปฏิทินของเซิร์ฟเวอร์ — วันนี้ = [today, tomorrow) · เมื่อวาน = [today-1, today) */
const TODAY = `date_trunc('day', now())`;
const YDAY = `${TODAY} - interval '1 day'`;

/** BU ของรหัสไซต์ = ตัวอักษร 3 ตัวหลังเลขปี 2 หลัก (ต้องตรงกับ `src/lib/homeBu.ts`) */
const SITE_BU = (col: string) =>
  `case when ${col} ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(${col} from 3 for 3)) end`;

/**
 * เงื่อนไขกรอง BU ผ่าน `job_site_map` — คืนสตริงว่างเมื่อไม่กรอง
 * ⚠️ ใบขอที่ยังไม่มีแถวในแมป จะ **หลุดออกจากผล** เมื่อกรอง BU ซึ่งถูกต้อง
 * (ไม่รู้ BU = ตอบไม่ได้ว่าอยู่ BU นี้ ⇒ ห้ามเดาว่าอยู่)
 */
function buJoin(jobCol: string, bu: string | null): string {
  if (!bu) return '';
  return ` and exists (select 1 from ${MAP} m where m.job_id = ${jobCol}
             and ${SITE_BU('m.site_code')} = $1)`;
}

/** เงื่อนไขกรอง BU จากคอลัมน์ site_code ที่มีอยู่ในตารางนั้นตรง ๆ */
function buDirect(siteCol: string, bu: string | null): string {
  if (!bu) return '';
  return ` and ${SITE_BU(siteCol)} = $1`;
}

type Row = Record<string, unknown>;
const n = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** ยิงคิวรีแบบกลืน error — ตารางยังไม่ migrate ต้องไม่ทำทั้งหน้าแรกล้ม */
async function safeRow(sql: string, params: unknown[] = []): Promise<Row> {
  try {
    const { rows } = await dbQuery<Row>(sql, params);
    return rows[0] ?? {};
  } catch {
    return {};
  }
}

async function loadKpis(bu: string | null): Promise<Record<KpiKey, KpiPair>> {
  const p = bu ? [bu] : [];

  const apps = await safeRow(
    `select
       count(*) filter (where a.created_at >= ${TODAY})::int as today,
       count(*) filter (where a.created_at >= ${YDAY} and a.created_at < ${TODAY})::int as yday
     from ${APPS} a
     where true${buJoin('a.job_id', bu)}`,
    p,
  );

  const calls = await safeRow(
    `select
       count(*) filter (where ${QUEUE_RESULT_AT} >= ${TODAY})::int as today,
       count(*) filter (where ${QUEUE_RESULT_AT} >= ${YDAY} and ${QUEUE_RESULT_AT} < ${TODAY})::int as yday,
       count(*) filter (where ${QUEUE_RESULT_AT} >= ${TODAY}
                          and ${QUEUE_OUTCOME} = 'confirmed')::int as interested_today,
       count(*) filter (where ${QUEUE_RESULT_AT} >= ${YDAY} and ${QUEUE_RESULT_AT} < ${TODAY}
                          and ${QUEUE_OUTCOME} = 'confirmed')::int as interested_yday,
       count(*) filter (where ${QUEUE_RESULT_AT} >= ${TODAY}
                          and ${QUEUE_OUTCOME} in ${CONNECTED})::int as connected_today,
       count(*) filter (where ${QUEUE_RESULT_AT} >= ${YDAY} and ${QUEUE_RESULT_AT} < ${TODAY}
                          and ${QUEUE_OUTCOME} in ${CONNECTED})::int as connected_yday
     from ${QUEUE} q
     where ${QUEUE_OUTCOME} is not null${buJoin('q.job_ref', bu)}`,
    p,
  );

  /**
   * นัดสัมภาษณ์ = log ที่ติดต่อสำเร็จแล้วได้วันนัด (นับตอน**บันทึก** ไม่ใช่ตอนถึงวันนัด
   * — KPI นี้วัดว่า "วันนี้ทีมนัดได้กี่นัด")
   * BU ต้องไต่ผ่านใบสมัครไปหาแมป เพราะ log ไม่มี site_code ของตัวเอง
   */
  const appts = await safeRow(
    `select
       count(*) filter (where c.created_at >= ${TODAY})::int as today,
       count(*) filter (where c.created_at >= ${YDAY} and c.created_at < ${TODAY})::int as yday
     from ${CONTACTS} c
     join ${APPS} a on a.id = c.application_id
     where c.ok = true and c.appointment_at is not null${buJoin('a.job_id', bu)}`,
    p,
  );

  return {
    newApplicants: { today: n(apps.today), yesterday: n(apps.yday) },
    callResults: { today: n(calls.today), yesterday: n(calls.yday) },
    interested: { today: n(calls.interested_today), yesterday: n(calls.interested_yday) },
    appointments: { today: n(appts.today), yesterday: n(appts.yday) },
    connectRate: {
      today: n(calls.connected_today),
      yesterday: n(calls.connected_yday),
      todayBase: n(calls.today),
      yesterdayBase: n(calls.yday),
    },
  };
}

/**
 * ผลงานวันนี้ต่อโต๊ะ (ใช้ทำแผง "ผลงานเด่นประจำวัน" + "อัปเดตล่าสุด")
 * ทุกช่องเป็น **เหตุการณ์ที่เกิดวันนี้** พร้อมเวลาเหตุการณ์ล่าสุดของโต๊ะนั้น
 */
async function loadDeskToday(bu: string | null): Promise<
  Record<string, { count: number; unit: string; lastAt: string | null }>
> {
  const p = bu ? [bu] : [];
  const one = async (sql: string, unit: string) => {
    const r = await safeRow(sql, p);
    return { count: n(r.c), unit, lastAt: (r.last_at as string | null) ?? null };
  };

  const [intake, aiCalls, selection, follow, content, aftercare] = await Promise.all([
    one(
      `select count(*)::int c, max(a.created_at)::text last_at from ${APPS} a
        where a.created_at >= ${TODAY}${buJoin('a.job_id', bu)}`,
      'ใบ',
    ),
    one(
      `select count(*)::int c, max(${QUEUE_RESULT_AT})::text last_at from ${QUEUE} q
        where ${QUEUE_OUTCOME} is not null and ${QUEUE_RESULT_AT} >= ${TODAY}${buJoin('q.job_ref', bu)}`,
      'สาย',
    ),
    one(
      `select count(*)::int c, max(s.updated_at)::text last_at from ${SELECTION} s
        where s.updated_at >= ${TODAY}${buDirect('s.unit_site_code', bu)}`,
      'คน',
    ),
    one(
      `select count(*)::int c, max(f.completed_at)::text last_at from ${FOLLOW} f
        where f.completed_at >= ${TODAY} and f.cancelled_at is null${buDirect('f.site_code', bu)}`,
      'ราย',
    ),
    one(
      `select count(*)::int c, max(r.created_at)::text last_at from ${POSTING_REQ} r
        where r.created_at >= ${TODAY}`,
      'ใบ',
    ),
    one(
      `select count(*)::int c, max(p.created_at)::text last_at from ${AFTERCARE} p
        where p.created_at >= ${TODAY}${buDirect('p.site_code', bu)}`,
      'คน',
    ),
  ]);

  return { intake, aiCalls, selection, follow, content, aftercare };
}

/**
 * ตัวเลือก BU — นับจาก **ใบขอในทะเบียนไซต์** (ของที่มีอยู่จริงทั้งระบบ)
 * ⚠️ อ่านจากข้อมูลจริงทุกครั้ง ห้าม hard-code รายชื่อ BU
 * (วัดจริง 24 ส.ค. 2569: LBD 170 · LML 81 · LBA 22 · DSL 8 · SNJ 3)
 */
async function loadBuOptions(): Promise<Array<{ bu: string; count: number }>> {
  try {
    const { rows } = await dbQuery<{ bu: string | null; n: number }>(
      `select ${SITE_BU('site_code')} as bu, count(*)::int as n
         from ${MAP}
        where site_code is not null
        group by 1
       having ${SITE_BU('site_code')} is not null
        order by n desc`,
    );
    return rows.filter((r) => r.bu).map((r) => ({ bu: String(r.bu), count: n(r.n) }));
  } catch {
    return [];
  }
}

let cache: { at: number; key: string; body: unknown } | null = null;
const CACHE_MS = 20_000;

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');
  try {
    const raw = String((req.query?.bu as string | undefined) ?? '').trim().toUpperCase();
    const options = await loadBuOptions();
    // 🔴 ยอมรับเฉพาะ BU ที่มีอยู่จริง — ค่ามั่วถือว่าดูทั้งหมด (ไม่ 400 ให้หน้าแรกพัง)
    const bu = raw && raw !== 'ALL' && options.some((o) => o.bu === raw) ? raw : null;

    const key = bu ?? 'ALL';
    const now = Date.now();
    if (cache && cache.key === key && now - cache.at < CACHE_MS) {
      return res.status(200).json(cache.body);
    }

    const [kpis, deskToday] = await Promise.all([loadKpis(bu), loadDeskToday(bu)]);
    const body = {
      generated_at: new Date().toISOString(),
      bu,
      bu_options: options,
      kpis,
      desk_today: deskToday,
    };
    cache = { at: now, key, body };
    return res.status(200).json(body);
  } catch (err) {
    return handleApiError(res, err, 'home-kpis');
  }
}

export default withAuth(handler);
