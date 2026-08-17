// @vitest-environment node
/**
 * กองเลนสรรหา 3 แหล่ง (R2b) — ป้ายแหล่ง · prefix ของ person_ref · การตัดคนซ้ำ
 *
 * พังเงียบที่คุมไว้:
 * - prefix เพี้ยน → ปุ่ม "รับไปตามต่อ" แปลง person_ref กลับไม่ได้ (splitPersonRef)
 * - ตัดซ้ำผิดฝั่ง → คนเดียวโดนสองสายเรื่องงานเดียวกัน (คนละ ref คิวไม่กันให้)
 */
import { describe, expect, it } from 'vitest';
import {
  RECRUIT_SOURCE_LABEL,
  RECRUIT_LANE_SOURCES,
  countBySource,
  dedupePoolByPhone,
  fromChecklistCard,
  fromIrecruitCandidate,
  fromSoRecruitLead,
  poolCandidateText,
  recruitSourceLabel,
  type RecruitPoolCandidate,
} from '../../api/_lib/recruitLanePool.js';
import { toE164Thai } from '../../api/_lib/thaiPhone.js';
import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '../..');

describe('ป้ายบอกแหล่ง — เจ้าของขอให้เห็นทุกคน', () => {
  it('มีป้ายครบทุกแหล่ง และเป็นข้อความไทยที่คนอ่านรู้เรื่อง', () => {
    expect(RECRUIT_SOURCE_LABEL).toEqual({
      irecruit: 'จาก iRecruit',
      so_recruit: 'จากฐานใหม่',
      checklist: 'จาก Checklist',
      declined: 'เคยปฏิเสธงานอื่น',
    });
    expect(recruitSourceLabel('checklist')).toBe('จาก Checklist');
  });

  it('🔴 กองของเลนสรรหามีแค่ 3 แหล่ง — `declined` เป็นของเลนคัดสรร ห้ามปน', () => {
    expect(RECRUIT_LANE_SOURCES).toEqual(['irecruit', 'so_recruit', 'checklist']);
    expect(RECRUIT_LANE_SOURCES).not.toContain('declined');
    // matcher ของเลนสรรหาต้องไม่แตะกองคนที่ปฏิเสธเลย (เส้นแบ่งสองเลนที่เจ้าของย้ำ)
    const src = fs.readFileSync(path.join(root, 'api/_lib/recruitLaneMatcher.ts'), 'utf8');
    expect(src).not.toMatch(/declinedApplicantsSql|fromDeclinedApplicant/);
  });
});

