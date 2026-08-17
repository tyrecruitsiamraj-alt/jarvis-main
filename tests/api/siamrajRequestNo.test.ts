import { describe, it, expect } from 'vitest';
import {
  digitsOnlyRowMatchesLookup,
  extractRequestNoDigitSuffix,
  normalizeSiamrajRequestNoForDisplay,
  pickBestRequestNoCandidate,
  requestNoMatchesLookup,
} from '../../api/_lib/siamrajRequestNo.js';

describe('siamrajRequestNo lookup', () => {
  it('extracts digit suffix from request numbers', () => {
    expect(extractRequestNoDigitSuffix('LBM6905015')).toBe('6905015');
    expect(extractRequestNoDigitSuffix('lm6905015')).toBe('6905015');
  });

  it('matches abbreviated prefixes with the same digit suffix', () => {
    expect(requestNoMatchesLookup('lm6905015', 'LBM6905015')).toBe(true);
    expect(requestNoMatchesLookup('lbm6905015', 'LBM6905015')).toBe(true);
    expect(requestNoMatchesLookup('lm6905016', 'LBM6905015')).toBe(false);
  });

  it('prefers open partial requests when suffix matches multiple rows', () => {
    const best = pickBestRequestNoCandidate(
      [
        {
          request_no: 'DSO6905015',
          status: 'A',
          is_stop: 'N',
          stop_no: null,
          is_inform_all: 'Y',
          request_qty: 1,
          inform_qty: 1,
          effective_inform_qty: 1,
        },
        {
          request_no: 'LBM6905015',
          status: 'A',
          is_stop: 'N',
          stop_no: null,
          is_inform_all: 'P',
          request_qty: 4,
          inform_qty: 3,
          effective_inform_qty: 3,
        },
      ],
      'lm6905015',
    );
    expect(best?.request_no).toBe('LBM6905015');
  });

  it('normalizes digit-only request numbers using site_code prefix', () => {
    expect(
      normalizeSiamrajRequestNoForDisplay('6907001', {
        siteCode: '67LBDL0324',
        departmentCode: 'LBD',
      }),
    ).toBe('LBD6907001');
    expect(normalizeSiamrajRequestNoForDisplay('OPL6907001', { siteCode: '67LBDL0230' })).toBe(
      'OPL6907001',
    );
  });

  it('falls back to department code when site_code has no prefix', () => {
    expect(
      normalizeSiamrajRequestNoForDisplay('6907001', { departmentCode: 'LBA' }),
    ).toBe('LBA6907001');
  });
});

/**
 * 🔴 ด่านกันเปิดผิดใบข้ามบริษัท (17 ส.ค. 2569)
 *
 * ของจริงที่เจ้าของเจอ: กด `OPL6907002` (ฮอนด้า อาร์แอนด์ดี · BU LBD) แล้วหน้าจอขึ้น
 * ใบ `LAO6907002` (ทาทา สตีล · BU LBA) เพราะทางสำรองยิง `LIKE '%6907002'` แล้วเลข
 * ชุดนี้มีถึง 9 ใบข้าม 4 BU · ทั้งระบบมี 234 ใบที่เด้งข้าม BU แบบเดียวกัน
 *
 * ถ้าด่านนี้หลุด **ไม่มีสัญญาณเตือนเลย** — หน้าจอขึ้นใบครบถ้วนสวยงาม แค่เป็นของบริษัทอื่น
 */
