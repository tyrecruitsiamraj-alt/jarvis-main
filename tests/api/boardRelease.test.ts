import { describe, expect, it } from 'vitest';

import {
  RELEASE_STEP_ORDER,
  RELEASE_STEP_TEXT,
  buildReleaseLedger,
  filterByReleaseLane,
  filterByReleaseStep,
  releasableJobsOf,
  releaseLaneOf,
  releaseProgressOf,
  releaseStepOf,
  stillSourcing,
  type ReleaseFacts,
} from '../../src/lib/boardRelease';
import type { JobRequest } from '../../src/types';

/**
 * หัวหน้ากล่องงาน = "ทั้งหมด / ปล่อยแล้ว / ยังไม่ปล่อย"
 * (เจ้าของเคาะชื่อสามก้อนนี้เอง 28 ส.ค. 2569 — เหตุผลเต็มอยู่หัวไฟล์ `boardRelease.ts`)
 *
 * 🔴 หัวใจของเทสต์ชุดนี้คือ **เลขต้องกระทบยอดกันได้** — โปรเจกต์นี้เคยโดนเจ้าของจับได้
 * ว่าหน้าจอโกหกตัวเลข 3 ครั้ง ทุกตัวเลขบนหัวจึงต้องบวกลงตัวเป๊ะ
 */

type Over = Partial<JobRequest> & { id: string };

function job(over: Over): JobRequest {
  return { source: 'siamraj', work_status: '', ...over } as JobRequest;
}

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

describe('releaseLaneOf — อยู่ในทะเบียนปล่อยหรือยัง', () => {
  const facts = factsOf({ released: ['b'] });

  it('ไม่อยู่ในทะเบียน = ยังไม่ปล่อย', () => {
    expect(releaseLaneOf(job({ id: 'a' }), facts)).toBe('unreleased');
  });

  it('อยู่ในทะเบียน = ปล่อยแล้ว', () => {
    expect(releaseLaneOf(job({ id: 'b' }), facts)).toBe('released');
  });

  /**
   * 🔴 เจ้าของสั่งยุบก้อน "ไม่ต้องปล่อย" ทิ้ง 28 ส.ค. 2569
   * (*"คำว่า ไม่ต้องปล่อย ฉันให้ใช้ว่า ยังไม่ปล่อย"*)
   * ⇒ ใบที่ ERP พาไปเริ่มงานแล้วแต่ไม่เคยกดปล่อย **นับเป็น "ยังไม่ปล่อย" บนจอ**
   */
  it('ใบที่เริ่มงานแล้วแต่ไม่เคยกดปล่อย ก็ยังนับเป็น "ยังไม่ปล่อย" บนจอ', () => {
    expect(releaseLaneOf(job({ id: 'c', work_status: 'daily_work' }), facts)).toBe('unreleased');
  });
});

describe('stillSourcing — ความจริงที่ปุ่มปล่อยเป็นชุดต้องรู้', () => {
  /**
   * 🔴 จอไม่โชว์เรื่องนี้แล้ว แต่ปุ่มต้องรู้ — ไม่งั้นปล่อยเป็นชุดแล้วไปประกาศหาคน
   * ของตำแหน่งที่มีคนทำอยู่ (วัดจริง 27 ส.ค. 2569 เจอ 23 ใบแบบนี้)
   */
  it('ยังเป็นงานหาคน = true · ERP พาไปต่อแล้ว = false', () => {
    expect(stillSourcing(job({ id: 'a' }))).toBe(true);
    expect(stillSourcing(job({ id: 'b', work_status: 'in_progress' }))).toBe(true);
    expect(stillSourcing(job({ id: 'c', work_status: 'daily_work' }))).toBe(false);
    expect(stillSourcing(job({ id: 'd', work_status: 'waiting_interview' }))).toBe(false);
  });

  it('สถานะที่ไม่รู้จัก = ยังเป็นงานหาคน (ห้ามให้ใบหลุดหายจากงาน)', () => {
    expect(stillSourcing(job({ id: 'x', work_status: 'อะไรก็ไม่รู้' }))).toBe(true);
  });
});

