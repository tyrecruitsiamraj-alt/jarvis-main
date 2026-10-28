import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** เจ้าของ 28 ต.ค. 2569: หน้าหลักสรุปหน้าเดียว — บนลงล่าง ซ้ายไปขวา · ถอดแท็บ · กดแล้วแผง + ไปหน้าเต็ม */
const page = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');

describe('หน้าหลักสรุปหน้าเดียว', () => {
  it('เรียงส่วนตามที่เคาะ: ตอนนี้ → ใบขอ → ประกาศ → ผู้สมัคร → ติดตาม · ดูแล', () => {
    const ids = ['overview-kpis', 'overview-requests', 'overview-release', 'overview-funnel', 'overview-follow', 'overview-aftercare'];
    const at = ids.map((id) => page.indexOf(`"${id}"`));
    for (const i of at) expect(i).toBeGreaterThan(0);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it('ไม่มีแท็บ · ค่าเริ่มเดือนนี้ · แผงมีปุ่มไปหน้าเต็ม', () => {
    expect(page).not.toContain('TabsList');
    expect(page).toContain('thisMonthWindow(today)');
    expect(readFileSync('src/components/home-overview/OverviewParts.tsx', 'utf8')).toContain('ไปหน้าเต็ม · {panel.go.label}');
    for (const to of ["'/jobs/list'", "'/jobs/board?view=list'", "'/follow'", "'/aftercare'"]) expect(page).toContain(to);
  });
  it('สมการลงตัวบนจอ · ไม่มี "ไม่ระบุ" ในช่องทาง', () => {
    expect(page).toContain('= เหลือหา ${NUM.format(flow.remainingRequests)} ใบ');
    expect(page).toContain('มีคนกรอก ${NUM.format(req.releasedWithApps)} + ไม่มี ${NUM.format(req.releasedNoApps)} = ${NUM.format(req.released)}');
    expect(readFileSync('src/lib/homeOverviewFunnel.ts', 'utf8')).not.toContain("'ไม่ระบุ'");
  });
});
