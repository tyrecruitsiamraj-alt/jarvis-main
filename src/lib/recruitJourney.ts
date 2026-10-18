/**
 * ═══ Journey งานสรรหา ทีละขั้น (เจ้าของสั่ง 18 ต.ค. 2569 — แท็บภาพรวมต่อจาก Pre-Check) ═══
 *
 * > รายชื่อเข้ามาทั้งหมด → AI โทรแล้ว (สนใจ / ไม่สนใจ / พิจารณา) · AI รอโทร · ข้อมูลผิด →
 * > คนโทรกล่องสนใจ (สำเร็จ / ไม่สำเร็จ / รอโทร) → สำเร็จ: นัดได้ / นัดไม่ได้ → นัดได้: มา / ไม่มา →
 * > มาแล้ว: ผ่าน / ไม่ผ่าน
 *
 * 🔴 ทุกขั้นแตกจาก "ตัวแม่" ของขั้นก่อน และลูกรวมกัน = แม่เสมอ (มีช่อง "ยังไม่ลงผล"/"อื่น ๆ" กันเลขหาย) — เทสต์คุม
 * ตรรกะล้วน ใช้ข้อเท็จจริงต่อใบชุดเดียวกับการ์ดภาพรวม (`RecruitAppFact`)
 */
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import type { ToneKey } from '@/lib/designTokens';

/** `ids` = id ใบของช่องนี้ — กดเลขแล้วเปิดรายชื่อ (QA 18 ต.ค. 2569) */
export type JourneyPart = { key: string; label: string; value: number; tone: ToneKey; ids: string[] };
export type JourneyStep = { key: string; label: string; total: number; parts: JourneyPart[] };

const idsOf = (list: readonly RecruitAppFact[]) => list.map((f) => f.id).filter((v): v is string => Boolean(v));
/** ช่องหนึ่งของขั้น — เลข + id ของใบในช่อง */
const part = (key: string, label: string, list: readonly RecruitAppFact[], tone: ToneKey): JourneyPart => ({
  key,
  label,
  value: list.length,
  tone,
  ids: idsOf(list),
});

/** ใบจาก iRecruit — AI ไม่โทรเอง (ใบซ้ำ/นำเข้า) แยกออกจาก "ยังไม่ส่ง AI" (QA 18 ต.ค. 2569: 309 ใบทำให้ดูเหมือนระบบค้าง) */
export const isFromIrecruit = (f: Pick<RecruitAppFact, 'channelLabel' | 'referralSource'>): boolean =>
  /^irecruit/i.test((f.channelLabel ?? '').trim()) || /^irecruit/i.test((f.referralSource ?? '').trim());

/** ขั้น AI: ข้อมูลผิด (เบอร์ใช้โทรไม่ได้) → AI โทรแล้ว → AI รอโทร → มาจาก iRecruit → ยังไม่ส่ง AI */
const aiStage = (f: RecruitAppFact): 'bad' | 'called' | 'queued' | 'irecruit' | 'notSent' =>
  !f.phoneOk ? 'bad' : f.calledByAi ? 'called' : f.aiQueued ? 'queued' : isFromIrecruit(f) ? 'irecruit' : 'notSent';

const aiAnswerOf = (f: RecruitAppFact): 'yes' | 'no' | 'thinking' | 'unreached' =>
  f.aiAnswer === 'said_yes' ? 'yes' : f.aiAnswer === 'said_no' ? 'no' : f.aiAnswer === 'not_yet' ? 'thinking' : 'unreached';

/** คนโทรต่อ: บันทึกผลติดต่อของเจ้าหน้าที่ (สำเร็จ/ไม่สำเร็จ) ก่อน · ไม่มี = ดูผลติดต่อที่เจ้าหน้าที่ได้ · ไม่มีเลย = รอโทร */
const staffResultOf = (f: RecruitAppFact): 'ok' | 'fail' | 'waiting' => {
  if (f.logOk === true) return 'ok';
  if (f.logOk === false) return 'fail';
  if (f.contactBy === 'staff' && f.contact === 'success') return 'ok';
  if (f.contactBy === 'staff' && f.contact === 'failed') return 'fail';
  return 'waiting';
};

