/**
 * ป๊อปไล่งานบนกล่องงาน
 * - ปุ่ม "ดึงประกาศลง" บนหัวป๊อป (เจ้าของเคาะ 29 ก.ย. 2569 · คำ 2 ต.ค. 2569: "หน้าสาธารณะ" → "ประกาศ")
 *   🔴 ใบที่ปล่อยแล้วเห็นปุ่มทันทีที่เปิด (ไม่ต้องไล่ไปขั้น 4) · กดแล้วดึงลงใบนั้นใบเดียว · ใบที่ยังไม่ปล่อยไม่มีปุ่มนี้
 * - โฉมใหม่ 30 ก.ย. 2569: ขั้น 1 ไม่มี "ติดอะไรไหม"/"ใครแก้อะไรไป" · "ไม่ปล่อยใบนี้" อยู่ล่างสุด ·
 *   ขั้น 4 สรุป + ส่งได้เลยโดยไม่ต้องมีลิงก์ (ยังต้องเลือกเพศ) · บันทึกแบบร่าง = ปิดป๊อปไม่ส่ง
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { JobRequest } from '@/types';

const JOB_ID = 'siamraj-sql:OPL6909999';
const JOB = {
  id: JOB_ID,
  request_no: 'OPL6909999',
  unit_name: 'หน่วยทดสอบ',
  status: 'open',
  request_date: '2026-09-01',
  required_date: '2026-09-30',
  job_type: 'permanent',
  job_category: 'private',
  location_address: 'กรุงเทพมหานคร',
} as unknown as JobRequest;

/** ใบที่เส้นใบเดียวตอบ — เทสต์เปลี่ยนได้ (เช่น ใบที่ใบขอบอกเพศมาแล้ว) */
let currentJob: JobRequest = JOB;
const fetchJobReleases = vi.fn();
const unreleaseJobsFromPublic = vi.fn(async (_ids: string[]) => 1);
const releaseJobsToPublic = vi.fn(async (_ids: string[]) => 1);

vi.mock('@/lib/siamrajUnitRequestsApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/siamrajUnitRequestsApi')>()),
  fetchSiamrajUnitRequest: vi.fn(async () => currentJob),
}));
vi.mock('@/lib/recruitPostingsApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/recruitPostingsApi')>()),
  fetchRecruitPostings: vi.fn(async () => []),
}));
vi.mock('@/lib/jobPublicReleaseApi', async (orig) => ({
  ...(await orig<typeof import('@/lib/jobPublicReleaseApi')>()),
  fetchJobReleases: () => fetchJobReleases(),
  unreleaseJobsFromPublic: (ids: string[]) => unreleaseJobsFromPublic(ids),
  releaseJobsToPublic: (ids: string[]) => releaseJobsToPublic(ids),
}));
// ป๊อปอ่านสิทธิ์แค่ว่าเห็นประวัติการแก้ไขไหม (admin) — เจ้าหน้าที่ทั่วไปพอ
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ hasPermission: () => false }) }));
// กล่องลูก (อัตราจ้าง/คนลาออก ฯลฯ) ยิงของตัวเอง — ตอบว่างให้หมด ไม่ต้องออกเน็ต
vi.mock('@/lib/apiFetch', async (orig) => ({
  ...(await orig<typeof import('@/lib/apiFetch')>()),
  apiFetch: vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })),
}));

const { BoardPostingSteps } = await import('./BoardPostingPage');

const released = [{ job_id: JOB_ID, request_no: 'OPL6909999', released_at: '2026-08-25T03:30:00Z', released_by_name: null, note: null }];

const renderSteps = (onDone: () => void = () => {}, onSearchAllPools?: () => void) =>
  render(
    <MemoryRouter>
      <BoardPostingSteps id={JOB_ID} chrome={false} onDone={onDone} onSearchAllPools={onSearchAllPools} />
    </MemoryRouter>,
  );

beforeEach(() => {
  currentJob = JOB;
  fetchJobReleases.mockReset();
  unreleaseJobsFromPublic.mockClear();
  releaseJobsToPublic.mockClear();
});
afterEach(() => cleanup());

