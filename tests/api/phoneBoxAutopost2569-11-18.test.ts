/**
 * Autopost ผ่าน phone-box (เจ้าของ 18 พ.ย. 2569 "ยิงไป Phone box เลย สำหรับ 4 บัญชีนั้น และไม่ปนไปกับ Rm009")
 * กติกาเจ้าของ 17 พ.ย.: 202 = นับว่าโพสต์แล้ว · ห้ามส่งซ้ำ
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: vi.fn(), isPgUndefinedTable: () => false }));

const { phoneBoxRouteFor, sendPhoneBoxPost } = await import('../../api/_lib/phoneBox');
const { phoneBoxPostsOf } = await import('../../src/lib/phoneBoxPosts');
const { soAccountChoice } = await import('../../src/lib/soScraping');

const route = (accountName: string, enabled = true) => ({ accountId: 'fb-usb-21a14a10d20d7ece', accountName, enabled, updatedBy: null, updatedAt: null });

describe('บัญชีไหนส่งผ่าน phone-box', () => {
  it('จับคู่ชื่อบัญชีที่เลือกใน Autopost (ไม่สนตัวพิมพ์/ช่องว่าง) · ถอนติ๊กแล้ว = ไป So Scraping', () => {
    expect(phoneBoxRouteFor([route('Clarissa Glady')], '  clarissa  glady ')?.accountId).toBe('fb-usb-21a14a10d20d7ece');
    expect(phoneBoxRouteFor([route('Clarissa Glady', false)], 'Clarissa Glady')).toBeNull();
    expect(phoneBoxRouteFor([route('Clarissa Glady')], 'Burkhart Debe')).toBeNull();
    expect(phoneBoxRouteFor([route('Clarissa Glady')], null)).toBeNull();
  });
  it('ช่องบัญชีใน Autopost บอกว่า "ส่งผ่าน phone-box" และเลือกได้แม้ RM009 ปิด', () => {
    const c = soAccountChoice({ id: 'fb_1', name: 'Clarissa Glady', status: 'paused', sessionWorkers: [], remainingToday: 0, worker: 'RM009', warning: 'x', phoneBox: true } as never, []);
    expect(c).toMatchObject({ label: 'Clarissa Glady · ส่งผ่าน phone-box', disabled: false });
  });
});

describe('ข้อความต่อกลุ่ม', () => {
  const snap = {
    caption: 'รับสมัครคนขับ\nสมัคร : https://x/apply/p/aaa',
    apply_link: 'https://x/apply/p/aaa',
    group_ids: ['g1', 'g2', 'g9'],
    group_links: [
      { group_id: 'g1', apply_link: 'https://x/apply/p/aaa' },
      { group_id: 'g2', apply_link: 'https://x/apply/p/bbb' },
    ],
  };
  it('ชื่อกลุ่มจากรายชื่อ So Scraping · ลิงก์ของกลุ่มแทนลิงก์หลัก · กลุ่มที่หาชื่อไม่เจอข้าม', () => {
    const posts = phoneBoxPostsOf(snap, [
      { id: 'g1', name: 'หางานขับรถ' },
      { id: 'g2', name: 'งานบางนา' },
    ]);
    expect(posts.map((p) => p.groupName)).toEqual(['หางานขับรถ', 'งานบางนา']);
    expect(posts[1].content).toContain('https://x/apply/p/bbb');
    expect(posts[1].content).not.toContain('/aaa');
  });
  it('ไม่มี caption = ไม่ส่งอะไร', () => {
    expect(phoneBoxPostsOf({ ...snap, caption: '' }, [{ id: 'g1', name: 'a' }])).toEqual([]);
  });
});

describe('ยิง POST /v1/posts', () => {
  const body = { request_id: 'jarvis-1-1', account_id: 'fb-usb-1', group_name: 'กลุ่ม', content: 'x' };
  it('202 = ส่งแล้ว พร้อม id ของ phone-box · ส่ง Bearer + JSON ตาม schema', async () => {
    const fake = vi.fn(async () => new Response(JSON.stringify({ id: 'p_1', status: 'awaiting_executor' }), { status: 202 }));
    const r = await sendPhoneBoxPost('https://pb.test', 'k', body, fake as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: true, status: 202, postId: 'p_1' });
    const [url, init] = fake.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://pb.test/v1/posts');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer k');
    expect(JSON.parse(String(init.body))).toEqual(body);
  });
  it('ตอบผิด/ติดต่อไม่ได้ = ไม่สำเร็จพร้อมเหตุ ไม่ลองซ้ำ', async () => {
    const bad = vi.fn(async () => new Response(JSON.stringify({ message: 'account offline' }), { status: 409 }));
    expect(await sendPhoneBoxPost('https://pb.test', 'k', body, bad as unknown as typeof fetch)).toMatchObject({ ok: false, status: 409, message: 'account offline' });
    expect(bad).toHaveBeenCalledTimes(1);
    const down = vi.fn(async () => {
      throw new Error('net');
    });
    expect(await sendPhoneBoxPost('https://pb.test', 'k', body, down as unknown as typeof fetch)).toMatchObject({ ok: false, status: null });
  });
});

describe('เส้นสั่ง Autopost', () => {
  const src = readFileSync('api/_handlers/matching-job-postings.ts', 'utf8');
  it('ใบที่ส่ง phone-box สร้างเป็น in_progress (So Scraping หยิบแค่ pending) และไม่เรียก So Scraping เริ่มงาน', () => {
    const branch = src.slice(src.indexOf('phoneBoxRouteFor('), src.indexOf("return res.status(200).json({ ...done, phone_box"));
    expect(branch).toContain("initialStatus: 'in_progress'");
    expect(branch).not.toContain('startSoRequest');
    expect(branch).toContain("sent > 0 ? 'posted' : 'rejected'");
  });
  it('migration ตั้งต้น 4 บัญชีที่เจ้าของเลือก (ไม่มี Thom Blake)', () => {
    const sql = readFileSync('migrations/188_phone_box_post_accounts.sql', 'utf8');
    for (const n of ['Tarris Mcreynolds', 'Clarissa Glady', 'Gring Magail', 'Jannie Penelope']) expect(sql).toContain(`'${n}'`);
    expect(sql).not.toMatch(/\('fb-usb-3554474353443498'/);
  });
});
