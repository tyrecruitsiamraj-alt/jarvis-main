/**
 * แท็บการติดต่อ (เจ้าของ 29 ต.ค. 2569): คนที่ตอบ AI ว่าสนใจ → โทรแล้วเป็นไง → นัด → มา · แยกช่องทาง
 * Choice: ฐาน = สนใจอย่างเดียว · ยังไม่รู้ผลนัดแยก 2 ช่อง · ไม่มี % Success · ของเดิมต่อท้าย
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTACT_BOOKED, CONTACT_OK, buildContactRows, contactBucketOf } from '../../src/lib/recruitContactTab';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes';

const NOW = new Date('2026-10-29T07:00:00Z');
const fact = (over: Partial<RecruitAppFact>): RecruitAppFact =>
  ({
    id: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-10-05T03:00:00Z',
    jobId: 'siamraj-sql:OPL6910105',
    channelLabel: 'Facebook Group · หางานขับรถ กทม.',
    referralSource: null,
    position: 'พนักงานขับรถ',
    phoneOk: true,
    calledByAi: true,
    calledByStaff: false,
    firstCalledAt: '2026-10-05T03:10:00Z',
    aiAnswer: 'said_yes',
    aiAnswerAt: '2026-10-05T03:12:00Z',
    contact: null,
    contactBy: null,
    logOk: null,
    appointmentAt: null,
    attendance: null,
    ...over,
  }) as RecruitAppFact;

describe('ขั้นของคนที่สนใจ', () => {
  it('ยังไม่มีคนโทรต่อ = รอติดต่อ · ไม่สำเร็จ · สำเร็จแล้วนัดไม่ได้ / นัดได้ › มา ไม่มา ยังไม่ถึงวัน เลยวันยังไม่ลงผล', () => {
    expect(contactBucketOf(fact({}), NOW)).toBe('waiting');
    expect(contactBucketOf(fact({ logOk: false }), NOW)).toBe('fail');
    expect(contactBucketOf(fact({ logOk: true, appointmentFailed: true }), NOW)).toBe('apptFailed');
    expect(contactBucketOf(fact({ logOk: true }), NOW)).toBe('apptNone');
    expect(contactBucketOf(fact({ logOk: true, appointmentAt: '2026-10-30T02:00:00Z' }), NOW)).toBe('upcoming');
    expect(contactBucketOf(fact({ logOk: true, appointmentAt: '2026-10-20T02:00:00Z' }), NOW)).toBe('overdue');
    expect(contactBucketOf(fact({ logOk: true, appointmentAt: '2026-10-20T02:00:00Z', attendance: 'showed' }), NOW)).toBe('showed');
    expect(contactBucketOf(fact({ logOk: true, appointmentAt: '2026-10-20T02:00:00Z', attendance: 'no_show' }), NOW)).toBe('noShow');
  });
});

describe('แยกช่องทาง', () => {
  const apps = [
    fact({ id: 'a1' }),
    fact({ id: 'a2', logOk: false }),
    fact({ id: 'a3', logOk: true, appointmentFailed: true }),
    fact({ id: 'a4', channelLabel: 'TikTok · @sorecruit', logOk: true, appointmentAt: '2026-10-20T02:00:00Z', attendance: 'showed' }),
    fact({ id: 'a5', channelLabel: 'TikTok · @sorecruit', logOk: true, appointmentAt: '2026-10-31T02:00:00Z' }),
    // ไม่ได้ตอบ AI ว่าสนใจ ⇒ ไม่อยู่ในแท็บนี้
    fact({ id: 'a6', aiAnswer: 'said_no', logOk: true }),
    fact({ id: 'a7', calledByAi: false, calledByStaff: true, aiAnswer: null, logOk: true }),
  ];
  it('ฐาน = สนใจเท่านั้น · ทุกชั้นบวกกันเท่าชั้นบน ทุกแถว', () => {
    const { total, groups } = buildContactRows(apps, NOW);
    expect(total.total).toBe(5);
    for (const r of [total, ...groups, ...groups.flatMap((g) => g.children ?? [])]) {
      expect(r.counts.waiting + r.counts.fail + r.ok).toBe(r.total);
      expect(CONTACT_OK.reduce((n, k) => n + r.counts[k], 0)).toBe(r.ok);
      expect(CONTACT_BOOKED.reduce((n, k) => n + r.counts[k], 0)).toBe(r.booked);
      expect(r.ids.total).toHaveLength(r.total);
    }
    expect(groups.map((g) => [g.name, g.total, g.booked, g.counts.showed])).toEqual([
      ['Facebook', 3, 0, 0],
      ['TikTok', 2, 2, 1],
    ]);
    expect(total.ids.booked.sort()).toEqual(['a4', 'a5']);
  });
  it('จอ: แท็บการติดต่อใช้ ContactTab · ของเดิมต่อท้าย · ไม่มี % Success', () => {
    const ov = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
    expect(ov).toContain('<ContactTab apps={view.cohort} onOpenNames={(title, ids) => setNames({ title, ids })}>');
    const ui = readFileSync('src/components/dashboard-trends/ContactTab.tsx', 'utf8');
    expect(ui).not.toContain('%');
    expect(ui).toContain('data-testid="contact-tab-channels"');
  });
});

describe('ป๊อปรายชื่อเปิดชื่อตาม id (29 ต.ค. 2569 — คนที่เจ้าหน้าที่คนอื่นเก็บไปแล้วเคยขึ้น "เปิดชื่อไม่ได้")', () => {
  it('เส้น ?names= อ่านอย่างเดียว · ในขอบเขต BU ของผู้ใช้ · ทีละ 100 id · ป๊อปไม่ดึงลิสต์ผู้สมัครทั้งก้อนแล้ว', async () => {
    const { loadApplicantNames, NAMES_MAX } = await import('../../api/_handlers/recruit-overview');
    expect(NAMES_MAX).toBe(100);
    expect(await loadApplicantNames(['not-a-uuid'], { mode: 'all' })).toEqual([]);
    expect(await loadApplicantNames(['11111111-1111-4111-8111-111111111111'], { mode: 'none' })).toEqual([]);
    const api = readFileSync('api/_handlers/recruit-overview.ts', 'utf8');
    expect(api).toContain("and ($2::text[] is null or ${appBuSql('a')} = any($2::text[]))");
    const dlg = readFileSync('src/components/dashboard-trends/JourneyNamesDialog.tsx', 'utf8');
    expect(dlg).toContain('fetchApplicantNames(ids)');
    expect(dlg).not.toContain('fetchAllJobApplications');
  });
});
