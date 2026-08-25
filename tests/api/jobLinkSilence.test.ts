import { describe, it, expect } from 'vitest';
import {
  SILENT_AFTER_DAYS,
  selectSilentLinkRows,
  silentRowFactLine,
  silentRowNextStep,
} from '@/lib/jobLinkSilence';
import type { JobRequest } from '@/types';
import { buildCountIndex, buildJobKeyIndex } from '@/lib/jobKeyIndex';

function job(id: string): JobRequest {
  return {
    id,
    unit_name: 'หน่วยงาน',
    location_address: '',
    status: 'open',
    urgency: 'advance',
    total_income: 0,
    job_type: 'driver',
    job_category: 'private',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_date: '2026-08-01',
    created_at: '2026-08-01T00:00:00.000Z',
  };
}

const TODAY = new Date('2026-08-21T05:00:00.000Z');

/** 5 วันก่อนวันอ้างอิง — พ้นเกณฑ์ ≥3 วันแล้ว */
const POSTED_5D = '2026-08-16T03:00:00.000Z';

function input(over: Partial<Parameters<typeof selectSilentLinkRows>[0]> = {}) {
  return {
    jobs: [job('a')],
    // ⚠️ `Map` ใช้ได้เพราะ SilentLinkInput รับ `{ get(id) }` — สัญญาเดียวกับ Map โดยเจตนา
    latestPostedAt: new Map([['a', POSTED_5D]]),
    clicksByJob: new Map<string, number>(),
    applicantCounts: new Map<string, number>(),
    leadCounts: new Map<string, number>(),
    ...over,
  };
}

/**
 * 🔴 กองนี้ต้องเล็กจริง — เจ้าของตีตกกล่องส้ม "ยังไม่ปล่อยลิงก์ 277/283" ไปแล้ว
 * เพราะมันคือเกือบทั้งบอร์ด · เทสต์ชุดนี้ล็อกว่า "ปล่อยแล้วเท่านั้น" ห้ามเผลอกลับด้าน
 */
describe('selectSilentLinkRows', () => {
  it('🔴 ใบที่ยังไม่ปล่อยลิงก์ต้องไม่เข้ากองนี้เด็ดขาด (กันกลับไปเป็นกล่องส้ม 277 ใบ)', () => {
    const rows = selectSilentLinkRows(input({ latestPostedAt: new Map() }), TODAY);
    expect(rows).toHaveLength(0);
  });

  it('ปล่อยแล้ว ไม่มีใบสมัคร และครบ 3 วัน = เข้ากอง', () => {
    const rows = selectSilentLinkRows(input(), TODAY);
    expect(rows).toHaveLength(1);
    expect(rows[0].daysSincePosted).toBe(5);
  });

  it(`ยังไม่ครบ ${SILENT_AFTER_DAYS} วัน = ยังไม่นับ (เร็วเกินจะสรุปว่าไม่ได้ผล)`, () => {
    const rows = selectSilentLinkRows(
      input({ latestPostedAt: new Map([['a', '2026-08-20T03:00:00.000Z']]) }),
      TODAY,
    );
    expect(rows).toHaveLength(0);
  });

  it('มีผู้สมัครแล้ว = ออกจากกอง (ลิงก์ได้ผลแล้ว)', () => {
    expect(
      selectSilentLinkRows(input({ applicantCounts: new Map([['a', 1]]) }), TODAY),
    ).toHaveLength(0);
  });

  it('มี Lead แล้วก็ถือว่าได้ผล = ออกจากกอง', () => {
    expect(selectSilentLinkRows(input({ leadCounts: new Map([['a', 2]]) }), TODAY)).toHaveLength(0);
  });

  it('เหตุผลมาจากยอดคลิกจริง ไม่ใช่การเดา', () => {
    const zero = selectSilentLinkRows(input(), TODAY)[0];
    expect(zero.reason).toBe('no_views');
    const viewed = selectSilentLinkRows(input({ clicksByJob: new Map([['a', 12]]) }), TODAY)[0];
    expect(viewed.reason).toBe('viewed_no_apply');
  });

  it('เรียงปล่อยมานานสุดขึ้นก่อน (คำบนจอต้องตรงกับเลขที่ใช้เรียง)', () => {
    const rows = selectSilentLinkRows(
      input({
        jobs: [job('new'), job('old')],
        latestPostedAt: new Map([
          ['new', '2026-08-17T03:00:00.000Z'],
          ['old', '2026-08-04T03:00:00.000Z'],
        ]),
      }),
      TODAY,
    );
    expect(rows.map((r) => r.job.id)).toEqual(['old', 'new']);
  });

  it('วันที่อ่านไม่ออก = ไม่นับ (ห้ามเดาเป็น 0 วัน)', () => {
    expect(
      selectSilentLinkRows(input({ latestPostedAt: new Map([['a', 'ไม่ใช่วันที่']]) }), TODAY),
    ).toHaveLength(0);
  });

  it('ข้อความ "ทำไปแล้ว" ตรงกับเหตุผล และมีเลขรองรับทุกคำ', () => {
    const zero = selectSilentLinkRows(input(), TODAY)[0];
    expect(silentRowFactLine(zero)).toBe('ปล่อยลิงก์ 5 วันก่อน · ยังไม่มีใครเห็นลิงก์ (คลิก 0)');
    const viewed = selectSilentLinkRows(input({ clicksByJob: new Map([['a', 12]]) }), TODAY)[0];
    expect(silentRowFactLine(viewed)).toBe('ปล่อยลิงก์ 5 วันก่อน · มีคนกดดู 12 ครั้ง แต่ยังไม่มีใครกรอก');
  });

  it('🔴 ปุ่มขั้นถัดไปต้องพาไปแท็บที่ถูกในป๊อปเดิม (ห้ามเปิด Dialog ใหม่)', () => {
    const zero = selectSilentLinkRows(input(), TODAY)[0];
    expect(silentRowNextStep(zero)).toEqual({ label: 'เพิ่มช่องทาง', popupTab: 'genlink' });
    const viewed = selectSilentLinkRows(input({ clicksByJob: new Map([['a', 3]]) }), TODAY)[0];
    expect(silentRowNextStep(viewed)).toEqual({ label: 'แก้ประกาศ', popupTab: 'edit' });
  });
});

