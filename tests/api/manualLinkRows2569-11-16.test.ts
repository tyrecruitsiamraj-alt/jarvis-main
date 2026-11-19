import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { manualLinkRows } from '../../src/lib/jobPostActions';
import { linkPathOf, linkTotalsOf, linkTreeChildren, selfParts } from '../../src/lib/recruitTopics';

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
    // ไล่ลง ช่องทางหลัก › ช่องทางรอง › กลุ่ม › ผู้รับผิดชอบ (19 พ.ย. 2569 แบบรายชื่อเข้ามาไปถึงไหน)
    expect(linkPathOf(rows[0])).toEqual(['Facebook', 'Facebook Group', 'กลุ่มคนขับรถ', 'เจมส์']);
    expect(linkTreeChildren(rows, [])).toEqual([{ key: 'Facebook', path: ['Facebook'], leaf: false, links: 2, clicks: 40, applicants: 5 }]);
    expect(linkTreeChildren(rows, ['Facebook', 'Facebook Group', 'กลุ่มคนขับรถ'])).toEqual([
      { key: 'เจมส์', path: ['Facebook', 'Facebook Group', 'กลุ่มคนขับรถ', 'เจมส์'], leaf: true, links: 2, clicks: 40, applicants: 5 },
    ]);
  });

  it('ไม่ระบุช่องทาง = ชั้นเดียวแล้วถึงคน · ป้ายยาวเกิน 3 ชั้นรวมท้ายเป็นชื่อกลุ่ม', () => {
    const rows = manualLinkRows(
      [L('x', { channel_label: null, created_by_name: 'ว่าน', hit_count: 3 }), L('y', { channel_label: 'Facebook · Facebook Group · หางาน · ขับรถ', hit_count: 1 })],
      new Map(),
    );
    expect(linkPathOf(rows[0])).toEqual(['ไม่ระบุช่องทาง', 'ว่าน']);
    expect(linkPathOf(rows[1])).toEqual(['Facebook', 'Facebook Group', 'หางาน · ขับรถ', 'เจมส์']);
    const top = linkTreeChildren(rows, []);
    expect(top.map((n) => n.key)).toEqual(['ไม่ระบุช่องทาง', 'Facebook']);
    expect(linkTreeChildren(rows, ['ไม่ระบุช่องทาง'])[0]).toMatchObject({ key: 'ว่าน', leaf: true });
  });

  it('ป้ายเก่า "Facebook Group · ชื่อกลุ่ม" อยู่ใต้ Facebook · กลุ่ม FB ไม่มีชื่อ = ไม่ระบุกลุ่ม (ชื่อคนไม่ปนชั้นกลุ่ม)', () => {
    const rows = manualLinkRows(
      [L('o', { channel_label: 'Facebook Group · กลุ่มขับรถ' }), L('n', { channel_label: 'Facebook · Facebook Group', created_by_name: 'ใหม่' }), L('p', { channel_label: 'Facebook · Facebook Page' })],
      new Map(),
    );
    expect(linkPathOf(rows[0])).toEqual(['Facebook', 'Facebook Group', 'กลุ่มขับรถ', 'เจมส์']);
    expect(linkPathOf(rows[1])).toEqual(['Facebook', 'Facebook Group', 'ไม่ระบุกลุ่ม', 'ใหม่']);
    expect(linkPathOf(rows[2])).toEqual(['Facebook', 'Facebook Page', 'เจมส์']);
    expect(linkTreeChildren(rows, []).map((n) => n.key)).toEqual(['Facebook']);
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
