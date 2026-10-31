/**
 * ═══ แท็บใบขอ ภาพรวมงานสรรหา (เจ้าของ 29 ต.ค. 2569 · แบบร่างที่เจ้าของเคาะ "อะงั้นทำเลย") ═══
 * เจ้าของ: *"นิยามคือใบขอเข้ามาเท่าไหร่ ต้องหาจริงๆเท่าไหร่ แล้วที่หา อะเริ่มยัง พื้นที่ไหนเยอะจะได้หาล่วงหน้าได้
 * เริ่มหาแล้วผลเป็นไง ผลเป็นไงมาจากช่องทางไหนเยอะ ช่องทางไหน Success เยอะ"*
 *
 * 1. ใบขอเข้ามา = ยกเลิก + ปิดแล้ว + ดำเนินการสรรหา (`onlineRequestStateOf` ตัวเดียวกับทีม Online)
 *    ดำเนินการ = ยังไม่ประกาศ + ประกาศแล้วไม่มีคนกรอก + ประกาศแล้วมีคนกรอก (กี่คน)
 * 3. พื้นที่ขาดคน — จังหวัดของไซต์ใน ERP ก่อน · อำเภอ/ตำบล = ที่เจ้าหน้าที่แก้ในใบ › อ่านจากที่อยู่หน้างาน › "ไม่ระบุ"
 *    (ERP ไม่มีช่องอำเภอของหน้างาน · Choice แนะนำที่เจ้าของไม่ได้ค้าน) · แต่ละจังหวัดแยก ฉุกเฉิน / ฉุกเฉิน-ย้อนหลัง / ล่วงหน้า
 * 4. คนที่กรอกมา แยกช่องทางหลัก › รอง: AI ไม่โทร · รอโทร · รอโทรซ้ำ · โทรแล้ว (สนใจ · ไม่สนใจ · ไม่รับสาย · สรุปไม่ได้ · คนโทรเอง)
 *    ทุกแถว: ไม่โทร + รอโทร + รอโทรซ้ำ + โทรแล้ว = ทั้งหมด · ผลของโทรแล้วรวมกัน = โทรแล้ว
 * ประเภทงาน: ธนาคาร = กลุ่มอุตสาหกรรม ERP "ธนาคาร" › กลุ่มลูกค้า ERP › ที่ทีมระบุเอง (`unit_sector`) › ยังไม่ระบุ
 * ไฟล์นี้ pure — เทสต์ `tests/api/recruitRequestTab2569-10-29.test.ts`
 */
import { onlineRequestStateOf } from '@/lib/homeOnline';
import { aiStage } from '@/lib/recruitJourney';
import { FUNNEL_GROUP_LABEL, NO_SUB, funnelPlaceOf, funnelSubOf, type FunnelGroupKey } from '@/lib/channelFunnel';
import type { RequestLeadKind } from '@/lib/requestLeadKind';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

export type RequestSector = 'bank' | 'government' | 'private';
export const REQUEST_SECTOR_LABEL: Record<RequestSector, string> = { private: 'เอกชน', government: 'ราชการ', bank: 'ธนาคาร' };
export const REQUEST_SECTOR_UNSET = 'ยังไม่ระบุ';
export const NO_PROVINCE = 'ไม่ระบุจังหวัด';
export const NO_DISTRICT = 'ไม่ระบุอำเภอ';
export const NO_SUBDISTRICT = 'ไม่ระบุตำบล';

/** ใบขอหนึ่งใบของช่วง (ส่งจาก `/api/recruit-overview` เป็น `requestRows`) */
export type RecruitRequestRow = {
  requestNo: string;
  jobId: string | null;
  /** วันที่ใบส่งเข้ามา (YYYY-MM-DD) — กราฟแนวโน้มใบขอ (30 ต.ค. 2569) */
  day?: string;
  unitName: string | null;
  /** ตำแหน่ง — รายการใบขอที่กดดู (29 ต.ค. 2569 "กดแล้วบอกว่าใบไหนบ้าง") */
  position?: string | null;
  siteCode: string | null;
  siteName: string | null;
  sector: RequestSector | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  leadKind: RequestLeadKind | null;
  requested: number;
  filled: number;
  cancelled: number;
  remaining: number;
  released: boolean;
  applications: number;
};

