/**
 * หน้าหลักใหม่ "ระบบไปกี่ %" (30 ก.ย. 2569 · รอบ 5 เหลือ dropdown + แผงเดียว)
 * 🔴 ด่าน: เลือกหัวข้อจาก dropdown (ติดตาม · ดูแลหลังเริ่มงาน · ผู้สมัคร · จับคู่งาน) แล้วตัวเลข + กราฟเปลี่ยนตาม ·
 *    ตัวเลือกบอก AI % ของทุกหัวข้อ · จำหัวข้อไว้ในเครื่อง · ช่วงเริ่มที่ 7 วันล่าสุด ·
 *    เลขตัวใหญ่ = AI ÷ ที่โทรแล้ว · ยังไม่มีที่โทรแล้ว = "AI —" (ห้าม 0% ปลอม) ·
 *    ฐานยังไม่มีช่องลงผลของคนโทร = บอกบนจอ · หัวข้อที่ล้มบอกเหตุ ห้ามขึ้น 0 ·
 *    "ใครอยู่ในระบบ" ย้ายไป ตั้งค่า › ผู้ใช้งาน แล้ว (รอบ 19 · เทสต์อยู่ `src/pages/settings/UserPresence.test.tsx`) ·
 *    แผงเลื่อนตอนกดแท่ง + ปุ่ม "ดูทั้งหมด" ถอดแล้ว (เจ้าของสั่ง 30 ก.ย.) — แท่งรายวันกดไม่ได้ ·
 *    เลือกแบ่งแท่งตาม BU แล้วแท่งกราฟพลิกไพ่ (รอบ 12 · กล่องยอดไม่พลิกแล้ว) ·
 *    รอบ 17: กล่องเรียง ทั้งหมด → AI โทร → คนโทร → ยังไม่โทร · กดกล่อง = Popup รายชื่อ (กล่อง 0 กดไม่ได้) ·
 *    ปฏิทิน + dropdown อยู่ฝั่งซ้ายต่อจากชื่อหน้า · แยก BU ขึ้นครบทุก BU · หัวกราฟบอกเดือน + ช่วงวัน ·
 *    รอบ 18: เลือกหลายเดือนบนปฏิทิน (กดยืนยันก่อน) = หนึ่งแท่งต่อเดือน กดแท่งลงไปดูรายวัน มีปุ่มกลับ ·
 *    แผง "ผลโทร" ซ่อนไว้ · ช่องไฟ/ระยะบรรทัดเท่ากันทั้งหน้า (`EVEN_TYPE`) ·
 *    หน่วยบนจอเป็น "รายชื่อ" ทุกหัวข้อ (เจ้าของ: "เรานับจากรายชื่อ ต้องเป็นรายชื่อหมดเลย")
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONVEYOR_VAULT, conveyorLabel } from '@/lib/soRecruitNav';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  AI_SHARE_BUS,
  defaultAiShareWindow,
  type AiShareDetailResponse,
  type AiShareListKey,
  type AiShareListResponse,
  type AiShareResponse,
} from '@/lib/homeAiShare';
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
  // สรุปแบบบอท Lumos (7 ต.ค. 2569)
  fetchHomeLumosSummary: (w: { from: string | null; to: string | null }) =>
    Promise.resolve({
      generated_at: '2026-10-07T10:00:00.000Z',
      from: w.from,
      to: w.to,
      bu: null,
      follow: {
        ai: { total: 673, went: 469, notWent: 0, reschedule: 0, unclear: 15, waiting: 0, failed: 99, cancelled: 90 },
        staff: { total: 805, went: 77, notWent: 1, reschedule: 1, unclear: 0, waiting: 699, failed: 3, cancelled: 24 },
      },
      applicants: { total: 178, done: 100, waiting: 43, failed: 35, cancelled: 0 },
      backlog: 46,
      error: null,
    }),
  // เส้นทางติดตาม (7 ต.ค. 2569) — ช่วงเดียวกับที่ขอ · สองสาย คนเดียวกัน (AI ไป + คนโทร รอโทร)
  fetchFollowJourney: (w: { from: string | null; to: string | null }) =>
    Promise.resolve({
      generated_at: '2026-10-07T10:00:00.000Z',
      from: w.from,
      to: w.to,
      bu: null,
      events: [],
      error: null,
      rows: [
        { id: 'j1', person: 'p1', name: 'คนทดสอบ', unit: null, bu: null, at: '2026-10-07T02:00:00.000Z', ymd: '2026-10-07', team: 'main', caller: 'ai', result: 'agreed', job: null, replaceType: null },
        { id: 'j2', person: 'p1', name: 'คนทดสอบ', unit: null, bu: null, at: '2026-10-07T03:00:00.000Z', ymd: '2026-10-07', team: 'main', caller: 'manual', result: 'waiting', job: null, replaceType: null },
      ],
    }),
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
/** หัวข้อติดตามใช้ชื่อเดียวกับเมนู (4 ต.ค. 2569) */
const FOLLOW_TITLE = 'ติดตามคนเริ่มงาน / ติดตามส่งคนแทน';
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
});
afterEach(() => cleanup());

