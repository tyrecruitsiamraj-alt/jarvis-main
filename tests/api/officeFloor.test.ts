import { describe, expect, it } from 'vitest';

import {
  DESK_ORDER,
  OFFICE_BOARD,
  OFFICE_LINKS,
  OFFICE_CORE,
  OFFICE_SLOTS,
  coreSpokeGeometry,
  isDeskActive,
  pathGeometry,
  buildOfficeFloor,
  deskStatValue,
  desksNeedingAction,
  isLinkFlowing,
  officeHeadline,
  type Desk,
  type DeskId,
  type OfficeFloorRaw,
} from '@/lib/officeFloor';

/**
 * ฉาก "ห้องทำงาน" บนหน้าแรก — เทสต์ล็อกกติกาที่เจ้าของตีตกมาแล้ว
 *
 * ที่ต้องกันไว้:
 * 1. โต๊ะว่าง **ห้ามพูดเป็นตัวเลข 0** ต้องตอบเป็นสถานะ (ฐานใหม่ตอนนี้มีใบสมัคร 1 ใบทั้งระบบ
 *    ถ้าโชว์ 0 ทุกโต๊ะจะกลายเป็นป้ายตาย)
 * 2. ของค้างต้องชนะ "กำลังยุ่ง" เสมอ — ไม่งั้นโต๊ะที่ต้องไปช่วยจมอยู่ท้ายฉาก
 * 3. ทุกตัวเลขบนโต๊ะต้องมีหน่วย (บทเรียน "292 กับ 340" ที่คนอ่านเดาหน่วยเอง)
 * 4. โต๊ะที่ระบบยังไม่มีของจริง ต้องตอบ off ตรง ๆ ห้ามแกล้งว่าง
 */

const empty: OfficeFloorRaw = {
  intake: { newToday: 0, untouched: 0, inQueue: 0, held: 0, claimedIdle: 0, over5d: 0, oldestDays: null },
  aiCalls: { pending: 0, waitingResult: 0, staleOverDay: 0, resultToday: 0, oldestDays: null },
  selection: { jobsOpen: null, jobsWithMatch: 0, holdsActive: 0, holdsNoResult: 0, oldestDays: null },
  follow: { today: 0, pastDue: 0, upcoming: 0, oldestDays: null },
  content: { pending: 0, inProgress: 0, scraping: 0, oldestDays: null },
  aftercare: { enabled: false, count: 0 },
};

const clone = (patch: Partial<OfficeFloorRaw>): OfficeFloorRaw => ({
  intake: { ...empty.intake, ...(patch.intake ?? {}) },
  aiCalls: { ...empty.aiCalls, ...(patch.aiCalls ?? {}) },
  selection: { ...empty.selection, ...(patch.selection ?? {}) },
  follow: { ...empty.follow, ...(patch.follow ?? {}) },
  content: { ...empty.content, ...(patch.content ?? {}) },
  aftercare: { ...empty.aftercare, ...(patch.aftercare ?? {}) },
});