describe('ป๊อปไล่งาน — ดึงประกาศลงบนหัวป๊อป', () => {
  it('🔴 ใบที่ปล่อยแล้ว: เปิดมาเห็นปุ่มข้างป้ายเลย · กดแล้วดึงลงใบนี้ใบเดียว (ไม่ปล่อยซ้ำ)', async () => {
    fetchJobReleases.mockResolvedValue(released);
    renderSteps();
    const button = await screen.findByRole('button', { name: 'ดึงประกาศลง' });
    expect(screen.getByText('ประกาศแล้ว')).toBeTruthy(); // ไม่มี ✓ (ถอดอิโมจิทั้งระบบ 5 ต.ค. 2569)
    fetchJobReleases.mockResolvedValue([]);
    fireEvent.click(button);
    await waitFor(() => expect(unreleaseJobsFromPublic).toHaveBeenCalledWith([JOB_ID]));
    expect(releaseJobsToPublic).not.toHaveBeenCalled();
    // ทะเบียนโหลดใหม่แล้วไม่มีใบนี้ ⇒ ป้าย + ปุ่มหายไปเอง
    await waitFor(() => expect(screen.queryByRole('button', { name: 'ดึงประกาศลง' })).toBeNull());
  });

  it('ใบที่ยังไม่ปล่อย: ไม่มีปุ่มดึงลงบนหัวป๊อป', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderSteps();
    await screen.findByRole('navigation', { name: 'ขั้นตอนของงานประกาศ' });
    await waitFor(() => expect(fetchJobReleases).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'ดึงประกาศลง' })).toBeNull();
  });
});