describe('หน้าหลัก "ระบบไปกี่ %"', () => {
  it('เริ่มที่ติดตาม · 7 วันล่าสุด · เลขตามที่เส้นส่งมา · กราฟของหัวข้อนั้นขึ้นเลย', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    expect(await screen.findByRole('heading', { name: FOLLOW_TITLE })).toBeTruthy();
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
    expect(await screen.findByRole('img', { name: `${FOLLOW_TITLE} ยอดใช้งานรายวัน` })).toBeTruthy();
    // รอบ 17: หัวกราฟบอกเดือน + ช่วงวันที่กำลังดู (แกนล่างเหลือเลขวัน)
    expect(screen.getByText(rangeTextFull(win.from!, win.to!))).toBeTruthy();
  });

  it('dropdown บอก AI % ของทุกหัวข้อ · เลือกแล้วตัวเลข + กราฟเปลี่ยนตาม · จำไว้ในเครื่อง', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
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
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    expect(await screen.findByRole('heading', { name: 'งานสรรหา' })).toBeTruthy();
    cleanup();
    window.localStorage.setItem(BLOCK_STORE, 'ไม่มีหัวข้อนี้');
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    expect(await screen.findByRole('heading', { name: FOLLOW_TITLE })).toBeTruthy();
  });

  // หัวข้อติดตามนับแบบแผนแล้ว (ไม่มีกล่องยังไม่โทร · 4 ต.ค. 2569) — เทสต์พฤติกรรมกล่องทั่วไปใช้ดูแลหลังเริ่มงานแทน
  it('เทียบกับช่วงก่อน: ชิปขึ้นลง + ยอดของช่วงก่อน (รอบ 4)', async () => {
    window.localStorage.setItem(BLOCK_STORE, 'aftercare');
    fetchHomeAiShare.mockResolvedValue(
      body({
        aftercare: { total: 205, ai: 205, staff: 0, both: 0, notCalled: 0, waitingAi: 0, waitingStaff: 0 },
        previous: {
          from: '2026-09-17',
          to: '2026-09-23',
          label: '7 วันก่อนหน้า',
          follow: null,
          aftercare: { total: 257, ai: 250, staff: 0, both: 0, notCalled: 7 },
          applicants: { total: 1, ai: 1, staff: 0, both: 0, notCalled: 0 },
          matching: null,
        },
      }),
    );
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
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
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('0 รายชื่อ'));
    expect(stat('AI โทร')).toContain('0%');
    expect(screen.queryByText('ยังไม่มีงาน')).toBeNull();
  });

  it('ฐานยังไม่มีช่องลงผลของคนโทร = บอกบนจอ (ดูแลหลังเริ่มงาน · ติดตามนับแบบแผนไม่พึ่งช่องนี้)', async () => {
    window.localStorage.setItem(BLOCK_STORE, 'aftercare');
    fetchHomeAiShare.mockResolvedValue(body({ follow_staff_ready: false, aftercare: { total: 205, ai: 205, staff: 0, both: 0, notCalled: 0, waitingAi: 0, waitingStaff: 0 } }));
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    expect(await screen.findByText(/ยังนับรายชื่อที่คนโทรไม่ได้/)).toBeTruthy();
  });

  it('🔴 มีสายแต่ยังไม่มีที่โทรแล้ว = ตัวเลือกบอก "AI —" ไม่ใช่ 0%', async () => {
    window.localStorage.setItem(BLOCK_STORE, 'aftercare');
    fetchHomeAiShare.mockResolvedValue(
      body({ aftercare: { total: 3, ai: 0, staff: 0, both: 0, notCalled: 3, waitingAi: 3, waitingStaff: 0 } }),
    );
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('3 รายชื่อ'));
    // แถบของกล่อง = % ของทั้งหมด ⇒ ยังไม่โทร 100%
    expect(stat('ยังไม่โทร')).toContain('100%');
    openPicker();
    expect((await screen.findByRole('option', { name: /ดูแลหลังเริ่มงาน/ })).textContent).toContain('AI —');
  });

  it('หัวข้อที่ล้มบอกเหตุ · ตัวเลือกของหัวข้อนั้นบอกว่าโหลดไม่ขึ้น', async () => {
    window.localStorage.setItem(BLOCK_STORE, 'applicants');
    fetchHomeAiShare.mockResolvedValue(
      body({ applicants: null, errors: { applicants: 'โหลดตัวเลขส่วนนี้ไม่ขึ้น ลองรีเฟรชอีกครั้ง' } }),
    );
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    expect(await screen.findByText('โหลดตัวเลขส่วนนี้ไม่ขึ้น ลองรีเฟรชอีกครั้ง')).toBeTruthy();
    openPicker();
    expect((await screen.findByRole('option', { name: /งานสรรหา/ })).textContent).toContain('โหลดไม่ขึ้น');
    expect(screen.getByRole('option', { name: /ติดตาม/ }).textContent).toContain('AI 100%');
  });

  it('🔴 แผงเลื่อน + ปุ่ม "ดูทั้งหมด" ถอดแล้ว (เจ้าของสั่ง 30 ก.ย.) — กดแท่งรายวันไม่มีป๊อปเด้ง', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    const chart = await screen.findByRole('img', { name: `${FOLLOW_TITLE} ยอดใช้งานรายวัน` });
    fireEvent.click(within(chart).getByRole('button', { name: `แท่ง ${win.to}` }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'ดูทั้งหมด' })).toBeNull();
  });

  it('🔴 หัวข้อติดตาม: กดแท่งรายวัน = แตกดูว่าเป็นรายชื่อติดตาม/ส่งคนแทน อย่างละ AI กี่ คนกี่ (4 ต.ค. 2569)', async () => {
    fetchHomeAiShareDetail.mockImplementation((block: AiShareDetailResponse['block']) =>
      Promise.resolve({
        ...detail(block),
        rows: [
          { day: win.to!, bu: 'LBD', total: 100, ai: 50, staff: 50, both: 0, notCalled: 0, teamReplacement: 30, teamReplacementAi: 0 },
        ],
      }),
    );
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    const chart = await screen.findByRole('img', { name: `${FOLLOW_TITLE} ยอดใช้งานรายวัน` });
    expect(chart.getAttribute('data-clickable')).toBe('yes');
    fireEvent.click(within(chart).getByRole('button', { name: `แท่ง ${win.to}` }));
    const box = screen.getByTestId('follow-team-breakdown');
    const text = (box.textContent ?? '').replace(/\s+/g, '');
    expect(text).toMatch(/ติดตามคนเริ่มงาน70\D*AIโทร50คนโทร20/);
    expect(text).toMatch(/ติดตามส่งคนแทน30\D*AIโทร0คนโทร30/);
    expect(within(box).getByRole('button', { name: 'ดูทั้งช่วง' })).toBeTruthy();
  });

  it('แบ่งแท่งตาม (ตัวเลือกเดียว 6 ต.ค. 2569): ค่าตั้งต้น ใครโทร · BU = แต่ละ BU · ทีม = สองแท็บ · กลับมาใครโทรได้', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    const chart = await screen.findByRole('img', { name: `${FOLLOW_TITLE} ยอดใช้งานรายวัน` });
    // ติดตามไม่มี "ทั้งสองทาง" · นับแบบแผน (4 ต.ค. 2569) ⇒ ไม่มีชั้น "ยังไม่โทร"
    expect(chart.getAttribute('data-stacks')).toBe('AI โทร|คนโทร');
    expect(chart.getAttribute('data-flip')).toBe('segments');
    // สวิตช์สองตัวเดิมถอดแล้ว (เจ้าของ: "ปุ่ม แยกทีม แยก Bu มันจะทำแยกกันมาทำไม")
    expect(screen.queryByRole('switch', { name: 'แยก BU' })).toBeNull();
    expect(screen.queryByRole('switch', { name: 'แยกทีม' })).toBeNull();
    const group = screen.getByRole('tablist', { name: 'แบ่งแท่งตาม' });
    const pick = (name: string) => fireEvent.mouseDown(within(group).getByRole('tab', { name }), { button: 0 });
    expect(within(group).getByRole('tab', { name: 'ใครโทร' }).getAttribute('aria-selected')).toBe('true');
    pick('BU');
    const byBu = await screen.findByRole('img', { name: `${FOLLOW_TITLE} ยอดใช้งานรายวัน แยก BU` });
    // รอบ 17: ครบทุก BU รอไว้ (ไม่ใช่เฉพาะที่มีงาน) เรียงตามชุดแผนก · ตัวจุดพลิกไพ่เปลี่ยน (รอบ 12)
    expect(byBu.getAttribute('data-stacks')).toBe(AI_SHARE_BUS.join('|'));
    expect(byBu.getAttribute('data-flip')).toBe('bu');
    pick('ทีม');
    const byTeam = await screen.findByRole('img', { name: `${FOLLOW_TITLE} ยอดใช้งานรายวัน แยกทีม` });
    expect(byTeam.getAttribute('data-stacks')).toBe('ติดตามคนเริ่มงาน|ติดตามส่งคนแทน');
    pick('ใครโทร');
    expect((await screen.findByRole('img', { name: `${FOLLOW_TITLE} ยอดใช้งานรายวัน` })).getAttribute('data-stacks')).toBe('AI โทร|คนโทร');
  });

  it('รอบ 17: กล่องเรียง ทั้งหมด → AI โทร → คนโทร → (ทั้งสองทาง) → ยังไม่โทร · กล่องที่เป็น 0 กดไม่ได้', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    const names = () =>
      screen
        .getAllByRole('button')
        .map((b) => b.getAttribute('aria-label') ?? '')
        .filter((n) => /^(ทั้งหมด|AI โทร|คนโทร|ทั้งสองทาง|ยังไม่โทร) \d/.test(n));
    // ติดตามนับแบบแผน (4 ต.ค. 2569): AI + คน = ทั้งหมด ⇒ ไม่มีกล่องยังไม่โทร
    expect(names()).toEqual(['ทั้งหมด 205 รายชื่อ', 'AI โทร 205', 'คนโทร 0']);
    expect((tileOf('AI โทร') as HTMLButtonElement).disabled).toBe(false);
    expect((tileOf('คนโทร') as HTMLButtonElement).disabled).toBe(true);
    // จับคู่งานมีทั้งสองทาง — อยู่ก่อนยังไม่โทร
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /จับคู่งาน/ }));
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('43 รายชื่อ'));
    expect(names()).toEqual(['ทั้งหมด 43 รายชื่อ', 'AI โทร 40', 'คนโทร 0', 'ทั้งสองทาง 0', 'ยังไม่โทร 3']);
  });

  it('รอบ 17: กดกล่อง = Popup รายชื่อของกล่องนั้น (ช่วงเดียวกับหน้า) · ชื่อ · BU · วันที่ · เปลี่ยนหน้าได้', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    // หัวข้อติดตาม กด AI โทร = ป๊อปแยกเรื่องแล้ว (7 ต.ค. 2569) ⇒ ป๊อปรายชื่อแบบเดิมดูที่จับคู่งาน
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /จับคู่งาน/ }));
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('43 รายชื่อ'));
    fireEvent.click(tileOf('AI โทร'));
    const dlg = await screen.findByRole('dialog');
    expect(fetchHomeAiShareList).toHaveBeenCalledWith('matching', 'ai', 0, win);
    expect(within(dlg).getByText('จับคู่งาน · 7 วันล่าสุด')).toBeTruthy();
    expect(await within(dlg).findByText('ผู้รับสาย 1')).toBeTruthy();
    // กล่องก้อนเดียว = ไม่ต้องมีคอลัมน์สถานะ · ไม่มีชื่อ/ไม่รู้ BU บอกตรง ๆ
    expect(within(dlg).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['ชื่อ', 'BU', 'วันที่']);
    expect(within(dlg).getByText('ไม่มีชื่อ')).toBeTruthy();
    expect(within(dlg).getByText('ไม่ระบุ')).toBeTruthy();
    expect(within(dlg).getByText('แสดง 1–20 จาก 45 รายชื่อ')).toBeTruthy();
    expect(within(dlg).getByText('หน้า 1 / 3')).toBeTruthy();
    fireEvent.click(within(dlg).getByRole('button', { name: 'ถัดไป' }));
    await waitFor(() => expect(fetchHomeAiShareList).toHaveBeenLastCalledWith('matching', 'ai', 1, win));
    expect(await within(dlg).findByText('ผู้รับสาย 21')).toBeTruthy();
    expect(within(dlg).getByText('หน้า 2 / 3')).toBeTruthy();
    // 🔴 ไม่มีเบอร์โทรในป๊อป
    expect(dlg.textContent ?? '').not.toMatch(/0\d{8,9}|\+66/);
  });

  it('รอบ 17: กล่อง "ทั้งหมด" = ทุกก้อน + คอลัมน์สถานะว่าอยู่ก้อนไหน · เปิดใหม่เริ่มหน้าแรก', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
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
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    fireEvent.click(tileOf('ทั้งหมด'));
    const dlg = await screen.findByRole('dialog');
    expect(await within(dlg).findByText('บัญชีนี้ยังไม่มีสิทธิ์ดูรายชื่อส่วนนี้')).toBeTruthy();
  });

  it('รอบ 8: แถว "AI 100% ของสายที่โทรแล้ว" ถอดแล้ว · ยอดเป็นกล่อง Visual Control มีแถบ % ของทั้งหมด', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    expect(screen.queryByText('AI 100%')).toBeNull();
    expect(screen.queryByText('ของสายที่โทรแล้ว')).toBeNull();
    // ติดตาม 205 สาย AI โทรทั้งหมด ⇒ แถบ AI 100% · คน 0% · ไม่มีกล่องยังไม่โทร (นับแบบแผน)
    expect(stat('AI โทร')).toContain('100%');
    expect(stat('คนโทร')).toContain('0%');
    expect(screen.queryByRole('button', { name: /^ยังไม่โทร \d/ })).toBeNull();
    // ไม่มีช่วงก่อน ⇒ ไม่มีชิปเทียบ
    expect(stat('AI โทร')).not.toContain('ใหม่');
  });

  it('รอบ 18: เลือกหลายเดือนบนปฏิทิน (กดยืนยันก่อน) = หนึ่งแท่งต่อเดือน · กดแท่งลงไปดูรายวัน · ปุ่มกลับขึ้นชั้นเดิม', async () => {
    // เส้นตอบตามช่วงที่ขอ (หน้าใช้เลขเฉพาะชุดที่ตรงกับช่วงที่เลือก)
    fetchHomeAiShare.mockImplementation((w: { from: string | null; to: string | null }) => Promise.resolve(body({ from: w.from, to: w.to })));
    fetchHomeAiShareDetail.mockImplementation((block: AiShareDetailResponse['block'], w: { from: string | null; to: string | null }) =>
      Promise.resolve({ ...detail(block), from: w.from, to: w.to }),
    );
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    await screen.findByRole('img', { name: `${FOLLOW_TITLE} ยอดใช้งานรายวัน` });
    fireEvent.click(screen.getByRole('button', { name: /ช่วงเวลา/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'เดือน' }));
    fireEvent.click(screen.getByRole('button', { name: 'สิงหาคม 2569' }));
    fireEvent.click(screen.getByRole('button', { name: 'กันยายน 2569' }));
    // ยังไม่ยืนยัน = ยังไม่โหลดช่วงใหม่
    expect(fetchHomeAiShare).not.toHaveBeenCalledWith(expect.objectContaining({ from: '2026-08-01' }));
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยัน' }));
    await waitFor(() => expect(fetchHomeAiShare).toHaveBeenLastCalledWith({ from: '2026-08-01', to: '2026-09-30', unit: 'month' }));
    const monthly = await screen.findByRole('img', { name: `${FOLLOW_TITLE} ยอดใช้งานรายเดือน` });
    expect(monthly.getAttribute('data-clickable')).toBe('yes');
    expect(within(monthly).getAllByRole('button').map((b) => b.textContent)).toEqual(['แท่ง 2026-08-01', 'แท่ง 2026-09-01']);
    expect(screen.getByText(rangeTextFull('2026-08-01', '2026-09-30'))).toBeTruthy();
    // กดแท่งกันยายน = ลงไปดูรายวันของกันยายน
    fireEvent.click(within(monthly).getByRole('button', { name: 'แท่ง 2026-09-01' }));
    const daily = await screen.findByRole('img', { name: `${FOLLOW_TITLE} ยอดใช้งานรายวัน` });
    expect(within(daily).getAllByRole('button')).toHaveLength(30);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText(rangeTextFull('2026-09-01', '2026-09-30'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'กลับ' }));
    expect(await screen.findByRole('img', { name: `${FOLLOW_TITLE} ยอดใช้งานรายเดือน` })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'กลับ' })).toBeNull();
  });

  it('รอบ 18: แผง "ผลโทร" ปิดไว้เป็นค่าตั้งต้น · แถบหัวบอกมีผลกี่รายชื่อ · กดแล้วกางเห็นผลแต่ละแบบ', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    const bar = await screen.findByRole('button', { name: /^ผลโทร/ });
    expect(bar.getAttribute('aria-expanded')).toBe('false');
    await waitFor(() => expect(bar.textContent).toContain(`${FOLLOW_TITLE} · มีผล 207 รายชื่อ`));
    expect(fetchHomeAiShareResults).toHaveBeenCalledWith('follow', win);
    // รอบ 19: "ใครอยู่ในระบบ" ย้ายไป ตั้งค่า › ผู้ใช้งาน แล้ว — หน้าหลักไม่มีแผงนี้
    expect(screen.queryByRole('button', { name: /^ใครอยู่ในระบบ/ })).toBeNull();
    expect(screen.queryByRole('list', { name: `ผลโทร ${FOLLOW_TITLE}` })).toBeNull();
    fireEvent.click(bar);
    const list = screen.getByRole('list', { name: `ผลโทร ${FOLLOW_TITLE}` });
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
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /งานสรรหา/ }));
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('78 รายชื่อ'));
    expect(stat('ทั้งหมด')).not.toMatch(/\d (สาย|ใบ|คน)\b/);
  });

  it('รอบ 18: ช่องไฟ + ระยะบรรทัดเท่ากันทั้งหน้าและในป๊อปรายชื่อ', async () => {
    const { container } = render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
    const root = container.firstElementChild as HTMLElement;
    for (const c of EVEN_TYPE.split(' ')) expect(root.classList.contains(c)).toBe(true);
    fireEvent.click(tileOf('AI โทร'));
    const dlg = await screen.findByRole('dialog');
    for (const c of EVEN_TYPE.split(' ')) expect(dlg.classList.contains(c)).toBe(true);
  });



  it('🔴 หัวข้อติดตาม: ไม่มีกล่องแยกทีมบนแถวตัวเลขแล้ว (มีกล่องแยกใต้กราฟแทน · 4 ต.ค. 2569)', async () => {
    fetchHomeAiShare.mockResolvedValue(
      body({ follow: { total: 58, ai: 31, staff: 27, both: 0, notCalled: 0, waitingAi: 0, waitingStaff: 0, teamReplacement: 27 } as never }),
    );
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(stat('ทั้งหมด')).toContain('58 รายชื่อ'));
    expect(stat('AI โทร')).toContain('31');
    expect(stat('คนโทร')).toContain('27');
    expect(screen.queryByTestId('ai-share-teams')).toBeNull();
    expect(screen.getByTestId('follow-team-breakdown')).toBeTruthy();
  });

  it('🔴 กดแท่งวันไหน ตัวเลขด้านบนวิ่งตามวันนั้น · กดซ้ำ/ดูทั้งช่วง = กลับช่วงเดิม (4 ต.ค. 2569)', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    const chart = await screen.findByRole('img', { name: `${FOLLOW_TITLE} ยอดใช้งานรายวัน` });
    await waitFor(() => expect(fetchHomeAiShare).toHaveBeenLastCalledWith(win));
    fireEvent.click(within(chart).getByRole('button', { name: `แท่ง ${win.to}` }));
    await waitFor(() => expect(fetchHomeAiShare).toHaveBeenLastCalledWith({ from: win.to, to: win.to }));
    fireEvent.click(within(screen.getByTestId('follow-team-breakdown')).getByRole('button', { name: 'ดูทั้งช่วง' }));
    await waitFor(() => expect(fetchHomeAiShare).toHaveBeenLastCalledWith(win));
  });

  it('🔴 คำในตัวเลือกหัวข้อ = คำในเมนู (เจ้าของสั่ง 4 ต.ค. 2569)', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    openPicker();
    const names = (await screen.findAllByRole('option')).map((o) => o.textContent ?? '');
    for (const label of [conveyorLabel('follow'), conveyorLabel('aftercare'), 'งานสรรหา', conveyorLabel('matching')]) {
      expect(names.some((n) => n.startsWith(label)), label).toBe(true);
    }
    expect(names.some((n) => n.includes('ผู้สมัครในกล่องงาน'))).toBe(false);
    expect(CONVEYOR_VAULT.find((v) => v.key === 'job-boxes')?.label).toBe('งานสรรหา');
  });
});

