/**
 * หน้าทีม Online — render จริงทั้งหน้า (ตัดเน็ต) · 29 ก.ย. 2569 (รอบ 2 ปฏิทิน + เทียบ BU)
 * 🔴 ด่าน: แถบเวลาเดียวกับ Dashboard ส่งช่วงถึงเส้น API · การ์ดพูดหน่วยถูก (คน · อัตรา · สาย · ฐาน Success rate) ·
 *    ช่วงก่อนที่ยังไม่มีข้อมูลห้ามขึ้น "เพิ่ม" · แถบจับตาบอก BU ที่ยังไม่ใช้ · คนใช้งานแยกบทบาท ·
 *    เจ้าหน้าที่เห็นงานที่ต้องทำก่อน · ผู้ใช้ถูกล็อกแผนกไม่มีตัวเลือก BU และเส้นอื่นได้ BU บังคับ
 * รอบ 4: การ์ดกดได้ทั้งใบ → แผงด้านขวา · รายชื่อขึ้นเฉพาะตอนเซิร์ฟเวอร์ส่งมา · งานที่ต้องทำนับจากเลนกล่องงาน/ถังรายชื่อ
 *    (ยอดทั้งสิทธิ์ ไม่ใช่ตามตัวกรอง BU) · เจ้าหน้าที่: ส่วนวิเคราะห์พับไว้
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  applicantBacklog,
  applicantsSummary,
  buildBuRows,
  funnelRows,
  laneRows,
  lumosSummary,
  oldestNoApplicantJobs,
  peopleOf,
  postingsSummary,
  requestsSummary,
  teamWindow,
  usersSummary,
  type RawApplicant,
  type RawBoardJob,
  type TeamOnlineResponse,
} from '@/lib/teamOnline';
import { bangkokYmd } from '@/lib/trends/timeBuckets';

let role: 'admin' | 'staff' = 'admin';
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role, full_name: 'ทดสอบ', username: 'test' }, hasPermission: () => role === 'admin' }),
}));

const TODAY = bangkokYmd(new Date()) as string;
const W = teamWindow({}, TODAY);
const day = (i: number) => W.buckets[i].from;
const prevDay = (i: number) => W.prevBuckets[i].from;
const label = (bu: string) => `${bu} · ป้าย`;
const full = { since: '2020-01-01', cur: 'full', prev: 'full' } as const;

const accounts = [
  { id: 'a', bu: 'LBD', role: 'staff', active: true, createdYmd: '2020-01-01' },
  { id: 'b', bu: 'LBD', role: 'staff', active: true, createdYmd: '2020-01-01' },
  { id: 'c', bu: 'LBD', role: 'supervisor', active: true, createdYmd: '2020-01-01' },
  { id: 'd', bu: 'LM', role: 'staff', active: true, createdYmd: '2020-01-01' },
];
const activity = [
  { uid: 'a', ymd: day(3) },
  { uid: 'c', ymd: day(5) },
  { uid: 'a', ymd: prevDay(2) },
  { uid: 'b', ymd: prevDay(3) },
  { uid: 'c', ymd: prevDay(4) },
  { uid: 'd', ymd: prevDay(5) },
];
const users = usersSummary(W, accounts, activity, label, ['SN']);

/** ผู้สมัคร: ช่วงนี้ 3 ใบ (Facebook 2 · ไม่ระบุ 1) · งานค้างทั้งสิทธิ์มีใบเก่าเพิ่มอีกใบ (ติดต่อได้ ยังไม่ได้นัด) */
const NOW = Date.now();
const app = (id: string, ymd: string, over: Partial<RawApplicant>): RawApplicant => ({
  id,
  ymd,
  createdAt: `${ymd}T10:00:00+07:00`,
  lead: false,
  source: 'facebook',
  bu: 'LBD',
  jobId: 'J1',
  called: false,
  inQueue: false,
  held: false,
  latestClass: null,
  hasAppointment: false,
  waitHours: null,
  ...over,
});
const apps = [
  app('A1', day(2), { called: true, latestClass: 'success', waitHours: 2 }),
  app('A2', day(3), { source: null }),
  app('A3', day(3), { called: true, latestClass: 'success', hasAppointment: true, waitHours: 4 }),
];
const oldApp = app('OLD', '2025-01-05', { bu: 'LM', called: true, latestClass: 'success' });
const appsSum = applicantsSummary(W, apps, label, [], NOW);

