/**
 * ═══ ใบสมัครซ้ำกับ iRecruit = AI ไม่โทรเอง ติดป้ายให้คนเลือก (เจ้าของ Choice 12 ต.ค. 2569 · migration 143) ═══
 * ซ้ำ = เบอร์เดียวกันสมัครใน iRecruit (`recruit_register`) ตั้งแต่ 14 วันก่อนใบของเรา
 * ใช้กับตัวส่ง AI **อัตโนมัติ** ทุกเส้น: กรอกเสร็จ (`public/apply`) · ตั้งรายได้แล้ว (`incomeReadyDispatch`) · ครบ 1 วันไม่เลือกวิธีโทร (`callChoiceWorker`)
 * ปุ่ม "ส่ง AI โทร" ที่คนกดเองไม่ผ่านตัวนี้ (คนเลือกแล้ว)
 * 🔴 อ่าน iRecruit ไม่ได้ (ล่ม/ช้าเกิน/สวิตช์ปิด) = ส่ง AI ตามเดิม (เจ้าของเลือก) — log ไว้ ไม่ทำให้งานหลักล้ม
 * 🔴 ตาราง 143 ยังไม่ migrate = ยังเช็คได้ แต่จดไม่ได้ (ไม่ส่งตามที่เช็ค · ป้ายไม่ขึ้น)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { irecruitSqlQuery } from './irecruitSqlServer.js';
import { logError, logInfo } from './logger.js';

export const IRECRUIT_DUP_DAYS = 14;
const DUPS = tableInAppSchema('application_irecruit_dups');
/** เพดานเวลาอ่าน iRecruit — ผู้สมัครรอหน้าเว็บอยู่ (กรอกเสร็จ) */
const READ_TIMEOUT_MS = 3_000;

export type IrecruitDup = { irecruitId: number | null; appliedAt: string };

const isUndefinedTable = (e: unknown) => typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01';

/** เบอร์ไทย → รูปที่ iRecruit เก็บ (10 หลัก "0…" เป็นส่วนใหญ่ · บางแถวขาด 0 หน้า) · อ่านไม่ออก = null */
export function irecruitPhoneVariants(phone: string | null | undefined): string[] | null {
  const d = String(phone ?? '').replace(/\D/g, '');
  const nine = d.length >= 9 ? d.slice(-9) : '';
  if (!/^\d{9}$/.test(nine)) return null;
  return [`0${nine}`, nine];
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('irecruit read timeout')), ms))]);
}

/**
 * เช็คเบอร์ชุดหนึ่งกับ iRecruit — คืน Map เบอร์ 9 หลัก → ใบล่าสุดใน iRecruit ที่อยู่ในช่วง (since แต่ละใบ)
 * อ่านไม่ได้ = โยน (ผู้เรียกตัดสินว่าส่งตามเดิม)
 */
export async function lookupIrecruitByPhones(
  apps: ReadonlyArray<{ phone: string | null; since: Date }>,
): Promise<Map<string, IrecruitDup>> {
  const out = new Map<string, IrecruitDup>();
  const wanted = new Map<string, number>();
  for (const a of apps) {
    const v = irecruitPhoneVariants(a.phone);
    if (!v) continue;
    const t = a.since.getTime() - IRECRUIT_DUP_DAYS * 86_400_000;
    wanted.set(v[1], Math.min(wanted.get(v[1]) ?? Infinity, t));
  }
  if (wanted.size === 0) return out;
  const variants = [...wanted.keys()].flatMap((n) => [`0${n}`, n]);
  const oldest = new Date(Math.min(...wanted.values()));
  // ค่าเป็นตัวเลขล้วน (ผ่าน irecruitPhoneVariants) — ประกอบลง SQL ได้ปลอดภัย · ใช้ = ตรงคอลัมน์ (ไม่ครอบฟังก์ชัน) ให้เร็ว
  const rows = await withTimeout(
    irecruitSqlQuery<{ id: number; phone_number: string; created_at: Date | string }>(
      `SELECT id, phone_number, created_at FROM recruit_register
        WHERE phone_number IN (${variants.map((p) => `'${p}'`).join(',')})
          AND created_at >= @oldest`,
      { oldest },
    ),
    READ_TIMEOUT_MS,
  );
  for (const r of rows) {
    const key = irecruitPhoneVariants(r.phone_number)?.[1];
    if (!key) continue;
    const at = new Date(r.created_at);
    if (at.getTime() < (wanted.get(key) ?? Infinity)) continue;
    const cur = out.get(key);
    if (!cur || at.getTime() > Date.parse(cur.appliedAt)) out.set(key, { irecruitId: Number(r.id) || null, appliedAt: at.toISOString() });
  }
  return out;
}

