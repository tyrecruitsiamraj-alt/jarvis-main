/**
 * ═══ การ์ดกดลงลึกทุกแท็บของภาพรวม (เจ้าของ 21 ต.ค. 2569 · ไอเดียเพื่อน "ทั้ง 4 tab ทำแบบนั้นเลย") ═══
 * 🔴 ลูกทุกชั้นรวมกันเท่าแม่ · ปลายทางมีรายชื่อ/ใบขอให้กดดู
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { drillTreeOf, nodeAt, type DrillNode } from '@/lib/recruitDrill';
import type { RecruitAppFact, RecruitRequestItem } from '@/lib/recruitOverviewTypes';

const f = (id: string, x: Partial<RecruitAppFact>) => ({ id, createdAt: '2026-10-20T03:00:00Z', calledByAi: false, contact: null, contactBy: null, aiAnswer: null, aiAnswerAt: null, staffLastAt: null, appointmentAt: null, attendance: null, ...x }) as unknown as RecruitAppFact;
const facts: RecruitAppFact[] = [
  f('a', { calledByAi: true, contact: 'success', contactBy: 'ai', aiAnswer: 'said_yes', aiAnswerAt: '2026-10-20T04:00:00Z', staffLastAt: '2026-10-20T05:00:00Z', appointmentAt: '2026-10-22T04:00:00Z', attendance: 'showed' }),
  f('b', { calledByAi: true, contact: 'failed' }),
  f('c', { calledByAi: true, aiAnswer: 'said_yes', aiAnswerAt: '2026-10-20T04:00:00Z', appointmentAt: '2026-10-23T04:00:00Z' }),
  f('d', {}),
];
const req = (no: string, released: boolean, apps: number, open = true): RecruitRequestItem => ({ jobId: `j-${no}`, requestNo: no, unitName: 'หน่วย', position: 'ขับรถ', day: '2026-10-20', released, open, applications: apps, appIds: Array.from({ length: apps }, (_, i) => `${no}-${i}`) });

function sumsMatch(n: DrillNode): void {
  if (!n.children) return;
  // นัดหมาย: มา/ไม่มา/เลื่อน/รอผล ครบทุกแบบ · อื่น ๆ แบ่งสองทาง
  expect(n.children.reduce((s, c) => s + c.count, 0)).toBe(n.count);
  n.children.forEach(sumsMatch);
}

describe('drillTreeOf', () => {
  it('🔴 ทุกแท็บ ลูกรวมกันเท่าแม่ทุกชั้น', () => {
    const requests = [req('A', true, 2), req('B', true, 0), req('C', false, 0), req('D', false, 0, false)];
    for (const t of ['requests', 'apps', 'staff', 'appt'] as const) {
      const root = drillTreeOf(t, facts, requests)!;
      sumsMatch(root);
    }
  });

  it('ใบขอตามลำดับเพื่อนเจ้าของ: ทั้งหมด → ประกาศ/ยังไม่ประกาศ → มีคนกรอก/ยังไม่กรอก → ใบขอ → รายชื่อ', () => {
    const root = drillTreeOf('requests', [], [req('A', true, 2), req('B', true, 0), req('C', false, 0)])!;
    expect([root.label, root.count]).toEqual(['ใบขอเข้ามา', 3]);
    const { node } = nodeAt(root, ['released', 'withApps']);
    expect([node.label, node.count]).toEqual(['มีคนกรอก', 1]);
    expect(node.requests?.[0].appIds).toEqual(['A-0', 'A-1']);
    expect(nodeAt(root, ['released', 'noApps']).node.requests?.map((r) => r.requestNo)).toEqual(['B']);
  });

  it('ผู้สมัคร: ปลายทางมี id ให้เปิดรายชื่อ', () => {
    const apps = drillTreeOf('apps', facts, null)!;
    expect(nodeAt(apps, ['ai', 'reached']).node.ids).toEqual(['a']);
    expect(nodeAt(drillTreeOf('appt', facts, null)!, ['pending']).node.ids).toEqual(['c']);
    expect(drillTreeOf('requests', facts, null)).toBeNull();
  });

  it('เส้นทางผิด = ตัดที่ชั้นที่ยังเจอ', () => {
    const root = drillTreeOf('apps', facts, null)!;
    expect(nodeAt(root, ['ai', 'ไม่มี']).trail.map((t) => t.key)).toEqual(['names', 'ai']);
  });
});

describe('หน้าจอ', () => {
  it('ทุกแท็บมีกราฟเส้น + การ์ดกดลงลึก · มีแถบย้อนกลับ', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src/components/dashboard-trends/RecruitOverview.tsx'), 'utf8');
    for (const t of ['requests', 'apps', 'staff', 'appt']) expect(src).toContain(`{compareCard('${t}')}`);
    for (const t of ['apps', 'staff', 'appt']) expect(src).toMatch(new RegExp(`drillCard\\('${t}'`));
    // แท็บใบขอ: การ์ดกดลงลึกฝังในการ์ดแนวโน้มใบขอ — กดกล่องแล้วรายการใบขอขึ้นใต้กราฟ (27 ต.ค. 2569)
    expect(src).toContain('path={REQUEST_DRILL_PATH[reqPick]}');
    const card = fs.readFileSync(path.join(process.cwd(), 'src/components/dashboard-trends/DrillDownCard.tsx'), 'utf8');
    expect(card).toContain('data-testid="drill-trail"');
  });
});

describe('เลขกราฟ = เลขการ์ด (21 ต.ค. 2569 เจอบนเว็บจริง 63 กับ 62)', () => {
  it('ชิป "ติดต่อได้" ใช้นิยามเดียวกับลูกในการ์ด · แท็บการติดต่อใช้ตัวแบ่งเดียวกับกล่องบนแท็บ', async () => {
    const { compareRowsOf } = await import('@/lib/recruitCompare');
    const { totalsOf } = await import('@/lib/recruitOverview');
    const withStaff = [...facts, f('e', { contact: 'success', contactBy: 'staff', staffLastAt: '2026-10-20T05:00:00Z' })];
    const tot = totalsOf(withStaff, '2026-10-01', '2026-10-31');
    const apps = compareRowsOf('apps', tot, null, null, null).find((r) => r.label === 'ติดต่อได้')!;
    expect(apps.cur).toBe(nodeAt(drillTreeOf('apps', withStaff, null)!, ['ai', 'reached']).node.count);
    // 29 ต.ค. 2569 การ์ดเทียบแท็บการติดต่อ = "สนใจ · รอโทร · ติดต่อได้" ตัวแบ่งเดียวกับกล่องบนแท็บ (`buildContactRows`)
    const { buildContactRows } = await import('@/lib/recruitContactTab');
    const top = buildContactRows(withStaff, new Date()).total;
    const row = (label: string) => compareRowsOf('staff', tot, null, null, null).find((r) => r.label === label)!.cur;
    expect([row('สนใจ'), row('รอโทร'), row('ติดต่อได้')]).toEqual([top.total, top.counts.waiting, top.ok]);
  });
});

describe('ใบขอเข้ามา = เลขเดียวกับหน้าหลัก แตกแบบทีม Online (เจ้าของ 21 ต.ค. 2569 โหวตข้อ B)', () => {
  it('ทั้งหมด = ประกาศแล้ว + ยังไม่ประกาศ (ใบยังเปิด) + ไม่ได้ประกาศ (จบไปแล้ว) · ใบจบนับอย่างเดียว ไม่เปิดรายการ', () => {
    const root = drillTreeOf('requests', [], [req('A', true, 1), req('B', false, 0), req('LBM6910003', false, 0, false), req('LBM6910004', false, 0, false)])!;
    expect(root.count).toBe(4);
    expect(root.children!.map((c) => [c.key, c.label, c.count])).toEqual([
      ['released', 'ประกาศแล้ว', 1],
      ['notReleased', 'ยังไม่ประกาศ (ใบยังเปิด)', 1],
      ['ended', 'ไม่ได้ประกาศ (จบไปแล้ว)', 2],
    ]);
    const ended = nodeAt(root, ['ended']).node;
    expect(ended.countOnly).toBe(true);
    expect(ended.requests).toBeUndefined();
    expect(nodeAt(root, ['notReleased']).node.requests!.map((r) => r.requestNo)).toEqual(['B']);
  });
  it('API นับทุกใบที่เข้ามา + ส่งธงเปิด/จบ (ตัวตัดสินเดียวกับทีม Online)', () => {
    const api = fs.readFileSync(path.join(process.cwd(), 'api/_handlers/recruit-overview.ts'), 'utf8');
    expect(api).toContain("open: onlineRequestStateOf(r) === 'open'");
    expect(api).not.toContain('loadClosedRequestNos');
    expect(api).toContain('body.requestDays = toRequestDays(reqR.value)');
  });
});

describe('ตารางใบขอในการ์ดกดลงลึก แบ่งหน้าละ 10 (เจ้าของ 28 ต.ค. 2569 "ทำเป็น pagination ไม่เกิน 10 รายการก็พอ")', () => {
  it('หน้าละ 10 ใบ · มีปุ่มก่อนหน้า/ถัดไป · เปลี่ยนชั้น = กลับหน้าแรก', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/components/dashboard-trends/DrillDownCard.tsx', 'utf8');
    expect(src).toContain('const REQUEST_PAGE = 10;');
    expect(src).toContain('requests.slice(cur * REQUEST_PAGE, (cur + 1) * REQUEST_PAGE)');
    expect(src).toContain('data-testid="drill-requests-pages"');
    expect(src).toContain("<DrillRequestTable key={trail.map((t) => t.label).join('|')}");
  });
});