/** ใบเปิดในมุมกล่องงาน: ปล่อยแล้วเงียบ 1 · ยังไม่ปล่อย 2 (ในนั้นเหลือกดส่งประกาศ 1) */
const boardJobs: RawBoardJob[] = [
  { id: 'siamraj-sql:R1', externalId: 'R1', requestNo: 'R1', unit: 'คลังสินค้า', bu: 'LBD', positions: 5, ageDays: 40, released: true, sourcing: true, applicants: 0, step: null },
  { id: 'siamraj-sql:R4', externalId: 'R4', requestNo: 'R4', unit: 'ขนส่ง', bu: 'LM', positions: 2, ageDays: 120, released: false, sourcing: true, applicants: 0, step: 'publish' },
  { id: 'siamraj-pre:P1', externalId: 'P1', requestNo: 'P1', unit: 'สาขา', bu: null, positions: 3, ageDays: 2, released: false, sourcing: true, applicants: 0, step: 'info' },
];
const allLanes = laneRows(boardJobs.map((j) => ({ ...j, bu: 'ALL' })), () => 'ทั้งหมด')[0];
const reqs = requestsSummary(
  W,
  [
    { requestNo: 'R1', ymd: day(1), bu: 'LBD', positions: 5 },
    { requestNo: 'R2', ymd: day(2), bu: 'LM', positions: 2 },
    { requestNo: 'R3', ymd: prevDay(1), bu: 'LBD', positions: 6 },
  ],
  label,
);
const lumos = lumosSummary(
  W,
  [
    { ymd: day(4), bu: 'LBD', lane: 'public', cancelled: false, outcome: 'confirmed', summary: null, reply: null, personRef: 'app-1' },
    { ymd: day(4), bu: 'LBD', lane: 'follow', cancelled: false, outcome: 'declined', summary: null, reply: null, personRef: 'follow-1' },
    { ymd: day(4), bu: 'LBD', lane: 'public', cancelled: false, outcome: null, summary: null, reply: null, personRef: 'app-2' },
  ],
  label,
);
const postingRows = [
  { jobId: 'J1', ymd: day(2), bu: 'LBD', applicants: 2 },
  { jobId: 'J2', ymd: day(3), bu: 'LBD', applicants: 0 },
];

