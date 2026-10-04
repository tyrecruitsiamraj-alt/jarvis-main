import { dbTransaction } from '../../_lib/postgres.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { readJsonBody } from '../../_lib/body.js';
import { tableInAppSchema } from '../../_lib/schema.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { validatePublicApplication } from '../../_lib/publicApplications.js';
import { resolveApplicationDepartment } from '../../_lib/applicationDepartment.js';
import { enqueueLumosInterviewForApplications } from '../../_lib/lumosDispatch.js';
import { logError } from '../../_lib/logger.js';
import { auditFromAnonymous } from '../../_lib/audit.js';
import { applicantClientIp, lockAndFindRepeat } from '../../_lib/applicationRepeatGuard.js';
import { repeatPublicMessage } from '../../../src/lib/applicationRepeat.js';

/** คอลัมน์ที่ยังไม่ถูก migrate — pg ตอบ 42703 */
function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === '42703';
}

const tbl = tableInAppSchema('public_job_applications');

/**
 * จด log ของการกดส่งจากหน้าสมัคร — **IP + เบราว์เซอร์มาจากบริบทของ audit เอง** (เจ้าของ Choice 1 ต.ค. 2569:
 * "เก็บ Log พอไม่ต้องเอามาโชว์") · ไม่มีจอไหนอ่าน
 * ⚠️ ไม่จดชื่อ/เบอร์ลง log (มีอยู่ในใบแล้ว) · ล้มห้ามทำให้การส่งใบล้ม (createAuditEvent กลืน error เอง)
 */
function logPublicApply(
  req: ApiReq,
  action: 'public_application.submit' | 'public_application.repeat_rejected',
  entityId: string,
  v: { jobId: string | null; postingId: string | null },
  extra: Record<string, unknown> = {},
): void {
  void auditFromAnonymous(req, { userName: 'หน้าสมัครงาน' }, {
    action,
    entityType: 'job_application',
    entityId,
    after: { job_id: v.jobId, posting_id: v.postingId, ...extra },
  }).catch(() => {});
}

