/**
 * ═══ หน้าหลัก แท็บ "ทีม Online" — ตัวคิดล้วน (เจ้าของ 8 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"ทีม Online มีหน้าที่ต้องเอาใบขอนั้น ๆ ไปประกาศ … ใบขอเข้ามาเท่าไหร่ในแต่ละวัน · ปิดไปแล้วเท่าไหร่
 * ยกเลิกเท่าไหร่ รวมทั้งหมดเท่าไหร่ · ถูกส่งไปหน้าประกาศเท่าไหร่ · ประกาศแล้วมีคนสมัครกี่ใบ ใบละกี่คน ·
 * งานอะไรเยอะ · Bu ไหนเข้ามาเท่าไหร่"* — *"นายเป็นผู้บริหาร … ทุกเลขต้องบอกที่มาได้"*
 *
 * 🔴 ทุกก้อนบวกกันได้เท่ากับยอดบนสุด (ตัวตรวจ `onlineReportAddsUp`)
 * - ใบขอเข้า = เปิดอยู่ + ปิดครบใบขอ + ยกเลิกทั้งใบ + หาได้บางส่วน·ยกเลิกที่เหลือ (กติกา "ยกเลิกไม่ใช่หาได้แล้ว")
 * - งวดของใบขอ = **วันที่ใบส่งเข้ามา** (Choice เจ้าของ 8 ต.ค. 2569) — หน้า Dashboard ยังนับวันที่ต้องการคน (คนละแบบ บอกบนจอ)
 * - ประเภทงาน 3 มุม (Choice "แยก 3 มุม") แต่ละมุมรวมได้เท่าใบขอเข้า · ไม่มีข้อมูล = "ไม่ระบุ" (ห้ามหาย)
 */

import { classifyCallMicro, INTEREST_VOCAB } from '@/lib/callMicroOutcome';

export type OnlineRequestState = 'open' | 'fullyClosed' | 'cancelledAll' | 'partialCancelled';

export const ONLINE_REQUEST_STATES: ReadonlyArray<{ key: OnlineRequestState; label: string }> = [
  { key: 'open', label: 'เปิดอยู่' },
  { key: 'fullyClosed', label: 'ปิดครบใบขอ' },
  { key: 'cancelledAll', label: 'ยกเลิกทั้งใบ' },
  { key: 'partialCancelled', label: 'หาได้บางส่วน ที่เหลือยกเลิก' },
];

/** ใบขอหนึ่งใบ (รวมแถว throughput ของใบเดียวกันแล้ว) + ข้อมูลเสริม */
export type OnlineRequestRow = {
  requestNo: string;
  jobId: string | null;
  /** วันของงวด (YYYY-MM-DD · วันที่ใบส่งเข้ามา) */
  day: string;
  bu: string | null;
  requested: number;
  filled: number;
  cancelled: number;
  remaining: number;
  unitName: string | null;
  industry: string | null;
  sector: 'government' | 'private' | null;
  position: string | null;
  /** ประกาศเมื่อไหร่ (`job_public_releases`) · null = ยังไม่ประกาศ */
  releasedAt: string | null;
  /** ใบสมัครของใบนี้ (ไม่นับที่ยกเลิกข้อมูล) */
  applications: number;
};

export function onlineRequestStateOf(r: Pick<OnlineRequestRow, 'filled' | 'cancelled' | 'remaining'>): OnlineRequestState {
  if (r.remaining > 0) return 'open';
  if (r.filled <= 0) return 'cancelledAll';
  return r.cancelled > 0 ? 'partialCancelled' : 'fullyClosed';
}

const emptyStates = (): Record<OnlineRequestState, number> => ({ open: 0, fullyClosed: 0, cancelledAll: 0, partialCancelled: 0 });

export type OnlineCount = { key: string; label: string; n: number };

export type OnlineReport = {
  requests: {
    total: number;
    positions: number;
    byState: Record<OnlineRequestState, number>;
    daily: Array<{ day: string; total: number; byState: Record<OnlineRequestState, number> }>;
  };
  /** ใบขอเข้า = ประกาศแล้ว + ยังไม่ประกาศ (ใบยังเปิด) + ไม่ได้ประกาศ (จบไปแล้ว) */
  posting: { total: number; released: number; notReleasedOpen: number; notReleasedEnded: number };
  /** ประกาศแล้ว = มีคนสมัคร + ยังไม่มีคนสมัคร · ใบละกี่คน (มากไปน้อย) */
  results: {
    released: number;
    withApplications: number;
    withoutApplications: number;
    applications: number;
    top: Array<{ requestNo: string; unitName: string | null; position: string | null; bu: string | null; applications: number }>;
  };
  types: { industry: OnlineCount[]; sector: OnlineCount[]; position: OnlineCount[] };
  bu: Array<{ bu: string | null; total: number; byState: Record<OnlineRequestState, number> }>;
};