const DATA: TeamOnlineResponse = {
  generated_at: new Date().toISOString(),
  scope: 'all',
  forced_bu: null,
  bu: null,
  window: W,
  bu_options: [
    { bu: 'LBD', label: 'LBD · ป้าย' },
    { bu: 'LM', label: 'LM · ป้าย' },
  ],
  users: { total: users.total, accounts: users.accounts, coverage: full, byBu: users.byBu },
  requests: { positions: reqs.positions, requests: reqs.requests, coverage: full, stale: true, ageSeconds: 3000, byBu: reqs.byBu },
  lumos: {
    total: lumos.total,
    prev: lumos.prev,
    called: lumos.called,
    lanes: lumos.lanes,
    coverage: { since: day(0), cur: 'full', prev: 'none' },
    byBu: lumos.byBu,
  },
  postings: { ...postingsSummary(W, postingRows), coverage: full },
  funnel: funnelRows(
    [
      { requestNo: 'R1', bu: 'LBD', genLink: true, applicants: true, aiCalled: true, interested: true, appointed: true, showed: false },
      { requestNo: 'R2', bu: 'LM', genLink: false, applicants: false, aiCalled: false, interested: false, appointed: false, showed: false },
    ],
    label,
    [],
    new Set(['showed'] as const),
  ),
  applicants: {
    total: appsSum.total,
    leads: appsSum.leads,
    stages: appsSum.stages,
    over5d: appsSum.over5d,
    waitMedianHours: appsSum.waitMedianHours,
    sources: appsSum.sources,
    coverage: full,
    byBu: appsSum.byBu,
    backlog: applicantBacklog(apps, NOW),
    backlogScope: applicantBacklog([...apps, oldApp], NOW),
  },
  lanes: { total: allLanes, scope: allLanes, byBu: laneRows(boardJobs, label), oldest: oldestNoApplicantJobs(boardJobs) },
  people: peopleOf(
    W,
    accounts.map((a) => ({ ...a, name: `ชื่อ ${a.id}` })),
    activity,
  ),
  byBu: buildBuRows(W, {
    labelOf: label,
    postings: postingRows,
    openJobs: [
      { id: 'siamraj-sql:R1', bu: 'LBD', positions: 5 },
      { id: 'siamraj-sql:R4', bu: 'LM', positions: 2 },
      { id: 'siamraj-pre:P1', bu: null, positions: 3 },
    ],
  }),
  errors: {},
};

const fetchTeamOnline = vi.fn(async (_q: unknown) => DATA);
const fetchFlowSummary = vi.fn(async (_bu?: string | null) => ({
  lumos: { waiting_call: 1, delivered_waiting: 2, stale_delivered: 0 },
  active_calls: [],
  call_boxes: { confirmed: [], retry: [], needs_human: [], declined: [] },
  call_box_counts: { confirmed: 0, retry: 0, needs_human: 0, declined: 0 },
}));
const fetchOfficeFloor = vi.fn(async (_bu?: string | null) => ({
  generated_at: new Date().toISOString(),
  counts: { follow: { pastDue: 0 }, intake: { untouched: 3, claimedIdle: 0 } },
}));
vi.mock('@/lib/teamOnlineApi', () => ({ fetchTeamOnline: (q: unknown) => fetchTeamOnline(q) }));
vi.mock('@/lib/officeFloorApi', () => ({ fetchOfficeFloor: (bu?: string | null) => fetchOfficeFloor(bu) }));
vi.mock('@/lib/flowSummaryApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/flowSummaryApi')>()),
  fetchFlowSummary: (bu?: string | null) => fetchFlowSummary(bu),
}));

const { default: TeamOnlinePage } = await import('./TeamOnlinePage');

const renderAt = (url = '/?home=online') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <TeamOnlinePage />
    </MemoryRouter>,
  );

beforeAll(() => {
  // recharts ResponsiveContainer ต้องมี ResizeObserver — jsdom ไม่มี
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});
beforeEach(() => {
  role = 'admin';
  fetchTeamOnline.mockClear().mockResolvedValue(DATA);
  fetchFlowSummary.mockClear();
  fetchOfficeFloor.mockClear();
});
afterEach(() => cleanup());

const text = () => document.body.textContent ?? '';

