/**
 * คนที่ได้ตรงเกณฑ์ใบขอไหม (เจ้าของ 20 พ.ย. 2569) — 🔴 ด่าน: ตัดสินไม่ได้ต้องมีช่องของตัวเอง ไม่ยุบเป็นผ่าน/ไม่ผ่าน
 */
import { describe, expect, it } from 'vitest';
import { AREA_FIT_LABEL, AREA_UNKNOWN, ageFitOf, areaFitOf, genderFitOf } from './applicantFit';

const J = 'siamraj-sql:OPL6911006';

const bangrak = { area: { province: 'กรุงเทพมหานคร', district: 'บางรัก' }, ageMin: 25, ageMax: 45, gender: 'ชาย' };

describe('พื้นที่', () => {
  it('อำเภอเดียวกัน › จังหวัดเดียวกัน › ภาคเดียวกัน › คนละภาค', () => {
    expect(areaFitOf({ jobId: J, homeProvince: 'กรุงเทพมหานคร', homeDistrict: 'เขตบางรัก' }, bangrak)).toBe('district');
    expect(areaFitOf({ jobId: J, homeProvince: 'กรุงเทพฯ', homeDistrict: 'ดินแดง' }, bangrak)).toBe('province');
    expect(areaFitOf({ jobId: J, homeProvince: 'กรุงเทพมหานคร', homeDistrict: null }, bangrak)).toBe('province');
    expect(areaFitOf({ jobId: J, homeProvince: 'นนทบุรี', homeDistrict: null }, bangrak)).toBe('region');
    expect(areaFitOf({ jobId: J, homeProvince: 'เชียงใหม่', homeDistrict: null }, bangrak)).toBe('far');
  });

  it('เทียบไม่ได้มี 4 เหตุ แยกจากกัน และไม่ถูกนับว่าไกล — ฝั่งใบขอตัดสินก่อนฝั่งผู้สมัคร', () => {
    const home = { homeProvince: 'กรุงเทพมหานคร', homeDistrict: 'บางรัก' };
    // ใบสมัครไม่ผูกใบขอ (สมัครเองที่หน้าเว็บ · กล่องลอย)
    expect(areaFitOf({ jobId: null, ...home }, bangrak)).toBe('noJob');
    // ผูกใบขอ แต่ใบนั้นไม่อยู่ในสำเนาใบขอ (ปิดไปแล้ว · ใบขอชั่วคราว) = ไม่มีรายละเอียดให้เทียบ
    expect(areaFitOf({ jobId: J, ...home }, null)).toBe('noDetail');
    expect(areaFitOf({ jobId: J, ...home }, { area: null })).toBe('noDetail');
    expect(areaFitOf({ jobId: J, ...home }, {})).toBe('noDetail');
    // ใบขออยู่ในสำเนา แต่อ่านที่ตั้งงานไม่ออก
    expect(areaFitOf({ jobId: J, ...home }, { area: { province: null, district: null } })).toBe('noJobArea');
    expect(areaFitOf({ jobId: J, homeProvince: null, homeDistrict: null }, { area: { province: null, district: null } })).toBe('noJobArea');
    // ใบขอรู้ที่ตั้ง แต่ผู้สมัครไม่กรอกที่อยู่
    expect(areaFitOf({ jobId: J, homeProvince: null, homeDistrict: null }, bangrak)).toBe('noHome');
    expect(areaFitOf({ jobId: J, homeProvince: 'ไม่ระบุ', homeDistrict: null }, bangrak)).toBe('noHome');
    // งานไม่รู้อำเภอ = ได้แค่ระดับจังหวัด
    expect(areaFitOf({ jobId: J, homeProvince: 'ชลบุรี', homeDistrict: 'ศรีราชา' }, { area: { province: 'ชลบุรี', district: null } })).toBe('province');
    expect(AREA_FIT_LABEL.district).toBe('อำเภอเดียวกับงาน');
    expect(AREA_FIT_LABEL.far).toBe('คนละภาคกับงาน');
    expect(AREA_UNKNOWN.map((k) => AREA_FIT_LABEL[k])).toEqual(['ใบสมัครไม่ผูกใบขอ', 'ไม่มีรายละเอียดใบขอ', 'ใบขอไม่ระบุที่ตั้งงาน', 'ผู้สมัครไม่กรอกที่อยู่']);
  });
});

describe('อายุ / เพศ', () => {
  it('อายุ: ในช่วง = เข้า · นอกช่วง = ไม่เข้า · ใบขอไม่กำหนด / ไม่รู้อายุ = ช่องของตัวเอง', () => {
    expect([25, 45, 30].map((age) => ageFitOf({ age }, bangrak))).toEqual(['ok', 'ok', 'ok']);
    expect([24, 46].map((age) => ageFitOf({ age }, bangrak))).toEqual(['out', 'out']);
    expect(ageFitOf({ age: null }, bangrak)).toBe('unknown');
    expect(ageFitOf({ age: 60 }, { ageMin: null, ageMax: null })).toBe('noRule');
    expect(ageFitOf({ age: 60 }, null)).toBe('noRule');
    // กำหนดแค่ขั้นต่ำหรือขั้นสูง
    expect([ageFitOf({ age: 60 }, { ageMin: 25, ageMax: null }), ageFitOf({ age: 60 }, { ageMin: null, ageMax: 45 })]).toEqual(['ok', 'out']);
  });

  it('เพศ: ตรง = เข้า · ไม่ตรง = ไม่เข้า · ใบขอไม่กำหนด / ไม่ระบุเพศ = ช่องของตัวเอง', () => {
    expect(genderFitOf({ gender: 'male' }, bangrak)).toBe('ok');
    expect(genderFitOf({ gender: 'female' }, bangrak)).toBe('out');
    expect(genderFitOf({ gender: null }, bangrak)).toBe('unknown');
    expect(genderFitOf({ gender: 'other' }, bangrak)).toBe('unknown');
    expect(genderFitOf({ gender: 'female' }, { gender: null })).toBe('noRule');
  });
});
