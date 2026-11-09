/**
 * ═══ เส้นทางของรายชื่อ — หลุดตรงไหน · ใครโทรต่อ · โทรต่อภายใน 1 วันไหม (เจ้าของ 4 พ.ย. 2569) ═══
 *
 * > *"อยากดูว่างานแบงค์ไม่มีคนเลยหรอ หรือ มีแต่ปิดไม่ได้ หรือ เพราะแบงค์ไม่ทำงาน … คนที่เข้ามาที่มันทำให้ปิดไม่ได้มาจากช่องทางไหน"*
 *
 * เส้นหลัก: กรอกมา → AI โทร → สนใจ → คนโทรต่อติดต่อได้ → นัดได้ → มา → ผ่าน · แต่ละขั้นแตกทางที่หลุดครบ (รวมกันเท่าขั้นนั้น)
 * 🔴 สนใจ = ตอบ AI ว่าสนใจ (`isInterested`) คนละพื้นที่ไม่ทับ — เลขเดียวกับตาราง "รายชื่อมาจากไหน ไปถึงไหน" ที่อยู่หน้าเดียวกัน
 *    (AI สนใจ · คนโทรต่อสำเร็จ) · ที่เหลือแยกตาม `aiResultOf` · คนโทรต่อ = `isStaffFollowed` / `isFollowedReached`
 */
import type { ToneKey } from './designTokens';
import type { RecruitAppFact } from './recruitOverviewTypes';
import { aiResultOf } from './requestPipeline';
import { aiStage } from './recruitJourney';
import { isFollowedReached, isStaffFollowed } from './recruitOverview';
import { isInterested } from './recruitContactTab';

export type PersonPart = { key: string; label: string; tone: ToneKey; ids: string[]; /** ทางนี้ไปขั้นถัดไป */ next?: boolean; note?: string };
export type PersonStage = { key: string; label: string; total: number; ids: string[]; parts: PersonPart[] };

const idsOf = (list: readonly RecruitAppFact[]) => list.map((f) => f.id).filter((v): v is string => Boolean(v));
const part = (key: string, label: string, tone: ToneKey, list: readonly RecruitAppFact[], extra: Partial<PersonPart> = {}): PersonPart => ({ key, label, tone, ids: idsOf(list), ...extra });
const stage = (key: string, label: string, list: readonly RecruitAppFact[], parts: PersonPart[]): PersonStage => ({ key, label, total: list.length, ids: idsOf(list), parts });

/** ช่วงเลข "a n · b n" ไม่โชว์ 0 */
const noteOf = (pairs: ReadonlyArray<[string, number]>) => pairs.filter(([, n]) => n > 0).map(([l, n]) => `${l} ${n.toLocaleString('th-TH')}`).join(' · ') || undefined;

export const DAY_MS = 86_400_000;
const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
/**
 * ผล AI ของขั้น "AI โทรแล้ว" — สนใจก่อน แล้วค่อยคนละพื้นที่ · ไม่สนใจ · ไม่รับสาย · ยังสรุปไม่ได้
 * สนใจ = `isInterested` ตัวเดียวกับแท็บการติดต่อ (review 9 พ.ย. 2569 เดิมหน้าเดียวกันใช้ตัวตัดสินสองตัว)
 */
export const aiBranchOf = (f: RecruitAppFact): ReturnType<typeof aiResultOf> => (isInterested(f) ? 'yes' : aiResultOf(f));

