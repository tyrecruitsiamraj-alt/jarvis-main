// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_LUMOS_DISPATCH_MODE,
  LUMOS_DISPATCH_TRIGGERS,
  TRIGGERS_WITH_ASSIST,
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
    expect(isLumosDispatchMode('assist')).toBe(true);
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

describe('assist — มีเฉพาะจุดที่ระบบเป็นคนเริ่ม', () => {
  it('จุดที่ระบบเริ่มเองเลือก assist ได้', () => {
    for (const t of TRIGGERS_WITH_ASSIST) {
      expect(modesForTrigger(t)).toContain('assist');
      expect(normalizeLumosDispatchMode({ [t]: 'assist' })[t]).toBe('assist');
    }
  });

  it('รายการติดตามที่คนกรอกเอง = อนุมัติแล้วในตัว จึงไม่มี assist', () => {
    expect(modesForTrigger('follow_entry')).toEqual(['manual', 'auto']);
    // ยัด assist เข้ามาต้องตกเป็น manual ไม่ใช่ auto (ปลอดภัยกว่า)
    expect(normalizeLumosDispatchMode({ follow_entry: 'assist' }).follow_entry).toBe('manual');
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