/** ธนาคาร (อุตสาหกรรม ERP) › กลุ่มลูกค้า ERP › ที่ทีมระบุเอง */
export function requestSectorOf(
  industry: string | null | undefined,
  customerGroup: string | null | undefined,
  unitSector: 'government' | 'private' | null | undefined,
): RequestSector | null {
  if ((industry ?? '').trim() === 'ธนาคาร') return 'bank';
  const g = (customerGroup ?? '').trim();
  if (/^(ราชการ|รัฐวิสาหกิจ|กฟภ\.?)$/.test(g)) return 'government';
  if (/^(เอกชน|บุคคลธรรมดา)$/.test(g)) return 'private';
  return unitSector ?? null;
}

/**
 * 🔴 29 ต.ค. 2569 เจ้าของ "ชื่อหน่วยงานไม่เอาและ เอา Codesite แต่ดึงจาก erp ที่มีใบขอ" — ไม่มีช่องพิมพ์ชื่อหน่วยงาน · Code Site เลือกจากไซต์ที่มีใบขอ
 * ปุ่มกรุงศรี/SCB/Ford ถอดแล้ว ("เอาออกได้เพราะด้านบน Fil ให้แทนแล้ว") — ห้ามเติมกลับ
 */
export type RequestTabFilter = {
  sector: RequestSector | 'unset' | null;
  siteCode: string | null;
  province: string | null;
  district: string | null;
  subdistrict: string | null;
};
export const EMPTY_REQUEST_FILTER: RequestTabFilter = { sector: null, siteCode: null, province: null, district: null, subdistrict: null };

export const isRequestFilterActive = (f: RequestTabFilter) =>
  Boolean(f.sector || f.siteCode || f.province || f.district || f.subdistrict);

export const provinceOf = (r: RecruitRequestRow) => r.province || NO_PROVINCE;
export const districtOf = (r: RecruitRequestRow) => r.district || NO_DISTRICT;
export const subdistrictOf = (r: RecruitRequestRow) => r.subdistrict || NO_SUBDISTRICT;

export function filterRequestRows(rows: readonly RecruitRequestRow[], f: RequestTabFilter): RecruitRequestRow[] {
  return rows.filter(
    (r) =>
      (!f.sector || (f.sector === 'unset' ? r.sector === null : r.sector === f.sector)) &&
      (!f.siteCode || r.siteCode === f.siteCode) &&
      (!f.province || provinceOf(r) === f.province) &&
      (!f.district || districtOf(r) === f.district) &&
      (!f.subdistrict || subdistrictOf(r) === f.subdistrict),
  );
}

/** ไซต์ที่มีใบขอในช่วง (ERP) — ตัวเลือก Code Site · ใบมากสุดขึ้นก่อน · ค้นด้วยชื่อไซต์/หน่วยงานได้ */
export function requestSiteOptions(rows: readonly RecruitRequestRow[]): Array<{ value: string; name: string; unit: string; n: number }> {
  const m = new Map<string, { value: string; name: string; unit: string; n: number }>();
  for (const r of rows) {
    if (!r.siteCode) continue;
    const cur = m.get(r.siteCode) ?? { value: r.siteCode, name: r.siteName || r.unitName || '', unit: r.unitName ?? '', n: 0 };
    cur.n += 1;
    m.set(r.siteCode, cur);
  }
  return [...m.values()].sort((a, b) => b.n - a.n || a.value.localeCompare(b.value));
}

