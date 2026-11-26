/**
 * ═══ รายชื่อเข้ามาไปถึงไหน (ภาพรวมงานสรรหา · เจ้าของ 18 พ.ย. 2569) ═══
 * ที่มา: การ์ด Milo LBD — "แล้วรายชื่อเข้ามาหายไปไหนอะ" · ทุกกล่องแสดงขั้นที่ไปต่อ + ขั้นที่หลุด คนละ 1 แถว บวกกันเท่าหัวกล่อง
 * ผลกับ AI = `aiAnswer` (ถังกลาง คลังคำ "สนใจไหม" ตัวเดียวกับ Journey สนใจ) · ผลฝั่งทีม = บันทึกติดต่อ/ผลโทรของคนที่ใหม่สุด
 *
 * แยกช่องทาง (เจ้าของ 18 พ.ย. 2569): ช่องทางหลัก → ช่องทางรอง → (Facebook Group: ชื่อกลุ่ม) → คนหามา
 * ชื่อทุกชั้นมาจากตัวกลางเดิมของตารางช่องทาง (`funnelPlaceOf` · `funnelSubOf` · `bringerOf`) — ห้ามตั้งชื่อเอง
 */
import type { CallMicroOutcome } from '@/lib/callMicroOutcome';
import { FUNNEL_GROUP_LABEL, bringerOf, funnelPlaceOf, funnelSubOf, type FunnelGroupKey } from '@/lib/channelFunnel';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { isWaitingForStaff } from '@/lib/waitingForStaff';
import { staffResultOf } from '@/lib/recruitJourney';

export type IntakeRow = { key: string; label: string; ids: string[]; drop: boolean };
export type IntakeBox = { key: string; title: string; ids: string[]; rows: IntakeRow[] };

const idsOf = (list: readonly RecruitAppFact[]) => list.map((f) => f.id ?? '').filter(Boolean);

/**
 * ผลฝั่งทีมล่าสุด: คุยได้ / โทรไม่ติด · null = ทีมยังไม่ได้ลงมือ
 * 🔴 26 พ.ย. 2569 ตัวตัดสิน "ติดต่อได้" มีที่เดียว = `staffResultOf` (recruitJourney.ts) — เดิมตัวนี้คิดเองจากคำตอบสายเจ้าหน้าที่
 *    แท็บภาพรวมได้คุยได้ 300 · แท็บ Scale ลงได้ติดต่อได้ 320 · นัดได้ 55 กับ 65 (ผู้ช่วยตรวจหน้าภาพรวมเจอ · ผิดกติกาหนึ่งเมตริกหนึ่งนิยาม)
 *    ทีมโทรแล้วแต่ยังไม่ได้ผล "ติดต่อได้" = โทรไม่ติด (แถวในกล่องบวกเท่าหัวกล่องเหมือนเดิม)
 */
export function staffReachOf(f: RecruitAppFact): 'talk' | 'miss' | null {
  if (!f.calledByStaff && staffResultOf(f) !== 'ok') return null;
  return staffResultOf(f) === 'ok' ? 'talk' : 'miss';
}

const AI_ROWS: ReadonlyArray<{ key: CallMicroOutcome; label: string; drop: boolean }> = [
  { key: 'no_pickup', label: 'ไม่รับสาย', drop: true },
  { key: 'wrong_person', label: 'ไม่ใช่เจ้าตัว', drop: true },
  { key: 'picked_silent', label: 'รับแล้ววาง', drop: true },
  { key: 'said_no', label: 'คุยแล้วไม่สนใจ', drop: true },
  { key: 'not_yet', label: 'ขอคิดก่อน', drop: true },
  { key: 'talked_unclear', label: 'คุยแล้วสรุปไม่ได้', drop: true },
  { key: 'said_yes', label: 'บอกว่าสนใจ', drop: false },
];

