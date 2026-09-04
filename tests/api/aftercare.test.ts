// @vitest-environment node
/**
 * Phase 7.3-7.6 — หน้า "ดูแลหลังเริ่มงาน" + รอบโทร 3/7/30 + ถัง "เลยนัดยังไม่บันทึกผล"
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. **ไม่รู้วันเริ่มงาน = คำนวณ preset ไม่ได้** → ต้องบอกตรง ๆ ห้ามเดาจากวันที่ย้ายเข้ามา
 * 2. **ไม่ทำระบบโทรใหม่** — รอบโทรใช้โครง Follow เดิม (ต่างแค่ topic)
 * 3. คีย์คนคือ **เบอร์ E.164** (คนเดียวมีหลายรหัสแต่เบอร์เดียว)
 * 4. ตารางยังไม่ migrate = หน้าเปิดได้และบอกว่าว่าง (ไม่ใช่จอพัง)
 * 5. ถัง `overdue_no_result` ต้องเป็น **expression บน alias `a`** เพื่อให้ตัวนับกับ
 *    drill-down ใช้เงื่อนไขเดียวกัน (เทสต์ bucket-parity ใน applicantOverviewSql ครอบต่อ)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AFTERCARE_PRESET_DAYS,
  AFTERCARE_TOPIC,
  aftercareRoundsSummary,
  buildAftercareRounds,
} from '../../src/lib/aftercareRounds.js';
import { OVERVIEW_BUCKETS, isOverviewBucket } from '../../api/_lib/applicantOverviewSql.js';

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/^\s*--.*$/gm, '');

const NOW = new Date('2026-08-23T05:00:00.000Z'); // 12:00 ไทย

describe('รอบโทรหลังเริ่มงาน (7.4)', () => {
  it('preset ตามที่เจ้าของสั่ง 3/7/30 วัน', () => {
    expect([...AFTERCARE_PRESET_DAYS]).toEqual([3, 7, 30]);
  });

  it('คิดวันแบบปฏิทิน — ข้ามเดือนไม่เพี้ยน', () => {
    const rounds = buildAftercareRounds('2026-08-25', NOW);
    expect(rounds.map((r) => r.date)).toEqual(['2026-08-28', '2026-09-01', '2026-09-24']);
  });

  it('🔴 ไม่รู้วันเริ่มงาน = คืนว่าง + ข้อความบอกให้กรอกก่อน (ห้ามเดา)', () => {
    expect(buildAftercareRounds(null, NOW)).toEqual([]);
    expect(buildAftercareRounds(undefined, NOW)).toEqual([]);
    expect(buildAftercareRounds('ไม่ใช่วันที่', NOW)).toEqual([]);
    expect(aftercareRoundsSummary([])).toContain('ยังไม่ระบุวันเริ่มงาน');
  });

  it('รอบที่เลยวันแล้วติดธง overdue (เทียบวันตามปฏิทินกรุงเทพ)', () => {
    const rounds = buildAftercareRounds('2026-08-01', NOW);
    expect(rounds.filter((r) => r.overdue).map((r) => r.days)).toEqual([3, 7]);
    expect(rounds.find((r) => r.days === 30)?.overdue).toBe(false);
    expect(aftercareRoundsSummary(rounds)).toContain('เลยกำหนดแล้ว 2 รอบ');
  });

  it('หัวข้อรอบโทรมีคำเดียวทั้งระบบ', () => {
    expect(AFTERCARE_TOPIC).toBe('ถามความเป็นอยู่หลังเริ่มงาน');
  });
});

describe('เส้น API + migration 107', () => {
  const handler = stripComments(read('api/_handlers/aftercare.ts'));
  const migration = stripComments(read('migrations/107_aftercare.sql'));

  it('คีย์เป็นเบอร์ E.164 ไม่ใช่ id ใบสมัคร', () => {
    expect(migration).toMatch(/phone_e164 text primary key/);
    expect(handler).toContain('toE164Thai');
  });

  it('วันเริ่มงานเป็น date และเป็น null ได้ (ยังไม่รู้)', () => {
    expect(migration).toMatch(/start_date date null/);
  });

  it('กดย้ายซ้ำได้ — upsert ต่อเบอร์ ไม่สร้างซ้ำ', () => {
    expect(handler).toMatch(/on conflict \(phone_e164\) do update/);
  });

  it('ตารางยังไม่ migrate = หน้าเปิดได้และบอกว่าว่าง', () => {
    expect(handler).toContain('migrated: false');
    expect(handler).toContain('isPgUndefinedTable');
  });

  it('ไม่มี FK (ใบขอ/ERP อยู่คนละฐาน)', () => {
    expect(migration).not.toMatch(/references/i);
  });
});

describe('หน้าใหม่ + ทางเข้า', () => {
  it('route /aftercare ประกาศแล้ว', () => {
    const app = read('src/App.tsx');
    expect(app).toContain('AftercarePage');
    expect(app).toMatch(/path="\/aftercare"/);
  });

  it('มีเมนูหลักของตัวเอง ข้าง Follow (เจ้าของเคาะ 23 ส.ค.)', () => {
    const dock = read('src/components/layout/bottom-nav/dockNavConfig.tsx');
    const followAt = dock.indexOf("path: '/follow'");
    const afterAt = dock.indexOf("path: '/aftercare'");
    expect(followAt).toBeGreaterThan(-1);
    expect(afterAt).toBeGreaterThan(followAt);
    expect(dock).toContain("functionId: 'aftercare_read'");
  });

  it('มีสิทธิ์ของตัวเองฝั่งหน้าเว็บ + opl อ่านได้', () => {
    const rf = read('src/lib/roleFunctions.ts');
    expect(rf).toContain("'aftercare_read'");
    expect(rf).toMatch(/path\.startsWith\('\/aftercare'\)/);
  });

  it('🔴 ไม่สร้างระบบโทรใหม่ — ปุ่มตั้งรอบพาไปหน้า Follow', () => {
    const page = stripComments(read('src/pages/aftercare/AftercarePage.tsx'));
    expect(page).toContain('buildFollowPrefillPath');
    expect(page).toContain('AFTERCARE_TOPIC');
    // ห้ามยิงคิว/สายจากหน้านี้เอง
    expect(page).not.toMatch(/dispatchLumos|insertQueue|acquireCallHold/);
  });

  it('กล่อง "โทรครบแล้ว" บนหน้า Follow รับ groups จากหน้าแม่ (ยอด=รายชื่อชุดเดียวกัน)', () => {
    const panel = stripComments(read('src/components/follow/FollowCompletedPanel.tsx'));
    expect(panel).toContain('selectCompletedFollowPeople');
    expect(panel).not.toMatch(/listFollowEntries|fetchFollow/);
    /**
     * 🔴 ต้องเป็น `allGroups` (ชุดเต็ม) **ไม่ใช่** `groups` ที่ผ่านตัวกรองแล้ว
     * (แก้ 3 ก.ย. 2569 — เจ้าของแจ้งว่าแถบส่งไปดูแลหลังเริ่มงานไม่ขึ้น: เดิมแถบกิน
     * กลุ่มที่กรองด้วยแท็บ/วันที่มาแล้ว เปลี่ยนแท็บทีเดียวแถบหายทั้งแถบ
     * ทั้งที่งานยังค้างรอส่งต่ออยู่ · แถบนี้คือคิวงานของทั้งระบบ)
     */
    const page = read('src/pages/follow/FollowPage.tsx');
    expect(page).toMatch(/<FollowCompletedPanel\s+groups=\{allGroups\}/);
    expect(page).toMatch(/const allGroups = useMemo\(\(\) => groupFollowEntries\(items\)/);
  });
});

describe('ถัง "เลยนัดยังไม่บันทึกผล" (7.6)', () => {
  it('เป็นถังที่ระบบรู้จัก → drill-down ?bucket= ใช้ได้', () => {
    expect(isOverviewBucket('overdue_no_result')).toBe(true);
  });

  it('เป็น expression บน alias a (ไม่ใช่ CTE) และนับ rescheduled เป็นยังไม่มีผล', () => {
    const cond = OVERVIEW_BUCKETS.overdue_no_result;
    expect(cond).toContain('a.id');
    expect(cond).toContain('< now()');
    expect(cond).toContain("'rescheduled'");
    expect(cond).not.toMatch(/\bwith\b/i);
  });

  it('เลขบนจอกดได้จริง (RmWorkspace ตั้ง bucket ให้)', () => {
    const ws = stripComments(read('src/components/recruit-rm/RmWorkspace.tsx'));
    expect(ws).toContain("params.set('bucket', 'overdue_no_result')");
  });

  it('มีป้ายไทยของถัง (ห้ามโชว์ชื่อคีย์ดิบบนจอ)', () => {
    const labels = read('src/lib/recruitRmOverviewApi.ts');
    expect(labels).toMatch(/overdue_no_result: 'เลยวันนัด/);
  });
});
