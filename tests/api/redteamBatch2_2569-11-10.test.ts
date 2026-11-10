// @vitest-environment node
/**
 * ตรวจทั้งระบบ 10 พ.ย. 2569 รอบ 2 (เจ้าของ "ทำต่อให้หมดเลย") — ข้อที่ค้างจากรายงานรวม (ของเรา + Codex)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applicationAppliedYmd } from '@/lib/recruitRm';
import { ambiguousRequestNos, buildReleaseIndex } from '@/lib/jobReleaseIndex';
import { buildChannelPlacement } from '@/lib/channelPlacement';
import { isReleased } from '../../api/_lib/jobPublicReleases';
import { getClientIp } from '../../api/_lib/rateLimit';
import type { PublicApplication } from '@/lib/publicApplicationsApi';

const read = (p: string) => readFileSync(p, 'utf8');

describe('วันที่สมัคร = วันไทย', () => {
  it('00:30 ไทย (17:30Z วันก่อน) = วันไทย · วันที่เปล่าใช้ตามนั้น · อ่านไม่ออก = null', () => {
    const app = (created_at: string) => ({ created_at }) as unknown as PublicApplication;
    expect(applicationAppliedYmd(app('2026-11-08T17:30:00Z'))).toBe('2026-11-09');
    expect(applicationAppliedYmd(app('2026-11-09T16:59:00Z'))).toBe('2026-11-09');
    expect(applicationAppliedYmd(app('2026-11-09'))).toBe('2026-11-09');
    expect(applicationAppliedYmd(app('ไม่ใช่วันที่'))).toBeNull();
  });
});

describe('ใบจริง/ใบชั่วคราวเลขซ้ำ ไม่ปนสถานะประกาศ', () => {
  const board = ['siamraj-sql:TEST001', 'siamraj-pre:TEST001', 'siamraj-sql:OPL6911001'];
  it('เลขที่ซ้ำบนกระดานต้องตรง id เต็ม · เลขที่ไม่ซ้ำยังเทียบเลขที่ได้ (ใบชั่วคราวที่เก็บเป็น sql:)', () => {
    expect([...ambiguousRequestNos(board)]).toEqual(['TEST001']);
    const idx = buildReleaseIndex([{ job_id: 'siamraj-pre:TEST001', request_no: null }, { job_id: 'siamraj-sql:LBM6908001', request_no: null }], [...board, 'siamraj-pre:LBM6908001']);
    expect(idx.has('siamraj-pre:TEST001')).toBe(true);
    expect(idx.has('siamraj-sql:TEST001')).toBe(false);
    expect(idx.has('siamraj-pre:LBM6908001')).toBe(true);
  });
  it('ฝั่งเซิร์ฟเวอร์ (หน้าสาธารณะ · AI) ใช้กติกาเดียวกัน', () => {
    const keys = { ids: new Set(['siamraj-pre:TEST001']), requestNos: new Set(['TEST001']) };
    expect(isReleased(keys, 'siamraj-sql:TEST001')).toBe(true);
    expect(isReleased(keys, 'siamraj-sql:TEST001', new Set(['TEST001']))).toBe(false);
    expect(read('api/_handlers/public/jobs.ts')).toContain('isReleased(keys, String(j.id ?? \'\'), ambiguous)');
    expect(read('api/_handlers/lumos-positions.ts')).toContain('ambiguousRequestNos(items.map(');
  });
});

describe('% แจ้งเข้าไม่เกิน 100%', () => {
  it('คนลงทะเบียนก่อนช่วงแล้วมาแจ้งเข้าในช่วง ไม่นับในตัวตั้งของ %', () => {
    const p = buildChannelPlacement(
      [
        { phone9: '812345601', at: '2026-10-01T03:00:00Z', channel: 'Tiktok', sub: null },
        { phone9: '812345602', at: '2026-11-03T03:00:00Z', channel: 'Tiktok', sub: null },
      ] as never,
      [
        { phone9: '812345601', at: '2026-11-05', requestNo: 'OPL6911001' },
        { phone9: '812345602', at: '2026-11-06', requestNo: 'OPL6911001' },
      ] as never,
      { from: '2026-11-01', to: '2026-11-10' } as never,
    );
    const t = p.rows.find((r) => r.channel === 'Tiktok')!;
    expect([t.registered, t.placed, t.placedInCohort]).toEqual([1, 2, 1]);
  });
});

describe('ตัวเลขหน้าหลัก', () => {
  const page = read('src/pages/HomeOverviewPage.tsx');
  it('การ์ดเงิน: จำนวนใบ + ดูทุกใบ = ชุดเดียวกับยอดเงิน (ใบที่มีเงินในช่วง)', () => {
    expect(page).toContain("left={moneyNow ? `${NUM.format(chargedRows.length)} ใบที่มีผลกระทบ` : '—'}");
    expect(page).toContain("openList('ใบที่เสียเงิน', chargedRows,");
    expect(page).toContain('const buKeyOf = (r: MoneyRequest) => normalizeTrendBu(r.bu) ??');
  });
  it('ช่วงยาว/ทั้งหมด: ขอแบบ all และเทียบกับช่วงที่เซิร์ฟเวอร์ตัดแล้ว', () => {
    expect(page).toContain('rangeWindow(roRange.from, roRange.to, today, roRange.all)');
    expect(page).toContain('fetchRecruitOverview(null, roRange, bu)');
  });
  it('ผล AI บนหน้าหลักใช้ตัวตัดสินเดียวกับภาพรวม (aiBranchOf)', () => {
    const f = read('src/lib/homeOverviewFunnel.ts');
    expect(f).toContain('aiCalled.filter((f) => aiBranchOf(f) === k)');
    expect(f).toContain("row('outOfArea', 'คนละพื้นที่', outOfArea, 'neutral')");
  });
});

describe('อื่น ๆ', () => {
  it('IP: cf-connecting-ip ก่อน · ไม่มีใช้ตัวขวาสุดของ X-Forwarded-For (ตัวซ้ายคนเรียกใส่เองได้)', () => {
    expect(getClientIp({ headers: { 'cf-connecting-ip': '1.1.1.1', 'x-forwarded-for': '9.9.9.9, 2.2.2.2' } })).toBe('1.1.1.1');
    expect(getClientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 2.2.2.2' } })).toBe('2.2.2.2');
  });
  it('ลบติดตามถาวร: สายที่ส่ง AI แล้วต้องยกเลิกก่อน · คิวใบสมัครมีคีย์ applicant · ดูแลหลังเริ่มงานยอดจริง · Lumos มีเพดานเวลา', () => {
    expect(read('api/_handlers/follow.ts')).toContain('สายนี้ส่งให้ AI แล้ว กด "ยกเลิก" ก่อน แล้วค่อยลบ');
    expect(read('api/_lib/callFollowup.ts')).toContain("applicant: `and person_ref like 'app-%'`");
    expect(read('api/_handlers/aftercare.ts')).toContain("total: Number(countRows[0]?.n ?? rows.length)");
    expect(read('api/_lib/lumosPushClient.ts')).toContain('setTimeout(() => ac.abort(');
    expect(read('api/_handlers/home-presence.ts')).toContain("req.user.role === 'admin' ? { mode: 'all' }");
  });
  it('ทางเข้าระบบไม่นับ Lead ชุดเดียวกับการ์ดผู้สมัคร', () => {
    expect(read('api/_lib/homeProportionSql.ts').match(/and not coalesce\(a\.is_lead, false\)/g)).toHaveLength(4);
  });
  it('ไฟล์สำรองที่มีข้อมูลลูกค้าไม่อยู่ใน repo', () => {
    expect(read('.gitignore')).toContain('scrub-locations-backup-*.json');
  });
});
