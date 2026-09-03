import { describe, expect, it } from 'vitest';
import { sitePlaceName, workSiteNameOf } from '../../api/_lib/siamrajUnitName';
import { unitLabel, unitOneLine, unitSubLabel, unitTitleText } from '../../src/lib/unitDisplay';
import type { JobRequest } from '../../src/types';

/**
 * ด่านกันเคสจริงที่เจ้าของจับได้ 3 ก.ย. 2569 — ไซต์ `69LBDL0044`
 * คู่สัญญา "บริษัท สมิติเวช ศรีราชา จำกัด (สำนักงานใหญ่)" แต่คนไปทำงาน
 * ที่ "สมิติเวช ชลบุรี" ⇒ จอต้องขึ้นชลบุรีก่อน ห้ามขึ้นศรีราชาเดี่ยว ๆ
 */
const SMITIVEJ_SITE = 'สมิติเวช ชลบุรี - พขร. (Valet Parking) 4 คน';
const SMITIVEJ_CUSTOMER = 'บริษัท สมิติเวช ศรีราชา จำกัด (สำนักงานใหญ่)';

const job = (over: Partial<JobRequest>): JobRequest => ({ ...over } as JobRequest);

describe('sitePlaceName — ตัดหางตำแหน่ง/จำนวนคนออกจากชื่อไซต์ ERP', () => {
  it('เคสจริง 69LBDL0044', () => {
    expect(sitePlaceName(SMITIVEJ_SITE)).toBe('สมิติเวช ชลบุรี');
  });

  it('ชื่อที่มีขีดติดกันห้ามถูกหั่น (Asian-HD)', () => {
    expect(sitePlaceName('Asian-HD - พขร. (ปตน.) 68 คน')).toBe('Asian-HD');
  });

  it('หลายตำแหน่งคั่นด้วยจุลภาคก็เอาแต่หัว', () => {
    expect(sitePlaceName('รพ.กรุงเทพ - พขร.(รถกอล์ฟ) 20 คน , พขร. (ส่วนกลาง) 10 คน')).toBe(
      'รพ.กรุงเทพ',
    );
  });

  it('ไม่มีตัวคั่นเลย ⇒ คืนทั้งชื่อ (ห้ามคืนค่าว่าง)', () => {
    expect(sitePlaceName('บางกอกชโยรัตน์ พขร. (ส่วนกลาง) 4 คน')).toBe(
      'บางกอกชโยรัตน์ พขร. (ส่วนกลาง) 4 คน',
    );
  });

  it('ว่าง/ช่องว่างล้วน ⇒ ค่าว่าง', () => {
    expect(sitePlaceName('   ')).toBe('');
    expect(sitePlaceName(null)).toBe('');
  });
});

describe('workSiteNameOf — คืน null เมื่อไม่มีข้อมูลเพิ่มจากชื่อคู่สัญญา', () => {
  it('ชื่อต่างกัน ⇒ คืนจุดทำงาน', () => {
    expect(workSiteNameOf(SMITIVEJ_SITE, SMITIVEJ_CUSTOMER)).toBe('สมิติเวช ชลบุรี');
  });

  it('ชื่อซ้ำกัน (ต่างแค่เว้นวรรค/ตัวพิมพ์) ⇒ null ไม่ต้องขึ้นสองบรรทัด', () => {
    expect(workSiteNameOf('krungsri - พขร. 2 คน', 'KRUNGSRI')).toBeNull();
    expect(workSiteNameOf('SO - พนง. 30 คน', 'SO  ')).toBeNull();
  });

  it('ERP ไม่มีชื่อไซต์ (ใบขอล่วงหน้า) ⇒ null', () => {
    expect(workSiteNameOf(null, SMITIVEJ_CUSTOMER)).toBeNull();
  });
});

describe('ชื่อหน่วยงานบนจอ — จุดทำงานนำ คู่สัญญาตาม', () => {
  const smitivej = job({ unit_name: SMITIVEJ_CUSTOMER, work_site_name: 'สมิติเวช ชลบุรี' });

  it('บรรทัดแรกคือจุดทำงาน', () => {
    expect(unitLabel(smitivej)).toBe('สมิติเวช ชลบุรี');
  });

  it('บรรทัดสองคือคู่สัญญา', () => {
    expect(unitSubLabel(smitivej)).toBe(SMITIVEJ_CUSTOMER);
  });

  it('ที่แคบบรรทัดเดียวต้องมีทั้งคู่ ห้ามทิ้งข้างใดข้างหนึ่ง', () => {
    expect(unitOneLine(smitivej)).toBe(`สมิติเวช ชลบุรี · ${SMITIVEJ_CUSTOMER}`);
  });

  it('title บอกด้วยว่าบรรทัดไหนคืออะไร', () => {
    expect(unitTitleText(smitivej)).toBe(
      `จุดทำงาน: สมิติเวช ชลบุรี · คู่สัญญา: ${SMITIVEJ_CUSTOMER}`,
    );
  });

  it('ไม่มีจุดทำงาน ⇒ เหลือบรรทัดเดียว ไม่มีคำว่า "คู่สัญญา" โผล่', () => {
    const only = job({ unit_name: 'บริษัท เอ จำกัด' });
    expect(unitLabel(only)).toBe('บริษัท เอ จำกัด');
    expect(unitSubLabel(only)).toBeNull();
    expect(unitOneLine(only)).toBe('บริษัท เอ จำกัด');
  });

  it('ไม่มีข้อมูลเลย ⇒ ขีด ห้ามเป็นค่าว่าง', () => {
    expect(unitLabel(job({ unit_name: '' }))).toBe('—');
  });
});
