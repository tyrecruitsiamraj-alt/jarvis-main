/**
 * ═══ หน้าหลักสรุปหน้าเดียว — เส้นผู้สมัคร 6 ขั้น + แถบช่องทางใต้ทุกขั้น (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"กรอกมาเนี่ย Ai คัดกรองให้แล้วอย่างละเท่าไหร่ · คนมาโทรต่อจาก Ai เท่าไหร่ · ติดต่อสำเร็จ ไม่สำเร็จ · นัดได้ นัดไม่ได้ ·
 * > นัดแล้วมา ไม่มา · คนกรอกมาเนี่ยมาจากไหน"* → Choice แถบช่องทางใต้ทุกขั้น · iRecruit เป็นแท่งของตัวเอง
 * ข้อเท็จจริงต่อใบชุดเดียวกับแท็บภาพรวมงานสรรหา (`/api/recruit-overview` · `RecruitAppFact`) — ไม่มีนิยามใหม่ · pure
 * 🔴 ทุกขั้น: แถบช่องทางรวมกัน = เลขของขั้น · แถวย่อยรวมกัน = เลขของขั้น (31 ต.ค. 2569 ไม่มีข้อยกเว้นแล้ว)
 *    เทสต์ `tests/api/homeOverviewFunnel.test.ts`
 */
import { appliedYmd } from './recruitOverview';
import type { RecruitAppFact } from './recruitOverviewTypes';
import { FOUR_MAIN_OTHER, fourMainOf } from './channelFourMain';

/**
 * 4 ช่องทางหลักของหน้าช่องทาง + iRecruit (เจ้าของ 28 ต.ค. 2569 Choice "นับเป็น iRecruit ทั้งหมด") +
 * อื่น ๆ (ป้ายที่ไม่เข้า 4 หลัก เช่น LINE OA — ขึ้นเมื่อมีคน) · ไม่มี "ไม่ระบุ" (เจ้าของ "ไม่เอาไม่ระบุ")
 */
export const FUNNEL_CHANNELS = ['Facebook', 'Tiktok', 'Webjob', 'Offline', 'iRecruit', FOUR_MAIN_OTHER] as const;
export type FunnelChannel = (typeof FUNNEL_CHANNELS)[number];

/**
 * ช่องทางของใบ — กติกาแยกช่องทางตัวเดียวกับกราฟช่องทาง (`fourMainOf`) ห้ามเขียนซ้ำ
 * - ป้ายขึ้นต้น iRecruit (รวม "iRecruit · Jobthai") = iRecruit ทุกใบ
 * - ป้าย "หลัก · รอง" = ตัดสินจากส่วนหัว
 * - ไม่มีป้าย = ช่องทางที่ผู้สมัครเลือกในฟอร์มเก่า (referral) · ไม่มีอะไรเลย = กรอกผ่านเว็บสมัครงานของเรา ⇒ Webjob
 *   (เจ้าของ 28 ต.ค. 2569 Choice "ย้ายเข้า Webjob · เว็บสมัครงาน So Recruit" · ฟอร์มบังคับเลือกช่องทางแล้ว)
 */
export function funnelChannelOf(f: Pick<RecruitAppFact, 'channelLabel' | 'referralSource'>): FunnelChannel {
  const parts = (f.channelLabel ?? '').split(' · ').map((p) => p.trim()).filter(Boolean);
  if (parts.length) return /^irecruit$/i.test(parts[0]) ? 'iRecruit' : fourMainOf(parts[0]);
  const r = (f.referralSource ?? '').trim();
  if (r === 'facebook') return 'Facebook';
  if (r === 'tiktok') return 'Tiktok';
  if (r === 'flyer') return 'Offline';
  if (r === 'line_oa') return FOUR_MAIN_OTHER;
  return 'Webjob';
}

