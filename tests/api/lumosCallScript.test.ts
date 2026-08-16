// @vitest-environment node
/**
 * บทพูดของ AI 3 ชุด (เจ้าของสั่ง 16 ส.ค. 2569)
 *
 * ทำไมต้องมีเทสต์ชุดนี้: ไฟล์นี้คือ **คำพูดที่ไปถึงหูคนจริง** — พังแล้วไม่มี error
 * ไม่มี log ไม่มีตัวเลขไหนเพี้ยน มีแต่คนวางสาย · สิ่งที่ล็อกไว้คือข้อตกลงกับเจ้าของ
 * (แนะนำตัวทุกสาย · ไม่พูดเลขที่ไม่รู้หน่วย · ถามเหตุผลตอนปฏิเสธ · ไม่เกินเพดาน schema)
 */
import { describe, expect, it } from 'vitest';
import {
  CALLER_ORG,
  DECLINE_REASON_CHOICES,
  EXTRA_INFO_PREFIX,
  KNOWN_PLACEHOLDERS,
  MAX_QUESTIONS,
  appendExtraInfoToPayload,
  buildExtraInfoSentence,
  buildFollowMessage,
  buildOfferMessage,
  buildOfferQuestions,
  buildScreeningQuestions,
  renderLine,
  renderLines,
  speakablePhoneTh,
} from '../../api/_lib/lumosCallScript.js';
import { CALL_SCRIPT_TEMPLATES } from '../../api/_lib/lumosCallScript.templates.js';

const FACTS = {
  candidateName: 'สมชาย ใจดี',
  position: 'พนักงานขับรถ',
  unit: 'บริษัท ก จำกัด',
  placeForTravel: 'โรงงานบางปะกง',
  workSchedule: 'จันทร์-ศุกร์ 08:00-17:00',
  needsOwnVehicle: true,
  startDate: '1 ก.ย. 2569',
};

