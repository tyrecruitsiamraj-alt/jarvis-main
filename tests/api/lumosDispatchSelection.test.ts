import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  parseIdList,
  parseDispatchInput,
  resolveBoardSelection,
  type BoardSelectionInput,
} from '../../api/_handlers/lumos-dispatch';

const root = path.join(import.meta.dirname, '../..');

describe('parseIdList', () => {
  it('รับเฉพาะจำนวนเต็มบวก และตัดค่าซ้ำ', () => {
    expect(parseIdList([3, '5', 3, 0, -2, 'abc', null, 7.5])).toEqual([3, 5]);
  });
  it('คืน [] เมื่อไม่ใช่ array', () => {
    expect(parseIdList(undefined)).toEqual([]);
    expect(parseIdList('12')).toEqual([]);
  });
});

describe('parseDispatchInput', () => {
  it('ผ่านเมื่อมี jobId และเลือกคนอย่างน้อย 1 คน', () => {
    const out = parseDispatchInput({
      jobId: 'siamraj-sql:DS5812003',
      boardCardIds: [11, 12],
      irecruitIds: ['99'],
    });
    expect(out.error).toBeNull();
    expect(out.value).toEqual({
      jobId: 'siamraj-sql:DS5812003',
      boardCardIds: [11, 12],
      irecruitIds: [99],
    });
  });

  it('ต้องมี jobId', () => {
    expect(parseDispatchInput({ boardCardIds: [1] }).error).toBe('jobId is required');
    expect(parseDispatchInput(null).error).toBe('Invalid JSON body');
  });

  it('ต้องเลือกอย่างน้อย 1 คน — กันยิงคิวเปล่า', () => {
    const out = parseDispatchInput({ jobId: 'j1', boardCardIds: [], irecruitIds: [] });
    expect(out.error).toContain('อย่างน้อย 1 คน');
    expect(out.value).toBeNull();
  });

  it('จำกัดครั้งละไม่เกิน 50 คน — กันเทคนเข้าคิวหลักพันเหมือนของเดิม', () => {
    const many = Array.from({ length: 51 }, (_, i) => i + 1);
    const out = parseDispatchInput({ jobId: 'j1', boardCardIds: many, irecruitIds: [] });
    expect(out.error).toContain('ไม่เกิน 50');
    expect(out.value).toBeNull();
  });
});

describe('resolveBoardSelection — ตรวจกับ pool สด ไม่ใช่ผลแมทที่บันทึกไว้', () => {
  const pool: BoardSelectionInput[] = [
    { card_id: 10, first_name: 'สมชาย', last_name: 'ใจดี', nick_name: null, mobile: '0812345678' },
    // คนที่เพิ่งเพิ่มเข้า pool วันนี้ — ยังไม่เคยผ่าน AI แมทของใบขอไหนเลย
    { card_id: 77, first_name: 'ขจร', last_name: 'หลักดี', nick_name: null, mobile: '0909809207' },
    { card_id: 88, first_name: null, last_name: null, nick_name: 'เล็ก', mobile: null },
    { card_id: 99, first_name: null, last_name: null, nick_name: null, mobile: '0800000000' },
  ];

  it('คนเพิ่มใหม่ที่ยังไม่อยู่ในผลแมท ต้องส่งได้ (นี่คือกรณีใบขอด่วน)', () => {
    const out = resolveBoardSelection(pool, [77]);
    expect(out.missing).toEqual([]);
    expect(out.selected).toEqual([{ card_id: 77, full_name: 'ขจร หลักดี', mobile: '0909809207' }]);
  });

  it('เบอร์ที่ใช้มาจาก pool (ล่าสุด) ไม่ใช่ snapshot', () => {
    const updated: BoardSelectionInput[] = [{ ...pool[0], mobile: '0899999999' }];
    expect(resolveBoardSelection(updated, [10]).selected[0].mobile).toBe('0899999999');
  });

  it('คนที่หลุดจาก pool แล้ว (ย้ายคอลัมน์/ลงงาน) เข้า missing ไม่ถูกส่ง', () => {
    const out = resolveBoardSelection(pool, [10, 4242]);
    expect(out.missing).toEqual([4242]);
    expect(out.selected.map((s) => s.card_id)).toEqual([10]);
  });

  it('ชื่อ fallback: ไม่มีชื่อ-นามสกุล → ชื่อเล่น → เลขการ์ด', () => {
    const out = resolveBoardSelection(pool, [88, 99]);
    expect(out.selected.map((s) => s.full_name)).toEqual(['เล็ก', 'การ์ด #99']);
  });

  it('คนไม่มีเบอร์ยังผ่านการตรวจ pool แต่จะถูกกันตอนสร้าง payload (mobile = null)', () => {
    expect(resolveBoardSelection(pool, [88]).selected[0].mobile).toBeNull();
  });
});

