import { describe, expect, it } from 'vitest';

import {
  activeScriptFingerprint,
  activeScriptSource,
  buildFollowMessage,
  EDITABLE_SCRIPT_DEFAULTS,
  setCallScriptOverrides,
  type EditableScriptKey,
} from '../../api/_lib/lumosCallScript';
import { EDITABLE_SCRIPT_KEYS } from '../../api/_lib/callScriptStore';

/**
 * ป้ายบอกว่า "สายนี้ AI ใช้บทชุดไหน เวอร์ชันไหน"
 *
 * เจ้าของสั่ง 31 ส.ค. 2569 ให้ส่งข้อมูลบทไปกับงานที่ส่งให้ Lumos
 * — เนื้อบทที่ AI พูดถูกส่งไปครบอยู่แล้ว ที่ขาดคือป้ายบอกเวอร์ชัน
 * 🔴 เก็บฝั่งเราเท่านั้น ไม่ยัดลง payload ที่ส่งออก (Lumos กลืน field แปลกแบบเงียบ ๆ)
 */
const KEYS: EditableScriptKey[] = ['interview', 'offer', 'follow', 'follow_repeat'];

describe('ป้ายบทที่จดลงคิวโทร', () => {
  it('ยังไม่มีใครแก้บท = ใช้บทมาตรฐาน', () => {
    setCallScriptOverrides({});
    for (const k of KEYS) expect(activeScriptSource(k)).toBe('default');
  });

  it('แอดมินแก้บทไหน บทนั้นกลายเป็นฉบับแก้ ที่เหลือยังมาตรฐาน', () => {
    setCallScriptOverrides({ follow: ['สวัสดีครับ {ชื่อผู้รับ}'] });
    expect(activeScriptSource('follow')).toBe('custom');
    expect(activeScriptSource('offer')).toBe('default');
    expect(activeScriptSource('interview')).toBe('default');
    setCallScriptOverrides({});
  });

  it('ลายนิ้วมือขึ้นต้นด้วยชื่อชุดเสมอ — อ่านในล็อกแล้วรู้ทันทีว่าบทไหน', () => {
    setCallScriptOverrides({});
    for (const k of KEYS) expect(activeScriptFingerprint(k).startsWith(`${k}-`)).toBe(true);
  });

  it('บทต่างชุดกัน ลายนิ้วมือต้องไม่ชนกัน', () => {
    setCallScriptOverrides({});
    const seen = new Set(KEYS.map((k) => activeScriptFingerprint(k)));
    expect(seen.size).toBe(KEYS.length);
  });

  it('🔴 แก้บทแล้วลายนิ้วมือต้องเปลี่ยน (ไม่งั้นย้อนดูเวอร์ชันไม่ได้)', () => {
    setCallScriptOverrides({});
    const before = activeScriptFingerprint('follow');
    setCallScriptOverrides({ follow: ['บทใหม่ที่แอดมินเพิ่งแก้'] });
    const after = activeScriptFingerprint('follow');
    expect(after).not.toBe(before);
    setCallScriptOverrides({});
    expect(activeScriptFingerprint('follow')).toBe(before);
  });

  it('บทเดิมเป๊ะ = ลายนิ้วมือเดิมเป๊ะ (คงที่ ไม่สุ่ม)', () => {
    setCallScriptOverrides({ offer: ['ก', 'ข'] });
    const a = activeScriptFingerprint('offer');
    const b = activeScriptFingerprint('offer');
    expect(a).toBe(b);
    setCallScriptOverrides({});
  });
});

/**
 * งานติดตามมี 2 บท — สายแรกกับรอบถัดไปพูดไม่เหมือนกัน
 * (เจ้าของสั่ง 31 ส.ค. 2569: *"โทรรอบแรกกับรอบที่ 2 มันไม่เหมือนกันอะ"*)
 */
describe('บทติดตาม 2 รอบ', () => {
  const input = {
    recipientName: 'สมชาย',
    topic: 'ยืนยันวันเริ่มงาน',
    note: '',
    staffPhone: '0812345678',
  };

  it('สายแรกกับรอบถัดไป ต้องพูดคนละอย่าง', () => {
    setCallScriptOverrides({});
    const first = buildFollowMessage(input, 'first');
    const repeat = buildFollowMessage(input, 'repeat');
    expect(first).not.toBe(repeat);
    expect(first.length).toBeGreaterThan(0);
    expect(repeat.length).toBeGreaterThan(0);
  });

  it('ไม่ส่งรอบมา = สายแรก (ของเดิมที่เรียกอยู่ต้องไม่เปลี่ยนพฤติกรรม)', () => {
    setCallScriptOverrides({});
    expect(buildFollowMessage(input)).toBe(buildFollowMessage(input, 'first'));
  });

  /**
   * 🔴 บทชุดใหม่ 1 ก.ย. 2569 (เจ้าของเขียนคำต่อคำ) — สายแรกถามว่า "เตรียมตัวไปทำงาน…"
   * รอบถัดไปถามว่า "ถึงหน่วยงาน…แล้วใช่ไหม" · ไม่ได้อ้างถึงสายก่อนหน้าอีกแล้ว
   * ที่ต้องต่างกันคือ **คำถามหลักกับคำปิดท้าย** ไม่ใช่คำว่า "อีกครั้ง"
   */
  it('รอบถัดไปถามคนละคำถามกับสายแรก และปิดท้ายคนละคำ', () => {
    setCallScriptOverrides({});
    expect(buildFollowMessage(input, 'first')).toMatch(/เตรียมตัวไปทำงาน/);
    expect(buildFollowMessage(input, 'first')).toMatch(/เดินทางปลอดภัย/);
    expect(buildFollowMessage(input, 'repeat')).toMatch(/ถึงหน่วยงาน/);
    expect(buildFollowMessage(input, 'repeat')).toMatch(/เป็นวันที่ดี/);
  });

  it('ทั้งสองบทยังเรียกชื่อผู้รับและทักในนามบริษัทเหมือนกัน', () => {
    setCallScriptOverrides({});
    for (const round of ['first', 'repeat'] as const) {
      const msg = buildFollowMessage(input, round);
      expect(msg).toMatch(/สมชาย/);
      expect(msg).toMatch(/สยามราชธานี/);
    }
  });

  it('แก้บทรอบไหน ก็กระทบเฉพาะรอบนั้น', () => {
    setCallScriptOverrides({ follow_repeat: ['บทรอบสองที่แก้เอง'] });
    expect(buildFollowMessage(input, 'repeat')).toBe('บทรอบสองที่แก้เอง');
    expect(buildFollowMessage(input, 'first')).toMatch(/สมชาย/);
    setCallScriptOverrides({});
  });
});

/**
 * 🔴 เพิ่มบทใหม่แล้วลืมเติมในลิสต์ของหน้าตั้งค่า = บทนั้นแก้ไม่ได้เลยและไม่มีใครรู้
 * (เจอกับตัวตอนเพิ่มบท "ติดตามรอบถัดไป" 31 ส.ค. 2569 — บทใหม่ไม่โผล่บนจอ)
 */
describe('ลิสต์บทในหน้าตั้งค่า ต้องครบทุกคีย์', () => {
  it('ทุกคีย์ใน EDITABLE_SCRIPT_DEFAULTS ต้องอยู่ในลิสต์ที่หน้าตั้งค่าใช้', () => {
    const all = Object.keys(EDITABLE_SCRIPT_DEFAULTS).sort();
    expect([...EDITABLE_SCRIPT_KEYS].sort()).toEqual(all);
  });
});
