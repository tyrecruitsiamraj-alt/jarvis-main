import { describe, expect, it } from 'vitest';
import {
  classifyFollowCall,
  followMicroRates,
  stripQuestionClauses,
  summarizeFollowMicro,
  type FollowMicroInput,
} from '@/lib/followCallMicro';

/**
 * ═══ ถังผลโทรงานติดตาม — ยึดรหัสผลของ Lumos อย่างเดียว (เจ้าของ 30 ต.ค. 2569) ═══
 * confirmed = ไป · declined = ไม่ไป · acknowledged = รับสายแล้ว · ไม่อ่านสรุปมาตัดสินเอง
 */

const call = (over: Partial<FollowMicroInput>): FollowMicroInput => ({
  outcome: 'acknowledged',
  reply: '',
  summary: '',
  ...over,
});

describe('รหัสที่ Lumos ตัดสินมาให้แล้ว', () => {
  it('confirmed = บอกว่าไป', () => {
    expect(classifyFollowCall(call({ outcome: 'confirmed' }))).toBe('said_going');
  });

  it('declined = บอกว่าไม่ไป', () => {
    expect(
      classifyFollowCall(
        call({ outcome: 'declined', summary: 'ผู้รับสายยืนยันว่าไม่ได้ไปหน่วยงาน Ford เนื่องจากท้องเสีย' }),
      ),
    ).toBe('said_not_going');
  });

  it('wrong_person = ไม่ใช่เจ้าตัว', () => {
    expect(classifyFollowCall(call({ outcome: 'wrong_person' }))).toBe('wrong_person');
  });

  it('no_answer / busy / failed = ไม่รับสาย', () => {
    for (const o of ['no_answer', 'busy', 'failed']) {
      expect(classifyFollowCall(call({ outcome: o }))).toBe('no_pickup');
    }
  });

  it('ยกเลิก หรือยังไม่มีผล ⇒ ไม่เข้าถังไหนเลย (null) — ห้ามเอาไปหาร', () => {
    expect(classifyFollowCall(call({ outcome: 'cancelled' }))).toBeNull();
    expect(classifyFollowCall(call({ outcome: null }))).toBeNull();
  });
});

/**
 * ═══ acknowledged = รับสายแล้ว ไม่อ่านสรุปมาตัดสินไป/ไม่ไป (เจ้าของ 30 ต.ค. 2569) ═══
 * *"มาคิดเองแล้วเวลาผิดเราก็ผิด มันต้องเอาตาม lumos"* — สรุปเดิมที่เคยใช้เป็นด่าน ตอนนี้ต้องไม่เปลี่ยนถังเลย
 */
describe('acknowledged — ยึดรหัสของ Lumos', () => {
  const summaries = [
    'ผู้รับสายยืนยันว่ายังอยู่บ้านเจ้านาย ยังไม่ได้เดินทางไปถึงหน่วยงาน krungsri', // เคสคุณมณเฑียร 30 ต.ค.
    'ผู้รับสายยืนยันว่าเป็นคุณกุลธิดา บุตรสุริย์ และแจ้งว่ายังไม่ได้ไปที่หน่วยงาน One Bangkok',
    'ผู้รับสายแจ้งว่ากำลังจะไปหาหมอ ไม่ได้เดินทางไปที่หน่วยงาน TDEM',
    "ผู้รับสายตอบว่า 'on the way' กำลังเดินทางไปทำงานที่ One Bangkok",
    'ผู้รับสายแจ้งว่ากำลังอาบน้ำอยู่',
    'ผู้รับสายตอบรับสั้น ๆ ว่า "ค่ะ" ต่อคำถามว่าเตรียมตัวไปทำงานหรือยัง',
    'คุณชยนต์ยืนยันว่าถึงหน่วยงานตั้งแต่ 6:00 น. และตอนนี้กำลัง stand by รอผู้การอยู่',
  ];
  it.each(summaries)('🔴 %s ⇒ รับสายแล้ว (talked_unclear)', (summary) => {
    expect(classifyFollowCall(call({ summary }))).toBe('talked_unclear');
  });

  it('ไม่มีทั้งสรุปและคำพูด + unresponsive = ไม่รับสาย (เหมือนเดิม)', () => {
    expect(classifyFollowCall(call({ outcome: 'unresponsive' }))).toBe('no_pickup');
  });

  it('ตัดท่อนคำถามออกก่อนอ่าน (ตัวช่วยกลาง งานโทรถามความสนใจยังใช้)', () => {
    expect(stripQuestionClauses('ตอบรับสั้น ๆ ว่า "ค่ะ" ต่อคำถามว่าเตรียมตัวไปทำงานหรือยัง')).toBe(
      'ตอบรับสั้น ๆ ว่า "ค่ะ"',
    );
  });
});

describe('ยอดรวมและอัตรา', () => {
  const calls: FollowMicroInput[] = [
    call({ outcome: 'confirmed' }), // ไป
    call({ outcome: 'confirmed' }), // ไป
    call({ outcome: 'declined' }), // ไม่ไป
    call({ summary: 'กำลังอาบน้ำอยู่' }), // รับสายแล้ว (ไม่อ่านสรุป)
    call({ outcome: 'no_answer' }), // ไม่รับ
    call({ outcome: 'cancelled' }), // ไม่นับ
  ];

  it('นับถังถูกและไม่เอายกเลิกมารวม', () => {
    const s = summarizeFollowMicro(calls);
    expect(s.said_going).toBe(2);
    expect(s.said_not_going).toBe(1);
    expect(s.getting_ready).toBe(0);
    expect(s.talked_unclear).toBe(1);
    expect(s.no_pickup).toBe(1);
    expect(s.withResult).toBe(5);
    expect(s.pickedUp).toBe(4);
    expect(s.talked).toBe(4);
  });

  it('🔴 Success Rate หารด้วย "สายที่ได้คุย" ไม่ใช่สายทั้งหมด', () => {
    const r = followMicroRates(summarizeFollowMicro(calls));
    expect(r.successRate).toBeCloseTo((2 / 4) * 100, 5);
    expect(r.reachRate).toBeCloseTo((4 / 5) * 100, 5);
    expect(r.talkRate).toBeCloseTo((4 / 5) * 100, 5);
  });

  it('ยังไม่มีสายไหนมีผล ⇒ อัตราเป็น null ไม่ใช่ 0 (0 อ่านว่าแย่ ทั้งที่แปลว่ายังไม่รู้)', () => {
    const r = followMicroRates(summarizeFollowMicro([]));
    expect(r.successRate).toBeNull();
    expect(r.reachRate).toBeNull();
    expect(r.talkRate).toBeNull();
  });
});
