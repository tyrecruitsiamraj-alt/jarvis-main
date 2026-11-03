/**
 * ═══ ค่าตั้งต้นของประกาศจากใบขอ — ที่เดียว (ป๊อป Gen link + Autopost กดทีเดียวจบ) ═══
 * เจ้าของ 3 พ.ย. 2569 Choice "ใช่ กด Autopost ทีเดียวจบ" — ใบที่ยังไม่ประกาศ Autopost สร้างประกาศให้เอง
 * ต้องได้หน้าตาเดียวกับกด Gen link จากป๊อปประกาศเป๊ะ ⇒ ค่าตั้งต้นอยู่ที่นี่ ห้ามเขียนซ้ำในป๊อป
 * - หัวข้อนำด้วยตำแหน่ง ไม่ใช่ชื่อบริษัท (27 ส.ค. 2569)
 * - ที่อยู่ตัดชื่อ/เบอร์คนฝั่งลูกค้าออกก่อน (22 ก.ย. 2569 `scrubPublicLocation`)
 */
import type { JobRequest } from '@/types';
import type { CreatePostingBody } from '@/lib/recruitPostingsApi';
import { jobBoardCardTitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { inferProvinceFromAddress } from '@/lib/parseThaiJobAddress';
import { scrubPublicLocation } from '@/lib/publicLocationText';

export type JobPostingDraft = {
  title: string;
  locationText: string;
  contactName: string;
  contactPhone: string;
  positionName: string;
  province: string;
};

export function jobPostingDraft(job: JobRequest): JobPostingDraft {
  return {
    title: [publicJobPositionLabel(job), jobBoardCardTitle(job)].filter(Boolean).join(' · '),
    locationText: scrubPublicLocation(job.location_address),
    contactName: job.contact_name ?? '',
    contactPhone: job.contact_phone ?? '',
    positionName: job.staff_title_name ?? '',
    province: inferProvinceFromAddress(job.location_address || '') ?? '',
  };
}

/** ประกาศของใบขอแบบไม่ต้องกรอกอะไร — ลิงก์กลาง 1 อัน (ไม่ส่งช่องทาง) */
export function jobPostingBody(job: JobRequest): CreatePostingBody {
  const d = jobPostingDraft(job);
  return {
    jobId: job.id,
    standaloneKind: null,
    departmentCode: job.department_code ?? null,
    title: d.title,
    detail: null,
    locationText: d.locationText || null,
    salaryText: null,
    contactName: d.contactName || null,
    contactPhone: d.contactPhone || null,
    channels: [],
    positionName: d.positionName.trim() || null,
    province: d.province || null,
    responsibleName: null,
    responsibleUserId: null,
    specificType: null,
    formType: 'rm',
  };
}
