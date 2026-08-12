// @vitest-environment node
/**
 * `src/lib/recruitJobTitles.ts` — master ตำแหน่งงาน (RM)
 *
 * สองเรื่องที่วัดจากข้อมูลจริงบน iRecruit แล้วต้องไม่พลาด (12 ส.ค. 2569):
 *   1. **ชื่อซ้ำกันจริง** — "เจ้าหน้าที่บัญชี" 4 แถว · "Engineer" 3 · "ธุรการจัดซื้อ" 3
 *      เพราะซ้ำข้าม BU + ของที่ปิดใช้งานค้างอยู่ → ลิสต์ต้องตัดชื่อซ้ำ
 *   2. **ตำแหน่งที่ไม่ระบุ BU ห้ามหายตอนกรอง** — null = ต้นทางไม่ได้บอก
 *      ไม่ใช่ "ใช้กับ BU นี้ไม่ได้"
 */
import { describe, expect, it } from 'vitest';
import {
  filterJobTitles,
  isKnownJobTitle,
  jobTitleOptions,
  uniqueJobTitleNames,
  type RecruitJobTitle,
} from '../../src/lib/recruitJobTitles';

const t = (over: Partial<RecruitJobTitle> = {}): RecruitJobTitle => ({
  id: over.id ?? 'j1',
  name: 'พนักงานขับรถ',
  nameEn: null,
  departmentCode: 'LBD',
  sortOrder: 100,
  isActive: true,
  ...over,
});

describe('uniqueJobTitleNames', () => {
  it('ตัดชื่อซ้ำ เก็บตัวแรกที่เจอ (ลำดับจาก API)', () => {
    const rows = [
      t({ id: '1', name: 'เจ้าหน้าที่บัญชี', departmentCode: 'LBA' }),
      t({ id: '2', name: 'พนักงานขับรถ' }),
      t({ id: '3', name: 'เจ้าหน้าที่บัญชี', departmentCode: 'LBD' }),
      t({ id: '4', name: 'เจ้าหน้าที่บัญชี', isActive: false }),
    ];
    expect(uniqueJobTitleNames(rows)).toEqual(['เจ้าหน้าที่บัญชี', 'พนักงานขับรถ']);
  });

  it('เทียบชื่อโดยไม่สนตัวพิมพ์ ช่องว่างหัวท้าย และช่องว่างซ้อน', () => {
    const rows = [
      t({ id: '1', name: 'Engineer' }),
      t({ id: '2', name: '  engineer ' }),
      t({ id: '3', name: 'ENGINEER' }),
      t({ id: '4', name: 'ช่าง  ซ่อมบำรุง' }),
      t({ id: '5', name: 'ช่าง ซ่อมบำรุง' }),
    ];
    expect(uniqueJobTitleNames(rows)).toEqual(['Engineer', 'ช่าง  ซ่อมบำรุง']);
  });

  it('คงลำดับที่ API เรียงมา ไม่เรียงใหม่เอง', () => {
    // API เรียง sort_order แล้วชื่อ — ถ้าไฟล์นี้ไปเรียงใหม่ ลำดับสองฝั่งจะเพี้ยนกัน
    const rows = [
      t({ id: '1', name: 'ฮ ตัวท้าย', sortOrder: 1 }),
      t({ id: '2', name: 'ก ตัวแรก', sortOrder: 2 }),
    ];
    expect(uniqueJobTitleNames(rows)).toEqual(['ฮ ตัวท้าย', 'ก ตัวแรก']);
  });

  it('ทิ้งชื่อว่าง/ช่องว่างล้วน', () => {
    const rows = [t({ id: '1', name: '   ' }), t({ id: '2', name: '' }), t({ id: '3', name: 'ธุรการ' })];
    expect(uniqueJobTitleNames(rows)).toEqual(['ธุรการ']);
  });

  it('ตัดช่องว่างหัวท้ายออกจากค่าที่คืน', () => {
    expect(uniqueJobTitleNames([t({ name: '  ธุรการ  ' })])).toEqual(['ธุรการ']);
  });
});

