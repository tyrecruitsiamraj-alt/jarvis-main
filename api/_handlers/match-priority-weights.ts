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

async function getWeights(_req: ApiReq, res: ApiRes): Promise<void> {
  try {
    const { rows } = await dbQuery<{ payload: unknown }>(
      `select payload from ${table} where id = 'default' limit 1`,
    );
    const p = rows[0]?.payload;
    const empty = !p || (isPlainObject(p) && Object.keys(p).length === 0);
    res.status(200).json({ config: empty ? null : p });
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

    await dbQuery(
      `
      insert into ${table} (id, payload, updated_at)
      values ('default', $1::jsonb, now())
      on conflict (id) do update set
        payload = excluded.payload,
        updated_at = now()
      `,
      [JSON.stringify(sanitized)],
    );

    await auditFromAuthed(req, {
      action: 'match_priority_weights.update',
      entityType: 'match_priority_weights',
      entityId: 'default',
      after: sanitized,
    });

    res.status(200).json({ ok: true, config: sanitized });
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

const adminPut = withRbac(putWeights, 'branding');

export default async function matchPriorityWeightsHandler(req: ApiReq, res: ApiRes): Promise<void> {
  const m = (req.method || 'GET').toUpperCase();
  if (m === 'GET') return getWeights(req, res);
  if (m === 'PUT' || m === 'PATCH') return adminPut(req, res);
  sendError(res, 405, 'Method not allowed', 'Use GET or PUT');
}
