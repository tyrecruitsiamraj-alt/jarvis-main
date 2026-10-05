// @vitest-environment node
/**
 * QA 5 ต.ค. 2569 ข้อ 3–5 — โหลดอยู่/โหลดพัง ห้ามแสดงเหมือน "ไม่มีข้อมูล"
 * (กติกา "ว่าง = 0" ใช้กับของที่ว่างจริงเท่านั้น · ยังไม่รู้ ≠ 0)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const src = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');

describe('ข้อ 3 การ์ดใบขอบนกล่องงาน', () => {
  const card = src('src/components/jobs/BoardJobCard.tsx');
  const board = src('src/components/jobs/JobBoardView.tsx');
  it('🔴 ยอดยังไม่มา = โครงกระดูก · โหลดพัง = บอกว่าโหลดไม่ได้ · ทั้งสองแบบมาก่อน "ยังไม่มีผู้สมัคร"', () => {
    const loadingAt = card.indexOf('applicants === null');
    const errorAt = card.indexOf("applicants === 'error'");
    const emptyAt = card.indexOf('ยังไม่มีผู้สมัคร', errorAt);
    expect(loadingAt).toBeGreaterThan(0);
    expect(errorAt).toBeGreaterThan(loadingAt);
    expect(emptyAt).toBeGreaterThan(errorAt);
    expect(card).toContain('โหลดยอดผู้สมัครไม่ได้');
  });
  it('กล่องงานส่งจำนวนเมื่อโหลดครบเท่านั้น และจับ error ของยอดผู้สมัคร', () => {
    expect(board).toMatch(/breakdownLoaded \? countFor\(applicantIdx, job\.id\) : breakdownFailed \? 'error' : null/);
    expect(board).toContain('setBreakdownFailed(true)');
  });
  it('🔴 ตัวดึงยอดโยน error เมื่อ server ตอบไม่ ok — ไม่คืนก้อนว่างให้กลายเป็น "ไม่มีผู้สมัคร"', () => {
    const api = src('src/lib/publicApplicationsApi.ts');
    const fn = api.slice(api.indexOf('export async function fetchJobApplicantBreakdown'));
    expect(fn.slice(0, 400)).toMatch(/if \(!r\.ok\) throw new Error/);
  });
});

describe('ข้อ 4 ป๊อปรายชื่อผู้สมัครของใบงาน', () => {
  const dlg = src('src/components/jobs/JobApplicantsDialog.tsx');
  it('🔴 ปุ่มบนแถวพลาดใช้ actionError — `error` (ซ่อนรายชื่อทั้งป๊อป) ตั้งได้จากการโหลดตอนเปิดเท่านั้น', () => {
    const sets = [...dlg.matchAll(/setError\((?!null)/g)];
    expect(sets).toHaveLength(1);
    expect(dlg).toMatch(/if \(!cancelled\) setError\(friendlyErrorText\(e,/);
    for (const msg of ['เก็บ Lead ไม่สำเร็จ', 'เก็บไปโทรเองไม่สำเร็จ', 'โหลดไฟล์แนบไม่สำเร็จ']) {
      expect(dlg).toContain(`setActionError(friendlyErrorText(e, '${msg}'))`);
    }
  });
  it('โหลดใหม่หลังกดปุ่มพลาด = บอก ไม่กลืนเงียบ', () => {
    expect(dlg).not.toMatch(/\.then\(setItems\)\s*\.catch\(\(\) => \{\}\)/);
  });
});

describe('ข้อ 5 แดชบอร์ดหัวหน้า + WL', () => {
  it('🔴 แดชบอร์ดหัวหน้าดูสภาพเส้นใบขอ — พัง/ไม่มีสิทธิ์ = แถบแจ้ง + ปุ่มโหลดใหม่ แทนเลข 0', () => {
    const sup = src('src/pages/dashboard/SupervisorDashboard.tsx');
    const shell = src('src/components/dashboard/analytics/DashboardShell.tsx');
    expect(sup).toMatch(/feedState === 'failed' \|\| feedState === 'forbidden'/);
    expect(sup).toContain('loadError={feedProblem}');
    expect(shell).toMatch(/\) : loadError \? \(/);
    expect(shell).toContain('โหลดใหม่');
  });
  it('🔴 WL: ยังโหลด/โหลดพัง = การ์ดขึ้น "—" ทั้ง 4 ใบ', () => {
    const wl = src('src/pages/wl/WLDashboard.tsx');
    expect(wl).toContain("wlUnknown ? '—' : n");
    expect([...wl.matchAll(/value=\{statValue\(/g)]).toHaveLength(4);
    expect(wl).not.toMatch(/value=\{\w+\.length\}/);
  });
});