describe('🔴 ทางสำรองเลขล้วน ห้ามเด้งข้ามแผนก/ข้ามบริษัท', () => {
  // แถวจริงจาก ERP: request_no เก็บเป็นเลขล้วน ต้องเติม prefix จาก site_code ตอนแสดงผล
  const digitsOnlyRow = {
    request_no: '6907002',
    site_code: '67LBDL0324',
    department_code: 'LBD',
  };

  it('เลขล้วน + prefix ที่เติมให้ตรงกับที่ผู้ใช้กด = ใบเดียวกัน (เคสที่ทางสำรองมีไว้เพื่อ)', () => {
    expect(normalizeSiamrajRequestNoForDisplay('6907002', {
      siteCode: digitsOnlyRow.site_code,
      departmentCode: digitsOnlyRow.department_code,
    })).toBe('LBD6907002');
    expect(digitsOnlyRowMatchesLookup('LBD6907002', digitsOnlyRow)).toBe(true);
    expect(digitsOnlyRowMatchesLookup('lbd6907002', digitsOnlyRow)).toBe(true);
  });

  it('🔴 กด OPL6907002 ต้องไม่ได้แถวเลขล้วนของ LBD (เคสที่เจ้าของเจอ)', () => {
    expect(digitsOnlyRowMatchesLookup('OPL6907002', digitsOnlyRow)).toBe(false);
  });

  it('🔴 แถวที่มี prefix อยู่แล้วห้ามเข้าทางสำรองเด็ดขาด — นั่นคือใบของแผนกอื่น', () => {
    // ใบจริงทั้ง 4 ใบนี้เลขท้าย 6907002 เหมือนกันหมด แต่คนละบริษัท
    const others = [
      { request_no: 'LAO6907002', site_code: '69LBAL0007', department_code: 'LBA' },
      { request_no: 'LAM6907002', site_code: '69LBAL0002', department_code: 'LBA' },
      { request_no: 'DSO6907002', site_code: '68DSL0043', department_code: 'DS' },
      { request_no: 'SQ6907002', site_code: '99LBDL0003', department_code: 'LBD' },
    ];
    for (const row of others) {
      expect(digitsOnlyRowMatchesLookup('OPL6907002', row)).toBe(false);
      // แม้กดตรงเลขของตัวเองก็ยังไม่ผ่านทางสำรอง เพราะต้องเจอตั้งแต่หาแบบตรงตัวแล้ว
      expect(digitsOnlyRowMatchesLookup(row.request_no, row)).toBe(false);
    }
  });

  it('เลขล้วนคนละไซต์ = คนละ prefix = คนละใบ', () => {
    const otherSite = { request_no: '6907002', site_code: '69LBAL0007', department_code: 'LBA' };
    expect(digitsOnlyRowMatchesLookup('LBD6907002', otherSite)).toBe(false);
    expect(digitsOnlyRowMatchesLookup('LBA6907002', otherSite)).toBe(true);
  });

  it('🔴 prefix ต้องมาจาก site_code ก่อน department_code — สองตัวนี้ไม่ใช่ตัวเดียวกัน', () => {
    // site_code บอก BU ที่เป็นเจ้าของไซต์ · department_code บนหัวใบบอกแผนกที่ยื่นขอ
    // จอแสดงผลใช้ตัวแรกก่อน ด่านนี้ต้องใช้กติกาเดียวกันเป๊ะ ไม่งั้นเทียบคนละเลข
    const row = { request_no: '6907002', site_code: '67LBDL0324', department_code: 'OPL' };
    expect(digitsOnlyRowMatchesLookup('LBD6907002', row)).toBe(true);
    expect(digitsOnlyRowMatchesLookup('OPL6907002', row)).toBe(false);
    // ไม่มี site_code ค่อยตกไปใช้ department_code
    const noSite = { request_no: '6907002', department_code: 'OPL' };
    expect(digitsOnlyRowMatchesLookup('OPL6907002', noSite)).toBe(true);
    expect(digitsOnlyRowMatchesLookup('LBD6907002', noSite)).toBe(false);
  });

  it('ข้อมูลไม่ครบต้องตอบว่าไม่ใช่ ห้ามเดา', () => {
    expect(digitsOnlyRowMatchesLookup('', digitsOnlyRow)).toBe(false);
    expect(digitsOnlyRowMatchesLookup('LBD6907002', { request_no: '' })).toBe(false);
    expect(digitsOnlyRowMatchesLookup('LBD6907002', {})).toBe(false);
    // ไม่มี hint ให้เติม prefix เลย → เทียบกับเลขล้วนตรง ๆ เท่านั้น
    expect(digitsOnlyRowMatchesLookup('6907002', { request_no: '6907002' })).toBe(true);
    expect(digitsOnlyRowMatchesLookup('LBD6907002', { request_no: '6907002' })).toBe(false);
  });
});
