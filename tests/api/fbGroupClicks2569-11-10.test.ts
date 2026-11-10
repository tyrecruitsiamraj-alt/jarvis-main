// @vitest-environment node
/**
 * กลุ่ม Facebook: คลิก → กรอก (เจ้าของ 10 พ.ย. 2569)
 * > *"Tracking link หน่อยว่าคนคลิกเข้ามาเท่าไหร่ จะได้รู้ด้วยกลุ่มไหนคนเข้ามาดูงานเราเยอะ ต่อไปเวลาเลือกกลุ่ม Auto post ได้เลือกกลุ่มถูก"*
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildFbGroupClickRows } from '@/lib/fbGroupClicks';
import { buildChannelFunnelTree } from '@/lib/channelFunnel';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

const app = (id: string, label: string | null): RecruitAppFact =>
  ({ id, channelLabel: label, referralSource: null, sourceChannel: null, sourceSub: null, createdAt: '2026-11-10T03:00:00Z', informed: false } as unknown as RecruitAppFact);

const G1 = 'Facebook · Facebook Group · กลุ่มคนขับรถผู้บริหาร';
const G2 = 'Facebook · Facebook Group · หางานขับรถ (553130514463865)';

describe('ตารางกลุ่ม Facebook', () => {
  it('คลิกรวมตามชื่อกลุ่มในป้ายลิงก์ · กรอกเท่ากับแถวกลุ่มในตารางช่องทาง · กลุ่มที่มีคลิกแต่ไม่มีคนกรอกก็ขึ้น', () => {
    const cohort = [app('a1', G1), app('a2', G1), app('a3', 'Tiktok · Live')];
    const { rows, totalClicks } = buildFbGroupClickRows(cohort, [
      { label: G1, clicks: 7 },
      { label: G2, clicks: 12 },
      { label: 'Tiktok · Live', clicks: 50 },
    ]);
    expect(rows.map((r) => [r.channel, r.clicks, r.names.value])).toEqual([
      ['หางานขับรถ (553130514463865)', 12, 0],
      ['กลุ่มคนขับรถผู้บริหาร', 7, 2],
    ]);
    expect(totalClicks).toBe(19);
    const tree = buildChannelFunnelTree(cohort);
    const fbGroup = tree.groups.find((g) => g.key === 'facebook')?.children?.find((c) => c.key === 'Facebook Group');
    expect(fbGroup?.children?.find((c) => c.channel === 'กลุ่มคนขับรถผู้บริหาร')?.names.value).toBe(2);
  });
  it('นับคลิกไม่ได้ = "—" (null) ไม่ใช่ 0 · ไม่มีอะไรเลย = แถวว่าง (ตารางยังอยู่)', () => {
    const { rows, totalClicks } = buildFbGroupClickRows([app('a1', G1)], null);
    expect(rows[0].clicks).toBeNull();
    expect(totalClicks).toBeNull();
    expect(buildFbGroupClickRows([], []).rows).toEqual([]);
  });
  it('ลิงก์ Facebook Group เก่าที่ไม่ได้เลือกกลุ่ม ("ไม่ระบุชื่อ") อยู่ท้าย', () => {
    const { rows } = buildFbGroupClickRows([app('a1', 'Facebook · Facebook Group')], [{ label: G1, clicks: 1 }]);
    expect(rows.map((r) => r.channel)).toEqual(['กลุ่มคนขับรถผู้บริหาร', 'ไม่ระบุชื่อ']);
  });
});

describe('เก็บคลิกรายวัน', () => {
  it('migration เพิ่มอย่างเดียว · นับต่อ (ลิงก์ · วันไทย) · ไม่เก็บข้อมูลคน', () => {
    const sql = readFileSync('migrations/175_posting_link_daily_hits.sql', 'utf8').split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
    expect(sql).toContain('create table if not exists recruit_posting_link_hits');
    expect(sql).toContain('primary key (link_id, day)');
    expect(sql).not.toMatch(/drop |delete |update |alter |\bip\b|user_agent/i);
  });
  it('เปิดลิงก์สมัคร = +1 รายวันคู่กับยอดสะสม · เจ้าหน้าที่เปิดดู (countHit false) ไม่นับ', () => {
    const src = readFileSync('api/_lib/recruitPostings.ts', 'utf8');
    expect(src).toContain('if (opts.countHit !== false) void recordDailyLinkHit(link.id);');
    const hits = readFileSync('api/_lib/postingLinkHits.ts', 'utf8');
    expect(hits).toContain("(now() at time zone 'Asia/Bangkok')::date");
    expect(hits).toContain('on conflict (link_id, day) do update set hits');
  });
  it('ภาพรวมส่งคลิกของช่วงตามสิทธิ์ BU · ป๊อปเลือกกลุ่มอ่าน 30 วัน', () => {
    const ov = readFileSync('api/_handlers/recruit-overview.ts', 'utf8');
    expect(ov).toContain("settle('คลิกลิงก์', () => loadLinkClicks({ from: window.from, to: window.to, buSet }))");
    const rp = readFileSync('api/_handlers/recruit-postings.ts', 'utf8');
    expect(rp).toContain("getQuery(req, 'group_stats') === '1'");
    const picker = readFileSync('src/components/jobs/SoGroupPicker.tsx', 'utf8');
    expect(picker).toContain('ours ? ourStatsText(ours[soGroupLinkKey(g)], !g.stats30d) : null');
  });
});
