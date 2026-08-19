import { describe, it, expect } from 'vitest';
import {
  ROSTER_BU_KEYS,
  rosterBuLabel,
  entriesForBu,
  entryInBu,
  countRosterByBu,
  paginate,
  entriesOfKind,
} from '../../src/lib/rosterBuGroups';
import type { JobStaffManageState, RosterEntry } from '../../src/lib/jobStaffRemote';

/**
 * drill-down ราย BU + pagination (เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ-7)
 */

const e = (name: string, bu: string | null): RosterEntry => ({ name, bu });

describe('entryInBu / entriesForBu — จับคู่ BU แบบ exact', () => {
  it('รหัส BU ตรงตัว · null = กล่อง none (ไม่รวมกันข้าม BU)', () => {
    expect(entryInBu(e('ก', 'LBD'), 'LBD')).toBe(true);
    expect(entryInBu(e('ก', 'LBD'), 'LBA')).toBe(false);
    expect(entryInBu(e('ข', null), 'none')).toBe(true);
    expect(entryInBu(e('ข', null), 'LBD')).toBe(false); // 🔴 null ไม่โผล่ในกล่อง BU จริง
    expect(entryInBu(e('ก', 'LBD'), 'none')).toBe(false);
  });

  it('entriesForBu กรองเฉพาะของ BU นั้น', () => {
    const list = [e('ก', 'LBD'), e('ข', 'LBA'), e('ค', null), e('ง', 'LBD')];
    expect(entriesForBu(list, 'LBD').map((x) => x.name)).toEqual(['ก', 'ง']);
    expect(entriesForBu(list, 'none').map((x) => x.name)).toEqual(['ค']);
  });
});

describe('ROSTER_BU_KEYS ครบ 5 BU + none', () => {
  it('มี SN/DS/LM/LBA/LBD + none และ none อยู่ท้ายสุด', () => {
    expect(ROSTER_BU_KEYS).toEqual(['SN', 'DS', 'LM', 'LBA', 'LBD', 'none']);
    expect(rosterBuLabel('LBD')).toBe('LBD');
    expect(rosterBuLabel('none')).toBe('ไม่ระบุ BU');
  });
});

describe('countRosterByBu — จำนวนต่อ BU แยกบทบาท', () => {
  const state: JobStaffManageState = {
    recruiters: [e('r1', 'LBD'), e('r2', 'LBD'), e('r3', 'LBA')],
    screeners: [e('s1', 'LBD'), e('s2', null)],
    opls: [e('o1', 'LBA')],
    onlines: [e('n1', 'LBD'), e('n2', null)],
  };

  it('รวมยอดต่อ BU ถูกต้อง', () => {
    const byBu = countRosterByBu(state);
    const lbd = byBu.find((b) => b.key === 'LBD')!;
    expect(lbd).toMatchObject({ recruiter: 2, screener: 1, opl: 0, online: 1, total: 4 });
    const lba = byBu.find((b) => b.key === 'LBA')!;
    expect(lba).toMatchObject({ recruiter: 1, screener: 0, opl: 1, online: 0, total: 2 });
    const none = byBu.find((b) => b.key === 'none')!;
    expect(none).toMatchObject({ screener: 1, online: 1, total: 2 });
  });

  it('entriesOfKind map ถูกบทบาท', () => {
    expect(entriesOfKind(state, 'recruiter')).toBe(state.recruiters);
    expect(entriesOfKind(state, 'online')).toBe(state.onlines);
  });
});

describe('paginate — หน้าละ 10', () => {
  const items = Array.from({ length: 23 }, (_, i) => i + 1);

  it('แบ่ง 23 รายการเป็น 3 หน้า (10/10/3)', () => {
    expect(paginate(items, 1).items).toHaveLength(10);
    expect(paginate(items, 1).pageCount).toBe(3);
    expect(paginate(items, 2).items[0]).toBe(11);
    expect(paginate(items, 3).items).toEqual([21, 22, 23]);
  });

  it('🔴 บีบ page เกินช่วงเสมอ — ลบคนจนหน้าท้ายว่างต้องไม่เห็นหน้าเปล่า', () => {
    expect(paginate(items, 99).page).toBe(3);
    expect(paginate(items, 0).page).toBe(1);
    expect(paginate(items, -5).page).toBe(1);
  });

  it('ลิสต์ว่าง = 1 หน้า ไม่มีของ (pageCount ต่ำสุด 1)', () => {
    const p = paginate([], 1);
    expect(p).toMatchObject({ items: [], page: 1, pageCount: 1, total: 0 });
  });

  it('size ปรับได้', () => {
    expect(paginate(items, 1, 5).pageCount).toBe(5);
  });
});
