/**
 * หน้าหลักใหม่ "ระบบไปกี่ %" (30 ก.ย. 2569 · รอบ 5 เหลือ dropdown + แผงเดียว)
 * 🔴 ด่าน: เลือกหัวข้อจาก dropdown (ติดตาม · ดูแลหลังเริ่มงาน · ผู้สมัคร · จับคู่งาน) แล้วตัวเลข + กราฟเปลี่ยนตาม ·
 *    ตัวเลือกบอก AI % ของทุกหัวข้อ · จำหัวข้อไว้ในเครื่อง · ช่วงเริ่มที่ 7 วันล่าสุด ·
 *    เลขตัวใหญ่ = AI ÷ ที่โทรแล้ว · ยังไม่มีที่โทรแล้ว = "AI —" (ห้าม 0% ปลอม) ·
 *    ฐานยังไม่มีช่องลงผลของคนโทร = บอกบนจอ · หัวข้อที่ล้มบอกเหตุ ห้ามขึ้น 0 ·
 *    ท้ายหน้ามีใครอยู่ในระบบ ปิดไว้ กดแล้วกาง · BU เป็น dropdown ·
 *    แผงเลื่อนตอนกดแท่ง + ปุ่ม "ดูทั้งหมด" ถอดแล้ว (เจ้าของสั่ง 30 ก.ย.) — แท่งรายวันกดไม่ได้ ·
 *    กดสวิตช์แยก BU แล้วแท่งกราฟพลิกไพ่ (รอบ 12 · กล่องยอดไม่พลิกแล้ว) ·
 *    รอบ 17: กล่องเรียง ทั้งหมด → AI โทร → คนโทร → ยังไม่โทร · กดกล่อง = Popup รายชื่อ (กล่อง 0 กดไม่ได้) ·
 *    ปฏิทิน + dropdown อยู่ฝั่งซ้ายต่อจากชื่อหน้า · แยก BU ขึ้นครบทุก BU · หัวกราฟบอกเดือน + ช่วงวัน ·
 *    รอบ 18: เลือกหลายเดือนบนปฏิทิน (กดยืนยันก่อน) = หนึ่งแท่งต่อเดือน กดแท่งลงไปดูรายวัน มีปุ่มกลับ ·
 *    แผง "ผลโทร" ซ่อนไว้ก่อน "ใครอยู่ในระบบ" · ช่องไฟ/ระยะบรรทัดเท่ากันทั้งหน้า (`EVEN_TYPE`) ·
 *    หน่วยบนจอเป็น "รายชื่อ" ทุกหัวข้อ (เจ้าของ: "เรานับจากรายชื่อ ต้องเป็นรายชื่อหมดเลย")
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import {
  AI_SHARE_BUS,
  defaultAiShareWindow,
  type AiShareDetailResponse,
  type AiShareListKey,
  type AiShareListResponse,
  type AiShareResponse,
} from '@/lib/homeAiShare';
import type { HomePresenceResponse } from '@/lib/homePresence';
import { emptyCallResultCounts, type AiShareResultsResponse } from '@/lib/homeCallResults';
import { EVEN_TYPE } from '@/lib/designTokens';
import { rangeTextFull } from '@/lib/periodPick';

const fetchHomeAiShare = vi.fn();
const fetchHomeAiShareDetail = vi.fn();
const fetchHomeAiShareList = vi.fn();
const fetchHomeAiShareResults = vi.fn();
vi.mock('@/lib/homeAiShareApi', () => ({
  fetchHomeAiShare: (...a: unknown[]) => fetchHomeAiShare(...a),
  fetchHomeAiShareDetail: (...a: unknown[]) => fetchHomeAiShareDetail(...a),
  fetchHomeAiShareList: (...a: unknown[]) => fetchHomeAiShareList(...a),
  fetchHomeAiShareResults: (...a: unknown[]) => fetchHomeAiShareResults(...a),
}));
const fetchHomePresence = vi.fn();
vi.mock('@/lib/homePresenceApi', () => ({
  fetchHomePresence: (...a: unknown[]) => fetchHomePresence(...a),
}));
// กราฟ recharts วัดขนาดจอไม่ได้ใน jsdom — แทนด้วยปุ่มหนึ่งปุ่มต่อแท่ง (กดแล้วเรียก onPick เหมือนกดแท่งจริง)
// ชั้นในแท่งติดไว้ที่ data-stacks · ตัวจุดพลิกไพ่ที่ data-flip · กดได้ไหมที่ data-clickable ⇒ เทสต์สวิตช์/การกดลงไปดูได้
vi.mock('@/components/home-ai-share/AiShareUsageChart', () => ({
  default: ({
    ariaLabel,
    buckets,
    stacks,
    flipKey,
    onPick,
  }: {
    ariaLabel: string;
    buckets: Array<{ key: string }>;
    stacks: Array<{ label: string }>;
    flipKey: string;
    onPick?: (i: number) => void;
  }) => (
    <div
      role="img"
      aria-label={ariaLabel}
      data-stacks={stacks.map((x) => x.label).join('|')}
      data-flip={flipKey}
      data-clickable={onPick ? 'yes' : 'no'}
    >
      {buckets.map((b, i) => (
        <button key={b.key} type="button" onClick={() => onPick?.(i)}>
          แท่ง {b.key}
        </button>
      ))}
    </div>
  ),
}));

const { default: HomeAiSharePage } = await import('./HomeAiSharePage');

const BLOCK_STORE = 'jarvis:home-ai-share:block';
const win = defaultAiShareWindow();

function body(over: Partial<AiShareResponse> = {}): AiShareResponse {
  return {
    generated_at: '2026-09-30T02:00:00.000Z',
    from: win.from,
    to: win.to,
    bu: null,
    forced_bu: false,
    follow: { total: 205, ai: 205, staff: 0, both: 0, notCalled: 0, waitingAi: 0, waitingStaff: 0 },
    aftercare: { total: 0, ai: 0, staff: 0, both: 0, notCalled: 0, waitingAi: 0, waitingStaff: 0 },
    applicants: { total: 78, ai: 77, staff: 0, both: 0, notCalled: 1, waitingAi: 1, held: 0, untouched: 0 },
    matching: { total: 43, ai: 40, staff: 0, both: 0, notCalled: 3, waitingAi: 0, holding: 0 },
    follow_staff_ready: true,
    errors: {},
    previous: null,
    ...over,
  };
}

function detail(block: AiShareDetailResponse['block']): AiShareDetailResponse {
  return {
    generated_at: '2026-09-30T02:00:00.000Z',
    block,
    from: win.from,
    to: win.to,
    bu: null,
    rows: [
      { day: win.to!, bu: 'LBD', total: 200, ai: 190, staff: 10, both: 0, notCalled: 0 },
      { day: win.to!, bu: 'LBA', total: 5, ai: 5, staff: 0, both: 0, notCalled: 0 },
    ],
    follow_staff_ready: true,
    error: null,
  };
}

/** รายชื่อหน้าหนึ่งของกล่องหนึ่ง (Popup รอบ 17) — ชื่อสมมติ ไม่ใช่คนจริง */
function list(block: AiShareListResponse['block'], key: AiShareListKey, page: number, total = 45): AiShareListResponse {
  const size = 20;
  const n = Math.max(0, Math.min(size, total - page * size));
  return {
    generated_at: '2026-09-30T02:00:00.000Z',
    block,
    segment: key,
    from: win.from,
    to: win.to,
    bu: null,
    page,
    page_size: size,
    total,
    rows: Array.from({ length: n }, (_, i) => ({
      id: `r${page}-${i}`,
      name: i === 1 ? null : `ผู้รับสาย ${page * size + i + 1}`,
      bu: i === 2 ? null : 'LBD',
      day: win.to!,
      segment: key === 'total' ? (i % 2 ? 'notCalled' : 'ai') : key,
    })),
    follow_staff_ready: true,
    error: null,
  };
}

