/**
 * ═══ "ข้อมูลใบขอ" — ตารางข้อเท็จจริงของใบขอหนึ่งใบ ═══
 *
 * 🔴 **แหล่งเดียวของชุดช่องนี้** (แยกออกมา 28 ส.ค. 2569)
 *
 * เจ้าของสั่ง: *"เปิดใบขอเต็ม ๆ ก็ไม่ต้องเด้งไปหน้าใบงานสิ กดแล้วก็ขยายให้ดูเลยสิ"*
 * ⇒ popup ไล่งานบนกล่องงานต้องกางข้อมูลชุดนี้ให้ดูในกล่องเลย ไม่พาออกไปหน้าอื่น
 *
 * เดิมชุดนี้เขียนอยู่ในหน้ารายละเอียดใบขอที่เดียว (26 ช่อง) ⇒ ถ้าก๊อปไปไว้ใน popup
 * อีกชุด วันหน้าฝั่งใดฝั่งหนึ่งจะเพิ่ม/แก้ช่องแล้วอีกฝั่งไม่ตาม (บทเรียนซ้ำของโปรเจกต์นี้)
 * จึงยกมาเป็น component ให้ **ทั้งสองที่เรียกตัวเดียวกัน**
 *
 * ⚠️ กติกาที่ติดมากับชุดนี้ ห้ามแก้เผลอ:
 * - **ห้าม fallback "รหัสไซต์" ไปชื่อหน่วยงาน** — ใบขอล่วงหน้าไม่มีรหัสไซต์ แล้วช่องนั้น
 *   จะขึ้นชื่อบริษัททำให้คนอ่านเข้าใจว่านั่นคือรหัส (เจอจริง 18 ส.ค. 2569)
 * - **ไม่รู้ค่า = "—" ห้ามขึ้น 0** · แต่ 0 ที่มาจากฐานจริงต้องขึ้น "0 บาท"
 * - เงินของคนที่ออกมี **สองชุดคนละเรื่อง** (อัตราตามเงื่อนไข vs จ่ายจริง) อย่าสลับกัน
 *   — ชุดนั้นอยู่คนละบล็อกในหน้าใบขอ ไม่ได้อยู่ในตารางนี้
 */
import React from 'react';

import { formatYmdDmyBe } from '@/lib/dateTh';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { moneyFieldText } from '@/lib/unitRequestDetail';
import type { JobRequest } from '@/types';

/** ช่องข้อเท็จจริงหนึ่งช่อง — ไม่มีค่า = "—" (ห้ามปล่อยว่างให้คนเดา) */
export function Field({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  const display = value === undefined || value === null || value === '' ? '—' : value;
  return (
    <div className="rounded-xl border border-white/70 bg-white/40 px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{display}</div>
    </div>
  );
}

const UnitRequestInfoFields: React.FC<{ job: JobRequest }> = ({ job: data }) => (
  <div className="grid gap-2 sm:grid-cols-2">
    <Field label="เลขที่ใบขอ" value={data.request_no} />
    <Field label="ชื่อผู้ส่ง" value={data.submittedByName} />
    <Field
      label="วัน/เวลาที่ส่ง"
      value={data.submittedAt ? new Date(data.submittedAt).toLocaleString('th-TH') : undefined}
    />
    <Field label="วันที่ต้องการ" value={formatYmdDmyBe(data.required_date)} />
    <Field
      label="ขอมา"
      value={
        data.request_positions != null && data.request_positions > 0
          ? `${data.request_positions.toLocaleString('th-TH')} ตำแหน่ง`
          : undefined
      }
    />
    <Field
      label="หาได้แล้ว"
      value={
        data.filled_positions != null
          ? `${data.filled_positions.toLocaleString('th-TH')} ตำแหน่ง`
          : undefined
      }
    />
    <Field label="คงเหลือ (ต้องหา)" value={`${jobPositionUnits(data)} ตำแหน่ง`} />
    <Field
      label="ทำงานวันสุดท้าย"
      value={data.lastWorkingDay ? formatYmdDmyBe(data.lastWorkingDay) : undefined}
    />
    {/* ชื่อเดียว = จุดทำงาน (ไม่มีก็ถอยไปชื่อคู่สัญญา) — เจ้าของสั่งไม่ให้ขึ้นสองแถว */}
    <Field label="ชื่อหน่วยงาน" value={data.work_site_name || data.unit_name} />
    {/* ⚠️ ห้าม fallback ไปชื่อหน่วยงาน — เหตุผลอยู่หัวไฟล์ */}
    <Field label="รหัสไซต์" value={data.site_code} />
    <Field label="สถานที่ปฏิบัติงาน" value={data.work_place} />
    <Field label="สถานที่ทำงาน (ที่อยู่เต็ม)" value={data.location_address} />
    <Field label="ลักษณะงาน" value={data.job_description_code_1} />
    <Field
      label="ตำแหน่ง (รายละเอียด)"
      value={data.staff_title_name || data.job_description_code_2}
    />
    <Field
      label="ช่วงอายุ"
      value={
        data.age_range_min != null || data.age_range_max != null
          ? `${data.age_range_min ?? '—'} – ${data.age_range_max ?? '—'} ปี`
          : undefined
      }
    />
    <Field label="เพศ" value={data.gender_requirement} />
    <Field label="สัญชาติเจ้านาย" value={data.boss_nationality} />
    <Field label="ประเภทใบขอ" value={data.request_action_name} />
    <Field
      label="รายได้ (อัตราจ่าย)"
      value={data.total_income ? `฿${data.total_income.toLocaleString()}` : undefined}
    />
    <Field label="วันเวลาเข้างาน" value={data.work_schedule} />
    <Field label="ชื่อผู้ติดต่อหน่วยงาน" value={data.contact_name} />
    <Field label="เบอร์ติดต่อ" value={data.contact_phone} />
    <Field label="ค่าปรับต่อวันถ้าไม่มีคน" value={moneyFieldText(data.penalty_per_day)} />
  </div>
);

export default UnitRequestInfoFields;
