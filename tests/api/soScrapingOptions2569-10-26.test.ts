/**
 * 🔴 ตัวเลือกตอนสั่ง Autopost / Scrap จาก So Scraping options API (เจ้าของ 26 ต.ค. 2569 "ทำเลย ตามเอกสาร")
 * status มาจาก So Scraping · paused/worker_offline/no_worker เลือกไม่ได้ · full เตือนก่อนส่ง · key อยู่ฝั่ง server
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  SO_NO_SESSION_WARNING,
  defaultScrapeIds,
  parseSoOptions,
  soAccountNeedsConfirm,
  soAccountSelectable,
  soGroupLabel,
  soGroupStatsText,
  soPickError,
  soPostConfirmWarnings,
  soScrapConfirmWarnings,
  soWorkersFor,
  soScrapeSelectable,
  soWarningText,
} from '@/lib/soScraping';
import { callSoOptions, callSoStart, normalizeSoBaseUrl, soKeyHint } from '../../api/_lib/soScrapingOptions';
import { soStartText } from '@/lib/soScraping';

/** ตัวอย่างในเอกสาร (ย่อ) — ใช้ id หน้าตาเดียวกับของจริง */
const SAMPLE = {
  generated_at: '2026-10-26T02:30:00.000Z',
  accounts: [
    {
      id: 'fb_898d82093abe46eeab1980d8',
      name: 'Tyni Aiit',
      worker: 'SONB-RM009',
      worker_online: true,
      posted_today: 5,
      daily_cap: 20,
      remaining_today: 15,
      paused_until: null,
      pause_reason: null,
      queue: { running: 1, queued: 0 },
      status: 'busy',
      warning: 'บัญชีนี้มีงานโพสต์ค้างอยู่ งานใหม่จะต่อคิวหลังงานนั้น',
      group_ids: ['mvhmloqvry84difvmvr'],
      session_workers: ['SONB-RM009'],
    },
    { id: 'fb_paused01', name: 'พัก', worker: 'SONB-RM010', worker_online: true, posted_today: 3, daily_cap: 20, status: 'paused', warning: 'บัญชีนี้ถูกพักถึง 15:00', group_ids: ['mvhmloqvry84difvmvr'] },
    { id: 'fb_full01', name: 'เต็ม', worker: 'SONB-RM009', worker_online: true, posted_today: 20, daily_cap: 20, status: 'full', warning: null, group_ids: [] },
    { id: 'fb_weird', name: 'แปลก', status: 'something_new', group_ids: [] },
  ],
  groups: [
    {
      id: 'mvhmloqvry84difvmvr',
      fb_group_id: '102927176763949',
      name: 'ชมรมพนักงานขับรถผู้บริหาร',
      url: 'https://www.facebook.com/groups/102927176763949',
      account_ids: ['fb_898d82093abe46eeab1980d8'],
      last_posted_at: '2026-10-21T04:48:03.543Z',
      stats_30d: { attempts: 3, posted: 2, comments: 4, phone_leads: 1 },
    },
    { id: 'grpnoname0001', fb_group_id: '555000111', name: null, account_ids: ['fb_full01'], last_posted_at: null },
  ],
  workers: [
    {
      name: 'SONB-RM009',
      kinds: ['autopost', 'scraper'],
      online: true,
      last_seen: '2026-10-26T02:30:37.022Z',
      load: 2,
      post_queue: { running: 1, queued: 0 },
      scrape_queue: { running: 1, queued: 0 },
      fb_account_ids: ['fb_898d82093abe46eeab1980d8'],
    },
    { name: 'SONB-RM011', kinds: ['autopost'], online: false, load: 0, fb_account_ids: [] },
    { name: 'SONB-SC01', kinds: ['scraper'], online: true, load: 5, scrape_queue: { running: 2, queued: 3 } },
  ],
  scrape_accounts: [
    { id: '8e1c7893-89a5-4adc-869a-2592776bf3ad', platform: 'jobthai', label: 'JobThai-Main', enabled: true, platform_cap: 1000, platform_used_today: 75, status: 'ready', warning: null },
    { id: '1b2c3d4e-0000-4000-8000-000000000002', platform: 'jobthai', label: 'JobThai-2', status: 'ready', warning: null },
    { id: '1b2c3d4e-0000-4000-8000-000000000003', platform: 'jobbkk', label: 'JobBKK-Main', status: 'cooldown', warning: 'บัญชีพักถึง 14:00' },
  ],
};

