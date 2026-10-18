/**
 * ═══ คำขอใช้สิทธิ์ข้อมูลส่วนบุคคล (PDPA) ฝั่งเซิร์ฟเวอร์ (เจ้าของเลือกทำ 18 ต.ค. 2569 · migration 152) ═══
 * ตรรกะล้วน (ประเภท/สถานะ/ตรวจฟอร์ม) อยู่ `src/lib/pdpaRequests.ts`
 *
 * 🔴 ขอลบ / ขอให้หยุดติดต่อ = หยุดโทรทันทีตอนได้รับ (ก่อนยืนยันตัวตน — Choice 17 ต.ค. 2569):
 *   1. เบอร์เข้าบัญชีห้ามโทร (เหตุผล `pdpa` · ถึงปี 2099) — กันทุกเส้นที่ส่ง AI (`insertQueueItems` · ตัวส่งซ้ำ · ติดตาม)
 *   2. สาย AI ที่ยังไม่มีผลของเบอร์นี้ = ยกเลิก (คิวสัมภาษณ์ + ยกเลิกที่ Lumos · สายติดตาม/ส่งคนแทนผ่าน `cancelFollowScope`)
 * 🔴 ลบข้อมูล (หลังยืนยันตัวตน) = ล้างชื่อ/เบอร์/ที่อยู่/ไฟล์/บทสนทนาในตารางของเรา เหลือตัวเลขสถิติ (อายุ เพศ ตำแหน่ง ผลโทร)
 *    เบอร์ยังอยู่ในบัญชีห้ามโทร (ต้องใช้กันโทรซ้ำ) · ข้อมูลใน iRecruit / ERP ต้องลบที่ระบบนั้น
 */
import { dbQuery, dbTransaction } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { toE164Thai } from './thaiPhone.js';
import { suppressPhone } from './callFollowup.js';
import { cancelFollowScope } from './followCancelScope.js';
import { cancelPushedInterview, getLumosPushConfig } from './lumosPushClient.js';
import { logError, logInfo } from './logger.js';
import {
  PDPA_ERASED_NAME,
  pdpaStopsCalls,
  type PdpaRequestInput,
  type PdpaRequestKind,
  type PdpaRequestSource,
  type PdpaRequestStatus,
} from '../../src/lib/pdpaRequests.js';

const REQUESTS = tableInAppSchema('app_pdpa_requests');
const APPS = tableInAppSchema('public_job_applications');
const FOLLOW = tableInAppSchema('follow_entries');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const AFTERCARE_PEOPLE = tableInAppSchema('aftercare_people');
const AFTERCARE_CONTACTS = tableInAppSchema('aftercare_contacts');
const SELECTION = tableInAppSchema('selection_progress');
const HOLDS = tableInAppSchema('candidate_call_holds');

/** 9 หลักท้ายของเบอร์ในคอลัมน์ — เทียบได้ทั้ง 081… / +6681… */
const key9 = (col: string) => `right(regexp_replace(coalesce(${col}, ''), '\\D', '', 'g'), 9)`;
const QUEUE_PHONE = `coalesce(payload->>'recipient_phone', payload->>'phone')`;

export type PdpaRequestRow = {
  id: string;
  kind: PdpaRequestKind;
  full_name: string;
  phone_e164: string;
  detail: string | null;
  source: PdpaRequestSource;
  status: PdpaRequestStatus;
  created_at: string;
  due_at: string;
  created_by_name: string | null;
  verified_at: string | null;
  verified_by_name: string | null;
  done_at: string | null;
  done_by_name: string | null;
  done_note: string | null;
};

const ROW_COLUMNS = `id::text, kind, full_name, phone_e164, detail, source, status, created_at, due_at, created_by_name,
  verified_at, verified_by_name, done_at, done_by_name, done_note`;

function phoneKey(e164: string): string {
  return e164.replace(/\D/g, '').slice(-9);
}