/** ใบที่จดว่าซ้ำไว้แล้ว — ตารางยังไม่มี = Map ว่าง */
export async function loadIrecruitDups(ids: readonly string[]): Promise<Map<string, IrecruitDup>> {
  const out = new Map<string, IrecruitDup>();
  if (ids.length === 0) return out;
  try {
    const { rows } = await dbQuery<{ application_id: string; irecruit_register_id: string | null; irecruit_applied_at: string }>(
      `select application_id::text, irecruit_register_id, irecruit_applied_at from ${DUPS} where application_id = any($1::uuid[])`,
      [ids],
    );
    for (const r of rows) {
      out.set(r.application_id, { irecruitId: r.irecruit_register_id == null ? null : Number(r.irecruit_register_id), appliedAt: new Date(r.irecruit_applied_at).toISOString() });
    }
  } catch (e) {
    if (!isUndefinedTable(e)) throw e;
  }
  return out;
}

async function recordDups(list: ReadonlyArray<{ id: string; dup: IrecruitDup }>): Promise<void> {
  if (list.length === 0) return;
  try {
    await dbQuery(
      `insert into ${DUPS} (application_id, irecruit_register_id, irecruit_applied_at)
       select * from unnest($1::uuid[], $2::bigint[], $3::timestamptz[])
       on conflict (application_id) do nothing`,
      [list.map((x) => x.id), list.map((x) => x.dup.irecruitId), list.map((x) => x.dup.appliedAt)],
    );
  } catch (e) {
    if (!isUndefinedTable(e)) logError('irecruitDup.record failed', e, { count: list.length });
  }
}

/**
 * แยกใบที่จะส่ง AI อัตโนมัติ: ไม่ซ้ำ = ส่ง · ซ้ำ (จดไว้แล้ว หรือเพิ่งเจอ) = ไม่ส่ง + จด
 * `since` = เวลาสมัครของใบเรา (ไม่ส่ง = ตอนนี้) · อ่าน iRecruit ไม่ได้ = ส่งทุกใบที่ยังไม่เคยจดว่าซ้ำ
 */
/** เวลาสมัครของใบเรา · ไม่มี/อ่านไม่ออก = ตอนนี้ */
function sinceOf(v: Date | string | null | undefined): Date {
  const d = v ? new Date(v) : new Date();
  return Number.isFinite(d.getTime()) ? d : new Date();
}

export async function splitIrecruitDuplicates<T extends { id: string; phone: string | null; created_at?: Date | string | null }>(
  apps: readonly T[],
): Promise<{ send: T[]; dups: Array<{ app: T; dup: IrecruitDup }> }> {
  if (apps.length === 0) return { send: [], dups: [] };
  const known = await loadIrecruitDups(apps.map((a) => a.id));
  const unknown = apps.filter((a) => !known.has(a.id));
  let found = new Map<string, IrecruitDup>();
  try {
    found = await lookupIrecruitByPhones(
      unknown.map((a) => ({ phone: a.phone, since: sinceOf(a.created_at) })),
    );
  } catch (e) {
    logError('irecruitDup.lookup failed — ส่ง AI ตามเดิม (เจ้าของเลือก)', e, { count: unknown.length });
  }
  const send: T[] = [];
  const dups: Array<{ app: T; dup: IrecruitDup }> = [];
  for (const a of apps) {
    const k = known.get(a.id) ?? (() => {
      const key = irecruitPhoneVariants(a.phone)?.[1];
      return key ? found.get(key) : undefined;
    })();
    if (k) dups.push({ app: a, dup: k });
    else send.push(a);
  }
  await recordDups(dups.filter((d) => !known.has(d.app.id)).map((d) => ({ id: d.app.id, dup: d.dup })));
  if (dups.length) logInfo('irecruitDup.skip', { skipped: dups.length, sent: send.length });
  return { send, dups };
}