describe('อ่านคำตอบ options API', () => {
  const o = parseSoOptions(SAMPLE)!;

  it('ครบ 4 ส่วน · สถานะที่ไม่รู้จัก = เลือกไม่ได้', () => {
    expect(o.source).toBe('api');
    expect(o.accounts.map((a) => a.status)).toEqual(['busy', 'paused', 'full', 'no_worker']);
    expect(o.accounts[0]).toMatchObject({ worker: 'SONB-RM009', postedToday: 5, dailyCap: 20, queue: { running: 1, queued: 0 } });
    expect(o.workers[0]).toMatchObject({ load: 2, kinds: ['autopost', 'scraper'], scrapeQueue: { running: 1, queued: 0 } });
    expect(o.accounts[0].sessionWorkers).toEqual(['SONB-RM009']);
    expect(o.groups[0].stats30d).toEqual({ attempts: 3, posted: 2, comments: 4, phoneLeads: 1 });
    expect(o.scrapeAccounts[0]).toMatchObject({ usedToday: 75, cap: 1000, status: 'ready' });
    expect(parseSoOptions({ accounts: [] })).toBeNull();
  });

  it('กฎเลือกได้ตามตารางในเอกสาร', () => {
    // เอกสารรอบ 2: เครื่องหลักออฟไลน์ยังเลือกบัญชีได้ (ให้เลือกเครื่องอื่น)
    expect(['ready', 'busy', 'full', 'worker_offline'].every((s) => soAccountSelectable(s as never))).toBe(true);
    expect(['paused', 'no_worker'].some((s) => soAccountSelectable(s as never))).toBe(false);
    expect(soAccountNeedsConfirm('full')).toBe(true);
    expect(soAccountNeedsConfirm('busy')).toBe(false);
    expect(soScrapeSelectable('full')).toBe(true);
    expect(soScrapeSelectable('cooldown') || soScrapeSelectable('disabled')).toBe(false);
  });

  it('กลุ่มไม่มีชื่อ = เลขกลุ่ม + "ยังไม่มีชื่อ" · ข้อความเตือนใช้ warning ของ So Scraping ก่อน', () => {
    expect(soGroupLabel(o.groups[0])).toBe('ชมรมพนักงานขับรถผู้บริหาร');
    expect(soGroupLabel(o.groups[1])).toBe('555000111 · ยังไม่มีชื่อ');
    expect(soWarningText('พัก', 'paused', 'บัญชีนี้ถูกพักถึง 15:00')).toBe('บัญชีนี้ถูกพักถึง 15:00');
    expect(soWarningText('เต็ม', 'full', null)).toBe('บัญชี เต็ม ครบโควต้าวันนี้');
  });

  it('เครื่อง: แยกตามงาน · เตือนเครื่องออฟไลน์และบัญชียังไม่ล็อกอินบนเครื่องนั้น', () => {
    expect(soWorkersFor(o, 'autopost').map((w) => w.name)).toEqual(['SONB-RM009', 'SONB-RM011']);
    expect(soWorkersFor(o, 'scraper').map((w) => w.name)).toEqual(['SONB-RM009', 'SONB-SC01']);
    const acc = o.accounts[0];
    expect(soPostConfirmWarnings(acc, o.workers[0])).toEqual([]);
    expect(soPostConfirmWarnings(acc, o.workers[1])).toEqual(['เครื่อง SONB-RM011 ออฟไลน์อยู่ งานจะค้างรอจนเครื่องเปิด', SO_NO_SESSION_WARNING]);
    expect(soPostConfirmWarnings(o.accounts[2], o.workers[0])[0]).toBe('บัญชี เต็ม ครบโควต้าวันนี้');
    expect(soScrapConfirmWarnings([], o.workers[2])).toEqual([]);
    expect(soPickError(o, 'content', { group_ids: ['mvhmloqvry84difvmvr'], account_id: acc.id, worker: 'SONB-SC01' })).toContain('รับงานโพสต์ไม่ได้');
    expect(soPickError(o, 'scraping', { scrape_worker: 'SONB-RM011' })).toContain('รับงาน Scrap ไม่ได้');
    expect(soPickError(o, 'scraping', { scrape_worker: 'SONB-SC01', scrape_connector_ids: ['8e1c7893-89a5-4adc-869a-2592776bf3ad'] })).toBeNull();
    expect(soPickError(o, 'scraping', { scrape_worker: 'ไม่มีเครื่องนี้' })).toContain('ไม่พบเครื่อง');
  });

  it('ผล 30 วันของกลุ่ม: โพสต์ได้เป็นหลัก คอมเมนต์/เบอร์ขึ้นเมื่อมี', () => {
    expect(soGroupStatsText(o.groups[0].stats30d)).toBe('30 วัน โพสต์ได้ 2/3 · คอมเมนต์ 4 · ทิ้งเบอร์ 1');
    expect(soGroupStatsText({ attempts: 1, posted: 0, comments: 0, phoneLeads: 0 })).toBe('30 วัน โพสต์ได้ 0/1');
    expect(soGroupStatsText(null)).toBeNull();
  });

  it('ติ๊กบัญชี Scrap พร้อมใช้ตัวแรกของแต่ละเว็บ', () => {
    expect(defaultScrapeIds(o.scrapeAccounts)).toEqual(['8e1c7893-89a5-4adc-869a-2592776bf3ad']);
  });

  it('server ตรวจค่าที่เลือก: บัญชีถูกพัก/กลุ่มไม่ใช่ของบัญชี/บัญชี Scrap พัก = ปฏิเสธ', () => {
    const g = 'mvhmloqvry84difvmvr';
    expect(soPickError(o, 'content', { group_ids: [g], account_id: 'fb_898d82093abe46eeab1980d8' })).toBeNull();
    expect(soPickError(o, 'content', { group_ids: [g], account_id: 'fb_paused01' })).toBe('บัญชีนี้ถูกพักถึง 15:00');
    expect(soPickError(o, 'content', { group_ids: [g], account_id: 'fb_full01' })).toContain('โพสต์ไม่ได้');
    expect(soPickError(o, 'content', { group_ids: ['nope'] })).toContain('ไม่อยู่ในระบบ');
    expect(soPickError(o, 'scraping', { scrape_connector_ids: ['8e1c7893-89a5-4adc-869a-2592776bf3ad'] })).toBeNull();
    expect(soPickError(o, 'scraping', { scrape_connector_ids: ['1b2c3d4e-0000-4000-8000-000000000003'] })).toBe('บัญชีพักถึง 14:00');
  });
});

