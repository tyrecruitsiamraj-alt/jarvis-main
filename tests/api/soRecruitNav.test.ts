import { describe, expect, it } from 'vitest';
import { DOCK_NAV_ITEMS } from '../../src/components/layout/bottom-nav/dockNavConfig';
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

describe('โครงลำดับงาน', () => {
  /**
   * 🔴 เจ้าของสั่ง 28 ส.ค. 2569: เลิกใช้เลขขั้น · ตัด "ประกาศรับ" กับ "ผู้สมัคร" ออก
   * (ซ้ำกับแท็บในกล่องงาน) · "จับคู่ & โทร" → "จับคู่งาน" ย้ายมาอยู่ใต้ใบขอ
   * ⇒ เหลือ 4 หน้า เรียงตามลำดับใน array **ไม่มี `step: number` แล้ว**
   */
  it('เหลือ 4 หน้า เรียงตามลำดับงาน คีย์ไม่ซ้ำ', () => {
    expect(CONVEYOR_STEPS.map((s) => s.key)).toEqual([
      'requests',
      'matching',
      'follow',
      'aftercare',
    ]);
    expect(CONVEYOR_STEPS.map((s) => s.label)).toEqual([
      'ใบขอ',
      'จับคู่งาน',
      'ติดตาม',
      'ดูแลหลังเริ่มงาน',
    ]);
  });

  it('ห้ามมีเลขขั้นกลับมา — ป้ายต้องเป็นไอคอน + ชื่อหน้า', () => {
    for (const s of CONVEYOR_STEPS) {
      expect((s as { step?: unknown }).step, `${s.label} ต้องไม่มี step`).toBeUndefined();
      expect(s.icon, `${s.label}.icon`).toBeTruthy();
    }
  });

  it('ประกาศรับ/ผู้สมัคร ไม่อยู่ในลำดับงานแล้ว (ไปอยู่แท็บในกล่องงาน)', () => {
    const keys = CONVEYOR_STEPS.map((s) => s.key);
    expect(keys).not.toContain('postings');
    expect(keys).not.toContain('applicants');
  });

  it('ทุกขั้นมีคำอธิบายและ path จริง — ห้ามมีขั้นที่กดแล้วไม่ไปไหน', () => {
    for (const s of [...CONVEYOR_STEPS, ...CONVEYOR_VAULT]) {
      expect(s.label, 'label').toBeTruthy();
      expect(s.blurb, `${s.label}.blurb`).toBeTruthy();
      expect(s.path.startsWith('/'), `${s.label}.path`).toBe(true);
    }
  });
});

describe('stepForPath — หน้าไหนอยู่ตรงไหนของลำดับ', () => {
  it('หน้าใบขอและหน้ารายละเอียดใบขอ = ใบขอ', () => {
    expect(stepForPath('/jobs/list')?.key).toBe('requests');
    expect(stepForPath('/jobs/siamraj/OPL6908052')?.key).toBe('requests');
    expect(stepForPath('/jobs/siamraj/OPL6908052/applicants')?.key).toBe('requests');
  });

  it('จับคู่ = จับคู่งาน · ติดตาม · ดูแลหลังเริ่มงาน', () => {
    expect(stepForPath('/matching/match')?.key).toBe('matching');
    expect(stepForPath('/follow')?.key).toBe('follow');
    expect(stepForPath('/aftercare')?.key).toBe('aftercare');
  });

  /** 🔴 กล่องงานเป็นเจ้าของ `/jobs/board` เต็มตัวแล้ว — ไม่มีหน้าไหนมาแย่ง */
  it('ทุกมุมมองของกล่องงานไม่อยู่ในลำดับงาน', () => {
    for (const q of ['', '?view=list', '?view=postings', '?lane=toRelease']) {
      expect(stepForPath('/jobs/board', q), `/jobs/board${q}`).toBeNull();
    }
  });

  it('หน้านอกสายพานคืน null — หน้าแรก/คลังข้อมูล/ตั้งค่าไม่มีเลขขั้น', () => {
    for (const p of ['/', '/dashboard', '/wl', '/matching/candidates', '/settings']) {
      expect(stepForPath(p), p).toBeNull();
    }
  });

  it('เจาะจงชนะกว้าง — /matching/candidates ห้ามถูกจับคู่งานกินไป', () => {
    expect(stepForPath('/matching/candidates/12')).toBeNull();
    expect(stepForPath('/matching/pre-check')?.key).toBe('matching');
  });
});

