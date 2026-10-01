// @vitest-environment node
/**
 * นำเข้าผู้สมัครจาก Excel — ตรรกะต่อแถว (เจ้าของสั่ง 1 ต.ค. 2569 · Choice "ทำ Excel ตัวอย่าง + อัปโหลด")
 *
 * 🔴 ด่าน:
 * - หัวคอลัมน์ไฟล์ตัวอย่าง = ช่องของฟอร์มเพิ่มผู้สมัคร (ต้องกรอกมี *) · อ่านหัวแบบทนช่องว่าง/ดอกจัน
 * - Excel ตัดเลข 0 หน้าเบอร์ทิ้ง (812345678) ต้องเติมคืน
 * - กติกาต่อแถว = ปุ่มเพิ่มผู้สมัคร (ข้อความเดิม) · ประเภทเจาะจง/ใบขับขี่นอกรายการ = บอกแถว ไม่ทิ้งเงียบ
 * - เบอร์ซ้ำในไฟล์ = แถวแรกได้ · เบอร์ที่สมัครเข้ามาภายใน 14 วัน = ข้าม + เหตุผลที่ API ส่งมา (กติกาสมัครซ้ำ)
 */
import { describe, expect, it } from 'vitest';
import {
  IMPORT_COLUMNS,
  importTemplateHeaders,
  importValuesSheet,
  mapImportHeader,
  markBlockedPhones,
  normalizeImportGender,
  normalizeImportPhone,
  planImportRows,
  splitImportLicenses,
  toPreviewRows,
} from '../../src/lib/applicantImport.js';
import { RM_LICENSE_TYPES, RM_SPECIFIC_TYPES } from '../../src/lib/recruitRmMasters.js';

const header = importTemplateHeaders();
const { index } = mapImportHeader(header);
/** แถวตามลำดับคอลัมน์ของไฟล์ตัวอย่าง */
const row = (o: Partial<Record<(typeof IMPORT_COLUMNS)[number]['key'], string>>) =>
  IMPORT_COLUMNS.map((c) => o[c.key] ?? '');

describe('ไฟล์ตัวอย่าง', () => {
  it('หัวคอลัมน์เรียงตามฟอร์มเพิ่มผู้สมัคร · ช่องที่ต้องกรอกมี *', () => {
    expect(header).toEqual([
      'ชื่อ *',
      'นามสกุล *',
      'เบอร์โทร *',
      'อายุ *',
      'เพศ *',
      'LINE ID',
      'จังหวัด',
      'อำเภอ/เขต',
      'ตำแหน่งงานที่สนใจ',
      'ประเภทเจาะจง',
      'วุฒิการศึกษา',
      'ประเภทใบขับขี่',
    ]);
  });

  it('ชีตค่าที่ใช้ได้ = รายการกลางเดิม (ไม่ตั้งชุดใหม่)', () => {
    const sheet = importValuesSheet();
    const col = (i: number) => sheet.slice(1).map((r) => r[i]).filter(Boolean);
    expect(col(0)).toEqual(['ชาย', 'หญิง']);
    expect(col(1)).toEqual([...RM_SPECIFIC_TYPES]);
    expect(col(3)).toEqual([...RM_LICENSE_TYPES]);
  });

  it('อ่านหัวแบบทนช่องว่าง/ดอกจัน/ตัวพิมพ์ · ขาดคอลัมน์ที่ต้องมี = บอกชื่อ', () => {
    expect(mapImportHeader([' ชื่อ ', 'นามสกุล*', 'เบอร์โทร', 'อายุ', 'เพศ', 'line id']).missing).toEqual([]);
    expect(mapImportHeader(['ชื่อ', 'นามสกุล']).missing).toEqual(['เบอร์โทร', 'อายุ', 'เพศ']);
  });
});

describe('แปลงค่าในเซลล์', () => {
  it('🔴 เบอร์: Excel ตัด 0 หน้าทิ้ง ⇒ เติมคืน · +66 ⇒ 0', () => {
    expect(normalizeImportPhone(812345678)).toBe('0812345678');
    expect(normalizeImportPhone('081-234-5678')).toBe('0812345678');
    expect(normalizeImportPhone('66812345678')).toBe('0812345678');
    expect(normalizeImportPhone('21234567')).toBe('21234567');
  });

  it('เพศ ชาย/หญิง (รับตัวย่อและอังกฤษ) · อื่น ๆ = ว่าง', () => {
    expect(normalizeImportGender('ชาย')).toBe('male');
    expect(normalizeImportGender(' หญิง ')).toBe('female');
    expect(normalizeImportGender('F')).toBe('female');
    expect(normalizeImportGender('ไม่ระบุ')).toBe('');
  });

  it('ใบขับขี่หลายใบคั่นด้วย , หรือขึ้นบรรทัดใหม่', () => {
    expect(splitImportLicenses('ใบขับขี่ ท.2, ใบขับขี่บุคคล 5 ปี\nใบขับขี่ ท.3')).toEqual([
      'ใบขับขี่ ท.2',
      'ใบขับขี่บุคคล 5 ปี',
      'ใบขับขี่ ท.3',
    ]);
  });
});

