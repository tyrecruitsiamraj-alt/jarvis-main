/**
 * ป๊อปไล่งานบนกล่องงาน
 * - ปุ่ม "ดึงประกาศลง" บนหัวป๊อป (เจ้าของเคาะ 29 ก.ย. 2569 · คำ 2 ต.ค. 2569: "หน้าสาธารณะ" → "ประกาศ")
 *   🔴 ใบที่ปล่อยแล้วเห็นปุ่มทันทีที่เปิด (ไม่ต้องไล่ไปขั้น 4) · กดแล้วดึงลงใบนั้นใบเดียว · ใบที่ยังไม่ปล่อยไม่มีปุ่มนี้
 * - โฉมใหม่ 30 ก.ย. 2569: ขั้น 1 ไม่มี "ติดอะไรไหม"/"ใครแก้อะไรไป" · "ไม่ปล่อยใบนี้" อยู่ล่างสุด ·
 *   ขั้น 4 สรุป + ส่งได้เลยโดยไม่ต้องมีลิงก์ (ยังต้องเลือกเพศ) · บันทึกแบบร่าง = ปิดป๊อปไม่ส่ง
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('คนเก่า + รายได้ย้อนหลัง พับไว้เป็นค่าตั้งต้น · กดกางได้ · ไม่มีประโยคอธิบายยาวของ eSlip', async () => {
    currentJob = WITH_RESIGNED;
    fetchJobReleases.mockResolvedValue([]);
    renderSteps();
    const toggle = await screen.findByRole('button', { name: /คนเก่า \+ รายได้ย้อนหลัง/ });
    expect(screen.queryByText('สาเหตุที่ลาออก')).toBeNull();
    fireEvent.click(toggle);
    expect(await screen.findByText('สาเหตุที่ลาออก')).toBeTruthy();
    expect(screen.getByText('จาก eSlip ของไซต์นี้')).toBeTruthy();
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
