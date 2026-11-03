/**
 * Gen link เลือกกลุ่ม Facebook → รายงานกลุ่มไหนได้คน แยกนายไทย/นายต่างชาติ (เจ้าของ 2 พ.ย. 2569)
 * Choice: เลือกจากรายชื่อ So Scraping · 1 ลิงก์ = 1 กลุ่ม · ไล่ทั้งเส้น · ดูที่ภาพรวมงานสรรหา · Autopost "รอทำพร้อมกันทีเดียว"
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isFacebookGroupChannel, soGroupLinkLabel, soGroupLinksError, soGroupSections, type SoGroup } from '@/lib/soScraping';
import { buildChannelFunnelTree, funnelSubOf } from '@/lib/channelFunnel';
import { EMPTY_REQUEST_FILTER, filterRequestRows, requestSubtypeOptions, type RecruitRequestRow } from '@/lib/recruitRequestTab';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

const read = (p: string) => readFileSync(p, 'utf8');

describe('Gen link ช่องทาง Facebook Group = กลุ่มละลิงก์ ชื่อกลุ่มตาม So Scraping', () => {
  it('รู้จักช่องทาง Facebook Group · ชื่อลิงก์ = ช่องทาง · ชื่อกลุ่ม (ตัด · ในชื่อกลุ่ม)', () => {
    expect(isFacebookGroupChannel('Facebook Group')).toBe(true);
    expect(isFacebookGroupChannel('facebook  group')).toBe(true);
    expect(isFacebookGroupChannel('Facebook Page')).toBe(false);
    expect(soGroupLinkLabel('Facebook · Facebook Group', 'กลุ่มคนขับรถผู้บริหาร')).toBe('Facebook · Facebook Group · กลุ่มคนขับรถผู้บริหาร');
    expect(soGroupLinkLabel('Facebook · Facebook Group', 'หางาน · ขับรถ')).toBe('Facebook · Facebook Group · หางาน ขับรถ');
  });

  it('ตารางช่องทางอ่านชื่อกลุ่มจากชื่อลิงก์ — ลงถึงชั้นชื่อกลุ่มใต้ Facebook Group', () => {
    const fact = (id: string, label: string): RecruitAppFact =>
      ({ id, createdAt: '2026-11-02T03:00:00Z', jobId: 'siamraj-sql:OPL6910074', channelLabel: label, referralSource: null } as RecruitAppFact);
    const a = fact('app-1', 'Facebook · Facebook Group · กลุ่มคนขับรถผู้บริหาร');
    expect(funnelSubOf(a)).toBe('กลุ่มคนขับรถผู้บริหาร');
    const tree = buildChannelFunnelTree([a, fact('app-2', 'Facebook · Facebook Group · กลุ่มคนขับรถผู้บริหาร'), fact('app-3', 'Facebook · Facebook Group · FIJOB หางาน คนขับรถผู้บริหาร by THREETREE STUDIO')]);
    const fb = tree.groups.find((g) => g.key === 'facebook')!;
    const grp = fb.children!.find((c) => c.channel === 'Facebook Group')!;
    expect(grp.children!.map((c) => [c.channel, c.names.value])).toEqual([
      ['กลุ่มคนขับรถผู้บริหาร', 2],
      ['FIJOB หางาน คนขับรถผู้บริหาร by THREETREE STUDIO', 1],
    ]);
  });

  it('ตัวเลือกกลุ่มจัดหมวดตามธุรกิจ (รายชื่อจาก So Scraping ตัวเดียวกับ Autopost)', () => {
    const groups: SoGroup[] = [
      { id: 'mvhmloovlppmpi5o6fg', name: 'กลุ่มคนขับรถผู้บริหาร', province: null, department: 'LBD', job_type: null },
      { id: 'grp_lm_0001', name: 'หางานดูแลสวน คนสวน', province: null, department: 'LM', job_type: null },
    ];
    expect(soGroupSections(groups, 'LBD').map((s) => [s.label, s.forJob, s.groups.length])).toEqual([
      ['LBD', true, 1],
      ['LM', false, 1],
    ]);
  });

  it('ป๊อป Gen link: Facebook Group เลือกกลุ่ม = กลุ่มละลิงก์ · ไม่เลือกกลุ่ม = 1 ลิงก์ของช่องทาง (3 พ.ย. 2569) · ปุ่มบอกจำนวนลิงก์', () => {
    const src = read('src/components/jobs/GenApplyLinkDialog.tsx');
    expect(src).toContain('channels: linkChannels,');
    expect(src).toContain('soGroupLinkLabel(recruitChannelLabel(c), g.name)');
    expect(src).toContain('isFacebookGroupChannel(c.name) && pickedGroups.length > 0');
    expect(src).not.toContain('missingGroup');
    expect(src).toContain('disabled={saving || !title.trim()}');
  });
});

describe('Autopost ส่งลิงก์กลุ่มละอัน (group_links ตามสเปกให้ So Scraping)', () => {
  const base = {
    post_mode: 'caption_only',
    group_ids: ['mvhmloovlppmpi5o6fg', 'mvhmlowwseq4bvkqq4'],
    apply_link: 'https://jarvis.siamrajathanee.dev/apply/p/kbfp6xm',
    link_code: 'kbfp6xm',
  };
  it('ไม่มี group_links = ใบสั่งแบบเดิม ผ่าน', () => {
    expect(soGroupLinksError(base)).toBeNull();
  });
  it('ครบทุกกลุ่ม · ลิงก์ลงท้ายด้วยรหัสของตัวเอง = ผ่าน', () => {
    expect(
      soGroupLinksError({
        ...base,
        group_links: [
          { group_id: 'mvhmloovlppmpi5o6fg', link_code: 'k3f9x2a', apply_link: 'https://jarvis.siamrajathanee.dev/apply/p/k3f9x2a' },
          { group_id: 'mvhmlowwseq4bvkqq4', link_code: 'q7m2z8d', apply_link: 'https://jarvis.siamrajathanee.dev/apply/p/q7m2z8d' },
        ],
      }),
    ).toBeNull();
  });
  it('ขาดกลุ่ม / ลิงก์ไม่ตรงรหัส / ผิดรูป = ไม่ผ่าน', () => {
    const one = [{ group_id: 'mvhmloovlppmpi5o6fg', link_code: 'k3f9x2a', apply_link: 'https://jarvis.siamrajathanee.dev/apply/p/k3f9x2a' }];
    expect(soGroupLinksError({ ...base, group_links: one })).toBe('ยังไม่มีลิงก์ของบางกลุ่ม — ปิดแล้วสั่งใหม่');
    expect(soGroupLinksError({ ...base, group_links: [{ ...one[0], apply_link: 'https://jarvis.siamrajathanee.dev/apply/p/zzzzzzz' }] })).toBe('ลิงก์ของกลุ่มผิดรูป — ปิดแล้วสั่งใหม่');
    expect(soGroupLinksError({ ...base, group_links: 'x' })).toBe('ลิงก์ของกลุ่มผิดรูป — ปิดแล้วสั่งใหม่');
  });
  it('ป๊อป Autopost ใช้ลิงก์ชื่อเดียวกับ Gen link · มีแล้วใช้ตัวเดิม · server ตรวจทุกลิงก์เป็นของใบนี้', () => {
    const dlg = read('src/components/jobs/AutopostDialog.tsx');
    expect(dlg).toContain('const label = soGroupLinkLabel(channelLabel, soGroupLabel(g));');
    expect(dlg).toContain('let l = have.get(label) ?? null;');
    expect(dlg).toContain('group_links: groupLinks,');
    const api = read('api/_handlers/matching-job-postings.ts');
    expect(api).toContain('const glError = soGroupLinksError(jobSnapshot);');
    expect(api).toContain('if (!(await linkCodeBelongsToJob(gl.link_code, jobId))) {');
  });
});

describe('ภาพรวมงานสรรหา ตัวกรอง "งานย่อย" (นายไทย · นายต่างชาติ)', () => {
  const row = (requestNo: string, subtype: string | null): RecruitRequestRow =>
    ({ requestNo, jobId: `siamraj-sql:${requestNo}`, unitName: null, siteCode: null, siteName: null, sector: null, province: null, district: null, subdistrict: null, leadKind: null, subtype, requested: 1, filled: 0, cancelled: 0, remaining: 1, released: true, applications: 0 });
  const rows = [row('OPL6910074', 'boss_th'), row('OPL6910081', 'boss_foreign'), row('OPL6910082', 'boss_foreign'), row('LAO6910024', null)];
  it('ตัวเลือก = งานย่อยที่มีใบในช่วง ชื่อตามกล่องงาน', () => {
    expect(requestSubtypeOptions(rows)).toEqual([
      { value: 'boss_th', label: 'นายไทย', n: 1 },
      { value: 'boss_foreign', label: 'นายต่างชาติ', n: 2 },
    ]);
  });
  it('เลือกนายต่างชาติ = เหลือใบนายต่างชาติ · ไม่เลือก = ทุกใบ', () => {
    expect(filterRequestRows(rows, { ...EMPTY_REQUEST_FILTER, subtype: 'boss_foreign' }).map((r) => r.requestNo)).toEqual(['OPL6910081', 'OPL6910082']);
    expect(filterRequestRows(rows, EMPTY_REQUEST_FILTER)).toHaveLength(4);
  });
  it('server คิดงานย่อยด้วยตัวตัดสินเดียวกับกล่องงาน เฉพาะงานขับรถ', () => {
    const sql = read('api/_lib/homeOnlineSql.ts');
    expect(sql).toContain('x && isDrivingPositionLabel(position)');
    expect(sql).toContain('drivingSubtypeOf(');
    expect(sql).toContain('AS boss_nationality');
  });
});

describe('Gen link เพิ่ม (ใบที่มีลิงก์แล้ว) เลือกกลุ่มได้เหมือนป๊อปแรก (3 พ.ย. 2569)', () => {
  it('AddChannelLinks แตก Facebook Group เป็นกลุ่มละลิงก์ · ไม่เลือกกลุ่ม = 1 ลิงก์ของช่องทาง (3 พ.ย. 2569)', () => {
    const src = read('src/components/jobs/AddChannelLinks.tsx');
    expect(src).toContain('<SoGroupPicker');
    expect(src).toContain('soGroupLinkLabel(recruitChannelLabel(c), g.name)');
    expect(src).toContain('isFacebookGroupChannel(c.name) && pickedGroups.length > 0');
    expect(src).not.toContain('missingGroup');
    expect(src).toContain('disabled={busy}');
    expect(read('src/pages/jobs/BoardPostingPage.tsx')).toContain('jobBu={jobBuOf(job)}');
  });
});
