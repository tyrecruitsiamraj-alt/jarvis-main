/**
 * การ์ด 6 "โพสต์เอง" รายวันหน้าภาพรวม (เจ้าของ 13 พ.ย. 2569 "อยากดูจำนวนรวมของแต่ละวัน ว่าโพสต์งานไหนไปบ้างจากโพสต์มือ")
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { manualPostDays, type ManualPostLinkInput } from '@/lib/jobPostActions';

const dayOf = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10);
const L = (o: Partial<ManualPostLinkInput>): ManualPostLinkInput => ({
  day: dayOf(o.created_at ?? '2026-11-12T03:00:00Z'),
  job_id: 'siamraj-pre:LBM6909002',
  note: 'โพสต์เอง',
  created_at: '2026-11-12T03:00:00Z',
  hit_count: 0,
  applicants: 0,
  channel_label: 'Facebook · Facebook Group · กลุ่มคนขับรถผู้บริหาร',
  created_by_name: 'แบงค์',
  title: 'พนักงานขับรถ',
  ...o,
  ...(o.day ? {} : { day: dayOf(o.created_at ?? '2026-11-12T03:00:00Z') }),
});

describe('manualPostDays', () => {
  const links = [
    L({ hit_count: 10, applicants: 1 }),
    L({ channel_label: 'Facebook · Facebook Group · กลุ่มหางานขับรถ', hit_count: 5 }),
    L({ job_id: 'siamraj-sql:OPL6910068', created_by_name: 'ฝน', hit_count: 2, applicants: 2 }),
    // วันถัดไป (ไทย) — 18:00Z = 01:00 วันที่ 13
    L({ created_at: '2026-11-12T18:00:00Z', hit_count: 1 }),
    // Autopost ไม่นับ
    L({ note: 'Autopost', hit_count: 99 }),
    // ลิงก์เก่าไม่มีป้าย ใกล้คำสั่ง Autopost = Autopost · ไกล = โพสต์เอง (Gen link เดิม)
    L({ job_id: 'siamraj-sql:LBA6910001', note: null, created_at: '2026-11-11T03:00:00Z', hit_count: 50 }),
    L({ job_id: 'siamraj-sql:LBA6910001', note: null, created_at: '2026-11-11T09:00:00Z', hit_count: 3 }),
    // โพสต์ซ้ำลงกลุ่มเดิมวันที่ 13 (ลิงก์เดิมจากวันที่ 11 ที่ตัดสินว่าเป็น Autopost) — กดคัดลอก = นับเสมอ
    L({ job_id: 'siamraj-sql:LBA6910001', note: null, created_at: '2026-11-11T03:00:00Z', day: '2026-11-13', recorded: true, hit_count: 4 }),
  ];
  const times = new Map([['siamraj-sql:LBA6910001', [Date.parse('2026-11-11T03:01:00Z')]]]);
  const r = manualPostDays(links, times, { from: '2026-11-10', to: '2026-11-13' });

  it('ทุกวันในช่วงขึ้น ใหม่สุดก่อน · วันที่ไม่มีโพสต์ = 0', () => {
    expect(r.days.map((d) => d.day)).toEqual(['2026-11-13', '2026-11-12', '2026-11-11', '2026-11-10']);
    expect(r.days[3]).toMatchObject({ jobs: 0, places: 0, clicks: 0, applicants: 0, list: [] });
  });
  it('ต่อวัน: ใบไม่ซ้ำ · 1 ลิงก์ = 1 กลุ่ม/ช่องทาง · ไม่นับ Autopost', () => {
    const d12 = r.days.find((d) => d.day === '2026-11-12')!;
    expect(d12).toMatchObject({ jobs: 2, places: 3, clicks: 17, applicants: 3 });
    expect(d12.list[0]).toMatchObject({ jobId: 'siamraj-pre:LBM6909002', by: ['แบงค์'], clicks: 15 });
    expect(r.days.find((d) => d.day === '2026-11-13')).toMatchObject({ jobs: 2, places: 2, clicks: 5 });
  });
  it('ลิงก์ไม่มีป้าย ใช้ตัวตัดสินเดียวกับการ์ดหน้าโพสต์ประกาศ', () => {
    expect(r.days.find((d) => d.day === '2026-11-11')).toMatchObject({ jobs: 1, places: 1, clicks: 3 });
  });
  it('แถวรวม = ผลบวกทุกวัน', () => {
    const sum = (k: 'jobs' | 'places' | 'posted' | 'clicks' | 'applicants') => r.days.reduce((a, d) => a + d[k], 0);
    expect(r.total).toEqual({ jobs: sum('jobs'), places: sum('places'), posted: sum('posted'), clicks: sum('clicks'), applicants: sum('applicants') });
  });
  it('การ์ดอยู่ในหน้าภาพรวมต่อจากโพสต์ลงกลุ่ม Facebook', () => {
    const src = readFileSync('src/components/dashboard-trends/stuck/RecruitStuckBody.tsx', 'utf8');
    expect(src.indexOf('<ManualPostDaysCard')).toBeGreaterThan(src.indexOf('<SoPostGroupsCard'));
  });
});

describe('กดคัดลอกข้อความ = จดว่าโพสต์', () => {
  it('ป๊อปโพสต์เองเรียก markManualPosted หลังคัดลอกสำเร็จ · จดไม่ได้บอกบนจอ', () => {
    const src = readFileSync('src/components/jobs/ManualPostPanel.tsx', 'utf8');
    expect(src).toContain('markManualPosted(r.link.id)');
    expect(src).toContain('ระบบนับการโพสต์ไม่ได้');
  });
  it('migration เพิ่มอย่างเดียว · (ลิงก์ · วัน) ไม่ซ้ำ', () => {
    const sql = readFileSync('migrations/177_posting_link_posts.sql', 'utf8');
    expect(sql).toContain('primary key (link_id, day)');
    expect(sql).not.toMatch(/\b(drop|delete|update)\b/i);
  });
});

describe('คนโพสต์ = คนที่กดคัดลอกวันนั้น', () => {
  it('ใช้ชื่อเล่นคนกดคัดลอกก่อน ไม่มีค่อยใช้คนสร้างลิงก์', () => {
    const src = readFileSync('api/_lib/jobPostActions.ts', 'utf8');
    expect(src).toContain('left join ${USERS} bu on bu.id = ev1.by_id');
    expect(src.indexOf('nullif(btrim(bu.nickname)')).toBeLessThan(src.indexOf("${linkOwnerSql('l.id', 'p.id')}) as created_by_name"));
  });
});

describe('ลิงก์โพสต์ที่วางกลับมา (ไม่บังคับ · บอกว่ามี/ไม่มี)', () => {
  it('รับเฉพาะ https · ว่าง = ไม่มี', async () => {
    const { normalizePostUrl } = await import('@/lib/jobPostActions');
    expect(normalizePostUrl('')).toBeNull();
    expect(normalizePostUrl(' https://www.facebook.com/groups/1/posts/2/ ')).toBe('https://www.facebook.com/groups/1/posts/2/');
    expect(normalizePostUrl('http://facebook.com/x')).toBe('invalid');
    expect(normalizePostUrl('javascript:alert(1)')).toBe('invalid');
    expect(normalizePostUrl('facebook.com/x')).toBe('invalid');
  });
  it('รายวันเก็บลิงก์โพสต์ต่อกลุ่ม ลำดับเดียวกับป้าย', () => {
    const r = manualPostDays(
      [L({ post_url: 'https://www.facebook.com/groups/1/posts/2/' }), L({ channel_label: 'Facebook · Facebook Group · กลุ่ม B' })],
      new Map(),
      { from: '2026-11-12', to: '2026-11-12' },
    );
    expect(r.days[0].list[0].postUrls).toEqual(['https://www.facebook.com/groups/1/posts/2/', null]);
  });
  it('จอ: ช่องวางลิงก์อยู่ทุกแถวของโพสต์เอง · การ์ด 6 บอกจำนวนที่มีลิงก์ · ป๊อปบอกทุกแถวว่ามี/ไม่มี', () => {
    expect(readFileSync('src/components/jobs/ManualPostPanel.tsx', 'utf8')).toContain('placeholder="วางลิงก์โพสต์ (ถ้ามี)"');
    expect(readFileSync('src/components/dashboard-trends/stuck/ManualPostDaysCard.tsx', 'utf8')).toContain('มีลิงก์โพสต์');
    const dlg = readFileSync('src/components/jobs/JobPostActionsDialog.tsx', 'utf8');
    expect(dlg).toContain('เปิดดูโพสต์');
    expect(dlg).toContain('job-actions-manual-tabs');
  });
  it('migration 179 เพิ่มคอลัมน์อย่างเดียว', () => {
    const sql = readFileSync('migrations/179_posting_link_post_url.sql', 'utf8');
    expect(sql).toContain('add column if not exists post_url');
    expect(sql).not.toMatch(/\b(drop|delete|update)\b/i);
  });
});

describe('โพสต์แล้ว (มีลิงก์โพสต์) vs Gen link (ไม่มี) — เจ้าของ 13 พ.ย. 2569', () => {
  it('รายวัน: posted = แถวที่มีลิงก์โพสต์ · Gen link = ที่เหลือ · รวม = กลุ่ม/ช่องทางทั้งหมด', () => {
    const r = manualPostDays(
      [L({ post_url: 'https://www.facebook.com/groups/1/posts/2/' }), L({ channel_label: 'B' }), L({ job_id: 'siamraj-sql:OPL6910068', channel_label: 'C' })],
      new Map(),
      { from: '2026-11-12', to: '2026-11-12' },
    );
    expect(r.days[0]).toMatchObject({ places: 3, posted: 1 });
    expect(r.total.posted).toBe(1);
  });
  it('การ์ดหน้าโพสต์ประกาศ: manual.posted นับลิงก์โพสต์เองที่มีลิงก์โพสต์ (Autopost ไม่นับ)', async () => {
    const { summarizeJobPostActions } = await import('@/lib/jobPostActions');
    const base = { job_id: 'siamraj-pre:LBM6909002', created_at: '2026-11-12T03:00:00Z', hit_count: 0, applicants: 0 };
    const s = summarizeJobPostActions(
      [
        { ...base, note: 'โพสต์เอง', post_url: 'https://www.facebook.com/groups/1/posts/2/' },
        { ...base, note: 'โพสต์เอง', post_url: null },
        { ...base, note: 'Autopost', post_url: 'https://www.facebook.com/groups/1/posts/3/' },
      ],
      [],
    )['siamraj-pre:LBM6909002'];
    expect(s.manual).toMatchObject({ links: 2, posted: 1 });
    expect(s.autopost.links).toBe(1);
  });
});
