/**
 * ═══ ใบขอใบเดียว ทำอะไรไปแล้ว ไล่ตามวัน (เจ้าของ 20 พ.ย. 2569 — ผู้บริหารถามย้อนกลับ) ═══
 * > ใบที่ปิดได้ ปิดเพราะทำอะไร · ใบที่ยกเลิก ทำอะไรไปแล้วบ้าง · ตั้งแต่ขอถึงวันนี้ ใครทำอะไรวันไหน
 *
 * เหตุการณ์ฝั่งระบบเรา (`/api/request-timeline` — Gen link · โพสต์แล้ว · Autopost · Scrap · รายชื่อเข้า · AI โทรแล้ว · ลงผลติดต่อ · ลงผลนัด · แจ้งเข้า)
 * + หลักของใบจากสมุดใบขอที่หน้าโหลดอยู่แล้ว (ขอมา · ประกาศ · หาได้แล้ว · ยกเลิก)
 * 🔴 ไม่มีชื่อ/เบอร์ผู้สมัคร — นับเป็นจำนวนต่อวันต่อคนทำ · ตรรกะล้วน ไม่มี import ที่มีค่า (server ใช้ด้วย) · เทสต์ `requestTimeline.test.ts`
 */
import type { StuckRequest } from './recruitStuck';

/** ลำดับในวันเดียวกัน = ลำดับที่งานเกิดจริง (ออกไปหาคน → รายชื่อเข้า → โทร → นัด → แจ้งเข้า) */
export const REQUEST_EVENT_KINDS = ['links', 'manualPosted', 'autopost', 'scrap', 'names', 'ai', 'contacts', 'attendance', 'informed'] as const;
export type RequestEventKind = (typeof REQUEST_EVENT_KINDS)[number];
/** คำบนจอ — งาน 4 ชนิดแรก + ลงผลติดต่อ ใช้คำเดียวกับแถว "งานที่ทำ" (`STAFF_PERSON_KINDS`) */
export const REQUEST_EVENT_LABEL: Record<RequestEventKind, string> = {
  links: 'Gen link',
  manualPosted: 'โพสต์',
  autopost: 'Autopost',
  scrap: 'Scrap',
  names: 'รายชื่อเข้า',
  ai: 'AI โทรแล้ว',
  contacts: 'ลงผลติดต่อ',
  attendance: 'ลงผลนัด',
  informed: 'แจ้งเข้า',
};
export const REQUEST_EVENT_UNIT: Record<RequestEventKind, string> = {
  links: 'ลิงก์',
  manualPosted: 'ครั้ง',
  autopost: 'ครั้ง',
  scrap: 'ครั้ง',
  names: 'คน',
  ai: 'คน',
  contacts: 'ครั้ง',
  attendance: 'ครั้ง',
  informed: 'คน',
};

/** เหตุการณ์ 1 กลุ่ม: วันไทย · ชนิด · ใครทำ (null = ผู้สมัคร/ระบบ) · รายละเอียด (ช่องทาง / ผล) · จำนวน */
export type RequestEvent = { day: string; kind: RequestEventKind; who: string | null; detail: string | null; n: number };
/** งานที่ทำกับใบนี้ทุกช่วงเวลา — ชนิดเดียวกับแถว "งานที่ทำ" */
export type RequestWork = { links: number; manualPosted: number; autopost: number; scrap: number; contacts: number; appts: number };
export type RequestDone = {
  work: RequestWork;
  /** รายชื่อ → AI โทรแล้ว → AI สนใจ → คนโทรต่อ ติดต่อได้ → นัดได้ → มา → แจ้งเข้า (ลำดับและตัวนับเดียวกับ `SCALE_CHAIN`) */
  chain: number[];
};
/** `events` null = ไม่ได้ขอเหตุการณ์ (โหมดสรุปหลายใบ) */
export type RequestTimelineJob = { done: RequestDone; events: RequestEvent[] | null };
/** ค่า null ของใบ = ใบนอก BU ที่ผู้ถามเห็น */
export type RequestTimelineResponse = { jobs: Record<string, RequestTimelineJob | null> };
/** ขอได้ครั้งละไม่เกินเท่านี้ใบ (= 1 หน้าของตาราง) */
export const REQUEST_TIMELINE_MAX = 30;