describe('ป๊อปไล่งานโฉมใหม่ (30 ก.ย. 2569)', () => {
  it('ขั้น 1: แยกการ์ดชัด · ไม่มี "ติดอะไรไหม"/"ใครแก้อะไรไป" · "ไม่ปล่อยใบนี้" อยู่ล่างสุดใต้ปุ่มถัดไป', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderSteps();
    const skipButton = await screen.findByRole('button', { name: /ไม่ประกาศใบนี้/ });
    expect(screen.getByRole('heading', { name: 'ข้อมูลใบขอ' })).toBeTruthy();
    // 4 ต.ค. 2569: หน้า 1 = ข้อมูลใบขออย่างเดียว · เพศย้ายไปหน้า 3
    expect(screen.queryByRole('heading', { name: 'เพศที่รับ' })).toBeNull();
    expect(screen.queryByText('ติดอะไรไหม')).toBeNull();
    expect(screen.queryByText('ใครแก้อะไรไป')).toBeNull();
    expect(screen.queryByLabelText('หมายเหตุใบขอ')).toBeNull();
    const next = screen.getByRole('button', { name: /ถัดไป ขั้น 2/ });
    // ปุ่มไม่ปล่อยอยู่หลังปุ่มถัดไปในหน้า (ล่างสุด)
    expect(next.compareDocumentPosition(skipButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('🔴 ขั้น 4: ส่งได้เลยไม่ต้องมีลิงก์ (ใบขอบอกเพศมาแล้ว) · ส่งแล้วปิดป๊อป', async () => {
    currentJob = { ...JOB, gender_requirement: 'ชาย' } as JobRequest;
    fetchJobReleases.mockResolvedValue([]);
    const onDone = vi.fn();
    renderSteps(onDone);
    fireEvent.click(await screen.findByRole('button', { name: /สรุป \+ ส่งประกาศ/ }));
    expect(screen.getByRole('heading', { name: 'สรุปก่อนส่ง' })).toBeTruthy();
    expect(await screen.findByText('ยังไม่มีลิงก์')).toBeTruthy();
    const send = screen.getByRole('button', { name: 'ส่งประกาศ' });
    await waitFor(() => expect(send.hasAttribute('disabled')).toBe(false));
    fetchJobReleases.mockResolvedValue(released);
    fireEvent.click(send);
    await waitFor(() => expect(releaseJobsToPublic).toHaveBeenCalledWith([JOB_ID]));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('ขั้น 4: ใบขอไม่ระบุเพศ = ส่งไม่ได้ + มีปุ่มพาไปเลือก · บันทึกแบบร่าง = ปิดป๊อปโดยไม่ส่ง', async () => {
    fetchJobReleases.mockResolvedValue([]);
    const onDone = vi.fn();
    renderSteps(onDone);
    fireEvent.click(await screen.findByRole('button', { name: /สรุป \+ ส่งประกาศ/ }));
    expect((await screen.findByRole('button', { name: 'ส่งประกาศ' })).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'ไปหน้า 3 เลือกเพศ' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'บันทึกแบบร่าง' }));
    expect(onDone).toHaveBeenCalled();
    expect(releaseJobsToPublic).not.toHaveBeenCalled();
  });

  it('ขั้น 4: ปุ่ม "Gen link" แบบกางลง — พับไว้ก่อน · กดกางฟอร์ม · กดซ้ำพับ (เจ้าของสั่ง 5 ต.ค. 2569)', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderSteps();
    fireEvent.click(await screen.findByRole('button', { name: /สรุป \+ ส่งประกาศ/ }));
    const toggle = await screen.findByTestId('gen-link-toggle');
    expect(toggle.textContent).toContain('Gen link');
    expect(screen.queryByRole('checkbox', { name: 'สร้างลิงก์' })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Gen link' })).toHaveLength(1); // ปุ่มกางอย่างเดียว ยังไม่มีฟอร์ม
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Gen link' }).length).toBe(2)); // + ปุ่มส่งในฟอร์ม
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Gen link' })).toHaveLength(1));
  });

  it('แถบ 4 ขั้นอยู่แถวเดียว (กริด 4 ช่อง) · ป้ายค้างที่นี่อยู่ในช่องของขั้น (เจ้าของสั่ง 5 ต.ค. 2569)', async () => {
    renderSteps();
    const nav = await screen.findByRole('navigation', { name: 'ขั้นตอนของงานประกาศ' });
    expect(nav.className).toContain('grid-cols-4');
    expect(nav.querySelectorAll('button')).toHaveLength(4);
  });
});

/** 🔴 เจ้าของ Choice 1 ต.ค. 2569 "4 ขั้นเดิม แต่ตัดของรก" — ขั้นเท่าเดิม ของรกพับ/ย้าย/ถอด */
describe('ป๊อปไล่งาน — ตัดของรก (1 ต.ค. 2569)', () => {
  const WITH_RESIGNED = {
    ...JOB,
    resigned_employee_name: 'คนเก่า สมมุติ',
    resigned_reason: 'ย้ายบ้าน',
    resigned_wage_fee_rate: 400,
  } as unknown as JobRequest;

  /** เจ้าของ 5 ต.ค. 2569: *"รายละเอียดขอดูแค่นี้"* + Choice "เหลือแค่ที่บอก เก็บส่วนเกินไว้ใน ดูเพิ่ม" · เฉพาะหน้างานสรรหา */
  it('🔴 หน้า 1 เหลือแค่ที่เจ้าของสั่ง · ชื่อคนเก่า + รายได้ 3 เดือนเห็นเลย · ส่วนเกินอยู่ใต้ "ดูเพิ่ม"', async () => {
    currentJob = WITH_RESIGNED;
    fetchJobReleases.mockResolvedValue([]);
    renderSteps();
    const brief = await screen.findByTestId('request-brief-fields');
    const labels = [...brief.querySelectorAll('.text-\\[10px\\]')].map((e) => e.textContent);
    expect(labels).toEqual([
      'ชื่อหน่วยงาน',
      'ตำแหน่ง',
      'วันที่ต้องการ',
      'จำนวนที่ต้องการ',
      'สถานที่ปฏิบัติงาน',
      'วันเวลาในการทำงาน',
    ]);
    expect(screen.getByText('คนลาออก / ถูกเปลี่ยนตัว')).toBeTruthy();
    expect(screen.getByText('คนเก่า สมมุติ')).toBeTruthy();
    expect(screen.getByText(/รายได้จริงย้อนหลัง 3 เดือน/)).toBeTruthy();
    // ส่วนเกินยังไม่โผล่จนกว่าจะกดดูเพิ่ม
    expect(screen.queryByText('สาเหตุที่ลาออก')).toBeNull();
    expect(screen.queryByText('เลขที่ใบขอ')).toBeNull();
    expect(screen.queryByText('ชื่อผู้ติดต่อหน่วยงาน')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /ดูเพิ่ม/ }));
    const more = await screen.findByTestId('request-more');
    expect(within(more).getByText('สาเหตุที่ลาออก')).toBeTruthy();
    expect(within(more).getByText('เลขที่ใบขอ')).toBeTruthy();
    expect(screen.queryByText(/PR-4813/)).toBeNull();
    expect(screen.queryByText(/เงินได้ = ค่าแรง/)).toBeNull();
  });

  it('ปุ่ม "หาคนทุกกอง + ให้ AI โทร" อยู่แท็บรายชื่อ ไม่อยู่ในหน้าตรวจสอบ · กดแล้วเรียกตัวจัดการ', async () => {
    fetchJobReleases.mockResolvedValue([]);
    const onSearch = vi.fn();
    renderSteps(() => {}, onSearch);
    await screen.findByRole('navigation', { name: 'ขั้นตอนของงานประกาศ' });
    expect(screen.queryByRole('button', { name: /หาคนทุกกอง/ })).toBeNull();
    // Radix Tabs สลับด้วย mousedown
    fireEvent.mouseDown(screen.getByRole('tab', { name: /รายชื่อ/ }), { button: 0 });
    fireEvent.click(await screen.findByRole('button', { name: /หาคนทุกกอง/ }));
    expect(onSearch).toHaveBeenCalled();
  });

  it('ใบปิด/ยกเลิก (ไม่ส่งตัวจัดการ) ⇒ แท็บรายชื่อไม่มีปุ่มหาคน', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderSteps();
    fireEvent.mouseDown(await screen.findByRole('tab', { name: /รายชื่อ/ }), { button: 0 });
    await waitFor(() => expect(screen.getByRole('tab', { name: /รายชื่อ/ }).getAttribute('aria-selected')).toBe('true'));
    expect(screen.queryByRole('button', { name: /หาคนทุกกอง/ })).toBeNull();
  });
});

