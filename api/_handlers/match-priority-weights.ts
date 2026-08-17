import { dbQuery } from '../_lib/postgres.js';
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiReq,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { auditFromAuthed } from '../_lib/audit.js';

/**
 * น้ำหนักเกณฑ์เรียงผู้สมัครหน้า Matching — ตั้งที่ Settings แล้วใช้ร่วมกันทั้งทีม
 * อ่านได้ทุก role (หน้า Matching ต้องใช้) · แก้ได้เฉพาะ admin (rbac 'branding' = admin)
 * ค่าเริ่มต้นอยู่ในโค้ดฝั่งหน้าเว็บ (src/lib/candidatePriority.ts) — payload ว่าง = ใช้ค่าเริ่มต้น
 */
const table = tableInAppSchema('app_match_priority_weights');

const CRITERIA = ['age', 'area', 'experience', 'lifestyle', 'criminalRecord', 'salary'] as const;
type Criterion = (typeof CRITERIA)[number];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** รับเฉพาะเกณฑ์ที่รู้จัก น้ำหนัก 0–100 — กันค่าแปลกลง DB */
function sanitize(body: unknown): { weights: Record<string, number>; hard: string[] } | null {
  if (!isPlainObject(body)) return null;
  const rawWeights = body.weights;
  if (!isPlainObject(rawWeights)) return null;

  const weights: Record<string, number> = {};
  for (const key of CRITERIA) {
    const v = rawWeights[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    weights[key] = Math.max(0, Math.min(100, Math.round(v)));
  }
  if (Object.keys(weights).length === 0) return null;

  const rawHard = Array.isArray(body.hard) ? body.hard : [];
  const hard = CRITERIA.filter((c): c is Criterion => rawHard.includes(c));

  return { weights, hard };
}

const DEFAULT_ID = 'default';

/**
 * คีย์ของแถวน้ำหนัก (เจ้าของสั่ง 17 ส.ค. 2569: *"น้ำหนักเรียงผู้สมัคร เอาไปใส่ตามใบขอได้ปะ
 * เผื่อแต่ละใบให้น้ำหนักไม่เท่ากัน · ค่าที่ตั้งไว้ตั้งเป็น Default แล้วถ้าจะแก้ไขไรก็ไปแก้เอง"*)
 *
 * ตาราง `app_match_priority_weights` มี `id` เป็น primary key อยู่แล้ว → ใช้
 * `id = <เลขที่ใบขอ>` เป็นชั้น override ได้เลย ไม่ต้องสร้างตารางใหม่
 * `id = 'default'` = ค่ากลางที่หน้า Settings ตั้ง (เป็นค่าเริ่มต้นของทุกใบ)
 *
 * ⚠️ เลขที่ใบขอต้องเป็น **id เต็ม** ที่ผ่าน `siamrajExternalId` มาแล้ว เพราะเลขที่ใบของ
 * ใบขอปกติกับใบขอล่วงหน้าซ้ำกันได้ 23 ใบ — คีย์ด้วยเลขเปล่าคือใบสองใบใช้น้ำหนักก้อนเดียวกัน
 */
function weightsRowId(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s || s === DEFAULT_ID) return DEFAULT_ID;
  // กันคีย์ยาวเกิน/อักขระแปลก — เก็บเท่าที่เป็นเลขที่ใบขอจริงได้
  return s.slice(0, 64);
}