describe('releaseStepOf — ไล่ถอยหลังจากปลายทาง', () => {
  it('มีลิงก์แล้ว = ขั้น 4 (ชนะทุกอย่าง ห้ามถูกดึงกลับ)', () => {
    const facts = factsOf({ links: ['a'] });
    expect(releaseStepOf(job({ id: 'a', list_note: 'ติดเรื่องรถ' }), facts)).toBe('publish');
  });

  it('แก้ข้อมูลที่จะขึ้นประกาศแล้วแต่ยังไม่มีลิงก์ = ขั้น 3 สวัสดิการ', () => {
    expect(
      releaseStepOf(
        job({ id: 'a', field_overrides: { override_province: 'ระยอง' } } as Over),
        factsOf({}),
      ),
    ).toBe('benefits');
  });

  it('มีแต่หมายเหตุ = ขั้น 2 ใส่สถานที่', () => {
    expect(releaseStepOf(job({ id: 'a', list_note: 'รอ HR ยืนยันค่าแรง' }), factsOf({}))).toBe(
      'place',
    );
  });

  it('ไม่มีร่องรอยเลย = ขั้น 1 ตรวจใบขอ', () => {
    expect(releaseStepOf(job({ id: 'a' }), factsOf({}))).toBe('info');
  });

  it('field_overrides ที่ว่างเปล่าไม่นับว่าแก้แล้ว', () => {
    expect(
      releaseStepOf(job({ id: 'a', field_overrides: { override_province: null } } as Over), factsOf({})),
    ).toBe('info');
  });

  it('หมายเหตุที่เป็นช่องว่างล้วนไม่นับ', () => {
    expect(releaseStepOf(job({ id: 'a', list_note: '   ' }), factsOf({}))).toBe('info');
  });
});

