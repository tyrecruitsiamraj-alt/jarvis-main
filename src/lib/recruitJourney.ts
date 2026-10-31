/**
 * ═══ Journey งานสรรหา ทีละขั้น (เจ้าของสั่ง 18 ต.ค. 2569 — แท็บภาพรวมต่อจาก Pre-Check) ═══
 *
 * > รายชื่อเข้ามาทั้งหมด → AI โทรแล้ว (สนใจ / ไม่สนใจ / พิจารณา) · AI รอโทร · ข้อมูลผิด →
 * > คนโทรกล่องสนใจ (สำเร็จ / ไม่สำเร็จ / รอโทร) → สำเร็จ: นัดได้ / นัดไม่ได้ → นัดได้: มา / ไม่มา →
 * > มาแล้ว: ผ่าน / ไม่ผ่าน
 * 19 ต.ค. 2569 เจ้าของเรียงใหม่ ("อ่านแล้วรู้เลย") — ดู `buildRecruitJourney` · `buildRequestSteps`
 *
 * 🔴 ทุกขั้นแตกจาก "ตัวแม่" ของขั้นก่อน และลูกรวมกัน = แม่เสมอ (มีช่อง "ยังไม่ลงผล"/"อื่น ๆ" กันเลขหาย) — เทสต์คุม
 * ตรรกะล้วน ใช้ข้อเท็จจริงต่อใบชุดเดียวกับการ์ดภาพรวม (`RecruitAppFact`)
 */
import type { RecruitAppFact, RecruitRequestSummary } from '@/lib/recruitOverviewTypes';
import type { ToneKey } from '@/lib/designTokens';

/** `ids` = id ใบของช่องนี้ — กดเลขแล้วเปิดรายชื่อ (QA 18 ต.ค. 2569) · ว่าง = กดไม่ได้ (เช่น ช่องของใบขอ) */
export type JourneyPart = { key: string; label: string; value: number; tone: ToneKey; ids: string[]; note?: string };
/** `unit` = หน่วยของขั้น (ค่าเริ่ม "คน") */
export type JourneyStep = { key: string; label: string; total: number; parts: JourneyPart[]; unit?: string };

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

/** ขั้น AI: เบอร์ผิด → AI โทรแล้ว → รอโทร → อายุเกิน (ระบบไม่ส่ง) → มาจาก iRecruit → ยังไม่ส่ง AI */
export const aiStage = (f: RecruitAppFact): 'bad' | 'called' | 'queued' | 'overAge' | 'irecruit' | 'notSent' =>
  !f.phoneOk
    ? 'bad'
    : f.calledByAi
      ? 'called'
      : f.aiQueued
        ? 'queued'
        : f.overAge
          ? 'overAge'
          : isFromIrecruit(f)
            ? 'irecruit'
            : 'notSent';

/**
 * คำตอบกับ AI · คนละพื้นที่ (19 ต.ค. 2569) มาก่อนไม่สนใจ/ขอคิด/ไม่ชัด แต่ **ไม่ทับ "สนใจ"**
 * ⇒ "สนใจ" ยังเป็นเลขเดียวกับแท็บผู้สมัครและหน้าหลัก (เจ้าของไม่อยากให้เลขขัดกัน)
 */
export const aiAnswerOf = (f: RecruitAppFact): 'yes' | 'no' | 'area' | 'thinking' | 'unreached' => {
  if (f.aiAnswer === 'said_yes') return 'yes';
  const talked = f.aiAnswer === 'said_no' || f.aiAnswer === 'not_yet' || f.aiAnswer === 'talked_unclear';
  if (talked && f.aiOutOfArea) return 'area';
  return f.aiAnswer === 'said_no' ? 'no' : f.aiAnswer === 'not_yet' ? 'thinking' : 'unreached';
};

/** คนโทรต่อ: บันทึกผลติดต่อของเจ้าหน้าที่ (สำเร็จ/ไม่สำเร็จ) ก่อน · ไม่มี = ดูผลติดต่อที่เจ้าหน้าที่ได้ · ไม่มีเลย = รอโทร */
export const staffResultOf = (f: RecruitAppFact): 'ok' | 'fail' | 'waiting' => {
  if (f.logOk === true) return 'ok';
  if (f.logOk === false) return 'fail';
  if (f.contactBy === 'staff' && f.contact === 'success') return 'ok';
  if (f.contactBy === 'staff' && f.contact === 'failed') return 'fail';
  return 'waiting';
};

