// @vitest-environment node
/**
 * กลุ่ม Facebook: คนคลิกลิงก์แล้วกรอกเท่าไหร่ (เจ้าของ 10 พ.ย. 2569)
 * > *"Tracking link หน่อยว่าคนคลิกเข้ามาเท่าไหร่ จะได้รู้ด้วยกลุ่มไหนคนเข้ามาดูงานเราเยอะ"*
 * > *"คลิก 0 กรอก 8 ย้อนแย้งปะ"* ⇒ Choice "แบบ 1 ยอดทั้งหมด ใช้ได้เลย" — คลิกกับกรอกฐานเดียวกัน (ตั้งแต่สร้างลิงก์)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildFbGroupClickRows } from '@/lib/fbGroupClicks';
import { fbGroupStatOf } from '@/lib/recruitPostingsApi';

const G1 = 'Facebook · Facebook Group · กลุ่มคนขับรถผู้บริหาร';
const G1_OLD = 'Facebook Group · กลุ่มคนขับรถผู้บริหาร';
const G2 = 'Facebook · Facebook Group · หางานขับรถ (553130514463865)';

describe('การ์ดกลุ่ม Facebook', () => {
  it('รวมตามชื่อกลุ่ม (ป้ายเก่า/ใหม่ชื่อเดียวกัน = กลุ่มเดียว) · กรอกนับคนไม่ซ้ำ · กรอกต่อคลิก · คลิกมากก่อน · ไม่ใช่ Facebook Group ไม่นับ', () => {
    const r = buildFbGroupClickRows([
      { label: G1, clicks: 100, appIds: ['a1', 'a2'] },
      { label: G1_OLD, clicks: 12, appIds: ['a2', 'a3'] },
      { label: G2, clicks: 150, appIds: [] },
      { label: 'Tiktok · Live', clicks: 999, appIds: ['x'] },
    ])!;
    expect(r.rows.map((x) => [x.group, x.clicks, x.appIds.length, x.ratePct])).toEqual([
      ['หางานขับรถ (553130514463865)', 150, 0, 0],
      ['กลุ่มคนขับรถผู้บริหาร', 112, 3, 3],
    ]);
    expect([r.totalClicks, r.totalApps]).toEqual([262, 3]);
  });
  it('อ่านไม่ได้ = null (การ์ดบอกว่าอ่านไม่ได้ ไม่ใช่ 0) · ไม่มีลิงก์ = แถวว่าง · คลิก 0 = กรอกต่อคลิก "—"', () => {
    expect(buildFbGroupClickRows(null)).toBeNull();
    expect(buildFbGroupClickRows([])!.rows).toEqual([]);
    expect(buildFbGroupClickRows([{ label: G1, clicks: 0, appIds: ['a1'] }])!.rows[0].ratePct).toBeNull();
  });
  it('ลิงก์ Facebook Group ที่ไม่ได้เลือกกลุ่ม ("ไม่ระบุชื่อ") อยู่ท้าย', () => {
    const r = buildFbGroupClickRows([
      { label: 'Facebook · Facebook Group', clicks: 500, appIds: [] },
      { label: G1, clicks: 1, appIds: [] },
    ])!;
    expect(r.rows.map((x) => x.group)).toEqual(['กลุ่มคนขับรถผู้บริหาร', 'ไม่ระบุชื่อ']);
  });
  it('ป๊อปเลือกกลุ่ม: รหัสกลุ่ม + ชื่อกลุ่ม (ลิงก์เก่าไม่มีรหัส) รวมกัน · ไม่เคยมีลิงก์ = 0', () => {
    const st = { byId: { '553130514463865': { clicks: 10, apps: 2 } }, byName: { 'หางานขับรถ': { clicks: 5, apps: 1 } } };
    expect(fbGroupStatOf(st, '553130514463865', 'หางานขับรถ')).toEqual({ clicks: 15, apps: 3 });
    expect(fbGroupStatOf(st, 'other', null)).toEqual({ clicks: 0, apps: 0 });
  });
});

describe('ที่มาของเลข', () => {
  it('คลิก = hit_count สะสม (ไม่ตามปฏิทิน) · ภาพรวมกรองตาม BU ในสิทธิ์ · ป๊อปเรียกเส้นที่ลงทะเบียนจริง', () => {
    const hits = readFileSync('api/_lib/postingLinkHits.ts', 'utf8');
    expect(hits).toContain('sum(l.hit_count)::text as clicks');
    const ov = readFileSync('api/_handlers/recruit-overview.ts', 'utf8');
    expect(ov).toContain("settle('คลิกลิงก์', () => loadLinkClicks({ buSet }))");
    const registry = readFileSync('api/_handlers/registry.ts', 'utf8');
    expect(registry).toContain("'/api/recruit/postings': recruitPostingsHandler");
    expect(readFileSync('src/lib/recruitPostingsApi.ts', 'utf8')).toContain("apiFetch('/api/recruit/postings?group_stats=1')");
    expect(readFileSync('src/components/jobs/SoGroupPicker.tsx', 'utf8')).toContain('ours ? ourStatsText(fbGroupStatOf(ours, soGroupLinkKey(g), g.name)) : null');
  });
  it('ยังเก็บคลิกรายวันต่อ (ไว้ดูตามช่วงทีหลัง) · migration เพิ่มอย่างเดียว · เจ้าหน้าที่เปิดดูไม่นับ', () => {
    const sql = readFileSync('migrations/175_posting_link_daily_hits.sql', 'utf8').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(sql).toContain('create table if not exists recruit_posting_link_hits');
    expect(sql).not.toMatch(/drop |delete |update |alter /i);
    expect(readFileSync('api/_lib/recruitPostings.ts', 'utf8')).toContain('if (opts.countHit !== false) void recordDailyLinkHit(link.id);');
  });
});
