import { describe, expect, it } from 'vitest';
import {
  CONVEYOR_HOME,
  CONVEYOR_STEPS,
  HOME_TEAM_NAV,
  CONVEYOR_VAULT,
  conveyorBadge,
  isStepActive,
  isVaultActive,
  stepForPath,
} from '@/lib/soRecruitNav';

describe('โครงสายพาน', () => {
  it('มี 6 ขั้น เลข 1–6 เรียงไม่ซ้ำ — เลขนี้คือเลขที่หัวหน้าจอประกาศ', () => {
    expect(CONVEYOR_STEPS.map((s) => s.step)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new Set(CONVEYOR_STEPS.map((s) => s.key)).size).toBe(6);
  });

  it('ทุกขั้นมีคำอธิบายและ path จริง — ห้ามมีขั้นที่กดแล้วไม่ไปไหน', () => {
    for (const s of [...CONVEYOR_STEPS, ...CONVEYOR_VAULT]) {
      expect(s.label, 'label').toBeTruthy();
      expect(s.blurb, `${s.label}.blurb`).toBeTruthy();
      expect(s.path.startsWith('/'), `${s.label}.path`).toBe(true);
    }
  });
});

describe('stepForPath — หน้าไหนอยู่ขั้นไหน', () => {
  it('หน้าใบขอและหน้ารายละเอียดใบขอเป็นขั้น 1', () => {
    expect(stepForPath('/jobs/list')?.step).toBe(1);
    expect(stepForPath('/jobs/siamraj/OPL6908052')?.step).toBe(1);
    expect(stepForPath('/jobs/siamraj/OPL6908052/applicants')?.step).toBe(1);
  });

  it('บอร์ดรับสมัคร ?view=list = ขั้น 3 · จับคู่ = ขั้น 4 · ติดตาม = 5 · ดูแล = 6', () => {
    expect(stepForPath('/jobs/board', '?view=list')?.step).toBe(3);
    expect(stepForPath('/matching/match')?.step).toBe(4);
    expect(stepForPath('/follow')?.step).toBe(5);
    expect(stepForPath('/aftercare')?.step).toBe(6);
  });

  it('หน้านอกสายพานคืน null — หน้าแรก/คลังข้อมูล/ตั้งค่าไม่มีเลขขั้น', () => {
    for (const p of ['/', '/dashboard', '/wl', '/matching/candidates', '/settings']) {
      expect(stepForPath(p), p).toBeNull();
    }
  });

  it('เจาะจงชนะกว้าง — /matching/candidates ห้ามถูกขั้น 4 กินไป', () => {
    expect(stepForPath('/matching/candidates/12')).toBeNull();
    expect(stepForPath('/matching/pre-check')?.step).toBe(4);
  });
});

describe('isStepActive — ขั้น 2 กับ 3 อยู่ path เดียวกัน ต่างที่ ?view=', () => {
  const postings = CONVEYOR_STEPS[1];
  const applicants = CONVEYOR_STEPS[2];

  it('?view=postings สว่างเฉพาะขั้น 2', () => {
    expect(isStepActive(postings, '/jobs/board', '?view=postings')).toBe(true);
    expect(isStepActive(applicants, '/jobs/board', '?view=postings')).toBe(false);
  });

  it('?view=list สว่างเฉพาะขั้น 3', () => {
    expect(isStepActive(applicants, '/jobs/board', '?view=list')).toBe(true);
    expect(isStepActive(postings, '/jobs/board', '?view=list')).toBe(false);
  });

  /**
   * 🔴 เปลี่ยน 27 ส.ค. 2569: ไม่มี `?view=` = **กล่องงาน** ซึ่งอยู่กลุ่มคลังข้อมูล
   * ไม่ใช่ขั้นไหนของสายพาน (เดิมยืมขั้น 3 เป็นทางเข้าเพราะยังไม่มีเมนูของตัวเอง)
   */
  it('ไม่มี ?view= (กล่องงาน) ไม่ใช่ขั้นไหนของสายพาน', () => {
    expect(isStepActive(applicants, '/jobs/board', '')).toBe(false);
    expect(isStepActive(postings, '/jobs/board', '')).toBe(false);
    expect(stepForPath('/jobs/board', '')).toBeNull();
  });

  it('หน้ารายละเอียดใบขอสว่างที่ขั้น 1 ไม่ใช่ขั้น 3', () => {
    expect(isStepActive(CONVEYOR_STEPS[0], '/jobs/siamraj/X', '')).toBe(true);
    expect(isStepActive(applicants, '/jobs/siamraj/X', '')).toBe(false);
  });
});