/**
 * 🔴 อัปเดตสด (เจ้าของ 6 ต.ค. 2569 "หน้าหลัก ต้องทำเป็น Interactive" → Choice "ตัวเลขอัปเดตเองสด ๆ")
 * ทุก 30 วิ ดึงเลข + กราฟใหม่เงียบ ๆ (ไม่ขึ้นโครงโหลด) · มีป้าย "สด · อัปเดต hh:mm:ss"
 */
describe('กดกล่อง AI โทร / คนโทร ของติดตาม (7 ต.ค. 2569)', () => {
  it('ป๊อปเดิมเปลี่ยนข้างใน: เรื่อง 2 แท็บ → ผลของเรื่อง (รวมทุกช่อง = ทั้งหมด) → รายชื่อ · กลับได้ทุกชั้น', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(stat('AI โทร')).toContain('205'));
    fireEvent.click(tileOf('AI โทร'));
    const dialog = await screen.findByTestId('caller-dialog');
    // ไม่ใช่ป๊อปรายชื่อแบบเดิม
    expect(fetchHomeAiShareList).not.toHaveBeenCalled();
    const main = await within(dialog).findByTestId('caller-topic-main');
    expect(within(dialog).getByTestId('caller-topic-replacement').textContent).toContain('ติดตามส่งคนแทน');
    expect(main.getAttribute('aria-label')).toBe('ติดตามคนเริ่มงาน 1 รายชื่อ');
    fireEvent.click(main);
    expect(within(dialog).getByTestId('caller-sum').textContent).toBe('โทรแล้ว 1 + ยกเลิก 0 + รอโทร 0 = 1 รายชื่อ');
    fireEvent.click(within(dialog).getByTestId('caller-col-went'));
    expect(within(dialog).getByText('คนทดสอบ')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /ติดตามคนเริ่มงาน/ }));
    expect(within(dialog).getByTestId('caller-topic')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: /ทุกเรื่อง/ }));
    expect(within(dialog).getByTestId('caller-topics')).toBeTruthy();
  });

  it('กดคนโทร = แบบเดียวกัน (นับเฉพาะสายที่คนโทร)', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    await waitFor(() => expect(stat('AI โทร')).toContain('205'));
    expect((tileOf('คนโทร') as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('แผงผลโทรของติดตาม = ตาราง AI โทร / คนโทร / รวม (7 ต.ค. 2569)', () => {
  it('ทุกแถว AI + คนโทร = รวม · แถวทั้งหมด = ผลรวม · สลับแท็บแล้วเลขตามแท็บ', async () => {
    fetchHomeAiShareResults.mockImplementation((block: AiShareResultsResponse['block'], w: { from: string | null; to: string | null }) => {
      const base = results(block, w);
      if (block !== 'follow') return Promise.resolve(base);
      const z = { went: 0, notWent: 0, noAnswer: 0, unclear: 0, waiting: 0, cancelled: 0 };
      return Promise.resolve({
        ...base,
        follow: {
          main: { ai: { ...z, went: 570, cancelled: 70, waiting: 3 }, staff: { ...z, went: 81, cancelled: 15 } },
          replacement: { ai: { ...z }, staff: { ...z, cancelled: 11, waiting: 689 } },
        },
      });
    });
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    const bar = await screen.findByRole('button', { name: /^ผลโทร/ });
    fireEvent.click(bar);
    const table = await screen.findByTestId('home-follow-results');
    const cells = (label: string) => {
      const row = within(table)
        .getAllByRole('row')
        .find((r) => (r.textContent ?? '').startsWith(label));
      return within(row!).getAllByRole('cell').map((c) => c.textContent ?? '').filter((t) => /^[\d,]+$/.test(t));
    };
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent).filter(Boolean)).toEqual(['ผล', 'AI โทร', 'คนโทร', 'รวม']);
    expect(cells('ตอบว่าไป')).toEqual(['570', '81', '651']);
    expect(cells('รอโทร')).toEqual(['3', '689', '692']);
    expect(cells('ทั้งหมด')).toEqual(['643', '796', '1,439']);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'ติดตามส่งคนแทน' }));
    await waitFor(() => expect(cells('ทั้งหมด')).toEqual(['0', '700', '700']));
    expect(cells('ตอบว่าไป')).toEqual(['0', '0', '0']);
  });
});