/** ผลโทรของหัวข้อหนึ่ง (แผงผลโทร รอบ 18) — ช่วงตามที่ขอ */
function results(block: AiShareResultsResponse['block'], w: { from: string | null; to: string | null }): AiShareResultsResponse {
  const follow = block === 'follow' || block === 'aftercare';
  return {
    generated_at: '2026-09-30T02:00:00.000Z',
    block,
    from: w.from,
    to: w.to,
    bu: null,
    vocab: follow ? 'follow' : 'interest',
    ai: { ...emptyCallResultCounts(), said_yes: 153, picked_silent: 1, said_no: 3, no_pickup: 15, talked_unclear: 33 },
    staff: { ...emptyCallResultCounts(), said_yes: 2 },
    follow_staff_ready: true,
    error: null,
  };
}

const presence: HomePresenceResponse = {
  generated_at: '2026-09-30T05:00:00.000Z',
  online_minutes: 30,
  bu: null,
  counts: { total: 3, online: 1, offline: 1, never: 1 },
  by_bu: [
    { bu: 'LBD', counts: { total: 1, online: 1, offline: 0, never: 0 } },
    { bu: 'LBA', counts: { total: 1, online: 0, offline: 1, never: 0 } },
    { bu: 'LM', counts: { total: 1, online: 0, offline: 0, never: 1 } },
  ],
  people: [
    { id: 'a', name: 'คนหนึ่ง', bu: 'LBD', role: 'staff', status: 'online', lastLoginAt: '2026-09-30T04:00:00.000Z', lastActiveAt: '2026-09-30T04:55:00.000Z' },
    { id: 'b', name: 'คนสอง', bu: 'LBA', role: 'staff', status: 'offline', lastLoginAt: '2026-09-29T04:00:00.000Z', lastActiveAt: null },
    { id: 'c', name: 'คนสาม', bu: 'LM', role: 'staff', status: 'never', lastLoginAt: null, lastActiveAt: null },
  ],
  can_see_people: true,
  error: null,
};

