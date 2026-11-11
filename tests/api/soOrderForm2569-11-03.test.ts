// @vitest-environment node
/**
 * ฟอร์มสั่ง So Scraping แบบ dropdown Autopost / Scrap · ข้อ 1-2-3 เลือกไว้ให้หมด (เจ้าของ 3 พ.ย. 2569)
 * "สั่งจากคนทำไม่เป็น บัญชีเขาไม่รู้หรอกต้องใช้อันไหน มีอะไรให้เลือกก็เลือกหมด บัญชีด้วย" · ใช้ทั้งหน้าใบขอ ป๊อปประกาศ และปุ่มบนการ์ดงานสรรหา
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { soDefaultScrapeAccount, soPickError, soScrapeChoice, soScrapeRemaining, type SoOptions, type SoScrapeAccount } from '@/lib/soScraping';

const acc = (p: Partial<SoScrapeAccount>): SoScrapeAccount =>
  ({ id: 'jt', platform: 'jobthai', label: 'JobThai-Main', status: 'ready', warning: null, usedToday: 0, cap: 1000, cooldownUntil: null, ...p });

describe('Scrap: บัญชีเลือกแบบเดียวกับ Facebook · ตั้งต้นให้ · จำนวนไม่เกินโควต้า', () => {
  it('คำสถานะ + สี · พักชั่วคราว/ปิดใช้งาน เลือกไม่ได้', () => {
    expect(soScrapeChoice(acc({ usedToday: 119, cap: 200, platform: 'jobbkk', label: 'JobBKK-HR1' }))).toEqual({ label: 'JobBKK · JobBKK-HR1 · พร้อมใช้ · เหลือ 81 คนวันนี้', disabled: false, tone: 'success' });
    expect(soScrapeChoice(acc({ status: 'full', usedToday: 1000 }))).toEqual({ label: 'JobThai · JobThai-Main · ครบโควต้าวันนี้ (1,000/1,000)', disabled: false, tone: 'warn' });
    expect(soScrapeChoice(acc({ status: 'cooldown', cooldownUntil: '2026-11-04T02:00:00Z' }))).toEqual({ label: 'JobThai · JobThai-Main · พักชั่วคราว ใช้ได้ 4 พ.ย. 09:00', disabled: true, tone: 'danger' });
    expect(soScrapeChoice(acc({ status: 'disabled', warning: 'บัญชีถูกปิด' }))).toMatchObject({ disabled: true, tone: 'danger' });
  });
  it('ตั้งต้น = พร้อมใช้ที่เหลือโควต้ามากสุด', () => {
    const list = [acc({ id: 'bkk', platform: 'jobbkk', usedToday: 119, cap: 200 }), acc({ id: 'jt', usedToday: 0, cap: 1000 }), acc({ id: 'x', status: 'cooldown' })];
    expect(soDefaultScrapeAccount(list)?.id).toBe('jt');
    expect(soScrapeRemaining(list[0])).toBe(81);
    expect(soScrapeRemaining(acc({ cap: null }))).toBeNull();
  });
  it('server กันจำนวนผิด/เกินโควต้า · ไม่ส่งจำนวน = ผ่านเหมือนเดิม', () => {
    const o = { source: 'api', accounts: [], groups: [], workers: [], scrapeAccounts: [acc({ usedToday: 990, cap: 1000 })] } as unknown as SoOptions;
    expect(soPickError(o, 'scraping', { scrape_connector_ids: ['jt'], scrape_target: 5 })).toBeNull();
    expect(soPickError(o, 'scraping', { scrape_connector_ids: ['jt'], scrape_target: 11 })).toBe('เว็บนี้วันนี้เหลือโควต้า 10 คน — ลดจำนวน หรือเลือกเว็บอื่น');
    expect(soPickError(o, 'scraping', { scrape_connector_ids: ['jt'], scrape_target: 0 })).toBe('จำนวนคนต้องเป็นตัวเลข 1 ขึ้นไป');
    expect(soPickError(o, 'scraping', { scrape_connector_ids: ['jt'] })).toBeNull();
  });
});

describe('ฟอร์มเดียว 3 ที่', () => {
  it('หน้าใบขอ · ป๊อปประกาศ · ปุ่มบนการ์ด ใช้ OrderPostButton · Scrap มีข้อ 1 บัญชี 2 จำนวน 3 เครื่อง · Autopost มีข้อ 1-2-3', () => {
    const order = readFileSync('src/components/jobs/OrderPostButton.tsx', 'utf8');
    expect(order).toContain('1 · บัญชี JobThai / JobBKK');
    expect(order).toContain('2 · จำนวนคนที่ต้องการ');
    expect(order).toContain('3 · เครื่อง');
    expect(order).toContain('scrape_target: target,');
    expect(order).toContain("setScrapeId(soDefaultScrapeAccount(o.scrapeAccounts)?.id ?? '');");
    const dialog = readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8');
    expect(dialog).toContain('1 · บัญชี Facebook');
    expect(dialog).toContain('2 · กลุ่ม Facebook');
    expect(dialog).toContain('3 · เครื่อง');
    expect(dialog).toContain('<OrderPostButton key={job.id} job={job} defaultKind="autopost" onSent={onSent} />');
    expect(readFileSync('src/components/jobs/BoardJobCard.tsx', 'utf8')).toContain('Autopost / Scrap / โพสต์เอง');
    expect(readFileSync('src/pages/jobs/SiamrajUnitRequestDetailPage.tsx', 'utf8')).toContain('<OrderPostFold job={data} />');
  });
});
