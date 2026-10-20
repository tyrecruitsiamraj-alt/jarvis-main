/**
 * สั่งโพสต์ / ขอ Scrap ไประบบ So Scraping (เจ้าของ 20 ต.ค. 2569) — ข้อตรวจรับ 1–10
 * + Choice: เก็บ "ไม่รับงาน" ได้ · โพสต์แล้วสั่งซ้ำได้ · ขอ Scrap อยู่ป๊อปประกาศที่เดียว · ผล Scrap อยู่ที่ So Scraping
 * + Journey ตามงาน: ป้ายบนการ์ด · ตัวกรอง · แจ้งเตือนกระดิ่ง · รอนาน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { JobRequest } from '@/types';
import {
  defaultSoGroupIds,
  soFacetValues,
  soNoticeTitle,
  soPostOrderError,
  soPostSnapshot,
  soScrapMissing,
  soScrapSnapshot,
  soSnapshotError,
  soStatusView,
  sortSoGroups,
  type SoGroup,
} from '@/lib/soScraping';

const read = (p: string) => readFileSync(p, 'utf8');
const JOB = {
  id: 'j1',
  request_no: 'R-1',
  staff_title_name: 'คนสวน',
  override_province: 'สมุทรปราการ',
  location_address: 'ต.บางพลีใหญ่ อ.บางพลี จ.สมุทรปราการ',
  request_positions: 3,
  age_range_min: 20,
  age_range_max: 55,
  gender_requirement: 'M',
  total_income: 12000,
  work_schedule: 'จันทร์ - เสาร์',
} as unknown as JobRequest;

describe('สั่งโพสต์: แบบโพสต์ + ข้อความ + กลุ่ม', () => {
  it('ข้อ 1/10: ข้อความอย่างเดียว → post_mode + caption ฉบับที่เห็น + group_ids ตามที่เลือก · ข้อมูลใบขอเดิมยังอยู่', () => {
    const snap = soPostSnapshot({ position: 'คนสวน', qty: 3 }, { mode: 'caption_only', caption: '  รับสมัครคนสวน  ', groupIds: ['g1', 'g2'] });
    expect(snap).toEqual({ position: 'คนสวน', qty: 3, post_mode: 'caption_only', caption: 'รับสมัครคนสวน', group_ids: ['g1', 'g2'] });
    expect(soSnapshotError('content', snap)).toBeNull();
  });
  it('ข้อ 2: ข้อความ + รูป ไม่ใส่ข้อความ = กดไม่ได้ บอกให้ใส่', () => {
    expect(soPostOrderError({ mode: 'caption_image', caption: '  ', groupIds: ['g1'] })).toBe('ใส่ข้อความประกาศก่อนสั่งโพสต์');
    expect(soPostOrderError({ mode: 'caption_only', caption: '', groupIds: ['g1'] })).toBe('ใส่ข้อความประกาศก่อนสั่งโพสต์');
  });
  it('ข้อ 3: รูปอย่างเดียว ไม่ใส่ข้อความได้', () => {
    expect(soPostOrderError({ mode: 'image_only', caption: '', groupIds: ['g1'] })).toBeNull();
    expect(soPostSnapshot({}, { mode: 'image_only', caption: '', groupIds: ['g1'] }).post_mode).toBe('image_only');
  });
  it('ข้อ 9: ไม่เลือกกลุ่ม = กดไม่ได้ · server ตรวจซ้ำกติกาเดียวกัน · คำขอรุ่นเก่า (ไม่มี post_mode) ยังรับ', () => {
    expect(soPostOrderError({ mode: 'caption_only', caption: 'x', groupIds: [] })).toBe('เลือกกลุ่ม Facebook อย่างน้อย 1 กลุ่ม');
    expect(soSnapshotError('content', { post_mode: 'caption_only', caption: 'x', group_ids: [] })).toBe('เลือกกลุ่ม Facebook อย่างน้อย 1 กลุ่ม');
    expect(soSnapshotError('content', { position: 'x' })).toBeNull();
  });
  it('ข้อ 8: กลุ่มจังหวัดเดียวกับใบขอขึ้นก่อนและติ๊กไว้ให้', () => {
    const groups: SoGroup[] = [
      { id: 'a', name: 'งานกรุงเทพ', province: 'กรุงเทพมหานคร', department: null, job_type: null },
      { id: 'b', name: 'งานบางพลี', province: 'สมุทรปราการ', department: null, job_type: null },
    ];
    expect(sortSoGroups(groups, 'สมุทรปราการ').map((g) => g.id)).toEqual(['b', 'a']);
    expect(defaultSoGroupIds(groups, 'สมุทรปราการ')).toEqual(['b']);
    expect(defaultSoGroupIds(groups, null)).toEqual([]);
  });
  it('ข้อ 8: อ่านเฉพาะกลุ่มที่มีบัญชีผูก · ไม่แตะคอลัมน์อื่นของ users (รหัสผ่าน/token)', () => {
    const src = read('api/_lib/soScrapingGroups.ts');
    expect(src).toContain('u.group_ids ? g.id::text');
    expect(src).not.toMatch(/u\.(password|fb_access_token|email|\*)/);
    expect(src).not.toMatch(/\b(insert|update|delete)\b/i);
  });
});

describe('ขอ Scrap', () => {
  it('ข้อ 4: ไม่มีจังหวัด = กดไม่ได้ บอกว่าขาดจังหวัด', () => {
    const noProvince = { ...JOB, override_province: null, location_address: '' } as unknown as JobRequest;
    expect(soScrapMissing(noProvince)).toEqual(['จังหวัด']);
    expect(soSnapshotError('scraping', soScrapSnapshot(noProvince))).toBe('ใบขอนี้ขาดจังหวัด — ขอ Scrap ไม่ได้');
  });
  it('ข้อ 5: ครบ → position · location (จังหวัด) · qty ตัวเลข + ช่องที่มี', () => {
    expect(soScrapMissing(JOB)).toEqual([]);
    expect(soScrapSnapshot(JOB)).toEqual({
      position: 'คนสวน',
      location: 'สมุทรปราการ',
      qty: 3,
      age_min: 20,
      age_max: 55,
      gender: 'M',
      income: 12000,
      work_schedule: 'จันทร์ - เสาร์',
    });
  });
  it('ปุ่มอยู่ป๊อปประกาศที่เดียว · reason ตามสเปก', () => {
    expect(read('src/components/jobs/OrderPostButton.tsx')).toContain('reason: SO_SCRAP_REASON,');
    expect(read('src/components/jobs/AutopostDialog.tsx')).toContain('reason: SO_POST_REASON,');
    expect(read('src/lib/soScraping.ts')).toContain("export const SO_SCRAP_REASON = 'ขอ Scrap จาก Jarvis';");
    expect(read('src/pages/matching/MatchingPage.tsx')).not.toContain("'Scraping งาน'");
  });
});

describe('กันสั่งซ้ำ + สถานะที่ So Scraping เขียนกลับ', () => {
  it('ข้อ 6: ยังรอ/กำลังทำ = ไม่สร้างแถวใหม่ (ทั้งโค้ดและ index) · โพสต์แล้วสั่งใหม่ได้', () => {
    const lib = read('api/_lib/jobPostingRequests.ts');
    expect(lib).toContain("const ACTIVE_STATUSES: JobPostingStatus[] = ['pending', 'in_progress'];");
    expect(lib).toContain('if (existing) return existing;');
    const mig = read('migrations/157_job_posting_so_scraping.sql');
    expect(mig).toContain("where status in ('pending', 'in_progress');");
    expect(mig).toContain("'rejected'");
    expect(mig).not.toMatch(/drop column|rename column|update job_posting_requests set/i);
  });
  it('ข้อ 7: คำบนจอตามตาราง · ไม่รับงานแดง + เหตุผลจาก notes · รอเกิน 1 ชม. = รอนาน', () => {
    const now = Date.parse('2026-10-20T10:00:00Z');
    const at = '2026-10-20T09:30:00Z';
    expect(soStatusView({ status: 'pending', created_at: at }, now)).toMatchObject({ label: 'ส่งแล้ว รอระบบรับ', tone: 'warn', open: true });
    expect(soStatusView({ status: 'in_progress', created_at: at }, now)).toMatchObject({ label: 'กำลังทำ', tone: 'warn', open: true });
    expect(soStatusView({ status: 'posted', created_at: at }, now)).toMatchObject({ label: 'โพสต์แล้ว', tone: 'success', open: false });
    expect(soStatusView({ status: 'completed', created_at: at }, now)).toMatchObject({ label: 'เสร็จ', tone: 'success' });
    expect(soStatusView({ status: 'rejected', created_at: at }, now)).toMatchObject({ label: 'ไม่รับงาน', tone: 'danger', open: false });
    expect(soStatusView({ status: 'pending', created_at: '2026-10-20T08:30:00Z' }, now)).toMatchObject({ waitLong: true, tone: 'danger' });
    expect(read('src/components/jobs/OrderPostButton.tsx')).toContain("req?.status === 'rejected' && req.notes?.trim()");
  });
});

describe('ตามงานได้โดยไม่ต้องเปิดป๊อป', () => {
  it('ป้ายบนการ์ด + ตัวกรอง "สั่งแล้วยังไม่เสร็จ / ไม่รับงาน"', () => {
    expect(soFacetValues([{ status: 'pending' }, { status: 'rejected' }]).sort()).toEqual(['open', 'rejected']);
    expect(soFacetValues([{ status: 'completed' }])).toEqual(['done']);
    expect(read('src/components/jobs/BoardJobCard.tsx')).toContain('data-testid="board-card-so"');
    expect(read('src/lib/boardFilters.ts')).toContain("key: 'so',");
  });
  it('แจ้งเตือนคนสั่งเมื่อ โพสต์แล้ว / เสร็จ / ไม่รับงาน — ครั้งเดียวต่อสถานะ · กดแล้วเปิดใบนั้น', () => {
    expect(soNoticeTitle('content', 'posted')).toBe('สั่งโพสต์ · โพสต์แล้ว');
    expect(soNoticeTitle('scraping', 'rejected')).toBe('Scrap · ไม่รับงาน');
    expect(soNoticeTitle('content', 'in_progress')).toBeNull();
    const w = read('api/_lib/soScrapingNotices.ts');
    expect(w).toContain('dedupeKey: `so_scraping:${r.id}:${r.status}`');
    expect(w).toContain('link: `/jobs/board?posting=${encodeURIComponent(r.job_id)}`');
    expect(read('server/local-api.ts')).toContain('startSoScrapingNoticeWorker();');
    expect(read('src/components/jobs/JobBoardView.tsx')).toContain("const jobId = searchParams.get('posting');");
  });
});

describe('กดแจ้งเตือนแล้วป๊อปใบนั้นต้องเปิดค้าง (เจอบนเว็บจริง 20 ต.ค. 2569)', () => {
  it('แผงแจ้งเตือนปิดก่อนพาไป · ไม่คืนโฟกัสไปที่กระดิ่ง (ไม่งั้นป๊อปปลายทางนับว่าโดนแตะนอกกรอบแล้วปิด)', () => {
    const panel = read('src/components/notifications/NotificationPanel.tsx');
    expect(panel).toContain('<Popover open={open} onOpenChange={setOpen}>');
    expect(panel).toContain('setOpen(false);\n    if (link) navigate(link);');
    expect(panel).toContain('onCloseAutoFocus={(e) => e.preventDefault()}');
  });
});

describe('กระดิ่งแยกแจ้งเตือน So Scraping ไม่ให้ตกหาย (เจ้าของ 20 ต.ค. 2569)', () => {
  it('รวมรายการแล้วตัดเหลือ N โดยไม่ทิ้งของ So Scraping · แท็บกรองเฉพาะชนิดนั้น', async () => {
    const { capKeepingPinned, notificationsOfTab } = await import('@/lib/notificationTabs');
    const ai = Array.from({ length: 40 }, (_, i) => ({ type: 'follow_ai_overdue', timestamp: `2026-10-20T10:${String(i).padStart(2, '0')}:00Z` }));
    const so = { type: 'so_scraping_status', timestamp: '2026-10-20T09:00:00Z' };
    const capped = capKeepingPinned([...ai, so], 30);
    expect(capped).toHaveLength(31);
    expect(capped).toContain(so);
    expect(capped.at(-1)).toBe(so);
    expect(notificationsOfTab(capped, 'so')).toEqual([so]);
    expect(notificationsOfTab(capped, 'all')).toHaveLength(31);
  });
  it('server ดึงชนิดที่ปักไว้แยก 14 วัน · แผงมีแท็บ', () => {
    const lib = read('api/_lib/appNotifications.ts');
    expect(lib).toContain("type = any($3::text[]) and created_at > now() - interval '14 days'");
    expect(lib).toContain('[...PINNED_NOTIFICATION_TYPES]');
    const panel = read('src/components/notifications/NotificationPanel.tsx');
    expect(panel).toContain("const shown = notificationsOfTab(notifications, tab);");
    expect(panel).toContain("'ยังไม่มีแจ้งเตือนจาก So Scraping'");
    expect(read('src/contexts/NotificationContext.tsx')).toContain('return capKeepingPinned(merged, MAX_NOTIFICATIONS);');
  });
});