describe('buildReleaseLedger — 🔴 เลขต้องกระทบยอดกันได้', () => {
  const jobs = [
    // ยังไม่ปล่อย — ครบทั้ง 4 ขั้น
    job({ id: 'n1' }),
    job({ id: 'n2' }),
    job({ id: 'note1', list_note: 'ติดค่าแรง' }),
    job({ id: 'ed1', field_overrides: { override_province: 'ชลบุรี' } } as Over),
    job({ id: 'lk1' }),
    // ยังไม่ปล่อย แต่ ERP พาไปเริ่มงานแล้ว ⇒ อยู่ในจอ แต่ปล่อยเป็นชุดไม่ได้
    job({ id: 'moved', work_status: 'daily_work' }),
    // ปล่อยแล้ว — มีคนสมัคร 1 ใบ (3 คน) · เงียบ 1 ใบ
    job({ id: 'r1' }),
    job({ id: 'r2' }),
  ];
  const facts = factsOf({ links: ['lk1'], released: ['r1', 'r2'], applicants: { r1: 3 } });
  const led = buildReleaseLedger(jobs, facts);

  it('ปล่อยแล้ว + ยังไม่ปล่อย = ทั้งหมด', () => {
    expect(led.released + led.unreleased).toBe(led.all);
    expect(led.all).toBe(jobs.length);
  });

  it('ผลรวมทุกขั้น = จำนวนใบที่ยังไม่ปล่อยเป๊ะ', () => {
    expect(led.steps.reduce((n, s) => n + s.count, 0)).toBe(led.unreleased);
  });

  it('ใบที่ปล่อยแล้ว แบ่งเป็นมีคนสมัคร/เงียบ แล้วบวกกลับได้', () => {
    expect(led.releasedWithApplicants + led.releasedSilent).toBe(led.released);
    expect(led.releasedWithApplicants).toBe(1);
    expect(led.releasedSilent).toBe(1);
  });

  it('หัวคนรวมของใบที่มีคนสมัคร — เจ้าของขอเห็น "จำนวนเท่าไหร่"', () => {
    expect(led.applicantHeads).toBe(3);
  });

  /** 🔴 ตัวหารคือ "ทั้งหมด" — ชุดเดียวกับหน้าหลัก (เดิมกล่องงานใช้ตัวหารของตัวเอง) */
  it('เปอร์เซ็นต์คิดจากทั้งหมด ไม่ใช่ตัวหารพิเศษ', () => {
    // ปล่อยแล้ว 2 จาก 8 ใบ
    expect(led.percent).toBe(25);
  });

  it('ไม่มีใบเลย = ไม่โชว์เปอร์เซ็นต์ (ห้ามขึ้น 0% ทั้งที่ไม่มีอะไร)', () => {
    const empty = buildReleaseLedger([], factsOf({}));
    expect(empty.all).toBe(0);
    expect(empty.percent).toBeNull();
    expect(empty.steps.every((s) => s.count === 0)).toBe(true);
  });

  it('แต่ละขั้นได้เลขที่ถูกต้อง', () => {
    const by = Object.fromEntries(led.steps.map((s) => [s.key, s.count]));
    // n1 n2 moved = ขั้น 1 · note1 = ขั้น 2 · ed1 = ขั้น 3 · lk1 = ขั้น 4
    expect(by).toEqual({ info: 3, place: 1, benefits: 1, publish: 1 });
  });

  /** 🔴 ปล่อยเป็นชุดได้ **น้อยกว่า** ยังไม่ปล่อย เพราะตัดใบที่เริ่มงานแล้วออก */
  it('ใบที่ปล่อยเป็นชุดได้ ต้องตัดใบที่ ERP พาไปต่อแล้วออก', () => {
    expect(led.unreleased).toBe(6);
    expect(led.releasable).toBe(5);
    expect(releasableJobsOf(jobs, facts).map((j) => j.id)).not.toContain('moved');
  });
});

/**
 * 🔴 บทเรียนจากการให้โมเดลอ่อนสุดสวมบทพนักงานใหม่มาเล่นหน้านี้ (27 ส.ค. 2569)
 * มันอ่าน `"1. ยังไม่มีใครตรวจ 100"` แล้วเข้าใจว่าเป็น **ข้อมูลสถานะ** ไม่ใช่ขั้นตอน
 * ⇒ `label` ต้องเป็นคำสั่งงาน (กริยา) · สภาพของใบไปอยู่ `state`
 */