/** POST /api/public/apply — รับใบสมัครจากหน้า /apply โดยไม่ต้องล็อกอิน */
export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST') return sendError(res, 405, 'Method not allowed');

  if (!rateLimitOrReject(req, res, 'public-apply', 5, 10 * 60 * 1000)) return;

  try {
    const parsed = validatePublicApplication(await readJsonBody(req));
    if (!parsed.ok) return sendError(res, 400, 'Bad request', parsed.message);
    const v = parsed.value;

    const docBytes = v.document ? Buffer.from(v.document.base64, 'base64') : null;
    // จำแผนกเจ้าของงานไว้กับใบ — ใบขอปิดแล้วรายชื่อต้องยังอยู่ในคลังกลาง (migration 082)
    const departmentCode = await resolveApplicationDepartment({
      postingId: v.postingId,
      jobId: v.jobId,
    });

    const VALUES = [
      v.fullName,
      v.titlePrefix,
      v.firstName,
      v.lastName,
      v.phone,
      v.age,
      v.gender,
      v.province,
      v.district,
      v.subdistrict,
      v.postalCode,
      v.weightKg,
      v.heightCm,
      v.education,
      v.referralSource,
      v.document?.filename ?? null,
      v.document?.mime ?? null,
      v.document?.size ?? null,
      docBytes,
      v.jobId,
      v.jobTitle,
      v.unitName,
      v.positionInterest,
      v.note,
      v.postingId,
      v.linkId,
    ];
    const BASE_COLS = `full_name, title_prefix, first_name, last_name, phone, age, gender,
         province, district, subdistrict, postal_code,
         weight_kg, height_cm, education, referral_source,
         document_filename, document_mime, document_size, document_bytes,
         job_id, job_title, unit_name, position_interest, note,
         posting_id, link_id`;
    const placeholders = (n: number) => Array.from({ length: n }, (_, i) => `$${i + 1}`).join(', ');

    /**
     * 🔴 สมัครซ้ำต้องรอ 14 วัน (เจ้าของสั่ง 1 ต.ค. 2569) — เบอร์เดิม (ไม่ว่างานไหน) **หรือ** IP เดิม (Choice "IP ละ 1 ใบใน 14 วัน")
     * ตัดสินในธุรกรรมเดียวกับ insert + ล็อกเบอร์/IP (`lockAndFindRepeat`) — กดส่งรัว ๆ ก็เข้าได้ใบเดียว
     * ข้อความไม่บอกรายละเอียดใบเดิม (หน้าสาธารณะ ใครพิมพ์เบอร์ใครก็ได้) · บอกวันที่สมัครใหม่ได้
     *
     * ⚠️ **เส้นนี้เป็นสาธารณะ — ห้ามพังเพราะ schema ยังไม่อัปเดต**: ลองชุดเต็มก่อน แล้วถอยทีละชั้น
     * (`client_ip` 132 · `department_code` 082) — ใบสมัครของคนจริงต้องถูกบันทึกเสมอ
     * (ต่างจากฟอร์มที่เจ้าหน้าที่คีย์เอง ซึ่งจงใจคืน 503)
     */
    const ip = applicantClientIp(req);
    const outcome = await dbTransaction(async (client) => {
      const hit = await lockAndFindRepeat(client, { phone: v.phone, ip });
      if (hit) return { hit };
      const attempts: Array<{ cols: string; values: unknown[] }> = [
        { cols: `${BASE_COLS}, department_code, client_ip`, values: [...VALUES, departmentCode, ip] },
        { cols: `${BASE_COLS}, department_code`, values: [...VALUES, departmentCode] },
        { cols: BASE_COLS, values: VALUES },
      ];
      for (const a of attempts) {
        await client.query('savepoint apply_insert');
        try {
          const { rows } = await client.query<{ id: string }>(
            `insert into ${tbl} (${a.cols}) values (${placeholders(a.values.length)}) returning id`,
            a.values,
          );
          await client.query('release savepoint apply_insert');
          return { id: rows[0]?.id ?? null };
        } catch (e) {
          await client.query('rollback to savepoint apply_insert');
          if (!isUndefinedColumn(e)) throw e;
        }
      }
      return { id: null };
    });
    if ('hit' in outcome && outcome.hit) {
      logPublicApply(req, 'public_application.repeat_rejected', 'repeat', v, { kind: outcome.hit.kind });
      return sendError(res, 409, 'Conflict', repeatPublicMessage(outcome.hit.kind, outcome.hit.lastAt));
    }
    const id = 'id' in outcome ? outcome.id : null;
    if (!id) return sendError(res, 500, 'Failed to submit application');
    logPublicApply(req, 'public_application.submit', id, v);

    /**
     * ส่งเข้าคิว AI โทร **อัตโนมัติทันทีที่กรอก** (เจ้าของเคาะ 15 ส.ค. 2569)
     * - kill-switch: env APPLICATION_AUTO_DISPATCH_ENABLED (ไม่ตั้ง/ไม่ใช่ true = ปิด
     *   — fail-safe ไปทาง manual · ใบที่ตกหล่นส่งได้จากปุ่มในกล่องงาน)
     * - ⚠️ **enqueue ล้มห้ามทำให้ /apply ล้ม** — ใบสมัครของคนจริงถูกบันทึกไปแล้วข้างบน
     *   ที่เหลือแค่ log · กันชั้น held/suppressed อยู่ใน insertQueueItems แล้ว
     * - แค่เข้าคิว ไม่ใช่โทรทันที — Lumos มาดึงคิวเองเป็นระยะ (โหมดโทรยัง manual ฝั่งเขา)
     */
    if ((process.env.APPLICATION_AUTO_DISPATCH_ENABLED || '').trim().toLowerCase() === 'true') {
      try {
        if (v.jobId) {
          await enqueueLumosInterviewForApplications(v.jobId, [
            {
              id,
              full_name: v.fullName,
              phone: v.phone,
              job_id: v.jobId,
              job_title: v.jobTitle,
              unit_name: v.unitName,
              position_interest: v.positionInterest,
            },
          ], { autoPush: true });
        }
      } catch (e) {
        logError('public/apply auto-dispatch failed (ใบสมัครถูกบันทึกแล้ว — ส่งซ้ำได้จากงานสรรหา)', e, {
          applicationId: id,
        });
      }
    }

    return res.status(201).json({ ok: true, id });
  } catch (e) {
    return handleApiError(res, e, 'public/apply');
  }
}