/**
 * 🔴 บั๊กใบล่วงหน้า (แก้ 23 ส.ค. 2569) — ก่อนแก้ **เทสต์ชุดข้างบนผ่านหมดทั้งที่บั๊กยังอยู่**
 * เพราะทุกเคสใช้ id เปล่า (`'a'`) ไม่มี prefix · ของจริง feed ส่ง `siamraj-pre:XXX`
 * แต่ประกาศเก็บ `siamraj-sql:XXX` → ใบล่วงหน้าหลุดออกจากกองนี้ 100% แบบเงียบสนิท
 */
describe('ใบล่วงหน้า: id ของ feed ไม่ตรงกับ id ที่ประกาศเก็บ', () => {
  const PRE = 'siamraj-pre:LBM6908001';
  const SQL = 'siamraj-sql:LBM6908001';

  it('feed ให้ pre: · ประกาศเก็บ sql: → ต้องยังเข้ากอง', () => {
    const rows = selectSilentLinkRows(
      input({
        jobs: [job(PRE)],
        latestPostedAt: buildJobKeyIndex([[SQL, POSTED_5D]]),
      }),
      TODAY,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].job.id).toBe(PRE);
  });

  it('ยอดผู้สมัครที่คีย์ด้วย sql: ต้องกันใบ pre: ออกจากกองได้ (ไม่งั้นทวงซ้ำคนที่สมัครแล้ว)', () => {
    const rows = selectSilentLinkRows(
      input({
        jobs: [job(PRE)],
        latestPostedAt: buildJobKeyIndex([[SQL, POSTED_5D]]),
        applicantCounts: buildCountIndex({ [SQL]: 2 }),
      }),
      TODAY,
    );
    expect(rows).toHaveLength(0);
  });

  it('ยอดคลิกที่คีย์ด้วย sql: ต้องทำให้เหตุผลของใบ pre: ถูกต้อง (ไม่ใช่ no_views ปลอม)', () => {
    const rows = selectSilentLinkRows(
      input({
        jobs: [job(PRE)],
        latestPostedAt: buildJobKeyIndex([[SQL, POSTED_5D]]),
        clicksByJob: buildJobKeyIndex([[SQL, 12]]),
      }),
      TODAY,
    );
    expect(rows[0].clicks).toBe(12);
    expect(rows[0].reason).toBe('viewed_no_apply');
    expect(silentRowNextStep(rows[0])).toEqual({ label: 'แก้ประกาศ', popupTab: 'edit' });
  });

  it('ห้าม over-match — เลขที่ใกล้กันต้องไม่ถูกจับคู่', () => {
    const rows = selectSilentLinkRows(
      input({
        jobs: [job('siamraj-pre:LBM690800')],
        latestPostedAt: buildJobKeyIndex([[SQL, POSTED_5D]]),
      }),
      TODAY,
    );
    expect(rows).toHaveLength(0);
  });
});