describe('แผนต่อแถว', () => {
  const ok = { first_name: 'สมชาย', last_name: 'ใจดี', phone: '812345678', age: '33', gender: 'ชาย' };

  it('แถวที่ผ่าน ⇒ ค่าเดียวกับปุ่มเพิ่มผู้สมัคร + ผู้รับผิดชอบ/ช่องทางจากป๊อป · เลขแถว Excel (หัว = 1)', () => {
    const plans = planImportRows([row({ ...ok, license_types: 'ใบขับขี่ ท.2' })], index, {
      responsible_name: 'เจ้าหน้าที่ ก',
      channel_id: 'ch-1',
      channel_label: 'Facebook',
    });
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      row: 2,
      ok: true,
      value: {
        full_name: 'สมชาย ใจดี',
        phone: '0812345678',
        age: 33,
        gender: 'male',
        license_types: ['ใบขับขี่ ท.2'],
        responsible_name: 'เจ้าหน้าที่ ก',
        channel_id: 'ch-1',
        channel_label: 'Facebook',
        job_id: null,
      },
    });
  });

  it('ข้อความผิดเดิมของฟอร์ม · แถวว่างทั้งแถวข้ามเงียบ ๆ', () => {
    const plans = planImportRows([row({ ...ok, gender: '' }), row({}), row({ ...ok, phone: '0899', last_name: 'ข' })], index);
    expect(plans.map((p) => [p.row, 'reason' in p ? p.reason : 'ok'])).toEqual([
      [2, 'กรุณาเลือกเพศ'],
      [4, 'กรุณากรอกเบอร์โทรให้ครบ 10 หลัก'],
    ]);
  });

  it('🔴 ประเภทเจาะจง/ใบขับขี่นอกรายการ ⇒ บอกแถว (ไม่ทิ้งค่าเงียบ ๆ)', () => {
    const plans = planImportRows(
      [row({ ...ok, specific_type: 'อะไรสักอย่าง' }), row({ ...ok, phone: '0811111111', license_types: 'ใบขับขี่เรือ' })],
      index,
    );
    expect(plans.map((p) => ('reason' in p ? p.reason : 'ok'))).toEqual([
      'ประเภทเจาะจง "อะไรสักอย่าง" ไม่อยู่ในรายการ',
      'ไม่รู้จักใบขับขี่ "ใบขับขี่เรือ"',
    ]);
  });

  it('🔴 เบอร์ซ้ำในไฟล์ ⇒ แถวแรกได้ แถวหลังข้าม · เบอร์ที่สมัครภายใน 14 วัน ⇒ ข้ามด้วยเหตุผลที่ส่งมา', () => {
    const plans = planImportRows(
      [row(ok), row({ ...ok, first_name: 'สมหญิง' }), row({ ...ok, phone: '0822222222' })],
      index,
    );
    expect(plans.map((p) => ('reason' in p ? p.reason : 'ok'))).toEqual(['ok', 'เบอร์ซ้ำกับแถว 2 ในไฟล์', 'ok']);
    const marked = markBlockedPhones(
      plans,
      new Map([['+66822222222', 'สมัครเข้ามาแล้วภายใน 14 วัน (ได้ตั้งแต่ 9/10/2569)']]),
      (p) => `+66${p.slice(1)}`,
    );
    expect(toPreviewRows(marked)).toEqual([
      { row: 2, name: 'สมชาย ใจดี', phone: '0812345678', ok: true, reason: null },
      { row: 3, name: 'สมหญิง ใจดี', phone: '0812345678', ok: false, reason: 'เบอร์ซ้ำกับแถว 2 ในไฟล์' },
      { row: 4, name: 'สมชาย ใจดี', phone: '0822222222', ok: false, reason: 'สมัครเข้ามาแล้วภายใน 14 วัน (ได้ตั้งแต่ 9/10/2569)' },
    ]);
  });
});
