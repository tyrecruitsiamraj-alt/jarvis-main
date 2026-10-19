// @vitest-environment node
/**
 * ช่องทาง → แจ้งเข้า (เจ้าของ 19 ต.ค. 2569 · ทีม Online)
 * "facebook ad 200 สนใจ 100 คนโทรต่อสนใจ 50 นัดได้ 25 มา 10" + "จับได้ถึงแจ้งเข้านู่นอะ"
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildChannelFunnel, funnelChannelOf, IRECRUIT_UNKNOWN_CHANNEL } from '../../src/lib/channelFunnel';
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
    expect(funnelChannelOf({ channelLabel: 'iRecruit', referralSource: null, sourceChannel: 'Facebook กลุ่ม' })).toBe('Facebook กลุ่ม');
    expect(funnelChannelOf({ channelLabel: 'iRecruit · Line', referralSource: null, sourceChannel: null })).toBe('LINE OA');
    expect(funnelChannelOf({ channelLabel: 'iRecruit', referralSource: null, sourceChannel: null })).toBe(IRECRUIT_UNKNOWN_CHANNEL);
    expect(funnelChannelOf({ channelLabel: null, referralSource: 'tiktok', sourceChannel: null })).toBe('TikTok');
    expect(funnelChannelOf({ channelLabel: 'Facebook Group', referralSource: 'facebook', sourceChannel: null })).toBe('Facebook กลุ่ม');
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
    expect(rows.find((r) => r.channel === 'TikTok')!.informed.value).toBe(1);
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
        { at: '2026-09-01T03:00:00.000Z', channel: 'Facebook กลุ่ม' },
        { at: '2026-10-04T03:00:00.000Z', channel: 'TikTok' },
        { at: '2026-10-20T03:00:00.000Z', channel: 'Line AI LBD' },
      ]],
    ]);
    expect(irecruitChannelAt(regs, '812345678', '2026-10-05T03:00:00.000Z')).toBe('TikTok');
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