/** กล่องหนึ่งก้อน (Visual Control รอบ 8 · รอบ 17 เป็นปุ่ม ชื่อปุ่ม = ป้าย + เลข เช่น "AI โทร 205") */
const tileOf = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label} [\\d,]+( \\S+)?$`) });
/** ข้อความของกล่อง (ป้าย + ชิป + เลข + แถบ/บรรทัดท้าย) */
const stat = (label: string) => (tileOf(label).textContent ?? '').replace(/\s+/g, ' ');

const openPicker = () => fireEvent.click(screen.getByRole('combobox', { name: 'เลือกหัวข้อ' }));

beforeAll(() => {
  // กันไว้เผื่อมี recharts ResponsiveContainer ในหน้า — jsdom ไม่มี ResizeObserver (แบบเดียวกับเทสต์หน้าทีม Online)
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // dropdown ของ Radix เลื่อนตัวเลือกเข้าจอตอนเปิด — jsdom ไม่มีฟังก์ชันนี้
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  window.localStorage.clear();
  fetchHomeAiShare.mockReset().mockResolvedValue(body());
  fetchHomeAiShareDetail.mockReset().mockImplementation((block: AiShareDetailResponse['block']) => Promise.resolve(detail(block)));
  fetchHomeAiShareList
    .mockReset()
    .mockImplementation((block: AiShareListResponse['block'], key: AiShareListKey, page: number) => Promise.resolve(list(block, key, page)));
  fetchHomeAiShareResults
    .mockReset()
    .mockImplementation((block: AiShareResultsResponse['block'], w: { from: string | null; to: string | null }) => Promise.resolve(results(block, w)));
  fetchHomePresence.mockReset().mockResolvedValue(presence);
});
afterEach(() => cleanup());

describe('หน้าหลัก "ระบบไปกี่ %"', () => {
  it('เริ่มที่ติดตาม · 7 วันล่าสุด · เลขตามที่เส้นส่งมา · กราฟของหัวข้อนั้นขึ้นเลย', async () => {
    render(<HomeAiSharePage />);
    expect(await screen.findByRole('heading', { name: 'ติดตาม' })).toBeTruthy();
    expect(fetchHomeAiShare).toHaveBeenCalledWith(win);
    expect(screen.getByRole('button', { name: /ช่วงเวลา 7 วันล่าสุด/ })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'เลือกหัวข้อ' }).textContent).toContain('ติดตาม');
    // รอบ 10: dropdown อยู่หัวหน้าข้างปุ่มปฏิทิน (ไม่อยู่ในแผงแล้ว)
    const picker = screen.getByRole('combobox', { name: 'เลือกหัวข้อ' });
    const calendar = screen.getByRole('button', { name: /ช่วงเวลา/ });
    expect(picker.parentElement?.contains(calendar)).toBe(true);
    // รอบ 17: ฝั่งซ้ายต่อจากชื่อหน้า — ชื่อหน้า → ปฏิทิน → dropdown (ไม่มีตัวดันไปขวา)
    const h1 = screen.getByRole('heading', { level: 1, name: 'หน้าหลัก' });
    expect(h1.parentElement?.contains(picker)).toBe(true);
    expect(h1.compareDocumentPosition(calendar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(calendar.compareDocumentPosition(picker) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(h1.parentElement?.className).not.toContain('justify-between');
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    expect(stat('AI โทร')).toContain('205');
    // ติดตามตั้งได้ทางเดียว ⇒ ไม่มีกล่อง "ทั้งสองทาง"
    expect(screen.queryByRole('button', { name: /^ทั้งสองทาง/ })).toBeNull();
    // รอบ 16: ป้าย "หนักไปทาง AI" ถอดแล้ว
    expect(screen.queryByText('หนักไปทาง AI')).toBeNull();
    await waitFor(() => expect(fetchHomeAiShareDetail).toHaveBeenCalledWith('follow', win));
    expect(await screen.findByRole('img', { name: 'ติดตาม ยอดใช้งานรายวัน' })).toBeTruthy();
    // รอบ 17: หัวกราฟบอกเดือน + ช่วงวันที่กำลังดู (แกนล่างเหลือเลขวัน)
    expect(screen.getByText(rangeTextFull(win.from!, win.to!))).toBeTruthy();
  });

  it('dropdown บอก AI % ของทุกหัวข้อ · เลือกแล้วตัวเลข + กราฟเปลี่ยนตาม · จำไว้ในเครื่อง', async () => {
    render(<HomeAiSharePage />);
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    openPicker();
    const matching = await screen.findByRole('option', { name: /จับคู่งาน/ });
    expect(matching.textContent).toContain('AI 100%');
    expect(screen.getByRole('option', { name: /ดูแลหลังเริ่มงาน/ }).textContent).toContain('ยังไม่มีงาน');
    fireEvent.click(matching);
    expect(await screen.findByRole('heading', { name: 'จับคู่งาน' })).toBeTruthy();
    expect(stat('ทั้งหมด')).toContain('43 รายชื่อ');
    // จับคู่งานมีช่อง "ทั้งสองทาง"
    expect(stat('ทั้งสองทาง')).toContain('0');
    await waitFor(() => expect(fetchHomeAiShareDetail).toHaveBeenCalledWith('matching', win));
    expect(window.localStorage.getItem(BLOCK_STORE)).toBe('matching');
  });

  it('เปิดหน้ามาใหม่ = หัวข้อที่เลือกไว้ล่าสุด · ค่าที่อ่านไม่ออก = ติดตาม', async () => {
    window.localStorage.setItem(BLOCK_STORE, 'applicants');
    render(<HomeAiSharePage />);
    expect(await screen.findByRole('heading', { name: 'ผู้สมัครในกล่องงาน' })).toBeTruthy();
    cleanup();
    window.localStorage.setItem(BLOCK_STORE, 'ไม่มีหัวข้อนี้');
    render(<HomeAiSharePage />);
    expect(await screen.findByRole('heading', { name: 'ติดตาม' })).toBeTruthy();
  });

  it('เทียบกับช่วงก่อน: ชิปขึ้นลง + ยอดของช่วงก่อน (รอบ 4)', async () => {
    fetchHomeAiShare.mockResolvedValue(
      body({
        previous: {
          from: '2026-09-17',
          to: '2026-09-23',
          label: '7 วันก่อนหน้า',
          follow: { total: 257, ai: 250, staff: 0, both: 0, notCalled: 7 },
          aftercare: null,
          applicants: { total: 1, ai: 1, staff: 0, both: 0, notCalled: 0 },
          matching: null,
        },
      }),
    );
    render(<HomeAiSharePage />);
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('7 วันก่อนหน้า 257'));
    // รอบ 8: ชิปเป็น % ที่เปลี่ยนจากช่วงก่อน (countPill ตัวเดียวกับหน้าทีม Online) — AI 205 เทียบ 250 ⇒ 18.0% · ทั้งหมด 205 เทียบ 257 ⇒ 20.2%
    expect(stat('AI โทร')).toContain('18.0%');
    expect(stat('ทั้งหมด')).toContain('20.2%');
    // ยังไม่โทร 0 เทียบ 7 ⇒ 100.0% · คนโทร 0 เทียบ 0 ⇒ 0%
    expect(stat('ยังไม่โทร')).toContain('100.0%');
    expect(stat('คนโทร')).toContain('0%');
    // ของเดิมถอดแล้ว: "−45 จาก 7 วันก่อนหน้า" และชิป "จุด"
    expect(screen.queryByText(/−45/)).toBeNull();
    expect(screen.queryByText(/จุด/)).toBeNull();
  });

  it('หัวข้อที่ยังไม่มีสายเลย = กล่องเป็น 0 (ป้ายหนักไปทางไหนถอดแล้ว)', async () => {
    window.localStorage.setItem(BLOCK_STORE, 'aftercare');
    render(<HomeAiSharePage />);
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('0 รายชื่อ'));
    expect(stat('AI โทร')).toContain('0%');
    expect(screen.queryByText('ยังไม่มีงาน')).toBeNull();
  });

  it('ฐานยังไม่มีช่องลงผลของคนโทร = บอกบนจอ', async () => {
    fetchHomeAiShare.mockResolvedValue(body({ follow_staff_ready: false }));
    render(<HomeAiSharePage />);
    expect(await screen.findByText(/ยังนับรายชื่อที่คนโทรไม่ได้/)).toBeTruthy();
  });

  it('🔴 มีสายแต่ยังไม่มีที่โทรแล้ว = ตัวเลือกบอก "AI —" ไม่ใช่ 0%', async () => {
    fetchHomeAiShare.mockResolvedValue(
      body({ follow: { total: 3, ai: 0, staff: 0, both: 0, notCalled: 3, waitingAi: 3, waitingStaff: 0 } }),
    );
    render(<HomeAiSharePage />);
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('3 รายชื่อ'));
    // แถบของกล่อง = % ของทั้งหมด ⇒ ยังไม่โทร 100%
    expect(stat('ยังไม่โทร')).toContain('100%');
    openPicker();
    expect((await screen.findByRole('option', { name: /ติดตาม/ })).textContent).toContain('AI —');
  });

  it('หัวข้อที่ล้มบอกเหตุ · ตัวเลือกของหัวข้อนั้นบอกว่าโหลดไม่ขึ้น', async () => {
    window.localStorage.setItem(BLOCK_STORE, 'applicants');
    fetchHomeAiShare.mockResolvedValue(
      body({ applicants: null, errors: { applicants: 'โหลดตัวเลขส่วนนี้ไม่ขึ้น ลองรีเฟรชอีกครั้ง' } }),
    );
    render(<HomeAiSharePage />);
    expect(await screen.findByText('โหลดตัวเลขส่วนนี้ไม่ขึ้น ลองรีเฟรชอีกครั้ง')).toBeTruthy();
    openPicker();
    expect((await screen.findByRole('option', { name: /ผู้สมัครในกล่องงาน/ })).textContent).toContain('โหลดไม่ขึ้น');
    expect(screen.getByRole('option', { name: /ติดตาม/ }).textContent).toContain('AI 100%');
  });

  it('🔴 แผงเลื่อน + ปุ่ม "ดูทั้งหมด" ถอดแล้ว (เจ้าของสั่ง 30 ก.ย.) — กดแท่งรายวันไม่มีอะไรเด้ง', async () => {
    render(<HomeAiSharePage />);
    const chart = await screen.findByRole('img', { name: 'ติดตาม ยอดใช้งานรายวัน' });
    expect(chart.getAttribute('data-clickable')).toBe('no');
    fireEvent.click(within(chart).getByRole('button', { name: `แท่ง ${win.to}` }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'ดูทั้งหมด' })).toBeNull();
  });

  it('สวิตช์ "แยก BU": ค่าตั้งต้นแท่งแบ่ง AI/คน/ยังไม่โทร · กดแล้วเป็นแต่ละ BU · กดอีกทีกลับ', async () => {
    render(<HomeAiSharePage />);
    const chart = await screen.findByRole('img', { name: 'ติดตาม ยอดใช้งานรายวัน' });
    // ติดตามไม่มี "ทั้งสองทาง"
    expect(chart.getAttribute('data-stacks')).toBe('AI โทร|คนโทร|ยังไม่โทร');
    expect(chart.getAttribute('data-flip')).toBe('segments');
    const sw = screen.getByRole('switch', { name: 'แยก BU' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    const byBu = await screen.findByRole('img', { name: 'ติดตาม ยอดใช้งานรายวัน แยก BU' });
    // รอบ 17: ครบทุก BU รอไว้ (ไม่ใช่เฉพาะที่มีงาน) เรียงตามชุดแผนก · ตัวจุดพลิกไพ่เปลี่ยน (รอบ 12)
    expect(byBu.getAttribute('data-stacks')).toBe(AI_SHARE_BUS.join('|'));
    expect(byBu.getAttribute('data-flip')).toBe('bu');
    fireEvent.click(sw);
    expect((await screen.findByRole('img', { name: 'ติดตาม ยอดใช้งานรายวัน' })).getAttribute('data-stacks')).toBe('AI โทร|คนโทร|ยังไม่โทร');
  });

  it('รอบ 17: กล่องเรียง ทั้งหมด → AI โทร → คนโทร → (ทั้งสองทาง) → ยังไม่โทร · กล่องที่เป็น 0 กดไม่ได้', async () => {
    render(<HomeAiSharePage />);
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    const names = () =>
      screen
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? '')
        .filter((n) => /^(ทั้งหมด|AI โทร|คนโทร|ทั้งสองทาง|ยังไม่โทร) \d/.test(n));
    expect(names()).toEqual(['ทั้งหมด 205 รายชื่อ', 'AI โทร 205', 'คนโทร 0', 'ยังไม่โทร 0']);
    expect((tileOf('AI โทร') as HTMLButtonElement).disabled).toBe(false);
    expect((tileOf('คนโทร') as HTMLButtonElement).disabled).toBe(true);
    // จับคู่งานมีทั้งสองทาง — อยู่ก่อนยังไม่โทร
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /จับคู่งาน/ }));
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('43 รายชื่อ'));
    expect(names()).toEqual(['ทั้งหมด 43 รายชื่อ', 'AI โทร 40', 'คนโทร 0', 'ทั้งสองทาง 0', 'ยังไม่โทร 3']);
  });

  it('รอบ 17: กดกล่อง = Popup รายชื่อของกล่องนั้น (ช่วงเดียวกับหน้า) · ชื่อ · BU · วันที่ · เปลี่ยนหน้าได้', async () => {
    render(<HomeAiSharePage />);
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    fireEvent.click(tileOf('AI โทร'));
    const dlg = await screen.findByRole('dialog');
    expect(fetchHomeAiShareList).toHaveBeenCalledWith('follow', 'ai', 0, win);
    expect(within(dlg).getByText('ติดตาม · 7 วันล่าสุด')).toBeTruthy();
    expect(await within(dlg).findByText('ผู้รับสาย 1')).toBeTruthy();
    // กล่องก้อนเดียว = ไม่ต้องมีคอลัมน์สถานะ · ไม่มีชื่อ/ไม่รู้ BU บอกตรง ๆ
    expect(within(dlg).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['ชื่อ', 'BU', 'วันที่']);
    expect(within(dlg).getByText('ไม่มีชื่อ')).toBeTruthy();
    expect(within(dlg).getByText('ไม่ระบุ')).toBeTruthy();
    expect(within(dlg).getByText('แสดง 1–20 จาก 45 รายชื่อ')).toBeTruthy();
    expect(within(dlg).getByText('หน้า 1 / 3')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'ถัดไป' }));
    await waitFor(() => expect(fetchHomeAiShareList).toHaveBeenLastCalledWith('follow', 'ai', 1, win));
    expect(await within(dlg).findByText('ผู้รับสาย 21')).toBeTruthy();
    expect(within(dlg).getByText('หน้า 2 / 3')).toBeTruthy();
    // 🔴 ไม่มีเบอร์โทรในป๊อป
    expect(dlg.textContent ?? '').not.toMatch(/0\d{8,9}|\+66/);
  });

  it('รอบ 17: กล่อง "ทั้งหมด" = ทุกก้อน + คอลัมน์สถานะว่าอยู่ก้อนไหน · เปิดใหม่เริ่มหน้าแรก', async () => {
    render(<HomeAiSharePage />);
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    fireEvent.click(tileOf('ทั้งหมด'));
    let dlg = await screen.findByRole('dialog');
    expect(fetchHomeAiShareList).toHaveBeenLastCalledWith('follow', 'total', 0, win);
    await within(dlg).findByText('ผู้รับสาย 1');
    expect(within(dlg).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['ชื่อ', 'BU', 'วันที่', 'สถานะ']);
    expect(within(dlg).getAllByText('AI โทร').length).toBeGreaterThan(0);
    expect(within(dlg).getAllByText('ยังไม่โทร').length).toBeGreaterThan(0);
    fireEvent.click(within(dlg).getByRole('button', { name: 'ถัดไป' }));
    await within(dlg).findByText('หน้า 2 / 3');
    fireEvent.keyDown(dlg, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    fireEvent.click(tileOf('ทั้งหมด'));
    dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByText('หน้า 1 / 3')).toBeTruthy();
    expect(fetchHomeAiShareList).toHaveBeenLastCalledWith('follow', 'total', 0, win);
  });

  it('รอบ 17: ไม่มีสิทธิ์ดูรายชื่อ = Popup บอกเหตุ ไม่ใช่หน้าว่าง', async () => {
    fetchHomeAiShareList.mockRejectedValue(new Error('บัญชีนี้ยังไม่มีสิทธิ์ดูรายชื่อส่วนนี้'));
    render(<HomeAiSharePage />);
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    fireEvent.click(tileOf('AI โทร'));
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByText('บัญชีนี้ยังไม่มีสิทธิ์ดูรายชื่อส่วนนี้')).toBeTruthy();
  });

  it('รอบ 8: แถว "AI 100% ของสายที่โทรแล้ว" ถอดแล้ว · ยอดเป็นกล่อง Visual Control มีแถบ % ของทั้งหมด', async () => {
    render(<HomeAiSharePage />);
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    expect(screen.queryByText('AI 100%')).toBeNull();
    expect(screen.queryByText('ของสายที่โทรแล้ว')).toBeNull();
    // ติดตาม 205 สาย AI โทรทั้งหมด ⇒ แถบ AI 100% · คน/ยังไม่โทร 0%
    expect(stat('AI โทร')).toContain('100%');
    expect(stat('คนโทร')).toContain('0%');
    expect(stat('ยังไม่โทร')).toContain('0%');
    // ไม่มีช่วงก่อน ⇒ ไม่มีชิปเทียบ
    expect(stat('AI โทร')).not.toContain('ใหม่');
  });

  it('รอบ 18: เลือกหลายเดือนบนปฏิทิน (กดยืนยันก่อน) = หนึ่งแท่งต่อเดือน · กดแท่งลงไปดูรายวัน · ปุ่มกลับขึ้นชั้นเดิม', async () => {
    // เส้นตอบตามช่วงที่ขอ (หน้าใช้เลขเฉพาะชุดที่ตรงกับช่วงที่เลือก)
    fetchHomeAiShare.mockImplementation((w: { from: string | null; to: string | null }) => Promise.resolve(body({ from: w.from, to: w.to })));
    fetchHomeAiShareDetail.mockImplementation((block: AiShareDetailResponse['block'], w: { from: string | null; to: string | null }) =>
      Promise.resolve({ ...detail(block), from: w.from, to: w.to }),
    );
    render(<HomeAiSharePage />);
    await screen.findByRole('img', { name: 'ติดตาม ยอดใช้งานรายวัน' });
    fireEvent.click(screen.getByRole('button', { name: /ช่วงเวลา/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'เดือน' }));
    fireEvent.click(screen.getByRole('button', { name: 'สิงหาคม 2569' }));
    fireEvent.click(screen.getByRole('button', { name: 'กันยายน 2569' }));
    // ยังไม่ยืนยัน = ยังไม่โหลดช่วงใหม่
    expect(fetchHomeAiShare).not.toHaveBeenCalledWith(expect.objectContaining({ from: '2026-08-01' }));
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยัน' }));
    await waitFor(() => expect(fetchHomeAiShare).toHaveBeenLastCalledWith({ from: '2026-08-01', to: '2026-09-30', unit: 'month' }));
    const monthly = await screen.findByRole('img', { name: 'ติดตาม ยอดใช้งานรายเดือน' });
    expect(monthly.getAttribute('data-clickable')).toBe('yes');
    expect(within(monthly).getAllByRole('button').map((b) => b.textContent)).toEqual(['แท่ง 2026-08-01', 'แท่ง 2026-09-01']);
    expect(screen.getByText(rangeTextFull('2026-08-01', '2026-09-30'))).toBeTruthy();
    // กดแท่งกันยายน = ลงไปดูรายวันของกันยายน
    fireEvent.click(within(monthly).getByRole('button', { name: 'แท่ง 2026-09-01' }));
    const daily = await screen.findByRole('img', { name: 'ติดตาม ยอดใช้งานรายวัน' });
    expect(within(daily).getAllByRole('button')).toHaveLength(30);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(rangeTextFull('2026-09-01', '2026-09-30'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'กลับ' }));
    expect(await screen.findByRole('img', { name: 'ติดตาม ยอดใช้งานรายเดือน' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'กลับ' })).toBeNull();
  });

  it('รอบ 18: แผง "ผลโทร" ปิดไว้เป็นค่าตั้งต้น อยู่ก่อน "ใครอยู่ในระบบ" · แถบหัวบอกมีผลกี่สาย · กดแล้วกางเห็นผลแต่ละแบบ', async () => {
    render(<HomeAiSharePage />);
    const bar = await screen.findByRole('button', { name: /^ผลโทร/ });
    expect(bar.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(bar.textContent).toContain('ติดตาม · มีผล 207 รายชื่อ'));
    expect(fetchHomeAiShareResults).toHaveBeenCalledWith('follow', win);
    const presenceHead = screen.getByRole('button', { name: /^ใครอยู่ในระบบ/ });
    expect(bar.compareDocumentPosition(presenceHead) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'ผลโทร ติดตาม' })).toBeNull();
    fireEvent.click(bar);
    const list = screen.getByRole('list', { name: 'ผลโทร ติดตาม' });
    const rows = within(list).getAllByRole('listitem').map((li) => li.textContent ?? '');
    // เรียงตามที่เจ้าของไล่: โทรแล้วไป → รับแล้ววาง → รับแล้วไม่ไป (ป้ายจากพจนานุกรมเมตริก)
    expect(rows.slice(0, 3).map((t) => t.replace(/[\d,]+%?/g, '').trim())).toEqual(['บอกว่าไป', 'รับแล้วเงียบ', 'บอกว่าไม่ไป']);
    expect(rows[0]).toContain('155');
    expect(within(list).getAllByRole('listitem')).toHaveLength(7);
    // จับคู่งานถาม "สนใจไหม"
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /จับคู่งาน/ }));
    await waitFor(() => expect(fetchHomeAiShareResults).toHaveBeenLastCalledWith('matching', win));
    expect(await screen.findByText('ตอบว่าสนใจ')).toBeTruthy();
  });

  it('รอบ 18: หน่วยเป็น "รายชื่อ" ทุกหัวข้อ — ไม่เหลือ สาย/ใบ/คน บนกล่อง', async () => {
    render(<HomeAiSharePage />);
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /ผู้สมัครในกล่องงาน/ }));
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('78 รายชื่อ'));
    expect(stat('ทั้งหมด')).not.toMatch(/\d (สาย|ใบ|คน)\b/);
  });

  it('รอบ 18: ช่องไฟ + ระยะบรรทัดเท่ากันทั้งหน้าและในป๊อปรายชื่อ', async () => {
    const { container } = render(<HomeAiSharePage />);
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    const root = container.firstElementChild as HTMLElement;
    for (const c of EVEN_TYPE.split(' ')) expect(root.classList.contains(c)).toBe(true);
    fireEvent.click(tileOf('AI โทร'));
    const dlg = await screen.findByRole('dialog');
    for (const c of EVEN_TYPE.split(' ')) expect(dlg.classList.contains(c)).toBe(true);
  });

  /** แถบหัวของ "ใครอยู่ในระบบ" — ปิดไว้เป็นค่าตั้งต้น กดแล้วกาง (รอบ 6) */
  const presenceBar = () => screen.findByRole('button', { name: /^ใครอยู่ในระบบ/ });

  it('ใครอยู่ในระบบปิดไว้เป็นค่าตั้งต้น · แถบหัวบอก Online กี่คน · กดแล้วกาง กรอง Online ได้ · กดอีกทีซ่อน', async () => {
    render(<HomeAiSharePage />);
    const bar = await presenceBar();
    expect(bar.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(bar.textContent).toContain('Online 1 จาก 3'));
    expect(screen.queryByText('คนหนึ่ง')).toBeNull();
    fireEvent.click(bar);
    expect(bar.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('คนหนึ่ง')).toBeTruthy();
    expect(screen.getByText('คนสาม')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^Online 1/ }));
    expect(screen.queryByText('คนสาม')).toBeNull();
    expect(screen.getByText('คนหนึ่ง')).toBeTruthy();
    fireEvent.click(bar);
    expect(screen.queryByText('คนหนึ่ง')).toBeNull();
  });

  it('แยก BU ด้วย dropdown: เลือก BU แล้วเหลือแค่คนของ BU นั้น ปุ่มสถานะนับตาม BU นั้น', async () => {
    render(<HomeAiSharePage />);
    fireEvent.click(await presenceBar());
    await screen.findByText('คนสอง');
    const picker = () => screen.getByRole('combobox', { name: 'เลือก BU' });
    expect(picker().textContent).toContain('ทุก BU');
    fireEvent.click(picker());
    expect((await screen.findByRole('option', { name: /ทุก BU/ })).textContent).toContain('Online 1 จาก 3');
    expect(screen.getByRole('option', { name: /^LBD/ }).textContent).toContain('Online 1 จาก 1');
    fireEvent.click(screen.getByRole('option', { name: /^LBA/ }));
    expect(picker().textContent).toContain('LBA');
    expect(screen.getByText('คนสอง')).toBeTruthy();
    expect(screen.queryByText('คนหนึ่ง')).toBeNull();
    expect(screen.getByRole('button', { name: 'ทั้งหมด 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Offline 1/ })).toBeTruthy();
    fireEvent.click(picker());
    fireEvent.click(await screen.findByRole('option', { name: /ทุก BU/ }));
    expect(screen.getByText('คนหนึ่ง')).toBeTruthy();
  });

  it('บัญชีที่ล็อกแผนก (เห็น BU เดียว) ไม่มี dropdown BU', async () => {
    const lbd = presence.by_bu![0];
    fetchHomePresence.mockResolvedValue({ ...presence, bu: 'LBD', counts: lbd.counts, by_bu: [lbd], people: [presence.people![0]] });
    render(<HomeAiSharePage />);
    fireEvent.click(await presenceBar());
    expect(await screen.findByText('คนหนึ่ง')).toBeTruthy();
    expect(screen.queryByRole('combobox', { name: 'เลือก BU' })).toBeNull();
  });

  it('คนที่ไม่มีสิทธิ์เห็นชื่อ = เห็นแค่ยอด แต่ยังแยก BU ได้', async () => {
    fetchHomePresence.mockResolvedValue({ ...presence, people: null, can_see_people: false });
    render(<HomeAiSharePage />);
    fireEvent.click(await presenceBar());
    expect(await screen.findByText('รายชื่อเปิดให้หัวหน้ากับผู้ดูแลเห็น')).toBeTruthy();
    expect(screen.getByText('Online 1')).toBeTruthy();
    expect(screen.queryByText('คนหนึ่ง')).toBeNull();
    fireEvent.click(screen.getByRole('combobox', { name: 'เลือก BU' }));
    fireEvent.click(await screen.findByRole('option', { name: /^LM/ }));
    expect(screen.getByText('Online 0')).toBeTruthy();
    expect(screen.getByText('ยังไม่เข้าระบบ 1')).toBeTruthy();
  });
});