/** ตัวเลือกของดรอปดาวน์พื้นที่ — นับใบ มากไปน้อย · อำเภอเฉพาะจังหวัดที่เลือก · ตำบลเฉพาะอำเภอที่เลือก */
export function requestAreaOptions(
  rows: readonly RecruitRequestRow[],
  f: Pick<RequestTabFilter, 'province' | 'district'>,
): { provinces: Array<{ value: string; n: number }>; districts: Array<{ value: string; n: number }>; subdistricts: Array<{ value: string; n: number }> } {
  const count = (list: readonly RecruitRequestRow[], key: (r: RecruitRequestRow) => string) => {
    const m = new Map<string, number>();
    for (const r of list) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
    return [...m.entries()].map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n || a.value.localeCompare(b.value, 'th'));
  };
  const inProv = f.province ? rows.filter((r) => provinceOf(r) === f.province) : [];
  const inDist = f.district ? inProv.filter((r) => districtOf(r) === f.district) : [];
  return { provinces: count(rows, provinceOf), districts: count(inProv, districtOf), subdistricts: count(inDist, subdistrictOf) };
}

/** ข้อ 1 ใบขอเข้ามา — ใบ + คน · ทุกชั้นรวมกันเท่าชั้นบน */
export type RequestFunnel = {
  total: number;
  requested: number;
  cancelled: { requests: number; people: number };
  closed: { requests: number; filled: number };
  active: {
    requests: number;
    remaining: number;
    notReleased: number;
    /** ยังไม่ประกาศแต่มีคนกรอกแล้ว (มาทางลิงก์อื่น/iRecruit · QA 30 ต.ค. 2569 "ต้องเห็น") — ใบ · คน */
    notReleasedWithApps: { requests: number; applications: number };
    releasedNoApps: number;
    releasedWithApps: number;
    applications: number;
  };
};

export function buildRequestFunnel(rows: readonly RecruitRequestRow[]): RequestFunnel {
  const out: RequestFunnel = {
    total: rows.length,
    requested: 0,
    cancelled: { requests: 0, people: 0 },
    closed: { requests: 0, filled: 0 },
    active: { requests: 0, remaining: 0, notReleased: 0, notReleasedWithApps: { requests: 0, applications: 0 }, releasedNoApps: 0, releasedWithApps: 0, applications: 0 },
  };
  for (const r of rows) {
    out.requested += r.requested;
    out.cancelled.people += r.cancelled;
    const s = onlineRequestStateOf(r);
    if (s === 'open') {
      const a = out.active;
      a.requests += 1;
      a.remaining += r.remaining;
      if (!r.released) {
        a.notReleased += 1;
        if (r.applications > 0) {
          a.notReleasedWithApps.requests += 1;
          a.notReleasedWithApps.applications += r.applications;
        }
      } else if (r.applications > 0) {
        a.releasedWithApps += 1;
        a.applications += r.applications;
      } else a.releasedNoApps += 1;
    } else if (s === 'cancelledAll') out.cancelled.requests += 1;
    else {
      // หาได้ของใบที่ปิดแล้วเท่านั้น — เดิมรวมคนที่หาได้ในใบที่ยังเปิด (ปน "หาได้แล้ว" กับ "ปิดครบ" · QA 30 ต.ค. 2569)
      out.closed.requests += 1;
      out.closed.filled += r.filled;
    }
  }
  return out;
}

/** กล่องในการ์ดใบขอเข้ามาที่กดดูรายการได้ (เจ้าของ 29 ต.ค. 2569 "มันต้องกดแล้วบอกสิ่ว่าใบไหนบ้าง") */
export type RequestFunnelKey = 'all' | 'cancelled' | 'closed' | 'active' | 'notReleased' | 'releasedNoApps' | 'releasedWithApps';
export const REQUEST_FUNNEL_LABEL: Record<RequestFunnelKey, string> = {
  all: 'ใบขอเข้ามา',
  cancelled: 'ยกเลิก',
  closed: 'ปิดแล้ว',
  active: 'ดำเนินการสรรหา',
  notReleased: 'ยังไม่ประกาศ',
  releasedNoApps: 'ประกาศแล้ว ไม่มีคนกรอก',
  releasedWithApps: 'ประกาศแล้ว มีคนกรอก',
};

