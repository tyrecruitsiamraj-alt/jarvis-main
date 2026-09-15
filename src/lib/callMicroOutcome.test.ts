import { describe, expect, it } from 'vitest';
import {
  callMicroRates,
  classifyCallMicro,
  FOLLOW_VOCAB,
  INTEREST_VOCAB,
  summarizeCallMicro,
  vocabForPersonRef,
  type CallMicroInput,
} from '@/lib/callMicroOutcome';

/**
 * ═══ เครื่องยนต์กลางของผลโทร — ใช้ได้ทุกงาน (เจ้าของสั่ง 15 ก.ย. 2569) ═══
 *
 * > *"เอามา ๆ แต่ทำไว้สำหรับการโทรอันอื่น ๆ ในอนาคตด้วยนะ"*
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. เครื่องยนต์ตัวเดียว คลังคำคนละชุด — เพิ่มงานใหม่ต้องไม่ต้องแตะตรรกะ
 * 2. คำปฏิเสธมาก่อนคำตอบรับเสมอ ("ไม่สนใจ" มีคำว่า "สนใจ" อยู่ข้างใน)
 * 3. ไม่ชัด = ตกถังไม่ชัด **ห้ามเดาเข้าข้างฝั่งไหน**
 */

const call = (over: Partial<CallMicroInput>): CallMicroInput => ({
  outcome: 'acknowledged',
  reply: '',
  summary: '',
  ...over,
});

describe('งานติดตาม (FOLLOW_VOCAB)', () => {
  it('ตอบว่าไป ⇒ said_yes', () => {
    expect(
      classifyCallMicro(call({ summary: 'ผู้รับสายยืนยันว่าเตรียมตัวเรียบร้อยแล้ว' }), FOLLOW_VOCAB),
    ).toBe('said_yes');
  });

  it('ยังไม่ได้ไป ⇒ said_no', () => {
    expect(
      classifyCallMicro(call({ summary: 'แจ้งว่ายังไม่ได้ไปที่หน่วยงาน' }), FOLLOW_VOCAB),
    ).toBe('said_no');
  });

  it('ยังอาบน้ำอยู่ ⇒ not_yet', () => {
    expect(classifyCallMicro(call({ summary: 'บอกว่ากำลังอาบน้ำอยู่' }), FOLLOW_VOCAB)).toBe(
      'not_yet',
    );
  });
});

describe('งานโทรถามความสนใจ (INTEREST_VOCAB)', () => {
  it('สนใจ ⇒ said_yes', () => {
    expect(
      classifyCallMicro(call({ summary: 'ผู้รับสายแจ้งว่ายังสนใจงานนี้อยู่' }), INTEREST_VOCAB),
    ).toBe('said_yes');
  });

  it('🔴 "ไม่สนใจ" ต้องเป็น said_no — คำนี้มีคำว่า "สนใจ" อยู่ข้างใน', () => {
    expect(
      classifyCallMicro(call({ summary: 'ผู้รับสายบอกว่าไม่สนใจแล้ว ได้งานอื่นแล้ว' }), INTEREST_VOCAB),
    ).toBe('said_no');
  });

  it('ขอคิดดูก่อน ⇒ not_yet (ยังไม่ปฏิเสธ แต่ยังไม่ตกลง)', () => {
    expect(
      classifyCallMicro(call({ summary: 'ผู้รับสายขอคิดดูก่อน จะติดต่อกลับ' }), INTEREST_VOCAB),
    ).toBe('not_yet');
  });

  it('ตอบรับสั้น ๆ ต่อคำถามเรื่องสัมภาษณ์ ⇒ said_yes', () => {
    expect(
      classifyCallMicro(
        call({ summary: 'ผู้รับสายตอบรับสั้น ๆ ว่า "ครับ" เมื่อถามว่าสะดวกมาสัมภาษณ์วันพรุ่งนี้ไหม' }),
        INTEREST_VOCAB,
      ),
    ).toBe('said_yes');
  });

  it('🔴 คลังคำคนละชุดให้ผลคนละแบบกับข้อความเดียวกัน — พิสูจน์ว่าแยกงานกันจริง', () => {
    const input = call({ summary: 'ผู้รับสายบอกว่าไม่สนใจแล้ว' });
    expect(classifyCallMicro(input, INTEREST_VOCAB)).toBe('said_no');
    // งานติดตามไม่รู้จักคำว่า "ไม่สนใจ" ⇒ ต้องตกถังไม่ชัด ไม่ใช่เดาว่าไม่ไป
    expect(classifyCallMicro(input, FOLLOW_VOCAB)).toBe('talked_unclear');
  });
});

describe('เลือกคลังคำจาก person_ref', () => {
  it('follow- ⇒ คลังคำงานติดตาม', () => {
    expect(vocabForPersonRef('follow-abc').key).toBe('follow');
  });

  it('app- / card- / ir- ⇒ คลังคำงานถามความสนใจ', () => {
    for (const ref of ['app-1', 'card-2', 'ir-3', null]) {
      expect(vocabForPersonRef(ref).key).toBe('interest');
    }
  });
});

describe('อัตราทั้งสาม', () => {
  const calls: CallMicroInput[] = [
    call({ summary: 'ยืนยันว่าเตรียมตัวเรียบร้อยแล้ว' }), // ตอบรับ
    call({ summary: 'บอกว่ากำลังเดินทาง' }), // ตอบรับ
    call({ outcome: 'declined' }), // ปฏิเสธ
    call({ summary: 'กำลังอาบน้ำอยู่' }), // ยังไม่พร้อม
    call({ outcome: 'no_answer' }), // ไม่รับสาย
    call({ outcome: 'cancelled' }), // ไม่นับ
  ];

  it('🔴 Success Rate หารด้วยสายที่ได้คุย ไม่ใช่สายทั้งหมด', () => {
    const s = summarizeCallMicro(calls, FOLLOW_VOCAB);
    expect(s.withResult).toBe(5);
    expect(s.talked).toBe(4);
    const r = callMicroRates(s);
    expect(r.successRate).toBeCloseTo((2 / 4) * 100, 5);
    expect(r.reachRate).toBeCloseTo((4 / 5) * 100, 5);
  });

  it('ไม่มีสายที่ได้คุยเลย ⇒ null ไม่ใช่ 0% (0 อ่านว่าแย่ ทั้งที่แปลว่ายังไม่รู้)', () => {
    const r = callMicroRates(summarizeCallMicro([call({ outcome: 'no_answer' })], FOLLOW_VOCAB));
    expect(r.successRate).toBeNull();
  });
});
