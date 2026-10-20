/**
 * หน้าใบขอ: ค้นด้วยเลขใบขอที่ปิดแล้ว ต้องไม่โผล่ในรายการใบเปิด (เจ้าของ 20 ต.ค. 2569:
 * "LBM6910003 LBM6910004 ยกเลิกแล้วทำไมไม่หาย … ฉันยังเห็นอยู่เลยหน้าใบขอ")
 * ต้นเหตุ: ค้นด้วยเลขใบขอ = ดึงใบนั้นตรงจาก ERP มาต่อท้ายเสมอ · ตัวกรองตั้งต้น "ทั้งหมด" ไม่กันใบปิด
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('หน้าใบขอ: ใบปิดแล้วไม่โผล่จากช่องค้นหา', () => {
  it('ผลค้นด้วยเลขใบขอที่ปิดแล้ว ขึ้นเฉพาะตอนเลือก "ปิดแล้ว"', () => {
    const page = readFileSync('src/pages/jobs/JobListPage.tsx', 'utf8');
    expect(page).toContain("if (lookupJob.status === 'closed' && filter !== 'closed') return scopedJobs;");
  });
});
