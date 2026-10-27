/** ลิงก์หน้าสมัครแยก BU (เจ้าของ 27 ต.ค. 2569 "/apply จะล็อคตำแหน่งยังไง แยก BU … ทำผ่าน UI") */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { applyBuLink, applyLinkShowsDocument } from '@/lib/applyBuLink';

describe('ลิงก์ /apply แยก BU', () => {
  it('BU + ตำแหน่ง · ทุก BU = ไม่มีพารามิเตอร์ · รหัสขยะไม่ใส่', () => {
    expect(applyBuLink('https://x.dev/', 'lbd', '')).toBe('https://x.dev/apply?bu=LBD');
    expect(applyBuLink('https://x.dev', 'LBA', ' ขับรถ ')).toBe(`https://x.dev/apply?bu=LBA&pos=${encodeURIComponent('ขับรถ')}`);
    expect(applyBuLink('https://x.dev', null, '')).toBe('https://x.dev/apply');
    expect(applyBuLink('https://x.dev', 'L1', '')).toBe('https://x.dev/apply');
  });

  it('server กรองตาม BU ก่อนส่ง ไม่ส่งรหัส BU ออกหน้าสาธารณะ · หน้าสมัครส่ง bu ต่อ', () => {
    const api = readFileSync('api/_handlers/public/jobs.ts', 'utf8');
    expect(api).toContain('listPublicSiamrajJobs(limit, parseBuParam(req.query?.bu))');
    expect(api).toContain('normalizeTrendBu((j as { department_code?: string | null }).department_code) === bu');
    const page = readFileSync('src/pages/public/PublicJobBoardPage.tsx', 'utf8');
    expect(page).toContain("searchParams.get('bu')");
  });

  it('แนบเอกสาร: เลือกไม่แนบ = doc=0 แล้วฟอร์มไม่มีช่องแนบ · ลิงก์เก่า/ไม่มี doc = มีช่องแนบ (27 ต.ค. 2569)', () => {
    expect(applyBuLink('https://x.dev', 'LBD', '', false)).toBe('https://x.dev/apply?bu=LBD&doc=0');
    expect(applyBuLink('https://x.dev', 'LBD', '', true)).toBe('https://x.dev/apply?bu=LBD');
    expect(applyLinkShowsDocument(new URLSearchParams('bu=LBD&doc=0'))).toBe(false);
    expect(applyLinkShowsDocument(new URLSearchParams('bu=LBD'))).toBe(true);
    const dlg = readFileSync('src/components/jobs/PublicApplyDialog.tsx', 'utf8');
    expect(dlg).toContain('const showDocument = applyLinkShowsDocument(searchParams);');
    expect(dlg).toContain('{showDocument ? (');
    expect(readFileSync('src/pages/settings/ApplyLinksTab.tsx', 'utf8')).toContain("{ value: '0', label: 'ไม่มีช่องแนบเอกสาร' }");
  });
});
