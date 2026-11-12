// @vitest-environment node
/** การ์ด "5. โพสต์ลงกลุ่ม Facebook" (เจ้าของ 11 พ.ย. 2569 · ข้อ 13 ของ JARVIS_OPTIONS_PROMPT.md ฝั่ง So Scraping) */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { filterSoPostGroups, parseSoPostGroups, summarizeSoPostGroups } from '../../src/lib/soPostGroups';
import { callSoPostGroups } from '../../api/_lib/soPostGroups';

const STATUSES = [
  { key: 'posted', label: 'ขึ้นแล้ว' },
  { key: 'pending_approval', label: 'รอแอดมินอนุมัติ' },
  { key: 'unconfirmed', label: 'กดโพสต์แล้ว หาโพสต์ไม่เจอ' },
  { key: 'failed', label: 'ไม่สำเร็จ' },
  { key: 'not_tried', label: 'ยังไม่ได้ลองโพสต์' },
  { key: 'waiting', label: 'รอคิว' },
];
const BODY = {
  from: '2026-11-01', to: '2026-11-12', bu: 'LBD', page: 1, page_size: 10, pages: 2, total: 12,
  statuses: STATUSES,
  counts: { posted: 7, failed: 3, not_tried: 2 },
  rows: [
    { request_no: 'OPL6906113', position: 'พนักงานขับรถ นายไทย', ordered_at: '2026-11-04T03:05:00.000Z', ordered_by: 'x@siamraj.com', ordered_by_name: 'แบงค์', ordered_by_bu: 'LBD', account: 'Jannie Penelope', fb_group_id: '583362260400984', group_name: 'หางานขับรถ หาคนขับรถ กทม Bangkok', status: 'posted', status_label: 'ขึ้นแล้ว', posted_at: '2026-11-04T03:10:00.000Z', post_link: 'https://www.facebook.com/groups/583362260400984/posts/1468319985238536/', error: null },
    { request_no: 'OPL6906114', position: null, ordered_at: '2026-11-04T03:05:00.000Z', ordered_by: 'x@siamraj.com', ordered_by_name: null, ordered_by_bu: 'LBD', account: 'Jannie Penelope', fb_group_id: '1', group_name: 'กลุ่ม', status: 'failed', status_label: 'ไม่สำเร็จ', posted_at: null, post_link: 'javascript:alert(1)', error: 'Facebook จำกัดการโพสต์ของบัญชีนี้ชั่วคราว' },
  ],
};

describe('แปลงคำตอบ post-groups', () => {
  it('ใช้คำ/สถานะตามที่ So Scraping ส่ง · counts ครบ 6 สถานะ (ไม่มี = 0) · ผลรวม = total', () => {
    const r = parseSoPostGroups(BODY);
    expect(r.statuses.map((s) => s.label)).toEqual(STATUSES.map((s) => s.label));
    expect(r.counts).toEqual({ posted: 7, pending_approval: 0, unconfirmed: 0, failed: 3, not_tried: 2, waiting: 0 });
    expect(Object.values(r.counts).reduce((a, b) => a + b, 0)).toBe(r.total);
    expect(r.rows[0]).toMatchObject({ orderedByName: 'แบงค์', statusLabel: 'ขึ้นแล้ว', postLink: BODY.rows[0].post_link });
  });
  it('ไม่มีชื่อเล่น = อีเมล · ลิงก์ที่ไม่ใช่ facebook.com ไม่เอา · เหตุใช้ error ตรง ๆ', () => {
    const r = parseSoPostGroups(BODY).rows[1];
    expect(r.orderedByName).toBe('x@siamraj.com');
    expect(r.postLink).toBeNull();
    expect(r.error).toBe('Facebook จำกัดการโพสต์ของบัญชีนี้ชั่วคราว');
  });
});

describe('เรียก So Scraping จาก server', () => {
  it('ส่ง key ทาง header · page_size 10 · ไม่ส่ง bu เมื่อทุก BU', async () => {
    let seen: { url: string; key: string | null } | null = null;
    const spy = (async (url: string, init?: RequestInit) => {
      seen = { url, key: new Headers(init?.headers).get('x-api-key') };
      return new Response(JSON.stringify(BODY), { status: 200 });
    }) as unknown as typeof fetch;
    await callSoPostGroups('https://so.example', 'k1', { from: '2026-11-01', to: '2026-11-12', bu: null, page: 2 }, spy);
    expect(seen).toEqual({ url: 'https://so.example/api/integrations/jarvis/post-groups?from=2026-11-01&to=2026-11-12&page=2&page_size=10', key: 'k1' });
  });
  it('key ผิด / ล่ม = ข้อความไทยบอกเหตุ', async () => {
    const reply = (status: number, body: unknown) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
    await expect(callSoPostGroups('https://so.example', 'k', { from: '2026-11-01', to: '2026-11-12', bu: 'LBD', page: 1 }, reply(401, {}))).rejects.toThrow('key ของ So Scraping ไม่ถูกต้อง');
    await expect(callSoPostGroups('https://so.example', 'k', { from: '2026-11-01', to: '2026-11-12', bu: 'LBD', page: 1 }, reply(500, { error: 'db down' }))).rejects.toThrow('db down');
  });
});

