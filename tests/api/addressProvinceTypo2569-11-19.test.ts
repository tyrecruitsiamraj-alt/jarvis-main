/**
 * จังหวัดจากที่อยู่ ERP — เจ้าของ 19 พ.ย. 2569 LAO6910002 ขอ Scrap ไม่ได้ "ใบขอขาดจังหวัด" ทั้งที่มี
 * ที่อยู่จริงลงท้าย "เขตสาทร กรุงเทฯ" (ตก พ) · ใบอื่นมีแค่ "แขวง… เขต…" ไม่มีคำว่ากรุงเทพ
 */
import { describe, expect, it } from 'vitest';
import { inferProvinceFromAddress } from '@/lib/parseThaiJobAddress';
import { soScrapMissing } from '@/lib/soScraping';
import type { JobRequest } from '@/types';

describe('จังหวัดจากที่อยู่ใบขอ (ข้อความจริงจาก ERP)', () => {
  it('"กรุงเทฯ" ตก พ = กรุงเทพมหานคร', () => {
    expect(inferProvinceFromAddress('บริษัท แอล เอช มอลล์ แอนด์ โฮเทล จำกัด 1188 อาคารแกรนด์ เซนเตอร์ พอยต์ ลุมพินี ชั้นที่ 15 ถ.พระราม 4 แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทฯ')).toBe('กรุงเทพมหานคร');
  });
  it('มีแค่ "เขต…" ที่เป็นเขตของกรุงเทพจริง = กรุงเทพมหานคร', () => {
    expect(inferProvinceFromAddress('ธนาคารไทยพาณิยช์ รับนาย: หมู่บ้านประชาสิริ ซ.พระราม2 ซอย60/1 ถ.พระราม2 แขวงแสมดำ เขตบางขุนเทียน')).toBe('กรุงเทพมหานคร');
    expect(inferProvinceFromAddress('บริษัท ปัญจพล พัลพ์ อินดัสตรี้ จำกัด (มหาชน) สีลม เขตบางรัก')).toBe('กรุงเทพมหานคร');
  });
  it('ไม่เดาจากคำว่าเขตเฉย ๆ — เขตอุตสาหกรรม/เขตไฟฟ้า ไม่ใช่กรุงเทพ · ชื่อจังหวัดในข้อความชนะ', () => {
    expect(inferProvinceFromAddress('นิคมเวลโกรว์ เขตอุตสาหกรรมเวลโกรว์')).toBeNull();
    expect(inferProvinceFromAddress('ตามพื้นที่ต่างๆ ของ การไฟฟ้าส่วนภูมิภาค เขต 1 ภาคกลาง (สาขา 00326) จังหวัดพระนครศรีอยุธยา')).toBe('พระนครศรีอยุธยา');
    expect(inferProvinceFromAddress('บริษัท โรม อินทิเกรเต็ด ซิสเต็มส์ (ประเทศไทย) จำกัด 101/94,102 เขตอุตสาหกรรมนวนคร หมู่ 20 ถนนพหลโยธิน ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี')).toBe('ปทุมธานี');
  });
  it('ปุ่มขอ Scrap ไม่บอกว่าขาดจังหวัดแล้ว (LAO6910002)', () => {
    const job = {
      id: 'siamraj-sql:LAO6910002',
      request_no: 'LAO6910002',
      staff_title_name: 'พนักงานต้อนรับ',
      request_positions: 1,
      filled_positions: 0,
      cancelled_positions: 0,
      location_address: 'บริษัท แอล เอช มอลล์ แอนด์ โฮเทล จำกัด 1188 อาคารแกรนด์ เซนเตอร์ พอยต์ ลุมพินี ชั้นที่ 15 ถ.พระราม 4 แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทฯ',
    } as unknown as JobRequest;
    expect(soScrapMissing(job)).not.toContain('จังหวัด');
  });
});