/** 🔴 เจ้าของไล่ Journey 4 ต.ค. 2569 — 4 หน้า: ข้อมูลใบขอ → สถานที่ → สวัสดิการ+รายได้+เพศ+อายุ → สรุป (แก้ไม่ได้) */
describe('ป๊อป 4 หน้าตาม Journey (4 ต.ค. 2569)', () => {
  it('หน้า 1 กางใบขอทั้งใบเลย (ไม่ต้องกด "ดูใบขอทั้งใบ")', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderSteps();
    await screen.findByRole('button', { name: /ไม่ประกาศใบนี้/ });
    expect(screen.queryByRole('button', { name: /ดูใบขอทั้งใบ/ })).toBeNull();
  });

  it('หน้า 3 มีเพศ + อายุ (ดึงจากใบขอมาก่อน)', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderSteps();
    fireEvent.click(await screen.findByRole('button', { name: /เลือกสวัสดิการ รายได้ เพศ อายุ/ }));
    expect(await screen.findByRole('heading', { name: 'เพศที่รับ' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'อายุที่รับ' })).toBeTruthy();
    expect(screen.getByLabelText('อายุต่ำสุด')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'บันทึกอายุ' }).hasAttribute('disabled')).toBe(true);
  });

  it('หน้า 4 สรุปแก้ในหน้านี้ไม่ได้ — มีแถวอายุ · ปุ่ม "แก้" พาไปหน้าของช่องนั้น · ไม่มีฟอร์มแก้ข้อความประกาศในสรุป', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderSteps();
    fireEvent.click(await screen.findByRole('button', { name: /สรุป \+ ส่งประกาศ/ }));
    expect(screen.getByText('อายุที่รับ')).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'แก้อายุที่รับ' }));
    expect(await screen.findByRole('heading', { name: 'อายุที่รับ' })).toBeTruthy();
  });
});

/**
 * 🔴 2 จอ เริ่มจากวางโพสต์ (เจ้าของไล่ Journey งานสรรหา 6 ต.ค. 2569 → Choice "เหลือ 2 จอ เริ่มจากวางโพสต์")
 * + เจ้าของถาม "ยังดูข้อมูล master ได้ใช่ไหม" ⇒ การ์ดข้อมูลใบขอกางดูได้บนจอ 1
 */
