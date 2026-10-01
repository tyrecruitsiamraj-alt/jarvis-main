/**
 * ปุ่ม BU ของตั้งค่า › ผู้ใช้งาน (เจ้าของสั่ง 1 ต.ค. 2569 · Choice "ปุ่มเลือก BU")
 * 🔴 ด่าน: BU = แผนกของบัญชี (นิยามเดียวกับสถานะ Online) · ลำดับชุดแผนก · ยังไม่ตั้งท้ายสุด ·
 *    รวมทุก BU = ทั้งหมด · ปุ่มที่กดค้างไม่หายตอนเหลือ 0
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { USER_BU_ALL, matchesUserBu, userBuChips, userBuOf } from './userBuFilter';
import { compareBu, countPresenceByBu, type PresencePerson } from './homePresence';

const u = (department_code: string | null) => ({ department_code });

describe('userBuOf — BU ของบัญชี = แผนก', () => {
  it('ตัวพิมพ์/ช่องว่างไม่มีผล · รหัส BU จากไซต์แปลงเป็นแผนก · ว่าง = ยังไม่ตั้ง', () => {
    expect(userBuOf(u('lbd '))).toBe('LBD');
    expect(userBuOf(u('LML'))).toBe('LM');
    expect(userBuOf(u(null))).toBe('');
    expect(userBuOf({})).toBe('');
  });

  it('กรอง: ทั้งหมดผ่านทุกคน · ยังไม่ตั้ง = เฉพาะคนที่ไม่มีแผนก', () => {
    expect(matchesUserBu(u('LBA'), USER_BU_ALL)).toBe(true);
    expect(matchesUserBu(u(null), USER_BU_ALL)).toBe(true);
    expect(matchesUserBu(u('LBA'), 'LBA')).toBe(true);
    expect(matchesUserBu(u('LBA'), 'LBD')).toBe(false);
    expect(matchesUserBu(u(null), '')).toBe(true);
    expect(matchesUserBu(u('DS'), '')).toBe(false);
  });
});

describe('userBuChips — แถวปุ่ม BU', () => {
  const users = [u('LBD'), u('LBD'), u('LBA'), u('DS'), u('LM'), u(null), u('LBD')];

  it('ทั้งหมด → ชุดแผนก (LBD · LBA · LM · DS) → ยังไม่ตั้งท้ายสุด · เฉพาะ BU ที่มีคน', () => {
    expect(userBuChips(users, USER_BU_ALL).map((c) => `${c.label} ${c.count}`)).toEqual([
      'ทั้งหมด 7',
      'LBD 3',
      'LBA 1',
      'LM 1',
      'DS 1',
      'ยังไม่ตั้ง 1',
    ]);
  });

  it('🔴 รวมทุกปุ่ม BU = ยอดทั้งหมด (ไม่มีคนหล่นหาย)', () => {
    const [all, ...rest] = userBuChips(users, USER_BU_ALL);
    expect(rest.reduce((n, c) => n + c.count, 0)).toBe(all.count);
  });

  it('🔴 ปุ่มที่กดค้างอยู่ไม่หายตอนเหลือ 0 คน · ไม่กดก็ไม่โชว์ BU ที่ไม่มีคน', () => {
    expect(userBuChips([u('LBD')], 'SN').map((c) => `${c.key}:${c.count}`)).toEqual(['all:1', 'LBD:1', 'SN:0']);
    expect(userBuChips([u('LBD')], USER_BU_ALL).some((c) => c.key === 'SN')).toBe(false);
  });

  it('ลำดับ BU ตัวเดียวกับยอดแยก BU ของสถานะ Online (compareBu)', () => {
    const people = ['DS', '', 'LBA', 'LBD', 'LM'].map(
      (bu, i): PresencePerson => ({ id: String(i), name: 'x', bu, role: 'staff', status: 'online', lastLoginAt: null, lastActiveAt: null }),
    );
    const presenceOrder = countPresenceByBu(people).map((b) => b.bu);
    const chipOrder = userBuChips(['DS', null, 'LBA', 'LBD', 'LM'].map(u), USER_BU_ALL).slice(1).map((c) => c.key);
    expect(chipOrder).toEqual(presenceOrder);
    expect(['', 'LBD'].sort(compareBu)).toEqual(['LBD', '']);
  });
});

describe('ตั้งค่า › ผู้ใช้งาน: ปุ่ม BU + ลบบัญชี', () => {
  const read = (rel: string) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');
  const page = read('pages/settings/AdminSettings.tsx');

  it('ตารางกรองด้วย BU ร่วมกับสถานะ · ยอดสองแถวนับข้ามกัน', () => {
    expect(page).toContain('<UserBuFilterChips');
    expect(page).toContain('matchesUserBu(u, buFilter)');
    expect(page).toContain('userBuChips(presenceMatched, buFilter)');
    expect(page).toContain('counts={presenceCountsInBu}');
  });

  it('🔴 ลบบัญชีต้องผ่านป๊อปยืนยัน (AlertDialog) · ลบตัวเองไม่มีปุ่ม · ยิง DELETE ด้วย id', () => {
    expect(page).toContain('<AlertDialog');
    expect(page).toContain("method: 'DELETE'");
    expect(page).toContain('/api/app-users?id=${encodeURIComponent(target.id)}');
    expect(page).toMatch(/user\?\.id === u\.id \? \(\s*'คุณ'/);
  });
});