export function buildPersonJourney(list: readonly RecruitAppFact[], now: Date = new Date()): PersonStage[] {
  const aiCalled = list.filter((f) => f.calledByAi);
  const staffOnly = list.filter((f) => !f.calledByAi && f.calledByStaff);
  const notCalled = list.filter((f) => !f.calledByAi && !f.calledByStaff);
  const queued = notCalled.filter((f) => aiStage(f) === 'queued');
  const noQueue = notCalled.filter((f) => aiStage(f) !== 'queued');
  const noQueueBy = (s: ReturnType<typeof aiStage>) => noQueue.filter((f) => aiStage(f) === s).length;
  const staffOnlyReached = staffOnly.filter((f) => f.logOk === true || (f.contactBy === 'staff' && f.contact === 'success'));

  const ai = (k: ReturnType<typeof aiResultOf>) => aiCalled.filter((f) => aiBranchOf(f) === k);
  const yes = ai('yes');
  const reached = yes.filter(isFollowedReached);
  const failed = yes.filter((f) => isStaffFollowed(f) && !isFollowedReached(f));
  const waiting = yes.filter((f) => !isStaffFollowed(f));

  const booked = reached.filter((f) => Boolean(f.appointmentAt));
  const notBooked = reached.filter((f) => !f.appointmentAt);
  const apptFailed = notBooked.filter((f) => f.appointmentFailed === true);
  const saidNo = notBooked.filter((f) => f.appointmentFailed !== true && (f.staffAnswer === 'said_no' || f.staffAnswer === 'wrong_person'));
  const undecided = notBooked.filter((f) => f.appointmentFailed !== true && f.staffAnswer !== 'said_no' && f.staffAnswer !== 'wrong_person');

  const showed = booked.filter((f) => f.attendance === 'showed');
  const noShow = booked.filter((f) => f.attendance === 'no_show');
  const noResult = booked.filter((f) => f.attendance !== 'showed' && f.attendance !== 'no_show');
  const upcoming = noResult.filter((f) => ms(f.appointmentAt) > now.getTime());
  const overdue = noResult.filter((f) => !(ms(f.appointmentAt) > now.getTime()));

  return [
    stage('apps', 'รายชื่อที่กรอกมา', list, [
      part('aiCalled', 'AI โทรแล้ว', 'info', aiCalled, { next: true }),
      part('staffOnly', 'คนโทรเอง ไม่ผ่าน AI', 'violet', staffOnly, {
        note: noteOf([['ติดต่อได้', staffOnlyReached.length], ['นัดได้', staffOnly.filter((f) => f.appointmentAt).length]]),
      }),
      part('queued', 'รอ AI โทร', 'neutral', queued),
      part('noQueue', 'ยังไม่มีใครโทร ไม่มีคิว', 'danger', noQueue, {
        note: noteOf([['เบอร์ผิด', noQueueBy('bad')], ['อายุเกิน', noQueueBy('overAge')], ['มาจาก iRecruit', noQueueBy('irecruit')], ['ยังไม่ส่ง AI', noQueueBy('notSent')]]),
      }),
    ]),
    stage('ai', 'AI โทรแล้ว', aiCalled, [
      part('yes', 'สนใจ', 'success', yes, { next: true }),
      part('noPickup', 'ไม่รับสาย', 'neutral', ai('noPickup')),
      part('no', 'ไม่สนใจ', 'danger', ai('no')),
      part('outOfArea', 'คนละพื้นที่', 'orange', ai('outOfArea')),
      part('other', 'ยังสรุปไม่ได้', 'warn', ai('other')),
    ]),
    stage('follow', 'สนใจ · คนโทรต่อ', yes, [
      part('reached', 'ติดต่อได้', 'success', reached, { next: true }),
      part('failed', 'ติดต่อไม่ได้', 'danger', failed),
      part('waiting', 'ยังไม่มีคนโทรต่อ', 'warn', waiting),
    ]),
    stage('appoint', 'ติดต่อได้ · นัด', reached, [
      part('booked', 'นัดได้', 'success', booked, { next: true }),
      part('apptFailed', 'นัดไม่ได้', 'danger', apptFailed),
      part('saidNo', 'ไม่สนใจแล้ว', 'orange', saidNo),
      part('undecided', 'ยังไม่ลงผลนัด', 'warn', undecided),
    ]),
    stage('attend', 'นัดได้ · มาไหม', booked, [
      part('showed', 'มา', 'success', showed, { next: true }),
      part('noShow', 'ไม่มา', 'danger', noShow),
      part('upcoming', 'ยังไม่ถึงวันนัด', 'neutral', upcoming),
      part('overdue', 'เลยวันนัด ยังไม่ลงผล', 'warn', overdue),
    ]),
    stage('pass', 'มา · ผลสัมภาษณ์', showed, [
      part('passed', 'ผ่าน', 'success', showed.filter((f) => f.screening === 'passed'), { next: true }),
      part('notPassed', 'ไม่ผ่าน', 'danger', showed.filter((f) => f.screening === 'not_passed')),
      part('pending', 'ยังไม่ลงผล', 'warn', showed.filter((f) => f.screening !== 'passed' && f.screening !== 'not_passed')),
    ]),
  ];
}

