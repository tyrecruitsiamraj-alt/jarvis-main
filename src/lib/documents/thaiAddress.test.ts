/** ที่อยู่ไทยแบบเลือกตามกัน (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569) */
import { describe, expect, it } from 'vitest';
import { emptyAddress, formatAddress, thaiProvinces, updateAddress, validateAddress, type ThaiAddress } from './thaiAddress';

const SAMPLE: ThaiAddress = { house: '99/1', moo: '', soi: '', road: '', provinceId: '1', districtId: '1001', subdistrictId: '100101', postalCode: '10200' };

describe('ข้อมูลที่อยู่', () => {
  it('ครบ 77 จังหวัด และทุกตำบลเลือกได้ครบสาย (จังหวัด → อำเภอ → ตำบล → รหัสไปรษณีย์)', () => {
    expect(thaiProvinces).toHaveLength(77);
    let subdistricts = 0;
    for (const p of thaiProvinces) {
      expect(p.districts.length).toBeGreaterThan(0);
      for (const d of p.districts) {
        expect(d.subdistricts.length).toBeGreaterThan(0);
        for (const s of d.subdistricts) {
          subdistricts++;
          expect(s.postalCodes.length).toBeGreaterThan(0);
          validateAddress({ ...SAMPLE, provinceId: p.id, districtId: d.id, subdistrictId: s.id, postalCode: s.postalCodes[0] }, 'ทดสอบ');
        }
      }
    }
    expect(subdistricts).toBe(7436);
  });
});

describe('เลือกตามกัน', () => {
  it('เปลี่ยนจังหวัด ล้างอำเภอ ตำบล รหัสไปรษณีย์เดิม (บ้านเลขที่อยู่)', () => {
    const a = updateAddress(SAMPLE, 'provinceId', '2');
    expect(a).toMatchObject({ provinceId: '2', districtId: '', subdistrictId: '', postalCode: '', house: '99/1' });
  });
  it('เปลี่ยนอำเภอ ล้างตำบลกับรหัสไปรษณีย์เดิม', () => {
    const a = updateAddress(SAMPLE, 'districtId', '1002');
    expect(a).toMatchObject({ districtId: '1002', subdistrictId: '', postalCode: '' });
  });
  it('เลือกตำบลแล้วได้รหัสไปรษณีย์ของตำบลนั้น', () => {
    let a = updateAddress(emptyAddress(), 'provinceId', '1');
    a = updateAddress(a, 'districtId', '1001');
    a = updateAddress(a, 'subdistrictId', '100101');
    expect(a.postalCode).toBe('10200');
  });
  it('ข้อมูลชุดนี้ทุกตำบลมีรหัสไปรษณีย์เดียว — เลือกตำบลไหนก็ได้รหัสครบ ไม่ต้องเลือกเอง', () => {
    for (const p of thaiProvinces) {
      for (const d of p.districts) {
        for (const sub of d.subdistricts) {
          expect(sub.postalCodes).toHaveLength(1);
          expect(/^\d{5}$/.test(sub.postalCodes[0])).toBe(true);
        }
      }
    }
  });
});

describe('ตรวจที่อยู่ (เซิร์ฟเวอร์ใช้ตัวเดียวกัน)', () => {
  it('อำเภอของจังหวัดอื่น = ไม่รับ', () => {
    expect(() => validateAddress({ ...SAMPLE, provinceId: '2' }, 'ทะเบียนบ้าน')).toThrow(/อำเภอ/);
  });
  it('รหัสไปรษณีย์นอกตำบล = ไม่รับ', () => {
    expect(() => validateAddress({ ...SAMPLE, postalCode: '99999' }, 'ทะเบียนบ้าน')).toThrow(/ไปรษณีย์/);
  });
  it('ไม่มีบ้านเลขที่ / ข้อมูลผิดรูป = ไม่รับ', () => {
    expect(() => validateAddress({ ...SAMPLE, house: '  ' }, 'ทะเบียนบ้าน')).toThrow(/บ้านเลขที่/);
    expect(() => validateAddress(null, 'ทะเบียนบ้าน')).toThrow();
    expect(() => validateAddress({ ...SAMPLE, moo: 5 }, 'ทะเบียนบ้าน')).toThrow();
    expect(() => validateAddress({ ...SAMPLE, soi: 'x'.repeat(81) }, 'ทะเบียนบ้าน')).toThrow();
  });
  it('กรุงเทพฯ ใช้ แขวง/เขต ในข้อความที่อยู่', () => {
    const a = formatAddress(SAMPLE);
    expect(a).toBe('99/1 แขวงพระบรมมหาราชวัง เขตพระนคร กรุงเทพมหานคร 10200');
    expect(formatAddress({ ...SAMPLE, moo: '3', soi: 'สุขใจ 5', road: 'มิตรภาพ' })).toContain('หมู่ 3 ซอย สุขใจ 5 ถนน มิตรภาพ');
    expect(formatAddress(emptyAddress())).toBe('');
  });
});
