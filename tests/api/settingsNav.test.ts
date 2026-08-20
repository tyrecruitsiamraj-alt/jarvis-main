import { describe, it, expect } from 'vitest';
import {
  SETTINGS_GROUP_IDS,
  SETTINGS_GROUP_LABEL,
  SETTINGS_GROUP_TABS,
  SETTINGS_TAB_HINT,
  SETTINGS_TAB_IDS,
  SETTINGS_TAB_LABEL,
  buildSettingsNav,
  groupOfSettingsTab,
  isSettingsTabId,
  type SettingsTabId,
} from '@/lib/settingsNav';

/**
 * เจ้าของทัก 20 ส.ค. 2569: *"หน้า Setting ตอนนี้มันสะเปะสะปะมาก"*
 * → เมนูซ้ายแบ่ง 5 กลุ่ม + ป้ายไทยทั้งหมด · เทสต์ชุดนี้กันแท็บตกกลุ่ม/ป้ายหาย
 */
describe('settingsNav', () => {
  it('🔴 ทุกแท็บต้องอยู่กลุ่มใดกลุ่มหนึ่ง — เพิ่มแท็บใหม่แล้วลืมจัดกลุ่ม เทสต์นี้จับได้', () => {
    for (const t of SETTINGS_TAB_IDS) {
      expect(groupOfSettingsTab(t), t).not.toBeNull();
    }
  });

  it('🔴 ผลรวมแท็บทุกกลุ่ม = จำนวนแท็บทั้งหมด และไม่มีแท็บซ้ำสองกลุ่ม', () => {
    const flat = SETTINGS_GROUP_IDS.flatMap((g) => [...SETTINGS_GROUP_TABS[g]]);
    expect(flat).toHaveLength(SETTINGS_TAB_IDS.length);
    expect(new Set(flat).size).toBe(SETTINGS_TAB_IDS.length);
  });

  it('ทุกแท็บมีป้ายไทย + คำอธิบาย ไม่มีค่าว่าง', () => {
    for (const t of SETTINGS_TAB_IDS) {
      expect(SETTINGS_TAB_LABEL[t], t).toBeTruthy();
      expect(SETTINGS_TAB_HINT[t], t).toBeTruthy();
    }
    for (const g of SETTINGS_GROUP_IDS) {
      expect(SETTINGS_GROUP_LABEL[g], g).toBeTruthy();
    }
  });

  it('🔴 ป้ายแท็บต้องไม่มีอังกฤษล้วนเหลืออยู่ (เจ้าของสั่งเปลี่ยนเป็นไทยให้หมด)', () => {
    // ป้ายต้องมีอักษรไทยอย่างน้อยหนึ่งตัว — "Users"/"Roles"/"Audit Log" จะตกเทสต์นี้
    for (const t of SETTINGS_TAB_IDS) {
      expect(SETTINGS_TAB_LABEL[t], `${t} ต้องมีอักษรไทย`).toMatch(/[฀-๿]/);
    }
  });

  it('isSettingsTabId คัดค่าเพี้ยนออก', () => {
    expect(isSettingsTabId('users')).toBe(true);
    expect(isSettingsTabId('ไม่มีแท็บนี้')).toBe(false);
    expect(isSettingsTabId(null)).toBe(false);
  });

  it('buildSettingsNav คืนเฉพาะแท็บที่มีสิทธิ์ · กลุ่มที่ว่างไม่โชว์', () => {
    const nav = buildSettingsNav(['appearance']);
    expect(nav).toHaveLength(1);
    expect(nav[0].id).toBe('look');
    expect(nav[0].tabs.map((t) => t.id)).toEqual(['appearance']);
  });

  it('สิทธิ์ครบ = ได้ 5 กลุ่ม ครบ 12 แท็บ', () => {
    const nav = buildSettingsNav(SETTINGS_TAB_IDS);
    expect(nav).toHaveLength(5);
    const total = nav.reduce((n, g) => n + g.tabs.length, 0);
    expect(total).toBe(12);
  });

  it('ลำดับกลุ่มนิ่ง — คนและสิทธิ์ก่อน ตรวจสอบระบบท้ายสุด', () => {
    const nav = buildSettingsNav(SETTINGS_TAB_IDS);
    expect(nav.map((g) => g.id)).toEqual(['people', 'look', 'automation', 'data', 'monitor']);
  });

  it('กลุ่มที่ตั้งไว้ตรงกับที่เจ้าของเคาะ', () => {
    const of = (t: SettingsTabId) => groupOfSettingsTab(t);
    expect(of('users')).toBe('people');
    expect(of('jobStaff')).toBe('people');
    expect(of('appearance')).toBe('look');
    expect(of('lumosMode')).toBe('automation');
    expect(of('reference')).toBe('data');
    expect(of('audit')).toBe('monitor');
  });
});
