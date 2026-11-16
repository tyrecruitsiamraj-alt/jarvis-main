import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { RM_JOB_ALL_PARAM, filterApplications } from '../../src/lib/recruitRm';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

/**
 * "ดูรายชื่อ" บนการ์ดกล่องงาน = ทุกคนของใบนั้น (เจ้าของ 16 พ.ย. 2569 Choice "เห็นทุกคนของใบนั้น อยู่ในกล่องงาน")
 * OPL6808001: การ์ดขึ้น 3 กดแล้วเห็น 1 — อีก 2 คนมีเจ้าหน้าที่เก็บไปโทรแล้ว (แท็บผู้สมัครปกติซ่อน)
 */
const empty = { statuses: [], channels: [], provinces: [], dateFrom: null, dateTo: null } as never;
const row = (id: string, p: Partial<PublicApplication>) => ({ id, status: 'new', full_name: id, phone: '0800000000', job_id: 'siamraj-sql:OPL6808001', ...p }) as PublicApplication;

describe('ดูรายชื่อจากการ์ด = ทุกคนของใบนั้น', () => {
  it('โหมดทุกคนของใบ ไม่ตัดคนที่ฉันเก็บไปแล้ว · แท็บปกติยังตัดเหมือนเดิม', () => {
    const rows = [row('a', {}), row('b', { claimed: true, claimed_by_me: true } as never), row('c', { status: 'converted' })];
    expect(filterApplications(rows, 'candidates', empty, '', false, true).map((r) => r.id)).toEqual(['a', 'b', 'c']);
    expect(filterApplications(rows, 'candidates', empty, '').map((r) => r.id)).not.toContain('b');
  });

  it('การ์ดส่งพารามิเตอร์ · แท็บผู้สมัครโหลดรายชื่อทั้งใบ (เส้น job_id ตัวเดียวกับเลขบนการ์ด) เฉพาะตอนยังติ๊กใบนั้นอยู่', () => {
    const board = readFileSync('src/components/jobs/JobBoardView.tsx', 'utf8');
    expect(board).toContain('params.set(RM_JOB_ALL_PARAM, key);');
    const ws = readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8');
    expect(ws).toContain('(jobAll ? fetchJobApplications(jobAll) : fetchAllJobApplications(');
    expect(ws).toContain("searchParams.getAll(`${APPLICANT_FILTER_PARAM_PREFIX}job`).includes(jobAllParam)");
    expect(RM_JOB_ALL_PARAM).toBe('joball');
  });
});