export const emptyRequestWork = (): RequestWork => ({ links: 0, manualPosted: 0, autopost: 0, scrap: 0, contacts: 0, appts: 0 });

/** แถวของไทม์ไลน์บนจอ — `mark` = หลักของใบ (ขอมา · ประกาศ · หาได้แล้ว · ยกเลิก) */
export type RequestTimelineRow = { key: string; day: string; label: string; who: string | null; detail: string | null; n: number | null; unit: string; mark: boolean };

const BKK_MS = 7 * 3_600_000;
/** เวลา ISO → วันไทย · ค่าที่เป็นวันอยู่แล้ว (YYYY-MM-DD) คืนตามเดิม · อ่านไม่ออก = null */
function dayOf(v: string | null | undefined): string | null {
  const s = v?.trim() ?? '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t + BKK_MS).toISOString().slice(0, 10) : null;
}

type TimelineRequest = Pick<StuckRequest, 'day' | 'requested' | 'releasedAt' | 'releasedBy' | 'flow'>;

/**
 * รวมหลักของใบกับเหตุการณ์ฝั่งระบบเรา เรียงเก่า → ใหม่
 * หาได้แล้ว / ยกเลิก รายวันมีเฉพาะที่เกิดในช่วงที่เลือก (`flow.fillDays` · `flow.cancelDays` ของสมุดใบขอ)
 */
export function buildRequestTimeline(r: TimelineRequest, events: readonly RequestEvent[], cancelReason: string | null): RequestTimelineRow[] {
  type Sorted = RequestTimelineRow & { rank: number };
  const rows: Sorted[] = [];
  const mark = (rank: number, day: string | null, label: string, n: number | null, unit: string, who: string | null = null, detail: string | null = null) => {
    if (day) rows.push({ key: `${label}:${day}:${rows.length}`, day, label, who, detail, n, unit, mark: true, rank });
  };
  mark(0, dayOf(r.day), 'ขอมา', r.requested, 'อัตรา');
  mark(1, dayOf(r.releasedAt), 'ประกาศ', null, '', r.releasedBy?.trim() || null);
  for (const [day, n] of r.flow?.fillDays ?? []) if (n > 0) mark(90, dayOf(day), 'หาได้แล้ว', n, 'อัตรา');
  for (const [day, n] of r.flow?.cancelDays ?? []) if (n > 0) mark(91, dayOf(day), 'ยกเลิก', n, 'อัตรา', null, cancelReason);
  events.forEach((e, i) => {
    rows.push({ key: `${e.kind}:${e.day}:${i}`, day: e.day, label: REQUEST_EVENT_LABEL[e.kind], who: e.who, detail: e.detail, n: e.n, unit: REQUEST_EVENT_UNIT[e.kind], mark: false, rank: 10 + REQUEST_EVENT_KINDS.indexOf(e.kind) });
  });
  return rows
    .sort((a, b) => a.day.localeCompare(b.day) || a.rank - b.rank || (a.who ?? '').localeCompare(b.who ?? '', 'th') || (b.n ?? 0) - (a.n ?? 0))
    .map((x) => ({ key: x.key, day: x.day, label: x.label, who: x.who, detail: x.detail, n: x.n, unit: x.unit, mark: x.mark }));
}

/** รวมเหตุการณ์ที่วัน · ชนิด · คนทำ · รายละเอียด ตรงกัน (ฝั่ง server แปลงสถานะเป็นคำแล้วหลายสถานะกลายเป็นคำเดียว) */
export function mergeRequestEvents(events: readonly RequestEvent[]): RequestEvent[] {
  const m = new Map<string, RequestEvent>();
  for (const e of events) {
    const k = `${e.day}|${e.kind}|${e.who ?? ''}|${e.detail ?? ''}`;
    const cur = m.get(k);
    if (cur) cur.n += e.n;
    else m.set(k, { ...e });
  }
  return [...m.values()];
}
