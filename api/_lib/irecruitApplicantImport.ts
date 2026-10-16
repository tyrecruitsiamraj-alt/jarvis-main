/**
 * ═══ ดึงชื่อผู้สมัครจาก iRecruit เข้าแท็บผู้สมัครของงานสรรหา (เจ้าของสั่ง 15 ต.ค. 2569) ═══
 * > *"ตอนนี้ดึงชื่อจาก irecruit มายัง … https://irecruit.siamraj.com/recruitStaff/main?content=0"*
 * Choice: ย้อน 30 วัน เฉพาะคนที่ยังไม่ถูกโทร · ดึงต่อเนื่องทุก 15 นาที · คนกดส่ง AI เอง · เบอร์ที่มีใน jarvis แล้วไม่ดึงซ้ำ (ใช้ใบ jarvis)
 *
 * แหล่ง (iRecruit อ่านอย่างเดียว): `recruit_register` owner RM · status A · ไม่ถูกลบ · สร้างภายใน 30 วัน
 *   ยังไม่ถูกโทร = ไม่มีแถวใน `recruit_logs_call` และ `recruit_contact` (คีย์ `register_id` = `recruit_register.uuid`)
 *   วัด 15 ต.ค. 2569: 333 คน · มีจังหวัดครบ · อายุ 329 · ตำแหน่งที่สนใจครบ · ไม่มีใบไหนผูกประกาศ/ใบขอ (jobPostId ว่างทั้งหมด)
 *
 * ปลายทาง: `public_job_applications` · source `irecruit` · `created_by_name` = 'iRecruit' (= ใบนำเข้า ⇒ ตัวส่ง AI อัตโนมัติไม่หยิบ)
 *   ช่องทาง = "iRecruit · <ช่องทางเดิม>" (กรองหัวข้อช่องทางได้) · วันสมัคร = วันที่สมัครใน iRecruit · ไม่ผูกใบขอ
 *   จด `app_irecruit_imports` (147) กันดึงซ้ำ · ใบขับขี่ (รหัสตัวเลขที่ยังไม่รู้ความหมาย) และวุฒิ ไม่ดึง
 * 🔴 ทำงานเฉพาะเซิร์ฟเวอร์จริง (เครื่องนักพัฒนาไม่เขียนฐานเอง) · ปิดด้วย IRECRUIT_APPLICANT_IMPORT_ENABLED=false ·
 *    สวิตช์ปิดการเชื่อม iRecruit (`irecruitUnavailableReason`) ปิด = ไม่ทำอะไร
 */
import { dbQuery, dbTransaction } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { irecruitSqlQuery, irecruitUnavailableReason } from './irecruitSqlServer.js';
import { isProductionRuntime } from './runtime.js';
import { logError, logInfo } from './logger.js';

const APPS = tableInAppSchema('public_job_applications');
const IMPORTS = tableInAppSchema('app_irecruit_imports');

const LOOKBACK_DAYS = 30;
const LIMIT = 500;
const INTERVAL_MS = 15 * 60_000;
const STARTUP_DELAY_MS = 120_000;
/** ล็อกเดียวต่อรอบ — สองโปรเซสดึงพร้อมกันไม่สร้างใบซ้ำ (ด่านจริงคือ PK ของ app_irecruit_imports) */
const LOCK_KEY = 7_120_1015;

export const IRECRUIT_IMPORT_CREATED_BY = 'iRecruit';
export const IRECRUIT_IMPORT_SOURCE = 'irecruit';

export type IrecruitRegisterRow = {
  uuid: string;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  age: number | null;
  sex: string | null;
  province_name: string | null;
  district_name: string | null;
  job_name: string | null;
  channel_name: string | null;
  line_id: string | null;
  created_at: Date | string | null;
  /** ผู้รับผิดชอบใน iRecruit (`responsible_id` = `admins.staff_id`) — ทีม Online · 16 ต.ค. 2569 */
  responsible_email?: string | null;
  responsible_name?: string | null;
};