describe('ป้ายขั้นต้องเป็น "งานที่ต้องทำ" ไม่ใช่ "สภาพของใบ"', () => {
  const NEGATIVE = ['ยัง', 'ไม่', 'รอ', 'แล้ว'];

  it('เรียง 1→4 ตรงกับเลขขั้นที่โชว์', () => {
    expect(RELEASE_STEP_ORDER.map((k) => RELEASE_STEP_TEXT[k].step)).toEqual([1, 2, 3, 4]);
  });

  it('ทุกขั้นมี label / state / hint / todo ครบ และ label ≠ state', () => {
    for (const key of RELEASE_STEP_ORDER) {
      const t = RELEASE_STEP_TEXT[key];
      for (const f of ['label', 'state', 'hint', 'todo'] as const) {
        expect(t[f].trim().length, `${key}.${f}`).toBeGreaterThan(0);
      }
      expect(t.label, `${key}: label กับ state ต้องไม่ใช่ข้อความเดียวกัน`).not.toBe(t.state);
    }
  });

  it('label ห้ามขึ้นต้นด้วยคำบอกสภาพ (ยัง/ไม่/รอ) — นั่นคือ state', () => {
    for (const key of RELEASE_STEP_ORDER) {
      const label = RELEASE_STEP_TEXT[key].label.trim();
      for (const bad of NEGATIVE) {
        expect(label.startsWith(bad), `${key}.label = "${label}" อ่านเป็นสภาพ`).toBe(false);
      }
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
  const led = buildReleaseLedger(jobs, facts);

  it('กรองตามก้อนได้จำนวนเท่าเลขบนหัว', () => {
    expect(filterByReleaseLane(jobs, facts, 'released')).toHaveLength(led.released);
    expect(filterByReleaseLane(jobs, facts, 'unreleased')).toHaveLength(led.unreleased);
    expect(filterByReleaseLane(jobs, facts, 'all')).toHaveLength(led.all);
  });

  it('ไม่เลือกก้อน = ได้ทุกใบ', () => {
    expect(filterByReleaseLane(jobs, facts, null)).toHaveLength(jobs.length);
  });

  it('กรองตามขั้นได้จำนวนเท่าเลขบนขั้นนั้น', () => {
    for (const s of led.steps) {
      expect(filterByReleaseStep(jobs, facts, s.key), `ขั้น ${s.key}`).toHaveLength(s.count);
    }
  });

  it('กรองตามขั้นไม่ดึงใบที่ปล่อยแล้วเข้ามา', () => {
    const all = RELEASE_STEP_ORDER.flatMap((k) => filterByReleaseStep(jobs, facts, k)).map(
      (j) => j.id,
    );
    expect(all).not.toContain('r');
  });
});

/**
 * แถบความคืบหน้าบนการ์ด (เจ้าของสั่ง 31 ส.ค. 2569)
 * 🔴 ปลายสเกล = "ส่งประกาศขึ้นหน้าสาธารณะ" ไม่ใช่ "หาคนได้ครบ"
 */
describe('releaseProgressOf — ใบนี้อยู่ขั้นไหน กี่ %', () => {
  const plain = job({ id: 'p1' });
  const noted = job({ id: 'p2', list_note: 'อ่านแล้ว' });

  it('ปล่อยแล้ว = 100% เสมอ ถึงจะยังไม่มีคนสมัคร', () => {
    const p = releaseProgressOf(plain, factsOf({ released: ['p1'] }));
    expect(p.released).toBe(true);
    expect(p.percent).toBe(100);
    expect(p.doneSteps).toBe(p.totalSteps);
    expect(p.currentStep).toBeNull();
  });

  it('ค้างขั้น 1 = ยังไม่ได้ทำอะไรเลย ⇒ 0% (ห้ามปัดขึ้นให้ดูสวย)', () => {
    const p = releaseProgressOf(plain, factsOf({}));
    expect(p.currentStep).toBe(1);
    expect(p.doneSteps).toBe(0);
    expect(p.percent).toBe(0);
  });

  it('มีลิงก์แล้วรอกดส่ง = ขั้น 4 ทำเสร็จ 3 ขั้น ⇒ 75%', () => {
    const p = releaseProgressOf(plain, factsOf({ links: ['p1'] }));
    expect(p.currentStep).toBe(4);
    expect(p.doneSteps).toBe(3);
    expect(p.percent).toBe(75);
  });

  it('% เดินหน้าตามขั้นเสมอ ไม่มีขั้นไหนถอยหลัง', () => {
    const seen = [
      releaseProgressOf(plain, factsOf({})).percent,
      releaseProgressOf(noted, factsOf({})).percent,
      releaseProgressOf(plain, factsOf({ links: ['p1'] })).percent,
      releaseProgressOf(plain, factsOf({ released: ['p1'] })).percent,
    ];
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    }
  });

  it('ป้ายของใบที่ยังไม่ปล่อย ต้องเป็นงานที่ต้องทำ ไม่ใช่สภาพของใบ', () => {
    const p = releaseProgressOf(plain, factsOf({}));
    expect(p.label).toBe(RELEASE_STEP_TEXT.info.label);
    expect(p.label).not.toMatch(/^(ยัง|ไม่|รอ)/);
  });
});