const row = (key: string, label: string, list: readonly RecruitAppFact[], drop: boolean): IntakeRow => ({ key, label, ids: idsOf(list), drop });
/** แถวที่ปกติไม่มี (0) ไม่ขึ้น — ขอคิดก่อน / อื่น ๆ */
const dropEmpty = (rows: IntakeRow[], optional: readonly string[]) => rows.filter((r) => r.ids.length > 0 || !optional.includes(r.key));

/** 5 กล่อง — แต่ละกล่อง แถวรวมกัน = หัวกล่อง (มีเทสต์) */
export function buildIntakeFlow(cohort: readonly RecruitAppFact[]): IntakeBox[] {
  const ai = cohort.filter((f) => f.calledByAi);
  const yes = ai.filter((f) => f.aiAnswer === 'said_yes');
  const self = cohort.filter((f) => f.calledByStaff && !f.calledByAi);
  const booked = cohort.filter((f) => f.appointmentAt);
  const notCalled = cohort.filter((f) => !f.calledByAi && !f.calledByStaff);
  const known = new Set<string>(AI_ROWS.map((r) => r.key));
  // รอเจ้าหน้าที่โทร = นิยามเดียว `isWaitingForStaff` · ที่เหลือเจ้าหน้าที่ลงมือหลัง AI แล้ว → คุยได้ / ไม่ติด
  const yesWaiting = yes.filter((f) => isWaitingForStaff(f));
  const yesFollowed = yes.filter((f) => !isWaitingForStaff(f));
  const yesTalk = yesFollowed.filter((f) => staffReachOf(f) === 'talk');
  const selfTalk = self.filter((f) => staffReachOf(f) === 'talk');
  return [
    {
      key: 'apps',
      // เจ้าของ 19 พ.ย. 2569 "คนสมัครเข้ามา เปลี่ยนคำเป็นรายชื่อเข้ามา"
      title: 'รายชื่อเข้ามา',
      ids: idsOf(cohort),
      rows: [
        // โทรไปแล้ว แยกใครโทร (เจ้าของ 19 พ.ย. 2569 "โทรไปแล้วแล้วเป็นยังไง คนโทร หรือ Ai โทร") — ชุดเดียวกับกล่อง AI โทร / ทีมโทรเอง
        row('ai', 'AI โทร', ai, false),
        row('staff', 'ทีมโทรเอง', self, false),
        row('queued', 'รอ AI โทร', notCalled.filter((f) => f.aiQueued), false),
        row('none', 'ยังไม่มีใครโทร', notCalled.filter((f) => !f.aiQueued), true),
      ],
    },
    {
      key: 'ai',
      title: 'AI โทร',
      ids: idsOf(ai),
      rows: dropEmpty(
        [
          ...AI_ROWS.filter((r) => r.key !== 'said_yes').map((r) => row(r.key, r.label, ai.filter((f) => f.aiAnswer === r.key), r.drop)),
          row('other', 'อื่น ๆ', ai.filter((f) => !f.aiAnswer || !known.has(f.aiAnswer)), true),
          row('said_yes', 'บอกว่าสนใจ', yes, false),
        ],
        ['not_yet', 'other'],
      ),
    },
    {
      key: 'follow',
      title: 'ทีมโทรตามคนที่สนใจ',
      ids: idsOf(yes),
      rows: [
        row('booked', 'คุยได้ · นัดได้', yesTalk.filter((f) => f.appointmentAt), false),
        row('talkNoBook', 'คุยได้ · ยังไม่นัด', yesTalk.filter((f) => !f.appointmentAt), true),
        row('miss', 'ทีมโทรแล้วไม่ติด', yesFollowed.filter((f) => staffReachOf(f) !== 'talk'), true),
        row('heldNotCalled', 'รอเจ้าหน้าที่โทร · มีคนเก็บไว้', yesWaiting.filter((f) => f.claimedBy), true),
        row('notHeld', 'รอเจ้าหน้าที่โทร · ยังไม่มีใครเก็บ', yesWaiting.filter((f) => !f.claimedBy), true),
      ],
    },
    {
      key: 'self',
      title: 'ทีมโทรเอง AI ไม่ได้โทร',
      ids: idsOf(self),
      rows: [
        row('booked', 'คุยได้ · นัดได้', selfTalk.filter((f) => f.appointmentAt), false),
        row('talkNoBook', 'คุยได้ · ยังไม่นัด', selfTalk.filter((f) => !f.appointmentAt), true),
        row('miss', 'โทรไม่ติด', self.filter((f) => staffReachOf(f) === 'miss'), true),
      ],
    },
    {
      key: 'booked',
      title: 'นัดไว้ทั้งหมด',
      ids: idsOf(booked),
      rows: [
        row('showed', 'มาจริง', booked.filter((f) => f.attendance === 'showed'), false),
        row('noShow', 'ไม่มา', booked.filter((f) => f.attendance === 'no_show'), true),
        row('noResult', 'ยังไม่มีใครกรอกว่ามาไหม', booked.filter((f) => f.attendance !== 'showed' && f.attendance !== 'no_show'), true),
      ],
    },
  ];
}

