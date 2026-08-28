import { describe, expect, it } from 'vitest';

import {
  RELEASE_STEP_ORDER,
  RELEASE_STEP_TEXT,
  buildReleaseLedger,
  filterByReleaseLane,
  filterByReleaseStep,
  releaseLaneOf,
  releaseStepOf,
  type ReleaseFacts,
} from '../../src/lib/boardRelease';
import type { JobRequest } from '../../src/types';

/**
 * หัวหน้ากล่องงาน = "ปล่อยไปแล้วเท่าไหร่ เหลืออีกเท่าไหร่"
 * (เจ้าของสั่งรื้อ 27 ส.ค. 2569 — เหตุผลเต็มอยู่หัวไฟล์ `src/lib/boardRelease.ts`)
 *
 * 🔴 หัวใจของเทสต์ชุดนี้คือ **เลขต้องกระทบยอดกันได้** — โปรเจกต์นี้เคยโดนเจ้าของจับได้
 * ว่าหน้าจอโกหกตัวเลข 3 ครั้ง ทุกตัวเลขบนหัวหน้าจึงต้องบวกลงตัวเป๊ะ
 */

type Over = Partial<JobRequest> & { id: string };

function job(over: Over): JobRequest {
  return { source: 'siamraj', work_status: '', ...over } as JobRequest;
}

/** facts ที่คุมได้จากเทสต์ — ตั้งค่าต่อ id */
function factsOf(cfg: {
  links?: string[];
  released?: string[];
  applicants?: Record<string, number>;
}): ReleaseFacts {
  const links = new Set(cfg.links ?? []);
  const released = new Set(cfg.released ?? []);
  return {
    hasLink: (j) => links.has(j.id),
    isReleased: (j) => released.has(j.id),
    applicants: (j) => cfg.applicants?.[j.id] ?? 0,
  };
}

describe('releaseLaneOf', () => {
  const facts = factsOf({ released: ['b'] });

  it('ใบที่ยังเป็นงานสรรหาและไม่ได้ปล่อย = เหลือปล่อย', () => {
    expect(releaseLaneOf(job({ id: 'a' }), facts)).toBe('toRelease');
  });

  it('ใบที่ยังเป็นงานสรรหาและปล่อยแล้ว = ปล่อยแล้ว', () => {
    expect(releaseLaneOf(job({ id: 'b' }), facts)).toBe('released');
  });

  /**
   * 🔴 เคสจริงที่ทำให้ต้องมีเลนที่สาม — วัดจริง 27 ส.ค. 2569 มี 24 ใบแบบนี้
   * ถ้านับเข้า "เหลือปล่อย" จะกลายเป็นสั่งให้คนไปหาคนของตำแหน่งที่มีคนทำอยู่แล้ว
   */
  it('ใบที่ระบบงานหลักพาไปต่อแล้ว = ไม่ต้องปล่อย แม้จะไม่เคยกดปล่อย', () => {
    expect(releaseLaneOf(job({ id: 'c', work_status: 'daily_work' }), facts)).toBe('movedOn');
  });

  it('สถานะที่ไม่รู้จัก = ยังเป็นงานสรรหา (ห้ามให้ใบหลุดหายจากหน้าจอ)', () => {
    expect(releaseLaneOf(job({ id: 'd', work_status: 'อะไรก็ไม่รู้' }), facts)).toBe('toRelease');
  });
});

describe('releaseStepOf — ไล่ถอยหลังจากปลายทาง', () => {
  it('มีลิงก์แล้ว = ขั้น 4 พร้อมปล่อย (ชนะทุกอย่าง ห้ามถูกดึงกลับ)', () => {
    const facts = factsOf({ links: ['a'] });
    expect(releaseStepOf(job({ id: 'a', list_note: 'ติดเรื่องรถ' }), facts)).toBe('publish');
  });

  it('แก้ข้อมูลประกาศแล้วแต่ยังไม่มีลิงก์ = ขั้น 3 รอสร้างลิงก์', () => {
    const facts = factsOf({});
    expect(
      releaseStepOf(job({ id: 'a', field_overrides: { override_province: 'ระยอง' } } as Over), facts),
    ).toBe('link');
  });

  it('มีแต่หมายเหตุ = ขั้น 2 ตรวจแล้วแต่ยังไปต่อไม่ได้', () => {
    expect(releaseStepOf(job({ id: 'a', list_note: 'รอ HR ยืนยันค่าแรง' }), factsOf({}))).toBe(
      'fields',
    );
  });

  it('ไม่มีร่องรอยเลย = ขั้น 1 ยังไม่มีใครตรวจ', () => {
    expect(releaseStepOf(job({ id: 'a' }), factsOf({}))).toBe('check');
  });

  it('field_overrides ที่ว่างเปล่าไม่นับว่าแก้แล้ว', () => {
    const j = job({ id: 'a', field_overrides: { override_province: null } } as Over);
    expect(releaseStepOf(j, factsOf({}))).toBe('check');
  });

  it('หมายเหตุที่เป็นช่องว่างล้วนไม่นับ', () => {
    expect(releaseStepOf(job({ id: 'a', list_note: '   ' }), factsOf({}))).toBe('check');
  });
});