export type OnlineReportResponse = {
  generated_at: string;
  /** ช่วงที่ใช้จริง (YYYY-MM-DD · วันที่ใบส่งเข้ามา) */
  from: string;
  to: string;
  bu: string | null;
  report: OnlineReport | null;
  /** ใบสมัคร · AI คัดกรอง · คนโทรเอง (ตามวันสมัคร ช่วงเดียวกัน) · null = โหลดไม่ขึ้น */
  applicants: OnlineApplicantsReport | null;
  error: string | null;
};

export const ONLINE_UNSET = 'ไม่ระบุ';
const SECTOR_LABEL = { government: 'ราชการ', private: 'เอกชน' } as const;

function countBy(rows: readonly OnlineRequestRow[], keyOf: (r: OnlineRequestRow) => string | null): OnlineCount[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r)?.trim() || ONLINE_UNSET;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  // มากไปน้อย · "ไม่ระบุ" ไว้ท้ายเสมอ (ให้เห็นว่ามี แต่ไม่ปนอันดับ)
  return [...m.entries()]
    .map(([key, n]) => ({ key, label: key, n }))
    .sort((a, b) => (a.key === ONLINE_UNSET ? 1 : b.key === ONLINE_UNSET ? -1 : b.n - a.n || a.key.localeCompare(b.key, 'th')));
}

/** วันทุกวันในช่วง — วันที่ไม่มีใบ = 0 (กราฟห้ามหายวัน) */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  for (let i = 0; d <= end && i < 400; i += 1) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function buildOnlineReport(rows: readonly OnlineRequestRow[], range: { from: string; to: string }, topN = 10): OnlineReport {
  const byState = emptyStates();
  const dayMap = new Map<string, Record<OnlineRequestState, number>>();
  const buMap = new Map<string | null, Record<OnlineRequestState, number>>();
  let positions = 0;
  const posting = { total: rows.length, released: 0, notReleasedOpen: 0, notReleasedEnded: 0 };
  const results = { released: 0, withApplications: 0, withoutApplications: 0, applications: 0 };

  for (const r of rows) {
    const st = onlineRequestStateOf(r);
    byState[st] += 1;
    positions += r.requested;
    const d = dayMap.get(r.day) ?? emptyStates();
    d[st] += 1;
    dayMap.set(r.day, d);
    const b = buMap.get(r.bu) ?? emptyStates();
    b[st] += 1;
    buMap.set(r.bu, b);

    if (r.releasedAt) {
      posting.released += 1;
      results.released += 1;
      results.applications += r.applications;
      if (r.applications > 0) results.withApplications += 1;
      else results.withoutApplications += 1;
    } else if (st === 'open') posting.notReleasedOpen += 1;
    else posting.notReleasedEnded += 1;
  }

  const sum = (s: Record<OnlineRequestState, number>) => s.open + s.fullyClosed + s.cancelledAll + s.partialCancelled;
  const daily = daysBetween(range.from, range.to).map((day) => {
    const s = dayMap.get(day) ?? emptyStates();
    return { day, total: sum(s), byState: s };
  });
  // ใบที่วันงวดอยู่นอกช่วงที่ขอ (ไม่ควรมี) — ยังนับในยอดรวม · ไม่หายเงียบ
  const top = rows
    .filter((r) => r.releasedAt)
    .sort((a, b) => b.applications - a.applications || a.requestNo.localeCompare(b.requestNo))
    .slice(0, topN)
    .map((r) => ({ requestNo: r.requestNo, unitName: r.unitName, position: r.position, bu: r.bu, applications: r.applications }));

  return {
    requests: { total: rows.length, positions, byState, daily },
    posting,
    results: { ...results, top },
    types: {
      industry: countBy(rows, (r) => r.industry),
      sector: countBy(rows, (r) => (r.sector ? SECTOR_LABEL[r.sector] : null)),
      position: countBy(rows, (r) => r.position),
    },
    bu: [...buMap.entries()]
      .map(([bu, s]) => ({ bu, total: sum(s), byState: s }))
      .sort((a, b) => b.total - a.total),
  };
}

