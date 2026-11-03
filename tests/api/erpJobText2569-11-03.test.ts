/**
 * กล่องรายละเอียดงาน/คุณสมบัติ ค่าตั้งต้น = ใบขอ ERP (เจ้าของ 3 พ.ย. 2569 "ทำไมไม่ขึ้นที่ระบบเราในเมื่อเขากรอกแล้ว")
 * ตัวอย่างจากใบ Pre Order LAM6910001 (TAK) และใบขอจริง OPL6910081
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { erpJobDetailLines, erpRequirementLines } from '../../api/_lib/erpJobText';

describe('รายละเอียดงานจาก work_detail1–3', () => {
  it('บรรทัดละช่อง · ช่องว่าง/ขีดทิ้ง', () => {
    expect(
      erpJobDetailLines('แพ็คสินค้า คัดแยกและจัดเก็บสิ้นค้าที่เสียหาย  ', 'เติมสินค้าเข้าพื้นที่จัดเก็บ ตรวจสอบสินค้าก่อนจัดส่ง', 'ดูแลพื้นที่และปฎิบัติตามมาตรฐาน'),
    ).toEqual(['แพ็คสินค้า คัดแยกและจัดเก็บสิ้นค้าที่เสียหาย', 'เติมสินค้าเข้าพื้นที่จัดเก็บ ตรวจสอบสินค้าก่อนจัดส่ง', 'ดูแลพื้นที่และปฎิบัติตามมาตรฐาน']);
    expect(erpJobDetailLines('ขับรถรับ-ส่งผู้บริหาร', '', null, '-')).toEqual(['ขับรถรับ-ส่งผู้บริหาร']);
  });
});

describe('คุณสมบัติจากแท็บคุณสมบัติพนักงาน', () => {
  it('วุฒิ (+สาขา) · ประสบการณ์ · ความสามารถ · อื่น ๆ', () => {
    expect(
      erpRequirementLines({
        degree: 'ภาคบังคับ',
        major: '',
        experience: 'ในการขับรถไม่น้อยกว่า 3 ปี และมีใบอนุญาตขับรถยนต์ไม่น้อยกว่า 3 ปี',
        capability1: 'ขับรถเกียร์ออโต้ และเกียร์ธรรมดาได้',
        capability2: null,
        capability3: '-',
        capabilityOther: 'กรณีรับพนักงานอายุเกิน 55 ปี ต้องมีสุขภาพแข็งแรง',
      }),
    ).toEqual([
      'วุฒิ ภาคบังคับ',
      'ประสบการณ์ ในการขับรถไม่น้อยกว่า 3 ปี และมีใบอนุญาตขับรถยนต์ไม่น้อยกว่า 3 ปี',
      'ขับรถเกียร์ออโต้ และเกียร์ธรรมดาได้',
      'กรณีรับพนักงานอายุเกิน 55 ปี ต้องมีสุขภาพแข็งแรง',
    ]);
  });
  it('ประสบการณ์ที่ขึ้นต้นด้วยคำว่าประสบการณ์อยู่แล้วไม่เติมซ้ำ · สาขาต่อท้ายวุฒิ', () => {
    expect(erpRequirementLines({ degree: 'ปวส.', major: 'ไฟฟ้า', experience: 'ประสบการณ์ขับรถอย่างน้อย 3 ปี' })).toEqual(['วุฒิ ปวส. สาขา ไฟฟ้า', 'ประสบการณ์ขับรถอย่างน้อย 3 ปี']);
    expect(erpRequirementLines({ degree: 'ไม่จำกัด', major: 'นครปฐม', experience: '0-1 ปี' })).toEqual(['วุฒิ ไม่จำกัด', 'ประสบการณ์ 0-1 ปี']);
    expect(erpRequirementLines({})).toEqual([]);
  });
});

describe('ต่อสายครบทั้งใบขอจริงและใบ Pre Order · ทีมแก้แล้วทับ', () => {
  it('ใบขอจริง: row type + BASE_SQL + SELECT_COLUMNS + mapping', () => {
    const s = readFileSync('api/_lib/siamrajSqlServerRequests.ts', 'utf8');
    expect(s).toContain('B.work_detail1, B.work_detail2, B.work_detail3,');
    expect(s).toContain('work_detail1, work_detail2, work_detail3, degree_detail, major_detail, experience, capability1');
    expect(s).toContain('job_details: erpJobDetailLines(r.work_detail1, r.work_detail2, r.work_detail3)');
  });
  it('ใบ Pre Order ดึงครบ 3 บรรทัด', () => {
    const s = readFileSync('api/_lib/siamrajSqlServerPrequests.ts', 'utf8');
    expect(s).toContain('RTRIM(p2.work_detail2) AS work_detail2, RTRIM(p2.work_detail3) AS work_detail3');
    expect(s).toContain('job_details: erpJobDetailLines(r.work_detail, r.work_detail2, r.work_detail3)');
  });
  it('ค่าที่ทีมแก้ทับ ERP และเก็บของ ERP ไว้โชว์คู่', () => {
    const s = readFileSync('api/_handlers/siamraj-unit-requests.ts', 'utf8');
    expect(s).toContain('it.erp_requirements = it.requirements ?? null;');
    expect(s).toContain('it.erp_job_details = it.job_details ?? null;');
  });
});
