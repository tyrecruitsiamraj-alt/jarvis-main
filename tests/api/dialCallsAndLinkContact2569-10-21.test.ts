// @vitest-environment node
/**
 * ═══ 21 ต.ค. 2569 สองเรื่องจากเจ้าของ ═══
 * 1. แท็บการโทรในป๊อปผู้สมัคร: กดปุ่มโทรทุกครั้งขึ้นเป็นแถว "โทรหาผู้สมัคร" + ชื่อคนกด (แบบ iRecruit)
 * 2. หน้าลิงก์สมัคร /apply/p/… ต้องแนบผู้รับผิดชอบใบขอ ไม่งั้นไม่มีเบอร์เจ้าหน้าที่สรรหา
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { detailCallRows } from '@/lib/applicantDetail';

describe('แถวกดโทรในแท็บการโทร', () => {
  it('กดโทร 2 ครั้ง = 2 แถว มีชื่อคนกด เรียงล่าสุดก่อน รวมกับสาย AI', () => {
    const rows = detailCallRows(
      [{ id: 'q1', status: 'completed', created_at: '2026-10-21T01:00:00Z', result_at: '2026-10-21T01:05:00Z', outcome: null, attempts: 1, next_attempt_at: null } as never],
      [],
      [
        { id: 'd1', at: '2026-10-21T02:00:00Z', by_name: 'อัน' },
        { id: 'd2', at: '2026-10-21T03:00:00Z', by_name: null },
      ],
    );
    expect(rows.map((r) => [r.who, r.result])).toEqual([
      ['เจ้าหน้าที่', 'โทรหาผู้สมัคร'],
      ['อัน', 'โทรหาผู้สมัคร'],
      ['AI', 'AI โทรแล้ว'],
    ]);
  });

  it('API อ่านจาก audit application.dial ของใบนั้น', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'api/_handlers/job-applications.ts'), 'utf8');
    expect(src).toContain("a.action = 'application.dial'");
    expect(src).toContain('return res.status(200).json({ history, aiCalls, staffCalls, dialCalls });');
  });
});

describe('หน้าลิงก์สมัครมีเบอร์เจ้าหน้าที่สรรหา', () => {
  it('🔴 getLinkedPublicJob แนบผู้รับผิดชอบก่อนแปลงเป็นการ์ด', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'api/_handlers/public/jobs.ts'), 'utf8');
    const fn = src.slice(src.indexOf('export async function getLinkedPublicJob'));
    expect(fn.indexOf('await attachAssignments([withEdits]);')).toBeGreaterThan(-1);
    expect(fn.indexOf('await attachAssignments([withEdits]);')).toBeLessThan(fn.indexOf('withBenefits([toPublicJob(withEdits'));
  });
});