/** ตัวตรวจเลข — ทุกก้อนต้องรวมได้เท่าใบขอเข้า (ไม่ลงตัว = จอต้องบอก ห้ามกลบ) */
export function onlineReportAddsUp(r: OnlineReport): boolean {
  const t = r.requests.total;
  const s = r.requests.byState;
  const sumTypes = (xs: OnlineCount[]) => xs.reduce((n, x) => n + x.n, 0);
  return (
    s.open + s.fullyClosed + s.cancelledAll + s.partialCancelled === t &&
    r.posting.released + r.posting.notReleasedOpen + r.posting.notReleasedEnded === t &&
    r.results.withApplications + r.results.withoutApplications === r.results.released &&
    sumTypes(r.types.industry) === t &&
    sumTypes(r.types.sector) === t &&
    sumTypes(r.types.position) === t &&
    r.bu.reduce((n, b) => n + b.total, 0) === t
  );
}

/** แถว throughput (ใบเดียวแตกเป็นหลายแถวตามชนิด) → ใบละแถว */
export type ThroughputLike = {
  requestNo?: string;
  jobId?: string;
  requestDate: string;
  positionUnits: number;
  kind?: 'filled' | 'cancelled' | 'remaining';
  isOpen: boolean;
  siteCode?: string;
  unitName?: string;
};

export function groupThroughputByRequest(
  records: readonly ThroughputLike[],
): Array<{ requestNo: string; jobId: string | null; day: string; siteCode: string | null; unitName: string | null; requested: number; filled: number; cancelled: number; remaining: number }> {
  const m = new Map<string, { requestNo: string; jobId: string | null; day: string; siteCode: string | null; unitName: string | null; requested: number; filled: number; cancelled: number; remaining: number }>();
  for (const r of records) {
    const no = (r.requestNo ?? '').trim();
    if (!no) continue;
    const cur = m.get(no) ?? {
      requestNo: no,
      jobId: r.jobId ?? null,
      day: r.requestDate.slice(0, 10),
      siteCode: r.siteCode?.trim() || null,
      unitName: r.unitName?.trim() || null,
      requested: 0,
      filled: 0,
      cancelled: 0,
      remaining: 0,
    };
    const kind = r.kind ?? (r.isOpen ? 'remaining' : 'filled');
    const n = Math.max(0, Number(r.positionUnits) || 0);
    cur.requested += n;
    if (kind === 'filled') cur.filled += n;
    else if (kind === 'cancelled') cur.cancelled += n;
    else cur.remaining += n;
    m.set(no, cur);
  }
  return [...m.values()];
}

/* ═══ ใบสมัคร · AI คัดกรอง · คนโทรเอง (รอบ 2 · เจ้าของ 8 ต.ค. 2569 ข้อ 7–9) ═══
 * ใบสมัครเข้า = ส่งให้ AI + อายุเกิน (ไม่ส่ง) + ไม่ได้ส่ง AI
 * ส่งให้ AI (AI ต้องโทร) = โทรแล้ว + ยกเลิก + รอดำเนินการ
 * โทรแล้ว = สนใจ + ไม่สนใจ + สรุปไม่ได้ + ล้มเหลว (ติดต่อไม่ได้)
 * ผลของ AI อ่านจากผลโทรของ AI เท่านั้น (ไม่ปนผลของคน) · คำเล็กชุดเดียวกับกล่องงาน (`classifyCallMicro` · INTEREST_VOCAB)
 */
export type OnlineApplicantRow = {
  bu: string | null;
  position: string | null;
  age: number | null;
  /** มีแถวในคิว AI ของใบนี้ (เคยส่งให้ AI) */
  queued: boolean;
  /** มีหลักฐานว่า AI โทรแล้ว (ใบนี้หรือเบอร์เดียวกัน) */
  ai: boolean;
  /** มีหลักฐานว่าคนโทร */
  staff: boolean;
  /** ยังรออยู่ในคิว AI (ยังไม่มีผล) */
  inQueue: boolean;
  aiOutcome: string | null;
  aiSummary: string | null;
  aiReply: string | null;
};

export type OnlineAiBucket = 'interested' | 'notInterested' | 'unclear' | 'failed' | 'cancelled' | 'waiting';
export const ONLINE_AI_CALLED: ReadonlyArray<{ key: OnlineAiBucket; label: string }> = [
  { key: 'interested', label: 'สนใจ' },
  { key: 'notInterested', label: 'ไม่สนใจ' },
  { key: 'unclear', label: 'สรุปไม่ได้' },
  { key: 'failed', label: 'ล้มเหลว' },
];

