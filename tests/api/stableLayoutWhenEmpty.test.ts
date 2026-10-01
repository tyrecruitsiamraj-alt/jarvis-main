/**
 * ═══ ว่างแล้วห้ามหาย/ห้ามเปลี่ยนทรง — "ถ้าไม่มีข้อมูลก็เป็น 0 ไป" (เจ้าของสั่ง 1 ต.ค. 2569 + "ฝากเช็คทั้งระบบด้วยนะ") ═══
 *
 * เจ้าของเจอที่หน้าติดตาม: สลับแท็บรายชื่อติดตาม ↔ ติดตามส่งคนแทน แล้ว "ขั้นตอนของสาย" หุบหาย หน้าย่อ/ขยายเอง
 * กติกา: การ์ด/กราฟ/ตาราง/วงกลมที่มีทรงตายตัว **อยู่เสมอ** ว่างก็เป็น 0 หรือแถว "ไม่มี…" ในตาราง
 * (รายการที่ยาวตามข้อมูล เช่นรายชื่อ ยังเป็นข้อความสั้นแทนรายการได้ · แจ้งเตือน/ข้อผิดพลาดยังโผล่ตามเหตุการณ์ได้)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

describe('ทั้งระบบ: ว่างแล้วทรงเดิม', () => {
  it('หน้าติดตาม — ขั้นตอนของสายไม่หุบ · แถวสัญญาณจองที่ · วงกลมอยู่เสมอ · ตารางมีหัวเสมอ · ไม่มีกล่องว่างท้ายหน้า', () => {
    const panel = read('src/components/follow/FollowCallRoundsPanel.tsx');
    expect(panel).not.toContain('const allEmpty');
    expect(panel).toContain('className="invisible text-[11.5px] font-medium"');
    const cal = read('src/components/follow/FollowPlanningCalendar.tsx');
    expect(cal).not.toContain('ยังไม่มีผลเดือนนี้');
    expect(cal).not.toContain('วันที่เลือกไม่มีสายที่ต้องตาม');
    expect(cal).not.toContain('monthRows.length === 0 ? (\n            <p');
    expect(cal).toContain('<Donut percent={microRates.successRate ?? 0}');
    expect(read('src/pages/follow/FollowPage.tsx')).not.toContain('>ยังไม่มีรายชื่อที่ต้องติดตาม<');
  });

  it('หน้าหลัก — แผงผลโทรไม่สลับเป็น "ช่วงนี้ยังไม่มีผลโทร" · แถบไม่หารศูนย์', () => {
    const p = read('src/components/home-ai-share/HomeCallResultsPanel.tsx');
    expect(p).not.toContain('ช่วงนี้ยังไม่มีผลโทร');
    expect(p).toContain('table.total > 0 ? (r.ai / table.total) * 100 : 0');
  });

  it('กล่องงาน › ภาพรวม — เส้นทางของรายชื่อ/กรอกแล้วโทรวันไหนเป็น 0 · ตารางรายวัน/ช่องทางมีหัวเสมอ', () => {
    const o = read('src/components/dashboard-trends/RecruitOverview.tsx');
    expect(o).not.toContain('apps && cur.names > 0 ?');
    const parts = read('src/components/dashboard-trends/RecruitOverviewParts.tsx');
    const channelFn = parts.slice(parts.indexOf('export function ChannelTable'), parts.indexOf('export function PositionList'));
    expect(channelFn).not.toContain('return <EmptyNote>');
    expect(parts).not.toContain('withNames.length === 0 ? (\n          <EmptyNote>');
  });

  it('ทีม Online — วงกลม BU วาดเสมอ (ว่าง = วงเทา) · ตาราง "ติดตรงไหน" มีหัวเสมอ', () => {
    const d = read('src/components/team-online/BuDonut.tsx');
    expect(d).toContain('const emptyRing = total <= 0;');
    expect(d).not.toContain("<p className={cn('py-10 text-center text-sm', DASH.muted)}>{empty}</p>");
    expect(read('src/components/team-online/TeamOnlineSections.tsx')).not.toContain(
      "funnel.length === 0 ? (\n        empty('ยังไม่มีใบขอเข้าในช่วงนี้')",
    );
  });

  it('ดูแลหลังเริ่มงาน — ปฏิทินอยู่เสมอ · เดือนว่างยังมีหัวตาราง', () => {
    expect(read('src/components/aftercare/AftercarePlanningCalendar.tsx')).not.toContain('เดือนนี้ไม่มีใครถึงกำหนดโทรเลย');
    expect(read('src/pages/aftercare/AftercarePage.tsx')).not.toContain('!loading && open.length > 0 ? (');
  });

  it('Dashboard — กราฟฉุกเฉิน/ล่วงหน้าหายเฉพาะตอนข้อมูลยังไม่มา ไม่ใช่ตอนตัวกรองไม่เหลือใบ', () => {
    expect(read('src/pages/dashboard/SupervisorDashboard.tsx')).toContain(
      'if (DEMO_MODE || throughputRecords.length === 0) return null;',
    );
  });
});