/** ได้ลงงาน = มีใบแจ้งเข้า ERP หลังวันกรอก · null = อ่าน ERP ไม่ได้ทั้งชุด (ห้ามโชว์ 0) */
export function informedOf(list: readonly RecruitAppFact[]): string[] | null {
  if (list.length > 0 && list.every((f) => f.informed == null)) return null;
  return idsOf(list.filter((f) => f.informed === true));
}

/* ═══ ใครโทรต่อ · ภายใน 1 วันไหม ═══
 * ฐาน = ตอบ AI ว่าสนใจ (ชุดเดียวกับขั้น "สนใจ · คนโทรต่อ") · แถว = คนที่เก็บไปหน้าการติดต่อ
 * เวลา = เจ้าหน้าที่ลงมือครั้งแรกหลัง AI ได้คำตอบ (`staffFirstAt`) − เวลาที่ AI ได้คำตอบ
 * ยังไม่โทร + ใน 1 วัน + เกิน 1 วัน = สนใจ (มีเทสต์) */
export const NO_CLAIMER = 'ยังไม่มีคนเก็บ';
export type FollowCallerRow = {
  name: string;
  all: string[];
  notCalled: string[];
  /** ยังไม่โทร และรอมาเกิน 1 วันแล้ว (อยู่ใน notCalled) */
  notCalledLate: string[];
  in1d: string[];
  late: string[];
  reached: string[];
  booked: string[];
};

export function followSpeedOf(f: RecruitAppFact): 'notCalled' | 'in1d' | 'late' {
  if (!isStaffFollowed(f)) return 'notCalled';
  const start = ms(f.aiAnswerAt);
  const first = ms(f.staffFirstAt ?? f.staffLastAt);
  if (Number.isNaN(start) || Number.isNaN(first)) return 'late';
  return first - start <= DAY_MS ? 'in1d' : 'late';
}

export function buildFollowCallers(list: readonly RecruitAppFact[], now: Date = new Date()): FollowCallerRow[] {
  const yes = list.filter((f) => f.calledByAi && aiBranchOf(f) === 'yes');
  const by = new Map<string, RecruitAppFact[]>();
  for (const f of yes) {
    const k = f.claimedBy?.trim() || NO_CLAIMER;
    by.set(k, [...(by.get(k) ?? []), f]);
  }
  return [...by.entries()]
    .map(([name, fs]) => {
      const notCalled = fs.filter((f) => followSpeedOf(f) === 'notCalled');
      return {
        name,
        all: idsOf(fs),
        notCalled: idsOf(notCalled),
        notCalledLate: idsOf(notCalled.filter((f) => now.getTime() - ms(f.aiAnswerAt) > DAY_MS)),
        in1d: idsOf(fs.filter((f) => followSpeedOf(f) === 'in1d')),
        late: idsOf(fs.filter((f) => followSpeedOf(f) === 'late')),
        reached: idsOf(fs.filter(isFollowedReached)),
        booked: idsOf(fs.filter((f) => isFollowedReached(f) && f.appointmentAt)),
      };
    })
    .sort((a, b) => (a.name === NO_CLAIMER ? 1 : 0) - (b.name === NO_CLAIMER ? 1 : 0) || b.all.length - a.all.length || a.name.localeCompare(b.name, 'th'));
}
