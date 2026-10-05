/**
 * ═══ ศัพท์ในบ้าน + หน่วยของตัวเลขรายได้ ═══
 *
 * 🔴 จาก audit มุมพนักงานใหม่ 26 ส.ค. 2569:
 * - ศัพท์ **21 คำ** ขึ้นจอโดยไม่มีใครอธิบาย (Lumos/OPL/Lead/คนเขียว/กองไม่สนใจ…)
 * - "400 บาท" ขึ้นข้าง ๆ "45,000 บาท" โดยไม่มีหน่วย ⇒ อ่านว่าเงินเดือน 400 บาท
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { GLOSSARY, GLOSSARY_KEYS, glossaryHelp } from '@/lib/glossary';
import { incomeDisplay } from '@/lib/incomeLabel';

const ROOT = path.resolve(__dirname, '../..');

describe('พจนานุกรมศัพท์', () => {
  it.each(GLOSSARY_KEYS)('%s มีคำและคำอธิบายที่อ่านรู้เรื่อง', (key) => {
    const g = GLOSSARY[key];
    expect(g.term).toBeTruthy();
    expect(g.meaning.length, `${key} คำอธิบายสั้นเกินกว่าจะช่วยใครได้`).toBeGreaterThan(20);
    expect(g.meaning).not.toBe(g.term);
  });

  it('ครอบคลุมศัพท์ที่ audit จับได้ว่าทำคนใหม่งงมากที่สุด', () => {
    for (const must of ['lumos', 'opl', 'lead', 'sla', 'erp', 'scraping', 'content', 'bu']) {
      expect(GLOSSARY_KEYS, `ขาดศัพท์ ${must}`).toContain(must as (typeof GLOSSARY_KEYS)[number]);
    }
  });

  it('คำที่มักเข้าใจผิดถูกยกมาเตือนใน tooltip', () => {
    expect(glossaryHelp('lumos')).toContain('ระวัง:');
    expect(glossaryHelp('bu')).toContain('ระวัง:');
    // คำที่ไม่มี notThis ต้องไม่มีบรรทัดเตือนลอย ๆ
    expect(glossaryHelp('scraping')).not.toContain('ระวัง:');
  });

  it('ตัว <Term> อ่านคำอธิบายจากพจนานุกรม ไม่ได้พิมพ์เอง', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/components/shared/Term.tsx'), 'utf8');
    expect(src).toContain('glossaryHelp');
    expect(src).toContain("from '@/lib/glossary'");
  });
});

describe('หน่วยของตัวเลขรายได้', () => {
  it('มีตัวเลขต่อเดือนแล้ว ต้องติดป้าย /เดือน', () => {
    expect(incomeDisplay({ monthlyIncome: 45000 })?.text).toBe('45,000 บาท/เดือน');
  });

  it('ใบที่ตั้งเป็นรายวัน ต้องแปลงเป็นต่อเดือนแล้วบอกที่มา', () => {
    const r = incomeDisplay({ monthlyIncome: 12000, displayPeriod: 'daily', totalIncome: 400 });
    expect(r?.text).toBe('12,000 บาท/เดือน');
    expect(r?.hint).toContain('รายวัน');
  });

  it('🔴 มีแต่อัตราดิบ = ไม่รู้หน่วย ห้ามเดาว่าเป็นต่อเดือน', () => {
    const r = incomeDisplay({ totalIncome: 400 });
    expect(r?.period).toBe('unknown');
    expect(r?.text).toBe('400 บาท');
    expect(r?.text).not.toContain('/เดือน');
    expect(r?.hint).toContain('ต่อวัน');
  });

  it('ไม่มีข้อมูลรายได้เลย คืน null ให้จอเขียน "—" เอง (ห้ามวาด 0)', () => {
    expect(incomeDisplay({})).toBeNull();
    expect(incomeDisplay({ totalIncome: 0, monthlyIncome: 0 })).toBeNull();
  });
});

// (ด่าน "หน้าคำขอโพสต์ไม่พ่นค่าดิบขึ้นจอ" ถูกลบพร้อมหน้า JobPostingsPage.tsx 27 ก.ย. 2569
//  — เจ้าของสั่งถอดหน้ารวมคำขอ เหลือแค่ปุ่มส่ง Content/Scraping ในจับคู่งาน)

/**
 * ด่านกันหน้า Follow กลับไปโหลดรายการเป็นของตัวเอง
 * (ต้นเหตุที่จอเดียวเคยมี "ทั้งหมด" สามค่าที่ไม่ตรงกัน)
 */
describe('หน้าติดตามใช้รายการก้อนเดียว', () => {
  it('แผงรอบโทรรับ entries เป็น prop และไม่ยิง API เอง', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src/components/follow/FollowCallRoundsPanel.tsx'),
      'utf8',
    );
    // ตัดคอมเมนต์ก่อน — ไฟล์นั้นเล่าเรื่องบั๊กด้วยชื่อฟังก์ชันที่ตัวเองห้ามใช้
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    expect(code).not.toContain('listFollowEntries');
    expect(src).toContain('entries: FollowEntry[]');
  });
});
