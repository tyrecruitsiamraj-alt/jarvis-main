/**
 * ฉบับ 9 (4 พ.ย. 2569): ใบที่ค้างหรือไม่สำเร็จ ต้องสั่งใหม่ได้จากปุ่ม Autopost / Scrap บนการ์ด
 * ค้าง = เหตุจาก So Scraping + ส่งอีกครั้ง / ยกเลิกแล้วสั่งใหม่ · ไม่สำเร็จ = เหตุ + "สั่งใหม่" · ฟอร์มเติมจากใบเดิม · ไม่มีคำว่า "ไม่รับงาน"
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { SO_FACET_LABEL, SO_STATUS_LABEL, soNoticeTitle, soRejectReason, soStuckLine } from '@/lib/soScraping';
import { fetchSoStatusOf } from '../../api/_lib/soScrapingOptions';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn(async () => ({ rows: [{ base_url: 'https://so.example', key_enc: 'x' }] })) }));
vi.mock('../../api/_lib/aiSettingsStore.js', async (orig) => ({ ...(await orig<Record<string, unknown>>()), decryptApiKey: () => 'k' }));

const read = (p: string) => readFileSync(p, 'utf8');

describe('คำบนจอ', () => {
  it('"ไม่รับงาน" → "ไม่สำเร็จ" ทุกที่', () => {
    expect(SO_STATUS_LABEL.rejected).toBe('ไม่สำเร็จ');
    expect(SO_FACET_LABEL.rejected).toBe('ไม่สำเร็จ');
    expect(soNoticeTitle('content', 'rejected')).toBe('สั่งโพสต์ · ไม่สำเร็จ');
    for (const f of ['src/components/jobs/AutopostDialog.tsx', 'src/components/jobs/OrderPostButton.tsx', 'src/components/jobs/BoardJobCard.tsx', 'src/components/jobs/SoStuckPanel.tsx']) {
      expect(read(f), f).not.toMatch(/['">]ไม่รับงาน/);
    }
  });
  it('เหตุ: ตัด "ตีกลับ: " · ค้าง = issues · อื่น ๆ = ไม่มี', () => {
    expect(soRejectReason('ตีกลับ: บัญชีถูก Facebook จำกัด')).toBe('บัญชีถูก Facebook จำกัด');
    expect(soRejectReason('  ')).toBeNull();
    expect(soStuckLine({ status: 'rejected', notes: 'ตีกลับ: โพสต์ไม่ได้' })).toBe('โพสต์ไม่ได้');
    expect(soStuckLine({ status: 'pending', issues: ['บัญชี Burkhart Debe ถูกพักอยู่'] })).toBe('ยังเริ่มไม่ได้: บัญชี Burkhart Debe ถูกพักอยู่');
    expect(soStuckLine({ status: 'pending' })).toBeNull();
    expect(soStuckLine({ status: 'posted', notes: 'x' })).toBeNull();
  });
});

describe('เหตุจาก So Scraping /status', () => {
  it('อ่าน issues ของใบ+ประเภทนั้น (หน้าตาจริง 4 พ.ย. 2569) · ไม่พบ = null', async () => {
    const body = {
      requests: [
        { request_no: 'OPL6910066', type: 'content', jarvis_status: 'pending', run_message: 'Worker run completed', issues: ['บัญชี Burkhart Debe ถูกพักอยู่'] },
        { request_no: 'OPL6910066', type: 'scraping', issues: [] },
      ],
    };
    const f = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
    expect(await fetchSoStatusOf('OPL6910066', 'content', f)).toEqual({ issues: ['บัญชี Burkhart Debe ถูกพักอยู่'], runMessage: 'Worker run completed' });
    expect(await fetchSoStatusOf('SQ6911003', 'content', f)).toBeNull();
  });
});

describe('ต่อสาย', () => {
  it('server: ยกเลิกได้เฉพาะตอนยัง pending (DB ตัดสิน) · คนกดบันทึกใน notes · เริ่มแล้ว = 409 บอกเหตุ · บอร์ดแนบเหตุใบค้าง', () => {
    const lib = read('api/_lib/jobPostingRequests.ts');
    expect(lib).toContain("where id = $1 and status = 'pending' returning");
    const h = read('api/_handlers/matching-job-postings.ts');
    expect(h).toContain("cancelPendingJobPostingRequest(existing.id, `ยกเลิกโดย ${req.user.email ?? req.user.sub}`)");
    expect(h).toContain("'So Scraping เริ่มงานแล้ว ยกเลิกไม่ได้'");
    expect(h).toContain('return res.status(200).json({ items: await withStuckIssues(items) });');
  });
  it('ป๊อป: ค้าง = แผงเหตุ + 2 ปุ่ม · ไม่สำเร็จ = เหตุ + ปุ่ม "สั่งใหม่" · เติมฟอร์มจากใบเดิม · บัญชีตั้งต้นไม่ใช่บัญชีเดิม', () => {
    const panel = read('src/components/jobs/SoStuckPanel.tsx');
    expect(panel).toContain('ส่งให้ So Scraping อีกครั้ง');
    expect(panel).toContain('ยกเลิกใบนี้แล้วสั่งใหม่');
    expect(panel).toContain('ยังเริ่มไม่ได้: {t}');
    const ap = read('src/components/jobs/AutopostDialog.tsx');
    expect(ap).toContain('<SoStuckPanel');
    expect(ap).toContain("retryFrom ? 'สั่งใหม่' : 'ส่ง Autopost'");
    expect(ap).toContain('opts.accounts.filter((a) => a.id !== prevAccount)');
    expect(ap).toContain('setCaption(syncCaptionLink(snap.caption, AUTOPOST_LINK_PLACEHOLDER));');
    expect(ap).not.toContain('รอให้เสร็จก่อนถึงสั่งใหม่ได้\n            </p>\n          ) : null}\n\n          {openPosting');
    const order = read('src/components/jobs/OrderPostButton.tsx');
    expect(order).toContain("scraping?.status === 'pending' ? (\n            <SoStuckPanel");
    expect(read('src/components/jobs/BoardJobCard.tsx')).toContain('data-testid="board-card-so-why"');
  });
});