describe('ไฟล์ template ที่เจ้าของแก้เอง — ด่านกันพิมพ์ผิด', () => {
  /** ทุกข้อความในไฟล์ template (ทั้งที่เป็นลิสต์และที่เป็นก้อน) */
  function allTemplateStrings(): string[] {
    const out: string[] = [];
    const walk = (v: unknown) => {
      if (typeof v === 'string') out.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(CALL_SCRIPT_TEMPLATES);
    return out;
  }

  it('🔴 ไม่มีตัวแปรที่ระบบไม่รู้จัก — พิมพ์ผิดแล้วคำถามข้อนั้นจะหายเงียบ ๆ', () => {
    const unknown: string[] = [];
    for (const s of allTemplateStrings()) {
      for (const m of s.matchAll(/\{([^{}]+)\}/g)) {
        if (!KNOWN_PLACEHOLDERS.includes(m[1])) unknown.push(`${m[1]} (ในบรรทัด "${s.slice(0, 40)}…")`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('🔴 ไม่มีใครพิมพ์ตัวเลขรายได้ลงไปในบทเอง (ต้องใช้ {รายได้ต่อเดือน} เท่านั้น)', () => {
    const offenders = allTemplateStrings().filter((s) => /\d[\d,]*\s*บาท/.test(s) && !s.includes('{รายได้ต่อเดือน}'));
    expect(offenders).toEqual([]);
  });

  it('🔴 ไม่มีคำฝั่งหักหลุดเข้าบท (ค่าปรับ · มาสาย · ขาดงาน · ภาษี · ประกันสังคม)', () => {
    const banned = /ค่าปรับ|มาสาย|ขาดงาน|ภาษี|ประกันสังคม/;
    expect(allTemplateStrings().filter((s) => banned.test(s))).toEqual([]);
  });

  it('แต่ละบทไม่เกินเพดาน (เผื่อ 1 ข้อให้ประโยครายได้ที่เติมตอนโทร)', () => {
    expect(CALL_SCRIPT_TEMPLATES.สัมภาษณ์เบื้องต้น.length).toBeLessThanOrEqual(MAX_QUESTIONS);
    expect(CALL_SCRIPT_TEMPLATES.เสนองาน.length).toBeLessThanOrEqual(MAX_QUESTIONS);
    expect(MAX_QUESTIONS).toBeLessThan(15);
  });

  it('คำว่า "แจ้งเพิ่มเติมครับ" ยังอยู่ — เป็นตัวกันไม่ให้พูดซ้ำตอนเสิร์ฟรอบสอง', () => {
    expect(EXTRA_INFO_PREFIX).toContain('แจ้งเพิ่มเติมครับ');
  });
});

describe('กฎการประกอบบท', () => {
  it('ตัวแปรไม่มีค่า = ทิ้งทั้งบรรทัด (ไม่ใช่เหลือช่องว่างค้าง)', () => {
    expect(renderLine('เวลาทำงาน {เวลาทำงาน} สะดวกไหมครับ', {})).toBeNull();
    expect(renderLine('เวลาทำงาน {เวลาทำงาน} สะดวกไหมครับ', { เวลาทำงาน: null })).toBeNull();
  });

  it('ตัวแปรที่เป็นค่าว่าง = เก็บบรรทัดไว้ (ใช้กับตัวแปรธง/ตอนไม่รู้ชื่อ)', () => {
    expect(renderLine('สวัสดีครับ {ชื่อผู้รับ}ยินดีครับ', { ชื่อผู้รับ: '' })).toBe('สวัสดีครับ ยินดีครับ');
  });

  it('ลบคำถามในไฟล์จนหมด = ถอยไปใช้คำถามสำรอง ไม่ปล่อยให้สายเงียบ', () => {
    const out = renderLines([], { ผู้โทร: 'ก', ชื่อผู้รับ: '', ตำแหน่ง: 'ตำแหน่งข', หน่วยงาน: 'ค' });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('สนใจฟังรายละเอียดไหมครับ');
  });

  it('ใส่คำถามเกินเพดาน = ตัดท้ายทิ้ง (schema ไม่ผ่าน = Lumos ปัดทิ้งทั้งรายการ)', () => {
    const many = Array.from({ length: 30 }, (_, i) => `ข้อ ${i}`);
    expect(renderLines(many, {})).toHaveLength(MAX_QUESTIONS);
  });
});

describe('Part 1 · สัมภาษณ์เบื้องต้น (เลนสรรหา)', () => {
  it('แนะนำตัวว่าโทรจากไหน + เรียกชื่อ + บอกตำแหน่งกับหน่วยงานในข้อแรก', () => {
    const q = buildScreeningQuestions(FACTS);
    expect(q[0]).toContain(CALLER_ORG);
    expect(q[0]).toContain('คุณสมชาย ใจดี');
    expect(q[0]).toContain('พนักงานขับรถ');
    expect(q[0]).toContain('บริษัท ก จำกัด');
  });

  it('ถามเดินทางโดยระบุสถานที่จริง ไม่ถามลอย ๆ', () => {
    const q = buildScreeningQuestions(FACTS).join(' | ');
    expect(q).toContain('โรงงานบางปะกง');
  });

  it('ถามเวลาทำงาน/เรื่องรถ เฉพาะเมื่อใบขอมีข้อมูล', () => {
    const withAll = buildScreeningQuestions(FACTS).join(' | ');
    expect(withAll).toContain('จันทร์-ศุกร์ 08:00-17:00');
    expect(withAll).toContain('รถของตัวเอง');

    // ⚠️ เทียบทั้งข้อ ไม่ใช่ substring — คำว่า "เวลาทำงาน" โผล่ในช้อยส์เหตุผลด้วย
    // ("เวลาทำงานไม่สะดวก") assert แบบหลวมจะผ่านทั้งที่คำถามยังอยู่
    const bare = buildScreeningQuestions({ ...FACTS, workSchedule: '', needsOwnVehicle: false });
    expect(bare.some((q) => q.startsWith('เวลาทำงาน '))).toBe(false);
    expect(bare.some((q) => q.includes('รถของตัวเอง'))).toBe(false);
  });

  it('ถามเหตุผลตอนไม่สนใจ พร้อมอ่านช้อยส์ให้ฟังครบ 5 ข้อ (ML ขั้น 1)', () => {
    const q = buildScreeningQuestions(FACTS).join(' | ');
    for (const choice of DECLINE_REASON_CHOICES) expect(q).toContain(choice);
  });

  it('ปิดสายด้วยการบอกขั้นถัดไป', () => {
    const q = buildScreeningQuestions(FACTS);
    expect(q[q.length - 1]).toContain('เจ้าหน้าที่');
  });

  it('ยังถามค่าแรงที่คาดหวัง (คนกลุ่มนี้ยังไม่เคยเห็นเงื่อนไขงาน)', () => {
    expect(buildScreeningQuestions(FACTS).join(' | ')).toContain('คาดหวัง');
  });

  it('ไม่เกินเพดาน schema แม้รวมประโยคที่เติมตอนเสิร์ฟ', () => {
    expect(buildScreeningQuestions(FACTS).length + 1).toBeLessThanOrEqual(15);
  });

  it('🔴 ไม่พูดตัวเลขรายได้ — หน่วยยังไม่รู้ตอนประกอบ payload', () => {
    const q = buildScreeningQuestions(FACTS).join(' | ');
    expect(q).not.toMatch(/รายได้\s*\d/);
    expect(q).not.toMatch(/\d[\d,]*\s*บาท/);
  });
});

describe('Part 2 · เสนองานให้คนที่สมัครไว้แล้ว', () => {
  it('อ้างใบสมัครที่เขาเคยฝากไว้ ไม่ใช่บทโทรหาคนแปลกหน้า', () => {
    const q = buildOfferQuestions(FACTS);
    expect(q[0]).toContain('ใบสมัคร');
    expect(q[0]).toContain(CALLER_ORG);
  });

  it('ไม่ถามค่าแรงที่คาดหวัง (เห็นเงื่อนไขงานตอนสมัครแล้ว)', () => {
    expect(buildOfferQuestions(FACTS).join(' | ')).not.toContain('คาดหวัง');
  });

  it('ไม่ถามประสบการณ์ซ้ำ (มีโปรไฟล์เขาอยู่แล้ว)', () => {
    expect(buildOfferQuestions(FACTS).join(' | ')).not.toContain('เคยทำงานตำแหน่ง');
  });

  it('ปิดด้วยการนัดสัมภาษณ์', () => {
    const q = buildOfferQuestions(FACTS);
    expect(q[q.length - 1]).toContain('นัด');
  });

  it('เส้นชวนกลับถามก่อนว่ายังหางานอยู่ไหม', () => {
    expect(buildOfferQuestions(FACTS, { askStillLooking: true }).join(' | ')).toContain('ยังหางาน');
    expect(buildOfferQuestions(FACTS).join(' | ')).not.toContain('ยังหางาน');
  });

  it('ถามเหตุผลตอนปฏิเสธเหมือน Part 1 — ต้องเป็นชุดเดียวกัน', () => {
    const q = buildOfferQuestions(FACTS).join(' | ');
    for (const choice of DECLINE_REASON_CHOICES) expect(q).toContain(choice);
  });

  it('สั้นกว่า Part 1 และไม่เกินเพดาน', () => {
    expect(buildOfferQuestions(FACTS).length).toBeLessThan(buildScreeningQuestions(FACTS).length);
    expect(buildOfferQuestions(FACTS, { askStillLooking: true }).length + 1).toBeLessThanOrEqual(15);
  });

  it('เวอร์ชันข้อความ (ช่อง reminder) พูดข้อเท็จจริงชุดเดียวกันและไม่มีตัวเลขรายได้', () => {
    const msg = buildOfferMessage({ ...FACTS, requestNo: 'OPL6908026', detail: 'สถานที่ทำงาน โรงงานบางปะกง' });
    expect(msg).toContain(CALLER_ORG);
    expect(msg).toContain('พนักงานขับรถ');
    expect(msg).toContain('OPL6908026');
    expect(msg).toContain('1 ก.ย. 2569');
    expect(msg).not.toMatch(/\d[\d,]*\s*บาท/);
  });
});

describe('ประโยคที่เติมตอนเสิร์ฟ (รายได้ + สวัสดิการ)', () => {
  it('บอกรายได้เป็น "ต่อเดือน" เสมอ ไม่ใช่เลขลอย', () => {
    const s = buildExtraInfoSentence({ monthlyIncome: 15000, benefitLine: 'มีเบี้ยขยันให้ด้วย' });
    expect(s).toContain('15,000 บาทต่อเดือน');
    expect(s).toContain('มีเบี้ยขยันให้ด้วย');
    expect(s.startsWith(EXTRA_INFO_PREFIX)).toBe(true);
  });

  it('คิดรายได้ไม่ได้ = ไม่พูดเรื่องเงิน แต่ยังพูดสวัสดิการได้', () => {
    const s = buildExtraInfoSentence({ monthlyIncome: 0, benefitLine: 'มีค่าเดินทางให้ด้วย' });
    expect(s).not.toContain('บาท');
    expect(s).toContain('ค่าเดินทาง');
  });

  it('ไม่มีอะไรจะพูด = คืนค่าว่าง (ไม่เติมข้อเปล่า)', () => {
    expect(buildExtraInfoSentence({ monthlyIncome: null, benefitLine: '' })).toBe('');
  });

  it('เติมเข้า interview เป็นคำถามเพิ่ม 1 ข้อ · เสิร์ฟซ้ำไม่เติมซ้ำ', () => {
    const p = { questions: ['ข้อ 1'] };
    const s = buildExtraInfoSentence({ monthlyIncome: 15000 });
    appendExtraInfoToPayload(p, s);
    appendExtraInfoToPayload(p, s);
    expect(p.questions).toHaveLength(2);
  });

  it('คำถามเต็ม 15 ข้อแล้วไม่เติม (schema ไม่ผ่าน = Lumos ปัดทิ้งทั้งรายการ)', () => {
    const p = { questions: Array.from({ length: 15 }, (_, i) => `ข้อ ${i}`) };
    appendExtraInfoToPayload(p, buildExtraInfoSentence({ monthlyIncome: 15000 }));
    expect(p.questions).toHaveLength(15);
  });

  it('เติมเข้า reminder ต่อท้ายข้อความทุก step · เสิร์ฟซ้ำไม่เติมซ้ำ', () => {
    const p = { steps: [{ message: 'ข้อความ ก' }, { message: 'ข้อความ ข' }] };
    const s = buildExtraInfoSentence({ monthlyIncome: 15000 });
    appendExtraInfoToPayload(p, s);
    appendExtraInfoToPayload(p, s);
    expect(p.steps[0].message).toBe(`ข้อความ ก ${s}`);
    expect(p.steps[1].message).toBe(`ข้อความ ข ${s}`);
  });

  it('ประโยคว่าง/payload พัง = ไม่ทำอะไร ไม่ throw', () => {
    expect(() => appendExtraInfoToPayload(null, 'x')).not.toThrow();
    const p = { questions: ['ก'] };
    appendExtraInfoToPayload(p, '');
    expect(p.questions).toHaveLength(1);
  });
});

describe('Part 3 · Follow', () => {
  const base = { recipientName: 'สมหญิง', topic: 'นัดสัมภาษณ์วันจันทร์', staffPhone: '0812345678' };

  it('แนะนำตัว + เรียกชื่อ + บอกให้ยืนยันกลับ', () => {
    const m = buildFollowMessage(base);
    expect(m).toContain(CALLER_ORG);
    expect(m).toContain('คุณสมหญิง');
    expect(m).toContain('นัดสัมภาษณ์วันจันทร์');
    expect(m).toContain('ยืนยันกลับ');
  });

  it('เบอร์อ่านเป็นกลุ่มตัวเลข ไม่ใช่ 10 หลักติดกัน', () => {
    expect(buildFollowMessage(base)).toContain('081 234 5678');
    expect(buildFollowMessage(base)).not.toContain('0812345678');
  });

  it('โน้ตซ้ำหัวเรื่อง = พูดรอบเดียว', () => {
    const m = buildFollowMessage({ ...base, note: 'นัดสัมภาษณ์วันจันทร์' });
    expect(m.match(/นัดสัมภาษณ์วันจันทร์/g)).toHaveLength(1);
  });

  it('โน้ตต่างจากหัวเรื่อง = พูดทั้งคู่', () => {
    const m = buildFollowMessage({ ...base, note: 'เตรียมบัตรประชาชนมาด้วย' });
    expect(m).toContain('นัดสัมภาษณ์วันจันทร์');
    expect(m).toContain('เตรียมบัตรประชาชนมาด้วย');
  });

  it('ไม่มีเบอร์ = ไม่พูดท่อนติดต่อกลับ (ไม่ใช่พูดว่า "โทร ว่าง")', () => {
    const m = buildFollowMessage({ ...base, staffPhone: null });
    expect(m).not.toContain('โทร');
  });

  it('ไม่มีชื่อผู้รับ = ไม่พูดคำว่า "คุณ" ลอย ๆ', () => {
    expect(buildFollowMessage({ ...base, recipientName: '' })).not.toContain('คุณ ');
  });
});

describe('speakablePhoneTh', () => {
  it('มือถือ 10 หลัก → 3-3-4', () => {
    expect(speakablePhoneTh('0812345678')).toBe('081 234 5678');
  });
  it('รูป +66 → กลับเป็น 0 แล้วค่อยแบ่ง', () => {
    expect(speakablePhoneTh('+66812345678')).toBe('081 234 5678');
  });
  it('เบอร์บ้าน 9 หลัก → 2-3-4', () => {
    expect(speakablePhoneTh('021234567')).toBe('02 123 4567');
  });
  it('อ่านไม่ออก = คืนของเดิม ไม่เดา', () => {
    expect(speakablePhoneTh('ต่อ 123')).toBe('ต่อ 123');
    expect(speakablePhoneTh('')).toBe('');
  });
});
