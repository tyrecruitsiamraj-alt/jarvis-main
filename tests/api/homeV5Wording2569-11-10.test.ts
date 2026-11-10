// @vitest-environment node
/**
 * คำบนหน้าหลักโฉม Codex + แผงที่กดการ์ด (เจ้าของ 10 พ.ย. 2569 "แก้ข้อ 1–4")
 * ไม่นับคอมเมนต์ · ถอดประโยคสอนวิธีกด · หัวข้อเป็นคำถาม · หมายเหตุออกตัว · จุดกลางคั่นถี่ — ห้ามกลับมา
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = [
  'src/pages/HomeOverviewPage.tsx',
  'src/components/so-recruit-v5/BuTrendTable.tsx',
  'src/components/dashboard-trends/RecruitOverview.tsx',
  'src/components/dashboard-trends/stuck/ReleaseProgressCard.tsx',
  // หัวข้อคำถามหน้าภาพรวมงานสรรหา (เจ้าของ 10 พ.ย. 2569 "แก้หัวข้อคำถามหน้าภาพรวมงานสรรหาด้วย")
  'src/components/dashboard-trends/stuck/RecruitStuckBody.tsx',
  'src/components/dashboard-trends/stuck/StuckOwnerTable.tsx',
  'src/components/dashboard-trends/stuck/StuckPhasesCard.tsx',
  'src/components/dashboard-trends/stuck/StuckAreaTable.tsx',
  'src/components/dashboard-trends/stuck/PersonJourneyCard.tsx',
  'src/components/dashboard-trends/RecruitOverviewParts.tsx',
  'src/components/dashboard-trends/RequestTab.tsx',
].map((f) => [f, readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')] as const);

const gone = [
  'กดตัวเลขเพื่อดูรายการ',
  'กดเดือนเพื่อดูรายวัน',
  'กดสถานะเพื่อดูใบขอ',
  'ใบขอ ผลการสรรหา และการติดตามในระบบ',
  'เห็นงานค้าง คนรับผิดชอบ และสิ่งที่ต้องทำต่อ',
  'แล้วปิดได้เท่าไหร่',
  'ประกาศไปแค่ไหน',
  'จากผู้สมัคร ไปถึงวันนัด',
  'AI และคน โทรไปเท่าไหร่',
  'ผูกกับใบขอรายใบไม่ได้',
  'สายไม่นับ',
  'ยังไม่จบเดือน',
  'คนเดียวมีได้หลายสาย',
  'คนโทรต่อรวมทั้งกลุ่ม',
  'ณ สิ้นช่วง',
  'ติดตรงไหน',
  'ไปถึงขั้นไหน',
  'คนคลิกแล้วกรอกเท่าไหร่',
  'ใครหารายชื่อเข้ามา',
  'รายชื่อมาจากไหน ไปถึงไหน',
  'ทำไมไม่สำเร็จ',
  'ติดที่ใคร',
  'รายชื่อหลุดตรงไหน',
  'กรอกแล้วโทรวันไหน',
  'ไปถึงไหนแยกช่องทาง',
  'มาจากช่องทางไหน',
  'พื้นที่ไหนขาดคน',
  'ช่องทางไหนได้คนสนใจเยอะ',
];

describe('หน้าหลักโฉม Codex ไม่มีภาษา AI', () => {
  it.each(gone)('ไม่มี "%s"', (phrase) => {
    for (const [f, src] of files) expect(src, f).not.toContain(phrase);
  });
  it('หัวข้อใหม่ตามที่แก้', () => {
    const page = files[0][1];
    expect(page).toContain('title="ใบขอเข้า-ปิด"');
    expect(page).toContain('title="สถานะประกาศใบขอใหม่"');
    expect(page).toContain('title="ผู้สมัครถึงวันนัด"');
    expect(page).toContain('title="AI และคนโทร"');
  });
});
