/**
 * ═══ So Scraping → Jarvis: คอมเมนต์ใต้โพสต์ (เจ้าของ 22 ต.ค. 2569) ═══
 * Choice: Journey เดียวกับเจ้าหน้าที่เพิ่มเอง · ซ้ำก็คือซ้ำ · ไม่มีเบอร์เก็บเฉย ๆ · AI รอ ai-call · ใช้ทางส่ง AI เดิม
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { normalizeCommentPhone, parseSoScrapingLead, splitCommenterName, SO_SCRAPING_CREATED_BY } from '@/lib/soScrapingLeads';
import { keyMatches } from '../../api/_lib/integrationKeyAuth';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('ข้อมูลขาเข้า', () => {
  it('request_no + comment_url ต้องมี · ค่าอื่นว่างได้', () => {
    expect(parseSoScrapingLead({ comment_url: 'https://fb.com/c/1' })).toMatchObject({ ok: false });
    expect(parseSoScrapingLead({ request_no: 'LBM6903001' })).toMatchObject({ ok: false });
    const r = parseSoScrapingLead({ request_no: 'lbm6903001', comment_url: 'https://fb.com/c/1', commented_at: '2026-10-22T08:00:00+07:00' });
    expect(r.ok && r.value).toMatchObject({ request_no: 'LBM6903001', phone: null, commented_at: '2026-10-22T01:00:00.000Z' });
  });
  it('เบอร์ไทย 10 หลัก (+66 ได้) · อย่างอื่น = ไม่มีเบอร์', () => {
    expect(normalizeCommentPhone('081-234-5678')).toBe('0812345678');
    expect(normalizeCommentPhone('+66812345678')).toBe('0812345678');
    expect(normalizeCommentPhone('12345')).toBeNull();
    expect(normalizeCommentPhone(null)).toBeNull();
  });
  it('ชื่อคนคอมเมนต์แยกชื่อ/นามสกุลที่ช่องว่างแรก', () => {
    expect(splitCommenterName('สมชาย ใจดี มาก')).toEqual({ first: 'สมชาย', last: 'ใจดี มาก' });
    expect(splitCommenterName('Somchai')).toEqual({ first: 'Somchai', last: '' });
    expect(splitCommenterName(null).first).toBe('ผู้สนใจจากคอมเมนต์');
  });
});

describe('ยืนยันตัวด้วย x-api-key', () => {
  it('เก็บแค่แฮช · เทียบแบบเวลาคงที่', () => {
    const h = createHash('sha256').update('k1').digest('hex');
    expect(keyMatches('k1', [h])).toBe(true);
    expect(keyMatches('k2', [h])).toBe(false);
    expect(keyMatches('k1', [])).toBe(false);
  });
});

describe('Journey เดียวกับเจ้าหน้าที่ · AI รอ ai-call', () => {
  it('เพิ่มผ่านตัวช่วยชุดเดียวกับฟอร์มเพิ่มผู้สมัคร + กันซ้ำ 14 วัน · ส่ง AI ด้วย chooseAi ตัวเดียวกับปุ่ม', () => {
    const h = read('api/_handlers/so-scraping-integration.ts');
    for (const k of ['parseStaffApplication(', '{ minimal: true }', 'lockAndFindRepeat(client', 'staffInsertParams(app.value, SO_SCRAPING_CREATED_BY, null)', 'chooseAi(SO_SCRAPING_CREATED_BY', 'isDoNotCall(', "on conflict (comment_url)", 'withIntegrationKey(SO_SCRAPING_KEY_NAME']) {
      expect(h).toContain(k);
    }
    expect(read('api/_handlers/application-call-choice.ts')).toContain('export async function chooseAi(');
  });
  it('ตัวส่ง AI อัตโนมัติข้ามใบ So Scraping ที่ยังไม่เลือกวิธีโทร', () => {
    expect(read('api/_lib/applicationDispatchRetry.ts')).toContain(
      "and not (coalesce(a.created_by_name, '') = '${SO_SCRAPING_CREATED_BY}' and a.call_choice is null)",
    );
    expect(SO_SCRAPING_CREATED_BY).toBe('So Scraping');
  });
  it('เส้นลงทะเบียนแล้ว + migration มีตาราง', () => {
    const reg = read('api/_handlers/registry.ts');
    expect(reg).toContain("'/api/integrations/so-scraping/leads': soScrapingLeadsHandler");
    expect(reg).toContain("'/api/integrations/so-scraping/ai-call': soScrapingAiCallHandler");
    const m = read('migrations/160_so_scraping_comment_leads.sql');
    expect(m).toContain('create table if not exists so_scraping_comment_leads');
    expect(m).toContain('create table if not exists app_integration_keys');
  });
});

describe('ใบขอปิดแล้วไม่รับ (ทดสอบเว็บจริง: LBM6910003 Stop แล้วยังรับ)', () => {
  it('เช็กด่านใบขอปิดตัวเดียวกับปุ่มส่ง AI ก่อนบันทึก', () => {
    const h = read('api/_handlers/so-scraping-integration.ts');
    const at = h.indexOf('if (await isRequestClosedForApply(job.id)) return sendError(res, 409');
    expect(at).toBeGreaterThan(0);
    expect(at).toBeLessThan(h.indexOf('insert into ${LEADS}'));
  });
});