/** หยุดโทรเบอร์นี้ทันที — คืนจำนวนสายที่ยกเลิก (ล้มบางส่วน = log ไว้ ไม่ทำให้คำขอล้ม · บัญชีห้ามโทรกันชั้นหลักแล้ว) */
export async function stopCallsForPhone(e164: string, requestId: string, byName: string): Promise<{ queue: number; follow: number }> {
  await suppressPhone({ phone: e164, until: '2099-12-31T00:00:00+07:00', reason: 'pdpa', note: `คำขอ PDPA ${requestId}`, byName });
  const k = phoneKey(e164);
  const out = { queue: 0, follow: 0 };

  // คิวสัมภาษณ์/ทักทาย (ผู้สมัคร) ที่ยังไม่มีผล
  const { rows: items } = await dbQuery<{ id: string; job_ref: string; person_ref: string; pushed: boolean }>(
    `update ${QUEUE} set status = 'cancelled', updated_at = now()
      where channel = 'interview' and result is null and status in ('pending', 'delivered')
        and ${key9(QUEUE_PHONE)} = $1
      returning id::text, job_ref, person_ref, (push_state = 'pushed' or pushed_at is not null) as pushed`,
    [k],
  );
  out.queue = items.length;
  if (getLumosPushConfig()) {
    for (const it of items.filter((x) => x.pushed)) {
      try {
        await cancelPushedInterview(`${it.job_ref}::${it.person_ref}::interview`);
      } catch (e) {
        logError('pdpa.stopCalls: ยกเลิกที่ Lumos ไม่สำเร็จ', e, { queueId: it.id });
      }
    }
  }

  // สายติดตาม/ส่งคนแทน — ทีละทีม (cancelFollowScope 'person' = เบอร์เดียวกัน + ทีมเดียวกัน)
  const { rows: anchors } = await dbQuery<{ id: string }>(
    `select distinct on (coalesce(follow_team, '')) id::text from ${FOLLOW}
      where cancelled_at is null and completed_at is null and ${key9('recipient_phone')} = $1
      order by coalesce(follow_team, ''), scheduled_at`,
    [k],
  );
  for (const a of anchors) {
    try {
      const r = await cancelFollowScope(a.id, 'person', { sub: 'pdpa', email: byName });
      out.follow += r.ids.length;
    } catch (e) {
      logError('pdpa.stopCalls: ยกเลิกสายติดตามไม่สำเร็จ', e, { followId: a.id });
    }
  }
  logInfo('pdpa.stopCalls.done', { requestId, ...out });
  return out;
}

export async function createPdpaRequest(
  input: PdpaRequestInput,
  meta: { source: PdpaRequestSource; byName: string | null; clientIp: string | null },
): Promise<{ row: PdpaRequestRow; stopped: { queue: number; follow: number } | null }> {
  const e164 = toE164Thai(input.phone);
  if (!e164) throw new Error('เบอร์โทรไม่ถูกต้อง');
  const { rows } = await dbQuery<PdpaRequestRow>(
    `insert into ${REQUESTS} (kind, full_name, phone_e164, detail, source, created_by_name, client_ip)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning ${ROW_COLUMNS}`,
    [input.kind, input.fullName, e164, input.detail, meta.source, meta.byName, meta.clientIp],
  );
  const row = rows[0];
  const stopped = pdpaStopsCalls(input.kind) ? await stopCallsForPhone(e164, row.id, meta.byName ?? 'คำขอ PDPA') : null;
  return { row, stopped };
}

export type PdpaFootprint = { applications: number; follows: number; calls: number };

