import { describe, expect, it } from 'vitest';
import {
  classifyFollowCall,
  followMicroRates,
  stripQuestionClauses,
  summarizeFollowMicro,
  type FollowMicroInput,
} from '@/lib/followCallMicro';

/**
 * ═══ เทสต์ชุดนี้ใช้ **คำพูดจริง** จากผลโทร 37 สาย (11 ก.ย. 2569) ═══
 *
 * เอามาจากตาราง `lumos_result_inbox` ตรง ๆ ไม่ได้แต่งขึ้น เพราะจุดที่ตัวจัดถังพังคือ
 * ภาษาพูดจริงกับสำนวนสรุปของ Lumos ไม่ใช่ประโยคสวย ๆ ที่เราคิดเอง
 *
 * 🔴 กติกาสำคัญที่สุดของไฟล์นี้: **ห้ามมีสายไหนถูกตัดสินผิดฝั่ง**
 * ไม่ชัดให้ตกถัง "ไม่บอกว่าไปหรือไม่ไป" ได้ (คนไปอ่านต่อเอง) แต่คนที่บอกว่าไม่ไป
 * ห้ามโผล่ในถัง "บอกว่าไป" เด็ดขาด — นั่นคือเลขที่เอาไปตัดสินใจหาคนแทน
 */

const call = (over: Partial<FollowMicroInput>): FollowMicroInput => ({
  outcome: 'acknowledged',
  reply: '',
  summary: '',
  ...over,
});

