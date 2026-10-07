/**
 * ═══ เส้นทางติดตามบนหน้าหลัก — ไล่ Journey ทีละขั้น นับทั้งคนและสาย (เจ้าของ 7 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"หน้าหลักตอบพวกนี้ได้ไหม … เก็บแบบไมโครเลยได้ไหม และ มี interactive"* — flow ติดตามคนเริ่มงาน / ส่งคนแทน
 * Choice: เพิ่มคน = **โชว์ทั้งคน และ สาย** · ช่วงวัน = **วันที่โทร** · กดแล้ว = **เห็นรายชื่อ + กราฟรายวัน** ·
 * ส่งคนแทน "iRecruit แก้ / ยกเลิกกี่ใบ" = **ต้องมี** (เริ่มเก็บ 7 ต.ค. 2569)
 *
 * หมวดของสายมาจาก `callCategory` ตัวเดียวกับหน้าติดตาม (server ใช้ `categorizeFollowRows`) · ขอเลื่อนแยกจากสรุปไม่ได้
 * (ตัวเลขบนแผงหน้าติดตามยังรวมขอเลื่อนในสรุปไม่ได้ — ที่นี่แยกให้เห็นตามที่เจ้าของถาม แถว "สรุปไม่ได้" = ไม่รวมขอเลื่อน)
 * ไฟล์นี้ pure — เทสต์ที่ `tests/api/followJourney.test.ts`
 */
import type { FollowCallCategory } from '@/lib/followPlanning';

export type FollowJourneyTeam = 'main' | 'replacement';
export type FollowJourneyView = 'all' | FollowJourneyTeam;

/** ผลของสายบนเส้นทาง — หมวดของหน้าติดตาม + ขอเลื่อนแยกออกมา · รอโทร = ยังไม่ถึงเวลา/เลยเวลา/ไม่ได้ส่ง */
export type FollowJourneyResult = 'agreed' | 'lost' | 'reschedule' | 'unreachable' | 'other' | 'cancelled' | 'waiting';

export function journeyResultOf(category: FollowCallCategory, outcome: string | null | undefined): FollowJourneyResult {
  if (category === 'other' && (outcome ?? '').trim() === 'reschedule_requested') return 'reschedule';
  if (category === 'waiting' || category === 'overdue' || category === 'notSent') return 'waiting';
  return category;
}

/** หนึ่งสาย — server ส่งมาแบบเบา (ไม่มีเบอร์ · คีย์คน = แฮช) */
export type FollowJourneyRow = {
  id: string;
  /** คีย์คน (เบอร์ + ทีม) — นับคนไม่ซ้ำ */
  person: string;
  name: string;
  unit: string | null;
  /** เวลานัด ISO */
  at: string;
  /** วันไทย YYYY-MM-DD ของเวลานัด */
  ymd: string;
  team: FollowJourneyTeam;
  caller: 'ai' | 'manual';
  result: FollowJourneyResult;
  /** ส่งคนแทน: ใบงานจาก iRecruit (null = คีย์เอง) · ประเภทคนไปแทน (IN = คนใน) */
  job: string | null;
  replaceType: string | null;
};

/** เหตุการณ์จากรอบดึง iRecruit (เริ่มเก็บ 7 ต.ค. 2569) */
export type FollowJourneyEvent = { at: string; ymd: string; kind: 'edit' | 'cancel'; job: string; name: string; unit: string | null };

export type FollowJourneyResponse = {
  generated_at: string;
  from: string | null;
  to: string | null;
  bu: string | null;
  rows: FollowJourneyRow[];
  events: FollowJourneyEvent[];
  error: string | null;
};

/** ขั้นบนเส้นทาง — กดได้ทุกขั้น */
export type FollowJourneyStage =
  | 'added'
  | 'ai'
  | 'manual'
  | 'called'
  | FollowJourneyResult
  | 'irecruit'
  | 'inside'
  | 'outside'
  | 'irecruitEdit'
  | 'irecruitCancel';

export const FOLLOW_JOURNEY_STAGE_LABEL: Record<FollowJourneyStage, string> = {
  added: 'ทั้งหมด',
  ai: 'AI โทร',
  manual: 'คนโทร',
  called: 'โทรแล้ว',
  agreed: 'ไป',
  lost: 'ไม่ไป',
  reschedule: 'ขอเลื่อน',
  unreachable: 'ไม่รับสาย',
  other: 'สรุปไม่ได้',
  cancelled: 'ยกเลิก',
  waiting: 'รอโทร',
  irecruit: 'ดึงจาก iRecruit',
  inside: 'คนใน',
  outside: 'คนนอก',
  irecruitEdit: 'iRecruit แก้',
  irecruitCancel: 'iRecruit ยกเลิก',
};

const RESULTS_CALLED: readonly FollowJourneyResult[] = ['agreed', 'lost', 'reschedule', 'unreachable', 'other'];

/** สายของขั้นนั้น (ขั้นของ iRecruit แก้/ยกเลิก ไม่ใช่สาย — ดู `journeyEventsOf`) */
export function journeyRowsOf(rows: readonly FollowJourneyRow[], stage: FollowJourneyStage): FollowJourneyRow[] {
  switch (stage) {
    case 'added':
      return [...rows];
    case 'ai':
    case 'manual':
      return rows.filter((r) => r.caller === stage);
    case 'called':
      return rows.filter((r) => RESULTS_CALLED.includes(r.result));
    case 'irecruit':
      return rows.filter((r) => r.job != null);
    case 'inside':
      return rows.filter((r) => r.team === 'replacement' && (r.replaceType ?? '').trim().toUpperCase() === 'IN');
    case 'outside':
      return rows.filter((r) => r.team === 'replacement' && (r.replaceType ?? '').trim().toUpperCase() !== 'IN');
    case 'irecruitEdit':
    case 'irecruitCancel':
      return [];
    default:
      return rows.filter((r) => r.result === stage);
  }
}