describe('officeFloor — โครงฉาก', () => {
  it('คืนโต๊ะครบตามลำดับการไหลของงาน', () => {
    const desks = buildOfficeFloor(empty);
    expect(desks.map((d) => d.id)).toEqual(DESK_ORDER);
  });

  it('ทุกโต๊ะมีประโยค "กำลังทำอะไร" และลิงก์ไปหน้างานจริง', () => {
    for (const d of buildOfficeFloor(empty)) {
      expect(d.doing, `${d.id}.doing`).toBeTruthy();
      expect(d.href, `${d.id}.href`).toMatch(/^\//);
      expect(d.label, `${d.id}.label`).toBeTruthy();
    }
  });

  it('ทุกตัวเลขบนโต๊ะต้องมีหน่วย — ห้ามเลขเปล่า', () => {
    const desks = buildOfficeFloor(
      clone({
        intake: { newToday: 2, untouched: 3, inQueue: 1, held: 1, claimedIdle: 1, over5d: 0, oldestDays: 4 },
        aiCalls: { pending: 1, waitingResult: 57, staleOverDay: 19, resultToday: 0, oldestDays: 5 },
      }),
    );
    for (const d of desks) {
      for (const s of d.stats) {
        expect(s.unit, `${d.id}.${s.key} ขาดหน่วย`).toBeTruthy();
        expect(s.label, `${d.id}.${s.key} ขาด label`).toBeTruthy();
      }
    }
  });
});

describe('officeFloor — สถานะโต๊ะ', () => {
  it('ระบบว่างทั้งหมด → ทุกโต๊ะ idle (ยกเว้นโต๊ะที่ยังไม่เปิด = off) และไม่มีคำว่าเลข 0 ในประโยค', () => {
    const desks = buildOfficeFloor(empty);
    for (const d of desks) {
      if (d.id === 'aftercare') {
        expect(d.state).toBe('off');
        continue;
      }
      expect(d.state, `${d.id}`).toBe('idle');
      // กติกาข้อ 1: โต๊ะว่างตอบเป็นสถานะ ไม่ใช่ "0 ใบ"
      expect(d.doing, `${d.id}.doing ไม่ควรพูดเลข 0`).not.toMatch(/\b0\b/);
      expect(d.backlog).toBe(0);
      expect(d.oldestDays).toBeNull();
    }
  });

  it('ของค้างชนะกำลังยุ่ง — AI โทรอยู่ 57 สายแต่เงียบ 19 สาย ต้องเป็น blocked ไม่ใช่ calling', () => {
    const [, ai] = buildOfficeFloor(
      clone({ aiCalls: { pending: 1, waitingResult: 57, staleOverDay: 19, resultToday: 0, oldestDays: 5 } }),
    );
    expect(ai.id).toBe('aiCalls');
    expect(ai.state).toBe('blocked');
    expect(ai.backlog).toBe(19);
    expect(ai.oldestDays).toBe(5);
    expect(ai.doing).toContain('19');
    expect(ai.tone).toBe('danger');
  });

  it('AI มีสายเดินอยู่แต่ไม่มีของค้าง → calling', () => {
    const [, ai] = buildOfficeFloor(
      clone({ aiCalls: { pending: 0, waitingResult: 8, staleOverDay: 0, resultToday: 3, oldestDays: null } }),
    );
    expect(ai.state).toBe('calling');
    expect(ai.backlog).toBe(0);
    expect(ai.doing).toContain('8');
  });

  it('โต๊ะสรรหา: เก็บชื่อแล้วเงียบเกิน 1 วัน + ค้างเกิน 5 วัน = ของที่ต้องลงมือ (รวมกัน)', () => {
    const [intake] = buildOfficeFloor(
      clone({
        intake: { newToday: 0, untouched: 4, inQueue: 0, held: 2, claimedIdle: 2, over5d: 3, oldestDays: 6 },
      }),
    );
    expect(intake.state).toBe('blocked');
    expect(intake.backlog).toBe(5);
    expect(intake.doing).toContain('นานสุด 6 วัน');
  });

  it('โต๊ะสรรหา: มีใบรอโทรแต่ไม่มีของค้าง → working และบอกจำนวนใบ', () => {
    const [intake] = buildOfficeFloor(
      clone({ intake: { newToday: 1, untouched: 4, inQueue: 0, held: 0, claimedIdle: 0, over5d: 0, oldestDays: null } }),
    );
    expect(intake.state).toBe('working');
    expect(intake.doing).toContain('4 ใบ');
  });

  it('โต๊ะคัดสรร: ไม่รู้ยอดใบเปิด (null) → ไม่โชว์ช่อง "ยังไม่มีคนแนะนำ" เลย (ห้ามโชว์ 0 ที่แปลคนละเรื่อง)', () => {
    const sel = buildOfficeFloor(empty).find((d) => d.id === 'selection')!;
    expect(sel.stats.some((s) => s.key === 'noMatch')).toBe(false);
  });

  it('โต๊ะคัดสรร: ยังไม่มีคนแนะนำ = ใบเปิด − ใบที่ AI คิดแล้ว (ไม่ติดลบ)', () => {
    const desks = buildOfficeFloor(
      clone({ selection: { jobsOpen: 283, jobsWithMatch: 163, holdsActive: 0, holdsNoResult: 0, oldestDays: null } }),
    );
    const sel = desks.find((d) => d.id === 'selection')!;
    expect(sel.stats.find((s) => s.key === 'noMatch')?.value).toBe(120);

    const flipped = buildOfficeFloor(
      // ผล match มีมากกว่าใบเปิดได้จริง (board_match_results เก็บใบปิดไว้ด้วย) — ห้ามได้เลขลบ
      clone({ selection: { jobsOpen: 100, jobsWithMatch: 503, holdsActive: 0, holdsNoResult: 0, oldestDays: null } }),
    );
    expect(flipped.find((d) => d.id === 'selection')!.stats.find((s) => s.key === 'noMatch')?.value).toBe(0);
  });

  it('โต๊ะ Follow: เลยเวลานัดแล้ว = blocked · มีนัดวันนี้ = calling', () => {
    const overdue = buildOfficeFloor(clone({ follow: { today: 1, pastDue: 2, upcoming: 0, oldestDays: 3 } }));
    expect(overdue.find((d) => d.id === 'follow')!.state).toBe('blocked');

    const todayOnly = buildOfficeFloor(clone({ follow: { today: 5, pastDue: 0, upcoming: 1, oldestDays: null } }));
    expect(todayOnly.find((d) => d.id === 'follow')!.state).toBe('calling');
  });

  it('โต๊ะที่ยังไม่เปิดใช้ต้องตอบ off + บอกตรง ๆ ว่ายังไม่เปิด (ห้ามแกล้งว่าง)', () => {
    const off = buildOfficeFloor(empty).find((d) => d.id === 'aftercare')!;
    expect(off.state).toBe('off');
    expect(off.doing).toContain('ยังไม่เปิดใช้');
    expect(off.stats).toHaveLength(0);

    const on = buildOfficeFloor(clone({ aftercare: { enabled: true, count: 3 } })).find(
      (d) => d.id === 'aftercare',
    )!;
    expect(on.state).toBe('working');
    expect(on.doing).toContain('3 คน');
  });
});

describe('officeFloor — แถบสรุปเหนือฉาก', () => {
  it('เรียงโต๊ะที่ต้องลงมือจากของค้างมากสุด', () => {
    const desks = buildOfficeFloor(
      clone({
        intake: { newToday: 0, untouched: 0, inQueue: 0, held: 0, claimedIdle: 2, over5d: 0, oldestDays: 2 },
        aiCalls: { pending: 0, waitingResult: 57, staleOverDay: 19, resultToday: 0, oldestDays: 5 },
        follow: { today: 0, pastDue: 5, upcoming: 0, oldestDays: 3 },
      }),
    );
    expect(desksNeedingAction(desks).map((d) => d.id)).toEqual(['aiCalls', 'follow', 'intake']);
  });

  it('พาดหัวบอกโต๊ะที่ต้องลงมือก่อน + จำนวนโต๊ะที่เหลือ', () => {
    const desks = buildOfficeFloor(
      clone({
        aiCalls: { pending: 0, waitingResult: 57, staleOverDay: 19, resultToday: 0, oldestDays: 5 },
        follow: { today: 0, pastDue: 5, upcoming: 0, oldestDays: 3 },
      }),
    );
    const line = officeHeadline(desks);
    expect(line).toContain('โต๊ะ AI โทร (Lumos)');
    expect(line).toContain('19');
    expect(line).toContain('อีก 1 โต๊ะ');
  });

  it('ไม่มีของค้างเลย → พาดหัวไม่พูดเรื่องของค้าง', () => {
    expect(officeHeadline(buildOfficeFloor(empty))).toBe('ทุกโต๊ะว่าง — ไม่มีงานค้างในระบบ');
    const busy = buildOfficeFloor(
      clone({ aiCalls: { pending: 0, waitingResult: 8, staleOverDay: 0, resultToday: 1, oldestDays: null } }),
    );
    expect(officeHeadline(busy)).toContain('ไม่มีของค้างต้องลงมือ');
  });
});

describe('officeFloor — เส้นงานไหลบนฉาก (เท่ได้ แต่ต้องถือข้อมูลจริง)', () => {
  const mapOf = (raw: OfficeFloorRaw): Record<DeskId, Desk> =>
    Object.fromEntries(buildOfficeFloor(raw).map((d) => [d.id, d])) as Record<DeskId, Desk>;

  it('เส้นทุกเส้นชี้ไปโต๊ะที่มีจริง และมีคำอธิบายกำกับ', () => {
    for (const link of OFFICE_LINKS) {
      expect(DESK_ORDER).toContain(link.from);
      expect(DESK_ORDER).toContain(link.to);
      expect(link.label, `${link.from}->${link.to} ขาดคำอธิบาย`).toBeTruthy();
    }
  });

  it('🔴 ระบบว่างทั้งหมด → ไม่มีเส้นไหนวิ่ง (ห้ามวิ่งเป็นของประดับ)', () => {
    const byId = mapOf(empty);
    for (const link of OFFICE_LINKS) {
      expect(isLinkFlowing(link, byId), `${link.from}->${link.to} ไม่ควรวิ่ง`).toBe(false);
    }
  });

  it('สรรหา→AI วิ่งเมื่อมีใบอยู่ในมือคน หรือมีสายรอในคิว', () => {
    const link = OFFICE_LINKS.find((l) => l.from === 'intake' && l.to === 'aiCalls')!;
    expect(isLinkFlowing(link, mapOf(clone({ intake: { ...empty.intake, held: 2 } })))).toBe(true);
    expect(
      isLinkFlowing(link, mapOf(clone({ aiCalls: { ...empty.aiCalls, waitingResult: 5 } }))),
    ).toBe(true);
    expect(isLinkFlowing(link, mapOf(empty))).toBe(false);
  });

  it('AI→คัดสรร วิ่งเฉพาะเมื่อมีผลโทรกลับมาวันนี้ (ไม่ใช่แค่มีสายค้าง)', () => {
    const link = OFFICE_LINKS.find((l) => l.from === 'aiCalls' && l.to === 'selection')!;
    // มีสายค้าง 19 แต่ยังไม่มีผลกลับ = ยังไม่มีของไหลไปให้คัดสรร
    expect(
      isLinkFlowing(
        link,
        mapOf(clone({ aiCalls: { ...empty.aiCalls, waitingResult: 19, staleOverDay: 19 } })),
      ),
    ).toBe(false);
    expect(
      isLinkFlowing(link, mapOf(clone({ aiCalls: { ...empty.aiCalls, resultToday: 3 } }))),
    ).toBe(true);
  });

  it('ติดตาม→ดูแลหลังเริ่มงาน วิ่งเฉพาะเมื่อโต๊ะนั้นเปิดใช้และมีคนดูแลอยู่', () => {
    const link = OFFICE_LINKS.find((l) => l.to === 'aftercare')!;
    expect(isLinkFlowing(link, mapOf(empty))).toBe(false); // ยังไม่เปิดใช้
    expect(
      isLinkFlowing(link, mapOf(clone({ aftercare: { enabled: true, count: 0 } }))),
    ).toBe(false);
    expect(isLinkFlowing(link, mapOf(clone({ aftercare: { enabled: true, count: 4 } })))).toBe(true);
  });

  it('deskStatValue อ่านช่องที่ไม่มีได้ 0 (ไม่ระเบิด)', () => {
    const byId = mapOf(empty);
    expect(deskStatValue(byId.aftercare, 'count')).toBe(0);
    expect(deskStatValue(undefined, 'held')).toBe(0);
    expect(deskStatValue(byId.intake, 'ไม่มีช่องนี้')).toBe(0);
  });
});

describe('officeFloor — ผังห้อง 3D', () => {
  it('มีตำแหน่งครบทุกโต๊ะ และอยู่ในกระดานพื้น', () => {
    for (const id of DESK_ORDER) {
      const slot = OFFICE_SLOTS[id];
      expect(slot, `${id} ไม่มีตำแหน่ง`).toBeTruthy();
      expect(slot.x).toBeGreaterThanOrEqual(0);
      expect(slot.x).toBeLessThanOrEqual(OFFICE_BOARD.width);
      expect(slot.y).toBeGreaterThanOrEqual(0);
      expect(slot.y).toBeLessThanOrEqual(OFFICE_BOARD.depth);
      expect(slot.scale).toBeGreaterThan(0);
    }
  });

  it('สายหลักอยู่หน้าห้อง สายแยกอยู่หลังห้อง (ความลึกบอกลำดับงาน)', () => {
    // y มาก = ใกล้กล้อง · สายหลักที่ทำทุกวันต้องอยู่ใกล้กว่าสายแยก
    expect(OFFICE_SLOTS.aiCalls.y).toBeGreaterThan(OFFICE_SLOTS.content.y);
    expect(OFFICE_SLOTS.selection.y).toBeGreaterThan(OFFICE_SLOTS.aftercare.y);
    // ของไกลต้องเล็กกว่าของใกล้
    expect(OFFICE_SLOTS.content.scale).toBeLessThan(OFFICE_SLOTS.aiCalls.scale);
  });

  it('pathGeometry คิดความยาว/มุมจากจุดจริง', () => {
    const g = pathGeometry('aiCalls', 'selection');
    expect(g.length).toBeGreaterThan(0);
    expect(g).toMatchObject({ x: OFFICE_SLOTS.aiCalls.x, y: OFFICE_SLOTS.aiCalls.y });
  });

  it('🔴 ไม่มีแท่นไหนอยู่กลางคอลัมน์เดียวกับแกนกลาง (ป้ายตั้งจะบังป้าย JARVIS Core)', () => {
    for (const id of DESK_ORDER) {
      const dx = Math.abs(OFFICE_SLOTS[id].x - OFFICE_CORE.x);
      expect(dx, `${id} อยู่ใกล้แนวกลางเกินไป (dx=${dx})`).toBeGreaterThan(90);
    }
  });

  it('ทุกแท่นวางล้อมแกนกลาง — สายจาก Core ไปทุกแท่นยาวเป็นบวก และเริ่มที่ Core', () => {
    for (const id of DESK_ORDER) {
      const g = coreSpokeGeometry(id);
      expect(g.x).toBe(OFFICE_CORE.x);
      expect(g.y).toBe(OFFICE_CORE.y);
      expect(g.length, `${id} ทับแกนกลาง`).toBeGreaterThan(40);
      expect(Number.isFinite(g.angleDeg)).toBe(true);
    }
  });

  it('isDeskActive: ทีมที่ยุ่ง/ต้องลงมือ = สายวิ่ง · ว่าง/ปิดใช้ = สายนิ่ง', () => {
    const byId = Object.fromEntries(buildOfficeFloor(empty).map((d) => [d.id, d])) as Record<
      DeskId,
      Desk
    >;
    expect(isDeskActive(byId.intake)).toBe(false); // ระบบว่าง
    expect(isDeskActive(byId.aftercare)).toBe(false); // ยังไม่เปิดใช้
    const busy = Object.fromEntries(
      buildOfficeFloor(
        clone({ aiCalls: { ...empty.aiCalls, waitingResult: 19, staleOverDay: 19 } }),
      ).map((d) => [d.id, d]),
    ) as Record<DeskId, Desk>;
    expect(isDeskActive(busy.aiCalls)).toBe(true);
    expect(isDeskActive(undefined)).toBe(false);
  });

  it('เส้นทางทุกเส้นใน OFFICE_LINKS วางบนกระดานได้ (ยาวเป็นบวก)', () => {
    for (const link of OFFICE_LINKS) {
      const g = pathGeometry(link.from, link.to);
      expect(g.length, `${link.from}->${link.to}`).toBeGreaterThan(0);
      expect(Number.isFinite(g.angleDeg)).toBe(true);
    }
  });
});
