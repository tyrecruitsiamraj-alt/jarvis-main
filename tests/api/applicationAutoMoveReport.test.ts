import { describe, it, expect } from 'vitest';
import {
  AUTO_MOVE_DEFAULTS,
  autoMoveDetailLine,
  autoMoveIntEnv,
  autoMoveJobLabel,
  autoMoveModeLabel,
  autoMoveRunSummary,
  autoMoveTopReasons,
  readAutoMoveWorkerConfig,
  type AutoMoveRunState,
} from '../../src/lib/applicationAutoMoveReport';

describe('readAutoMoveWorkerConfig', () => {
  it('🔴 ไม่ได้ตั้งอะไรเลย = ปิด และไม่ย้ายจริง (ตัวนี้แตะข้อมูลคนจริง ต้อง fail-safe)', () => {
    const cfg = readAutoMoveWorkerConfig({});
    expect(cfg.enabled).toBe(false);
    expect(cfg.apply).toBe(false);
    expect(cfg.intervalMs).toBe(AUTO_MOVE_DEFAULTS.intervalMs);
  });

  it('เปิดได้หลายรูปแบบ แต่ค่าอื่นไม่นับว่าเปิด', () => {
    for (const v of ['true', '1', 'yes', 'on', 'ON', ' True ']) {
      expect(readAutoMoveWorkerConfig({ APPLICATION_AUTO_MOVE_ENABLED: v }).enabled).toBe(true);
    }
    for (const v of ['false', '0', 'no', '', 'maybe']) {
      expect(readAutoMoveWorkerConfig({ APPLICATION_AUTO_MOVE_ENABLED: v }).enabled).toBe(false);
    }
  });

  it('เปิดตัวตั้งเวลาแล้วยังไม่ย้ายจริง จนกว่าจะสั่ง APPLY ต่างหาก', () => {
    const cfg = readAutoMoveWorkerConfig({ APPLICATION_AUTO_MOVE_ENABLED: 'true' });
    expect(cfg.enabled).toBe(true);
    expect(cfg.apply).toBe(false);
    expect(
      readAutoMoveWorkerConfig({
        APPLICATION_AUTO_MOVE_ENABLED: 'true',
        APPLICATION_AUTO_MOVE_APPLY: 'true',
      }).apply,
    ).toBe(true);
  });

  it('รอบถี่กว่า 1 นาทีไม่ได้ (กันตั้งพลาดแล้วยิง ERP รัว ๆ)', () => {
    expect(readAutoMoveWorkerConfig({ APPLICATION_AUTO_MOVE_INTERVAL_MS: '1000' }).intervalMs).toBe(60_000);
    expect(readAutoMoveWorkerConfig({ APPLICATION_AUTO_MOVE_INTERVAL_MS: '600000' }).intervalMs).toBe(600_000);
  });
});

describe('autoMoveIntEnv', () => {
  it('🔴 ค่าว่าง = ใช้ค่าเริ่มต้น ไม่ใช่ 0 (Number("") ได้ 0 ซึ่ง finite)', () => {
    expect(autoMoveIntEnv('', 900_000, 60_000)).toBe(900_000);
    expect(autoMoveIntEnv(undefined, 900_000, 60_000)).toBe(900_000);
  });
  it('ค่าที่ไม่ใช่ตัวเลข = ค่าเริ่มต้น · ต่ำกว่าขั้นต่ำถูกยกขึ้น', () => {
    expect(autoMoveIntEnv('abc', 200, 1)).toBe(200);
    expect(autoMoveIntEnv('-5', 200, 1)).toBe(1);
  });
});

describe('autoMoveJobLabel', () => {
  it('ตัด prefix ออกให้เหลือเลขที่ใบ', () => {
    expect(autoMoveJobLabel('siamraj-sql:OPL6901006')).toBe('OPL6901006');
  });
  it('🔴 ใบล่วงหน้าต้องติดป้ายกำกับ — เลขที่ใบซ้ำกับใบปกติได้จริง', () => {
    expect(autoMoveJobLabel('siamraj-pre:LBM6908001')).toBe('LBM6908001 (ล่วงหน้า)');
  });
  it('คีย์ที่ไม่มี prefix / ว่าง', () => {
    expect(autoMoveJobLabel('OPL1')).toBe('OPL1');
    expect(autoMoveJobLabel('')).toBe('—');
  });
});