export async function listPdpaRequests(): Promise<(PdpaRequestRow & { footprint: PdpaFootprint })[]> {
  const { rows } = await dbQuery<PdpaRequestRow & { applications: number; follows: number; calls: number }>(
    `select ${ROW_COLUMNS.replace(/(^|,\s*)(\w+)/g, '$1r.$2')},
       (select count(*)::int from ${APPS} a where ${key9('a.phone')} = right(regexp_replace(r.phone_e164, '\\D', '', 'g'), 9)) as applications,
       (select count(*)::int from ${FOLLOW} f where ${key9('f.recipient_phone')} = right(regexp_replace(r.phone_e164, '\\D', '', 'g'), 9)) as follows,
       (select count(*)::int from ${QUEUE} q where ${key9(`coalesce(q.payload->>'recipient_phone', q.payload->>'phone')`)} = right(regexp_replace(r.phone_e164, '\\D', '', 'g'), 9)) as calls
       from ${REQUESTS} r
      order by (r.status in ('received', 'verified')) desc, r.created_at desc
      limit 500`,
  );
  return rows.map(({ applications, follows, calls, ...r }) => ({ ...r, footprint: { applications, follows, calls } }));
}

export async function getPdpaRequest(id: string): Promise<PdpaRequestRow | null> {
  const { rows } = await dbQuery<PdpaRequestRow>(`select ${ROW_COLUMNS} from ${REQUESTS} where id = $1`, [id]);
  return rows[0] ?? null;
}

/** เปลี่ยนสถานะ — คืน null ถ้าสถานะเดิมไม่ตรง (กดซ้ำ / มีคนทำไปแล้ว) */
export async function setPdpaRequestStatus(
  id: string,
  from: readonly PdpaRequestStatus[],
  to: PdpaRequestStatus,
  byName: string,
  note: string | null,
): Promise<PdpaRequestRow | null> {
  const verify = to === 'verified';
  const { rows } = await dbQuery<PdpaRequestRow>(
    `update ${REQUESTS}
        set status = $3,
            ${verify ? 'verified_at = now(), verified_by_name = $4' : 'done_at = now(), done_by_name = $4, done_note = $5'}
      where id = $1 and status = any($2::text[])
      returning ${ROW_COLUMNS}`,
    verify ? [id, from, to, byName] : [id, from, to, byName, note],
  );
  return rows[0] ?? null;
}

/** ข้อมูลทั้งหมดของเบอร์นี้ในระบบเรา — สำหรับคำขอดูข้อมูล (เปิดหลังยืนยันตัวตนเท่านั้น) */
export type PdpaPersonData = {
  applications: {
    created_at: string;
    full_name: string;
    phone: string;
    age: number | null;
    gender: string | null;
    address: string;
    line_id: string | null;
    job_title: string | null;
    unit_name: string | null;
    source: string;
    status: string;
    has_document: boolean;
  }[];
  follows: { scheduled_at: string; recipient_name: string; topic: string; unit_name: string | null; cancelled: boolean; outcome: string | null }[];
  calls: { created_at: string; channel: string; status: string; outcome: string | null; summary: string | null }[];
};

export async function collectPdpaPersonData(e164: string): Promise<PdpaPersonData> {
  const k = phoneKey(e164);
  const [apps, follows, calls] = await Promise.all([
    dbQuery<PdpaPersonData['applications'][number]>(
      `select created_at, full_name, phone, age, gender,
              concat_ws(' ', subdistrict, district, province, postal_code) as address,
              line_id, job_title, unit_name, source, status, document_bytes is not null as has_document
         from ${APPS} where ${key9('phone')} = $1 order by created_at`,
      [k],
    ),
    dbQuery<PdpaPersonData['follows'][number]>(
      `select scheduled_at, recipient_name, topic, unit_name, cancelled_at is not null as cancelled,
              coalesce(staff_call_outcome, outcome_code) as outcome
         from ${FOLLOW} where ${key9('recipient_phone')} = $1 order by scheduled_at`,
      [k],
    ),
    dbQuery<PdpaPersonData['calls'][number]>(
      `select created_at, channel, status, coalesce(result->>'outcome', result->>'interview_outcome_status') as outcome,
              result->>'summary' as summary
         from ${QUEUE} where ${key9(QUEUE_PHONE)} = $1 order by created_at`,
      [k],
    ),
  ]);
  return { applications: apps.rows, follows: follows.rows, calls: calls.rows };
}