/** ใบของกล่องนั้น — ตัวแบ่งเดียวกับ `buildRequestFunnel` (จำนวนใบในรายการ = เลขบนกล่อง) · ต้องหามากสุดขึ้นก่อน */
export function requestsOfFunnelKey(rows: readonly RecruitRequestRow[], key: RequestFunnelKey): RecruitRequestRow[] {
  const pick = rows.filter((r) => {
    const s = onlineRequestStateOf(r);
    if (key === 'all') return true;
    if (key === 'cancelled') return s === 'cancelledAll';
    if (key === 'closed') return s === 'fullyClosed' || s === 'partialCancelled';
    if (s !== 'open') return false;
    if (key === 'active') return true;
    if (key === 'notReleased') return !r.released;
    if (key === 'releasedNoApps') return r.released && r.applications === 0;
    return r.released && r.applications > 0;
  });
  return sortRequests(pick);
}

export const sortRequests = (rows: readonly RecruitRequestRow[]) =>
  [...rows].sort((a, b) => b.remaining - a.remaining || b.requested - a.requested || b.applications - a.applications || a.requestNo.localeCompare(b.requestNo));

/** ข้อ 3 พื้นที่ขาดคน — ขอมา (คน · ช่วงที่เลือก) คู่ ต้องหาตอนนี้ (คน · ใบที่ยังเปิด) */
export type AreaCount = { name: string; requests: number; requested: number; remaining: number };
export type ProvinceArea = AreaCount & { districts: AreaCount[]; lead: Record<RequestLeadKind | 'unknown', { requests: number; requested: number }> };
export const LEAD_ORDER: readonly RequestLeadKind[] = ['urgent', 'retroactive', 'advance'];

const addTo = (a: AreaCount, r: RecruitRequestRow) => {
  a.requests += 1;
  a.requested += r.requested;
  a.remaining += onlineRequestStateOf(r) === 'open' ? r.remaining : 0;
};
const byNeed = (a: AreaCount, b: AreaCount) => b.requested - a.requested || b.remaining - a.remaining || a.name.localeCompare(b.name, 'th');

export function buildProvinceAreas(rows: readonly RecruitRequestRow[]): ProvinceArea[] {
  const provs = new Map<string, ProvinceArea & { dmap: Map<string, AreaCount> }>();
  for (const r of rows) {
    const name = provinceOf(r);
    const p =
      provs.get(name) ??
      {
        name,
        requests: 0,
        requested: 0,
        remaining: 0,
        districts: [],
        dmap: new Map<string, AreaCount>(),
        lead: { urgent: { requests: 0, requested: 0 }, retroactive: { requests: 0, requested: 0 }, advance: { requests: 0, requested: 0 }, unknown: { requests: 0, requested: 0 } },
      };
    addTo(p, r);
    const dn = districtOf(r);
    const d = p.dmap.get(dn) ?? { name: dn, requests: 0, requested: 0, remaining: 0 };
    addTo(d, r);
    p.dmap.set(dn, d);
    const lk = p.lead[r.leadKind ?? 'unknown'];
    lk.requests += 1;
    lk.requested += r.requested;
    provs.set(name, p);
  }
  return [...provs.values()]
    .map(({ dmap, ...p }) => ({ ...p, districts: [...dmap.values()].sort(byNeed) }))
    .sort(byNeed);
}

// ── ข้อ 4 คนที่กรอกมา ────────────────────────────────────────────────────

