/**
 * ═══ หน้าหลักสรุปหน้าเดียว — เส้นผู้สมัคร 6 ขั้น + แถบช่องทางใต้ทุกขั้น (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"กรอกมาเนี่ย Ai คัดกรองให้แล้วอย่างละเท่าไหร่ · คนมาโทรต่อจาก Ai เท่าไหร่ · ติดต่อสำเร็จ ไม่สำเร็จ · นัดได้ นัดไม่ได้ ·
 * > นัดแล้วมา ไม่มา · คนกรอกมาเนี่ยมาจากไหน"* → Choice แถบช่องทางใต้ทุกขั้น · iRecruit เป็นแท่งของตัวเอง
 * ข้อเท็จจริงต่อใบชุดเดียวกับแท็บภาพรวมงานสรรหา (`/api/recruit-overview` · `RecruitAppFact`) — ไม่มีนิยามใหม่ · pure
 * 🔴 ทุกขั้น: แถบช่องทางรวมกัน = เลขของขั้น · แถวย่อยรวมกัน = เลขของขั้น (31 ต.ค. 2569 ไม่มีข้อยกเว้นแล้ว)
 *    เทสต์ `tests/api/homeOverviewFunnel.test.ts`
 */
import { appliedYmd } from './recruitOverview';
import { aiBranchOf } from './recruitPersonJourney';
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
/** `ids` = id ใบของแถว/ขั้น — กดเลขแล้วเปิดรายชื่อ (เจ้าของ 9 พ.ย. 2569 "บอกชื่อกดไปต้องเห็นชื่อ") · ใบที่ไม่มี id ไม่อยู่ในรายชื่อ */
export type FunnelRow = { key: string; label: string; value: number; tone: FunnelTone; ids: string[] };
export type FunnelStepKey = 'applied' | 'ai' | 'interested' | 'staff' | 'reached' | 'booked';
export type FunnelStep = {
  key: FunnelStepKey;
  label: string;
  value: number;
  /** ขั้นที่รวมคนจากนอกขั้นก่อนหน้า — บอกที่มา (เช่น คนโทรต่อ = จากคนที่สนใจ + จากกลุ่มอื่น) */
  from?: string;
  rows: FunnelRow[];
  channels: Record<FunnelChannel, number>;
  ids: string[];
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
    return d != null && d >= from && d <= to;
  });
}

const idsOf = (list: readonly RecruitAppFact[]) => list.map((f) => f.id).filter((v): v is string => Boolean(v));
const NUM = new Intl.NumberFormat('th-TH');

/**
 * 6 ขั้นต่อกันเป็นสายเดียว (เจ้าของ 31 ต.ค. 2569 Choice "เรียงใหม่ ทุกขั้นบวกลบลงตัว")
 * กรอกมา → AI โทรแล้ว → สนใจ → คนโทรต่อ → ติดต่อได้ → นัดได้ · แถวย่อยของทุกขั้นรวมกัน = เลขของขั้น
 * เลขของขั้นถัดไป = แถวหนึ่งของขั้นก่อน ยกเว้นคนโทรต่อ (โทรคนที่ไม่ได้ตอบสนใจด้วย ⇒ `from` บอกที่มา)
 * เดิม "AI คัดกรอง" ซ้ำกับ AI โทรแล้ว · หัว "นัดหมาย" ใช้เลขติดต่อได้ · หัว "มาตามนัด" ใช้เลขนัดได้ · "รับไปโทรในช่วงนี้" บวกไม่ลง
 */
