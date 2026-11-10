// @vitest-environment node
/**
 * ช่วงเดียวกันทุกส่วนของโฉมต้นแบบ (ชุดส่งต่อ 10 พ.ย. 2569 · G01/G03/G04)
 * - ปุ่มรายงานเดิมพาช่วง + BU ไป · หน้าภาพรวมเปิดที่ช่วงจากลิงก์
 * - เปลี่ยนช่วง/BU = ปิดแผง/รายใบ/รายชื่อที่เปิดค้าง · รอบสดชุดเดิมไม่ล้างเลข (ไม่กระพริบ)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { legacyReportsPath, rangeFromParams } from '@/lib/jobNavigation';

describe('รายงานเดิมพาช่วงไปด้วย', () => {
  it('ช่วง + BU อยู่ในลิงก์ และอ่านกลับได้ช่วงเดิม', () => {
    const p = legacyReportsPath({ from: '2026-10-01', to: '2026-10-31' }, 'LBD');
    expect(p).toBe('/jobs/board?view=dashboard&dash=cards&from=2026-10-01&to=2026-10-31&bu=LBD');
    const q = new URL(`http://x${p}`).searchParams;
    expect(rangeFromParams(q)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(q.get('bu')).toBe('LBD');
  });
  it('ไม่มี BU (ทุก BU ในสิทธิ์) = ไม่ใส่ bu', () => {
    expect(legacyReportsPath({ from: '2026-11-01', to: '2026-11-10' }, null)).not.toContain('bu=');
  });
  it('ภาพรวมงานสรรหาเปิดที่ช่วง/BU จากลิงก์ · ปุ่มรายงานเดิมใช้ช่วงที่ดูอยู่', () => {
    const ov = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
    expect(ov).toContain('useState<(DateRangeYmd & { all?: boolean }) | null>(() => rangeFromParams(searchParams))');
    expect(ov).toContain("useState<string | null>(() => searchParams.get('bu') || null)");
    const body = readFileSync('src/components/dashboard-trends/stuck/RecruitStuckBody.tsx', 'utf8');
    expect(body).toContain('navigate(legacyReportsPath(win, data.bu, requestFilterToParams(filter)))');
    expect(body).not.toContain("navigate('/jobs/board?view=dashboard&dash=cards')");
  });
});

describe('หน้าหลักโฉมต้นแบบ: เปลี่ยนช่วงแล้วของเก่าไม่ค้าง', () => {
  const page = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');
  it('เปลี่ยนช่วง/BU ปิดแผง รายใบ (ทั้งชั้น) และรายชื่อ', () => {
    const block = page.slice(page.indexOf('const openedKey = useRef(dataKey);'), page.indexOf('}, [dataKey]);'));
    for (const s of ['setPanel(null)', 'setNames(null)', 'setFollowNames(null)', 'drill.close()']) expect(block).toContain(s);
  });
  it('ดูแลหลังเริ่มงาน/จับคู่งาน: ล้างเฉพาะตอนเปลี่ยนช่วง · ล้ม = บอกว่าอ่านไม่ได้ ไม่ใช่ 0', () => {
    const clear = page.slice(page.indexOf('if (shownKey.current !== dataKey) {'), page.indexOf('setMoneyError(null);'));
    expect(clear).toContain('setAiV5(null)');
    const load = page.slice(page.indexOf('if (v5) {'), page.indexOf('fetchRecruitOverview(null, range, bu)'));
    expect(load).not.toContain('setAiV5(null)');
    expect(load).toContain('setAiV5Error(friendlyErrorText(');
  });
});

describe('โฉม Codex = ค่าเริ่ม (เจ้าของ 10 พ.ย. 2569 Choice "ใช้โฉม Codex เป็นค่าเริ่ม" · คงแถบบนเดิม)', () => {
  it('หน้าหลักไม่ส่ง ?home = v5 · โฉมก่อนหน้า ?home=overview · ภาพรวมงานสรรหาไม่ส่ง dash = v5 · โฉมก่อนหน้า &dash=prev', () => {
    const v = readFileSync('src/lib/homeV3.ts', 'utf8');
    expect(v).toContain("if (typeof window === 'undefined') return 'v5';");
    expect(v).toContain(": v === 'classic' ? 'classic' : 'v5';");
    const ov = readFileSync('src/components/dashboard-trends/RecruitOverview.tsx', 'utf8');
    expect(ov).toContain("const v5 = !legacyCards && searchParams.get('dash') !== 'prev';");
  });
});