describe('การ์ดในภาพรวม', () => {
  it('ต่อจากข้อ 4 · ช่วง/BU ตามภาพรวม · ดึงไม่ได้ = การ์ดยังอยู่ + ลองใหม่ · key ไม่ออกหน้าจอ', () => {
    const body = readFileSync('src/components/dashboard-trends/stuck/RecruitStuckBody.tsx', 'utf8');
    expect(body.indexOf('<SoPostGroupsCard from={win.from} to={win.to} bu={data.bu} />')).toBeGreaterThan(body.indexOf('{channelCard}'));
    const card = readFileSync('src/components/dashboard-trends/stuck/SoPostGroupsCard.tsx', 'utf8');
    expect(card).toContain('ดึงผลโพสต์จาก So Scraping ไม่ได้');
    expect(card).toContain('title="5. โพสต์ลงกลุ่ม Facebook"');
    expect(readFileSync('src/lib/soPostGroupsApi.ts', 'utf8')).not.toContain('x-api-key');
  });
});

describe('สถานะแบบ Facebook (So Scraping 12 พ.ย. 2569 af773a4)', () => {
  it('ใช้คำและลำดับจาก statuses ตรง ๆ · ไม่ฝังรายการคำใน Jarvis · ผลรวม = สั่งทั้งหมด', () => {
    const fb = [
      { key: 'posted', label: 'เผยแพร่แล้ว' }, { key: 'pending_approval', label: 'รอดำเนินการ' }, { key: 'declined', label: 'ปฏิเสธแล้ว' },
      { key: 'removed', label: 'ลบออกแล้ว' }, { key: 'failed', label: 'ไม่สำเร็จ' }, { key: 'not_tried', label: 'ไม่ได้โพสต์' }, { key: 'waiting', label: 'รอคิว' },
    ];
    const d = parseSoPostGroups({ ...BODY, total: 1661, statuses: fb, counts: { posted: 372, pending_approval: 210, declined: 0, removed: 0, failed: 170, not_tried: 907, waiting: 2 } });
    expect(d.statuses.map((x) => x.label)).toEqual(fb.map((x) => x.label));
    expect(Object.values(d.counts).reduce((a, b) => a + b, 0)).toBe(1661);
    const card = readFileSync('src/components/dashboard-trends/stuck/SoPostGroupsCard.tsx', 'utf8');
    expect(card).not.toContain("'เผยแพร่แล้ว'");
    expect(card).toContain('d.statuses.map(');
  });
});

describe('กดช่องสถานะแล้วดูเหตุ + ยอดต่อใบบนการ์ด (เจ้าของ 12 พ.ย. 2569)', () => {
  const rows = (n: number, status: string, error: string | null, requestNo = 'OPL6905114') =>
    Array.from({ length: n }, (_, i) => ({ ...parseSoPostGroups(BODY).rows[0], fbGroupId: `${status}${i}`, status, error, requestNo }));
  const all = { statuses: STATUSES, rows: [...rows(3, 'not_tried', null), ...rows(2, 'not_tried', 'บัญชีถูกพัก'), ...rows(12, 'posted', null, 'OPL6910065')] };
  const meta = { from: '2026-11-01', to: '2026-11-12', bu: null };
  it('กรองเฉพาะสถานะ · เหตุจัดกลุ่มนับมากไปน้อย (ไม่มีเหตุ = null) · ยอดช่องยังเป็นของทั้งช่วง · หน้าละ 10', () => {
    const r = filterSoPostGroups(all, meta, 'not_tried', 1);
    expect(r.filteredTotal).toBe(5);
    expect(r.reasons).toEqual([{ error: null, n: 3 }, { error: 'บัญชีถูกพัก', n: 2 }]);
    expect(r.counts.posted).toBe(12);
    expect(r.total).toBe(17);
    expect(filterSoPostGroups(all, meta, 'posted', 2).rows).toHaveLength(2);
  });
  it('ยอดต่อเลขใบขอ = สั่งกี่กลุ่ม + แต่ละสถานะ', () => {
    const s = summarizeSoPostGroups(all);
    expect(s.byRequest.OPL6905114).toEqual({ total: 5, counts: { not_tried: 5 } });
    expect(s.byRequest.OPL6910065).toEqual({ total: 12, counts: { posted: 12 } });
  });
  it('การ์ดใบขอบอกยอด · ช่องตัวเลขในภาพรวมกดได้', () => {
    expect(readFileSync('src/components/jobs/BoardJobCard.tsx', 'utf8')).toContain('data-testid="board-card-post-groups"');
    expect(readFileSync('src/components/dashboard-trends/stuck/SoPostGroupsCard.tsx', 'utf8')).toContain('data-testid="so-post-groups-reasons"');
  });
});
