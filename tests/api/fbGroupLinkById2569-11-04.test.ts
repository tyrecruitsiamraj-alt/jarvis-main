/**
 * ลิงก์สมัครของกลุ่ม Facebook ผูกกับรหัสกลุ่ม ไม่ใช่ชื่อกลุ่ม (เจ้าของ 4 พ.ย. 2569 "อยากแก้แบบทั้งระบบ")
 * ที่มา: 2 กลุ่มชื่อ "หางานขับรถผู้บริหาร" (423954682082863 · 553130514463865) ได้ลิงก์เดียวกัน
 * OPL6910066 · OPL6910069 ติ๊ก 15 กลุ่มได้ 14 ลิงก์ — แยกไม่ออกว่าคนสมัครมาจากกลุ่มไหน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { soGroupLabel, soGroupLinkKey, soGroupLinkLabel, soGroupLinkName, soGroupLinkOf } from '../../src/lib/soScraping';

const code = (p: string) => readFileSync(p, 'utf8');

const A = { id: 'mvhmlouoi7vl8oqpqod', fbGroupId: '423954682082863', name: 'หางานขับรถผู้บริหาร' };
const B = { id: 'mvhmloy2rbycturl7u', fbGroupId: '553130514463865', name: 'หางานขับรถผู้บริหาร ' };
const C = { id: 'mvhmloovlppmpi5o6fg', fbGroupId: '550295531832556', name: 'กลุ่มคนขับรถผู้บริหาร' };
const SLUG = { id: 'mvhmlslug000000000', fbGroupId: 'KonKubRod', name: 'คนขับรถ' };
const ALL = [A, B, C, SLUG];
const CH = 'Facebook · Facebook Group';

describe('รหัสกลุ่ม = ตัวแยกลิงก์', () => {
  it('ใช้รหัสท้าย /groups/ (เลข หรือชื่ออังกฤษ ตัวพิมพ์เล็ก) · ไม่มีรหัสใช้รหัสในรายชื่อ So Scraping', () => {
    expect(soGroupLinkKey(A)).toBe('423954682082863');
    expect(soGroupLinkKey(SLUG)).toBe('konkubrod');
    expect(soGroupLinkKey({ id: 'mvhmlnoid', fbGroupId: null })).toBe('mvhmlnoid');
  });

  it('ชื่อซ้ำ (ไม่สนช่องว่างท้าย) ต่อท้ายรหัสกลุ่ม · ชื่อไม่ซ้ำคงเดิม → ชื่อลิงก์ไม่ชนกัน', () => {
    expect(soGroupLinkName(A, ALL)).toBe('หางานขับรถผู้บริหาร (423954682082863)');
    expect(soGroupLinkName(B, ALL)).toBe('หางานขับรถผู้บริหาร (553130514463865)');
    expect(soGroupLinkName(C, ALL)).toBe('กลุ่มคนขับรถผู้บริหาร');
    const labels = ALL.map((g) => soGroupLinkLabel(CH, soGroupLinkName(g, ALL)));
    expect(new Set(labels).size).toBe(ALL.length);
    // รายการในป๊อปขึ้นชื่อเดียวกับบนลิงก์
    expect(soGroupLabel(A, ALL)).toBe('หางานขับรถผู้บริหาร (423954682082863)');
    expect(soGroupLabel(A)).toBe('หางานขับรถผู้บริหาร');
  });

  it('ลิงก์เดิมของกลุ่ม: รหัสตรงก่อน · ลิงก์เก่า (ไม่มีรหัส) ใช้ต่อได้เมื่อชื่อลิงก์ตรง · ลิงก์ก้อนเดียวที่ชื่อซ้ำเคยใช้ร่วมกันไม่ถูกหยิบมาใช้', () => {
    const shared = { code: 'old1', channelLabel: `${CH} · หางานขับรถผู้บริหาร`, fbGroupId: null };
    const oldC = { code: 'old2', channelLabel: `${CH} · กลุ่มคนขับรถผู้บริหาร`, fbGroupId: null };
    const newA = { code: 'new1', channelLabel: 'ชื่ออะไรก็ได้', fbGroupId: '423954682082863' };
    const links = [shared, oldC, newA];
    expect(soGroupLinkOf(links, A, soGroupLinkLabel(CH, soGroupLinkName(A, ALL)))?.code).toBe('new1');
    expect(soGroupLinkOf(links, B, soGroupLinkLabel(CH, soGroupLinkName(B, ALL)))).toBeNull();
    expect(soGroupLinkOf(links, C, soGroupLinkLabel(CH, soGroupLinkName(C, ALL)))?.code).toBe('old2');
  });
});

describe('ทุกทางที่สร้างลิงก์ของกลุ่มส่งรหัสกลุ่ม', () => {
  it('Gen link · Gen link เพิ่ม · Autopost', () => {
    expect(code('src/components/jobs/GenApplyLinkDialog.tsx')).toContain('fbGroupId: soGroupLinkKey(g),');
    expect(code('src/components/jobs/AddChannelLinks.tsx')).toContain('fbGroupId: soGroupLinkKey(g),');
    // 9 พ.ย. 2569 Autopost กับโพสต์เองสร้างลิงก์ผ่านตัวเดียว (`ensureSoGroupLinks`)
    expect(code('src/lib/soGroupLinks.ts')).toContain('fbGroupId: soGroupLinkKey(g), note: SO_LINK_NOTE[source] });');
  });

  it('API รับ fbGroupId ทั้งลิงก์เดี่ยวและตอนสร้างประกาศ · เก็บที่ fb_group_id · ยังไม่รัน 173 ยังสร้าง/โหลดลิงก์ได้', () => {
    const h = code('api/_handlers/recruit-postings.ts');
    expect(h).toContain("fbGroupId: typeof body.fbGroupId === 'string' ? body.fbGroupId : null,");
    expect(h).toContain("fbGroupId: typeof c.fbGroupId === 'string' ? c.fbGroupId : null,");
    const store = code('api/_lib/recruitPostings.ts');
    expect(store).toContain('if (withFbGroup && isUndefinedColumn(e)) {');
    expect(store).toContain('for (const [withCreator, withFbGroup] of [[true, true], [true, false], [false, false]] as const) {');
    expect(code('migrations/173_posting_link_fb_group.sql')).toContain('add column if not exists fb_group_id text null');
  });

  it('รายชื่อกลุ่มจาก So Scraping มีรหัสกลุ่ม', () => {
    expect(code('api/_lib/soScrapingGroups.ts')).toContain('g.fb_group_id::text as fb_group_id');
  });
});