export function journeyEventsOf(events: readonly FollowJourneyEvent[], stage: FollowJourneyStage): FollowJourneyEvent[] {
  if (stage === 'irecruitEdit') return events.filter((e) => e.kind === 'edit');
  if (stage === 'irecruitCancel') return events.filter((e) => e.kind === 'cancel');
  return [];
}

export type JourneyCount = { people: number; calls: number };

/** นับขั้นเดียว — สาย = แถว · คน = คีย์คนไม่ซ้ำ · ใบงาน iRecruit / เหตุการณ์ = ใบไม่ซ้ำ (ใส่ใน calls) */
export function journeyCount(
  rows: readonly FollowJourneyRow[],
  events: readonly FollowJourneyEvent[],
  stage: FollowJourneyStage,
): JourneyCount {
  if (stage === 'irecruitEdit' || stage === 'irecruitCancel') {
    const ev = journeyEventsOf(events, stage);
    return { people: new Set(ev.map((e) => e.job)).size, calls: ev.length };
  }
  const list = journeyRowsOf(rows, stage);
  if (stage === 'irecruit') return { people: new Set(list.map((r) => r.job)).size, calls: list.length };
  return { people: new Set(list.map((r) => r.person)).size, calls: list.length };
}

/** แถวของมุมมองที่เลือก */
export function journeyScope(rows: readonly FollowJourneyRow[], view: FollowJourneyView): FollowJourneyRow[] {
  return view === 'all' ? [...rows] : rows.filter((r) => r.team === view);
}

/** รายวันของขั้นเดียว (กราฟตอนกด) — ครบทุกวันในช่วงที่มีข้อมูล · วันว่าง = 0 */
export function journeyDaily(
  rows: readonly FollowJourneyRow[],
  events: readonly FollowJourneyEvent[],
  stage: FollowJourneyStage,
): Array<{ ymd: string; people: number; calls: number }> {
  const byDay = new Map<string, { people: Set<string>; calls: number }>();
  const add = (ymd: string, who: string) => {
    const d = byDay.get(ymd) ?? { people: new Set<string>(), calls: 0 };
    d.people.add(who);
    d.calls += 1;
    byDay.set(ymd, d);
  };
  if (stage === 'irecruitEdit' || stage === 'irecruitCancel') {
    for (const e of journeyEventsOf(events, stage)) add(e.ymd, e.job);
  } else {
    for (const r of journeyRowsOf(rows, stage)) add(r.ymd, stage === 'irecruit' ? (r.job ?? r.person) : r.person);
  }
  const days = [...byDay.keys()].sort();
  if (days.length === 0) return [];
  const out: Array<{ ymd: string; people: number; calls: number }> = [];
  for (let t = Date.parse(`${days[0]}T00:00:00Z`); t <= Date.parse(`${days[days.length - 1]}T00:00:00Z`); t += 86_400_000) {
    const ymd = new Date(t).toISOString().slice(0, 10);
    const d = byDay.get(ymd);
    out.push({ ymd, people: d ? d.people.size : 0, calls: d ? d.calls : 0 });
  }
  return out;
}

/** เฉลี่ยคนต่อวัน (เพิ่มคน "วันละเท่าไหร่") — หารด้วยจำนวนวันที่มีสาย */
export function journeyPerDay(rows: readonly FollowJourneyRow[]): number {
  const days = new Set(rows.map((r) => r.ymd)).size;
  if (days === 0) return 0;
  const perDay = new Map<string, Set<string>>();
  for (const r of rows) perDay.set(r.ymd, (perDay.get(r.ymd) ?? new Set()).add(r.person));
  const sum = [...perDay.values()].reduce((n, s) => n + s.size, 0);
  return Math.round(sum / days);
}

/** ลำดับผลบนจอ — รวมทุกช่อง = สายทั้งหมดของมุมมองนั้นเสมอ (เจ้าของ 7 ต.ค. 2569 "เช็คเองแล้วไม่ตรง ไม่เชื่อใจ") */
export const FOLLOW_JOURNEY_RESULTS: readonly FollowJourneyResult[] = [
  'agreed',
  'lost',
  'reschedule',
  'unreachable',
  'other',
  'cancelled',
  'waiting',
];

/** สีของผล — ภาษาเดียวกับหน้าติดตาม (`FOLLOW_MATRIX_COL_TONE`) · ขอเลื่อนอยู่ใต้สรุปไม่ได้บนหน้าติดตาม เลยสีเดียวกัน */
export const FOLLOW_JOURNEY_RESULT_TONE: Record<FollowJourneyResult, 'neutral' | 'success' | 'danger' | 'warn' | 'info' | 'violet'> = {
  agreed: 'success',
  lost: 'danger',
  reschedule: 'violet',
  unreachable: 'warn',
  other: 'violet',
  cancelled: 'neutral',
  waiting: 'info',
};

/** ผลบนเส้นทาง → ช่องบนแผงหน้าติดตาม (ขอเลื่อนรวมอยู่ในสรุปไม่ได้) — เทสต์ใช้ล็อกว่าเลขสองหน้าเท่ากัน */
export function journeyResultMatrixCol(
  r: FollowJourneyResult,
): 'went' | 'notWent' | 'noAnswer' | 'unclear' | 'waiting' | 'cancelled' {
  switch (r) {
    case 'agreed':
      return 'went';
    case 'lost':
      return 'notWent';
    case 'unreachable':
      return 'noAnswer';
    case 'reschedule':
    case 'other':
      return 'unclear';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'waiting';
  }
}