describe('เรียก API ฝั่ง server', () => {
  const fake = (status: number, body: unknown) =>
    (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

  it('ส่ง key ใน header x-api-key ไปที่ /api/integrations/jarvis/options', async () => {
    let seen: { url: string; key: string | null } | null = null;
    const spy = (async (url: string, init: RequestInit) => {
      seen = { url, key: new Headers(init.headers).get('x-api-key') };
      return new Response(JSON.stringify(SAMPLE), { status: 200 });
    }) as unknown as typeof fetch;
    const o = await callSoOptions('https://so-scraping.vercel.app', 'k123', spy);
    expect(o.accounts).toHaveLength(4);
    expect(o.workers).toHaveLength(3);
    expect(seen).toEqual({ url: 'https://so-scraping.vercel.app/api/integrations/jarvis/options', key: 'k123' });
  });

  it('401 = บอกว่า key ผิด · ผิดรูป = บอกตรง ๆ', async () => {
    await expect(callSoOptions('https://x.example', 'bad', fake(401, {}))).rejects.toThrow('key ของ So Scraping ไม่ถูกต้อง');
    await expect(callSoOptions('https://x.example', 'k', fake(200, { accounts: [] }))).rejects.toThrow('ผิดรูป');
  });

  it('URL https เท่านั้น · key โชว์แค่ 4 ตัวท้าย', () => {
    expect(normalizeSoBaseUrl('https://so-scraping.vercel.app/')).toBe('https://so-scraping.vercel.app');
    expect(normalizeSoBaseUrl('http://so-scraping.vercel.app')).toBeNull();
    expect(soKeyHint('abcdefgh12345678')).toBe('••••5678');
  });
});

describe('key ไม่ออกไปหน้าจอ', () => {
  it('หน้าตั้งค่าส่ง key ไปบันทึกได้ แต่ GET ไม่คืนตัว key · ป๊อปเรียกผ่าน server', () => {
    const view = readFileSync('api/_lib/soScrapingOptions.ts', 'utf8');
    expect(view).toMatch(/configured: Boolean\(r\?\.key_enc/);
    expect(view).not.toMatch(/key:\s*decryptApiKey/);
    expect(readFileSync('src/lib/jobPostingRequestsApi.ts', 'utf8')).toContain("'/api/matching/job-postings?options=1'");
    expect(readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8')).not.toContain('so-scraping.vercel.app');
  });
});

describe('เริ่มงานทันที (start · เอกสารรอบ 3)', () => {
  const reply = (status: number, body: unknown) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

  it('ส่ง request_no ไป POST /start พร้อม x-api-key', async () => {
    let seen: { url: string; method?: string; key: string | null; body: string } | null = null;
    const spy = (async (url: string, init: RequestInit) => {
      seen = { url, method: init.method, key: new Headers(init.headers).get('x-api-key'), body: String(init.body) };
      return new Response(JSON.stringify({ ok: true, type: 'content', worker: 'SONB-RM009', preflight_queued: true }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await callSoStart('https://so-scraping.vercel.app', 'k1', 'OPL6910068', spy);
    expect(seen).toEqual({ url: 'https://so-scraping.vercel.app/api/integrations/jarvis/start', method: 'POST', key: 'k1', body: '{"request_no":"OPL6910068"}' });
    expect(r).toEqual({ state: 'started', worker: 'SONB-RM009', preflightQueued: true, queued: null, message: null });
    expect(soStartText(r)?.text).toBe('เริ่มงานแล้ว ที่เครื่อง SONB-RM009 · บัญชีต้องทดสอบก่อน งานจะเริ่มช้าขึ้นราว 1 นาที');
  });

  it('409 = เริ่มไปแล้ว · 422 = ขึ้นเหตุผลของ So Scraping + เรียกใหม่ได้ · Scrap ยังเริ่มไม่ได้ = บอก message', async () => {
    expect(await callSoStart('https://x.example', 'k', 'A1', reply(409, {}))).toEqual({ state: 'already' });
    const bad = await callSoStart('https://x.example', 'k', 'A1', reply(422, { error: 'ยังไม่เลือกบัญชี Scrap' }));
    expect(bad).toEqual({ state: 'error', message: 'ยังไม่เลือกบัญชี Scrap' });
    expect(soStartText(bad)).toEqual({ text: 'ยังไม่เลือกบัญชี Scrap', tone: 'danger', canRetry: true });
    const wait = await callSoStart('https://x.example', 'k', 'A1', reply(200, { ok: true, type: 'scraping', queued: false, message: 'เครื่องยังไม่เปิด Scrape' }));
    expect(soStartText(wait)).toEqual({ text: 'เครื่องยังไม่เปิด Scrape', tone: 'warn', canRetry: false });
    expect((await callSoStart('https://x.example', 'k', 'A1', reply(401, {}))).state).toBe('error');
    expect(soStartText({ state: 'skipped' })).toBeNull();
  });

  it('ใส่ key แล้วขอ Scrap ต้องเลือกบัญชี JobThai/JobBKK', () => {
    const o = parseSoOptions(SAMPLE)!;
    expect(soPickError(o, 'scraping', {})).toBe('เลือกบัญชี JobThai/JobBKK อย่างน้อย 1 บัญชี');
    expect(soPickError({ ...o, source: 'db', scrapeAccounts: [] }, 'scraping', {})).toBeNull();
  });
});
