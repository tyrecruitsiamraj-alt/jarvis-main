/**
 * ═══ ตัวคิด Dashboard ผู้สมัคร (ใบสมัครจากหน้าสมัครสาธารณะ) ═══
 *
 * สองมุมที่ผู้บริหารถาม:
 * 1. **เข้ามาเท่าไหร่ มาจากไหน** — ใบสมัครต่องวด แยกช่องทาง/ตำแหน่ง/จังหวัด/BU (นับตามวันที่สมัคร)
 * 2. **ไปต่อได้ไกลแค่ไหน** — เส้นทาง สมัคร → โทรแล้ว → ติดต่อได้ → สนใจ → นัด → มาตามนัด
 *    🔴 นับแบบ **กลุ่มเดียวกัน (cohort)**: เอาเฉพาะคนที่สมัครในช่วงที่เลือก แล้วดูว่าไปถึงขั้นไหน
 *    ห้ามเอายอดคนละกลุ่มมาหารกัน (คนสมัครเดือนนี้ ÷ คนที่ได้นัดเดือนนี้ซึ่งสมัครเดือนก่อน = % มั่ว)
 *
 * นิยามขั้น (ตัวกลางเท่านั้น): ผลโทร → ถัง = `bucketOfCall` · "สนใจ" = ผลโทร `confirmed`
 * (ป้าย `CALL_OUTCOME_LABEL.confirmed` = "สนใจ") · มาตามนัด = ผลติดตามนัดล่าสุด `showed`
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

export type FunnelStep = { key: string; label: string; count: number; ofApplied: number | null; ofPrevious: number | null };

/** ขั้นของเส้นทาง — ลำดับนี้คือลำดับบนจอ */
export const FUNNEL_STEPS = [
  { key: 'applied', label: 'สมัคร' },
  { key: 'called', label: 'โทรแล้ว' },
  { key: 'connected', label: 'ติดต่อได้' },
  { key: 'interested', label: 'สนใจ' },
  { key: 'appointment', label: 'ได้นัด' },
  { key: 'showed', label: 'มาตามนัด' },
] as const;

function reached(r: ApplicantTrendRow, key: (typeof FUNNEL_STEPS)[number]['key']): boolean {
  switch (key) {
    case 'applied':
      return true;
    case 'called':
      return r.callBucket === 'connected' || r.callBucket === 'unreached';
    case 'connected':
      return r.callBucket === 'connected';
    case 'interested':
      return r.callOutcome === 'confirmed';
    case 'appointment':
      return Boolean(r.appointmentAt);
    case 'showed':
      return r.attendance === 'showed';
  }
}

/** เส้นทางของคนที่ **สมัครในช่วงนี้** — % เทียบคนสมัคร และเทียบขั้นก่อนหน้า */
export function applicantFunnel(rows: readonly ApplicantTrendRow[], range: { from: string; to: string }): FunnelStep[] {
  const cohort = rows.filter((r) => inRange(appliedYmd(r), range.from, range.to));
  const applied = cohort.length;
  let prev: number | null = null;
  return FUNNEL_STEPS.map((s) => {
    const count = cohort.filter((r) => reached(r, s.key)).length;
    const step: FunnelStep = {
      key: s.key,
      label: s.label,
      count,
      ofApplied: applied ? count / applied : null,
      ofPrevious: prev === null ? null : prev ? count / prev : null,
    };
    prev = count;
    return step;
  });
}
