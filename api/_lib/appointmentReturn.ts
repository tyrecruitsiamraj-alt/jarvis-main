import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError } from './logger.js';

/**
 * ═══ ไม่มาตามนัด / ไม่ผ่าน ⇒ กลับแท็บผู้สมัคร (เจ้าของเคาะ 24 พ.ย. 2569) ═══
 * > *"ย้ายไปก็ได้แต่ต้องบอกอะว่าเคยนัดไปหน่วยงานไหนแล้วไม่ไป ที่ประวัตินัดหมายอะ"*
 *
 * เดิมใบค้างสถานะ `converted` อยู่แท็บติดตามนัดหมายตลอด คนเก็บไม่ถูกปลด ⇒ ไม่มีใครเสนองานอื่นให้
 * ตอนนี้: สถานะ → `contacted` (ออกจากแท็บนัดหมาย) · ปลดคนเก็บ + Lead + ล็อกเบอร์ ⇒ ใครก็เก็บไปเสนองานอื่นได้
 * 🔴 AI ไม่โทรเอง — `call_choice` ว่างให้จดเป็น `manual` (ตัวส่งอัตโนมัติรอบ 5 นาทีข้าม) · ไม่ตั้ง `unclaimed_at`
 * ประวัตินัด (วัน · หน่วยงาน · ผล) ยังอยู่ครบในตารางผลนัด — แสดงที่ "ประวัตินัดหมาย" ของคนนี้ (`appointmentHistory.ts`)
 *
 * กลับมาลง มา / เลื่อนนัด / ผ่าน ทีหลัง (แก้ผลที่กดพลาด) ⇒ กลับเข้าแท็บนัดหมาย (`restoreAppointmentStatus`)
 */
const apps = tableInAppSchema('public_job_applications');
const holds = tableInAppSchema('candidate_call_holds');

export async function returnApplicantAfterAppointment(applicationId: string, byName: string | null): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(
    `update ${apps}
        set status = 'contacted',
            claimed_by = null, claimed_by_name = null, claimed_at = null,
            is_lead = false, lead_by = null, lead_by_name = null, lead_at = null,
            call_choice = coalesce(call_choice, 'manual'),
            call_choice_at = case when call_choice is null then now() else call_choice_at end,
            call_choice_by_name = case when call_choice is null then $2 else call_choice_by_name end,
            updated_at = now()
      where id = $1 and status = 'converted'
      returning id`,
    [applicationId, byName],
  );
  if (rows.length === 0) return false;
  // ล็อกเบอร์ของใบนี้ (ใครถือก็คืน) — ไม่คืน = คนอื่นเก็บไปโทรไม่ได้
  try {
    await dbQuery(
      `update ${holds} set released_at = now(), release_reason = 'manual', updated_at = now()
        where released_at is null and source = 'application' and candidate_ref = $1`,
      [applicationId],
    );
  } catch (e) {
    if (!isPgUndefinedTable(e)) logError('appointment-return: คืนล็อกเบอร์ไม่สำเร็จ', e, { applicationId });
  }
  return true;
}

/** ลงผล มา / เลื่อนนัด / ผ่าน หลังจากเคยลงไม่มา/ไม่ผ่าน ⇒ ใบกลับแท็บนัดหมาย (ไม่คืนคนเก็บให้ — ไม่เดาแทนคน) */
export async function restoreAppointmentStatus(applicationId: string): Promise<boolean> {
  const { rows } = await dbQuery<{ id: string }>(
    `update ${apps} set status = 'converted', updated_at = now()
      where id = $1 and status = 'contacted'
      returning id`,
    [applicationId],
  );
  return rows.length > 0;
}