describe('isVaultActive', () => {
  /** อ้างด้วยคีย์ ไม่ใช่ตำแหน่ง — เพิ่มรายการใหม่ในคลังแล้วลำดับเลื่อน เทสต์ต้องไม่พัง */
  const vault = (key: string) => {
    const item = CONVEYOR_VAULT.find((v) => v.key === key);
    if (!item) throw new Error(`ไม่มีรายการคลังข้อมูลคีย์ ${key}`);
    return item;
  };

  it('คลังคนสว่างทั้งหน้าลิสต์และหน้าโปรไฟล์', () => {
    expect(isVaultActive(vault('candidates'), '/matching/candidates')).toBe(true);
    expect(isVaultActive(vault('candidates'), '/matching/candidates/9')).toBe(true);
    expect(isVaultActive(vault('candidates'), '/matching/match')).toBe(false);
  });

  it('WL สว่างในหน้าลูกทุกหน้า', () => {
    expect(isVaultActive(vault('wl'), '/wl/employees/3')).toBe(true);
  });

  /**
   * 🔴 กล่องงาน = `/jobs/board` **ที่ไม่มี `?view=`** (เจ้าของทัก 27 ส.ค. 2569 ว่า
   * เมนูไม่มีทางไปหน้านี้เลย) · ไม่เช็ค `?view=` มันจะสว่างพร้อมขั้น 2/3 ตลอดเวลา
   */
  it('กล่องงานสว่างเฉพาะตอนไม่มี ?view= (หรือ view=board)', () => {
    const box = vault('job-boxes');
    expect(isVaultActive(box, '/jobs/board', '')).toBe(true);
    expect(isVaultActive(box, '/jobs/board', '?view=board')).toBe(true);
    expect(isVaultActive(box, '/jobs/board', '?view=postings')).toBe(false);
    expect(isVaultActive(box, '/jobs/board', '?view=list')).toBe(false);
  });

  it('กล่องงานกับขั้นสายพานไม่สว่างพร้อมกันสักกรณี', () => {
    const box = vault('job-boxes');
    for (const search of ['', '?view=board', '?view=postings', '?view=list']) {
      const vaultOn = isVaultActive(box, '/jobs/board', search);
      const stepOn = CONVEYOR_STEPS.some((st) => isStepActive(st, '/jobs/board', search));
      expect(vaultOn && stepOn, `ชนกันที่ "${search}"`).toBe(false);
    }
  });
});

describe('ชื่อหน้าแรกในเมนู', () => {
  it('เรียกว่า "หน้าหลัก" (เจ้าของสั่งเปลี่ยนจาก "วันนี้" 27 ส.ค. 2569)', () => {
    expect(CONVEYOR_HOME.label).toBe('หน้าหลัก');
  });
});

describe('conveyorBadge — 0 ที่รู้จริง ต่างจาก "ยังไม่รู้"', () => {
  it('ยังไม่รู้ (null/ไม่มีคีย์) = ไม่วาดป้ายเลย', () => {
    expect(conveyorBadge({ follow: null }, 'follow')).toBeNull();
    expect(conveyorBadge({}, 'follow')).toBeNull();
  });

  it('0 ที่รู้จริงต้องวาด และไม่ใช่ป้ายแดง', () => {
    expect(conveyorBadge({ follow: 0 }, 'follow')).toEqual({ value: 0, urgent: false });
  });

  it('ถังที่ต้องลงมือและมีของค้าง = ป้ายแดง · ถังบอกปริมาณเฉย ๆ ไม่แดง', () => {
    expect(conveyorBadge({ applicants: 3 }, 'applicants')?.urgent).toBe(true);
    expect(conveyorBadge({ requests: 293 }, 'requests')?.urgent).toBe(false);
  });
});

describe('HOME_TEAM_NAV — ก้อนทีมกดนำทางบนหน้าแรก', () => {
  it('ครบ 4 ทีม · ทุกใบมีป้าย/คำอธิบาย · path เป็นเส้นทางจริงหรือ null', () => {
    expect(HOME_TEAM_NAV.map((t) => t.key)).toEqual(['online', 'recruit', 'closing', 'lumos']);
    for (const t of HOME_TEAM_NAV) {
      expect(t.label.trim()).toBeTruthy();
      expect(t.blurb.trim()).toBeTruthy();
      if (t.path !== null) expect(t.path.startsWith('/'), t.key).toBe(true);
    }
  });

  it('🔴 หนึ่งกล่องหนึ่งปลายทาง — ห้ามสองทีมชี้หน้าเดียวกัน (เคยชี้ /matching/match ซ้ำ แล้วเจ้าของกดแล้วงง)', () => {
    const paths = HOME_TEAM_NAV.map((t) => t.path).filter((p): p is string => p !== null);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('ทีม Lumos ไม่มีหน้าปลายทาง (กดแล้วเปิด dialog ผลโทรแทน — เจ้าของเคาะ)', () => {
    expect(HOME_TEAM_NAV.find((t) => t.key === 'lumos')?.path).toBeNull();
  });

  it('ทุกปลายทางของก้อนทีมต้องเป็นหน้าที่มีอยู่ในสายพาน (กันลิงก์ตาย)', () => {
    const stepPaths = new Set(CONVEYOR_STEPS.map((s) => s.path));
    for (const t of HOME_TEAM_NAV) {
      if (t.path === null) continue;
      // ยอมให้ต่างได้ถ้าเป็นหน้าย่อยของขั้นนั้น — เช็คแค่ว่าขึ้นต้นด้วย path ของขั้นใดขั้นหนึ่ง
      const ok = [...stepPaths].some((sp) => t.path === sp || t.path!.startsWith(sp.split('?')[0]));
      expect(ok, `${t.key} -> ${t.path}`).toBe(true);
    }
  });
});