describe('เลขตามหัวข้อบอท Lumos ในการ์ดเดิม (7 ต.ค. 2569)', () => {
  it('ติดตาม = งานติดตาม 5 ช่อง · ผู้สมัคร = งานรับสมัคร + งานเก่า · บวกกันได้ทั้งหมด', async () => {
    render(<HomeAiSharePage />, { wrapper: MemoryRouter });
    const box = await screen.findByTestId('lumos-stats-follow');
    await waitFor(() => expect(within(box).getByTestId('lumos-follow-รวม').textContent).toContain('1,478'));
    // ทั้งคนและ AI (เจ้าของ "ต้องรู้ทั้งคนและ Ai") · แถวรวม = กล่องทั้งหมด
    const cells = (row: string) =>
      within(within(box).getByTestId(`lumos-follow-${row}`)).getAllByRole('cell').slice(1).map((c) => c.textContent);
    // ทั้งหมด · ไป · ไม่ไป · ขอเลื่อน · สรุปไม่ได้ · รอ · ล้มเหลว · ยกเลิก (มีผลการโทรแตก 4 ช่อง · เจ้าของ "แตกเลย")
    expect(cells('AI โทร')).toEqual(['673', '469', '0', '0', '15', '0', '99', '90']);
    expect(cells('คนโทร')).toEqual(['805', '77', '1', '1', '0', '699', '3', '24']);
    expect(cells('รวม')).toEqual(['1,478', '546', '1', '1', '15', '699', '102', '114']);
    expect(within(box).getByTestId('lumos-follow-sum').textContent).toBe(
      'AI 469 + 0 + 0 + 15 + 0 + 99 + 90 = 673 · คน 77 + 1 + 1 + 0 + 699 + 3 + 24 = 805',
    );
    expect(within(box).getByText('มีผลการโทร')).toBeTruthy();
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: new RegExp(CONVEYOR_VAULT.find((v) => v.key === 'job-boxes')!.label) }));
    const apps = await screen.findByTestId('lumos-stats-applicants');
    await waitFor(() => expect(within(apps).getByTestId('lumos-applicants-total').textContent).toContain('178'));
    expect(within(apps).getByTestId('lumos-applicants-sum').textContent).toBe('100 + 43 + 35 + 0 = 178');
    expect(within(apps).getByTestId('lumos-applicants-backlog').textContent).toContain('46');
    // หัวข้อที่บอทไม่มี = ไม่มีแถวนี้
    openPicker();
    fireEvent.click(await screen.findByRole('option', { name: /จับคู่งาน/ }));
    await screen.findByRole('heading', { name: 'จับคู่งาน' });
    expect(screen.queryByTestId('lumos-stats-matching')).toBeNull();
    expect(screen.queryByTestId('lumos-stats-follow')).toBeNull();
  });
});

