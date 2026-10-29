/**
 * แท็บใบขอ ภาพรวมงานสรรหา (เจ้าของ 29 ต.ค. 2569 แบบร่าง + โน้ต "กดจังหวัดแสดงอำเภอ · ฉุกเฉิน/ย้อนหลัง/ล่วงหน้า · กี่ใบกี่คน")
 * ตัวคิด `src/lib/recruitRequestTab.ts` · ทุกชั้นต้องบวกกันเท่าชั้นบน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_REQUEST_FILTER,
  NO_DISTRICT,
  applicantCallBucketOf,
  applicantSuccessRanking,
  appsOfChannelKey,
  appsOfRequests,
  buildApplicantChannelRows,
  buildProvinceAreas,
  buildRequestFunnel,
  filterRequestRows,
  requestAreaOptions,
  requestSectorOf,
  requestSiteOptions,
  requestsOfFunnelKey,
  type RecruitRequestRow,
} from '../../src/lib/recruitRequestTab';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes';

const req = (over: Partial<RecruitRequestRow>): RecruitRequestRow => ({
  requestNo: 'OPL6910104',
  jobId: 'siamraj-sql:OPL6910104',
  unitName: 'บริษัท เชฟรอนประเทศไทยสำรวจและผลิต จำกัด',
  siteCode: '67LBDL0051',
  siteName: 'เชฟรอน - พขร.',
  sector: 'private',
  province: 'กรุงเทพมหานคร',
  district: 'เขตปทุมวัน',
  subdistrict: 'แขวงลุมพินี',
  leadKind: 'advance',
  requested: 1,
  filled: 0,
  cancelled: 0,
  remaining: 1,
  released: false,
  applications: 0,
  ...over,
});

const ROWS: RecruitRequestRow[] = [
  req({}),
  req({ requestNo: 'OPL6910105', jobId: 'siamraj-sql:OPL6910105', released: true, applications: 7, requested: 2, remaining: 2, leadKind: 'urgent' }),
  req({ requestNo: 'OPL6910106', jobId: 'siamraj-sql:OPL6910106', released: true, applications: 0, leadKind: 'retroactive' }),
  req({ requestNo: 'OPL6910107', jobId: 'siamraj-sql:OPL6910107', remaining: 0, filled: 1 }),
  req({ requestNo: 'OPL6910108', jobId: 'siamraj-sql:OPL6910108', remaining: 0, cancelled: 1 }),
  req({
    requestNo: 'LBM6910021',
    jobId: 'siamraj-sql:LBM6910021',
    unitName: 'ธนาคารกรุงศรีอยุธยา จำกัด (มหาชน)',
    siteName: 'กรุงศรี Pool ขอนแก่น',
    sector: 'bank',
    province: 'ขอนแก่น',
    district: null,
    subdistrict: null,
    leadKind: 'urgent',
    requested: 3,
    remaining: 3,
  }),
  req({
    requestNo: 'OPL6910092',
    jobId: 'siamraj-sql:OPL6910092',
    unitName: 'FORD SERVICES - พขร. (ปตน.)',
    siteName: 'FORD SERVICES',
    province: 'ระยอง',
    district: 'ปลวกแดง',
    subdistrict: null,
    requested: 14,
    filled: 4,
    remaining: 10,
  }),
];

describe('ข้อ 1 ใบขอเข้ามา', () => {
  it('ยกเลิก + ปิดแล้ว + ดำเนินการ = ใบขอเข้ามา · ดำเนินการ = ยังไม่ประกาศ + ไม่มีคนกรอก + มีคนกรอก', () => {
    const f = buildRequestFunnel(ROWS);
    expect(f.total).toBe(7);
    expect(f.cancelled.requests + f.closed.requests + f.active.requests).toBe(f.total);
    expect([f.cancelled.requests, f.closed.requests, f.active.requests]).toEqual([1, 1, 5]);
    expect(f.active.notReleased + f.active.releasedNoApps + f.active.releasedWithApps).toBe(f.active.requests);
    expect([f.active.releasedWithApps, f.active.applications, f.active.releasedNoApps]).toEqual([1, 7, 1]);
    expect(f.requested).toBe(f.closed.filled + f.cancelled.people + f.active.remaining);
  });
});

describe('กดกล่องแล้วเห็นใบ (เจ้าของ 29 ต.ค. 2569 "มันต้องกดแล้วบอกสิ่ว่าใบไหนบ้าง")', () => {
  it('จำนวนใบในรายการ = เลขบนกล่องทุกกล่อง · ต้องหามากสุดขึ้นก่อน', () => {
    const f = buildRequestFunnel(ROWS);
    const n = (k: Parameters<typeof requestsOfFunnelKey>[1]) => requestsOfFunnelKey(ROWS, k).length;
    expect([n('all'), n('cancelled'), n('closed'), n('active')]).toEqual([f.total, f.cancelled.requests, f.closed.requests, f.active.requests]);
    expect([n('notReleased'), n('releasedNoApps'), n('releasedWithApps')]).toEqual([f.active.notReleased, f.active.releasedNoApps, f.active.releasedWithApps]);
    expect(requestsOfFunnelKey(ROWS, 'active')[0].requestNo).toBe('OPL6910092');
  });
  it('จอ: กล่องเป็นปุ่ม · อำเภอกดได้ · รายการใบขอ', () => {
    const ui = readFileSync('src/components/dashboard-trends/RequestTab.tsx', 'utf8');
    expect(ui).toContain('onPick={() => togglePick(\'cancelled\')}');
    expect(ui).toContain('data-testid="request-tab-district-row"');
    // ความเร่งในจังหวัดก็กดดูใบได้ (เจ้าของ "ตรงนี้ก้กดแล้วโชว์ใบขอด้วย")
    expect(ui).toContain('onClick={() => toggleDetail(\'lead\', k)}');
    expect(ui).toContain('data-testid="request-tab-list"');
  });
});

describe('ข้อ 3 พื้นที่ขาดคน', () => {
  it('จังหวัดเรียงคนที่ขอมากสุด · กดแล้วมีอำเภอ (ไม่รู้ = ไม่ระบุอำเภอ) · แยกฉุกเฉิน/ย้อนหลัง/ล่วงหน้า เป็นใบและคน', () => {
    const areas = buildProvinceAreas(ROWS);
    expect(areas.map((a) => a.name)).toEqual(['ระยอง', 'กรุงเทพมหานคร', 'ขอนแก่น']);
    const bkk = areas[1];
    expect([bkk.requests, bkk.requested, bkk.remaining]).toEqual([5, 6, 4]);
    expect(bkk.lead.urgent).toEqual({ requests: 1, requested: 2 });
    expect(bkk.lead.retroactive.requests + bkk.lead.urgent.requests + bkk.lead.advance.requests).toBe(bkk.requests);
    expect(areas[2].districts.map((d) => d.name)).toEqual([NO_DISTRICT]);
    expect(areas[0].districts[0]).toEqual({ name: 'ปลวกแดง', requests: 1, requested: 14, remaining: 10 });
  });
  it('ตัวกรอง: ประเภทงานธนาคาร · Code Site · อำเภอเฉพาะจังหวัดที่เลือก', () => {
    expect(filterRequestRows(ROWS, { ...EMPTY_REQUEST_FILTER, sector: 'bank' })).toHaveLength(1);
    expect(filterRequestRows(ROWS, { ...EMPTY_REQUEST_FILTER, siteCode: '67LBDL0051' })).toHaveLength(7);
    expect(filterRequestRows(ROWS, { ...EMPTY_REQUEST_FILTER, siteCode: '67LBDL' })).toHaveLength(0);
    const opt = requestAreaOptions(ROWS, { province: 'กรุงเทพมหานคร', district: null });
    expect(opt.provinces[0]).toEqual({ value: 'กรุงเทพมหานคร', n: 5 });
    expect(opt.districts).toEqual([{ value: 'เขตปทุมวัน', n: 5 }]);
    expect(opt.subdistricts).toEqual([]);
  });
  it('ประเภทงาน: ธนาคารจากอุตสาหกรรม ERP › กลุ่มลูกค้า ERP › ที่ทีมระบุ › ยังไม่ระบุ', () => {
    expect(requestSectorOf('ธนาคาร', 'เอกชน', 'private')).toBe('bank');
    expect(requestSectorOf('การแพทย์', 'รัฐวิสาหกิจ', null)).toBe('government');
    expect(requestSectorOf(null, null, 'government')).toBe('government');
    expect(requestSectorOf('ยานยนต์', null, null)).toBeNull();
  });
});

const fact = (over: Partial<RecruitAppFact>): RecruitAppFact =>
  ({
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-10-05T03:00:00Z',
    jobId: 'siamraj-sql:OPL6910105',
    channelLabel: 'Facebook Group · หางานขับรถ กทม.',
    referralSource: null,
    position: 'พนักงานขับรถ',
    phoneOk: true,
    calledByAi: false,
    calledByStaff: false,
    firstCalledAt: null,
    aiAnswer: null,
    aiAnswerAt: null,
    ...over,
  }) as RecruitAppFact;

describe('ข้อ 4 คนที่กรอกมา แยกช่องทาง', () => {
  it('ช่องของคน: ไม่ติดแต่ยังมีคิว = รอโทรซ้ำ · คนโทรอย่างเดียว = คนโทรเอง · อายุเกิน/เบอร์ผิด = AI ไม่โทร', () => {
    expect(applicantCallBucketOf(fact({ calledByAi: true, aiAnswer: 'no_pickup', aiQueued: true }))).toBe('retry');
    expect(applicantCallBucketOf(fact({ calledByAi: true, aiAnswer: 'no_pickup' }))).toBe('unreached');
    expect(applicantCallBucketOf(fact({ calledByAi: true, aiAnswer: 'talked_unclear' }))).toBe('unclear');
    expect(applicantCallBucketOf(fact({ calledByStaff: true }))).toBe('staff');
    expect(applicantCallBucketOf(fact({ overAge: true }))).toBe('overAge');
    expect(applicantCallBucketOf(fact({ phoneOk: false }))).toBe('badPhone');
    expect(applicantCallBucketOf(fact({ aiQueued: true }))).toBe('queued');
  });
  it('ทุกแถว: ไม่โทร + รอโทร + รอโทรซ้ำ + โทรแล้ว = ทั้งหมด · ช่องทางหลักรวม = แถวรวม · รองรวม = หลัก', () => {
    const apps = [
      fact({ id: 'a1', calledByAi: true, aiAnswer: 'said_yes' }),
      fact({ id: 'a2', calledByAi: true, aiAnswer: 'said_no' }),
      fact({ id: 'a3', channelLabel: 'TikTok · @sorecruit', calledByAi: true, aiAnswer: 'no_pickup', aiQueued: true }),
      fact({ id: 'a4', channelLabel: 'TikTok · @sorecruit', aiQueued: true }),
      fact({ id: 'a5', channelLabel: 'Facebook Page · So Recruit', overAge: true }),
    ];
    const { total, groups } = buildApplicantChannelRows(apps);
    for (const r of [total, ...groups, ...groups.flatMap((g) => g.children ?? [])]) {
      expect(r.notCalled + r.counts.queued + r.counts.retry + r.called).toBe(r.total);
    }
    expect(groups.reduce((n, g) => n + g.total, 0)).toBe(total.total);
    for (const g of groups) expect((g.children ?? []).reduce((n, c) => n + c.total, 0)).toBe(g.total);
    expect(total.yesPct).toBe(50);
    // TikTok มีแต่รอโทรซ้ำ (ยังไม่นับว่าโทรแล้ว) ⇒ ไม่ขึ้นอันดับ
    expect(applicantSuccessRanking(groups, 1).map((r) => [r.name, r.yesPct])).toEqual([['Facebook กลุ่ม', 50]]);
  });
  it('กรองใบขอแล้ว ใบสมัครเหลือเฉพาะของใบที่เลือก · ไม่กรอง = ทุกใบสมัครของช่วง', () => {
    const apps = [fact({ id: 'a1' }), fact({ id: 'a2', jobId: 'siamraj-sql:OPL6910092' }), fact({ id: 'a3', jobId: null })];
    expect(appsOfRequests(apps, null)).toHaveLength(3);
    expect(appsOfRequests(apps, [ROWS[6]]).map((f) => f.id)).toEqual(['a2']);
  });
});

describe('หน้าจอ', () => {
  it('แท็บใบขอใช้ RequestTab · ตัวกรอง 5 ช่อง · ไม่มีปุ่มกรุงศรี SCB Ford (เจ้าของ "เอาออกได้") · ไม่มีบรรทัดบวกใต้ข้อ 1 (เจ้าของลบในร่าง)', () => {
    const ui = readFileSync('src/components/dashboard-trends/RequestTab.tsx', 'utf8');
    expect(ui).toContain('data-testid="request-tab-sector"');
    for (const id of ['request-tab-province', 'request-tab-district', 'request-tab-subdistrict']) expect(ui).toContain(`testId="${id}"`);
    // 29 ต.ค. 2569 "ชื่อหน่วยงานไม่เอาและ เอา Codesite แต่ดึงจาก erp ที่มีใบขอ"
    expect(ui).not.toContain('ชื่อหน่วยงาน');
    expect(ui).not.toContain('request-tab-brand');
    expect(ui).not.toContain('ทุกหน่วยงาน');
    expect(ui).toContain('ariaLabel="Code Site"');
    expect(requestSiteOptions(ROWS)).toEqual([{ value: '67LBDL0051', name: 'เชฟรอน - พขร.', unit: 'บริษัท เชฟรอนประเทศไทยสำรวจและผลิต จำกัด', n: 7 }]);
    expect(ui).not.toContain('= ${fmt(funnel.total)}');
    expect(readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8')).toContain('rows={data.requestRows ?? null}');
  });
});

describe('ช่องทาง Facebook · ชื่อกลุ่ม · กดช่องทางแล้วการ์ดเปลี่ยนตาม (เจ้าของ 29 ต.ค. 2569)', () => {
  const apps = [
    fact({ id: 'g1', channelLabel: 'Facebook Group · กลุ่มหางานจังหวัด' }),
    fact({ id: 'g2', channelLabel: 'Facebook Group · กลุ่มหางานจังหวัด' }),
    fact({ id: 'g3', channelLabel: 'Facebook · Facebook Group' }),
    fact({ id: 'p1', channelLabel: 'Facebook Page' }),
    fact({ id: 'u1', channelLabel: null, referralSource: 'facebook' }),
    fact({ id: 't1', channelLabel: 'TikTok · @sorecruit' }),
  ];
  const { groups } = buildApplicantChannelRows(apps);
  const fb = groups.find((g) => g.key === 'facebook')!;
  it('ใต้ Facebook มีแค่ กลุ่ม · เพจ · Ads · ไม่ระบุ — ไม่มีแถว "Facebook" เปล่า', () => {
    expect(Object.fromEntries(fb.children!.map((c) => [c.name, c.total]))).toEqual({ 'Facebook กลุ่ม': 3, 'Facebook เพจ': 1, 'Facebook ไม่ระบุ': 1 });
  });
  it('Facebook กลุ่ม กดลงไปเห็นชื่อกลุ่ม · ป้าย "Facebook · Facebook Group" = ไม่ระบุชื่อ (ไม่ใช่ชื่อกลุ่ม "Facebook Group")', () => {
    const group = fb.children!.find((c) => c.name === 'Facebook กลุ่ม')!;
    expect(group.children!.map((c) => [c.name, c.total])).toEqual([
      ['กลุ่มหางานจังหวัด', 2],
      ['ไม่ระบุชื่อ', 1],
    ]);
    // ไม่มีชื่อให้แตก = ไม่มีชั้นที่ 3
    expect(fb.children!.find((c) => c.name === 'Facebook เพจ')!.children).toBeUndefined();
  });
  it('กดแถวไหน ได้ใบสมัครเท่าเลขทั้งหมดของแถวนั้น · ไม่กด = ทุกใบ', () => {
    const keys = [fb, ...fb.children!, ...fb.children!.flatMap((c) => c.children ?? [])];
    for (const r of keys) expect(appsOfChannelKey(apps, r.key)).toHaveLength(r.total);
    expect(appsOfChannelKey(apps, null)).toHaveLength(apps.length);
    expect(appsOfChannelKey(apps, 'total')).toHaveLength(apps.length);
  });
  it('จอ: การ์ดตำแหน่ง/เหตุผลอยู่ใน scoped ของ RequestTab · ไม่มีแถบสีใต้ดำเนินการสรรหา', () => {
    const page = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
    expect(page).toContain('<PositionList rows={positionRows(scopedApps)} />');
    expect(page).toContain('<ReasonColumns groups={reasonGroups(scopedApps)} />');
    const ui = readFileSync('src/components/dashboard-trends/RequestTab.tsx', 'utf8');
    expect(ui).toContain('{scoped ? scoped(channelApps, channel?.name ?? null) : null}');
    expect(ui).not.toContain('funnel.active.releasedNoApps, \'neutral\'');
  });
});
