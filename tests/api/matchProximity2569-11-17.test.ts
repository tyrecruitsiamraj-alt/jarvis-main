// @vitest-environment node
/**
 * จับคู่คนไม่ตรง (เจ้าของ 17 พ.ย. 2569 "match ไม่ตรงเลย" · Choice แก้ครบชุด)
 * วัดจริง: OPL6911056 (อมตะ ชลบุรี) แนะนำ 15 คน อยู่ชลบุรี 1 · LBM6903002 (สุขุมวิท 49 · 25–50 ปี) อายุ 52–55 ได้เขียว 4 คน
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { areaRankOf, canonProvince, jobAreaOf, matchGate, orderPoolForShortlist, regionOfProvince } from '../../src/lib/matchProximity';
import { areaVerdict } from '../../src/lib/candidateVerdicts';
import { greenCount } from '../../api/_lib/boardCandidateMatcher';
import { BOARD_MATCH_POOL_SINCE } from '../../api/_lib/boardCandidatesSql';
import type { JobRequest } from '../../src/types';

const AMATA = { location_address: '700 นิคมอุตสาหกรรมอมตะซิตี้ ต.ดอนหัวฬ่อ อ.เมืองชลบุรี จ.ชลบุรี 20000' };
const SUKHUMVIT = { location_address: 'โรงพยาบาลสมิติเวช สุขุมวิท 49 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพมหานคร 10110', gender_requirement: 'ไม่ระบุ', age_range_min: 25, age_range_max: 50 };

describe('ชื่อจังหวัด · ภาค', () => {
  it('กรุงเทพเขียนได้หลายแบบ = จังหวัดเดียวกัน', () => {
    expect(canonProvince('กรุงเทพฯ')).toBe('กรุงเทพมหานคร');
    expect(canonProvince('กทม.')).toBe('กรุงเทพมหานคร');
    expect(canonProvince('จ.ชลบุรี')).toBe('ชลบุรี');
    expect(canonProvince('')).toBeNull();
  });
  it('ครบ 77 จังหวัด แบ่ง 6 ภาค', () => {
    expect(regionOfProvince('ชลบุรี')).toBe('east');
    expect(regionOfProvince('ระยอง')).toBe('east');
    expect(regionOfProvince('บึงกาฬ')).toBe('northeast');
    expect(regionOfProvince('แม่ฮ่องสอน')).toBe('north');
    expect(regionOfProvince('สมุทรปราการ')).toBe('central');
  });
});

describe('ความใกล้กับงาน', () => {
  const amata = jobAreaOf(AMATA);
  it('อ่านที่ตั้งงานจากที่อยู่ ERP · ค่าที่แก้เองมาก่อน', () => {
    expect(amata.province).toBe('ชลบุรี');
    expect(jobAreaOf({ ...AMATA, override_province: 'ระยอง' }).province).toBe('ระยอง');
  });
  it('อำเภอเดียวกัน 0 · จังหวัดเดียวกัน 1 · ภาคเดียวกัน 2 · ไม่มีที่อยู่ 3 · คนละภาค 4', () => {
    expect(areaRankOf(amata, { province_name: 'ชลบุรี', amphur_name: 'อ.เมืองชลบุรี' })).toBe(0);
    expect(areaRankOf(amata, { province_name: 'ชลบุรี', amphur_name: 'บ้านบึง' })).toBe(1);
    expect(areaRankOf(amata, { province_name: 'ระยอง' })).toBe(2);
    expect(areaRankOf(amata, { province_name: null })).toBe(3);
    expect(areaRankOf(amata, { province_name: 'บึงกาฬ' })).toBe(4);
  });
});

describe('ตัดก่อนส่ง AI · เรียงตามความใกล้', () => {
  it('เพศ/อายุที่รู้ค่าและผิดเงื่อนไข = ตัด · ไม่รู้ค่า = ผ่าน', () => {
    expect(matchGate(SUKHUMVIT, { age: 55, sex_code: 'M' })).toEqual({ ok: false, reason: 'age' });
    expect(matchGate(SUKHUMVIT, { age: 40 })).toEqual({ ok: true });
    expect(matchGate(SUKHUMVIT, { age: null })).toEqual({ ok: true });
    expect(matchGate({ gender_requirement: 'ชาย' }, { sex_code: 'F' })).toEqual({ ok: false, reason: 'gender' });
    expect(matchGate({ gender_requirement: 'ชาย' }, { sex_code: null })).toEqual({ ok: true });
    expect(matchGate({ gender_requirement: 'ชาย/หญิง' }, { sex_code: 'F' })).toEqual({ ok: true });
  });

  it('สกิลเท่ากันหมด (คนขับรถ) → คนใกล้มาก่อน ไม่ใช่คนล่าสุดทั้งประเทศ', () => {
    // ลำดับเดิม = เคลื่อนไหวล่าสุดก่อน: บึงกาฬ เลย มุกดาหาร ... ชลบุรีอยู่ท้าย
    const pool = [
      { id: 1, province_name: 'บึงกาฬ', amphur_name: null, sex_code: 'M', age: 40 },
      { id: 2, province_name: 'เลย', amphur_name: null, sex_code: 'M', age: 40 },
      { id: 3, province_name: null, amphur_name: null, sex_code: 'M', age: 40 },
      { id: 4, province_name: 'ระยอง', amphur_name: null, sex_code: 'M', age: 40 },
      { id: 5, province_name: 'ชลบุรี', amphur_name: 'บ้านบึง', sex_code: 'M', age: 40 },
      { id: 6, province_name: 'ชลบุรี', amphur_name: 'เมืองชลบุรี', sex_code: 'F', age: 40 },
    ];
    const r = orderPoolForShortlist({ gender_requirement: 'ชาย', age_range_min: 25, age_range_max: 55 }, jobAreaOf(AMATA), pool, () => 3);
    expect(r.scored.map((x) => x.c.id)).toEqual([5, 4, 3, 1, 2]);
    expect(r.gatedOut).toEqual({ gender: 1, age: 0 });
  });

  it('ถังพอหรือยัง นับเฉพาะเขียว (เหลืองไกลไม่ปิดการค้น Re Use / Drop)', () => {
    expect(greenCount([{ tier: 'green' }, { tier: 'yellow' }, { tier: 'yellow' }, { tier: 'red' }])).toBe(1);
  });
});

describe('ป้ายที่อยู่บนจอ', () => {
  const job = SUKHUMVIT as unknown as JobRequest;
  it('จังหวัดเดียวกัน = ผ่าน · ปริมณฑล = เตือน · ไม่มีที่อยู่ = เตือน (ไม่ข้าม) · คนละภาค = ไม่ผ่าน', () => {
    expect(areaVerdict(job, ['เขตดินแดง', 'กรุงเทพฯ'])).toBe('pass');
    expect(areaVerdict(job, ['บางพลี', 'สมุทรปราการ'])).toBe('warn');
    expect(areaVerdict(job, [null, null])).toBe('warn');
    expect(areaVerdict(job, ['เมืองระยอง', 'ระยอง'])).toBe('fail');
    expect(areaVerdict(job, [null, 'แม่ฮ่องสอน'])).toBe('fail');
  });
});

describe('ตัวจับคู่ใช้ของใหม่ + ผลเก่าแมทใหม่', () => {
  it('บอร์ดและ iRecruit เรียงตามความใกล้ก่อนตัด shortlist · ห้ามเขียวถ้าไม่มีที่อยู่/คนละภาค · AI ไม่ประเมินพื้นที่/เงินเดือน', () => {
    for (const f of ['api/_lib/boardCandidateMatcher.ts', 'api/_lib/irecruitCandidateMatcher.ts']) {
      const src = readFileSync(f, 'utf8');
      expect(src).toContain('orderPoolForShortlist(');
      expect(src).toMatch(/aiTier === 'green' && a != null && a >= 3 \? 'yellow'/);
      // อ่านที่ตั้งงานไม่ออก = ไม่ลดใคร (เดิมเกือบทำให้ใบที่ไม่มีที่อยู่ไม่มีใครได้เขียวเลย)
      expect(src).toContain('area.province ? (areaById.get(');
      expect(src).toContain('ห้ามเขียนเรื่อง');
    }
    expect(readFileSync('api/_lib/boardCandidateMatcher.ts', 'utf8')).toContain('greenCount(matches) >= target');
  });
  it('ผลก่อนเปลี่ยนวิธีแมทใหม่ · ไม่ตั้งเวลาในอนาคต · คิดใหม่ทุก 24 ชม.', () => {
    expect(new Date(BOARD_MATCH_POOL_SINCE).getTime()).toBe(new Date('2026-11-17T11:20:00+07:00').getTime());
    expect(readFileSync('api/_lib/matchPrecomputeWorker.ts', 'utf8')).toContain('parseIntEnv(process.env.MATCH_PRECOMPUTE_STALE_HOURS, 24, 0)');
  });
});
