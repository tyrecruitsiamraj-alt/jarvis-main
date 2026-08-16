// @vitest-environment node
/**
 * เลนคัดสรร — เส้น "ชวนกลับ" คนที่เคยตอบไม่สนใจ (16 ส.ค. 2569)
 *
 * พังเงียบที่คุมไว้:
 * - เอาคนที่ปฏิเสธ **ใบขอใบนี้** มาเสนอซ้ำ → โทรถามงานเดิมที่เขาปฏิเสธไปแล้ว
 * - นับเฉพาะผลจากคิว AI ลืมผลที่คนโทรเอง → กองหายไปครึ่ง
 * - กองนี้หลุดไปปนกับเลนสรรหา → เส้นแบ่งสองเลนพัง
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  DECLINED_POOL_MAX,
  buildDeclinedApplicantsSql,
} from '../../api/_lib/declinedApplicantsSql.js';
import { fromDeclinedApplicant, RECRUIT_SOURCE_LABEL } from '../../api/_lib/recruitLanePool.js';
import { buildRecallInterviewPayload } from '../../api/_lib/lumosDispatch.js';
import { LUMOS_DISPATCH_TRIGGERS, DEFAULT_LUMOS_DISPATCH_MODE } from '../../src/lib/lumosDispatchMode.js';

const root = path.join(import.meta.dirname, '../..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const sql = buildDeclinedApplicantsSql();

describe('buildDeclinedApplicantsSql', () => {
  it('เอาเฉพาะผลล่าสุดที่เป็น declined', () => {
    expect(sql).toContain(`l.outcome = 'declined'`);
    expect(sql).toContain('distinct on (phone)');
  });

  it('🔴 ตัดคนที่ปฏิเสธใบขอใบนี้เอง ($1) — ไม่ใช่หวังพึ่ง cooldown 30 วัน', () => {
    expect(sql).toContain(`coalesce(l.job_id, '') <> $1`);
  });

  it('รวมผลสองทาง — คิว AI กับถังที่คนรับไปโทรเอง', () => {
    expect(sql).toContain('lumos_dispatch_queue');
    expect(sql).toContain('candidate_call_holds');
    expect(sql).toContain('union all');
  });

  it('เบอร์ในคิวอ่านสองคีย์ (reminder/interview)', () => {
    expect(sql).toContain(`coalesce(q.payload->>'recipient_phone', q.payload->>'phone')`);
  });

  it('ต้องมีเบอร์ที่ใช้โทรได้ และตัดคนที่รับเข้าทำงานแล้ว', () => {
    expect(sql).toContain('a.phone_e164 is not null');
    expect(sql).toContain(`coalesce(a.status, 'new') <> 'converted'`);
  });

  it('param 2 ตัวพอดี ($1 jobId · $2 limit)', () => {
    expect(sql).toContain('$1');
    expect(sql).toContain('limit $2');
    expect(sql).not.toContain('$3');
  });

  it('เพดานกองไม่โตเกินคุม', () => {
    expect(DECLINED_POOL_MAX).toBe(600);
  });
});

describe('fromDeclinedApplicant', () => {
  const row = {
    id: 'aaaa-bbbb',
    full_name: 'สมชาย ใจดี',
    phone: '0812345678',
    phone_e164: '+66812345678',
    position_interest: 'ขับรถ',
    job_title: 'พนักงานขับรถ',
    province: 'ชลบุรี',
    district: 'ศรีราชา',
    gender: 'male',
    age: 35,
    license_types: null,
    created_at: '2026-07-01T00:00:00.000Z',
  };

  it('ref เป็น `app-<uuid>` — เขาคือใบสมัครใบเดิม ไม่ใช่คนใหม่', () => {
    expect(fromDeclinedApplicant(row).ref).toBe('app-aaaa-bbbb');
  });

  it('ติดป้าย declined ไม่ใช่ป้ายของเลนสรรหา', () => {
    expect(fromDeclinedApplicant(row).source).toBe('declined');
    expect(RECRUIT_SOURCE_LABEL.declined).toBe('เคยปฏิเสธงานอื่น');
  });
});

describe('buildRecallInterviewPayload', () => {
  const job = {
    job_description_code_1: 'พนักงานขับรถ',
    unit_name: 'ศูนย์กระจายสินค้าชลบุรี',
  };
  const result = { jobId: 'siamraj-sql:DS001', job_family_label: 'พนักงานขับรถ' };
  const at = new Date('2026-08-16T03:00:00.000Z');

  it('คำถามแรกอ้างว่าเขาเคยสมัครไว้ — ไม่ใช่แนะนำตัวใหม่เหมือนเลนสรรหา', () => {
    const p = buildRecallInterviewPayload(
      job,
      result,
      { ref: 'app-1', full_name: 'สมชาย', phone_number: '0812345678', position_text: 'ขับรถ' },
      at,
    );
    expect(p?.questions[0]).toContain('เคยสมัครงานไว้กับเรา');
    expect(p?.questions[0]).toContain('พนักงานขับรถ');
  });

  it('client_candidate_id รูปเดียวกับเส้นอื่น', () => {
    const p = buildRecallInterviewPayload(
      job,
      result,
      { ref: 'app-1', full_name: 'สมชาย', phone_number: '0812345678', position_text: '' },
      at,
    );
    expect(p?.client_candidate_id).toBe('siamraj-sql:DS001::app-1');
  });

  it('เบอร์โทรไม่ได้ / ไม่มีชื่อ = null (ไม่เข้าคิว)', () => {
    const base = { ref: 'app-1', full_name: 'สมชาย', phone_number: '0812345678', position_text: '' };
    expect(buildRecallInterviewPayload(job, result, { ...base, phone_number: '021234567' }, at)).toBeNull();
    expect(buildRecallInterviewPayload(job, result, { ...base, full_name: ' ' }, at)).toBeNull();
  });
});

describe('เส้นขนานของเลนคัดสรร', () => {
  it('มี trigger แยกของตัวเอง และค่าเริ่มต้นเป็น manual (ห้ามโทรเองโดยไม่มีใครสั่ง)', () => {
    expect(LUMOS_DISPATCH_TRIGGERS).toContain('selection_recall');
    expect(DEFAULT_LUMOS_DISPATCH_MODE.selection_recall).toBe('manual');
  });

  it('worker เรียกเส้นนี้ผ่าน isAutoDispatchEnabled เท่านั้น — ห้าม enqueue ตรง ๆ', () => {
    const src = read('api/_lib/matchPrecomputeWorker.ts');
    expect(src).toContain(`isAutoDispatchEnabled('selection_recall')`);
    const recallFn = src.slice(src.indexOf('async function runSelectionRecall'));
    expect(recallFn.indexOf(`isAutoDispatchEnabled('selection_recall')`)).toBeLessThan(
      recallFn.indexOf('enqueueLumosInterviewForRecall'),
    );
  });

  it('handler เลนคัดสรรใช้กองของตัวเอง ไม่ใช่กองเลนสรรหา', () => {
    const src = read('api/_handlers/matching-selection-recall.ts');
    expect(src).toMatch(/matchDeclinedApplicantsForJob\(/);
    expect(src).not.toMatch(/matchRecruitLaneCandidatesForJob/);
    expect(src).toMatch(/loadMatchingBuScope\(req\.user\)/);
  });
});