/** iRecruit ที่ยังไม่ถูกโทร ภายใน 30 วัน (ใหม่สุดก่อน) */
export function irecruitUncalledSql(): string {
  return `
    SELECT TOP ${LIMIT}
      rr.uuid, rr.first_name, rr.last_name, rr.phone_number, rr.age, rr.sex,
      p.pro_thname AS province_name, d.district_thlist AS district_name,
      rmj.name_th AS job_name, ch.name AS channel_name, rr.line_id, rr.created_at,
      adm.email AS responsible_email, adm.name AS responsible_name
    FROM recruit_register rr
    LEFT JOIN admins adm ON adm.staff_id = rr.responsible_id
    LEFT JOIN recruit_master_job rmj ON rmj.id = rr.job_interest_id
    LEFT JOIN recruit_master_channel ch ON ch.id = rr.channel_id
    LEFT JOIN z_ms_province p ON p.pro_id = rr.province_cerrently_id
    LEFT JOIN z_ms_district d ON d.district_id = rr.district_cerrently_id
    WHERE rr.owner = 'RM' AND rr.status = 'A' AND rr.deleted_at IS NULL
      AND rr.created_at >= DATEADD(day, -${LOOKBACK_DAYS}, GETDATE())
      AND rr.phone_number IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM recruit_logs_call lc WHERE lc.register_id = rr.uuid)
      AND NOT EXISTS (SELECT 1 FROM recruit_contact c WHERE c.register_id = rr.uuid)
    ORDER BY rr.created_at DESC`;
}

const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return s && s !== '-' ? s : null;
};

/** เบอร์มือถือไทย 10 หลัก (0xxxxxxxxx) — แปลงไม่ได้ = null (ไม่ดึง) */
export function thaiMobile(raw: unknown): string | null {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (/^0\d{9}$/.test(d)) return d;
  if (/^66\d{9}$/.test(d)) return `0${d.slice(2)}`;
  return null;
}

export type ImportValue = {
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  age: number | null;
  gender: 'male' | 'female' | null;
  province: string | null;
  district: string | null;
  position_interest: string | null;
  line_id: string | null;
  channel_label: string;
  created_at: string | null;
  /** ผู้รับผิดชอบ (ทีม Online) — ชื่อเล่นหน้าผู้ใช้งานของ jarvis ก่อน · ไม่มีบัญชี = ชื่อใน iRecruit */
  responsible_name: string | null;
};

/**
 * เวลาใน iRecruit = นาฬิกาไทยไม่มีโซน — driver อ่านเป็น UTC (แบบเดียวกับ `wantWallFromSqlDate`) ⇒ ต้องลบ 7 ชม.
 * 🔴 เดิมไม่ลบ (15 ต.ค. 2569) วันสมัครของรายชื่อ iRecruit เกินเวลาจริงไป 7 ชม. (บางใบเป็นเวลาในอนาคต)
 */
