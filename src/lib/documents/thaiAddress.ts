/**
 * ที่อยู่ไทยแบบเลือกตามกัน จังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์ (ฟอร์มส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 *
 * ข้อมูล 77 จังหวัด · 928 อำเภอ · 7,436 ตำบล จาก kongvut/thai-province-data (MIT · ที่มาอยู่ `data/thaiAddresses.source.json`)
 * ฝั่งเซิร์ฟเวอร์ตรวจซ้ำด้วยตัวเดียวกัน (`validateAddress`) — ไม่เชื่อค่าที่หน้าเว็บส่งมา
 * 🔴 ไฟล์นี้ลากข้อมูล ~800KB — หน้าเจ้าหน้าที่ห้าม import (ใช้ข้อความที่อยู่ที่บันทึกไว้ในชุดแทน)
 */
import data from './data/thaiAddresses.json';

export type Subdistrict = { id: string; name: string; prefix: string; postalCodes: string[] };
export type District = { id: string; name: string; prefix: string; subdistricts: Subdistrict[] };
export type Province = { id: string; name: string; districts: District[] };
export type ThaiAddress = {
  house: string;
  moo: string;
  soi: string;
  road: string;
  provinceId: string;
  districtId: string;
  subdistrictId: string;
  postalCode: string;
};

export const thaiProvinces = data as Province[];

export const emptyAddress = (): ThaiAddress => ({
  house: '',
  moo: '',
  soi: '',
  road: '',
  provinceId: '',
  districtId: '',
  subdistrictId: '',
  postalCode: '',
});

export function selectedAddress(address: ThaiAddress) {
  const province = thaiProvinces.find((p) => p.id === address.provinceId);
  const district = province?.districts.find((d) => d.id === address.districtId);
  const subdistrict = district?.subdistricts.find((s) => s.id === address.subdistrictId);
  return { province, district, subdistrict };
}

/** เปลี่ยนช่องบน = ล้างช่องล่างที่ไม่เกี่ยวกันแล้ว · ตำบลที่มีรหัสไปรษณีย์เดียว = เติมให้ */
export function updateAddress(address: ThaiAddress, key: keyof ThaiAddress, value: string): ThaiAddress {
  const next = { ...address, [key]: value };
  if (key === 'provinceId') {
    next.districtId = '';
    next.subdistrictId = '';
    next.postalCode = '';
  }
  if (key === 'districtId') {
    next.subdistrictId = '';
    next.postalCode = '';
  }
  if (key === 'subdistrictId') {
    const { subdistrict } = selectedAddress(next);
    next.postalCode = subdistrict?.postalCodes.length === 1 ? subdistrict.postalCodes[0] : '';
  }
  return next;
}

/** ข้อความที่อยู่บรรทัดเดียว · เลือกไม่ครบ = '' */
export function formatAddress(address: ThaiAddress): string {
  const { province, district, subdistrict } = selectedAddress(address);
  if (!province || !district || !subdistrict || !address.house.trim()) return '';
  return [
    address.house.trim(),
    address.moo.trim() && `หมู่ ${address.moo.trim()}`,
    address.soi.trim() && `ซอย ${address.soi.trim()}`,
    address.road.trim() && `ถนน ${address.road.trim()}`,
    subdistrict.prefix + subdistrict.name,
    district.prefix + district.name,
    province.name,
    address.postalCode,
  ]
    .filter(Boolean)
    .join(' ');
}

/** ตรวจที่อยู่ที่ส่งมา — อำเภอต้องอยู่ในจังหวัด ตำบลต้องอยู่ในอำเภอ รหัสไปรษณีย์ต้องเป็นของตำบล · ผิด = โยนข้อความให้ผู้กรอก */
export function validateAddress(raw: unknown, label: string): ThaiAddress {
  if (!raw || typeof raw !== 'object') throw new Error(`เลือก${label}ให้ครบ`);
  const a = raw as Record<string, unknown>;
  const clean = emptyAddress();
  for (const key of Object.keys(clean) as (keyof ThaiAddress)[]) {
    const v = a[key];
    if (typeof v !== 'string' || v.length > 80) throw new Error(`ตรวจ${label}อีกครั้ง`);
    clean[key] = v.trim();
  }
  if (!clean.house) throw new Error(`กรอกบ้านเลขที่ของ${label}`);
  const { province, district, subdistrict } = selectedAddress(clean);
  if (!province) throw new Error(`เลือกจังหวัดของ${label}`);
  if (!district) throw new Error(`เลือกอำเภอ / เขตให้ตรงกับจังหวัดของ${label}`);
  if (!subdistrict) throw new Error(`เลือกตำบล / แขวงให้ตรงกับอำเภอของ${label}`);
  if (!subdistrict.postalCodes.includes(clean.postalCode)) throw new Error(`เลือกรหัสไปรษณีย์ให้ตรงกับตำบลของ${label}`);
  return clean;
}