export type FunnelTone = 'success' | 'warn' | 'danger' | 'neutral';
export type FunnelRow = { key: string; label: string; value: number; tone: FunnelTone };
export type FunnelStepKey = 'applied' | 'ai' | 'interested' | 'staff' | 'reached' | 'booked';
export type FunnelStep = {
  key: FunnelStepKey;
  label: string;
  value: number;
  /** ขั้นที่รวมคนจากนอกขั้นก่อนหน้า — บอกที่มา (เช่น คนโทรต่อ = จากคนที่สนใจ + จากกลุ่มอื่น) */
  from?: string;
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
const NUM = new Intl.NumberFormat('th-TH');

/**
 * 6 ขั้นต่อกันเป็นสายเดียว (เจ้าของ 31 ต.ค. 2569 Choice "เรียงใหม่ ทุกขั้นบวกลบลงตัว")
 * กรอกมา → AI โทรแล้ว → สนใจ → คนโทรต่อ → ติดต่อได้ → นัดได้ · แถวย่อยของทุกขั้นรวมกัน = เลขของขั้น
 * เลขของขั้นถัดไป = แถวหนึ่งของขั้นก่อน ยกเว้นคนโทรต่อ (โทรคนที่ไม่ได้ตอบสนใจด้วย ⇒ `from` บอกที่มา)
 * เดิม "AI คัดกรอง" ซ้ำกับ AI โทรแล้ว · หัว "นัดหมาย" ใช้เลขติดต่อได้ · หัว "มาตามนัด" ใช้เลขนัดได้ · "รับไปโทรในช่วงนี้" บวกไม่ลง
 */
export function buildApplicantFunnel(apps: readonly RecruitAppFact[]): FunnelStep[] {
  const aiCalled = apps.filter((f) => f.calledByAi);
  const aiQueued = count(apps, (f) => !f.calledByAi && f.aiQueued === true);
  const interested = aiCalled.filter((f) => f.aiAnswer === 'said_yes');
  const no = count(aiCalled, (f) => f.aiAnswer === 'said_no');
  const noPickup = count(aiCalled, (f) => f.aiAnswer === 'no_pickup');
  const staffCalled = apps.filter((f) => f.calledByStaff);
  const staffOfInterested = count(interested, (f) => f.calledByStaff);
  const reached = staffCalled.filter((f) => f.logOk === true);
  const booked = reached.filter((f) => Boolean(f.appointmentAt));
  const showed = count(booked, (f) => f.attendance === 'showed');
  const noShow = count(booked, (f) => f.attendance === 'no_show');
  const moved = count(booked, (f) => f.attendance === 'rescheduled');
  const otherStaff = staffCalled.length - staffOfInterested;

  return [
    {
      key: 'applied',
      label: 'กรอกมา',
      value: apps.length,
      rows: [
        { key: 'aiCalled', label: 'AI โทรแล้ว', value: aiCalled.length, tone: 'neutral' },
        { key: 'aiQueued', label: 'รอ AI โทร', value: aiQueued, tone: 'warn' },
        { key: 'notCalled', label: 'ยังไม่โทร', value: apps.length - aiCalled.length - aiQueued, tone: 'warn' },
      ],
      channels: channelsOf(apps),
    },
    {
      key: 'ai',
      label: 'AI โทรแล้ว',
      value: aiCalled.length,
      rows: [
        { key: 'yes', label: 'สนใจ', value: interested.length, tone: 'success' },
        { key: 'no', label: 'ไม่สนใจ', value: no, tone: 'neutral' },
        { key: 'noPickup', label: 'ไม่รับสาย', value: noPickup, tone: 'neutral' },
        { key: 'other', label: 'อื่น ๆ', value: aiCalled.length - interested.length - no - noPickup, tone: 'neutral' },
      ],
      channels: channelsOf(aiCalled),
    },
    {
      key: 'interested',
      label: 'สนใจ',
      value: interested.length,
      rows: [
        { key: 'staffCalled', label: 'คนโทรต่อแล้ว', value: staffOfInterested, tone: 'success' },
        { key: 'staffNotYet', label: 'ยังไม่มีคนโทรต่อ', value: interested.length - staffOfInterested, tone: 'warn' },
      ],
      channels: channelsOf(interested),
    },
    {
      key: 'staff',
      label: 'คนโทรต่อ',
      value: staffCalled.length,
      from: `สนใจ ${NUM.format(staffOfInterested)} + กลุ่มอื่น ${NUM.format(otherStaff)}`,
      rows: [
        { key: 'reached', label: 'ติดต่อได้', value: reached.length, tone: 'success' },
        { key: 'unreached', label: 'ติดต่อไม่ได้', value: staffCalled.length - reached.length, tone: 'danger' },
      ],
      channels: channelsOf(staffCalled),
    },
    {
      key: 'reached',
      label: 'ติดต่อได้',
      value: reached.length,
      rows: [
        { key: 'booked', label: 'นัดได้', value: booked.length, tone: 'success' },
        { key: 'notBooked', label: 'นัดไม่ได้', value: reached.length - booked.length, tone: 'danger' },
      ],
      channels: channelsOf(reached),
    },
    {
      key: 'booked',
      label: 'นัดได้',
      value: booked.length,
      rows: [
        { key: 'showed', label: 'มา', value: showed, tone: 'success' },
        { key: 'noShow', label: 'ไม่มา', value: noShow, tone: 'danger' },
        ...(moved > 0 ? [{ key: 'moved', label: 'เลื่อนนัด', value: moved, tone: 'neutral' as const }] : []),
        { key: 'pending', label: 'ยังไม่ลงผล', value: booked.length - showed - noShow - moved, tone: 'warn' },
      ],
      channels: channelsOf(booked),
    },
  ];
}