export function irecruitInstant(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d =
    v instanceof Date
      ? new Date(v.getTime() - 7 * 3_600_000)
      : /[zZ]|[+-]\d{2}:?\d{2}$/.test(v.trim())
        ? new Date(new Date(v).getTime() - 7 * 3_600_000)
        : new Date(`${v.trim().replace(' ', 'T')}+07:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

/**
 * ผู้รับผิดชอบของใบจาก iRecruit (เจ้าของ 16 ต.ค. 2569 "ผู้รับผิดชอบ ก็ทีม online อะ ว่าน เจมส์" · Choice ดึงมาด้วย + เติมใบเก่า)
 * อีเมลตรงกับผู้ใช้ jarvis = ชื่อเล่น (หรือชื่อจริง) หน้าผู้ใช้งาน · ไม่มีบัญชี = ชื่อใน iRecruit · ไม่มีทั้งคู่ = null
 */
export function irecruitResponsibleName(
  r: Pick<IrecruitRegisterRow, 'responsible_email' | 'responsible_name'>,
  displayOfEmail: (email: string) => string | null = () => null,
): string | null {
  const email = clean(r.responsible_email)?.toLowerCase();
  return (email ? displayOfEmail(email) : null) ?? clean(r.responsible_name);
}

/** แถว iRecruit → ใบสมัคร jarvis (pure · เทสต์คุม) — ไม่มีชื่อหรือเบอร์ใช้ไม่ได้ = null */
export function toImportValue(
  r: IrecruitRegisterRow,
  displayOfEmail: (email: string) => string | null = () => null,
): ImportValue | null {
  const phone = thaiMobile(r.phone_number);
  const first = clean(r.first_name);
  const last = clean(r.last_name);
  const full = [first, last].filter(Boolean).join(' ');
  if (!phone || !full) return null;
  const age = Number(r.age);
  const sex = (r.sex ?? '').trim().toUpperCase();
  const created = irecruitInstant(r.created_at);
  const channel = clean(r.channel_name);
  return {
    full_name: full,
    first_name: first,
    last_name: last,
    phone,
    // ช่องอายุของ jarvis รับ 15–80 (CHECK) — นอกช่วง = ไม่รู้อายุ (ไม่ทำให้ทั้งรอบล้ม)
    age: Number.isFinite(age) && age >= 15 && age <= 80 ? Math.round(age) : null,
    gender: sex === 'M' ? 'male' : sex === 'F' ? 'female' : null,
    province: clean(r.province_name),
    district: clean(r.district_name),
    position_interest: clean(r.job_name),
    line_id: clean(r.line_id),
    channel_label: channel ? `iRecruit · ${channel}` : 'iRecruit',
    created_at: created && Number.isFinite(created.getTime()) ? created.toISOString() : null,
    responsible_name: irecruitResponsibleName(r, displayOfEmail),
  };
}

export function isIrecruitImportEnabled(production = isProductionRuntime()): boolean {
  if ((process.env.IRECRUIT_APPLICANT_IMPORT_ENABLED || '').trim().toLowerCase() === 'false') return false;
  return production && irecruitUnavailableReason() === null;
}

export type IrecruitImportRun = {
  found: number;
  imported: number;
  skippedJarvisPhone: number;
  skippedBad: number;
  already: number;
  /** ใบเก่าที่เติมผู้รับผิดชอบรอบนี้ */
  responsibleFilled?: number;
};

export async function runIrecruitImportOnce(): Promise<IrecruitImportRun> {
  const out: IrecruitImportRun = { found: 0, imported: 0, skippedJarvisPhone: 0, skippedBad: 0, already: 0 };
  // ใบเก่าที่ยังไม่มีผู้รับผิดชอบ — เติมทุกรอบ (กลืน error · ห้ามทำให้รอบดึงล้ม)
  try {
    out.responsibleFilled = await backfillIrecruitResponsible();
  } catch (e) {
    logError('irecruitImport.backfillResponsible failed', e);
  }
  const rows = await irecruitSqlQuery<IrecruitRegisterRow>(irecruitUncalledSql(), {});
  out.found = rows.length;
  if (rows.length === 0) return out;
  const displayOfEmail = await loadUserDisplayByEmail();

  const uuids = rows.map((r) => String(r.uuid));
  const { rows: done } = await dbQuery<{ register_uuid: string }>(
    `select register_uuid from ${IMPORTS} where register_uuid = any($1::text[])`,
    [uuids],
  );
  const doneSet = new Set(done.map((d) => d.register_uuid));
  const fresh: Array<{ uuid: string; v: ImportValue }> = [];
  for (const r of rows) {
    if (doneSet.has(String(r.uuid))) {
      out.already += 1;
      continue;
    }
    const v = toImportValue(r, displayOfEmail);
    if (!v) {
      out.skippedBad += 1;
      continue;
    }
    fresh.push({ uuid: String(r.uuid), v });
  }
  if (fresh.length === 0) return out;

  await dbTransaction(async (client) => {
    const { rows: lock } = await client.query<{ ok: boolean }>('select pg_try_advisory_xact_lock($1) as ok', [LOCK_KEY]);
    if (!lock[0]?.ok) return;
    // เบอร์ที่มีใบใน jarvis แล้ว (ทุกช่วงเวลา) = ใช้ใบ jarvis ไม่ดึงซ้ำ · ในชุดเดียวกันเบอร์ซ้ำ = เอาใบแรก (ใหม่สุด)
    const e164 = fresh.map((f) => `+66${f.v.phone.slice(1)}`);
    const { rows: have } = await client.query<{ phone_e164: string }>(
      `select distinct phone_e164 from ${APPS} where phone_e164 = any($1::text[])`,
      [e164],
    );
    const seen = new Set(have.map((h) => h.phone_e164));
    for (const { uuid, v } of fresh) {
      const key = `+66${v.phone.slice(1)}`;
      if (seen.has(key)) {
        out.skippedJarvisPhone += 1;
        continue;
      }
      seen.add(key);
      const { rows: ins } = await client.query<{ id: string }>(
        `insert into ${APPS} (full_name, first_name, last_name, phone, age, gender, province, district, position_interest,
                              line_id, channel_label, created_by_name, source, status, created_at, updated_at, responsible_name)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'new', coalesce($14::timestamptz, now()), now(), $15)
         returning id`,
        [
          v.full_name, v.first_name, v.last_name, v.phone, v.age, v.gender, v.province, v.district, v.position_interest,
          v.line_id, v.channel_label, IRECRUIT_IMPORT_CREATED_BY, IRECRUIT_IMPORT_SOURCE, v.created_at, v.responsible_name,
        ],
      );
      const id = ins[0]?.id;
      if (!id) continue;
      await client.query(
        `insert into ${IMPORTS} (register_uuid, application_id, irecruit_created_at) values ($1, $2, $3::timestamptz)
         on conflict (register_uuid) do nothing`,
        [uuid, id, v.created_at],
      );
      out.imported += 1;
    }
  });
  logInfo('irecruitImport.run', out);
  return out;
}

/** อีเมล (ตัวเล็ก) → ชื่อที่โชว์ของผู้ใช้ jarvis (ชื่อเล่น → ชื่อจริง) — กติกาเดียวกับ created_by_display */
async function loadUserDisplayByEmail(): Promise<(email: string) => string | null> {
  const { rows } = await dbQuery<{ email: string; name: string | null }>(
    `select lower(btrim(email)) as email, coalesce(nullif(btrim(nickname), ''), nullif(btrim(full_name), '')) as name
       from ${tableInAppSchema('users')} where email is not null`,
  );
  const map = new Map(rows.map((r) => [r.email, r.name]));
  return (email) => map.get(email) ?? null;
}

/** รหัสใบของ iRecruit (`recruit_register.uuid`) = ตัวอักษร/ตัวเลข 15 ตัว — ตรวจก่อนต่อเป็นข้อความใน IN (กันอักขระแปลก) */
const UUID_TEXT_RE = /^[0-9A-Za-z-]{6,64}$/;
const BACKFILL_LIMIT = 500;

/**
 * เติมผู้รับผิดชอบให้ใบที่ดึงจาก iRecruit ไปแล้วแต่ยังว่าง (เจ้าของ Choice 16 ต.ค. 2569 "ดึงชื่อมาด้วย + เติม 382 ใบเก่า")
 * อ่าน iRecruit ตาม `register_uuid` ของ `app_irecruit_imports` · เขียนเฉพาะช่อง `responsible_name` ที่ยังว่าง (ตาม id)
 */
export async function backfillIrecruitResponsible(): Promise<number> {
  const { rows: todo } = await dbQuery<{ id: string; register_uuid: string }>(
    `select a.id::text as id, i.register_uuid
       from ${IMPORTS} i join ${APPS} a on a.id = i.application_id
      where nullif(btrim(a.responsible_name), '') is null
      order by i.irecruit_created_at desc nulls last
      limit ${BACKFILL_LIMIT}`,
  );
  const safe = todo.filter((t) => UUID_TEXT_RE.test(t.register_uuid));
  if (safe.length === 0) return 0;
  const found = await irecruitSqlQuery<{ uuid: string; responsible_email: string | null; responsible_name: string | null }>(
    `SELECT CAST(rr.uuid AS varchar(64)) AS uuid, adm.email AS responsible_email, adm.name AS responsible_name
       FROM recruit_register rr LEFT JOIN admins adm ON adm.staff_id = rr.responsible_id
      WHERE CAST(rr.uuid AS varchar(64)) IN (${safe.map((t) => `'${t.register_uuid}'`).join(',')})`,
    {},
  );
  const displayOfEmail = await loadUserDisplayByEmail();
  const nameByUuid = new Map(found.map((f) => [String(f.uuid).toLowerCase(), irecruitResponsibleName(f, displayOfEmail)]));
  let filled = 0;
  for (const t of safe) {
    const name = nameByUuid.get(t.register_uuid.toLowerCase());
    if (!name) continue;
    const { rowCount } = await dbQuery(
      `update ${APPS} set responsible_name = $2 where id = $1::uuid and nullif(btrim(responsible_name), '') is null`,
      [t.id, name],
    );
    filled += rowCount ?? 0;
  }
  if (filled > 0) logInfo('irecruitImport.responsibleFilled', { filled, checked: safe.length });
  return filled;
}

let running = false;
let stopped = false;

async function sleepInterruptible(ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (!stopped && Date.now() < end) {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, Math.min(1_000, end - Date.now()));
      t.unref?.();
    });
  }
}

export function startIrecruitImportWorker(): boolean {
  if (!isIrecruitImportEnabled()) {
    logInfo('irecruitImport.worker.disabled', {
      hint: 'ทำงานเฉพาะเซิร์ฟเวอร์จริง · ปิดด้วย IRECRUIT_APPLICANT_IMPORT_ENABLED=false · สวิตช์ iRecruit ต้องเปิด',
    });
    return false;
  }
  if (running) return true;
  running = true;
  stopped = false;
  logInfo('irecruitImport.worker.start', { intervalMs: INTERVAL_MS, lookbackDays: LOOKBACK_DAYS });
  void (async () => {
    await sleepInterruptible(STARTUP_DELAY_MS);
    while (!stopped) {
      if (!isIrecruitImportEnabled()) break;
      try {
        await runIrecruitImportOnce();
      } catch (e) {
        logError('irecruitImport.run_failed', e);
      }
      await sleepInterruptible(INTERVAL_MS);
    }
    running = false;
  })();
  return true;
}

export function stopIrecruitImportWorker(): void {
  stopped = true;
}