async function getWeights(req: ApiReq, res: ApiRes): Promise<void> {
  try {
    const rowId = weightsRowId(req.query?.request_no);
    /**
     * อ่านทั้งของใบและค่ากลางในคิวรีเดียว — หน้าจอต้องรู้ทั้งสองอย่างเสมอ:
     * `config` = ค่าที่ใช้จริง (ของใบถ้ามี ไม่มีก็ค่ากลาง)
     * `defaultConfig` = ค่ากลาง (ไว้โชว์ว่า "ค่าเริ่มต้นคือเท่าไร" + ปุ่มรีเซ็ต)
     * `overridden` = ใบนี้ตั้งค่าเองไว้ไหม (ไม่ใช่เดาจากการเทียบค่า — ตั้งเท่ากันก็ยังนับว่าตั้งเอง)
     */
    const { rows } = await dbQuery<{ id: string; payload: unknown }>(
      `select id, payload from ${table} where id = any($1::text[])`,
      [rowId === DEFAULT_ID ? [DEFAULT_ID] : [DEFAULT_ID, rowId]],
    );
    const pick = (id: string) => {
      const p = rows.find((r) => r.id === id)?.payload;
      return !p || (isPlainObject(p) && Object.keys(p).length === 0) ? null : p;
    };
    const defaultConfig = pick(DEFAULT_ID);
    const own = rowId === DEFAULT_ID ? null : pick(rowId);
    res.status(200).json({
      config: own ?? defaultConfig,
      defaultConfig,
      overridden: own != null,
      requestNo: rowId === DEFAULT_ID ? null : rowId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // ยังไม่ได้รัน migration 066 — ให้หน้าเว็บใช้ค่าเริ่มต้นไปก่อน ไม่ใช่ error
    if (/app_match_priority_weights/i.test(msg) && /(does not exist|relation)/i.test(msg)) {
      res.status(200).json({ config: null, message: 'Weights table is not initialized yet' });
      return;
    }
    handleApiError(res, e, 'match-priority-weights GET');
  }
}

async function putWeights(req: AuthedReq, res: ApiRes): Promise<void> {
  try {
    const raw = await readJsonBody(req);
    if (!isPlainObject(raw)) return sendError(res, 400, 'Bad request', 'Expected JSON object');
    const sanitized = sanitize((raw as { config?: unknown }).config ?? raw);
    if (!sanitized) {
      return sendError(res, 400, 'Bad request', 'ต้องมี weights อย่างน้อย 1 เกณฑ์ที่รู้จัก');
    }

    const rowId = weightsRowId(req.query?.request_no);

    await dbQuery(
      `
      insert into ${table} (id, payload, updated_at)
      values ($2, $1::jsonb, now())
      on conflict (id) do update set
        payload = excluded.payload,
        updated_at = now()
      `,
      [JSON.stringify(sanitized), rowId],
    );

    await auditFromAuthed(req, {
      action: 'match_priority_weights.update',
      entityType: 'match_priority_weights',
      entityId: rowId,
      after: sanitized,
    });

    res.status(200).json({ ok: true, config: sanitized, requestNo: rowId === DEFAULT_ID ? null : rowId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/app_match_priority_weights/i.test(msg) && /(does not exist|relation)/i.test(msg)) {
      return sendError(
        res,
        503,
        'Service unavailable',
        'ยังไม่ได้สร้างตารางเก็บน้ำหนัก — รัน migration 066 ก่อน',
      );
    }
    handleApiError(res, e, 'match-priority-weights PUT', { userId: req.user.sub });
  }
}

/**
 * ลบน้ำหนักของใบนั้น → กลับไปใช้ค่ากลางทันที (เจ้าของสั่ง: ค่ากลางเป็น Default)
 * ⚠️ **ห้ามลบแถว 'default'** — ลบแล้วทุกใบจะร่วงไปใช้ค่า hardcode ในโค้ดพร้อมกัน
 */
async function deleteWeights(req: AuthedReq, res: ApiRes): Promise<void> {
  try {
    const rowId = weightsRowId(req.query?.request_no);
    if (rowId === DEFAULT_ID) {
      return sendError(res, 400, 'Bad request', 'ลบค่ากลางไม่ได้ — ระบุ request_no ของใบที่จะรีเซ็ต');
    }
    const { rows } = await dbQuery<{ id: string }>(
      `delete from ${table} where id = $1 returning id`,
      [rowId],
    );
    await auditFromAuthed(req, {
      action: 'match_priority_weights.reset',
      entityType: 'match_priority_weights',
      entityId: rowId,
      after: { removed: rows.length > 0 },
    });
    res.status(200).json({ ok: true, removed: rows.length > 0, requestNo: rowId });
  } catch (e) {
    handleApiError(res, e, 'match-priority-weights DELETE', { userId: req.user.sub });
  }
}

const adminPut = withRbac(putWeights, 'branding');
const adminDelete = withRbac(deleteWeights, 'branding');

export default async function matchPriorityWeightsHandler(req: ApiReq, res: ApiRes): Promise<void> {
  const m = (req.method || 'GET').toUpperCase();
  if (m === 'GET') return getWeights(req, res);
  if (m === 'PUT' || m === 'PATCH') return adminPut(req, res);
  if (m === 'DELETE') return adminDelete(req, res);
  sendError(res, 405, 'Method not allowed', 'Use GET, PUT or DELETE');
}