describe('autoMoveDetailLine', () => {
  it('บอกชื่อคน + จากใบไหนไปใบไหน', () => {
    expect(
      autoMoveDetailLine({
        applicationId: 'a1',
        applicant: 'สมชาย ใจดี',
        from: 'siamraj-sql:OPL6901006',
        to: 'siamraj-sql:LBM6908002',
        reason: 'จังหวัดเดียวกัน',
      }),
    ).toBe('สมชาย ใจดี · OPL6901006 → LBM6908002');
  });
  it('ไม่มีชื่อก็ยังอ่านออก', () => {
    expect(
      autoMoveDetailLine({ applicationId: 'a1', applicant: '  ', from: 'x:1', to: 'x:2', reason: 'r' }),
    ).toBe('ไม่ทราบชื่อ · 1 → 2');
  });
});

describe('autoMoveRunSummary', () => {
  const base: AutoMoveRunState = {
    at: '2026-08-19T04:00:00.000Z',
    dryRun: true,
    scanned: 10,
    moved: 3,
    skipped: 7,
    openJobs: 51,
    reasons: {},
    details: [],
  };

  it('ยังไม่เคยเดิน', () => {
    expect(autoMoveRunSummary(null)).toBe('ยังไม่เคยเดินสักรอบ');
    expect(autoMoveRunSummary({ ...base, at: null })).toBe('ยังไม่เคยเดินสักรอบ');
  });
  it('🔴 โหมดลองดูต้องพูดว่า "จะย้าย" ไม่ใช่ "ย้ายแล้ว"', () => {
    expect(autoMoveRunSummary(base)).toContain('จะย้าย 3 ใบ');
    expect(autoMoveRunSummary({ ...base, dryRun: false })).toContain('ย้ายแล้ว 3 ใบ');
  });
  it('ไม่มีใบค้าง vs มีใบค้างแต่ย้ายไม่ได้ — คนละข้อความ', () => {
    expect(autoMoveRunSummary({ ...base, scanned: 0, moved: 0 })).toContain('ไม่มีใบสมัครค้าง');
    expect(autoMoveRunSummary({ ...base, moved: 0 })).toContain('ไม่มีใบไหนย้ายได้');
  });
  it('รอบที่ล้มเหลวต้องบอกตรง ๆ ไม่ใช่รายงานเป็น 0 ใบ', () => {
    expect(autoMoveRunSummary({ ...base, error: 'อ่าน ERP ไม่ได้' })).toBe(
      'รอบล่าสุดล้มเหลว — อ่าน ERP ไม่ได้',
    );
  });
});

describe('autoMoveModeLabel', () => {
  it('บอกให้ชัดว่าของจริงหรือลองดู', () => {
    expect(autoMoveModeLabel({ enabled: false, apply: false })).toContain('ปิดอยู่');
    expect(autoMoveModeLabel({ enabled: true, apply: false })).toContain('ลองดูอย่างเดียว');
    expect(autoMoveModeLabel({ enabled: true, apply: true })).toContain('ย้ายจริง');
  });
  it('🔴 ปิดอยู่ต้องไม่โชว์ว่าย้ายจริง แม้ APPLY จะเปิดค้างไว้', () => {
    expect(autoMoveModeLabel({ enabled: false, apply: true })).toContain('ปิดอยู่');
  });
});

describe('autoMoveTopReasons', () => {
  it('เรียงจากที่เจอบ่อยสุด แล้วหั่นตามจำนวนที่ขอ', () => {
    expect(autoMoveTopReasons({ a: 1, b: 9, c: 5 }, 2)).toEqual([
      { reason: 'b', count: 9 },
      { reason: 'c', count: 5 },
    ]);
  });
  it('ไม่มีเหตุผลเลย = ลิสต์ว่าง', () => {
    expect(autoMoveTopReasons({})).toEqual([]);
  });
});
