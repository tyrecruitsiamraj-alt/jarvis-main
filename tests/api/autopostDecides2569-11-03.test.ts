// @vitest-environment node
/**
 * หน้าสั่ง Autopost ตัดสินแทนคนสั่ง — สเปค So Scraping ฉบับ 3 พ.ย. 2569 (commit 2be6efb · docs/JARVIS_OPTIONS_PROMPT.md ข้อ 6)
 * เหตุ: คนสั่งเลือกบัญชีที่ถูกพัก 2 ใบติด และเลือก 14 กลุ่มที่ใบเดิมเพิ่งลง ระบบตอบ "ต้องเว้น 2 วัน" โดยไม่มีอะไรบนจอบอกก่อนกด
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parseSoOptions,
  soAccountChoice,
  soAccountSelectable,
  soAccountStatusText,
  soAddWithinCap,
  soDefaultAccount,
  soDefaultWorker,
  soGroupCap,
  soNoAccountReadyText,
  soPickError,
  soRepostWaitText,
  soStartText,
  soWorkerOfflineText,
  type SoOptAccount,
  type SoOptGroup,
} from '@/lib/soScraping';
import { callSoOptions, callSoStart } from '../../api/_lib/soScrapingOptions';

const RAW = {
  generated_at: '2026-11-03T08:00:00.000Z',
  request_no: 'OPL6910065',
  accounts: [
    { id: 'acc-p', name: 'Rudge Marita', status: 'paused', paused_until: '2026-11-04T02:21:00.000Z', posted_today: 0, daily_cap: 15, remaining_today: 15, recommended: false, session_workers: ['SONB-RM009'], warning: 'ถูกพัก' },
    { id: 'acc-v', name: 'Tyni Aiit', status: 'needs_verification', needs_verification_since: '2026-11-03T01:00:00.000Z', posted_today: 0, daily_cap: 15, remaining_today: 15, recommended: false, session_workers: ['SONB-RM009'] },
    { id: 'acc-r', name: 'Moody Keyanna', status: 'ready', posted_today: 3, daily_cap: 15, remaining_today: 12, recommended: true, session_workers: ['SONB-RM009'], department: 'LBD' },
    { id: 'acc-x', name: 'New Status', status: 'shadow_banned', warning: 'Facebook จำกัดการโพสต์', recommended: false },
  ],
  groups: [
    { id: 'g1', name: 'กลุ่ม 1', department: 'LBD', stats_30d: { attempts: 5, posted: 2, comments: 0, phone_leads: 0 }, repost_wait: null },
    { id: 'g2', name: 'กลุ่ม 2', department: 'LBD', stats_30d: { attempts: 9, posted: 9, comments: 0, phone_leads: 0 }, repost_wait: { request_no: 'OPL6910065', last_posted_at: '2026-11-02T03:12:00.000Z', available_at: '2026-11-04T03:12:00.000Z' } },
    { id: 'g3', name: 'กลุ่ม 3', department: 'LBD', stats_30d: { attempts: 6, posted: 6, comments: 0, phone_leads: 0 }, repost_wait: null },
    { id: 'g4', name: 'กลุ่ม 4', department: 'LM', stats_30d: { attempts: 9, posted: 9, comments: 0, phone_leads: 0 }, repost_wait: null },
  ],
  workers: [
    { name: 'SONB-RM011', online: false, last_seen: '2026-11-03T07:20:00.000Z', kinds: ['autopost'], recommended: { post: false, scrape: false } },
    { name: 'SONB-RM009', online: true, kinds: ['autopost', 'scraper'], recommended: { post: true, scrape: true } },
  ],
  scrape_accounts: [],
};
const o = parseSoOptions(RAW)!;
const acc = (id: string) => o.accounts.find((a) => a.id === id)!;

describe('6.1 บัญชี: ค่าเริ่มต้นคือบัญชีที่ใช้ได้ · ใช้ไม่ได้ต้องบอกว่าทำไม', () => {
  it('อ่านช่องใหม่: recommended · needs_verification_since · สถานะไม่รู้จัก = unknown เลือกไม่ได้', () => {
    expect(o.accounts.map((a) => [a.id, a.status, a.recommended])).toEqual([
      ['acc-p', 'paused', false],
      ['acc-v', 'needs_verification', false],
      ['acc-r', 'ready', true],
      ['acc-x', 'unknown', false],
    ]);
    expect(acc('acc-v').needsVerificationSince).toBe('2026-11-03T01:00:00.000Z');
    expect(['paused', 'needs_verification', 'unknown', 'no_worker'].map((s) => soAccountSelectable(s as SoOptAccount['status']))).toEqual([false, false, false, false]);
  });
  it('คำสถานะ + สีตามสเปค (ห้ามใช้สีอย่างเดียว)', () => {
    expect(soAccountStatusText(acc('acc-r'))).toEqual({ text: 'พร้อมโพสต์ · เหลือ 12 โพสต์วันนี้', tone: 'success' });
    expect(soAccountStatusText({ ...acc('acc-r'), status: 'busy' })).toEqual({ text: 'มีงานค้าง ต่อคิวได้', tone: 'warn' });
    expect(soAccountStatusText({ ...acc('acc-r'), status: 'full', postedToday: 15 })).toEqual({ text: 'ครบโควต้าวันนี้ (15/15)', tone: 'warn' });
    expect(soAccountStatusText({ ...acc('acc-r'), status: 'worker_offline', worker: 'SONB-RM011' })).toEqual({ text: 'เครื่อง SONB-RM011 ออฟไลน์', tone: 'warn' });
    expect(soAccountStatusText(acc('acc-p'))).toEqual({ text: 'ถูกพัก ใช้ได้ 4 พ.ย. 09:21', tone: 'danger' });
    expect(soAccountStatusText(acc('acc-v'))).toEqual({ text: 'ต้องยืนยันตัวตนที่เครื่อง ตั้งแต่ 3 พ.ย. 08:00', tone: 'danger' });
    expect(soAccountStatusText(acc('acc-x'))).toEqual({ text: 'Facebook จำกัดการโพสต์', tone: 'danger' });
    expect(soAccountChoice(acc('acc-p'), o.workers)).toMatchObject({ disabled: true, tone: 'danger' });
  });
  it('ค่าเริ่มต้น = บัญชีแรกที่แนะนำ (ธุรกิจของใบขอก่อน) · ไม่มีสักบัญชี = ว่าง + เวลาที่บัญชีแรกใช้ได้', () => {
    expect(soDefaultAccount(o.accounts, 'LBD')?.id).toBe('acc-r');
    expect(soDefaultAccount(o.accounts, 'LM')?.id).toBe('acc-r');
    const none = o.accounts.map((a) => ({ ...a, recommended: false }));
    expect(soDefaultAccount(none, 'LBD')).toBeNull();
    expect(soNoAccountReadyText(none, Date.parse('2026-11-03T08:00:00Z'))).toBe('ตอนนี้ไม่มีบัญชีที่พร้อมโพสต์ · บัญชีแรกใช้ได้ 4 พ.ย. 09:21');
  });
});

describe('6.2 กลุ่ม: ไม่เกินโพสต์ที่เหลือ · กลุ่มที่ใบนี้เพิ่งลงบอกเวลาและไม่ติ๊กให้', () => {
  it('อ่าน repost_wait · ข้อความ "ใบนี้เพิ่งลง … โพสต์ได้อีก …"', () => {
    const g2 = o.groups.find((g) => g.id === 'g2')!;
    expect(g2.repostWait).toEqual({ requestNo: 'OPL6910065', lastPostedAt: '2026-11-02T03:12:00.000Z', availableAt: '2026-11-04T03:12:00.000Z' });
    expect(soRepostWaitText(g2.repostWait!)).toBe('ใบนี้เพิ่งลง 2 พ.ย. 10:12 โพสต์ได้อีก 4 พ.ย. 10:12');
  });
  // 4 พ.ย. 2569 เจ้าของ "ไม่ติ๊กกลุ่มให้เลย" — ถอดค่าเริ่มต้นของกลุ่ม (defaultSoGroupPick) แล้ว (soGroupSector2569-11-04)
  it('server กันเลือกเกินโพสต์ที่เหลือ', () => {
    const snap = { account_id: 'acc-r', group_ids: Array.from({ length: 13 }, (_, i) => `x${i}`) };
    const many = { ...o, groups: [...o.groups, ...snap.group_ids.map((id) => ({ ...o.groups[0], id }))] };
    expect(soPickError(many, 'content', snap)).toBe('บัญชี Moody Keyanna เหลือโพสต์วันนี้ 12 กลุ่ม — ลดกลุ่ม หรือสั่งใบใหม่ด้วยบัญชีอื่น');
  });
  it('ติ๊กได้ไม่เกินเพดาน · เกินแล้วตัด · ไม่รู้เพดาน = ไม่จำกัด', () => {
    expect(soGroupCap(acc('acc-r'))).toBe(12);
    expect(soAddWithinCap(['a', 'b'], ['c', 'd', 'e'], 3)).toEqual(['a', 'b', 'c']);
    expect(soAddWithinCap(['a'], ['a', 'b'], null)).toEqual(['a', 'b']);
  });
});

describe('6.3 เครื่อง: ค่าเริ่มต้นคือเครื่องที่ไม่มีปัญหา', () => {
  it('เครื่องที่แนะนำ แยกโพสต์/Scrap · ออฟไลน์บอกตั้งแต่เมื่อไร', () => {
    expect(soDefaultWorker(o.workers, 'post')?.name).toBe('SONB-RM009');
    expect(soDefaultWorker(o.workers, 'scrape')?.name).toBe('SONB-RM009');
    expect(soWorkerOfflineText(o.workers[0])).toBe('ออฟไลน์ ตั้งแต่ 3 พ.ย. 14:20');
  });
});

describe('6.4 กดสั่งแล้วมีกลุ่มถูกข้าม = เห็นข้อความทันที + หน้าใบขอก็เห็น', () => {
  const reply = (status: number, body: unknown) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  it('start ตอบ skipped_groups + message → จอขึ้น "ข้าม N กลุ่ม…"', async () => {
    const r = await callSoStart('https://so-scraping.vercel.app', 'k', 'OPL6910065', reply(200, {
      ok: true, type: 'content', request_no: 'OPL6910065', group_count: 3,
      skipped_groups: [{ id: 'g2', name: 'กลุ่ม 2', last_posted_at: '2026-11-02T03:12:00.000Z', available_at: '2026-11-04T03:12:00.000Z' }],
      message: 'ข้าม 1 กลุ่มที่เพิ่งลง (กลุ่ม 2) โพสต์ได้อีก 4 พ.ย. 10:12',
    }));
    expect(r).toMatchObject({ state: 'started', skippedGroups: 1 });
    expect(soStartText(r)).toEqual({ text: 'เริ่มงานแล้ว · ข้าม 1 กลุ่มที่เพิ่งลง (กลุ่ม 2) โพสต์ได้อีก 4 พ.ย. 10:12', tone: 'warn', canRetry: false });
  });
  it('422 ทุกกลุ่มเพิ่งลง = แสดงข้อความ So Scraping ตรง ๆ', async () => {
    const r = await callSoStart('https://so-scraping.vercel.app', 'k', 'OPL6910065', reply(422, { error: 'ทุกกลุ่มที่เลือกเพิ่งลง โพสต์ได้อีก 4 พ.ย. 10:12' }));
    expect(soStartText(r)?.text).toBe('ทุกกลุ่มที่เลือกเพิ่งลง โพสต์ได้อีก 4 พ.ย. 10:12');
  });
  it('options ส่งเลขใบขอไปด้วย · หน้าใบขออ่าน run_message ผ่าน server', async () => {
    let url = '';
    const spy = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify(RAW), { status: 200 });
    }) as unknown as typeof fetch;
    await callSoOptions('https://so-scraping.vercel.app', 'k', spy, 'OPL6910065');
    expect(url).toBe('https://so-scraping.vercel.app/api/integrations/jarvis/options?request_no=OPL6910065');
    const lib = readFileSync('api/_lib/soScrapingOptions.ts', 'utf8');
    expect(lib).toContain("hit?.run_message");
    expect(readFileSync('api/_handlers/matching-job-postings.ts', 'utf8')).toContain("getQuery(req, 'run_message') === '1'");
    expect(readFileSync('src/components/jobs/OrderPostButton.tsx', 'utf8')).toContain('data-testid="so-run-message"');
  });
});

describe('ป๊อป Autopost ใช้ตัวตัดสินชุดนี้', () => {
  it('บัญชี/เครื่อง/กลุ่มตั้งต้น · ตัวนับเลือกแล้ว N/M · กลุ่มเพิ่งลงบอกเวลา · ไม่มีบัญชีพร้อมบอกเวลา', () => {
    const src = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(src).toContain('fetchSoOptions(job.request_no)');
    expect(src).toContain("soDefaultWorker(soWorkersFor(o, 'autopost'), 'post')");
    expect(src).toContain('เลือกแล้ว {NUM.format(picked.length)}/{NUM.format(cap)}');
    expect(src).toContain('soAddWithinCap(prev, ids, cap)');
    expect(src).toContain('disabled={full && !picked.includes(g.id)}');
    // 4 พ.ย. 2569 Journey "เลือกเฉพาะที่ใช้ได้" — กลุ่มที่ใบนี้เพิ่งลง (repostWait) ไม่ขึ้นในรายการแล้ว (soGroupUsable)
    expect(src).toContain('groups.filter((g) => soGroupUsable(g, account))');
    expect(src).toContain('{soNoAccountReadyText(opts.accounts)}');
  });
});
