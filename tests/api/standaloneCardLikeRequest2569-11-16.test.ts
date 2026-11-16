/**
 * กล่องลอยเหมือนการ์ดใบขอ (เจ้าของ 16 พ.ย. 2569 "ทำกล่องลอยให้เหมือนการ์ดใบขอ" · "Autopost / Scrap มันต้องสั่งไม่ได้จากกล่องพวกนั้น")
 * - ปุ่ม "ดูรายชื่อ" จริง: ใบสมัครจากประกาศกล่องลอยคีย์ด้วยประเภท (`standalone:<ประเภท>`)
 * - ทำอะไรไปแล้ว = กล่องโพสต์เองกล่องเดียว · เส้น job-post-actions คืน byKind
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applicantJobLabels, applicantJobValue, standaloneJobValue } from '../../src/lib/applicantFilters';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

const app = (p: Partial<PublicApplication>) => ({ id: 'a1b2c3d4-0000-4000-8000-000000000001', full_name: 'สมชาย ใจดี', phone: '0812345678', status: 'new', created_at: '2026-11-16T02:00:00Z', ...p }) as PublicApplication;

describe('หัวข้อ "ใบขอที่สมัคร" ของใบจากกล่องลอย', () => {
  it('มีใบขอ = job_id · กล่องลอย = standalone:<ประเภท> · ไม่มีทั้งคู่ = ชื่องาน', () => {
    expect(applicantJobValue(app({ job_id: 'siamraj-sql:OPL6909064', job_title: 'พนักงานขับรถ' }))).toBe('siamraj-sql:OPL6909064');
    expect(applicantJobValue(app({ standalone_kind: 'tiktok_live', standalone_kind_label: 'Tiktok Live', job_title: 'รับสมัครด่วน' }))).toBe('standalone:tiktok_live');
    expect(applicantJobValue(app({ job_title: 'รับสมัครด่วน' }))).toBe('รับสมัครด่วน');
    expect(standaloneJobValue('tiktok_live')).toBe('standalone:tiktok_live');
  });
  it('คำบนจอ = "กล่องลอย · ชื่อประเภท" · ยังไม่มีใครสมัคร = รหัสประเภท', () => {
    const label = applicantJobLabels([app({ standalone_kind: 'tiktok_live', standalone_kind_label: 'Tiktok Live' })]);
    expect(label('standalone:tiktok_live')).toBe('กล่องลอย · Tiktok Live');
    expect(label('standalone:walk_in')).toBe('กล่องลอย · walk_in');
  });
});

describe('ฝั่ง server', () => {
  it('รายชื่อผู้สมัครส่งประเภทกล่องลอย (ทุกชั้นคอลัมน์มีชื่อเดียวกัน)', () => {
    const h = readFileSync('api/_handlers/job-applications.ts', 'utf8');
    expect(h).toContain('where p.id = a.posting_id and p.job_id is null) as standalone_kind');
    expect(h.match(/null::text as standalone_kind, null::text as standalone_kind_label/g)).toHaveLength(3);
  });
  it('ยอดโพสต์เองของกล่องลอยคีย์ด้วย standalone:<ประเภท> · ไม่ดึงผลรายกลุ่ม So Scraping', () => {
    const lib = readFileSync('api/_lib/jobPostActions.ts', 'utf8');
    expect(lib).toContain("coalesce(p.job_id, '${STANDALONE_KEY_PREFIX}' || p.standalone_kind) as job_id");
    expect(lib).toContain('p.job_id is null and p.standalone_kind = $1');
    expect(lib).toContain('return { byJob, byKind }');
    expect(lib).toContain('if (!standalone) try');
  });
});

describe('การ์ดกล่องลอย', () => {
  it('มีปุ่มดูรายชื่อจริง + กล่องโพสต์เองกล่องเดียว · ไม่มีกล่อง Autopost/Scrap', () => {
    const v = readFileSync('src/components/jobs/JobBoardView.tsx', 'utf8');
    expect(v).toContain('openApplicantsOfKind(k.code)');
    expect(v).toMatch(/<BoardCardActions\s+manualOnly/);
    const d = readFileSync('src/components/jobs/JobPostActionsDialog.tsx', 'utf8');
    expect(d).toContain(".filter((x) => !standalone || x.key === 'manual')");
  });
});