export function buildApplicantFunnel(apps: readonly RecruitAppFact[]): FunnelStep[] {
  const aiCalled = apps.filter((f) => f.calledByAi);
  const aiQueued = apps.filter((f) => !f.calledByAi && f.aiQueued === true);
  const notCalled = apps.filter((f) => !f.calledByAi && f.aiQueued !== true);
  // 🔴 ผล AI ตัวตัดสินเดียวกับหน้าภาพรวมงานสรรหา (`aiBranchOf`) — เดิมหน้าหลักแบ่งเอง "ไม่สนใจ 209 · อื่น ๆ 104"
  // แต่ภาพรวมได้ "ไม่สนใจ 301 · คนละพื้นที่ 11 · ยังสรุปไม่ได้ 1" จากคนกลุ่มเดียวกัน (ตรวจทั้งระบบ 10 พ.ย. 2569 · รวมผล Codex)
  const aiOf = (k: ReturnType<typeof aiBranchOf>) => aiCalled.filter((f) => aiBranchOf(f) === k);
  const interested = aiOf('yes');
  const no = aiOf('no');
  const noPickup = aiOf('noPickup');
  const outOfArea = aiOf('outOfArea');
  const aiOther = aiOf('other');
  const staffCalled = apps.filter((f) => f.calledByStaff);
  const staffOfInterested = interested.filter((f) => f.calledByStaff);
  const staffNotYet = interested.filter((f) => !f.calledByStaff);
  const reached = staffCalled.filter((f) => f.logOk === true);
  const unreached = staffCalled.filter((f) => f.logOk !== true);
  const booked = reached.filter((f) => Boolean(f.appointmentAt));
  const notBooked = reached.filter((f) => !f.appointmentAt);
  const showed = booked.filter((f) => f.attendance === 'showed');
  const noShow = booked.filter((f) => f.attendance === 'no_show');
  const moved = booked.filter((f) => f.attendance === 'rescheduled');
  const pending = booked.filter((f) => f.attendance !== 'showed' && f.attendance !== 'no_show' && f.attendance !== 'rescheduled');
  const otherStaff = staffCalled.length - staffOfInterested.length;
  const row = (key: string, label: string, list: readonly RecruitAppFact[], tone: FunnelTone): FunnelRow => ({ key, label, value: list.length, tone, ids: idsOf(list) });

  return [
    {
      key: 'applied',
      label: 'กรอกมา',
      value: apps.length,
      rows: [row('aiCalled', 'AI โทรแล้ว', aiCalled, 'neutral'), row('aiQueued', 'รอ AI โทร', aiQueued, 'warn'), row('notCalled', 'ยังไม่โทร', notCalled, 'warn')],
      channels: channelsOf(apps),
      ids: idsOf(apps),
    },
    {
      key: 'ai',
      label: 'AI โทรแล้ว',
      value: aiCalled.length,
      rows: [
        row('yes', 'สนใจ', interested, 'success'),
        row('noPickup', 'ไม่รับสาย', noPickup, 'neutral'),
        row('no', 'ไม่สนใจ', no, 'neutral'),
        row('outOfArea', 'คนละพื้นที่', outOfArea, 'neutral'),
        row('other', 'ยังสรุปไม่ได้', aiOther, 'neutral'),
      ],
      channels: channelsOf(aiCalled),
      ids: idsOf(aiCalled),
    },
    {
      key: 'interested',
      label: 'สนใจ',
      value: interested.length,
      rows: [row('staffCalled', 'คนโทรต่อแล้ว', staffOfInterested, 'success'), row('staffNotYet', 'ยังไม่มีคนโทรต่อ', staffNotYet, 'warn')],
      channels: channelsOf(interested),
      ids: idsOf(interested),
    },
    {
      key: 'staff',
      label: 'คนโทรต่อ',
      value: staffCalled.length,
      from: `สนใจ ${NUM.format(staffOfInterested.length)} + กลุ่มอื่น ${NUM.format(otherStaff)}`,
      rows: [row('reached', 'ติดต่อได้', reached, 'success'), row('unreached', 'ติดต่อไม่ได้', unreached, 'danger')],
      channels: channelsOf(staffCalled),
      ids: idsOf(staffCalled),
    },
    {
      key: 'reached',
      label: 'ติดต่อได้',
      value: reached.length,
      rows: [row('booked', 'นัดได้', booked, 'success'), row('notBooked', 'นัดไม่ได้', notBooked, 'danger')],
      channels: channelsOf(reached),
      ids: idsOf(reached),
    },
    {
      key: 'booked',
      label: 'นัดได้',
      value: booked.length,
      rows: [
        row('showed', 'มา', showed, 'success'),
        row('noShow', 'ไม่มา', noShow, 'danger'),
        ...(moved.length > 0 ? [row('moved', 'เลื่อนนัด', moved, 'neutral')] : []),
        row('pending', 'ยังไม่ลงผล', pending, 'warn'),
      ],
      channels: channelsOf(booked),
      ids: idsOf(booked),
    },
  ];
}
