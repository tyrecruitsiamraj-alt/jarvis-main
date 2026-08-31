/**
 * GET/PUT/DELETE /api/call-scripts — บทพูดของ AI แก้ได้จากหน้าตั้งค่า
 * (เจ้าของสั่ง 27 ส.ค. 2569: *"ฉันแก้ Script การพูดจากฝั่งฉันแล้วให้มันส่งไป
 * พร้อมกันให้ Lumos เลย"*)
 *
 * - GET    → บททั้ง 3 ชุด: ฉบับที่ใช้จริงตอนนี้ + ฉบับมาตรฐาน + ใครแก้ล่าสุด
 *            แถมรายชื่อตัวแปร {ที่ใช้ได้} ให้จอวาดเป็นตัวช่วย
 * - PUT    → บันทึกฉบับแก้หนึ่งชุด (validate ก่อนเสมอ — ดู callScriptStore)
 * - DELETE → ลบฉบับแก้ = กลับไปใช้บทมาตรฐานทันที (ทางถอยไม่ต้อง deploy)
 *
 * 🔴 มีผลกับ **สายที่เข้าคิวหลังบันทึก** — สายที่ค้างคิวอยู่แล้วถือบทเดิมของมันไป
 * (payload ประกอบตอน enqueue · เปลี่ยนย้อนหลัง = คนฟังกับคนตรวจเห็นคนละบท)
 *
 * สิทธิ์: supervisor ขึ้นไป — บทคือเสียงของบริษัทที่พูดกับคนจริง
 */
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { withAuth, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import {
  EDITABLE_SCRIPT_KEYS,
  invalidateCallScriptCache,
  isEditableScriptKey,
  validateScriptLines,
} from '../_lib/callScriptStore.js';
import {
  EDITABLE_SCRIPT_DEFAULTS,
  KNOWN_PLACEHOLDERS,
  MAX_QUESTIONS,
  type EditableScriptKey,
} from '../_lib/lumosCallScript.js';

const tbl = tableInAppSchema('call_script_overrides');

/** คำอธิบายแต่ละบท — จอใช้เป็นหัวข้อ ให้คนแก้รู้ว่าบทนี้โทรหาใคร */
const SCRIPT_META: Record<EditableScriptKey, { label: string; hint: string }> = {
  interview: {
    label: 'สัมภาษณ์เบื้องต้น',
    hint: 'โทรหาคนที่ยังไม่ได้สมัครงานใบนี้ — เราไปหาเขาเอง ต้องแนะนำตัวก่อนเสมอ',
  },
  offer: {
    label: 'เสนองาน',
    hint: 'โทรหาคนที่ติดต่อเรามาแล้ว (ฝากใบสมัคร/อยู่บนบอร์ด) — ไม่ต้องถามประสบการณ์ซ้ำ',
  },
  follow: {
    label: 'ติดตาม — สายแรก',
    hint: 'สายแรกของงานติดตามนั้น · เรื่องที่พูดมาจากที่เจ้าหน้าที่พิมพ์ บทนี้เป็นกรอบห่อ',
  },
  follow_repeat: {
    label: 'ติดตาม — รอบที่ 2 เป็นต้นไป',
    hint: 'สายรอบถัด ๆ ไปของงานเดียวกัน — ไม่แนะนำตัวใหม่เหมือนไม่เคยคุยกัน ให้อ้างถึงสายก่อนหน้า',
  },
};

type OverrideRow = { script_key: string; lines: unknown; updated_by: string | null; updated_at: string };

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      const { rows } = await dbQuery<OverrideRow>(
        `select script_key, lines, updated_by, updated_at from ${tbl}`,
      );
      const byKey = new Map(rows.map((r) => [r.script_key, r]));
      return res.status(200).json({
        max_lines: MAX_QUESTIONS,
        placeholders: KNOWN_PLACEHOLDERS,
        scripts: EDITABLE_SCRIPT_KEYS.map((key) => {
          const o = byKey.get(key);
          const overridden = Boolean(o && validateScriptLines(o.lines) === null);
          return {
            key,
            ...SCRIPT_META[key],
            default_lines: EDITABLE_SCRIPT_DEFAULTS[key],
            lines: overridden ? (o!.lines as string[]) : EDITABLE_SCRIPT_DEFAULTS[key],
            overridden,
            updated_by: overridden ? o!.updated_by : null,
            updated_at: overridden ? o!.updated_at : null,
          };
        }),
      });
    }

    // เขียน = supervisor ขึ้นไป (บทคือเสียงที่พูดกับคนจริง)
    if (req.user.role !== 'admin' && req.user.role !== 'supervisor') {
      return sendError(res, 403, 'Forbidden', 'ต้องเป็น supervisor ขึ้นไปจึงแก้บทพูดได้');
    }

    if (method === 'PUT') {
      const body = (await readJsonBody(req)) as { key?: unknown; lines?: unknown };
      if (!isEditableScriptKey(body.key)) {
        return sendError(res, 400, 'Bad request', 'ไม่รู้จักบทนี้');
      }
      const err = validateScriptLines(body.lines);
      if (err) return sendError(res, 400, 'Bad request', err);
      const lines = (body.lines as string[]).map((l) => l.trim());
      await dbQuery(
        `insert into ${tbl} (script_key, lines, updated_by, updated_at)
         values ($1, $2::jsonb, $3, now())
         on conflict (script_key)
         do update set lines = excluded.lines, updated_by = excluded.updated_by, updated_at = now()`,
        [body.key, JSON.stringify(lines), req.user.email || req.user.sub],
      );
      invalidateCallScriptCache();
      return res.status(200).json({ ok: true, key: body.key, lines });
    }

    if (method === 'DELETE') {
      /* ⚠️ DELETE รับ key ทาง query — body ของ DELETE ถูกกลืนระหว่างทางได้
         (เจอจริงตอนตรวจ: readJsonBody คืน null แล้วล้ม 500 ทั้งที่ client ส่ง body มา) */
      const key = typeof req.query?.key === 'string' ? req.query.key : '';
      if (!isEditableScriptKey(key)) {
        return sendError(res, 400, 'Bad request', 'ไม่รู้จักบทนี้ — ส่ง ?key=interview|offer|follow');
      }
      await dbQuery(`delete from ${tbl} where script_key = $1`, [key]);
      invalidateCallScriptCache();
      return res.status(200).json({ ok: true, key, lines: EDITABLE_SCRIPT_DEFAULTS[key] });
    }

    return sendError(res, 405, 'Method not allowed', 'GET / PUT / DELETE เท่านั้น');
  } catch (e) {
    return handleApiError(res, e, 'call-scripts');
  }
}

export default withAuth(handler);