export type ApplicantCallBucket = 'overAge' | 'badPhone' | 'irecruit' | 'notSent' | 'queued' | 'retry' | 'yes' | 'no' | 'unreached' | 'unclear' | 'staff';
export const APPLICANT_NOT_CALLED: readonly ApplicantCallBucket[] = ['overAge', 'badPhone', 'irecruit', 'notSent'];
/** AI โทรแล้ว (31 ต.ค. 2569 — คนโทรเองแยกออกมา · รอโทรซ้ำอยู่ใน AI โทรแล้ว) ⇒ ทุกการ์ดในหน้านับ "AI โทรแล้ว" เลขเดียวกัน */
export const APPLICANT_CALLED: readonly ApplicantCallBucket[] = ['yes', 'no', 'unreached', 'retry', 'unclear'];
export const APPLICANT_BUCKET_LABEL: Record<ApplicantCallBucket, string> = {
  overAge: 'อายุเกิน',
  badPhone: 'เบอร์ผิด',
  irecruit: 'ดึงจาก iRecruit',
  notSent: 'ยังไม่ส่ง AI',
  queued: 'รอโทร',
  retry: 'รอโทรซ้ำ',
  yes: 'สนใจ',
  no: 'ไม่สนใจ',
  unreached: 'ติดต่อไม่ได้',
  unclear: 'สรุปไม่ได้',
  staff: 'คนโทรเอง',
};

const UNREACHED = new Set(['no_pickup', 'picked_silent', 'wrong_person']);

/**
 * ช่องของคนหนึ่ง — AI โทรแล้วใช้คำตอบกับ AI · ไม่ติดแต่ยังมีสายในคิว = รอโทรซ้ำ
 * คนโทรอย่างเดียว (ไม่ผ่าน AI) ไม่มีคำตอบสนใจ/ไม่สนใจ ⇒ ช่อง "คนโทรเอง"
 */
export function applicantCallBucketOf(f: RecruitAppFact): ApplicantCallBucket {
  if (f.calledByAi) {
    const unreached = !f.aiAnswer || UNREACHED.has(f.aiAnswer);
    if (unreached && f.aiQueued) return 'retry';
    if (f.aiAnswer === 'said_yes') return 'yes';
    if (f.aiAnswer === 'said_no') return 'no';
    if (f.aiAnswer === 'not_yet' || f.aiAnswer === 'talked_unclear') return 'unclear';
    return 'unreached';
  }
  if (f.calledByStaff) return 'staff';
  const st = aiStage(f);
  if (st === 'queued') return 'queued';
  if (st === 'bad') return 'badPhone';
  if (st === 'overAge') return 'overAge';
  if (st === 'irecruit') return 'irecruit';
  return 'notSent';
}

export type ApplicantChannelRow = {
  key: string;
  name: string;
  total: number;
  notCalled: number;
  called: number;
  counts: Record<ApplicantCallBucket, number>;
  /** สนใจ ÷ AI โทรแล้วที่มีผล (ไม่นับรอโทรซ้ำ) · ไม่มี = null */
  yesPct: number | null;
  children?: ApplicantChannelRow[];
};

/** ชื่อกลุ่มช่องทางหลัก — ตัวเดียวกับตาราง "ไปถึงไหนแยกช่องทาง" (`channelFunnel.ts` · QA 30 ต.ค. 2569 เคยมี 2 ชื่อ) */
export { FUNNEL_GROUP_LABEL };

const emptyCounts = (): Record<ApplicantCallBucket, number> =>
  Object.fromEntries(Object.keys(APPLICANT_BUCKET_LABEL).map((k) => [k, 0])) as Record<ApplicantCallBucket, number>;

function rowOf(key: string, name: string, list: readonly RecruitAppFact[]): ApplicantChannelRow {
  const counts = emptyCounts();
  for (const f of list) counts[applicantCallBucketOf(f)] += 1;
  const notCalled = APPLICANT_NOT_CALLED.reduce((n, k) => n + counts[k], 0);
  const called = APPLICANT_CALLED.reduce((n, k) => n + counts[k], 0);
  const answered = called - counts.retry;
  return { key, name, total: list.length, notCalled, called, counts, yesPct: answered > 0 ? Math.round((counts.yes / answered) * 100) : null };
}

