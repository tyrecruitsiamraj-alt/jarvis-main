import { describe, expect, it } from 'vitest';

import {
  activeScriptFingerprint,
  activeScriptSource,
  setCallScriptOverrides,
  type EditableScriptKey,
} from '../../api/_lib/lumosCallScript';

/**
 * ป้ายบอกว่า "สายนี้ AI ใช้บทชุดไหน เวอร์ชันไหน"
 *
 * เจ้าของสั่ง 31 ส.ค. 2569 ให้ส่งข้อมูลบทไปกับงานที่ส่งให้ Lumos
 * — เนื้อบทที่ AI พูดถูกส่งไปครบอยู่แล้ว ที่ขาดคือป้ายบอกเวอร์ชัน
 * 🔴 เก็บฝั่งเราเท่านั้น ไม่ยัดลง payload ที่ส่งออก (Lumos กลืน field แปลกแบบเงียบ ๆ)
 */
const KEYS: EditableScriptKey[] = ['interview', 'offer', 'follow'];

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
