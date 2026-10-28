/**
 * ═══ หน้าหลักสรุปหน้าเดียว — เส้นผู้สมัคร 6 ขั้น + แถบช่องทางใต้ทุกขั้น (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"กรอกมาเนี่ย Ai คัดกรองให้แล้วอย่างละเท่าไหร่ · คนมาโทรต่อจาก Ai เท่าไหร่ · ติดต่อสำเร็จ ไม่สำเร็จ · นัดได้ นัดไม่ได้ ·
 * > นัดแล้วมา ไม่มา · คนกรอกมาเนี่ยมาจากไหน"* → Choice แถบช่องทางใต้ทุกขั้น · iRecruit เป็นแท่งของตัวเอง
 * ข้อเท็จจริงต่อใบชุดเดียวกับแท็บภาพรวมงานสรรหา (`/api/recruit-overview` · `RecruitAppFact`) — ไม่มีนิยามใหม่ · pure
 * 🔴 ทุกขั้น: แถบช่องทางรวมกัน = เลขของขั้น · แถวย่อยรวมกัน = เลขของขั้น ยกเว้นขั้นคนโทรต่อ (แถว "เก็บไปหน้าติดต่อ" เป็นเลขประกอบ)
 *    เทสต์ `tests/api/homeOverviewFunnel.test.ts`
 */
import { appliedYmd } from './recruitOverview';
import type { RecruitAppFact } from './recruitOverviewTypes';

/** 4 ช่องทางหลักของหน้าช่องทาง + iRecruit (เจ้าของ "iRecruit เอามารวม" → แท่งแยก) + ใบที่สมัครผ่านเว็บเราแต่ไม่ได้เลือกช่องทาง */
export const FUNNEL_CHANNELS = ['Facebook', 'Tiktok', 'Webjob', 'Offline', 'iRecruit', 'เว็บ So Recruit'] as const;
export type FunnelChannel = (typeof FUNNEL_CHANNELS)[number];

const WEB = /webjob|jobthai|jobbkk|jobsdb|job\s*db|jobfinfin|jonfinfin|linkedin|linkin|google|internet/i;
const OFFLINE = /offline|ป้าย|ใบปลิว|แนะนำ|บอกต่อ|เพื่อน|ญาติ|ผู้ประสานงาน|จนท\.|เจ้าหน้าที่|พนักงานเก่า|โอนมา|สำนักงานใหญ่|academe|walk\s*in|call\s*in/i;

/**
 * ช่องทางหลักของใบ — ป้าย "หลัก · รอง" ใช้ชื่อหลัก · iRecruit ที่บอกช่องทางย่อย (เช่น "iRecruit · Jobthai") ใช้ช่องทางนั้น
 * ไม่มีป้ายเลย = ช่องทางที่ผู้สมัครเลือกในฟอร์มเก่า (referral) · ไม่มีทั้งคู่ = สมัครผ่านเว็บเราแต่ไม่ได้เลือก
 * (28 ต.ค. 2569 วัดจริง: 25 ใบของ ต.ค. กรอกเองทั้งหมด — ฟอร์มบังคับเลือกช่องทางแล้ว)
 */
export function funnelChannelOf(f: Pick<RecruitAppFact, 'channelLabel' | 'referralSource'>): FunnelChannel {
  const parts = (f.channelLabel ?? '').split(' · ').map((p) => p.trim()).filter(Boolean);
  let head = parts[0] ?? '';
  const irecruit = /^irecruit$/i.test(head);
  if (irecruit) head = parts[1] ?? '';
  if (/^facebook/i.test(head)) return 'Facebook';
  if (/^tiktok/i.test(head) || /line\s*ai/i.test(head)) return 'Tiktok';
  if (WEB.test(head)) return 'Webjob';
  if (OFFLINE.test(head)) return 'Offline';
  if (irecruit) return 'iRecruit';
  if (!parts.length) {
    const r = (f.referralSource ?? '').trim();
    if (r === 'facebook') return 'Facebook';
    if (r === 'tiktok') return 'Tiktok';
    if (r === 'flyer') return 'Offline';
  }
  return 'เว็บ So Recruit';
}

export type FunnelTone = 'success' | 'warn' | 'danger' | 'neutral';
export type FunnelRow = { key: string; label: string; value: number; tone: FunnelTone };
export type FunnelStepKey = 'applied' | 'ai' | 'staff' | 'contact' | 'appointment' | 'showed';
export type FunnelStep = {
  key: FunnelStepKey;
  label: string;
  value: number;
  rows: FunnelRow[];
  channels: Record<FunnelChannel, number>;
};

const emptyChannels = (): Record<FunnelChannel, number> =>
  Object.fromEntries(FUNNEL_CHANNELS.map((c) => [c, 0])) as Record<FunnelChannel, number>;