describe('ป๊อปประกาศ 2 จอ (6 ต.ค. 2569)', () => {
  const renderQuick = (onDone: () => void = () => {}) =>
    render(
      <MemoryRouter>
        <BoardPostingSteps id={JOB_ID} chrome={false} flow="quick" onDone={onDone} />
      </MemoryRouter>,
    );

  it('จอ 1: วางโพสต์อยู่บนสุด · ช่องทุกช่องในจอเดียว · ข้อมูลใบขอกางดูได้ · ช่องที่ขาดขึ้นแดง', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderQuick();
    const nav = await screen.findByTestId('quick-steps');
    expect(nav.querySelectorAll('button')).toHaveLength(2);
    expect(within(nav).getByText('ข้อมูลประกาศ')).toBeTruthy();
    expect(within(nav).getByText('ประกาศ + Gen link')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'วางข้อความโพสต์' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'เพศที่รับ' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'อายุที่รับ' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'วันเวลาทำงาน · รายละเอียดงาน · คุณสมบัติ' })).toBeTruthy();
    // ใบนี้ไม่มีรายได้ + ไม่ระบุเพศ = ขึ้นแดงทั้งบนและล่าง
    await waitFor(() => expect(screen.getAllByTestId('quick-gaps')[0].textContent).toContain('รายได้'));
    expect(screen.getAllByTestId('quick-gaps')[0].textContent).toContain('เพศ');
    fireEvent.click(screen.getByTestId('quick-master-toggle'));
    expect(await screen.findByTestId('quick-master')).toBeTruthy();
    // 4 หน้าเดิมไม่โผล่
    expect(screen.queryByRole('navigation', { name: 'ขั้นตอนของงานประกาศ' })?.className).not.toContain('grid-cols-4');
  });

  it('จอ 2: ลิงก์ (ยังไม่มี = ฟอร์ม Gen link กางรอ) · ข้อความโพสต์ · ตัวอย่างผู้สมัคร · ส่งประกาศแล้วปิดป๊อป', async () => {
    currentJob = { ...JOB, gender_requirement: 'ชาย' } as JobRequest;
    fetchJobReleases.mockResolvedValue([]);
    const onDone = vi.fn();
    renderQuick(onDone);
    fireEvent.click(await screen.findByRole('button', { name: /ถัดไป ประกาศ \+ Gen link/ }));
    expect(screen.getByRole('heading', { name: 'ลิงก์สมัคร' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ข้อความโพสต์' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ผู้สมัครจะเห็นแบบนี้' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'สรุปก่อนส่ง' })).toBeNull();
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Gen link' }).length).toBe(2));
    const send = screen.getByRole('button', { name: 'ส่งประกาศ' });
    await waitFor(() => expect(send.hasAttribute('disabled')).toBe(false));
    fetchJobReleases.mockResolvedValue(released);
    fireEvent.click(send);
    await waitFor(() => expect(releaseJobsToPublic).toHaveBeenCalledWith([JOB_ID]));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('จอ 2: ไม่ระบุเพศ = ส่งไม่ได้ · ปุ่มพากลับจอ 1', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderQuick();
    fireEvent.click(await screen.findByRole('button', { name: /ถัดไป ประกาศ \+ Gen link/ }));
    expect((await screen.findByRole('button', { name: 'ส่งประกาศ' })).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'กลับไปเลือกเพศ' }));
    expect(await screen.findByRole('heading', { name: 'เพศที่รับ' })).toBeTruthy();
  });

  it('ป๊อปบนงานสรรหา: ค่าเริ่ม = หน้าเดียว 9 กล่อง (6 ต.ค. ค่ำ) · ?popup=quick = 2 จอ · ?popup=steps = 4 หน้า', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(`${process.cwd()}/src/components/jobs/JobBoardView.tsx`, 'utf8');
    expect(src).toContain("popupParam === 'steps' ? 'steps' : popupParam === 'quick' ? 'quick' : 'one'");
    expect(src).toContain('flow={postingFlow}');
  });
});

/**
 * 🔴 หน้าเดียว 9 กล่อง + Gen link (เจ้าของ 6 ต.ค. 2569 ค่ำ: *"แยกกล่องให้ใส่แบบนี้ … ทุกหน้ามีปุ่มข้างเพื่อกดแล้วเด้ง Popup
 * ให้ดูได้ … มีหน้าเดียวแค่ใส่รายละเอียด กับ Genlink จบๆเลย"* → Choice "ทำเลย")
 */