describe('buildReleaseLedger — 🔴 เลขต้องกระทบยอดกันได้', () => {
  const jobs = [
    // เหลือปล่อย — ครบทั้ง 4 ขั้น
    job({ id: 'n1' }),
    job({ id: 'n2' }),
    job({ id: 'note1', list_note: 'ติดค่าแรง' }),
    job({ id: 'ed1', field_overrides: { override_province: 'ชลบุรี' } } as Over),
    job({ id: 'lk1' }),
    // ปล่อยแล้ว — มีคนสมัคร 1 ใบ เงียบ 1 ใบ
    job({ id: 'r1' }),
    job({ id: 'r2' }),
    // ระบบงานหลักพาไปต่อแล้ว
    job({ id: 'm1', work_status: 'waiting_interview' }),
    job({ id: 'm2', work_status: 'daily_work' }),
    job({ id: 'm3', work_status: 'waiting_start' }),
  ];
  const facts = factsOf({
    links: ['lk1'],
    released: ['r1', 'r2'],
    applicants: { r1: 3 },
  });
  const led = buildReleaseLedger(jobs, facts);

  it('สามเลนบวกกันแล้วครบใบเปิดทั้งหมด', () => {
    expect(led.toRelease + led.released + led.movedOn).toBe(led.openTotal);
    expect(led.openTotal).toBe(jobs.length);
  });

  it('ผลรวมทุกขั้นเท่ากับจำนวนใบที่เหลือปล่อยเป๊ะ', () => {
    expect(led.steps.reduce((n, s) => n + s.count, 0)).toBe(led.toRelease);
  });

  it('ใบที่ปล่อยแล้ว แบ่งเป็นมีคนสมัคร/เงียบ แล้วบวกกลับได้', () => {
    expect(led.releasedWithApplicants + led.releasedSilent).toBe(led.released);
    expect(led.releasedWithApplicants).toBe(1);
    expect(led.releasedSilent).toBe(1);
  });

  it('ตัวหารของงานปล่อยคือ "ใบที่ยังต้องหาคน" ไม่ใช่ใบเปิดทั้งหมด', () => {
    expect(led.needsRelease).toBe(led.toRelease + led.released);
    expect(led.needsRelease).toBe(7);
    expect(led.openTotal).toBe(10);
  });

  it('เปอร์เซ็นต์คิดจากตัวหารที่จริง', () => {
    // ปล่อยแล้ว 2 จาก 7 ใบที่ต้องปล่อย
    expect(led.percent).toBe(29);
  });

  it('ไม่มีงานปล่อยเลย = ไม่โชว์เปอร์เซ็นต์ (ห้ามขึ้น 0% ทั้งที่ไม่มีอะไรให้ทำ)', () => {
    const only = buildReleaseLedger([job({ id: 'x', work_status: 'daily_work' })], factsOf({}));
    expect(only.percent).toBeNull();
    expect(only.needsRelease).toBe(0);
  });

  it('แต่ละขั้นได้เลขที่ถูกต้อง', () => {
    const by = Object.fromEntries(led.steps.map((s) => [s.key, s.count]));
    expect(by).toEqual({ check: 2, fields: 1, link: 1, publish: 1 });
  });

  it('ไม่มีใบเลย = ทุกเลขเป็นศูนย์ ไม่ระเบิด', () => {
    const empty = buildReleaseLedger([], factsOf({}));
    expect(empty.openTotal).toBe(0);
    expect(empty.percent).toBeNull();
    expect(empty.steps.every((s) => s.count === 0)).toBe(true);
  });
});