describe('filterJobTitles', () => {
  const rows = [
    t({ id: '1', name: 'พนักงานขับรถ', departmentCode: 'LBD' }),
    t({ id: '2', name: 'ธุรการ', departmentCode: 'LBA' }),
    t({ id: '3', name: 'ตำแหน่งไม่ระบุหน่วย', departmentCode: null }),
  ];

  it('กรองตาม BU แล้ว **เก็บตำแหน่งที่ไม่ระบุ BU ไว้ด้วย**', () => {
    const got = filterJobTitles(rows, { departmentCode: 'LBD' }).map((r) => r.id);
    expect(got).toEqual(['1', '3']);
  });

  it('ไม่ส่ง BU = ไม่กรอง', () => {
    expect(filterJobTitles(rows, {})).toHaveLength(3);
    expect(filterJobTitles(rows, { departmentCode: null })).toHaveLength(3);
    expect(filterJobTitles(rows, { departmentCode: '  ' })).toHaveLength(3);
  });

  it('เทียบรหัส BU โดยไม่สนตัวพิมพ์', () => {
    expect(filterJobTitles(rows, { departmentCode: 'lbd' }).map((r) => r.id)).toEqual(['1', '3']);
  });

  it('ค้นจากชื่อไทย และชื่ออังกฤษ', () => {
    const withEn = [...rows, t({ id: '4', name: 'วิศวกร', nameEn: 'Engineer' })];
    expect(filterJobTitles(withEn, { keyword: 'ขับรถ' }).map((r) => r.id)).toEqual(['1']);
    expect(filterJobTitles(withEn, { keyword: 'engine' }).map((r) => r.id)).toEqual(['4']);
    expect(filterJobTitles(withEn, { keyword: 'ENGINE' }).map((r) => r.id)).toEqual(['4']);
  });

  it('คำค้นว่าง/ช่องว่าง = ไม่กรอง', () => {
    expect(filterJobTitles(rows, { keyword: '   ' })).toHaveLength(3);
  });

  it('กรอง BU และคำค้นพร้อมกัน', () => {
    expect(filterJobTitles(rows, { departmentCode: 'LBD', keyword: 'ระบุ' }).map((r) => r.id)).toEqual([
      '3',
    ]);
  });
});

describe('jobTitleOptions', () => {
  it('กรองแล้วตัดชื่อซ้ำในทีเดียว', () => {
    const rows = [
      t({ id: '1', name: 'ธุรการ', departmentCode: 'LBA' }),
      t({ id: '2', name: 'ธุรการ', departmentCode: null }),
      t({ id: '3', name: 'พนักงานขับรถ', departmentCode: 'LBD' }),
    ];
    expect(jobTitleOptions(rows, { departmentCode: 'LBA' })).toEqual(['ธุรการ']);
  });
});

describe('isKnownJobTitle', () => {
  const rows = [t({ name: 'พนักงานขับรถ' })];

  it('ตรงกับ master (ไม่สนตัวพิมพ์/ช่องว่าง)', () => {
    expect(isKnownJobTitle(rows, 'พนักงานขับรถ')).toBe(true);
    expect(isKnownJobTitle(rows, '  พนักงานขับรถ ')).toBe(true);
  });

  it('ชื่อใหม่ = false (แต่ผู้ใช้ยังบันทึกได้ — เป็นแค่ป้ายบอก)', () => {
    expect(isKnownJobTitle(rows, 'ตำแหน่งที่ยังไม่มี')).toBe(false);
  });

  it('ค่าว่าง = false ไม่ใช่ true จากการเทียบสตริงว่าง', () => {
    expect(isKnownJobTitle(rows, '')).toBe(false);
    expect(isKnownJobTitle(rows, '   ')).toBe(false);
    // ⚠️ เคสที่ทำให้ guard จำเป็นจริง: master มีแถวที่ชื่อเป็นช่องว่างล้วน
    // ถอด guard ออกแล้ว "ยังไม่ได้กรอกตำแหน่ง" จะถูกนับว่า "ตรงกับ master"
    // (mutation test ครั้งแรกหลุดเพราะ fixture ไม่มีแถวแบบนี้)
    expect(isKnownJobTitle([t({ id: 'blank', name: '   ' })], '')).toBe(false);
    expect(isKnownJobTitle([t({ id: 'blank', name: '   ' })], '  ')).toBe(false);
  });
});