/** แถวรวม + ช่องทางหลัก (มากไปน้อย) › ช่องทางรอง — ทุกชั้นบวกกันเท่าแถวบน */
export function buildApplicantChannelRows(apps: readonly RecruitAppFact[]): { total: ApplicantChannelRow; groups: ApplicantChannelRow[] } {
  const groups = new Map<FunnelGroupKey, Map<string, RecruitAppFact[]>>();
  for (const f of apps) {
    const { group: g, channel: ch } = funnelPlaceOf(f);
    const chans = groups.get(g) ?? new Map<string, RecruitAppFact[]>();
    chans.set(ch, [...(chans.get(ch) ?? []), f]);
    groups.set(g, chans);
  }
  const byTotal = (a: ApplicantChannelRow, b: ApplicantChannelRow) => b.total - a.total || a.name.localeCompare(b.name, 'th');
  const out = [...groups.entries()].map(([g, chans]) => {
    const all = [...chans.values()].flat();
    const row = rowOf(g, FUNNEL_GROUP_LABEL[g], all);
    row.children = [...chans.entries()]
      .map(([ch, list]) => {
        const child = rowOf(`${g}:${ch}`, ch, list);
        // ชั้นที่ 3 = ชื่อกลุ่ม/เพจ (เจ้าของ 29 ต.ค. 2569 "กด facebook group ก้ไม่มีกลุ่มให้ดูหรอว่ากลุ่มไหนที่เข้ามาเยอะ")
        // มีแค่ "ไม่ระบุชื่อ" แถวเดียว = ไม่มีอะไรให้กดลง (กติกาเดียวกับ `buildChannelFunnelTree`)
        const subs = new Map<string, RecruitAppFact[]>();
        for (const f of list) {
          const sub = funnelSubOf(f);
          subs.set(sub, [...(subs.get(sub) ?? []), f]);
        }
        const useful = subs.size > 1 || (subs.size === 1 && !subs.has(NO_SUB));
        if (useful) child.children = [...subs.entries()].map(([name, l]) => rowOf(`${g}:${ch}:${name}`, name, l)).sort(byTotal);
        return child;
      })
      .sort(byTotal);
    return row;
  });
  return { total: rowOf('total', 'รวมทุกช่องทาง', apps), groups: out.sort((a, b) => b.total - a.total) };
}

/**
 * ใบสมัครของแถวช่องทางที่กด (คีย์ของ `buildApplicantChannelRows`: กลุ่ม · กลุ่ม:ช่องทาง · กลุ่ม:ช่องทาง:ชื่อกลุ่ม)
 * การ์ดตำแหน่งที่สมัคร/เหตุผลที่ไม่สำเร็จเปลี่ยนตามช่องทางที่กด (เจ้าของ 29 ต.ค. 2569 Choice) · null/total = ทุกใบ
 */
export function appsOfChannelKey(apps: readonly RecruitAppFact[], key: string | null): RecruitAppFact[] {
  if (!key || key === 'total') return [...apps];
  return apps.filter((f) => {
    const { group: g, channel: ch } = funnelPlaceOf(f);
    return key === g || key === `${g}:${ch}` || key === `${g}:${ch}:${funnelSubOf(f)}`;
  });
}

/** ช่องทางรองที่ได้คนสนใจเยอะ — เรียง % สนใจ (ต้องโทรแล้วอย่างน้อย `minCalled` คน ไม่ให้ 1/1 ขึ้นบนสุด) */
export function applicantSuccessRanking(groups: readonly ApplicantChannelRow[], minCalled = 10): ApplicantChannelRow[] {
  return groups
    .flatMap((g) => g.children ?? [])
    .filter((c) => c.yesPct !== null && c.called - c.counts.staff >= minCalled)
    .sort((a, b) => (b.yesPct ?? 0) - (a.yesPct ?? 0) || b.counts.yes - a.counts.yes);
}

/** ใบสมัครของใบขอที่กรองอยู่ — ไม่กรอง = ทุกใบสมัครของช่วง (รวมที่ไม่ผูกใบขอ) */
export function appsOfRequests(apps: readonly RecruitAppFact[], rows: readonly RecruitRequestRow[] | null): RecruitAppFact[] {
  if (!rows) return [...apps];
  const ids = new Set(rows.map((r) => r.jobId).filter((v): v is string => Boolean(v)));
  return apps.filter((f) => f.jobId && ids.has(f.jobId));
}