/**
 * ลบข้อมูลตามคำขอ (หลังยืนยันตัวตน) — ธุรกรรมเดียว · คืนจำนวนแถวที่ล้างต่อตาราง
 * 🔴 ห้ามเรียกถ้าคำขอไม่ใช่ delete ที่ยืนยันตัวตนแล้ว (handler ตรวจ + where ในธุรกรรมตรวจซ้ำ)
 */
export async function erasePdpaPerson(requestId: string, byName: string): Promise<Record<string, number> | null> {
  return dbTransaction(async (client) => {
    const { rows: reqRows } = await client.query<{ phone_e164: string }>(
      `select phone_e164 from ${REQUESTS} where id = $1 and kind = 'delete' and status = 'verified' for update`,
      [requestId],
    );
    if (!reqRows[0]) return null;
    const e164 = reqRows[0].phone_e164;
    const k = phoneKey(e164);
    const count = async (sql: string, params: unknown[]) => (await client.query(sql, params)).rowCount ?? 0;

    const out: Record<string, number> = {};
    // ใบสมัคร: เหลืออายุ เพศ ตำแหน่ง สถานะ ช่องทาง (ตัวเลขสถิติ)
    out.applications = await count(
      `update ${APPS}
          set full_name = $2, title_prefix = null, first_name = null, last_name = null,
              phone = '', line_id = null,
              province = null, district = null, subdistrict = null, postal_code = null,
              note = null, admin_note = null, client_ip = null,
              document_filename = null, document_mime = null, document_size = null, document_bytes = null,
              updated_at = now()
        where ${key9('phone')} = $1`,
      [k, PDPA_ERASED_NAME],
    );
    out.follows = await count(
      `update ${FOLLOW}
          set recipient_name = $2, recipient_phone = '', note = null, outcome_note = null, staff_call_note = null,
              updated_at = now()
        where ${key9('recipient_phone')} = $1`,
      [k, PDPA_ERASED_NAME],
    );
    // คิว AI: ตัดชื่อ เบอร์ บทสนทนา เสียง · ผลโทร (outcome) ยังอยู่ให้นับสถิติ
    out.calls = await count(
      `update ${QUEUE}
          set payload = payload - 'phone' - 'recipient_phone' - 'candidate_name' - 'recipient_name' - 'admin_phone',
              result = case when result is null then null
                            else result - 'phone' - 'recipient_phone' - 'candidate_name' - 'recipient_name' - 'transcript'
                                 - 'summary' - 'recording_url' - 'message' - 'concerns' - 'strengths' - 'score_rationale' end,
              updated_at = now()
        where ${key9(QUEUE_PHONE)} = $1`,
      [k],
    );
    out.aftercare = await count(`delete from ${AFTERCARE_CONTACTS} where phone_e164 = $1`, [e164]);
    out.aftercare += await count(`delete from ${AFTERCARE_PEOPLE} where phone_e164 = $1`, [e164]);
    out.selection = await count(`delete from ${SELECTION} where phone_e164 = $1`, [e164]);
    out.holds = await count(`update ${HOLDS} set candidate_name = null, result_note = null, result_detail = null where phone_e164 = $1`, [e164]);
    // ตัวคำขอเอง: เก็บแค่เบอร์ (ผูกกับบัญชีห้ามโทร) ชื่อ/รายละเอียดล้าง
    await client.query(
      `update ${REQUESTS}
          set full_name = $2, detail = null, client_ip = null, status = 'done',
              done_at = now(), done_by_name = $3, done_note = $4
        where id = $1`,
      [requestId, PDPA_ERASED_NAME, byName, `ลบแล้ว · ใบสมัคร ${out.applications} · สายติดตาม ${out.follows} · สาย AI ${out.calls}`],
    );
    logInfo('pdpa.erase.done', { requestId, ...out });
    return out;
  });
}
