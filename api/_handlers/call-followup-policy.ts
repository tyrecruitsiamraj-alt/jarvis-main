/**
 * ═══ GET/PUT /api/call-followup-policy — โทรซ้ำคนที่ไม่รับสาย (เจ้าของ 26 ต.ค. 2569) ═══
 * > *"ไม่รับสายแล้วโทรวันถัดไป ขอเป็นโทรใหม่ตอนเที่ยง · ขอหน้าไว้ตั้งเวลาผ่าน UI"* · Choice: ทุกงานที่ AI โทร · Admin แก้
 * - GET: ค่าที่ใช้อยู่
 * - PUT (admin): ช่องโทรซ้ำเป็นรอบ (27 ต.ค. 2569) `{ roundCalls, roundGapMinutes, roundsPerDay, roundsGapHours, retryDays,
 *   callFrom, callTo, dayMorning, dayAfternoon }` — maxAttempts คิดให้เอง · ค่าอื่นของนโยบายคงเดิม · จดบันทึกการใช้งานทุกครั้ง
 * ความหมาย/ตัวกรองค่าอยู่ `src/lib/callFollowupPolicy.ts` ที่เดียว · เก็บใน app_call_followup_policy (073)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { getCallFollowupPolicy, setCallFollowupPolicy } from '../_lib/callFollowupPolicyStore.js';
import { normalizeCallFollowupPolicy, ROUND_LIMITS } from '../../src/lib/callFollowupPolicy.js';

const ROUND_FIELD_LABEL: Record<keyof typeof ROUND_LIMITS, string> = {
  roundCalls: 'สายต่อรอบ',
  roundGapMinutes: 'เว้นระหว่างสาย (นาที)',
  roundsPerDay: 'รอบต่อวัน',
  roundsGapHours: 'เว้นระหว่างรอบ (ชม.)',
  retryDays: 'จำนวนวัน',
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ policy: await getCallFollowupPolicy() });
    }
    if (method === 'PUT') {
      if (req.user?.role !== 'admin') return sendError(res, 403, 'Forbidden', 'เฉพาะผู้ดูแลระบบที่แก้ได้');
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) return sendError(res, 400, 'Bad request', 'ข้อมูลไม่ถูกต้อง');
      const body = raw as Record<string, unknown>;
      // ตัวเลขนอกขอบ = แจ้งกลับ (ไม่บีบเงียบ ๆ) · ขอบอยู่ `ROUND_LIMITS` ที่เดียว
      for (const [k, [min, max]] of Object.entries(ROUND_LIMITS)) {
        const v = Number(body[k]);
        if (!Number.isInteger(v) || v < min || v > max) return sendError(res, 400, 'Bad request', `${ROUND_FIELD_LABEL[k as keyof typeof ROUND_LIMITS]} ต้องเป็น ${min}–${max}`);
      }
      for (const k of ['callFrom', 'callTo', 'dayMorning', 'dayAfternoon'] as const) {
        if (typeof body[k] !== 'string' || !HHMM.test(String(body[k]).trim())) return sendError(res, 400, 'Bad request', 'เวลาต้องเป็นรูปแบบ ชม.:นาที');
      }
      if (String(body.callTo) <= String(body.callFrom)) return sendError(res, 400, 'Bad request', 'เวลาเลิกโทรต้องหลังเวลาเริ่มโทร');
      const before = await getCallFollowupPolicy();
      const pick = (p: typeof before) => ({
        roundCalls: p.roundCalls,
        roundGapMinutes: p.roundGapMinutes,
        roundsPerDay: p.roundsPerDay,
        roundsGapHours: p.roundsGapHours,
        retryDays: p.retryDays,
        callFrom: p.callFrom,
        callTo: p.callTo,
        dayMorning: p.dayMorning,
        dayAfternoon: p.dayAfternoon,
        maxAttempts: p.maxAttempts,
      });
      // รับเฉพาะช่องของหน้านี้ — ค่าอื่นของนโยบาย (ห้ามโทร · พักเบอร์ ฯลฯ) คงเดิม
      const roundKeys = [...Object.keys(ROUND_LIMITS), 'callFrom', 'callTo', 'dayMorning', 'dayAfternoon'];
      const next = normalizeCallFollowupPolicy({ ...before, ...Object.fromEntries(roundKeys.map((k) => [k, body[k]])) });
      const saved = await setCallFollowupPolicy(next, req.user?.email ?? null);
      await auditFromAuthed(req, {
        action: 'call-followup-policy.update',
        entityType: 'app_call_followup_policy',
        entityId: 'default',
        before: pick(before),
        after: pick(saved),
      });
      return res.status(200).json({ policy: saved });
    }
    res.setHeader?.('Allow', 'GET, PUT');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'call-followup-policy', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'call-followup-policy');
