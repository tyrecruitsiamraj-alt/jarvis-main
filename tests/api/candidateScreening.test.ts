// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  compareCandidatePriority,
  criminalRecordVerdict,
  lifestyleVerdict,
  scoreCandidatePriority,
  screeningVerdicts,
  isScreeningAnswer,
  EMPTY_SCREENING,
} from '../../src/lib/candidatePriority';

describe('เหล้า/บุหรี่ → verdict', () => {
  it('ไม่ดื่มไม่สูบ = ผ่าน · อย่างใดอย่างหนึ่ง = ต้องดู · ทั้งคู่ = ไม่ผ่าน', () => {
    expect(lifestyleVerdict({ drinking: 'no', smoking: 'no' })).toBe('pass');
    expect(lifestyleVerdict({ drinking: 'yes', smoking: 'no' })).toBe('warn');
    expect(lifestyleVerdict({ drinking: 'no', smoking: 'yes' })).toBe('warn');
    expect(lifestyleVerdict({ drinking: 'yes', smoking: 'yes' })).toBe('fail');
  });

  it('ไม่รู้ทั้งคู่ = unknown · รู้ข้างเดียวก็ตัดสินจากข้างที่รู้', () => {
    expect(lifestyleVerdict({})).toBe('unknown');
    expect(lifestyleVerdict({ drinking: 'unknown', smoking: 'unknown' })).toBe('unknown');
    // รู้แค่ว่าไม่สูบ → ยังนับให้เป็นผ่าน ไม่ต้องรอให้ครบทั้งสองข้อ
    expect(lifestyleVerdict({ smoking: 'no' })).toBe('pass');
    expect(lifestyleVerdict({ drinking: 'yes', smoking: 'unknown' })).toBe('warn');
  });
});

describe('ประวัติคดี → verdict', () => {
  it('ไม่มีคดี = ผ่าน · มีคดี = ไม่ผ่าน · ยังไม่ได้ถาม = unknown', () => {
    expect(criminalRecordVerdict({ criminalRecord: 'no' })).toBe('pass');
    expect(criminalRecordVerdict({ criminalRecord: 'yes' })).toBe('fail');
    expect(criminalRecordVerdict({ criminalRecord: 'unknown' })).toBe('unknown');
    expect(criminalRecordVerdict({})).toBe('unknown');
  });
});

describe('screeningVerdicts', () => {
  it('ไม่มีข้อมูลคัดกรองเลย = ไม่ส่งเกณฑ์ไหนเข้าไป (ไม่ใช่ส่ง unknown)', () => {
    expect(screeningVerdicts(null)).toEqual({});
    expect(screeningVerdicts(undefined)).toEqual({});
  });

  it('มีข้อมูลแล้วแปลงครบสองเกณฑ์', () => {
    expect(screeningVerdicts({ drinking: 'no', smoking: 'no', criminalRecord: 'no' })).toEqual({
      lifestyle: 'pass',
      criminalRecord: 'pass',
    });
  });

  it('EMPTY_SCREENING ให้ unknown ทั้งคู่ — คนที่ยังไม่ถูกคัดกรองไม่ถูกลงโทษ', () => {
    const v = screeningVerdicts(EMPTY_SCREENING);
    expect(v).toEqual({ lifestyle: 'unknown', criminalRecord: 'unknown' });

    const notScreened = scoreCandidatePriority({ age: 'pass', area: 'pass', ...v });
    const noScreeningField = scoreCandidatePriority({ age: 'pass', area: 'pass' });
    expect(notScreened.percent).toBe(noScreeningField.percent);
    expect(notScreened.percent).toBe(100);
  });
});

describe('เกณฑ์คัดกรองเป็น flexible — ลดอันดับ แต่ไม่ตกท้ายลิสต์', () => {
  it('มีคดี = คะแนนลด แต่ hardFails ยังเป็น 0 (ไม่เหมือนอายุ/ที่อยู่)', () => {
    const withRecord = scoreCandidatePriority({
      age: 'pass',
      area: 'pass',
      ...screeningVerdicts({ drinking: 'no', smoking: 'no', criminalRecord: 'yes' }),
    });
    expect(withRecord.hardFails).toBe(0);
    expect(withRecord.percent).toBeLessThan(100);

    // เทียบกับอายุไม่เข้า (เกณฑ์แข็ง) — คนมีคดีต้องยังอยู่เหนือคนที่อายุไม่เข้า
    const ageFail = scoreCandidatePriority({ age: 'fail', area: 'pass' });
    expect(compareCandidatePriority(withRecord, ageFail)).toBeLessThan(0);
  });

  it('ทั้งดื่มทั้งสูบ + มีคดี ยังอยู่ในลิสต์ (hardFails 0) แค่คะแนนต่ำ', () => {
    const worst = scoreCandidatePriority({
      age: 'pass',
      area: 'pass',
      ...screeningVerdicts({ drinking: 'yes', smoking: 'yes', criminalRecord: 'yes' }),
    });
    const clean = scoreCandidatePriority({
      age: 'pass',
      area: 'pass',
      ...screeningVerdicts({ drinking: 'no', smoking: 'no', criminalRecord: 'no' }),
    });
    expect(worst.hardFails).toBe(0);
    expect(compareCandidatePriority(clean, worst)).toBeLessThan(0);
  });
});

