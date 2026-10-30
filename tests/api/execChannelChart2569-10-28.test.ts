import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fourMainOf, fourMainRows } from '@/lib/channelFourMain';

/** เจ้าของ 28 ต.ค. 2569: "ช่องทางไหนได้ผล" = กราฟเทียบ 4 ช่องทางหลัก · Dropdown เลือกขั้น · กดแท่งดูช่องทางรอง */
describe('4 ช่องทางหลัก', () => {
  it('ชื่อช่องทางจริงบนเว็บ (28 ต.ค.) ลงกลุ่มตามหน้าช่องทาง', () => {
    const cases: Array<[string, string]> = [
      ['Facebook Group', 'Facebook'],
      ['Facebook (ไม่รู้ว่ากลุ่ม/Ads/เพจ)', 'Facebook'],
      ['Tiktok', 'Tiktok'],
      ['Tiktok Live', 'Tiktok'],
      ['Line AI LBA', 'Tiktok'],
      ['Jobthai', 'Webjob'],
      ['Jobbkk', 'Webjob'],
      ['Internet', 'Webjob'],
      ['Google Ads', 'Webjob'],
      ['พนักงานเก่า/โอนมา', 'Offline'],
      ['พนักงานแนะนำ', 'Offline'],
      ['ผู้ประสานงานรับ', 'Offline'],
      ['จนท.สยามราช', 'Offline'],
      ['ป้าย/ใบปลิว', 'Offline'],
      ['สำนักงานใหญ่', 'Offline'],
      ['LINE OA', 'อื่น ๆ'],
    ];
    for (const [name, main] of cases) expect(fourMainOf(name), name).toBe(main);
  });

  it('🔴 ผลรวมแท่ง = ผลรวมทุกช่องทาง · 4 หลักขึ้นเสมอแม้เป็น 0 · อื่น ๆ ขึ้นเมื่อมีคน', () => {
    const items = [
      { name: 'Facebook Group', value: 10 },
      { name: 'Facebook Ads', value: 30 },
      { name: 'Tiktok', value: 5 },
      { name: 'LINE OA', value: 2 },
      { name: 'Jobthai', value: 0 },
    ];
    const rows = fourMainRows(items);
    expect(rows.map((r) => r.main)).toEqual(['Facebook', 'Tiktok', 'Webjob', 'Offline', 'อื่น ๆ']);
    expect(rows.reduce((n, r) => n + r.value, 0)).toBe(47);
    expect(rows[0].subs).toEqual([
      { name: 'Facebook Ads', value: 30 },
      { name: 'Facebook Group', value: 10 },
    ]);
    expect(rows.find((r) => r.main === 'Webjob')).toEqual({ main: 'Webjob', value: 0, subs: [] });
    expect(fourMainRows([]).map((r) => r.main)).toEqual(['Facebook', 'Tiktok', 'Webjob', 'Offline']);
  });

  it('การ์ดเลือกขั้นด้วย Dropdown (ไม่มี 4 กล่องเดิม) · บรรทัดบวกยอด', () => {
    const src = readFileSync('src/components/home-exec/ExecChannelChart.tsx', 'utf8');
    for (const l of ['กรอกมา', 'นัดได้', 'มาตามนัด', 'ลงงาน']) expect(src).toContain(`label: '${l}'`);
    expect(src).toContain('<Select value={stage}');
    expect(src).toContain('exec-channels-sum');
    expect(readFileSync('src/pages/HomeExecPage.tsx', 'utf8')).not.toContain('กรอกเยอะสุด');
  });
});
