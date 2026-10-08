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
