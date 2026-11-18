// @vitest-environment node
/**
 * เลขเรื่องเดียวกันแต่ละหน้าไม่ตรงกัน (QA 15 พ.ย. 2569 · เจ้าของ "แก้เรื่องที่ 2")
 * ข้อที่ชัด ไม่ต้องเคาะ — ทุกข้อใช้ตัวตัดสินตัวเดียวกับหน้าที่เป็นเจ้าของเลขนั้น
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { countPresence, matchesPresence, type PresencePerson } from '@/lib/homePresence';
import { remainingPositionsOf } from '@/lib/jobPositionUnits';
import type { JobRequest } from '@/types';
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
  it('ใบปิด = 0 · ใบเปิดไม่มีค่า = 1 ตามเดิม', () => {
    expect(remainingPositionsOf({ status: 'closed' } as JobRequest)).toBe(0);
    expect(remainingPositionsOf({ status: 'open', position_units: 3 } as JobRequest)).toBe(3);
    expect(remainingPositionsOf({ status: 'open' } as JobRequest)).toBe(1);
  });
  it('ไม่ถอยไป 1 ตอนเหลือหาว่าง', () => {
    const page = read('src/pages/jobs/JobListPage.tsx');
    // การ์ด (มือถือ) + ตาราง (จอคอม) + หน้ารายละเอียดใบขอ ใช้ตัวเดียวกัน — รอบแรกแก้แค่การ์ด ตารางยังขึ้น 1
    expect(page.match(/remainingPositionsOf\(j\)/g)).toHaveLength(2);
    expect(read('src/components/jobs/UnitRequestInfoFields.tsx')).toContain('remainingPositionsOf(data)');
  });
});

describe('ประกาศแล้ว: ภาพรวมจับคู่ทะเบียนประกาศแบบเดียวกับกล่องงาน', () => {
  it('ใช้ buildReleaseIndex (id เต็ม หรือเลขที่ใบที่ไม่ซ้ำ) ทุกเส้น ไม่เทียบ job_id ตรง ๆ', () => {
    const sql = read('api/_lib/homeOnlineSql.ts');
    expect(sql).not.toContain('from ${RELEASES} where job_id = any($1::text[])');
    expect(sql.match(/loadReleasedAt\(jobIds, openIdsOf\(withBu, jobIds\)\)/g)?.length).toBe(3);
    // เลขซ้ำตัดสินจากใบเปิดเท่านั้นแบบกล่องงาน (LBM6910005 ประกาศใต้ใบชั่วคราวที่ปิดแล้ว)
    expect(sql).toContain('const idx = buildReleaseIndex(rows, boardIds ?? jobIds);');
    // ตาราง "ใครต้องทำอะไร" + หน้าหลักผู้บริหาร ใช้ตัวจับคู่เดียวกัน (เคยค้าง 166 หลังแก้รอบแรก)
    for (const f of ['api/_handlers/recruit-stuck.ts', 'api/_handlers/request-pipeline.ts']) {
      const h = read(f);
      expect(h, f).toMatch(/loadReleaseMatches\(\s*jobIds/);
      expect(h, f).not.toMatch(/from \$\{RELEASES\} where job_id = any/);
    }
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
  it('ใบขอชั่วคราวอยู่ในกล่องสถานะแล้ว (18 พ.ย. 2569) · ไม่มีสถานะ = ส่วนเกินจากผลรวมกล่องเท่านั้น', () => {
    const src = read('src/lib/dashboard/buildDashboardData.ts');
    expect(src).not.toContain('buildPrequestKpi');
    expect(src).toContain('const nonePositions = Math.max(total - leafTotal, 0);');
  });
});

describe('3 คู่ที่เหลือ (เจ้าของ Choice 15 พ.ย. 2569)', () => {
  it('ไม่รับสาย: หน้าหลักแบ่งทุกสายด้วยหมวดของหน้าติดตาม ("แบบหน้าติดตามทุกหน้า")', () => {
    const src = read('api/_lib/homeLumosSummarySql.ts');
    const fn = src.slice(src.indexOf('export function followLedgerBucket'), src.indexOf('const BUCKET_COLS'));
    expect(fn).toContain("return result === 'waiting' ? 'waiting' : doneBucketOf(result);");
    expect(fn).not.toContain("if (first !== 'done') return first;");
  });
  it('ยังไม่โทร: บันทึกก่อนคนที่ถืออยู่เก็บไป ไม่นับว่าคนนี้โทรแล้ว ("อ้นยังไม่โทร")', async () => {
    const { buildCallerResults } = await import('@/lib/callerResults');
    const base = { createdAt: '2026-11-02T03:00:00Z', jobId: 'siamraj-sql:LBM6911007', channelLabel: null, referralSource: null, calledByAi: false, calledByStaff: true, aiAnswer: null, appointmentAt: null, attendance: null, appointmentFailed: false, phoneOk: true, claimedBy: 'อ้น' };
    const r = buildCallerResults([
      { ...base, id: 'e7d27d1d-0001', logOk: false, logAt: '2026-11-03T03:00:00Z', claimedAt: '2026-11-04T03:00:00Z' },
      { ...base, id: 'e7d27d1d-0002', logOk: true, logAt: '2026-11-05T03:00:00Z', claimedAt: '2026-11-04T03:00:00Z' },
    ] as never);
    expect([r.total.notLogged, r.total.ok, r.total.notOk]).toEqual([['e7d27d1d-0001'], ['e7d27d1d-0002'], []]);
  });
  it('ปีเก่า: ปฏิทินหน้าหลักเลือกได้ตั้งแต่วันแรกของสมุดใบขอ ("ปฏิทินเลือกได้ตั้งแต่ ม.ค. 2567")', () => {
    expect(read('src/pages/HomeOverviewPage.tsx').match(/minYmd=\{REQUEST_LEDGER_SINCE\}/g)).toHaveLength(2);
    expect(read('api/_lib/siamrajPenaltyLedgerSql.ts')).toContain('|| REQUEST_LEDGER_SINCE;');
  });
});