/**
 * ต้องมี 2 ทางอยู่คู่กัน: auto-send จาก flow matching + ส่งเองแบบเลือก (ตอนด่วน)
 * เทสต์นี้กันการเผลอถอดทางใดทางหนึ่งออก
 *
 * ⚠️ auto-send **ต้องอยู่ในโค้ดแต่ถูกครอบด้วยสวิตช์โหมด** (isAutoDispatchEnabled)
 * ค่าเริ่มต้นคือ manual จึงไม่โทรเองจนกว่าจะเปิดที่หน้าตั้งค่า
 * เคยถอด call ออกตรง ๆ ครั้งหนึ่ง (commit eb8c386) ซึ่งทำให้ต้องเขียนใหม่ทั้งชุดตอนอยากเปิด
 */
describe('เส้นทางส่งเข้าคิว Lumos', () => {
  const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');

  it('auto-send: boardCandidateMatcher ยังส่งเองหลังแมทเสร็จ', () => {
    expect(read('api/_lib/boardCandidateMatcher.ts')).toMatch(/enqueueLumosReminderForBoardMatch\(job, result\)/);
  });

  it('auto-send: handler ค้นหา iRecruit ยังส่งเองหลังค้นเสร็จ', () => {
    expect(read('api/_handlers/matching-irecruit-candidates.ts')).toMatch(/enqueueLumosInterviewForIrecruit\(/);
  });

  it('ส่งเอง: handler lumos-dispatch ใช้เส้น ForSelected ทั้งสองช่อง', () => {
    const dispatch = read('api/_handlers/lumos-dispatch.ts');
    expect(dispatch).toMatch(/enqueueLumosReminderForSelected/);
    expect(dispatch).toMatch(/enqueueLumosInterviewForSelected/);
  });

  it('ส่งเอง: ชื่อ/เบอร์ต้องมาจากฝั่ง server เท่านั้น — ห้ามอ่านจาก body', () => {
    const dispatch = read('api/_handlers/lumos-dispatch.ts');
    // body รับได้แค่ jobId + id list · ห้ามมีการอ่านชื่อ/เบอร์จาก body เข้า payload
    expect(dispatch).not.toMatch(/body\.(recipient_phone|phone|mobile|recipient_name|full_name)/);
    expect(dispatch).toMatch(/listBoardReadyCandidates/);
    expect(dispatch).toMatch(/listRecruitCandidatesByIds/);
  });

  it('auto-send ต้องเรียกผ่านตรรกะเดียวกับส่งเอง (ไม่แตกสองทาง)', () => {
    const lib = read('api/_lib/lumosDispatch.ts');
    const autoBlock = lib.slice(lib.indexOf('export async function enqueueLumosReminderForBoardMatch'));
    expect(autoBlock).toMatch(/enqueueLumosReminderForSelected/);
  });

  /**
   * ทุกจุดที่ส่งอัตโนมัติต้องถามสวิตช์ก่อน — ถ้าใครถอด if ออก ระบบจะกลับไปโทรเองทันที
   * ที่ deploy โดยไม่มีใครสั่ง (กู้คืนไม่ได้เพราะสายโทรออกไปแล้ว)
   */
  it('auto-send ทุกจุดต้องถูกครอบด้วยสวิตช์โหมด (isAutoDispatchEnabled)', () => {
    const cases: Array<[string, string]> = [
      ['api/_lib/boardCandidateMatcher.ts', 'board_match'],
      ['api/_handlers/matching-irecruit-candidates.ts', 'irecruit_search'],
      ['api/_handlers/follow.ts', 'follow_entry'],
    ];
    for (const [file, trigger] of cases) {
      const src = read(file);
      expect(src).toMatch(/isAutoDispatchEnabled/);
      expect(src).toContain(`isAutoDispatchEnabled('${trigger}')`);
    }
  });

  it('follow: สร้างรายการติดตามแล้วส่งให้ Lumos ได้ (อยู่ใต้สวิตช์)', () => {
    const src = read('api/_handlers/follow.ts');
    expect(src).toMatch(/enqueueFollowReminder\(/);
  });

  it('ค่าเริ่มต้นของทุกจุดต้องเป็น manual — ห้าม default เป็น auto', () => {
    const src = read('src/lib/lumosDispatchMode.ts');
    const block = src.slice(src.indexOf('DEFAULT_LUMOS_DISPATCH_MODE'));
    const head = block.slice(0, block.indexOf('};'));
    expect(head).not.toMatch(/'auto'/);
    for (const t of ['board_match', 'irecruit_search', 'follow_entry']) {
      expect(head).toContain(`${t}: 'manual'`);
    }
  });
});