function channelsOf(list: readonly RecruitAppFact[]): Record<FunnelChannel, number> {
  const out = emptyChannels();
  for (const f of list) out[funnelChannelOf(f)] += 1;
  return out;
}

/** ใบที่กรอกในช่วง (ไทย) — คำตอบของ `/api/recruit-overview` มีใบของช่วงที่เทียบติดมาด้วย */
export function appsInWindow(apps: readonly RecruitAppFact[], from: string, to: string): RecruitAppFact[] {
  return apps.filter((f) => {
    const d = appliedYmd(f);
    return Boolean(d) && d >= from && d <= to;
  });
}

const count = (list: readonly RecruitAppFact[], pick: (f: RecruitAppFact) => boolean) => list.filter(pick).length;

/** 6 ขั้น — `claimed` = เก็บไปหน้าติดต่อ (ผลรวมคอลัมน์ "เก็บ" ของตารางเจ้าหน้าที่ชุดเดียวกัน) */
export function buildApplicantFunnel(apps: readonly RecruitAppFact[], claimed: number | null): FunnelStep[] {
  const aiCalled = apps.filter((f) => f.calledByAi);
  const yes = count(aiCalled, (f) => f.aiAnswer === 'said_yes');
  const no = count(aiCalled, (f) => f.aiAnswer === 'said_no');
  const noPickup = count(aiCalled, (f) => f.aiAnswer === 'no_pickup');
  const staffCalled = apps.filter((f) => f.calledByStaff);
  const logged = apps.filter((f) => f.logOk !== null);
  const ok = count(logged, (f) => f.logOk === true);
  const appointed = apps.filter((f) => Boolean(f.appointmentAt));
  const apptTouched = apps.filter((f) => Boolean(f.appointmentAt) || f.appointmentFailed === true);
  const showed = count(appointed, (f) => f.attendance === 'showed');
  const noShow = count(appointed, (f) => f.attendance === 'no_show');
  const moved = count(appointed, (f) => f.attendance === 'rescheduled');

  const steps: FunnelStep[] = [
    {
      key: 'applied',
      label: 'กรอกมา',
      value: apps.length,
      rows: [
        { key: 'aiCalled', label: 'AI โทรแล้ว', value: aiCalled.length, tone: 'neutral' },
        { key: 'aiNotYet', label: 'AI ยังไม่โทร', value: apps.length - aiCalled.length, tone: 'warn' },
      ],
      channels: channelsOf(apps),
    },
    {
      key: 'ai',
      label: 'AI คัดกรอง',
      value: aiCalled.length,
      rows: [
        { key: 'yes', label: 'สนใจ', value: yes, tone: 'success' },
        { key: 'no', label: 'ไม่สนใจ', value: no, tone: 'neutral' },
        { key: 'noPickup', label: 'ไม่รับสาย', value: noPickup, tone: 'neutral' },
        { key: 'other', label: 'อื่น ๆ', value: aiCalled.length - yes - no - noPickup, tone: 'neutral' },
      ],
      channels: channelsOf(aiCalled),
    },
    {
      key: 'staff',
      label: 'คนโทรต่อ',
      value: staffCalled.length,
      rows: claimed === null ? [] : [{ key: 'claimed', label: 'เก็บไปหน้าติดต่อ', value: claimed, tone: 'neutral' }],
      channels: channelsOf(staffCalled),
    },
    {
      key: 'contact',
      label: 'ติดต่อ',
      value: logged.length,
      rows: [
        { key: 'ok', label: 'สำเร็จ', value: ok, tone: 'success' },
        { key: 'fail', label: 'ไม่สำเร็จ', value: logged.length - ok, tone: 'danger' },
      ],
      channels: channelsOf(logged),
    },
    {
      key: 'appointment',
      label: 'นัดหมาย',
      value: apptTouched.length,
      rows: [
        { key: 'booked', label: 'นัดได้', value: appointed.length, tone: 'success' },
        { key: 'failed', label: 'นัดไม่ได้', value: apptTouched.length - appointed.length, tone: 'danger' },
      ],
      channels: channelsOf(apptTouched),
    },
    {
      key: 'showed',
      label: 'มาตามนัด',
      value: appointed.length,
      rows: [
        { key: 'showed', label: 'มา', value: showed, tone: 'success' },
        { key: 'noShow', label: 'ไม่มา', value: noShow, tone: 'danger' },
        ...(moved > 0 ? [{ key: 'moved', label: 'เลื่อนนัด', value: moved, tone: 'neutral' as const }] : []),
        { key: 'pending', label: 'ยังไม่ลงผล', value: appointed.length - showed - noShow - moved, tone: 'warn' },
      ],
      channels: channelsOf(appointed),
    },
  ];
  return steps;
}
