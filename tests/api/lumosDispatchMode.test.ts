// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_LUMOS_DISPATCH_MODE,
  LUMOS_DISPATCH_TRIGGERS,
  isLumosDispatchMode,
  isLumosDispatchTrigger,
  modesForTrigger,
  normalizeLumosDispatchMode,
} from '../../src/lib/lumosDispatchMode';

describe('ความหมายของโหมดส่งงานให้ Lumos', () => {
  it('ค่าเริ่มต้นต้อง manual ทุกจุด — เดาผิดทาง auto = โทรหาคนจริงโดยไม่มีใครสั่ง', () => {
    for (const t of LUMOS_DISPATCH_TRIGGERS) {
      expect(DEFAULT_LUMOS_DISPATCH_MODE[t]).toBe('manual');
    }
  });

  it('normalize: ค่าที่ไม่รู้จักกลับเป็น manual · คีย์แปลกถูกทิ้ง', () => {
    expect(normalizeLumosDispatchMode({ board_match: 'auto' })).toEqual({
      board_match: 'auto',
      irecruit_search: 'manual',
      follow_entry: 'manual',
      // จุดใหม่ 16 ส.ค. 2569 — เลนคัดสรรวิ่งขนาน (ค่าเริ่มต้นต้องเป็น manual เสมอ)
      selection_recall: 'manual',
    });
    expect(normalizeLumosDispatchMode({ board_match: 'AUTO' }).board_match).toBe('manual');
    expect(normalizeLumosDispatchMode({ ไม่รู้จัก: 'auto' })).toEqual(DEFAULT_LUMOS_DISPATCH_MODE);
  });

  it('normalize: ค่าเพี้ยนทุกรูปแบบไม่ทำให้พัง', () => {
    expect(normalizeLumosDispatchMode(null)).toEqual(DEFAULT_LUMOS_DISPATCH_MODE);
    expect(normalizeLumosDispatchMode(undefined)).toEqual(DEFAULT_LUMOS_DISPATCH_MODE);
    expect(normalizeLumosDispatchMode('auto')).toEqual(DEFAULT_LUMOS_DISPATCH_MODE);
    expect(normalizeLumosDispatchMode(123)).toEqual(DEFAULT_LUMOS_DISPATCH_MODE);
    expect(normalizeLumosDispatchMode([])).toEqual(DEFAULT_LUMOS_DISPATCH_MODE);
  });

  it('type guard รับเฉพาะค่าที่รู้จัก', () => {
    expect(isLumosDispatchTrigger('board_match')).toBe(true);
    expect(isLumosDispatchTrigger('อื่น')).toBe(false);
    expect(isLumosDispatchMode('manual')).toBe(true);
    expect(isLumosDispatchMode('auto')).toBe(true);
    // assist ถูกถอดทิ้ง 11 ส.ค. 2569 — ต้องไม่ถูกรับเป็นค่าที่ใช้ได้อีก
    expect(isLumosDispatchMode('assist')).toBe(false);
    expect(isLumosDispatchMode('draft')).toBe(false);
  });
});

// ── ฝั่งเก็บข้อมูล ─────────────────────────────────────────────────────────────

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
  isPgUndefinedTable: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { getLumosDispatchMode, isAutoDispatchEnabled, setLumosDispatchMode, clearLumosDispatchModeCache } =
  await import('../../api/_lib/lumosDispatchMode.js');

const undefinedTable = Object.assign(new Error('relation does not exist'), { code: '42P01' });

/**
 * โหมด assist (ระบบจัดชุด คนอนุมัติ) ถูกถอดทิ้ง 11 ส.ค. 2569 พร้อมลูปอนุมัติ
 *
 * ⚠️ **ค่าเก่าที่ค้างในตารางต้องตกเป็น `manual` ไม่ใช่ `auto`** — ตารางบนฐาน
 * ตั้งค่าไว้ก่อนหน้านี้ได้ ถ้า normalize ผิดทางจะกลายเป็น "ระบบโทรหาผู้สมัครเอง
 * โดยไม่มีใครสั่ง" ซึ่งกู้คืนไม่ได้ · นี่คือเหตุผลเดียวที่ยังต้องมีเทสต์เรื่อง assist
 */