describe('ป๊อปประกาศหน้าเดียว 9 กล่อง (6 ต.ค. 2569 ค่ำ)', () => {
  const renderOne = (onDone: () => void = () => {}) =>
    render(
      <MemoryRouter>
        <BoardPostingSteps id={JOB_ID} chrome={false} flow="one" onDone={onDone} />
      </MemoryRouter>,
    );
  const BOXES = ['income', 'total', 'benefits', 'gender', 'age', 'place', 'schedule', 'details', 'requirements'];

  it('9 กล่องเรียงตามที่เจ้าของสั่ง · ไม่มีแถบขั้น · ลิงก์ + ข้อความโพสต์ + ส่งประกาศอยู่หน้าเดียวกัน', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderOne();
    await screen.findByTestId('box-income');
    expect(BOXES.map((k) => screen.getByTestId(`box-${k}`).querySelector('h3')?.textContent)).toEqual([
      'รายได้',
      'รายได้รวม',
      'สวัสดิการ',
      'เพศ',
      'อายุ',
      'สถานที่ปฏิบัติงาน',
      'วันเวลาทำงาน',
      'รายละเอียดงาน',
      'คุณสมบัติ',
    ]);
    expect(screen.queryByTestId('quick-steps')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'ขั้นตอนของงานประกาศ' })).toBeNull();
    // เจ้าของ 6 ต.ค. ค่ำ: "วางข้อความโพสต์ ก็ไม่ต้องมีแล้วสิ่"
    expect(screen.queryByRole('heading', { name: 'วางข้อความโพสต์' })).toBeNull();
    expect(screen.queryByTestId('post-text-paste')).toBeNull();
    expect(screen.getByRole('heading', { name: 'ลิงก์สมัคร' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'ข้อความโพสต์' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'ส่งประกาศ' })).toBeTruthy();
  });

  it('ช่องที่ขาดขึ้น "ยังไม่ได้ใส่" · ปุ่ม "แก้" กางทีละกล่อง · ปุ่มใบขอไม่มีถ้าใบขอไม่มีข้อมูลช่องนั้น', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderOne();
    const gender = await screen.findByTestId('box-gender');
    expect(gender.textContent).toContain('ยังไม่ได้ใส่');
    expect(screen.getByTestId('box-income').textContent).toContain('ยังไม่ได้ใส่');
    // ใบนี้ไม่มีคุณสมบัติ/รถในใบขอ = ไม่มีปุ่ม "ใบขอ" (ห้ามปุ่มตาย)
    expect(within(screen.getByTestId('box-requirements')).queryByRole('button', { name: /ตามใบขอ/ })).toBeNull();
    expect(within(screen.getByTestId('box-details')).queryByRole('button', { name: /ตามใบขอ/ })).toBeNull();
    expect(within(gender).getByRole('button', { name: 'เพศ ตามใบขอ' })).toBeTruthy();
    fireEvent.click(within(gender).getByRole('button', { name: 'แก้' }));
    expect(await within(gender).findByRole('button', { name: 'ชาย' })).toBeTruthy();
    const age = screen.getByTestId('box-age');
    fireEvent.click(within(age).getByRole('button', { name: 'แก้' }));
    // กางกล่องใหม่ = กล่องเดิมพับ
    await waitFor(() => expect(within(gender).queryByRole('button', { name: 'ชาย' })).toBeNull());
    expect(within(age).getByRole('button', { name: 'เสร็จ' })).toBeTruthy();
  });

  it('ไม่ระบุเพศ = ส่งไม่ได้ · ปุ่ม "เลือกเพศ" กางกล่องเพศ', async () => {
    fetchJobReleases.mockResolvedValue([]);
    renderOne();
    expect((await screen.findByRole('button', { name: 'ส่งประกาศ' })).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'เลือกเพศ' }));
    expect(await within(screen.getByTestId('box-gender')).findByRole('button', { name: 'ชาย' })).toBeTruthy();
  });

  it('API เก็บค่าใบขอเดิมก่อนทับ (อายุ · วันเวลาทำงาน) ให้ปุ่ม "ใบขอ" เรียกดูได้', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(`${process.cwd()}/api/_handlers/siamraj-unit-requests.ts`, 'utf8');
    expect(src).toContain('it.erp_age_range_min = it.age_range_min ?? null;');
    expect(src).toContain('it.erp_work_schedule = it.work_schedule ?? null;');
  });
});