describe('isScreeningAnswer', () => {
  it('รับแค่ 3 ค่าที่รู้จัก', () => {
    expect(isScreeningAnswer('yes')).toBe(true);
    expect(isScreeningAnswer('no')).toBe(true);
    expect(isScreeningAnswer('unknown')).toBe(true);
    expect(isScreeningAnswer('maybe')).toBe(false);
    expect(isScreeningAnswer(null)).toBe(false);
    expect(isScreeningAnswer(1)).toBe(false);
  });
});

// ── ฝั่งเก็บข้อมูล ─────────────────────────────────────────────────────────────

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn(), isPgUniqueViolation: () => false }));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

const { dbQuery } = await import('../../api/_lib/postgres.js');
const { getCandidateScreeningMap, upsertCandidateScreening, isScreeningSource } = await import(
  '../../api/_lib/candidateScreening.js'
);

const row = {
  source: 'board',
  candidate_ref: '4321',
  candidate_name: 'ผู้สมัครทดสอบ',
  drinking: 'no',
  smoking: 'yes',
  criminal_record: 'no',
  criminal_note: null,
  screened_by_name: 'สมหญิง ฝ่ายสรรหา',
  updated_at: '2026-08-06T03:00:00.000Z',
};

describe('candidateScreening store', () => {
  beforeEach(() => vi.mocked(dbQuery).mockReset());

  it('isScreeningSource รับแค่ board / irecruit', () => {
    expect(isScreeningSource('board')).toBe(true);
    expect(isScreeningSource('irecruit')).toBe(true);
    expect(isScreeningSource('erp')).toBe(false);
  });

  it('อ่านหลายคนในคิวรีเดียว + ตัด ref ซ้ำ/ว่างออก', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [row] });

    const map = await getCandidateScreeningMap('board', ['4321', '4321', '  ', '', '9999']);

    expect(vi.mocked(dbQuery)).toHaveBeenCalledTimes(1);
    const params = vi.mocked(dbQuery).mock.calls[0][1] as unknown[];
    expect(params[0]).toBe('board');
    expect(params[1]).toEqual(['4321', '9999']);
    expect(map.get('4321')?.smoking).toBe('yes');
  });

  it('ไม่มี ref = ไม่ยิง DB', async () => {
    const map = await getCandidateScreeningMap('board', ['', '   ']);
    expect(map.size).toBe(0);
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });

  it('ตารางยังไม่ถูก migrate = คืน map ว่าง ไม่โยน error (หน้า Matching ต้องไม่ล่ม)', async () => {
    // ต้องเป็น mockImplementationOnce — ถ้าใช้ mockImplementation (ค้างถาวร) vitest
    // จะรายงาน error ที่โยนใน mock เป็น failure ของเคสนี้ ทั้งที่ body ผ่านหมดแล้ว
    vi.mocked(dbQuery).mockImplementationOnce(() => {
      throw new Error('relation "candidate_screening" does not exist');
    });

    let threw = false;
    let map = new Map<string, unknown>();
    try {
      map = await getCandidateScreeningMap('board', ['4321']);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(map.size).toBe(0);
  });

  it('ค่าแปลก ๆ ใน DB ถูกบังคับเป็น unknown', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [{ ...row, drinking: 'MAYBE', criminal_record: '' }],
    });
    const map = await getCandidateScreeningMap('board', ['4321']);
    expect(map.get('4321')?.drinking).toBe('unknown');
    expect(map.get('4321')?.criminalRecord).toBe('unknown');
  });

  it('บันทึก: ฟิลด์ที่ไม่ส่งมาเป็น null เพื่อให้ coalesce คงค่าเดิมไว้', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [row] });

    await upsertCandidateScreening({ source: 'board', candidateRef: '4321', drinking: 'no' });

    const params = vi.mocked(dbQuery).mock.calls[0][1] as unknown[];
    // [source, ref, name, drinking, smoking, criminal, note, userId, userName, noteProvided]
    expect(params[3]).toBe('no');
    expect(params[4]).toBeNull();
    expect(params[5]).toBeNull();
    // ไม่ได้ส่ง criminalNote → ธงเป็น false เพื่อไม่ให้ทับบันทึกเดิมเป็น null
    expect(params[9]).toBe(false);
  });

  it('บันทึก: ส่ง criminalNote มา = ธงเป็น true (ล้างเป็นค่าว่างได้)', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [row] });

    await upsertCandidateScreening({
      source: 'board',
      candidateRef: '4321',
      criminalNote: '',
    });

    const params = vi.mocked(dbQuery).mock.calls[0][1] as unknown[];
    expect(params[6]).toBeNull();
    expect(params[9]).toBe(true);
  });

  it('ไม่ระบุผู้สมัคร = โยน error ก่อนแตะ DB', async () => {
    await expect(
      upsertCandidateScreening({ source: 'board', candidateRef: '   ' }),
    ).rejects.toThrow('ต้องระบุผู้สมัคร');
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });
});
