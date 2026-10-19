// @vitest-environment node
/**
 * รายชื่อให้ AI โทร ตั้งผ่านจอ (เจ้าของเลือกทำ 18 ต.ค. 2569 — เดิมตั้งในฐานข้อมูลตรง ๆ)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aiPhonesToText, normalizeReplaceCallRule, parseAiPhoneLines } from '../../src/lib/irecruitReplaceSync';
import { buildReplaceNameOfPhone } from '../../src/components/follow/ReplaceAiPhonesDialog';

const read = (p: string) => readFileSync(p, 'utf8');

describe('parseAiPhoneLines — วางแบบที่ส่งกันในแชตได้เลย', () => {
  it('บรรทัดละคน · เบอร์แรก = คนไปแทน · เบอร์สอง = ฉุกเฉิน · ชื่อข้าม · ขีด/เว้นวรรคในเบอร์ได้', () => {
    const out = parseAiPhoneLines(
      ['ทดสอบ หนึ่ง 081-234-5678 ฉุกเฉิน พี่เอ 089 876 5432', '', '  0823456789  ', '+66834567890'].join('\n'),
    );
    expect(out.bad).toEqual([]);
    expect(out.phones).toEqual([
      { phone: '0812345678', emergency: '0898765432' },
      { phone: '0823456789', emergency: null },
      { phone: '0834567890', emergency: null },
    ]);
  });
  it('บรรทัดไม่มีเบอร์มือถือ = อ่านไม่ออก (ห้ามทิ้งเงียบ) · เบอร์ซ้ำเก็บอันแรก', () => {
    const out = parseAiPhoneLines('ทดสอบ ไม่มีเบอร์\n0812345678\n081 234 5678 ฉุกเฉิน 0898765432\n12345');
    expect(out.bad).toEqual(['ทดสอบ ไม่มีเบอร์', '12345']);
    expect(out.phones).toEqual([{ phone: '0812345678', emergency: null }]);
  });
  it('เบอร์ฉุกเฉินซ้ำเบอร์ตัวเอง = ไม่มีฉุกเฉิน', () => {
    expect(parseAiPhoneLines('0812345678 0812345678').phones).toEqual([{ phone: '0812345678', emergency: null }]);
  });
  it('กลับไปกลับมาได้ค่าเดิม (ข้อความในช่อง ↔ รายชื่อที่เก็บ)', () => {
    const list = [
      { phone: '0812345678', emergency: '0898765432' },
      { phone: '0823456789', emergency: null },
    ];
    expect(parseAiPhoneLines(aiPhonesToText(list)).phones).toEqual(list);
    expect(normalizeReplaceCallRule({ aiPhones: list }).aiPhones).toEqual(list);
  });
});

describe('มีคำว่า ฉุกเฉิน = เบอร์หลังคำนี้เป็นเบอร์ฉุกเฉินเสมอ (รายชื่อจริง 18 ต.ค. 2569)', () => {
  it('บรรทัดที่มีแต่เบอร์ฉุกเฉิน = ไม่มีเบอร์คนไปแทน (เดิมอ่านเบอร์ฉุกเฉินเป็นเบอร์คนไปแทน)', () => {
    const out = parseAiPhoneLines('ทดสอบ สอง   ฉุกเฉิน พี่บี0898765432\nทดสอบ หนึ่ง 0812345678 ฉุกเฉิน อิ๊งค์ 0823456789');
    expect(out.bad).toEqual(['ทดสอบ สอง   ฉุกเฉิน พี่บี0898765432']);
    expect(out.phones).toEqual([{ phone: '0812345678', emergency: '0823456789' }]);
  });
});

describe('หลังคำว่า ฉุกเฉิน ใส่ชื่อเจ้าหน้าที่แทนเบอร์ได้ (เจ้าของ 19 ต.ค. 2569)', () => {
  const staff = [
    { name: 'อ๋อม', phone: '+66812340001' },
    { name: 'แป้ง', phone: '+66812340002' },
  ];
  it('มี/ไม่มีคำว่า พี่ ก็ได้ · มีเบอร์อยู่แล้วใช้เบอร์ก่อน · ไม่เจอชื่อ = ไม่มีฉุกเฉิน', () => {
    const out = parseAiPhoneLines(
      ['ทดสอบ หนึ่ง 0812345678 ฉุกเฉิน พี่อ๋อม', '0823456789 ฉุกเฉิน แป้ง', '0834567890 ฉุกเฉิน แป้ง 0899999999', '0845678901 ฉุกเฉิน ใครก็ไม่รู้'].join('\n'),
      staff,
    );
    expect(out.phones).toEqual([
      { phone: '0812345678', emergency: '0812340001' },
      { phone: '0823456789', emergency: '0812340002' },
      { phone: '0834567890', emergency: '0899999999' },
      { phone: '0845678901', emergency: null },
    ]);
  });
  it('ช่องเลือกในฟอร์มคนเริ่มงานใช้คำว่า "เจ้าหน้าที่" (เดิม "เจ้าหน้าที่ที่ติดตามสายที่ N")', () => {
    const page = read('src/pages/follow/FollowPage.tsx');
    expect(page).not.toContain('label={`เจ้าหน้าที่ที่ติดตามสายที่');
    expect(page).toContain('label="เจ้าหน้าที่"');
    expect(read('src/components/follow/ReplaceAiPhonesDialog.tsx')).toContain('<FieldSelect');
  });
});

describe('ชื่อคนไปแทนในตัวอย่าง', () => {
  it('เทียบเบอร์ 9 หลักท้าย', () => {
    const nameOf = buildReplaceNameOfPhone([{ recipient_phone: '+66812345678', recipient_name: 'ทดสอบ หนึ่ง' }]);
    expect(nameOf('0812345678')).toBe('ทดสอบ หนึ่ง');
    expect(nameOf('0899999999')).toBeNull();
  });
});

describe('PATCH /api/irecruit-replace-sync รับรายชื่อ', () => {
  const src = read('api/_handlers/irecruit-replace-sync.ts');
  it('ตั้งธงใช้กับสายที่มีอยู่ครั้งเดียว + ปฏิเสธเบอร์อ่านไม่ออก/วันผิดรูป + audit แยก', () => {
    expect(src).toContain('...(hasPhones ? { aiPhonesApplyPending: true } : {})');
    expect(src).toContain("'มีเบอร์ที่อ่านไม่ออกหรือซ้ำกันในรายชื่อ'");
    expect(src).toContain("'วันเข้างานต้องเป็น YYYY-MM-DD'");
    expect(src).toContain("'irecruit_replace_sync.ai_phones'");
  });
  it('ปุ่มอยู่หัวแท็บส่งคนแทน ข้างปุ่มเวลาโทร (หัวหน้างานขึ้นไป)', () => {
    const page = read('src/pages/follow/FollowPage.tsx');
    expect(page).toContain('<ReplaceAiPhonesDialog');
    expect(read('src/components/follow/ReplaceAiPhonesDialog.tsx')).toContain('รายชื่อ AI โทร {value.aiPhones.length}');
  });
});
