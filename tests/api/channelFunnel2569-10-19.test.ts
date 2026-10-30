// @vitest-environment node
/**
 * ช่องทาง → แจ้งเข้า (เจ้าของ 19 ต.ค. 2569 · ทีม Online)
 * "facebook ad 200 สนใจ 100 คนโทรต่อสนใจ 50 นัดได้ 25 มา 10" + "จับได้ถึงแจ้งเข้านู่นอะ"
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildChannelFunnel, buildChannelFunnelTree, funnelChannelOf, funnelGroupOf, IRECRUIT_UNKNOWN_CHANNEL, NO_SUB } from '../../src/lib/channelFunnel';
import { informedSince, irecruitChannelAt, phone9Of } from '../../src/lib/applicantSourceMatch';
import { buildRecruitJourney } from '../../src/lib/recruitJourney';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes';

let n = 0;
const fact = (o: Partial<RecruitAppFact>): RecruitAppFact => ({
  id: `a${++n}`,
  createdAt: '2026-10-05T03:00:00.000Z',
  jobId: null,
  channelLabel: null,
  referralSource: 'facebook',
  position: null,
  phoneOk: true,
  calledByAi: false,
  calledByStaff: false,
  firstCalledAt: null,
  aiAnswer: null,
  aiAnswerAt: null,
  staffAnswer: null,
  staffAnswerAt: null,
  staffLastAt: null,
  contact: null,
  contactBy: null,
  logOk: null,
  logReason: null,
  logAt: null,
  appointmentAt: null,
  attendance: null,
  onBoard: null,
  informed: false,
  sourceChannel: null,
  ...o,
});

describe('ช่องทางของใบ', () => {
  it('ใบจาก iRecruit ใช้ช่องทางที่ลงทะเบียนใน iRecruit · ไม่เจอ = ช่องทางที่ติดมากับใบ หรือ "iRecruit ไม่รู้ช่องทาง"', () => {
    expect(funnelChannelOf({ channelLabel: 'iRecruit', referralSource: null, sourceChannel: 'Facebook Group' })).toBe('Facebook Group');
    expect(funnelChannelOf({ channelLabel: 'iRecruit · Line', referralSource: null, sourceChannel: null })).toBe('LINE OA');
    expect(funnelChannelOf({ channelLabel: 'iRecruit', referralSource: null, sourceChannel: null })).toBe(IRECRUIT_UNKNOWN_CHANNEL);
    expect(funnelChannelOf({ channelLabel: null, referralSource: 'tiktok', sourceChannel: null })).toBe('Tiktok');
    expect(funnelChannelOf({ channelLabel: 'Facebook Group', referralSource: 'facebook', sourceChannel: null })).toBe('Facebook Group');
  });
});

describe('buildChannelFunnel', () => {
  const yes = { calledByAi: true, aiAnswer: 'said_yes' as const, aiAnswerAt: '2026-10-05T04:00:00.000Z' };
  const apps = [
    fact({ ...yes, logOk: true, appointmentAt: '2026-10-07T03:00:00.000Z', attendance: 'showed', informed: true }),
    fact({ ...yes, logOk: true, appointmentAt: '2026-10-07T03:00:00.000Z', attendance: 'no_show' }),
    fact({ ...yes }),
    fact({ calledByAi: true, aiAnswer: 'said_no' }),
    fact({ referralSource: 'tiktok', informed: true }), // แจ้งเข้าโดยไม่ผ่านนัดของเรา = ยังนับแจ้งเข้า
  ];
  const { rows, total } = buildChannelFunnel(apps);
  const fb = rows.find((r) => r.channel === 'Facebook')!;
  it('คอลัมน์ไล่ขั้น: รายชื่อ → AI สนใจ → คนโทรต่อสำเร็จ → นัดได้ → มา → แจ้งเข้า', () => {
    expect([fb.names, fb.aiYes, fb.staffOk, fb.booked, fb.showed, fb.informed].map((c) => c.value)).toEqual([4, 3, 2, 2, 1, 1]);
    expect(rows.find((r) => r.channel === 'Tiktok')!.informed.value).toBe(1);
    expect(rows[0].channel).toBe('Facebook');
  });
  it('แถวรวมเลขเดียวกับการ์ด "รายชื่อที่กรอกมา" · แถวรวม = ผลบวกทุกแถว · กดเลขได้ id ของใบ', () => {
    const j = buildRecruitJourney(apps);
    expect(total.aiYes.value).toBe(j.find((s) => s.key === 'ai')!.parts.find((p) => p.key === 'yes')!.value);
    expect(total.names.value).toBe(rows.reduce((s, r) => s + (r.names.value ?? 0), 0));
    expect(total.informed.ids).toHaveLength(2);
  });
  it('อ่าน ERP ไม่ได้ = แจ้งเข้า "—" ไม่ใช่ 0 · ไม่มีรายชื่อ = แถวรวม 0', () => {
    expect(buildChannelFunnel([fact({ informed: null })]).total.informed.value).toBeNull();
    const empty = buildChannelFunnel([]);
    expect(empty.rows).toEqual([]);
    expect(empty.total.names.value).toBe(0);
  });
});

describe('จับคู่ฝั่ง API', () => {
  it('เบอร์ 9 ตัวท้าย · แจ้งเข้าวันเดียวกับวันกรอก (เวลาไทย) นับ · ก่อนวันกรอกไม่นับ', () => {
    expect(phone9Of('+66812345678')).toBe('812345678');
    expect(phone9Of('081-234-5678')).toBe('812345678');
    const days = new Map([['812345678', ['2026-10-04', '2026-10-06']]]);
    expect(informedSince(days, '812345678', '2026-10-05T20:00:00.000Z')).toBe(true); // 6 ต.ค. เวลาไทย
    expect(informedSince(new Map([['812345678', ['2026-10-04']]]), '812345678', '2026-10-05T03:00:00.000Z')).toBe(false);
    expect(informedSince(null, '812345678', '2026-10-05T03:00:00.000Z')).toBeNull();
  });
  it('ช่องทาง iRecruit = ลงทะเบียนล่าสุดก่อนใบเข้าระบบเรา (ย้อนไม่เกิน 60 วัน)', () => {
    const regs = new Map([
      ['812345678', [
        { at: '2026-09-01T03:00:00.000Z', channel: 'Facebook Group' },
        { at: '2026-10-04T03:00:00.000Z', channel: 'Tiktok' },
        { at: '2026-10-20T03:00:00.000Z', channel: 'Line AI LBD' },
      ]],
    ]);
    expect(irecruitChannelAt(regs, '812345678', '2026-10-05T03:00:00.000Z')).toBe('Tiktok');
    expect(irecruitChannelAt(regs, '812345678', '2027-01-01T03:00:00.000Z')).toBeNull();
  });
  it('API: อ่านแจ้งเข้าที่ไม่ยกเลิก + ช่องทาง iRecruit · หน้าจอใช้ตารางใหม่', () => {
    const sql = readFileSync('api/_lib/applicantSourceSql.ts', 'utf8');
    expect(sql).toContain("activeInformWhereSql('IH')");
    expect(sql).toContain('FROM recruit_register r');
    const h = readFileSync('api/_handlers/recruit-overview.ts', 'utf8');
    expect(h).toContain('toFact(r, boardPhones, sources)');
    expect(readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8')).toContain('<ChannelFunnelTable');
  });
});

describe('ช่องทาง 3 ชั้น: 4 กลุ่ม → ช่องทาง → ชื่อกลุ่ม (เจ้าของ 25 ต.ค. 2569)', () => {
  const apps = [
    fact({ channelLabel: 'Facebook Group · กลุ่มหางานจังหวัด' }),
    fact({ channelLabel: 'Facebook Group · กลุ่มหางานจังหวัด' }),
    fact({ channelLabel: 'Facebook Group' }),
    fact({ channelLabel: 'Facebook Ads' }),
    fact({ channelLabel: 'Tiktok' }),
    fact({ channelLabel: 'LINE OA' }),
    fact({ channelLabel: 'พนักงานแนะนำ' }),
    fact({ channelLabel: null, referralSource: null }),
  ];
  const { groups, total } = buildChannelFunnelTree(apps);
  it('ชั้นบน = Facebook · TikTok · Webjob · Offline · อื่น ๆ/ไม่รู้ ตามลำดับ · LINE ไป Webjob · พนักงานแนะนำไป Offline', () => {
    expect(groups.map((g) => [g.key, g.names.value])).toEqual([
      ['facebook', 4],
      ['tiktok', 1],
      ['webjob', 1],
      ['offline', 1],
      ['unknown', 1],
    ]);
    expect(funnelGroupOf(IRECRUIT_UNKNOWN_CHANNEL)).toBe('unknown');
  });
  it('ทุกชั้นบวกกันเท่ารวม', () => {
    expect(groups.reduce((a, g) => a + (g.names.value ?? 0), 0)).toBe(total.names.value);
    for (const g of groups) {
      expect((g.children ?? []).reduce((a, c) => a + (c.names.value ?? 0), 0)).toBe(g.names.value);
      for (const c of g.children ?? []) if (c.children) expect(c.children.reduce((a, x) => a + (x.names.value ?? 0), 0)).toBe(c.names.value);
    }
  });
  it('Facebook Groupกดลงไปเห็นชื่อกลุ่ม · ไม่มีชื่อ = ไม่ระบุชื่อ · Ads ไม่มีชื่อย่อยก็ไม่ให้กด', () => {
    const fb = groups[0].children!;
    const grp = fb.find((c) => c.channel === 'Facebook Group')!;
    expect(grp.children!.map((x) => [x.channel, x.names.value])).toEqual([
      ['กลุ่มหางานจังหวัด', 2],
      [NO_SUB, 1],
    ]);
    expect(fb.find((c) => c.channel === 'Facebook Ads')!.children).toBeUndefined();
  });
});

