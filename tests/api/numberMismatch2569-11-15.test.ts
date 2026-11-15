// @vitest-environment node
/**
 * เลขเรื่องเดียวกันแต่ละหน้าไม่ตรงกัน (QA 15 พ.ย. 2569 · เจ้าของ "แก้เรื่องที่ 2")
 * ข้อที่ชัด ไม่ต้องเคาะ — ทุกข้อใช้ตัวตัดสินตัวเดียวกับหน้าที่เป็นเจ้าของเลขนั้น
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countPresence, matchesPresence, type PresencePerson } from '@/lib/homePresence';
import { followCountedYmd } from '@/lib/trends/followTrends';
import { funnelChannelOf, FUNNEL_CHANNELS } from '@/lib/homeOverviewFunnel';
import type { FollowTrendRow } from '@/lib/trends/types';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ผู้ใช้งาน: ชิปสถานะรวมกัน = ทั้งหมด', () => {
  const p = (id: string, status: PresencePerson['status']): PresencePerson => ({ id, name: id, bu: 'LBD', role: 'staff', status, lastLoginAt: null, lastActiveAt: null });
  it('บัญชีปิดใช้งาน (ไม่มีสถานะ) มีชิปของตัวเอง · กรองได้', () => {
    const people = [p('a', 'online'), p('b', 'offline'), p('c', 'never')];
    const c = countPresence(people);
    const total = 4; // บัญชีที่ 4 ปิดใช้งาน
    expect(c.online + c.offline + c.never + (total - c.total)).toBe(total);
    expect(matchesPresence(undefined, 'inactive')).toBe(true);
    expect(matchesPresence(people[0], 'inactive')).toBe(false);
    expect(matchesPresence(undefined, 'all')).toBe(true);
    expect(read('src/pages/settings/UserPresence.tsx')).toContain("{ key: 'inactive', label: 'ปิดใช้งาน', count: Math.max(0, total - counts.total) }");
  });
});

describe('ใบขอ: ใบปิดแล้ว = เหลือหา 0', () => {
  it('ไม่ถอยไป 1 ตอนเหลือหาว่าง', () => {
    expect(read('src/pages/jobs/JobListPage.tsx')).toContain("{j.status === 'closed' ? 0 : jobPositionUnits(j)}");
  });
});

describe('ประกาศแล้ว: ภาพรวมจับคู่ทะเบียนประกาศแบบเดียวกับกล่องงาน', () => {
  it('ใช้ buildReleaseIndex (id เต็ม หรือเลขที่ใบที่ไม่ซ้ำ) ทุกเส้น ไม่เทียบ job_id ตรง ๆ', () => {
    const sql = read('api/_lib/homeOnlineSql.ts');
    expect(sql).toContain('const idx = buildReleaseIndex(rows, jobIds);');
    expect(sql).not.toContain('from ${RELEASES} where job_id = any($1::text[])');
    expect(sql.match(/loadReleasedAt\(jobIds\)/g)?.length).toBe(3);
  });
});

describe('ยังไม่มีใครโทร = รอ AI + ไม่มีคิว (คำกลาง)', () => {
  it('แท็บสัดส่วนไม่ใช้ "ยังไม่โทร" กับยอดที่รวมคนรอ AI', () => {
    const src = read('src/lib/homeProportion.ts');
    const prescreen = src.slice(src.indexOf("key: 'prescreen'"), src.indexOf("key: 'afterPrescreen'"));
    expect(prescreen).toContain("noneLabel: 'ยังไม่มีใครโทร'");
  });
});

describe('Dashboard ติดตาม: ปิดงานนับจากผลล่าสุดของคนแถวเดียว (เจ้าของ Choice "ผลล่าสุดของคนนั้น")', () => {
  const row = (id: string, staffId: string, completedAt: string, outcomeCode: string): FollowTrendRow =>
    ({ id, team: 'main', category: 'agreed', slot: 1, createdAt: '2026-11-01T02:00:00Z', scheduledAt: '2026-11-02T02:00:00Z', resultAt: null, completedAt, cancelledAt: null,
       outcomeCode, callStatus: null, callOutcome: null, attempt: null, callRound: 1, callMode: 'manual', phoneKey: '812345678', staffCallOutcome: null, staffCalledAt: null,
       topic: 'เริ่มงาน', unitName: 'Ford', siteCode: '69LBDL0239', staffId, staffName: staffId, bu: 'LBD' }) as FollowTrendRow;
  it('ปิดว่ายกเลิกก่อน แล้วแก้เป็นไป = ปิดงาน 1 · ไปแล้ว 1 · ไม่ไป 0 · ทั้งสามมาจากแถวเดียวกัน (คนเดียวกัน)', () => {
    const rows = [row('r1', 'kung', '2026-11-03T03:00:00Z', 'cancelled'), row('r2', 'tangmay', '2026-11-05T03:00:00Z', 'went')];
    const ymd = followCountedYmd(rows);
    const n = (m: 'completed' | 'success' | 'dropped') => rows.filter((r) => ymd(r, m)).map((r) => r.staffId);
    expect([n('completed'), n('success'), n('dropped')]).toEqual([['tangmay'], ['tangmay'], []]);
  });
});

describe('ช่องทาง: ใบ iRecruit ไปตามช่องทางต้นทาง (เจ้าของ Choice "กระจายตามช่องทางต้นทาง")', () => {
  it('หน้าหลักไม่มีแถบ iRecruit · ใบ iRecruit ที่ลงทะเบียน Facebook = Facebook', () => {
    expect(FUNNEL_CHANNELS).not.toContain('iRecruit');
    expect(funnelChannelOf({ channelLabel: 'iRecruit', referralSource: null, sourceChannel: 'Facebook Group' })).toBe('Facebook');
  });
});

describe('สนใจแล้วติดต่อได้ ≠ ติดต่อได้ (เจ้าของ Choice "เปลี่ยนคำให้ต่างกัน")', () => {
  it('เส้น AI สนใจ → คน ใช้คำ "สนใจแล้วติดต่อได้"', () => {
    expect(read('src/lib/recruitPersonJourney.ts')).toContain("stage('appoint', 'สนใจแล้วติดต่อได้', reached, [");
    expect(read('src/lib/homeProportion.ts')).toContain("totalLabel: 'สนใจแล้วติดต่อได้',");
  });
});

describe('Dashboard ศูนย์ควบคุมใบขอ: ใบขอชั่วคราวไม่นับซ้ำเป็น "ไม่มีสถานะ" (เจ้าของ Choice "แก้บนโค้ดล่าสุดได้เลย")', () => {
  it('โหมดมีงวดก็หักกล่องใบขอชั่วคราว · กล่องย่อยรวมกัน = ทั้งหมด', () => {
    const src = read('src/lib/dashboard/buildDashboardData.ts');
    expect(src).toContain('const pre = withPrequest || totalOverride ? buildPrequestKpi(jobs) : null;');
    expect(src).toContain('const nonePositions = Math.max(total - leafTotal - preTotal, 0);');
  });
});