/**
 * 🔴 โครงตามเจ้าของ 19 ต.ค. 2569 (ภาพรวม "อ่านแล้วรู้เลย"):
 * รายชื่อที่กรอกมา → AI โทรแล้ว (สนใจ / ไม่สนใจ / คนละพื้นที่ …) → รายชื่อสนใจ คนโทรต่อ (สำเร็จ / ไม่สำเร็จ / รอโทร)
 * → นัดหมาย (สำเร็จ / ไม่สำเร็จ / รอผล) → นัดแล้วมาไหม · ขั้นผ่าน/ไม่ผ่าน ไปอยู่แท็บ Pre-Check
 */
export function buildRecruitJourney(list: readonly RecruitAppFact[]): JourneyStep[] {
  const by = <T extends string>(src: readonly RecruitAppFact[], key: (f: RecruitAppFact) => T, v: T) => src.filter((f) => key(f) === v);
  const called = by(list, aiStage, 'called');
  const interested = by(called, aiAnswerOf, 'yes');
  const staffOk = by(interested, staffResultOf, 'ok');
  const appointed = staffOk.filter((f) => Boolean(f.appointmentAt));

  // 🔴 คำ (QA 18 ต.ค. 2569): ยังไม่มีผล = "รอผล" คำเดียวทุกขั้น · ไม่มีศัพท์ภายใน/ลูกศรบนหัวขั้น
  return [
    {
      key: 'names',
      label: 'รายชื่อที่กรอกมา',
      total: list.length,
      parts: [
        part('aiCalled', 'AI โทรแล้ว', called, 'info'),
        part('aiQueued', 'รอโทร', by(list, aiStage, 'queued'), 'neutral'),
        part('badData', 'เบอร์ผิด', by(list, aiStage, 'bad'), 'danger'),
        part('overAge', 'อายุเกิน', by(list, aiStage, 'overAge'), 'orange'),
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
        part('area', 'คนละพื้นที่', by(called, aiAnswerOf, 'area'), 'orange'),
        part('thinking', 'ขอคิดก่อน', by(called, aiAnswerOf, 'thinking'), 'warn'),
        part('unreached', 'ติดต่อไม่ได้', by(called, aiAnswerOf, 'unreached'), 'neutral'),
      ],
    },
    {
      key: 'staff',
      label: 'รายชื่อสนใจ · คนโทรต่อ',
      total: interested.length,
      parts: [
        part('ok', 'ติดต่อได้', staffOk, 'success'),
        part('fail', 'ติดต่อไม่ได้', by(interested, staffResultOf, 'fail'), 'danger'),
        part('waiting', 'รอโทร', by(interested, staffResultOf, 'waiting'), 'neutral'),
      ],
    },
    {
      key: 'appointment',
      label: 'นัดหมาย',
      total: staffOk.length,
      parts: [
        part('booked', 'นัดสำเร็จ', appointed, 'success'),
        part('failed', 'นัดไม่สำเร็จ', staffOk.filter((f) => !f.appointmentAt && f.appointmentFailed === true), 'danger'),
        part('pending', 'รอผล', staffOk.filter((f) => !f.appointmentAt && f.appointmentFailed !== true), 'neutral'),
      ],
    },
    {
      key: 'attendance',
      label: 'นัดแล้วมาไหม',
      total: appointed.length,
      parts: [
        part('showed', 'มา', appointed.filter((f) => f.attendance === 'showed'), 'success'),
        part('noShow', 'ไม่มา', appointed.filter((f) => f.attendance === 'no_show'), 'danger'),
        part('pending', 'รอผล', appointed.filter((f) => f.attendance !== 'showed' && f.attendance !== 'no_show'), 'neutral'),
      ],
    },
  ];
}

/** ใบขอ (เจ้าของ 19 ต.ค. 2569 ภาพรวมข้อ 1) — ใบขอเข้ามา → ประกาศแล้ว/ยังไม่ประกาศ → มีคนสมัคร/ไม่มีคนกรอก */
export function buildRequestSteps(r: RecruitRequestSummary): JourneyStep[] {
  const p = (key: string, label: string, value: number, tone: ToneKey, note?: string): JourneyPart => ({ key, label, value, tone, ids: [], note });
  return [
    {
      key: 'requests',
      label: 'ใบขอเข้ามา',
      unit: 'ใบ',
      total: r.total,
      parts: [p('released', 'ประกาศแล้ว', r.released, 'success'), p('notReleased', 'ยังไม่ประกาศ', r.notReleased, 'neutral')],
    },
    {
      key: 'released',
      label: 'ประกาศแล้ว',
      unit: 'ใบ',
      total: r.released,
      parts: [
        p('withApps', 'มีคนสมัคร', r.releasedWithApps, 'info', `กรอกมา ${r.appsOnReleased.toLocaleString('th-TH')} คน`),
        p('noApps', 'ไม่มีคนกรอก', r.releasedNoApps, 'danger'),
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