describe('isStepActive — กล่องงานไม่ใช่หน้าในลำดับงาน', () => {
  const requests = CONVEYOR_STEPS[0];
  const matching = CONVEYOR_STEPS[1];

  /**
   * 🔴 เดิมขั้น 2/3 ยืม `/jobs/board` เป็น path ของตัวเอง ต่างกันแค่ `?view=`
   * เจ้าของสั่งถอดสองหน้านั้นออกจากลำดับ 28 ส.ค. 2569 ⇒ ไม่มีใครมาสว่างที่กล่องงานแล้ว
   */
  it('ทุกมุมมองของกล่องงาน ไม่ทำให้หน้าไหนในลำดับสว่าง', () => {
    for (const q of ['', '?view=list', '?view=postings']) {
      for (const st of CONVEYOR_STEPS) {
        expect(isStepActive(st, '/jobs/board', q), `${st.label} @ ${q}`).toBe(false);
      }
    }
  });

  it('หน้าใบขอสว่างที่ "ใบขอ" · หน้าจับคู่สว่างที่ "จับคู่งาน"', () => {
    expect(isStepActive(requests, '/jobs/list', '')).toBe(true);
    expect(isStepActive(matching, '/jobs/list', '')).toBe(false);
    expect(isStepActive(matching, '/matching/match', '')).toBe(true);
    expect(isStepActive(requests, '/matching/match', '')).toBe(false);
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

  /**
   * 🔴 เจ้าของทัก 4 ก.ย. 2569: *"หน้าหลักมันต้องเป็นรูปบ้าน หรืออะไรก็ได้ที่ไม่ใช่
   * รูปโทรศัพท์"* — ของเดิมใช้ `PhoneCall` ซึ่งนอกจากไม่สื่อ ยังซ้ำกับเมนู "จับคู่งาน"
   */
  it('🔴 ไอคอนหน้าหลักเป็นรูปบ้าน ไม่ใช่โทรศัพท์', () => {
    expect(CONVEYOR_HOME.icon.displayName ?? CONVEYOR_HOME.icon.name).toMatch(/House|Home/);
  });
});

describe('ชื่อ+ไอคอนของหน้าเดียวกัน ต้องตรงกันทุกเมนู', () => {
  /**
   * 🔴 เจ้าของให้ไล่ตรวจไอคอนทั้งระบบ 4 ก.ย. 2569 — เจอว่าหน้าเดียวกันมีสองชื่อ
   * สองไอคอน แล้วแต่ดูจากเมนูไหน: `/jobs/list` = "ใบขอ"(คลิปบอร์ด) vs "หน่วยงาน"(กระเป๋า) ·
   * `/follow` = "ติดตาม" vs "Follow" · `/matching/candidates` = "คลังคน" vs "ผู้สมัคร"
   * ⇒ เมนูล่าง/หน้าตั้งค่าต้องยกป้ายกับไอคอนมาจาก soRecruitNav ที่เดียว
   */
  it('🔴 path ที่มีทั้งสองเมนู ต้องได้ชื่อและไอคอนตัวเดียวกัน', () => {
    const left = new Map(
      [CONVEYOR_HOME, ...CONVEYOR_STEPS].map((t) => [t.path, t] as const),
    );
    for (const item of DOCK_NAV_ITEMS) {
      const same = left.get(item.path);
      if (!same) continue;
      expect({ path: item.path, label: item.label }).toEqual({
        path: item.path,
        label: same.label,
      });
      expect(item.icon, item.path).toBe(same.icon);
    }
  });
});

describe('ไอคอนเมนู — ห้ามซ้ำกัน', () => {
  it('🔴 ทุกเมนู (รวมหน้าหลัก) ใช้ไอคอนคนละตัว — ซ้ำแล้วกวาดตาแยกไม่ออก', () => {
    const items = [CONVEYOR_HOME, ...CONVEYOR_STEPS];
    const names = items.map((t) => t.icon.displayName ?? t.icon.name);
    expect(new Set(names).size).toBe(items.length);
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

  /**
   * ⚠️ ตั้งแต่ 28 ส.ค. 2569 ก้อนทีมชี้ไปกล่องงานได้ด้วย — "ประกาศรับ/ผู้สมัคร"
   * ถูกถอดออกจากลำดับงานแล้ว งานสองอย่างนั้นอยู่ในแท็บของกล่องงาน
   */
  it('ทุกปลายทางของก้อนทีมต้องเป็นหน้าที่มีจริง (กันลิงก์ตาย)', () => {
    const stepPaths = new Set([...CONVEYOR_STEPS.map((s) => s.path), '/jobs/board']);
    for (const t of HOME_TEAM_NAV) {
      if (t.path === null) continue;
      // ยอมให้ต่างได้ถ้าเป็นหน้าย่อยของขั้นนั้น — เช็คแค่ว่าขึ้นต้นด้วย path ของขั้นใดขั้นหนึ่ง
      const ok = [...stepPaths].some((sp) => t.path === sp || t.path!.startsWith(sp.split('?')[0]));
      expect(ok, `${t.key} -> ${t.path}`).toBe(true);
    }
  });
});
