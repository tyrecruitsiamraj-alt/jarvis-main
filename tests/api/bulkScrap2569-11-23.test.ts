/**
 * Scrap ทีเดียวทั้งหน้าใบขอ (เจ้าของ 23 พ.ย. 2569
 * "หน้าใบขอ ให้ Scraping ทีเดียวได้ทั้งหน้า โดยสามารถระบุได้ว่าจะเอาใบขอละกี่ Resume พอเลือกแล้วก็เอาเด้ง Pop up ให้เลือกเหมือนเวลา Scrap ปกติ")
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { JobRequest } from '@/types';
import { bulkScrapProblems, bulkScrapRows, defaultPerRequest, parsePerRequest } from '@/lib/bulkScrap';

const job = (id: string, extra: Partial<Record<string, unknown>> = {}) =>
  ({
    id: `siamraj-sql:${id}`,
    request_no: id,
    staff_title_name: 'พนักงานขับรถ',
    override_province: 'สมุทรปราการ',
    location_address: 'ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ',
    request_positions: 2,
    ...extra,
  }) as unknown as JobRequest;

const NOW = Date.parse('2026-11-23T05:00:00Z');

describe('ใบในหน้านี้: สั่งได้ / ข้าม — ด่านเดียวกับปุ่ม Scrap ของใบเดียว', () => {
  it('ใบครบข้อมูล = สั่งได้ · ขาดตำแหน่ง/จังหวัด/จำนวน = ข้ามพร้อมบอกว่าขาดอะไร · กำลัง Scrap อยู่ = ข้าม', () => {
    const jobs = [
      job('LBD6911001'),
      job('LBD6911002', { override_province: null, location_address: '' }),
      job('LBD6911003', { request_positions: null, position_units: null }),
      job('LBD6911004'),
      job('LBD6911005'),
    ];
    const latest = [
      { job_id: 'siamraj-sql:LBD6911004', request_type: 'scraping', status: 'in_progress', created_at: '2026-11-23T04:00:00Z' },
      // เสร็จแล้ว / โพสต์ (ไม่ใช่ Scrap) = สั่งใหม่ได้
      { job_id: 'siamraj-sql:LBD6911005', request_type: 'scraping', status: 'completed', created_at: '2026-11-22T04:00:00Z' },
      { job_id: 'siamraj-sql:LBD6911001', request_type: 'content', status: 'pending', created_at: '2026-11-23T04:30:00Z' },
    ];
    const rows = bulkScrapRows(jobs, latest, NOW);
    expect(rows.map((r) => [r.job.request_no, r.skip])).toEqual([
      ['LBD6911001', null],
      ['LBD6911002', 'ใบขอขาดจังหวัด'],
      ['LBD6911003', 'ใบขอขาดจำนวนคน'],
      ['LBD6911004', 'So Scraping กำลัง Scrap ใบนี้อยู่'],
      ['LBD6911005', null],
    ]);
  });
});

describe('ใบละกี่ Resume + โควต้า', () => {
  it('รับเฉพาะจำนวนเต็ม 1 ขึ้นไป', () => {
    expect(parsePerRequest(' 15 ')).toBe(15);
    for (const bad of ['', '0', '-3', '2.5', 'สิบ']) expect(parsePerRequest(bad)).toBeNull();
  });

  it('ค่าเริ่ม = แบ่งโควต้าที่เหลือเท่า ๆ กัน ไม่เกิน 20 · ไม่รู้โควต้า = 10', () => {
    expect(defaultPerRequest(200, 8)).toBe(20);
    expect(defaultPerRequest(90, 9)).toBe(10);
    expect(defaultPerRequest(5, 9)).toBe(1);
    expect(defaultPerRequest(null, 9)).toBe(10);
  });

  it('รวมทั้งหน้าเกินโควต้าที่เหลือ = สั่งไม่ได้ พร้อมบอกยอดรวม · พอดีโควต้า = ผ่าน', () => {
    const base = { accountMissing: false, accountBlocked: null };
    expect(bulkScrapProblems({ ...base, ready: 9, perRequest: 20, remaining: 150 })).toEqual([
      'รวม 180 คน เกินโควต้าที่เหลือวันนี้ 150 คน — ลดจำนวนต่อใบ หรือเลือกเว็บอื่น',
    ]);
    expect(bulkScrapProblems({ ...base, ready: 10, perRequest: 15, remaining: 150 })).toEqual([]);
    expect(bulkScrapProblems({ ...base, ready: 0, perRequest: null, remaining: null })).toEqual(['หน้านี้ไม่มีใบที่สั่ง Scrap ได้', 'ใส่จำนวน Resume ต่อใบ (ตัวเลข 1 ขึ้นไป)']);
  });
});

describe('หน้าจอ', () => {
  const dialog = readFileSync('src/components/jobs/BulkScrapDialog.tsx', 'utf8');
  const page = readFileSync('src/pages/jobs/JobListPage.tsx', 'utf8');

  it('ปุ่ม "Scrap ทั้งหน้า" บนหัวหน้าใบขอ ส่งแถวที่ตารางแสดงอยู่ (หน้าที่เปิด + ตัวกรอง)', () => {
    expect(page).toContain('data-testid="job-list-bulk-scrap"');
    expect(page).toContain('<BulkScrapDialog open={bulkScrapOpen} onOpenChange={setBulkScrapOpen} jobs={paginated} />');
  });

  it('ป๊อปข้อ 1-2-3 แบบเดียวกับ Scrap ใบเดียว · ส่งทีละใบด้วยเส้นเดิม + จำนวนต่อใบเป็น scrape_target', () => {
    for (const t of ['1 · บัญชี JobThai / JobBKK', '2 · ใบละกี่ Resume', '3 · เครื่อง']) expect(dialog).toContain(t);
    expect(dialog).toContain('await createJobPostingRequest({');
    expect(dialog).toContain('scrape_target: per,');
    expect(dialog).toContain('requestType: \'scraping\',');
    // ใบที่ส่งสำเร็จแล้วไม่ส่งซ้ำตอนกดส่งใบที่เหลือ
    expect(dialog).toContain('if (results[job.id]?.ok) continue;');
  });
});