export function buildRecruitJourney(list: readonly RecruitAppFact[]): JourneyStep[] {
  const by = <T extends string>(src: readonly RecruitAppFact[], key: (f: RecruitAppFact) => T, v: T) => src.filter((f) => key(f) === v);
  const called = by(list, aiStage, 'called');
  const interested = by(called, aiAnswerOf, 'yes');
  const staffOk = by(interested, staffResultOf, 'ok');
  const appointed = staffOk.filter((f) => Boolean(f.appointmentAt));
  const showed = appointed.filter((f) => f.attendance === 'showed');

  // 🔴 คำ (QA 18 ต.ค. 2569): ยังไม่มีผล = "รอผล" คำเดียวทุกขั้น · ไม่มีศัพท์ภายใน/ลูกศรบนหัวขั้น
  return [
    {
      key: 'names',
      label: 'รายชื่อเข้ามาทั้งหมด',
      total: list.length,
      parts: [
        part('aiCalled', 'AI โทรแล้ว', called, 'info'),
        part('aiQueued', 'AI รอโทร', by(list, aiStage, 'queued'), 'neutral'),
        part('badData', 'ข้อมูลผิด', by(list, aiStage, 'bad'), 'danger'),
        part('irecruit', 'มาจาก iRecruit', by(list, aiStage, 'irecruit'), 'violet'),
        part('notSent', 'ยังไม่ส่ง AI', by(list, aiStage, 'notSent'), 'neutral'),
      ],
    },
    {
      key: 'ai',
      label: 'AI โทรแล้ว',
      total: called.length,
      parts: [
        part('yes', 'สนใจ', interested, 'success'),
        part('no', 'ไม่สนใจ', by(called, aiAnswerOf, 'no'), 'danger'),
        part('thinking', 'พิจารณา', by(called, aiAnswerOf, 'thinking'), 'warn'),
        part('unreached', 'ติดต่อไม่ได้', by(called, aiAnswerOf, 'unreached'), 'neutral'),
      ],
    },
    {
      key: 'staff',
      label: 'คนโทรต่อคนที่สนใจ',
      total: interested.length,
      parts: [
        part('ok', 'โทรสำเร็จ', staffOk, 'success'),
        part('fail', 'ไม่สำเร็จ', by(interested, staffResultOf, 'fail'), 'danger'),
        part('waiting', 'รอโทร', by(interested, staffResultOf, 'waiting'), 'neutral'),
      ],
    },
    {
      key: 'appointment',
      label: 'นัดได้ไหม',
      total: staffOk.length,
      parts: [
        part('booked', 'นัดได้', appointed, 'success'),
        part('failed', 'นัดไม่ได้', staffOk.filter((f) => !f.appointmentAt && f.appointmentFailed === true), 'danger'),
        part('pending', 'รอผล', staffOk.filter((f) => !f.appointmentAt && f.appointmentFailed !== true), 'neutral'),
      ],
    },
    {
      key: 'attendance',
      label: 'มาตามนัดไหม',
      total: appointed.length,
      parts: [
        part('showed', 'มา', showed, 'success'),
        part('noShow', 'ไม่มา', appointed.filter((f) => f.attendance === 'no_show'), 'danger'),
        part('pending', 'รอผล', appointed.filter((f) => f.attendance !== 'showed' && f.attendance !== 'no_show'), 'neutral'),
      ],
    },
    {
      key: 'screening',
      label: 'ผ่านไหม',
      total: showed.length,
      parts: [
        part('passed', 'ผ่าน', showed.filter((f) => f.screening === 'passed'), 'success'),
        part('notPassed', 'ไม่ผ่าน', showed.filter((f) => f.screening === 'not_passed'), 'danger'),
        part('pending', 'รอผล', showed.filter((f) => !f.screening), 'neutral'),
      ],
    },
  ];
}

/** % ของตัวแม่ — มีจริงแต่ไม่ถึง 1% เขียน "<1%" (QA 18 ต.ค. 2569: ข้อมูลผิด 1 จาก 780 เคยขึ้น 0%) */
export function journeyPctText(value: number, total: number): string {
  if (total <= 0) return '';
  if (value > 0 && (value / total) * 100 < 0.5) return '<1%';
  return `${Math.round((value / total) * 100)}%`;
}

/** วันในสัปดาห์ (เวลาไทย) ของเวลากรอกใบ · 0 = อาทิตย์ … 6 = เสาร์ */
const BKK_WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', weekday: 'short' });
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function bangkokWeekday(iso: string): number | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return WD[BKK_WEEKDAY.format(new Date(t))] ?? null;
}

/** ปุ่มเลือกวันในสัปดาห์ — เรียงจันทร์ก่อนแบบปฏิทินไทยที่ทีมใช้ */
export const WEEKDAY_CHOICES: ReadonlyArray<{ day: number; label: string; short: string }> = [
  { day: 1, label: 'จันทร์', short: 'จ.' },
  { day: 2, label: 'อังคาร', short: 'อ.' },
  { day: 3, label: 'พุธ', short: 'พ.' },
  { day: 4, label: 'พฤหัส', short: 'พฤ.' },
  { day: 5, label: 'ศุกร์', short: 'ศ.' },
  { day: 6, label: 'เสาร์', short: 'ส.' },
  { day: 0, label: 'อาทิตย์', short: 'อา.' },
];

/** กรองเฉพาะวันในสัปดาห์ที่เลือก (ว่าง = ทุกวัน) */
export function filterByWeekdays<T extends { createdAt: string }>(list: readonly T[], days: readonly number[]): T[] {
  if (days.length === 0) return [...list];
  const set = new Set(days);
  return list.filter((f) => {
    const d = bangkokWeekday(f.createdAt);
    return d !== null && set.has(d);
  });
}
