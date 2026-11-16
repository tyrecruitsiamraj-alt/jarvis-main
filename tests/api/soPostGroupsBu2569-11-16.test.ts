/**
 * การ์ด "5. โพสต์ลงกลุ่ม Facebook" — BU ที่ส่งไป So Scraping + meta.bu (เจ้าของ 16 พ.ย. 2569)
 * อาการ: Administrator เห็น "ทุก BU" แต่ได้แค่ SN 277 แถว (จริง 1,701 · LBD 1,424) เพราะเซิร์ฟเวอร์ใช้ BU แรกในสิทธิ์
 * ข้อเคาะ 10 พ.ย. "เห็นเฉพาะ BU ตัวเอง" ยังอยู่ — ขอ BU นอกสิทธิ์ไม่ได้
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DepartmentScope } from '../../api/_lib/departmentScope';

let scope: DepartmentScope = { mode: 'all' };
const fetchSoPostGroups = vi.fn();
const fetchAllSoPostGroupRows = vi.fn();

vi.mock('../../api/_lib/http.js', async (orig) => ({ ...(await orig<typeof import('../../api/_lib/http.js')>()), withRbac: (h: unknown) => h }));
vi.mock('../../api/_lib/departmentScope.js', async (orig) => ({
  ...(await orig<typeof import('../../api/_lib/departmentScope.js')>()),
  loadMatchingBuScope: async () => scope,
}));
vi.mock('../../api/_lib/soPostGroups.js', () => ({
  fetchSoPostGroups: (...a: unknown[]) => fetchSoPostGroups(...a),
  fetchAllSoPostGroupRows: (...a: unknown[]) => fetchAllSoPostGroupRows(...a),
  SoPostGroupsError: class extends Error {},
}));

const { soPostGroupsHandler } = await import('../../api/_handlers/so-post-groups');
const { soPostBuPicker } = await import('../../src/components/dashboard-trends/stuck/SoPostGroupsCard');

const EMPTY = { from: '2026-11-01', to: '2026-11-16', bu: null, page: 1, pages: 1, total: 0, statuses: [], reasonGroups: [], counts: {}, rows: [] };

async function call(query: Record<string, string>) {
  let status = 0;
  let body: { meta?: { bu: string | null; choices: string[] | null; allowAll: boolean } } = {};
  const res = {
    setHeader: () => {},
    status: (s: number) => {
      status = s;
      return { json: (b: typeof body) => (body = b) };
    },
  };
  await soPostGroupsHandler(
    { method: 'GET', query: { from: '2026-11-01', to: '2026-11-16', ...query }, user: { sub: '115ac4b3-df86-4fd0-930e-0213651bd02f', role: 'admin' } } as never,
    res as never,
  );
  const sent = fetchSoPostGroups.mock.calls.at(-1)?.[0] as { bu: string | null } | undefined;
  return { status, meta: body.meta, sentBu: sent ? sent.bu : undefined };
}

beforeEach(() => {
  fetchSoPostGroups.mockReset().mockResolvedValue(EMPTY);
  fetchAllSoPostGroupRows.mockReset();
});

describe('สิทธิ์ทุก BU', () => {
  it('admin ไม่ผูก BU: ไม่เลือก = ไม่ส่ง bu · เลือก LBD = ส่ง LBD', async () => {
    scope = { mode: 'all' };
    expect(await call({})).toMatchObject({ status: 200, sentBu: null, meta: { bu: null, allowAll: true } });
    expect(await call({ bu: 'LBD' })).toMatchObject({ sentBu: 'LBD', meta: { bu: 'LBD' } });
  });
  it('Administrator BU หลัก SN + ดูเพิ่มครบ 5 BU = ทุก BU (เคสจริง 16 พ.ย.) · เลือก SN = SN', async () => {
    scope = { mode: 'code', code: 'SN', codes: ['SN', 'DS', 'LM', 'LBA', 'LBD'] };
    expect(await call({})).toMatchObject({ sentBu: null, meta: { bu: null, allowAll: true, choices: ['SN', 'DS', 'LM', 'LBA', 'LBD'] } });
    expect(await call({ bu: 'sn' })).toMatchObject({ sentBu: 'SN', meta: { bu: 'SN' } });
  });
});

describe('สิทธิ์หลาย BU (ไม่ครบ)', () => {
  it('ไม่เลือก = BU แรก · เลือก BU ในสิทธิ์ = BU นั้น · ขอ BU นอกสิทธิ์ = BU แรก (ไม่หลุดสิทธิ์)', async () => {
    scope = { mode: 'code', code: 'LBD', codes: ['LBD', 'LBA'] };
    expect(await call({})).toMatchObject({ sentBu: 'LBD', meta: { bu: 'LBD', choices: ['LBD', 'LBA'], allowAll: false } });
    expect(await call({ bu: 'LBA' })).toMatchObject({ sentBu: 'LBA', meta: { bu: 'LBA' } });
    expect(await call({ bu: 'SN' })).toMatchObject({ sentBu: 'LBD', meta: { bu: 'LBD' } });
  });
});

describe('สิทธิ์ BU เดียว', () => {
  it('ล็อก BU นั้น ไม่มีตัวเลือก · ขอ BU อื่นก็ได้ BU ตัวเอง', async () => {
    scope = { mode: 'code', code: 'LBD', codes: ['LBD'] };
    expect(await call({})).toMatchObject({ sentBu: 'LBD', meta: { bu: 'LBD', choices: null, allowAll: false } });
    expect(await call({ bu: 'SN' })).toMatchObject({ sentBu: 'LBD', meta: { bu: 'LBD' } });
  });
  it('ไม่มี BU = ไม่ดึง So Scraping เลย', async () => {
    scope = { mode: 'none' };
    expect(await call({})).toMatchObject({ status: 200, sentBu: undefined, meta: { bu: null, choices: null } });
  });
});

describe('ตัวเลือก BU บนการ์ด (รู้ตั้งแต่เปิดหน้า)', () => {
  it('ครบทุก BU = มี "ทุก BU" · หลาย BU ไม่ครบ = ทีละ BU · BU เดียว = ไม่มีตัวเลือก', () => {
    expect(soPostBuPicker(null, ['SN', 'DS', 'LM', 'LBA', 'LBD'])).toEqual({ choices: ['SN', 'DS', 'LM', 'LBA', 'LBD'], allowAll: true });
    expect(soPostBuPicker(null, null)).toEqual({ choices: ['SN', 'DS', 'LM', 'LBA', 'LBD'], allowAll: true });
    expect(soPostBuPicker(null, ['LBD', 'LBA'])).toEqual({ choices: ['LBD', 'LBA'], allowAll: false });
    expect(soPostBuPicker('LBD', null)).toBeNull();
  });
});
