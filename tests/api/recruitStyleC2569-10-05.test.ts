/**
 * ═══ หน้างานสรรหา แบบ C "การ์ดเดิมแต่กระชับ" ทุกแท็บ (เจ้าของเคาะ 5 ต.ค. 2569) ═══
 *
 * > *"หน้า ผู้สมัคร มีแค่ * เพิ่มข้อมูลผู้สมัคร * นำเข้า Excel * เก็บไปโทรเอง * ส่ง Ai โทร * รายงาน — ดูที่ยกเลิกไม่ต้องมีโชว์"*
 * > *"การติดต่อ ไม่ต้องมีคำว่าเก็บไปโทรเองแล้ว แต่ถ้าติ๊ก Lead ให้มีคำว่า ถอยLead ขึ้นมา แล้วมันจะถูกย้ายไป หน้า ผู้สมัคร"*
 *
 * (สแกนโค้ดหลังตัดคอมเมนต์ — คอมเมนต์เล่าประวัติด้วยคำเก่าโดยตั้งใจ)
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  APPOINTMENT_CHIPS,
  appointmentChipCount,
  buildAppointmentBoard,
  isInAppointmentChip,
} from '@/lib/appointmentBoard';

const ROOT = path.resolve(__dirname, '../..');
const code = (rel: string) =>
  fs
    .readFileSync(path.join(ROOT, rel), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const BAR = code('src/components/recruit-rm/RmSearchBar.tsx');
const WS = code('src/components/recruit-rm/RmWorkspace.tsx');
const HEADER = code('src/components/jobs/BoardReleaseHeader.tsx');

describe('แถวเครื่องมือรายแท็บ', () => {
  it('🔴 ปุ่มบนแถวเครื่องมือมีแค่ชุดที่เจ้าของสั่ง — ไม่มีเก็บ Lead / ลบ Lead / คลังสำรอง / ดูที่ยกเลิก', () => {
    for (const gone of ["'เก็บ Lead'", "'ลบ Lead'", 'LEAD_VIEW_LABEL', 'ดูที่ยกเลิก', 'onToggleCancelledView', 'onToggleLeadView']) {
      expect(BAR, gone).not.toContain(gone);
    }
    for (const label of ['เพิ่มข้อมูลผู้สมัคร', 'นำเข้า Excel', 'เก็บไปโทรเอง', 'ส่ง AI โทร', 'รายงาน', 'ถอย Lead', 'โหลดเป็น PDF']) {
      expect(BAR, label).toContain(label);
    }
    expect(WS).not.toContain('onToggleCancelledView');
  });

  it('ผู้สมัคร = 5 ปุ่ม: เพิ่ม · นำเข้า · เก็บไปโทรเอง · ส่ง AI · รายงาน', () => {
    expect(WS).toContain("onAddApplicant={tab === 'candidates' ?");
    expect(WS).toContain("onImportApplicants={tab === 'candidates' ?");
    expect(WS).toContain("onHoldSelected={tab === 'candidates' ?");
    expect(WS).toContain("onExport={tab === 'candidates' ?");
    expect(WS).toContain('onSendAiSelected={() => askSendAi(selectedIds)}');
  });

  it('🔴 การติดต่อไม่มี "เก็บไปโทรเอง" · ติ๊กแล้วมี "ถอย Lead" = ส่งกลับแท็บผู้สมัคร (เส้นเดียวกับปุ่มบนแถว)', () => {
    expect(WS).not.toMatch(/onHoldSelected=\{\(\) =>/);
    expect(WS).toContain("onReleaseSelected={tab === 'contact' ?");
    expect(BAR).toMatch(/onReleaseSelected && selectedCount > 0 \?/);
    expect(WS).toMatch(/chooseApplicationCall\(selectedIds, 'release'\)/);
  });

  it('ลิงก์เก่า ?lead=1 / ?cancelled=1 ยังมีทางกลับรายชื่อหลัก', () => {
    expect(WS).toContain('leadView || cancelledView ?');
    expect(WS).toContain('leadView ? setLeadView(false) : setCancelledView(false)');
  });
});

describe('ชิปกรองหัวแท็บ (แทนกล่องตัวเลข)', () => {
  it('ทุกแท็บของ RmWorkspace ใช้ FilterChips ตัวเดียวกัน · ถัง drill-down ไม่มีชิป', () => {
    expect(WS.match(/<FilterChips/g)?.length).toBe(3);
    expect(WS).toContain("!bucket && tab === 'candidates'");
    expect(WS).toContain("!bucket && tab === 'contact'");
    expect(WS).toContain("!bucket && tab === 'appointments'");
    // กล่องตัวเลข 4 ใบของนัดหมายถอดแล้ว — ตารางรายวันกางจากปุ่ม
    expect(WS).not.toContain('grid grid-cols-2 gap-2 sm:grid-cols-4');
    expect(WS).toContain('showAppointmentDays ?');
  });

  it('ชิปนัด: มา + ไม่มา + รอผล = นัดทั้งหมด · แถวที่กรองตรงกับเลขบนชิป', () => {
    const rows = [
      { appointment_at: '2026-10-01T05:00:00Z', attendance_result: 'showed' },
      { appointment_at: '2026-10-01T05:00:00Z', attendance_result: 'no_show' },
      { appointment_at: '2026-10-02T05:00:00Z', attendance_result: 'rescheduled' },
      { appointment_at: '2026-10-02T05:00:00Z', attendance_result: null },
    ];
    const board = buildAppointmentBoard(rows);
    const n = (id: (typeof APPOINTMENT_CHIPS)[number]['id']) => appointmentChipCount(board, id);
    expect(n('showed') + n('no_show') + n('pending')).toBe(n('all'));
    for (const c of APPOINTMENT_CHIPS) {
      expect(rows.filter((r) => isInAppointmentChip(r, c.id)).length, c.id).toBe(n(c.id));
    }
  });

  it('🔴 โพสต์ประกาศ: การ์ดตัวเลข 3 ใบ → ชิป · เลนครบ 7 อันยังกดได้', () => {
    expect(HEADER).not.toContain('KpiCard');
    expect(HEADER).not.toContain('<Card');
    for (const lane of ['all', 'released', 'unreleased', 'applied', 'silent', 'sourcing', 'started']) {
      expect(HEADER, lane).toContain(`laneKey="${lane}"`);
    }
  });
});
