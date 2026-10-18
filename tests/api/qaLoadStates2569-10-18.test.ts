// @vitest-environment node
/**
 * QA 17 ต.ค. 2569 กลุ่ม "จอโหลด/ล้มแล้วบอกผิด" (หน้าในเมนูเท่านั้น · หน้าตกค้างยังไม่แตะ ตามที่เจ้าของเคาะ)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ล้มต้องบอก + ลองใหม่ได้ · ระหว่างโหลดห้าม 0', () => {
  it('คนของเรา: ไม่มี (HTTP …) · มีปุ่มลองใหม่ · ไม่วาดถังก่อนได้รายชื่อ', () => {
    const src = read('src/pages/matching/OurPeoplePage.tsx');
    expect(src).not.toContain('(HTTP ${r.status})');
    expect(src).toContain('<LoadErrorNotice message={error} onRetry={() => setRev((n) => n + 1)} />');
    expect(src).toContain('{(people ? grouped : [])');
  });
  it('จับคู่งาน: error ผ่าน friendlyErrorText · ชิประหว่างโหลดขึ้น …', () => {
    const src = read('src/pages/matching/MatchingPage.tsx');
    expect(src).not.toMatch(/e instanceof Error \? e\.message : '/);
    expect(src).toContain("(loadingJobs || serverListLoading) && c.count === 0 ? '…'");
  });
  it('ดูแลหลังเริ่มงาน: เลขหัวไม่เป็น 0 ระหว่างโหลด · สายจริงล้มต้องบอก · error อยู่ก่อนปฏิทิน', () => {
    const src = read('src/pages/aftercare/AftercarePage.tsx');
    expect(src).toContain("(loading ? '…' : error ? '—'");
    expect(src).toContain('setCallsError(true)');
    expect(src.indexOf('<LoadErrorNotice message={error} onRetry={load} />')).toBeLessThan(src.indexOf('<AftercarePlanningCalendar'));
  });
  it('ติดตามนัดหมาย: ล้มแล้วชิปเป็น "—" เหมือนแท็บอื่น', () => {
    expect(read('src/components/recruit-rm/RmWorkspace.tsx')).toContain(
      "count: loading ? null : loadError ? 'unknown' : appointmentChipCount(appointmentBoard, c.id),",
    );
  });
  it('Dashboard: เส้นเสริมล้มต้องบอก · รีเฟรชโหลดเส้นเสริมใหม่', () => {
    const src = read('src/pages/dashboard/SupervisorDashboard.tsx');
    expect(src).toContain("setSideFailed((s) => ({ ...s, throughput: true }))");
    expect(src).toContain('setSideRev((n) => n + 1);');
    expect(read('src/components/dashboard/analytics/DashboardShell.tsx')).toContain('<LoadErrorNotice message={partialError}');
  });
  it('Dashboard ติดตาม: รีเฟรชไม่ remount (ช่วงไม่เด้ง) · ล้มล้างเลขเก่า', () => {
    expect(read('src/pages/follow/FollowPage.tsx')).toContain('<FollowDashboard refreshKey={dashRev} />');
    const src = read('src/components/dashboard-trends/FollowDashboard.tsx');
    expect(src).toContain('setRows(null);');
    expect(src).toContain('rev, refreshKey]');
  });
  it('ใบขอ: ระหว่างโหลดไม่ขึ้น "0 งาน" · ค้นอยู่ไม่บอก "แสดงทุกใบ"', () => {
    const src = read('src/pages/jobs/JobListPage.tsx');
    expect(src).toContain("? 'กำลังโหลด…'");
    expect(src).toContain("search.trim() ? 'กรองด้วยคำค้นอยู่' : 'แสดงทุกใบอยู่'");
  });
  it('ช่องทางในฟอร์มเพิ่มผู้สมัคร: ระหว่างโหลดไม่บอก "ยังไม่มีช่องทาง"', () => {
    expect(read('src/components/shared/ChannelPicker.tsx')).toContain("'กำลังโหลดช่องทาง…'");
  });
  it('/value ล้มไม่วาด 0 บาท + ชั่วโมงทำงาน 0 บันทึกไม่ได้ · /recruit/channels ล้มกดเพิ่มไม่ได้ · Pre-Check ไม่ขึ้น 0 รายการตอนโหลด', () => {
    const v = read('src/pages/value/ValueCasePage.tsx');
    expect(v).toContain('message="โหลดข้อมูลไม่สำเร็จ"');
    expect(v).toContain('ชั่วโมงทำงานต่อคนต้องมากกว่า 0');
    expect(read('src/pages/recruit/RecruitChannelsPage.tsx')).toContain('disabled={saving || listFailed}');
    expect(read('src/pages/matching/PreCheckPage.tsx')).toContain("feedJobs.length === 0 && (loadingJobs || jobsLoadError) ? '—'");
  });
  it('ทุกหน้าในเมนูมี error boundary · คำโหลดไม่มีอังกฤษ', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('<PageErrorBoundary resetKey={location.pathname}>');
    expect(app).not.toContain('กำลังโหลด session');
  });
});