describe('หน้าหลักอัปเดตสด', () => {
  it('ครบ 30 วิ ดึงเลขกับกราฟใหม่ · เลขใหม่ขึ้นโดยไม่หายไปเป็นโครงโหลด', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<HomeAiSharePage />, { wrapper: MemoryRouter });
      await waitFor(() => expect(stat('ทั้งหมด')).toContain('205 รายชื่อ'));
      expect(screen.getByTestId('home-live').textContent).toMatch(/^สด · อัปเดต /);
      const cards = fetchHomeAiShare.mock.calls.length;
      const charts = fetchHomeAiShareDetail.mock.calls.length;
      const next = body();
      next.follow = { ...next.follow!, total: 210, ai: 210 };
      fetchHomeAiShare.mockResolvedValue(next);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
      expect(fetchHomeAiShare.mock.calls.length).toBe(cards + 1);
      expect(fetchHomeAiShareDetail.mock.calls.length).toBe(charts + 1);
      // ระหว่างรอเลขใหม่ กล่องยังอยู่ (ไม่สลับเป็นโครงโหลด)
      expect(screen.queryByLabelText(/^กำลังโหลด/)).toBeNull();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
      await waitFor(() => expect(stat('ทั้งหมด')).toContain('210 รายชื่อ'));
    } finally {
      vi.useRealTimers();
    }
  });
});
