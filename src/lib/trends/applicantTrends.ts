/**
 * ═══ ตัวคิด Dashboard ผู้สมัคร (ใบสมัครจากหน้าสมัครสาธารณะ) — มิติที่ใช้แยก ═══
 *
 * ใบสมัครต่องวด แยกช่องทาง/ตำแหน่ง/จังหวัด/BU (นับตามวันที่สมัคร)
 * เส้นทาง "เข้ามา → ส่ง Lumos → โทร → ผล" อยู่ `lumosPipeline.ts` (ตัวเดียว — เส้นทางเดิมที่นับผลโทรจากเบอร์
 * ถูกถอดแล้ว 28 ก.ย. 2569 เพราะคำว่า "สนใจ" คนละนิยามกับผลโทรจากคำพูด)
 */
import { REFERRAL_SOURCE_LABEL, type ApplicationReferralSource } from '@/lib/publicApplicationsApi';
import { bangkokYmd, inRange } from './timeBuckets';
import { trendBuLabel } from './bu';
import type { ApplicantTrendRow } from './types';

export type ApplicantDim = 'channel' | 'position' | 'province' | 'bu';

export const APPLICANT_DIM_LABEL: Record<ApplicantDim, string> = {
  channel: 'ช่องทาง',
  position: 'ตำแหน่ง',
  province: 'จังหวัด',
  bu: 'BU',
};

export function applicantDimGetter(dim: ApplicantDim): (row: ApplicantTrendRow) => string {
  switch (dim) {
    case 'channel':
      return (r) => (r.channel ? REFERRAL_SOURCE_LABEL[r.channel as ApplicationReferralSource] ?? r.channel : 'ไม่ระบุ');
    case 'position':
      return (r) => r.position ?? 'ไม่ระบุ';
    case 'province':
      return (r) => r.province ?? 'ไม่ระบุ';
    case 'bu':
      return (r) => trendBuLabel(r.bu);
  }
}

export const appliedYmd = (r: ApplicantTrendRow) => bangkokYmd(r.createdAt);