describe('mapper ต่อแหล่ง', () => {
  it('iRecruit → ref `ir-<id>` · ชื่อ-นามสกุลรวมกัน · ตำแหน่งรวม 2 ฟิลด์', () => {
    const c = fromIrecruitCandidate({
      id: 206387,
      first_name: 'สมชาย',
      last_name: 'ใจดี',
      phone_number: '081-234-5678',
      position_name: 'พนักงานขับรถผู้บริหาร',
      job_name_th: 'พนักงานขับรถ',
      location_label: 'เมือง, ชลบุรี',
      sex: 'ชาย',
      age: 35,
      driving_licenses: ['ท.2'],
      created_at: '2026-08-01T00:00:00.000Z',
    });
    expect(c.source).toBe('irecruit');
    expect(c.ref).toBe('ir-206387');
    expect(c.full_name).toBe('สมชาย ใจดี');
    expect(c.position_text).toBe('พนักงานขับรถผู้บริหาร พนักงานขับรถ');
    expect(c.phone_number).toBe('081-234-5678');
  });

  it('ใบสนใจฐานใหม่ → ref `app-<uuid>` · แปลง gender เป็นคำไทย · รวมที่อยู่', () => {
    const c = fromSoRecruitLead({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      full_name: 'นางสาวมาลี รักงาน',
      phone: '0899999999',
      phone_e164: '+66899999999',
      position_interest: 'ธุรการ',
      job_title: 'ธุรการหน้างาน',
      province: 'ระยอง',
      district: 'ปลวกแดง',
      gender: 'female',
      age: 28,
      license_types: null,
      created_at: '2026-08-10T02:00:00.000Z',
    });
    expect(c.ref).toBe('app-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    expect(c.sex).toBe('หญิง');
    expect(c.location_label).toBe('ปลวกแดง, ระยอง');
    expect(c.driving_licenses).toEqual([]);
  });

  it('Checklist → ref `card-<card_id>` · ไม่มีชื่อจริงใช้ชื่อเล่น', () => {
    const c = fromChecklistCard({
      card_id: 4821,
      first_name: null,
      last_name: null,
      nick_name: 'หมิว',
      mobile: '0-7801-4060',
      job1_name: 'แม่บ้าน',
      job2_name: null,
      province_name: 'กรุงเทพมหานคร',
      amphur_name: 'บางรัก',
      sex_code: 'F',
      age: 41,
      application_date: '2026-07-20T00:00:00.000Z',
    });
    expect(c.ref).toBe('card-4821');
    expect(c.full_name).toBe('หมิว');
    expect(c.position_text).toBe('แม่บ้าน');
    expect(c.sex).toBe('หญิง');
  });

  it('ไม่มีชื่อเลย → "(ไม่ระบุชื่อ)" ไม่ใช่สตริงว่าง (payload จะได้ถูกคัดที่เดียว)', () => {
    const c = fromChecklistCard({
      card_id: 1,
      first_name: null,
      last_name: null,
      nick_name: null,
      mobile: null,
      job1_name: null,
      job2_name: null,
      province_name: null,
      amphur_name: null,
      sex_code: null,
      age: null,
      application_date: null,
    });
    expect(c.full_name).toBe('(ไม่ระบุชื่อ)');
    expect(c.position_text).toBe('');
    expect(poolCandidateText(c)).toBe('');
  });
});

describe('dedupePoolByPhone — คนเดียวกันข้ามแหล่ง', () => {
  const make = (
    source: RecruitPoolCandidate['source'],
    ref: string,
    phone: string | null,
  ): RecruitPoolCandidate => ({
    source,
    ref,
    full_name: 'สมชาย ใจดี',
    phone_number: phone,
    position_text: 'ขับรถ',
    location_label: null,
    sex: null,
    age: null,
    driving_licenses: [],
    since: null,
  });

  it('เบอร์เดียวกัน เก็บแหล่งที่ใกล้ได้ใบสมัครกว่า (Checklist ชนะ iRecruit)', () => {
    const out = dedupePoolByPhone(
      [make('irecruit', 'ir-1', '0812345678'), make('checklist', 'card-9', '081-234-5678')],
      toE164Thai,
    );
    expect(out.pool.map((c) => c.ref)).toEqual(['card-9']);
    expect(out.droppedDuplicates).toEqual([
      { ref: 'ir-1', source: 'irecruit', keptRef: 'card-9' },
    ]);
  });

  it('ลำดับชนะไม่ขึ้นกับลำดับที่ส่งเข้ามา (Checklist มาทีหลังก็ยังชนะ)', () => {
    const a = dedupePoolByPhone(
      [make('checklist', 'card-9', '0812345678'), make('irecruit', 'ir-1', '0812345678')],
      toE164Thai,
    );
    expect(a.pool.map((c) => c.ref)).toEqual(['card-9']);
  });

  it('ฐานใหม่ชนะ iRecruit แต่แพ้ Checklist', () => {
    const out = dedupePoolByPhone(
      [
        make('irecruit', 'ir-1', '0812345678'),
        make('so_recruit', 'app-x', '0812345678'),
        make('checklist', 'card-9', '0812345678'),
      ],
      toE164Thai,
    );
    expect(out.pool.map((c) => c.ref)).toEqual(['card-9']);
    expect(out.droppedDuplicates).toHaveLength(2);
  });

  it('คนละเบอร์ = คนละคน ไม่ตัด', () => {
    const out = dedupePoolByPhone(
      [make('irecruit', 'ir-1', '0812345678'), make('checklist', 'card-9', '0899999999')],
      toE164Thai,
    );
    expect(out.pool).toHaveLength(2);
    expect(out.droppedDuplicates).toHaveLength(0);
  });

  it('เบอร์แปลงไม่ได้ (เบอร์บ้าน 9 หลัก/ว่าง) ไม่ถูกตัดทิ้งที่นี่ — ไปโดนคัดที่ payload', () => {
    const out = dedupePoolByPhone(
      [make('irecruit', 'ir-1', '021234567'), make('checklist', 'card-9', null)],
      toE164Thai,
    );
    expect(out.pool).toHaveLength(2);
    expect(out.droppedDuplicates).toHaveLength(0);
  });

  it('เบอร์แปลงไม่ได้หลายคน ไม่ถูกยุบรวมกันเป็นคนเดียว', () => {
    const out = dedupePoolByPhone(
      [make('irecruit', 'ir-1', null), make('irecruit', 'ir-2', null), make('irecruit', 'ir-3', '')],
      toE164Thai,
    );
    expect(out.pool.map((c) => c.ref)).toEqual(['ir-1', 'ir-2', 'ir-3']);
  });
});

describe('countBySource', () => {
  it('คืนครบทุกแหล่งเสมอ แม้แหล่งนั้นจะไม่มีใคร (ช่องบนจอต้องไม่หาย)', () => {
    expect(countBySource([])).toEqual({ irecruit: 0, so_recruit: 0, checklist: 0, declined: 0 });
  });
});
