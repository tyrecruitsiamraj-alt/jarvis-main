import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { manualLinkRows } from '../../src/lib/jobPostActions';
import { linkGroupsBy, linkTotalsOf, selfParts } from '../../src/lib/recruitTopics';

/** โพสต์เองรายลิงก์ (ภาพรวม 16 พ.ย. 2569) — โพสต์แล้ว = มีลิงก์โพสต์ · ไม่นับลิงก์ Autopost · ลิงก์ละแถว ไม่ซ้ำวัน */
const L = (id: string, p: Partial<Parameters<typeof manualLinkRows>[0][number]>) => ({
  link_id: id, job_id: 'siamraj-sql:OPL6911001', note: 'โพสต์เอง', created_at: '2026-11-13T03:00:00.000Z', channel_label: 'Facebook · Facebook Group · กลุ่มคนขับรถ',
  post_url: null, hit_count: 0, applicants: 0, created_by_name: 'เจมส์', ...p,
});

describe('โพสต์เองรายลิงก์', () => {
  it('โพสต์แล้ว = มีลิงก์โพสต์วางกลับมา · Autopost ไม่นับ · วันที่ตามเวลาไทย', () => {
    const rows = manualLinkRows(
      [
        L('a', { post_url: 'https://www.facebook.com/groups/1/posts/2/', hit_count: 30, applicants: 1 }),
        L('b', { hit_count: 10, applicants: 4, created_at: '2026-11-13T18:00:00.000Z' }),
        L('c', { note: 'Autopost', hit_count: 99 }),
      ],
      new Map(),
    );
    expect(rows.map((r) => [r.linkId, r.posted, r.day])).toEqual([['a', true, '2026-11-13'], ['b', false, '2026-11-14']]);
    expect(selfParts(rows).map((p) => p.value)).toEqual([1, 1]);
    expect(linkTotalsOf(rows)).toEqual({ links: 2, clicks: 40, applicants: 5 });
    expect(linkGroupsBy(rows, (r) => r.by)).toEqual([{ key: 'เจมส์', links: 2, clicks: 40, applicants: 5 }]);
  });

  it('เส้น ?links=1 อ่านอย่างเดียว + BU แบบเดียวกับรายวัน', () => {
    const h = readFileSync('api/_handlers/job-post-actions.ts', 'utf8');
    expect(h).toContain("if (one(req.query?.links) === '1') {");
    const lib = readFileSync('api/_lib/jobPostActions.ts', 'utf8');
    const fn = lib.slice(lib.indexOf('export async function loadManualLinks'), lib.indexOf('export async function loadManualPostDays'));
    expect(fn).toContain("buMatchSql(linkBuSql, '$3')");
    expect(fn).not.toMatch(/\b(insert|update|delete)\b/i);
  });
});
