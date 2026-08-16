// @vitest-environment node
/**
 * AI matcher เลนสรรหา (R2b) — การอ่านผล AI · การตัดคนที่ได้ใบสมัครแล้ว · prompt
 *
 * พังเงียบที่คุมไว้:
 * - AI ตอบ id ของฐาน (ชนกันข้ามฐาน) แทนเลขลำดับ → join กลับผิดคน แล้วโทรผิดตัว
 * - ERP ล่มแล้วเผลอตัดทุกคนทิ้ง (null ≠ ไม่มีใครบนบอร์ด) → กองหายทั้งกอง
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildLaneMatchPrompt,
  dropCandidatesAlreadyOnBoard,
  parseLaneMatches,
  prescorePoolCandidate,
} from '../../api/_lib/recruitLaneMatcher.js';
import type { RecruitPoolCandidate } from '../../api/_lib/recruitLanePool.js';
import { toE164Thai } from '../../api/_lib/thaiPhone.js';

const root = path.join(import.meta.dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

const make = (
  source: RecruitPoolCandidate['source'],
  ref: string,
  phone: string | null,
  position = 'พนักงานขับรถ',
): RecruitPoolCandidate => ({
  source,
  ref,
  full_name: 'ทดสอบ ระบบ',
  phone_number: phone,
  position_text: position,
  location_label: null,
  sex: null,
  age: null,
  driving_licenses: [],
  since: null,
});

describe('parseLaneMatches — AI อ้างด้วยเลขลำดับ ไม่ใช่ id ของฐาน', () => {
  it('อ่าน no 1-based → index 0-based', () => {
    const out = parseLaneMatches('{"matches":[{"no":1,"tier":"green","reason":"ตรง"}]}', 3);
    expect(out).toEqual([{ index: 0, tier: 'green', reason: 'ตรง' }]);
  });

  it('รับคีย์ id/index ด้วย (โมเดลสลับคีย์บ่อย) แต่ยังแปลเป็นลำดับ', () => {
    expect(parseLaneMatches('{"matches":[{"id":"#2","tier":"yellow"}]}', 3)[0].index).toBe(1);
    expect(parseLaneMatches('{"matches":[{"index":3,"tier":"green"}]}', 3)[0].index).toBe(2);
  });

  it('เลขนอกช่วง = ทิ้ง (ดีกว่า join ผิดคน)', () => {
    expect(parseLaneMatches('{"matches":[{"no":0},{"no":4},{"no":99}]}', 3)).toEqual([]);
  });

  it('เลขซ้ำ = เก็บครั้งแรกครั้งเดียว', () => {
    const out = parseLaneMatches(
      '{"matches":[{"no":2,"tier":"green","reason":"a"},{"no":2,"tier":"red","reason":"b"}]}',
      3,
    );
    expect(out).toHaveLength(1);
    expect(out[0].reason).toBe('a');
  });

  it('JSON ที่ไม่มี matches = [] (ไม่มีใครเข้าข่าย ไม่ใช่ error)', () => {
    expect(parseLaneMatches('{}', 3)).toEqual([]);
    expect(parseLaneMatches('{"matches":[]}', 3)).toEqual([]);
  });

  it('ตอบไม่ใช่ JSON = โยน error ให้ลูป retry จับ (พฤติกรรมเดียวกับเลนคัดสรร)', () => {
    expect(() => parseLaneMatches('ขอโทษครับ ไม่มีข้อมูล', 3)).toThrow();
  });

  it('tier ที่ไม่รู้จักถูกทำให้เป็นเหลืองตอน map (ค่า raw ยังส่งผ่านมาที่นี่)', () => {
    expect(parseLaneMatches('{"matches":[{"no":1}]}', 1)[0].tier).toBe('yellow');
  });
});

describe('dropCandidatesAlreadyOnBoard — เส้นแบ่งสรรหา→คัดสรร', () => {
  it('คนที่เบอร์อยู่บนบอร์ดแล้ว = ได้ใบสมัครแล้ว → ตัดออกจากกองสรรหา', () => {
    const board = new Set(['+66812345678']);
    const out = dropCandidatesAlreadyOnBoard(
      [make('irecruit', 'ir-1', '0812345678'), make('irecruit', 'ir-2', '0899999999')],
      board,
      toE164Thai,
    );
    expect(out.kept.map((c) => c.ref)).toEqual(['ir-2']);
    expect(out.dropped).toBe(1);
  });

  it('คนถัง Checklist ไม่ถูกตัด ทั้งที่อยู่บนบอร์ด — ถังนั้นคือกองของเลนนี้', () => {
    const board = new Set(['+66812345678']);
    const out = dropCandidatesAlreadyOnBoard([make('checklist', 'card-9', '0812345678')], board, toE164Thai);
    expect(out.kept).toHaveLength(1);
    expect(out.dropped).toBe(0);
  });

  it('ERP อ่านไม่ได้ (null) = ไม่ตัดใครเลย — "เช็คไม่ได้" ไม่เท่ากับ "ไม่มีใครบนบอร์ด"', () => {
    const out = dropCandidatesAlreadyOnBoard(
      [make('irecruit', 'ir-1', '0812345678'), make('so_recruit', 'app-x', '0899999999')],
      null,
      toE164Thai,
    );
    expect(out.kept).toHaveLength(2);
    expect(out.dropped).toBe(0);
  });

  it('บอร์ดว่าง (set ว่าง) = ไม่มีใครขึ้นบอร์ด — ต่างจาก null ตรงที่ยังเช็คได้', () => {
    const out = dropCandidatesAlreadyOnBoard([make('irecruit', 'ir-1', '0812345678')], new Set(), toE164Thai);
    expect(out.kept).toHaveLength(1);
  });

  it('เบอร์แปลงไม่ได้ = ไม่ตัด (เทียบไม่ได้ ไม่ใช่ว่าไม่อยู่บนบอร์ด)', () => {
    const out = dropCandidatesAlreadyOnBoard(
      [make('irecruit', 'ir-1', '021234567')],
      new Set(['+66812345678']),
      toE164Thai,
    );
    expect(out.kept).toHaveLength(1);
  });
});

describe('prescorePoolCandidate', () => {
  const terms = ['พนักงานขับรถ', 'ขับรถ'];
  it('ชื่อตำแหน่งตรงกับใบขอได้น้ำหนักมากกว่าคำย่อย', () => {
    const exact = prescorePoolCandidate(make('irecruit', 'a', null, 'พนักงานขับรถ'), terms, 'พนักงานขับรถ');
    const partial = prescorePoolCandidate(make('irecruit', 'b', null, 'ขับรถส่งของ'), terms, 'พนักงานขับรถ');
    expect(exact).toBeGreaterThan(partial);
  });
  it('ไม่มีข้อความตำแหน่ง = 0 (ไม่ใช่ติดลบ/พัง)', () => {
    expect(prescorePoolCandidate(make('irecruit', 'c', null, ''), terms, 'พนักงานขับรถ')).toBe(0);
  });
});

describe('buildLaneMatchPrompt', () => {
  const spec = {
    request_no: 'DS001',
    job_family_code: 'DRIVER',
    job_family_label: 'พนักงานขับรถ',
    summary: 'ต้องการคนขับรถผู้บริหาร',
    must_have: ['ใบขับขี่'],
    adjacent_positions: [{ title: 'พนักงานส่งของ', tier: 'yellow', note: null }],
  } as unknown as Parameters<typeof buildLaneMatchPrompt>[0];

  it('ทุกคนในรายการมีป้ายบอกแหล่ง (เจ้าของขอ — สรรหาต้องรู้ว่าตามเอกสารแบบไหน)', () => {
    const { user } = buildLaneMatchPrompt(spec, 'พนักงานขับรถ', [
      make('checklist', 'card-1', '0811111111'),
      make('so_recruit', 'app-1', '0822222222'),
      make('irecruit', 'ir-1', '0833333333'),
    ]);
    expect(user).toContain('แหล่ง: จาก Checklist');
    expect(user).toContain('แหล่ง: จากฐานใหม่');
    expect(user).toContain('แหล่ง: จาก iRecruit');
  });

  it('สั่งให้ตอบเป็นเลขลำดับ และบอกช่วงที่ยอมรับ', () => {
    const { user } = buildLaneMatchPrompt(spec, 'พนักงานขับรถ', [make('irecruit', 'ir-1', '0811111111')]);
    expect(user).toContain('#1');
    expect(user).toContain('(1-1)');
  });

  it('ห้ามส่งเบอร์/ชื่อจริงเข้า prompt ของ AI (ข้อมูลส่วนตัวไม่จำเป็นต่อการจัดอันดับ)', () => {
    const { user } = buildLaneMatchPrompt(spec, 'พนักงานขับรถ', [make('irecruit', 'ir-1', '0811111111')]);
    expect(user).not.toContain('0811111111');
    expect(user).not.toContain('ทดสอบ ระบบ');
  });
});

describe('โครงเส้นทาง — handler ต่อของจริงครบ', () => {
  it('handler เลนสรรหาเรียก matcher 3 แหล่ง แล้วส่งคิวเมื่อ send=1', () => {
    const src = read('api/_handlers/matching-recruit-lane.ts');
    expect(src).toMatch(/matchRecruitLaneCandidatesForJob\(/);
    expect(src).toMatch(/enqueueLumosInterviewForRecruitLane\(/);
    expect(src).toMatch(/getQuery\(req, 'send'\) === '1'/);
  });

  it('จำกัดตามแผนกเหมือนเส้นอื่น — ห้ามอ้าง jobId ข้ามแผนก', () => {
    const src = read('api/_handlers/matching-recruit-lane.ts');
    expect(src).toMatch(/loadMatchingBuScope\(req\.user\)/);
  });

  it('matcher ตัดคน "แจ้งเข้าแล้ว" ออกจากถัง Checklist', () => {
    expect(read('api/_lib/recruitLaneMatcher.ts')).toMatch(/excludeInformed: true/);
    expect(read('api/_lib/boardCandidatesSql.ts')).toMatch(/ISNULL\(r\.is_inform, 'N'\) <> 'Y'/);
  });
});
