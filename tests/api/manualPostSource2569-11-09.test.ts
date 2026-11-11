// @vitest-environment node
/**
 * โพสต์เอง vs Autopost (เจ้าของ 9 พ.ย. 2569 "ฉันจะให้คนสามารถโพสต์เองได้ ทีนี้จะจับยังไงว่าสรรหาเอาไปโพสต์เอง อันไหนสั่ง Autopost")
 * ลิงก์กลุ่มละลิงก์ จด note ว่ามาจากทางไหน · ผู้สมัครแตกในตารางช่องทางชั้นที่ 4 (Autopost / โพสต์เอง)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SO_LINK_NOTE, soGroupLinkOf } from '@/lib/soScraping';
import { postSourceOf } from '../../api/_handlers/recruit-overview';
import { appsOfChannelKey, buildApplicantChannelRows } from '@/lib/recruitRequestTab';
import { buildBringerFunnelTree, buildChannelFunnelTree, NO_BRINGER_WEB } from '@/lib/channelFunnel';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

const G = { id: 'g1', fbGroupId: '884533619479424' };
const link = (code: string, note: string | null) => ({ code, channelLabel: 'Facebook · Facebook Group · หางานขับรถ', fbGroupId: '884533619479424', note });

describe('ลิงก์ของกลุ่มแยกตามทาง', () => {
  it('Autopost ใช้แต่ลิงก์ Autopost · โพสต์เองใช้แต่ลิงก์โพสต์เอง · Gen link ไม่ระบุ = ลิงก์ไหนก็ได้', () => {
    const links = [link('gen1', null), link('ap1', SO_LINK_NOTE.autopost), link('mn1', SO_LINK_NOTE.manual)];
    expect(soGroupLinkOf(links, G, 'x', 'autopost')?.code).toBe('ap1');
    expect(soGroupLinkOf(links, G, 'x', 'manual')?.code).toBe('mn1');
    expect(soGroupLinkOf(links, G, 'x')?.code).toBe('gen1');
    expect(soGroupLinkOf([link('gen1', null)], G, 'x', 'autopost')).toBeNull();
  });
  it('ผู้สมัคร: note Autopost หรือรหัสอยู่ในใบสั่ง = Autopost · ที่เหลือ = โพสต์เอง · ไม่มีลิงก์ = null · อ่านใบสั่งไม่ได้ไม่เดา', () => {
    const codes = new Set(['old1']);
    expect(postSourceOf('x1', SO_LINK_NOTE.autopost, codes)).toBe('autopost');
    expect(postSourceOf('old1', null, codes)).toBe('autopost');
    expect(postSourceOf('gen1', null, codes)).toBe('manual');
    expect(postSourceOf('mn1', SO_LINK_NOTE.manual, null)).toBe('manual');
    expect(postSourceOf('gen1', null, null)).toBeNull();
    expect(postSourceOf(null, null, codes)).toBeNull();
  });
});

const fact = (id: string, postSource: RecruitAppFact['postSource']): RecruitAppFact =>
  ({ id, createdAt: '2026-11-09T03:00:00Z', jobId: 'siamraj-sql:OPL1', channelLabel: 'Facebook · Facebook Group · หางานขับรถ กทม.', referralSource: 'facebook', phoneOk: true, calledByAi: false, calledByStaff: false, postSource }) as unknown as RecruitAppFact;

describe('ตารางช่องทางชั้นที่ 4', () => {
  it('ชื่อกลุ่ม › Autopost / โพสต์เอง บวกกันเท่าแถวกลุ่ม · กดแถวได้รายชื่อชุดเดียวกัน', () => {
    const apps = [fact('a', 'autopost'), fact('b', 'autopost'), fact('c', 'manual')];
    const { groups } = buildApplicantChannelRows(apps);
    const groupRow = groups[0].children![0].children![0];
    expect(groupRow.children!.map((r) => [r.name, r.total])).toEqual([['Autopost', 2], ['โพสต์เอง', 1]]);
    expect(appsOfChannelKey(apps, groupRow.children![1].key).map((f) => f.id)).toEqual(['c']);
  });
  it('หน้าภาพรวมโฉมใหม่ (ตาราง รายชื่อมาจากไหน ไปถึงไหน) ก็แตกชั้นเดียวกัน', () => {
    const apps = [fact('a', 'autopost'), fact('b', 'manual'), fact('c', 'manual')];
    const fb = buildChannelFunnelTree(apps).groups.find((g) => g.children?.length)!;
    const grp = fb.children![0].children![0];
    expect(grp.children!.map((r) => [r.channel, r.names.value])).toEqual([['Autopost', 1], ['โพสต์เอง', 2]]);
  });
  it('ปุ่มโพสต์เองอยู่ในช่อง "สั่งอะไร" · ลิงก์จด note โพสต์เอง', () => {
    const order = readFileSync('src/components/jobs/OrderPostButton.tsx', 'utf8');
    expect(order).toContain("{ value: 'manual', label: 'โพสต์เอง — เอาลิงก์ไปโพสต์เอง' }");
    expect(order).toContain("{ value: 'fbGroup', label: 'กลุ่ม Facebook' }");
    expect(readFileSync('src/components/jobs/ManualPostPanel.tsx', 'utf8')).toContain("ensureSoGroupLinks(posting, groups.filter((g) => picked.includes(g.id)), groups, 'manual')");
    expect(readFileSync('src/components/jobs/AutopostDialog.tsx', 'utf8')).toContain("opts.groups, 'autopost')");
    // เตรียมซ้ำในป๊อปเดิมต้องได้ลิงก์เดิม (ทดสอบผ่านหน้าจอ 9 พ.ย. 2569 — เดิมป๊อปไม่จำลิงก์ที่เพิ่งสร้าง)
    expect(readFileSync('src/components/jobs/ManualPostPanel.tsx', 'utf8')).toContain('const current = { ...posting, links: [...posting.links, ...made] };');
    // ปุ่มคัดลอกใช้ตัวก๊อปปี้กลาง (มีทางถอย) — กดจริงในหน้าต่างฝังเคยขึ้นคัดลอกไม่ได้
    expect(readFileSync('src/components/jobs/ManualPostPanel.tsx', 'utf8')).toContain('await copyText(textOf(r));');
  });
});

describe('ใครหารายชื่อเข้ามา (เจ้าของ 9 พ.ย. 2569 "คิวโพสต์เอง ก็บอกว่าคนเข้ามาเป็นของคิว")', () => {
  const f = (id: string, p: Partial<RecruitAppFact>) => ({ ...fact(id, null), ...p }) as RecruitAppFact;
  // 11 พ.ย. 2569 เจ้าของ: คน → ช่องทาง → ช่องทางย่อย → กลุ่ม → โพสต์เอง/Autopost (ต้นไม้ชุดเดียวกับตารางช่องทาง)
  it('นับให้คนที่ทำ · คน → ช่องทาง → … · ทุกชั้นบวกกันเท่ารวม', () => {
    const apps = [
      f('a', { bringer: 'คิว', postSource: 'manual' }),
      f('b', { bringer: 'คิว', postSource: 'manual' }),
      f('c', { bringer: 'คิว', postSource: 'autopost' }),
      f('d', { bringer: 'เจมส์', postSource: null }),
      f('e', { bringer: 'iRecruit', postSource: null, channelLabel: 'iRecruit' }),
      f('g', { bringer: null, postSource: null, channelLabel: 'Tiktok · Tiktok Live' }),
    ];
    const t = buildBringerFunnelTree(apps);
    expect(t.groups.map((g) => [g.channel, g.names.value])).toEqual([['คิว', 3], ['เจมส์', 1], ['ดึงจาก iRecruit', 1], [NO_BRINGER_WEB, 1]]);
    const q = t.groups[0];
    // ชั้นที่ 2 = กลุ่มช่องทาง (Facebook/Tiktok/…) ที่คนนั้นมีรายชื่อเท่านั้น · รวมกันเท่ายอดคน
    expect(q.children!.every((c) => (c.names.value ?? 0) > 0)).toBe(true);
    expect(q.children!.reduce((n, c) => n + (c.names.value ?? 0), 0)).toBe(3);
    expect(t.groups.find((g) => g.channel === NO_BRINGER_WEB)!.children!.map((c) => c.channel)).toEqual(['Tiktok']);
    expect(t.groups.reduce((n, g) => n + (g.names.value ?? 0), 0)).toBe(t.total.names.value);
  });
  it('เซิร์ฟเวอร์: ลิงก์ = คนสร้างลิงก์ › ผู้รับผิดชอบประกาศ (ลิงก์เก่า) · ไม่มีลิงก์ = คนเพิ่ม · อีเมลเป็นชื่อเล่น', () => {
    const src = readFileSync('api/_handlers/recruit-overview.ts', 'utf8');
    expect(src).toContain("coalesce(nullif(btrim(l.created_by_name), ''), nullif(btrim(pp.responsible_name), ''), nullif(btrim(pp.created_by_name), ''))");
    expect(src).toContain("if (a.bringer?.includes('@')) a.bringer = displayOf(a.bringer.toLowerCase()) ?? a.bringer;");
  });
});