describe('รหัสที่ Lumos ตัดสินมาให้แล้ว', () => {
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

describe('acknowledged — กองที่ต้องอ่านคำพูดเอา', () => {
  it('🔴 "ยังไม่ได้ไป" ต้องเป็น **ไม่ไป** ไม่ใช่ไป (เคสจริง #36)', () => {
    expect(
      classifyFollowCall(
        call({
          summary: 'ผู้รับสายยืนยันว่าเป็นคุณกุลธิดา บุตรสุริย์ และแจ้งว่ายังไม่ได้ไปที่หน่วยงาน One Bangkok',
          reply: 'man · จ้า · โหย ไป โผล่ เลย ไม่ ทัน ได้ ไป อยู่',
        }),
      ),
    ).toBe('said_not_going');
  });

  it('🔴 "ไปหาหมอ ไม่ได้เดินทางไป" ต้องเป็นไม่ไป (เคสจริง #31)', () => {
    expect(
      classifyFollowCall(
        call({ summary: 'ผู้รับสายแจ้งว่ากำลังจะไปหาหมอ ไม่ได้เดินทางไปที่หน่วยงาน TDEM' }),
      ),
    ).toBe('said_not_going');
  });

  it('🔴 ตอบเกาหลีว่า 안 가요 (ไม่ไป) ต้องเป็นไม่ไป (เคสจริง #18)', () => {
    expect(
      classifyFollowCall(
        call({
          summary: "ผู้รับสายตอบว่า \"ไปจ้ะ\" และตอบเป็นภาษาเกาหลีว่า \"안 가요\" (ไม่ไป) จากนั้นวางสาย",
          reply: 'ไป จ้ะ · 안 가요.',
        }),
      ),
    ).toBe('said_not_going');
  });

  it('"on the way" / "กำลังเดินทางอยู่" = บอกว่าไป', () => {
    expect(classifyFollowCall(call({ summary: "ผู้รับสายตอบว่า 'on the way' กำลังเดินทางไปทำงานที่ One Bangkok" }))).toBe(
      'said_going',
    );
    expect(classifyFollowCall(call({ summary: 'บอกว่ากำลังเดินทางอยู่' }))).toBe('said_going');
  });

  it('อาบน้ำ/แต่งตัว/กินข้าว/เพิ่งตื่น = ยังเตรียมตัวอยู่ ไม่ใช่ไป', () => {
    for (const s of [
      'ผู้รับสายแจ้งว่ากำลังอาบน้ำอยู่',
      'บอกว่ากำลังแต่งตัวอยู่',
      'ตอบว่าขอนั่งกินข้าวก่อน',
      'บอกว่าเพิ่งตื่น ยังไม่ได้เตรียมตัว',
    ]) {
      expect(classifyFollowCall(call({ summary: s }))).toBe('getting_ready');
    }
  });

  it('พูดแต่ "ฮัลโหล" แล้วเงียบ = รับแล้วเงียบ (เคสจริง #3)', () => {
    expect(classifyFollowCall(call({ reply: 'ฮัลโหล · ฮัลโหลครับ' }))).toBe('picked_silent');
  });

  it('ไม่มีทั้งสรุปและคำพูด + unresponsive = ไม่รับสาย', () => {
    expect(classifyFollowCall(call({ outcome: 'unresponsive' }))).toBe('no_pickup');
  });

  it('คุยแล้วแต่ฟังไม่ออก = ไม่บอกว่าไปหรือไม่ไป (ห้ามเดาเข้าข้างใคร)', () => {
    expect(
      classifyFollowCall(
        call({ summary: 'ผู้รับสายตอบรับสายและพูดคุยด้วย แต่คำพูดไม่ชัดเจนและไม่ตรงคำถามเรื่องการเดินทางไปหน่วยงาน' }),
      ),
    ).toBe('talked_unclear');
  });
});

describe('🔴 กับดักที่สุดของไฟล์นี้ — สรุปของ Lumos เล่าคำถามติดมาด้วย', () => {
  it('ตัดท่อนคำถามออกก่อนอ่าน', () => {
    expect(stripQuestionClauses('ตอบรับสั้น ๆ ว่า "ค่ะ" ต่อคำถามว่าเตรียมตัวไปทำงานหรือยัง')).toBe(
      'ตอบรับสั้น ๆ ว่า "ค่ะ"',
    );
  });

  it('"ตอบกลับไม่ชัดเจน" ที่ตามหลังคำถามเรื่องเตรียมตัว ⇒ ไม่ชัด ไม่ใช่ไป (เคสจริง #14)', () => {
    expect(
      classifyFollowCall(
        call({
          summary:
            "ผู้รับสายยืนยันชื่อและตอบรับสาย แต่เมื่อถามว่าเตรียมตัวเรียบร้อยหรือยัง ตอบกลับไม่ชัดเจน จากนั้นถามกลับว่า 'ใครคะ' ก่อนวางสาย",
          reply: 'ใช่ค่ะ · ค่ะ นาย นัท 9:20 น. ค่ะ · ใคร คะ?',
        }),
      ),
    ).toBe('talked_unclear');
  });

  /**
   * 🔴 **เปลี่ยนคำตอบที่ถูกต้องของเคสนี้ 15 ก.ย. 2569** — เจ้าของทักว่า
   * *"ไอที่บอกคุยแล้วแต่ไม่บอกว่าไปหรือไม่ไป ฉันก็เห็นเขาบอกว่าไปนะ Success rate เพี้ยนเลย"*
   *
   * บทของ AI ถามคำถามเดียว ("เตรียมตัวไปทำงานแล้วใช่ไหมคะ") ⇒ **"ค่ะ" คือคำตอบว่าไป**
   * ของเดิมตัดท่อนคำถามทิ้งก่อนอ่าน เลยไม่เห็นว่าเขาตอบรับ *เรื่องอะไร*
   */
  it('ตอบสั้น ๆ ว่า "ค่ะ" ต่อคำถามว่าเตรียมตัวหรือยัง ⇒ **บอกว่าไป** (เคสจริง #33)', () => {
    expect(
      classifyFollowCall(
        call({ summary: 'ผู้รับสายตอบรับสั้น ๆ ว่า "ค่ะ" ต่อคำถามว่าเตรียมตัวไปทำงานหรือยัง', reply: 'ค่ะ' }),
      ),
    ).toBe('said_going');
  });

  it('🔴 แต่ "ตอบรับสาย" ไม่ใช่คำตอบรับ — แปลว่ายกหูเฉย ๆ', () => {
    expect(
      classifyFollowCall(
        call({ summary: 'ผู้รับสายยืนยันชื่อและตอบรับสาย แต่ไม่ได้ตอบเรื่องการเตรียมตัวไปทำงาน' }),
      ),
    ).toBe('talked_unclear');
  });

  it('แต่คำตอบจริงที่อยู่หลังคำถามต้องไม่ถูกตัดทิ้ง (เคสจริง #28)', () => {
    expect(
      classifyFollowCall(
        call({ summary: 'ผู้รับสายยืนยันว่าอาบน้ำแล้ว หลังได้รับแจ้งเตือนให้เตรียมตัวไปทำงานที่หน่วยงาน SCB' }),
      ),
    ).toBe('getting_ready');
  });
});

describe('ยอดรวมและอัตรา', () => {
  const calls: FollowMicroInput[] = [
    call({ summary: 'บอกว่ากำลังเดินทางอยู่' }), // ไป
    call({ summary: 'ตอบว่า on the way' }), // ไป
    call({ outcome: 'declined' }), // ไม่ไป
    call({ summary: 'กำลังอาบน้ำอยู่' }), // ยังเตรียมตัว
    call({ outcome: 'no_answer' }), // ไม่รับ
    call({ outcome: 'cancelled' }), // ไม่นับ
  ];

  it('นับถังถูกและไม่เอายกเลิกมารวม', () => {
    const s = summarizeFollowMicro(calls);
    expect(s.said_going).toBe(2);
    expect(s.said_not_going).toBe(1);
    expect(s.getting_ready).toBe(1);
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


/**
 * ═══ ชุดคำจริงจากผลโทร 14-15 ก.ย. 2569 (34 สาย) ═══
 *
 * เจ้าของจับได้ว่าถัง "ไม่บอกว่าไปหรือไม่ไป" มีคนที่บอกว่าไปปนอยู่ 9 สาย
 * ทั้งหมดเป็นสำนวนเดียวกันซ้ำ ๆ — เก็บไว้เป็นด่านกันถอยหลัง
 */
describe('สำนวนจริงที่เคยตกถังผิด (14-15 ก.ย. 2569)', () => {
  const goingCases: Array<[string, string]> = [
    ['ขึ้นตึกทำงานแล้ว', 'ผู้รับสายยืนยันตัวตนว่าเป็นคุณสุเมธ และแจ้งว่าขึ้นตึกทำงานเรียบร้อยแล้ว'],
    ['กำลังจะถึง', 'คุณรัชพลยืนยันตัวตนและแจ้งว่ากำลังจะถึงหน่วยงานสมิติเวชแล้ว'],
    ['กำลังออกเดินทาง', 'ผู้รับสายยืนยันว่ากำลังออกเดินทางไปทำงานแล้ว'],
    ['เตรียมตัวไปทำงานแล้ว', 'ผู้รับสายยืนยันว่าเตรียมตัวไปทำงานที่หน่วยงาน ElioDelRay แล้ว'],
    ['ตอบว่าใช่ต่อคำถามเรื่องเตรียมตัว', 'ผู้รับสายยืนยันว่าเป็นคุณรัชพล และตอบว่าใช่เมื่อถามว่าเตรียมตัวไปทำงานที่สมิติเวชแล้ว'],
    ['ตอบรับสั้น ๆ ว่าครับ', 'ผู้รับสายยืนยันตัวตน และตอบรับสั้น ๆ ว่า "ครับ" เมื่อถูกถามว่าเตรียมตัวไปทำงานแล้วหรือยัง'],
    ['รอรถอยู่ริมถนน', 'คุณชยนต์ยืนยันว่าเตรียมตัวเรียบร้อยแล้ว และกำลังอยู่ริมถนนรอรถเพื่อเดินทางไปทำงาน'],
    ['stand by ที่หน่วยงาน', 'คุณชยนต์ยืนยันว่าถึงหน่วยงานตั้งแต่ 6:00 น. และตอนนี้กำลัง stand by รอผู้การอยู่'],
    ['ไป ทำ', 'คุณสุรพงศ์รับสายและตอบรับว่ากำลังเตรียมตัวไปทำงาน โดยตอบว่า "ครับ" และ "ไป ทำ"'],
  ];
  it.each(goingCases)('🔴 %s ⇒ บอกว่าไป', (_label, summary) => {
    expect(classifyFollowCall(call({ summary }))).toBe('said_going');
  });

  it('🔴 แต่คนที่บอกว่าจะลาออก ยังต้องเป็น "ไม่ไป" เหมือนเดิม', () => {
    expect(
      classifyFollowCall(call({ outcome: 'declined', summary: 'ผู้รับสายแจ้งว่าจะลาออกไป จึงรับทราบและไม่รบกวนอีก' })),
    ).toBe('said_not_going');
  });

  it('🔴 และ "ยังไม่ได้ไป" ห้ามกลายเป็นไป แม้ประโยคจะขึ้นต้นด้วย "ยืนยันว่า"', () => {
    expect(
      classifyFollowCall(call({ summary: 'ผู้รับสายยืนยันว่าเป็นคุณกุลธิดา และแจ้งว่ายังไม่ได้ไปที่หน่วยงาน One Bangkok' })),
    ).toBe('said_not_going');
  });

  it('🔴 "ยังนอนอยู่ ยังไม่ได้เตรียมตัว" ยังต้องเป็นยังเตรียมตัวอยู่', () => {
    expect(
      classifyFollowCall(call({ summary: 'ผู้รับสายยืนยันว่าถูกต้อง แต่บอกว่ายังนอนอยู่ ยังไม่ได้เตรียมตัวเดินทาง' })),
    ).toBe('getting_ready');
  });
});
