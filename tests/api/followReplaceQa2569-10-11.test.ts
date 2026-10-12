/**
 * แท็บติดตามส่งคนแทน — QA รอบ 2 ข้อ 19 · 25 + รอบ 3 ข้อ 10 · 24 (11 ต.ค. 2569)
 * - อ่านสถานะ AI ไม่ได้ = บอก + ลองใหม่ (เดิมสวิตช์/ปุ่มเวลาหายเงียบ)
 * - สวิตช์ AI โทร (มีผลทั้งแท็บ) ถามยืนยันก่อน (เจ้าของ Choice "คงที่เดิม เพิ่มถามยืนยัน")
 * - เปิดฟอร์มจากแท็บนี้ เติมเรื่อง "ติดตามส่งคนแทน" (ฟอร์มชุดเดียวกัน แค่ค่าตั้งต้น)
 * - กลุ่มเจ้าหน้าที่ที่ยังว่าง ขึ้น "ยังไม่มีชื่อ" (ว่างแล้วห้ามหาย)
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const page = readFileSync('src/pages/follow/FollowPage.tsx', 'utf8');
const staff = readFileSync('src/components/follow/StaffContactField.tsx', 'utf8');

describe('แท็บส่งคนแทน', () => {
  it('อ่านสถานะ AI ไม่ได้ = ข้อความ + ลองใหม่', () => {
    expect(page).toContain('data-testid="replace-ai-failed"');
    expect(page).toMatch(/อ่านสถานะ AI ไม่ได้[\s\S]{0,200}setReplaceStatusSeq\(\(n\) => n \+ 1\)[\s\S]{0,60}ลองใหม่/);
  });
  it('🔴 สวิตช์ไม่สลับทันที — เปิดป๊อปยืนยันก่อน แล้วค่อยเรียก toggleReplaceAi', () => {
    expect(page).toContain('onCheckedChange={(v) => setAskAiSwitch(v)}');
    expect(page).not.toContain('onCheckedChange={(v) => void toggleReplaceAi(v)}');
    expect(page).toMatch(/<AlertDialog open=\{askAiSwitch !== null\}/);
  });
  it('เปิดฟอร์มจากแท็บนี้ = เรื่อง "ติดตามส่งคนแทน" ถ้ายังไม่ได้เลือก', () => {
    expect(page).toContain('if (replaceView) setTopic((t) => t || REPLACE_FOLLOW_TOPIC);');
  });
  it('กลุ่มเจ้าหน้าที่ว่าง = "ยังไม่มีชื่อ"', () => {
    // ตัวเลือก shadcn (`FieldSelect` · 12 ต.ค. 2569) — กลุ่มว่างเป็นตัวเลือกกดไม่ได้ "ยังไม่มีชื่อ" ทั้ง 2 กลุ่ม
    expect(staff.match(/Names\.length === 0\s*\? \[\{ value: '__none_\w+__', label: 'ยังไม่มีชื่อ', disabled: true/g)?.length).toBe(2);
  });
});