/* ── แยกช่องทาง: ทางที่กดลงไป ── */

export const FB_GROUP_CHANNEL = 'Facebook Group';
const GROUP_ORDER: FunnelGroupKey[] = ['facebook', 'tiktok', 'webjob', 'offline', 'unknown'];

/** ชั้นของรายชื่อหนึ่งคน: [ช่องทางหลัก, ช่องทางรอง, ชื่อกลุ่ม (เฉพาะ Facebook Group), คนหามา] */
export function intakePathOf(f: RecruitAppFact): string[] {
  const { group, channel } = funnelPlaceOf(f);
  const who = bringerOf(f);
  return channel === FB_GROUP_CHANNEL ? [FUNNEL_GROUP_LABEL[group], channel, funnelSubOf(f), who] : [FUNNEL_GROUP_LABEL[group], channel, who];
}

export const onIntakePath = (f: RecruitAppFact, path: readonly string[]): boolean => {
  const p = intakePathOf(f);
  return path.every((v, i) => p[i] === v);
};

/** ชั้นสุดท้าย (คนหามา) — ไม่มีชั้นให้กดลงต่อ */
export const isIntakeLeaf = (path: readonly string[]): boolean => (path[1] === FB_GROUP_CHANNEL ? path.length === 4 : path.length === 3);

/** ชั้นถัดไปใต้ `path` เรียงยอดมากไปน้อย · ชั้นบนสุดเรียงตามช่องทางหลักคงที่ (ว่างก็ขึ้น 0) */
export function intakeChildren(cohort: readonly RecruitAppFact[], path: readonly string[]): Array<{ label: string; list: RecruitAppFact[] }> {
  const under = cohort.filter((f) => onIntakePath(f, path));
  if (path.length === 0) return GROUP_ORDER.map((g) => FUNNEL_GROUP_LABEL[g]).map((label) => ({ label, list: under.filter((f) => intakePathOf(f)[0] === label) }));
  const by = new Map<string, RecruitAppFact[]>();
  for (const f of under) {
    const k = intakePathOf(f)[path.length];
    if (k === undefined) continue;
    by.set(k, [...(by.get(k) ?? []), f]);
  }
  return [...by.entries()].map(([label, list]) => ({ label, list })).sort((a, b) => b.list.length - a.list.length || a.label.localeCompare(b.label, 'th'));
}

/** ยอดในตารางช่องทาง: สมัคร · AI โทร · สนใจ · ทีมคุยได้ · นัดได้ · มาจริง */
export const INTAKE_COLUMNS = ['สมัคร', 'AI โทร', 'สนใจ', 'ทีมคุยได้', 'นัดได้', 'มาจริง'] as const;
export function intakeCounts(list: readonly RecruitAppFact[]): number[] {
  return [
    list.length,
    list.filter((f) => f.calledByAi).length,
    list.filter((f) => f.calledByAi && f.aiAnswer === 'said_yes').length,
    list.filter((f) => staffReachOf(f) === 'talk').length,
    list.filter((f) => f.appointmentAt).length,
    list.filter((f) => f.attendance === 'showed').length,
  ];
}