describe('หน้าทีม Online', () => {
  it('🔴 แถบเวลาเดียวกับ Dashboard — ค่าตั้งต้น 30 วัน รายวัน เทียบช่วงก่อน ส่งถึงเส้น API', async () => {
    renderAt();
    await waitFor(() => expect(fetchTeamOnline).toHaveBeenCalled());
    expect(fetchTeamOnline.mock.calls[0][0]).toMatchObject({ from: W.range.from, to: W.range.to, grain: 'day', compare: 'previous' });
    expect(screen.getByRole('group', { name: 'ดูเป็น' })).toBeTruthy();
  });

  it('การ์ดแบบภาพอ้างอิง: เทียบช่วงก่อน + ป้าย % มุมขวา · หน่วยถูก (คน · อัตรา · สาย · ฐาน Success rate)', async () => {
    renderAt();
    await waitFor(() => expect(text()).toContain('50.0% ของ 4 บัญชี · ช่วงก่อน 4 คน'));
    expect(screen.getAllByText('เทียบช่วงก่อน').length).toBeGreaterThan(0);
    expect(screen.getAllByText('50.0%').length).toBeGreaterThan(0);
    expect(text()).toContain('อัตราที่ขอเข้า');
    expect(text()).toContain('2 ใบ · ช่วงก่อน 6 อัตรา');
    expect(text()).toContain('ส่งไป 3 · รอโทร 1');
    expect(text()).toContain('1 / 2 สายที่ได้คุยจริง');
    expect(text()).toContain('1 / 2 ใบที่ Gen link');
    // สำเนา ERP เก่า = บอกอายุตรง ๆ
    expect(text()).toContain('ข้อมูลใบขอจาก ERP เมื่อ 50 นาทีก่อน');
  });

  it('🔴 ช่วงก่อนที่ระบบยังไม่มีข้อมูล (Lumos) = บอกตรง ๆ ห้ามขึ้น "เพิ่ม 2 สาย (ช่วงก่อนไม่มี)" · ช่วงก่อนที่มีข้อมูลแต่เป็น 0 จริงพูดได้', async () => {
    renderAt();
    await waitFor(() => expect(text()).toContain('ช่วงก่อนยังไม่มีข้อมูล'));
    expect(text()).not.toContain('เพิ่ม 2 สาย');
    // Gen link: ข้อมูลครบสองช่วง ช่วงก่อนไม่มีใบจริง ⇒ พูดได้
    expect(text()).toContain('Gen link ใหม่เพิ่ม 2 ใบ (ช่วงก่อนไม่มี)');
  });

  it('แถบจับตาบอก BU ที่ยังไม่ใช้ระบบ · ปุ่มตรวจคิวโทรใช้ยอดเดียวกับป๊อป · งานที่ต้องทำต่อรวมงานของทีม Online', async () => {
    renderAt();
    await waitFor(() => expect(text()).toContain('LM ยังไม่มีคนใช้ (0 จาก 1 บัญชี)'));
    expect(text()).toContain('SN ยังไม่มีบัญชีในระบบ');
    await waitFor(() => expect(text()).toContain('ตรวจคิวโทร 3 สาย'));
    await waitFor(() => expect(text()).toContain('ผู้สมัครที่ยังไม่มีใครแตะ 3 คน'));
    expect(text()).toContain('งานที่ต้องทำต่อ');
    // งานค้างของผู้สมัคร/ใบเงียบบนแถบจับตา (ตามตัวกรอง BU ของหน้า)
    expect(text()).toContain('ติดต่อได้แล้ว ยังไม่ได้นัด 1 ใบ');
    expect(text()).toContain('ใบยังไม่มีผู้สมัครเกิน 30 วัน 2 ใบ');
  });

  it('🔴 งานที่ต้องทำต่อนับจากเลนกล่องงาน/ถังรายชื่อ (ยอดทั้งสิทธิ์) · กดแล้วไปชุดเดียวกัน', async () => {
    renderAt();
    await waitFor(() => expect(text()).toContain('นัดผู้สมัครที่ติดต่อได้แล้ว 2 ใบ'));
    expect(text()).toContain('ส่งประกาศที่มีลิงก์แล้ว 1 ใบ');
    expect(text()).toContain('ดันประกาศที่ปล่อยแล้วยังไม่มีคนสมัคร 1 ใบ');
    expect(text()).toContain('ปล่อยประกาศใบที่ยังต้องหาคน 2 ใบ');
    const hrefs = Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/jobs/board?view=list&bucket=success_unscheduled');
    expect(hrefs).toContain('/jobs/board?lane=unreleased&step=publish');
    expect(hrefs).toContain('/jobs/board?lane=silent');
    expect(hrefs).toContain('/jobs/board?lane=sourcing');
    // งานเดิมที่นับเองจากตารางประกาศ (กดไปเจอเลขไม่เท่า) ต้องไม่กลับมา
    expect(text()).not.toContain('ยังไม่ Gen link');
  });

  it('การ์ดกดได้ทั้งใบ → แผงด้านขวา: ผู้สมัครใหม่ = มาจากไหน · มาแล้วยังไง · ใบยังไม่มีผู้สมัคร', async () => {
    renderAt();
    await waitFor(() => expect(text()).toContain('ติดต่อได้ 2 · นัดแล้ว 1'));
    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียด ผู้สมัครใหม่/ }));
    const sheet = await screen.findByRole('dialog');
    expect(sheet.textContent).toContain('ผู้สมัครใหม่');
    expect(sheet.textContent).toContain('มาจากไหน');
    expect(sheet.textContent).toContain('Facebook');
    expect(sheet.textContent).toContain('ไม่ระบุ');
    expect(sheet.textContent).toContain('นัดแล้ว');
    expect(sheet.textContent).toContain('ใบยังไม่มีผู้สมัคร');
    expect(sheet.textContent).toContain('ค้างนานสุด');
    const hrefs = Array.from(sheet.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    // ลิงก์ใบผ่าน boardPostingPath ตัวเดียวกับกล่องงาน: ใบปกติใช้เลขฝั่ง ERP · ใบล่วงหน้าพก prefix
    expect(hrefs).toContain('/jobs/board/R4/posting');
    expect(hrefs).toContain('/jobs/board/siamraj-pre%3AP1/posting');
    // ดูทุก BU = ประชากรเดียวกับหน้ารายชื่อ ⇒ กดชื่อถังไปหน้ารายชื่อได้ · ถังที่เป็น 0 ไม่มีลิงก์ (กดไปก็ว่าง)
    expect(hrefs).toContain('/jobs/board?view=list&bucket=untouched');
    expect(hrefs).not.toContain('/jobs/board?view=list&bucket=held');
  });

  it('🔴 เลือก BU อยู่ (หน้ารายชื่อไม่แยก BU) = ไม่มีลิงก์ไปถังรายชื่อ — กดไปจะเจอเลขไม่เท่า', async () => {
    fetchTeamOnline.mockResolvedValue({ ...DATA, bu: 'LBD' });
    renderAt('/?home=online&bu=LBD');
    await waitFor(() => expect(text()).toContain('ติดต่อได้ 2 · นัดแล้ว 1'));
    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียด ผู้สมัครใหม่/ }));
    const sheet = await screen.findByRole('dialog');
    const hrefs = Array.from(sheet.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '');
    expect(hrefs.some((h) => h.includes('bucket='))).toBe(false);
    expect(sheet.textContent).toContain('กดเปิดรายชื่อได้ตอนดูทุก BU');
  });

  it('การ์ดคนใช้งาน → รายชื่อ (เฉพาะตอนเซิร์ฟเวอร์ส่งมา) · คนที่ยังไม่ได้ใช้ขึ้นก่อน', async () => {
    renderAt();
    await waitFor(() => expect(text()).toContain('50.0% ของ 4 บัญชี'));
    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียด คนใช้งาน/ }));
    const sheet = await screen.findByRole('dialog');
    expect(sheet.textContent).toContain('รายชื่อ · ยังไม่ได้ใช้ในช่วงนี้ 2 จาก 4 คน');
    const t = sheet.textContent ?? '';
    expect(t.indexOf('ชื่อ b')).toBeLessThan(t.indexOf('ชื่อ a'));
  });

  it('🔴 ไม่มีรายชื่อจากเซิร์ฟเวอร์ (เจ้าหน้าที่) = ไม่มีตารางรายชื่อ เห็นแค่ตัวเลข', async () => {
    fetchTeamOnline.mockResolvedValue({ ...DATA, people: null });
    renderAt();
    await waitFor(() => expect(text()).toContain('50.0% ของ 4 บัญชี'));
    fireEvent.click(screen.getByRole('button', { name: /ดูรายละเอียด คนใช้งาน/ }));
    const sheet = await screen.findByRole('dialog');
    expect(sheet.textContent).toContain('แยกบทบาท');
    expect(sheet.textContent).not.toContain('รายชื่อ ·');
    expect(sheet.textContent).not.toContain('ชื่อ b');
  });

  it('กราฟคนใช้ vs ใบขอเข้า + รายการจัดอันดับ BU ตามอัตราที่ขอเข้า (% ของทั้งหมด)', async () => {
    renderAt();
    await waitFor(() => expect(text()).toContain('คนใช้งาน เทียบ อัตราที่ขอเข้า'));
    expect(text()).toContain('5 อัตรา(71%)');
    expect(text()).toContain('2 อัตรา(29%)');
    expect(text()).toContain('คนใช้งาน ยังไม่มีบัญชี');
    // เรียงตามอัตราที่ขอเข้า มากไปน้อย · ไม่ระบุ BU ท้ายสุด
    const panel = text().slice(text().indexOf('BU ไหนงานเยอะ'));
    expect(panel.indexOf('LBD · ป้าย')).toBeLessThan(panel.indexOf('LM · ป้าย'));
  });

  it('แท็บคนใช้งานแยกบทบาท (ใช้ / บัญชี) · BU ที่ไม่มีบัญชีขึ้นป้ายบอก', async () => {
    renderAt();
    await waitFor(() => expect(text()).toContain('คนใช้งานต่อ BU · % ของบัญชีใน BU'));
    expect(text()).toContain('เจ้าหน้าที่ 1/2 · หัวหน้า 1/1');
    expect(text()).toContain('ยังไม่มีบัญชีในระบบ');
  });

  it('เจ้าหน้าที่: งานที่ต้องทำต่อขึ้นก่อนการ์ดตัวเลข · ส่วนวิเคราะห์พับไว้ กดแล้วค่อยเปิด', async () => {
    role = 'staff';
    renderAt();
    await waitFor(() => expect(text()).toContain('งานที่ต้องทำต่อ'));
    expect(text().indexOf('งานที่ต้องทำต่อ')).toBeLessThan(text().indexOf('อัตราที่ขอเข้า'));
    await waitFor(() => expect(text()).toContain('ติดต่อได้ 2 · นัดแล้ว 1'));
    expect(text()).not.toContain('คนใช้งาน เทียบ อัตราที่ขอเข้า');
    expect(text()).not.toContain('คนใช้งานต่อ BU · % ของบัญชีใน BU');
    fireEvent.click(screen.getByRole('button', { name: /ดูภาพรวมทีม/ }));
    await waitFor(() => expect(text()).toContain('คนใช้งาน เทียบ อัตราที่ขอเข้า'));
    expect(text()).toContain('คนใช้งานต่อ BU · % ของบัญชีใน BU');
  });

  it('?bu= ส่งถึงเส้น API (แปลงเป็นชุดแผนก)', async () => {
    renderAt('/?home=online&bu=lml');
    await waitFor(() => expect(fetchTeamOnline).toHaveBeenCalled());
    expect(fetchTeamOnline.mock.calls[0][0]).toMatchObject({ bu: 'LM' });
  });

  it('🔴 ผู้ใช้ถูกล็อกแผนก: ไม่มีตัวเลือก BU · เส้นอื่นได้ BU ที่เซิร์ฟเวอร์บังคับ', async () => {
    fetchTeamOnline.mockResolvedValue({ ...DATA, scope: 'code', forced_bu: 'LM', bu: 'LM' });
    renderAt();
    await waitFor(() => expect(fetchFlowSummary).toHaveBeenCalled());
    expect(fetchFlowSummary).toHaveBeenCalledWith('LM');
    expect(fetchOfficeFloor).toHaveBeenCalledWith('LM');
    expect(screen.queryByLabelText('รายละเอียด BU')).toBeNull();
  });
});
