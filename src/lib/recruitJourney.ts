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

export type JourneyPart = { key: string; label: string; value: number; tone: ToneKey };
export type JourneyStep = { key: string; label: string; total: number; parts: JourneyPart[] };

const count = (list: readonly RecruitAppFact[], p: (f: RecruitAppFact) => boolean) => list.filter(p).length;

/** ขั้น AI: ข้อมูลผิด (เบอร์ใช้โทรไม่ได้) → AI โทรแล้ว → AI รอโทร → ยังไม่ส่ง AI */
const aiStage = (f: RecruitAppFact): 'bad' | 'called' | 'queued' | 'notSent' =>
  !f.phoneOk ? 'bad' : f.calledByAi ? 'called' : f.aiQueued ? 'queued' : 'notSent';

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
  const called = list.filter((f) => aiStage(f) === 'called');
  const interested = called.filter((f) => aiAnswerOf(f) === 'yes');
  const staffOk = interested.filter((f) => staffResultOf(f) === 'ok');
  const appointed = staffOk.filter((f) => Boolean(f.appointmentAt));
  const showed = appointed.filter((f) => f.attendance === 'showed');

  return [
    {
      key: 'names',
      label: 'รายชื่อเข้ามาทั้งหมด',
      total: list.length,
      parts: [
        { key: 'aiCalled', label: 'AI โทรแล้ว', value: called.length, tone: 'info' },
        { key: 'aiQueued', label: 'AI รอโทร', value: count(list, (f) => aiStage(f) === 'queued'), tone: 'neutral' },
        { key: 'badData', label: 'ข้อมูลผิด', value: count(list, (f) => aiStage(f) === 'bad'), tone: 'danger' },
        { key: 'notSent', label: 'ยังไม่ส่ง AI', value: count(list, (f) => aiStage(f) === 'notSent'), tone: 'neutral' },
      ],
    },
    {
      key: 'ai',
      label: 'AI โทรแล้ว',
      total: called.length,
      parts: [
        { key: 'yes', label: 'สนใจ', value: interested.length, tone: 'success' },
        { key: 'no', label: 'ไม่สนใจ', value: count(called, (f) => aiAnswerOf(f) === 'no'), tone: 'danger' },
        { key: 'thinking', label: 'พิจารณา', value: count(called, (f) => aiAnswerOf(f) === 'thinking'), tone: 'warn' },
        { key: 'unreached', label: 'ติดต่อไม่ได้', value: count(called, (f) => aiAnswerOf(f) === 'unreached'), tone: 'neutral' },
      ],
    },
    {
      key: 'staff',
      label: 'คนโทรต่อ (กล่องสนใจ)',
      total: interested.length,
      parts: [
        { key: 'ok', label: 'โทรสำเร็จ', value: staffOk.length, tone: 'success' },
        { key: 'fail', label: 'ไม่สำเร็จ', value: count(interested, (f) => staffResultOf(f) === 'fail'), tone: 'danger' },
        { key: 'waiting', label: 'รอโทร', value: count(interested, (f) => staffResultOf(f) === 'waiting'), tone: 'neutral' },
      ],
    },
    {
      key: 'appointment',
      label: 'โทรสำเร็จ → นัด',
      total: staffOk.length,
      parts: [
        { key: 'booked', label: 'นัดได้', value: appointed.length, tone: 'success' },
        {
          key: 'failed',
          label: 'นัดไม่ได้',
          value: count(staffOk, (f) => !f.appointmentAt && f.appointmentFailed === true),
          tone: 'danger',
        },
        {
          key: 'pending',
          label: 'ยังไม่ลงผล',
          value: count(staffOk, (f) => !f.appointmentAt && f.appointmentFailed !== true),
          tone: 'neutral',
        },
      ],
    },
    {
      key: 'attendance',
      label: 'นัดได้ → มาไหม',
      total: appointed.length,
      parts: [
        { key: 'showed', label: 'มา', value: showed.length, tone: 'success' },
        { key: 'noShow', label: 'ไม่มา', value: count(appointed, (f) => f.attendance === 'no_show'), tone: 'danger' },
        {
          key: 'pending',
          label: 'รอผล',
          value: count(appointed, (f) => f.attendance !== 'showed' && f.attendance !== 'no_show'),
          tone: 'neutral',
        },
      ],
    },
    {
      key: 'screening',
      label: 'มาแล้ว → ผ่านไหม',
      total: showed.length,
      parts: [
        { key: 'passed', label: 'ผ่าน', value: count(showed, (f) => f.screening === 'passed'), tone: 'success' },
        { key: 'notPassed', label: 'ไม่ผ่าน', value: count(showed, (f) => f.screening === 'not_passed'), tone: 'danger' },
        { key: 'pending', label: 'รอผล', value: count(showed, (f) => !f.screening), tone: 'neutral' },
      ],
    },
  ];
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
export const WEEKDAY_CHOICES: ReadonlyArray<{ day: number; label: string }> = [
  { day: 1, label: 'จันทร์' },
  { day: 2, label: 'อังคาร' },
  { day: 3, label: 'พุธ' },
  { day: 4, label: 'พฤหัส' },
  { day: 5, label: 'ศุกร์' },
  { day: 6, label: 'เสาร์' },
  { day: 0, label: 'อาทิตย์' },
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
