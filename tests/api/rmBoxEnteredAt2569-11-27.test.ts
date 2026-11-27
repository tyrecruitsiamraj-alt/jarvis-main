// @vitest-environment node
/**
 * คอลัมน์ "เข้ากล่อง" แท็บผู้สมัคร (เจ้าของ 27 พ.ย. 2569 "บอกให้หน่อยได้ไหมว่า มากล่องนี้วันไหน" · Choice แบบ ข คอลัมน์กดเรียงได้)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rmBoxEnteredAt, sortByBoxEntered } from '../../src/lib/rmBoxEnteredAt';
import type { PublicApplication } from '../../src/lib/publicApplicationsApi';

const app = (id: string, x: Partial<PublicApplication>) =>
  ({ id, full_name: 'อัมรี ปิ', status: 'new', job_id: 'siamraj-sql:OPL6911030', created_at: '2026-11-27T07:38:33.000Z', ...x }) as PublicApplication;

// อัมรี: กรอก 14:38 → AI สนใจ 14:43
const amri = app('c41f0a52-7d3e-4b1a-9f60-2b8e5d7a1c01', { last_call_outcome: 'confirmed', last_call_at: '2026-11-27T07:43:00.000Z', ai_answer: { micro: 'said_yes', at: '2026-11-27T07:43:00.000Z' } as PublicApplication['ai_answer'] });
// อินทัช: AI สนใจ 3 พ.ย. · ติดต่อสำเร็จ 3 พ.ย. 11:30 · ระบบปล่อยจากหมิว 27 พ.ย. 08:56
const intach = app('c41f0a52-7d3e-4b1a-9f60-2b8e5d7a1c02', {
  created_at: '2026-11-03T03:00:00.000Z',
  last_call_outcome: 'confirmed',
  last_call_at: '2026-11-03T03:22:00.000Z',
  last_contact_ok: true,
  last_contact_at: '2026-11-03T04:30:00.000Z',
  unclaimed_at: '2026-11-27T01:56:00.000Z',
  unclaimed_from_name: 'หมิว',
} as Partial<PublicApplication>);

describe('เวลาเข้ากล่อง', () => {
  it('สนใจ = เวลาคำตอบที่ใหม่กว่า', () => {
    expect(rmBoxEnteredAt(amri)).toEqual({ at: '2026-11-27T07:43:00.000Z', released: false });
  });
  it('ปล่อยกลับมา = เวลาที่ปล่อย (ใหม่กว่าคำตอบ)', () => {
    expect(rmBoxEnteredAt(intach)).toEqual({ at: '2026-11-27T01:56:00.000Z', released: true });
  });
  it('ไม่โทร = เวลากดไม่โทร · ส่ง AI ไม่ได้ = เวลาที่ตัวส่งจด · ไม่มีเหตุการณ์ = เวลาเข้าระบบ', () => {
    expect(rmBoxEnteredAt(app('c41f0a52-7d3e-4b1a-9f60-2b8e5d7a1c03', { no_call_reason_id: 4, no_call_box: 'own', no_call_at: '2026-11-27T05:00:00.000Z' })).at).toBe('2026-11-27T05:00:00.000Z');
    expect(rmBoxEnteredAt(app('c41f0a52-7d3e-4b1a-9f60-2b8e5d7a1c04', { ai_block_reason: 'ใบขอยังไม่ตั้งรายได้', ai_block_at: '2026-11-27T02:00:00.000Z' })).at).toBe('2026-11-27T02:00:00.000Z');
    expect(rmBoxEnteredAt(app('c41f0a52-7d3e-4b1a-9f60-2b8e5d7a1c05', {})).at).toBe('2026-11-27T07:38:33.000Z');
  });
  it('เรียงใหม่สุดก่อน / เก่าสุดก่อน', () => {
    expect(sortByBoxEntered([intach, amri], 'desc').map((r) => r.id.slice(-2))).toEqual(['01', '02']);
    expect(sortByBoxEntered([amri, intach], 'asc').map((r) => r.id.slice(-2))).toEqual(['02', '01']);
  });
  it('หัวคอลัมน์กดเรียงได้ · API ส่ง ai_block_at', () => {
    expect(readFileSync('src/components/recruit-rm/RmTable.tsx', 'utf8')).toContain('data-testid="rm-sort-entered"');
    expect(readFileSync('src/components/recruit-rm/RmWorkspace.tsx', 'utf8')).toContain("onEnteredSort={tab === 'candidates' && !bucket ? cycleEnteredSort : undefined}");
    expect(readFileSync('api/_handlers/job-applications.ts', 'utf8')).toContain('select id::text, ai_block_reason, ai_block_at from');
  });
});

describe('ป๊อปจับคู่มีปุ่มไปหน้าการติดต่อ (เจ้าของ 27 พ.ย. 2569)', () => {
  it('ลิงก์ไปแท็บการติดต่อ', () => {
    const t = readFileSync('src/components/matching/MatchPeopleTable.tsx', 'utf8');
    expect(t).toContain('data-testid="match-go-contact"');
    expect(t).toContain("const CONTACT_PAGE_PATH = '/jobs/board?view=contact';");
  });
});