describe('assist ที่ถอดทิ้งแล้ว — ค่าเก่าต้องตกเป็น manual', () => {
  it('ทุกจุดเลือกได้แค่ manual กับ auto', () => {
    for (const t of LUMOS_DISPATCH_TRIGGERS) {
      expect(modesForTrigger(t)).toEqual(['manual', 'auto']);
    }
  });

  it('ค่า assist ที่ค้างในตาราง → manual ทุกจุด (ห้ามเป็น auto)', () => {
    for (const t of LUMOS_DISPATCH_TRIGGERS) {
      expect(normalizeLumosDispatchMode({ [t]: 'assist' })[t]).toBe('manual');
    }
  });

  it('ทุกจุดต้องมี manual กับ auto เสมอ', () => {
    for (const t of LUMOS_DISPATCH_TRIGGERS) {
      expect(modesForTrigger(t)).toContain('manual');
      expect(modesForTrigger(t)).toContain('auto');
    }
  });
});

describe('lumosDispatchMode store', () => {
  beforeEach(() => {
    vi.mocked(dbQuery).mockReset();
    clearLumosDispatchModeCache();
  });

  it('อ่านค่าจาก DB แล้วแปลงตามกติกา', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [{ payload: { board_match: 'auto', irecruit_search: 'manual' } }],
    });
    await expect(getLumosDispatchMode()).resolves.toEqual({
      board_match: 'auto',
      irecruit_search: 'manual',
      follow_entry: 'manual',
      // จุดใหม่ 16 ส.ค. 2569 — เลนคัดสรรวิ่งขนาน (ค่าเริ่มต้นต้องเป็น manual เสมอ)
      selection_recall: 'manual',
    });
  });

  it('cache: เรียกซ้ำไม่ยิง DB อีก', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ payload: { board_match: 'auto' } }] });
    await getLumosDispatchMode();
    await getLumosDispatchMode();
    await isAutoDispatchEnabled('board_match');
    expect(vi.mocked(dbQuery)).toHaveBeenCalledTimes(1);
  });

  it('ตารางยังไม่ migrate = manual ทุกจุด ไม่โยน error (ห้ามเผลอส่ง auto)', async () => {
    vi.mocked(dbQuery).mockImplementationOnce(() => {
      throw undefinedTable;
    });
    await expect(getLumosDispatchMode()).resolves.toEqual(DEFAULT_LUMOS_DISPATCH_MODE);
    await expect(isAutoDispatchEnabled('board_match')).resolves.toBe(false);
  });

  it('DB ล้มด้วยเหตุอื่น = โยนต่อ (ไม่กลืนเงียบจนเข้าใจผิดว่าปิด auto)', async () => {
    vi.mocked(dbQuery).mockImplementationOnce(() => {
      throw Object.assign(new Error('connection refused'), { code: 'ECONNREFUSED' });
    });
    await expect(getLumosDispatchMode()).rejects.toThrow('connection refused');
  });

  it('isAutoDispatchEnabled ตอบตามค่าของจุดนั้น ไม่ปนกัน', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [{ payload: { board_match: 'auto', irecruit_search: 'manual', follow_entry: 'auto' } }],
    });
    await expect(isAutoDispatchEnabled('board_match')).resolves.toBe(true);
    await expect(isAutoDispatchEnabled('irecruit_search')).resolves.toBe(false);
    await expect(isAutoDispatchEnabled('follow_entry')).resolves.toBe(true);
  });

  it('เขียนค่าแล้วล้าง cache — ครั้งถัดไปอ่านค่าใหม่', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ payload: { board_match: 'manual' } }] });
    await getLumosDispatchMode();
    expect(vi.mocked(dbQuery)).toHaveBeenCalledTimes(1);

    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ payload: { board_match: 'auto' } }] });
    await setLumosDispatchMode(
      { board_match: 'auto', irecruit_search: 'manual', follow_entry: 'manual' },
      'admin@siamraj.com',
    );
    await expect(isAutoDispatchEnabled('board_match')).resolves.toBe(true);
    // insert + read ใหม่ = ต้องมีการยิง DB เพิ่ม (cache ถูกล้างจริง)
    expect(vi.mocked(dbQuery).mock.calls.length).toBeGreaterThan(2);
  });

  it('เขียนค่า: บันทึกชื่อคนที่เปลี่ยนไปด้วย (ไว้ตามหลังว่าใครเปิด auto)', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ payload: {} }] });
    await setLumosDispatchMode(DEFAULT_LUMOS_DISPATCH_MODE, 'admin@siamraj.com');
    const params = vi.mocked(dbQuery).mock.calls[0][1] as unknown[];
    expect(params[1]).toBe('admin@siamraj.com');
  });
});