/** อายุเกินที่ระบบไม่ส่งให้ AI — ตัวเดียวกับ `OVER_AGE_MIN` ของหน้าหลัก */
const ONLINE_OVER_AGE = 58;

export type OnlineApplicantKind = 'sent' | 'overAge' | 'notSent';

export function onlineApplicantKindOf(r: OnlineApplicantRow): OnlineApplicantKind {
  if (r.queued || r.ai) return 'sent';
  return (r.age ?? 0) >= ONLINE_OVER_AGE ? 'overAge' : 'notSent';
}

/** ใบที่ส่งให้ AI แล้วอยู่ตรงไหน — มีผล (ไม่ใช่ยกเลิก) = โทรแล้ว แตกผล · ยังอยู่ในคิว = รอ · ที่เหลือ = ยกเลิก */
export function onlineAiBucketOf(r: OnlineApplicantRow): OnlineAiBucket {
  const out = (r.aiOutcome ?? '').trim().toLowerCase();
  if (out && out !== 'cancelled') {
    const micro = classifyCallMicro({ outcome: r.aiOutcome, summary: r.aiSummary, reply: r.aiReply }, INTEREST_VOCAB);
    if (micro === 'said_yes') return 'interested';
    if (micro === 'said_no' || micro === 'wrong_person') return 'notInterested';
    if (micro === 'no_pickup') return 'failed';
    return 'unclear';
  }
  return r.inQueue ? 'waiting' : 'cancelled';
}

export type OnlineApplicantsReport = {
  total: number;
  sent: number;
  overAge: number;
  notSent: number;
  ai: Record<OnlineAiBucket, number> & { called: number };
  staff: { total: number; afterAi: number; staffOnly: number };
  bu: OnlineCount[];
  position: OnlineCount[];
};

export function buildOnlineApplicantsReport(rows: readonly OnlineApplicantRow[]): OnlineApplicantsReport {
  const ai: Record<OnlineAiBucket, number> & { called: number } = {
    interested: 0, notInterested: 0, unclear: 0, failed: 0, cancelled: 0, waiting: 0, called: 0,
  };
  let sent = 0;
  let overAge = 0;
  let notSent = 0;
  const staff = { total: 0, afterAi: 0, staffOnly: 0 };
  const bu = new Map<string, number>();
  const pos = new Map<string, number>();
  for (const r of rows) {
    const k = onlineApplicantKindOf(r);
    if (k === 'sent') {
      sent += 1;
      const b = onlineAiBucketOf(r);
      ai[b] += 1;
      if (b !== 'cancelled' && b !== 'waiting') ai.called += 1;
    } else if (k === 'overAge') overAge += 1;
    else notSent += 1;
    if (r.staff) {
      staff.total += 1;
      if (r.ai) staff.afterAi += 1;
      else staff.staffOnly += 1;
    }
    const bk = r.bu?.trim() || ONLINE_UNSET;
    bu.set(bk, (bu.get(bk) ?? 0) + 1);
    const pk = r.position?.trim() || ONLINE_UNSET;
    pos.set(pk, (pos.get(pk) ?? 0) + 1);
  }
  const sorted = (m: Map<string, number>): OnlineCount[] =>
    [...m.entries()]
      .map(([key, n]) => ({ key, label: key, n }))
      .sort((a, b) => (a.key === ONLINE_UNSET ? 1 : b.key === ONLINE_UNSET ? -1 : b.n - a.n || a.key.localeCompare(b.key, 'th')));
  return { total: rows.length, sent, overAge, notSent, ai, staff, bu: sorted(bu), position: sorted(pos) };
}

/** ตัวตรวจเลขของส่วนใบสมัคร */
export function onlineApplicantsAddUp(a: OnlineApplicantsReport): boolean {
  const x = a.ai;
  return (
    a.sent + a.overAge + a.notSent === a.total &&
    x.called + x.cancelled + x.waiting === a.sent &&
    x.interested + x.notInterested + x.unclear + x.failed === x.called &&
    a.staff.afterAi + a.staff.staffOnly === a.staff.total &&
    a.bu.reduce((n, b) => n + b.n, 0) === a.total &&
    a.position.reduce((n, b) => n + b.n, 0) === a.total
  );
}