describe('ป้ายและลำดับขั้น', () => {
  it('เรียง 1→4 ตรงกับเลขขั้นที่โชว์', () => {
    expect(RELEASE_STEP_ORDER.map((k) => RELEASE_STEP_TEXT[k].step)).toEqual([1, 2, 3, 4]);
  });

  it('ทุกขั้นมีป้าย/คำอธิบาย/สิ่งที่ต้องทำ ครบ ไม่ว่าง', () => {
    for (const key of RELEASE_STEP_ORDER) {
      const t = RELEASE_STEP_TEXT[key];
      expect(t.label.trim().length).toBeGreaterThan(0);
      expect(t.hint.trim().length).toBeGreaterThan(0);
      expect(t.todo.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('ตัวกรอง — เลขบนหัวต้องตรงกับการ์ดที่โชว์', () => {
  const jobs = [
    job({ id: 'a' }),
    job({ id: 'b' }),
    job({ id: 'r' }),
    job({ id: 'm', work_status: 'daily_work' }),
  ];
  const facts = factsOf({ links: ['b'], released: ['r'] });

  it('กรองตามเลนได้จำนวนเท่าเลขบนหัว', () => {
    const led = buildReleaseLedger(jobs, facts);
    expect(filterByReleaseLane(jobs, facts, 'toRelease')).toHaveLength(led.toRelease);
    expect(filterByReleaseLane(jobs, facts, 'released')).toHaveLength(led.released);
    expect(filterByReleaseLane(jobs, facts, 'movedOn')).toHaveLength(led.movedOn);
  });

  it('ไม่เลือกเลน = ได้ทุกใบ', () => {
    expect(filterByReleaseLane(jobs, facts, null)).toHaveLength(jobs.length);
  });

  it('กรองตามขั้นได้จำนวนเท่าเลขบนขั้นนั้น', () => {
    const led = buildReleaseLedger(jobs, facts);
    for (const s of led.steps) {
      expect(filterByReleaseStep(jobs, facts, s.key), `ขั้น ${s.key}`).toHaveLength(s.count);
    }
  });

  it('กรองตามขั้นไม่ดึงใบของเลนอื่นเข้ามา', () => {
    // 'r' ปล่อยแล้ว · 'm' ไปต่อแล้ว — ทั้งคู่ต้องไม่โผล่ในขั้นไหนเลย
    const all = RELEASE_STEP_ORDER.flatMap((k) => filterByReleaseStep(jobs, facts, k)).map(
      (j) => j.id,
    );
    expect(all).not.toContain('r');
    expect(all).not.toContain('m');
  });
});

/**
 * 🔴 บทเรียนจากการให้โมเดลอ่อนสุดสวมบทพนักงานใหม่มาเล่นหน้านี้ (27 ส.ค. 2569)
 * มันอ่าน `"1. ยังไม่มีใครตรวจ 100"` แล้วเข้าใจว่าเป็น **ข้อมูลสถานะ** ไม่ใช่ขั้นตอน
 * ⇒ `label` ต้องเป็นคำสั่งงาน (กริยา) · สภาพของใบไปอยู่ `state`
 * เทสต์นี้กันไม่ให้ใครเปลี่ยนกลับเป็นป้ายสถานะโดยไม่รู้ตัว
 */
describe('ป้ายขั้นต้องเป็น "งานที่ต้องทำ" ไม่ใช่ "สภาพของใบ"', () => {
  const NEGATIVE = ['ยัง', 'ไม่', 'รอ', 'แล้ว'];

  it('ทุกขั้นมี label (กริยา) และ state (สภาพ) แยกกัน ไม่ซ้ำกัน', () => {
    for (const key of RELEASE_STEP_ORDER) {
      const t = RELEASE_STEP_TEXT[key];
      expect(t.state.trim().length, `${key}.state`).toBeGreaterThan(0);
      expect(t.label, `${key}: label กับ state ต้องไม่ใช่ข้อความเดียวกัน`).not.toBe(t.state);
    }
  });

  it('label ห้ามขึ้นต้นด้วยคำบอกสภาพ (ยัง/ไม่/รอ) — นั่นคือ state', () => {
    for (const key of RELEASE_STEP_ORDER) {
      const label = RELEASE_STEP_TEXT[key].label.trim();
      for (const bad of NEGATIVE) {
        expect(
          label.startsWith(bad),
          `${key}.label = "${label}" อ่านเป็นสภาพ ไม่ใช่งานที่ต้องทำ`,
        ).toBe(false);
      }
    }
  });

  it('label สั้นพอที่จะอยู่บนชิปได้ (ไม่เกิน 20 ตัวอักษร)', () => {
    for (const key of RELEASE_STEP_ORDER) {
      expect(RELEASE_STEP_TEXT[key].label.length, key).toBeLessThanOrEqual(20);
    }
  });
});
