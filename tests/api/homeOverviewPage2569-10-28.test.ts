import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** เจ้าของ 28 ต.ค. 2569: หน้าหลักสรุปหน้าเดียว — บนลงล่าง ซ้ายไปขวา · ถอดแท็บ · กดแล้วแผง + ไปหน้าเต็ม */
const page = readFileSync('src/pages/HomeOverviewPage.tsx', 'utf8');

describe('หน้าหลักสรุปหน้าเดียว', () => {
  it('เรียงส่วนตามที่เคาะ: ตอนนี้ → ใบขอ → ผู้สมัคร (9 พ.ย. 2569 ประกาศ → ภาพรวม · ติดตาม/ดูแล → หน้าติดตาม)', () => {
    for (const id of ['overview-release', 'overview-follow', 'overview-aftercare']) expect(page).not.toContain(`"${id}"`);
    const ids = ['overview-kpis', 'overview-requests', 'overview-funnel'];
    const at = ids.map((id) => page.indexOf(`"${id}"`));
    for (const i of at) expect(i).toBeGreaterThan(0);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it('แท็บมีแค่ ภาพรวม · สัดส่วน (เจ้าของสั่งเพิ่ม 28 ต.ค. 2569) · ค่าเริ่มเดือนนี้ · แผงมีปุ่มไปหน้าเต็ม', () => {
    // 2 แท็บต่อโฉม × 2 โฉม (หน้าหลักสรุป + โฉมต้นแบบ ?home=v5 · 10 พ.ย. 2569) — คำเดียวกัน ภาพรวม · สัดส่วน
    expect(page.match(/<TabsTrigger value=/g)?.length).toBe(4);
    expect(page.match(/<TabsTrigger value="proportion"/g)?.length).toBe(2);
    expect(page).toContain("useState<'overview' | 'proportion'>('overview')");
    expect(page).toContain('thisMonthWindow(today)');
    expect(readFileSync('src/components/home-overview/OverviewParts.tsx', 'utf8')).toContain('ไปหน้าเต็ม · {panel.go.label}');
    for (const to of ["'/jobs/list'", "'/jobs/board?view=list'", "'/follow'", "'/aftercare'"]) expect(page).toContain(to);
  });
  it('สมการลงตัวบนจอ · ไม่มี "ไม่ระบุ" ในช่องทาง', () => {
    expect(page).toContain('= เหลือหา ${NUM.format(flow.remainingRequests)} ใบ');
    expect(readFileSync('src/components/dashboard-trends/stuck/ReleaseProgressCard.tsx', 'utf8')).toContain('มีคนกรอก {fmt(withApps.length)} + ไม่มี {fmt(noApps.length)} = {fmt(released.length)}');
    expect(readFileSync('src/lib/homeOverviewFunnel.ts', 'utf8')).not.toContain("'ไม่ระบุ'");
  });
});
