// @vitest-environment node
/**
 * ตั้งเป็นคนโทร แต่ AI โทรไปแล้วจริง = นับเป็น AI (เจ้าของ Choice 12 ต.ค. 2569 "นับเป็น AI โทร (แนะนำ)")
 * เคสจริง: สายส่งคนแทน 18 สายถูกสลับเป็นคนโทรหลัง Lumos โทรไปแล้ว — หน้าหลักนับเป็นคน แต่ผลมาจาก AI
 * 🔴 สามที่ต้องใช้กติกาเดียวกัน: ตัวกรองหน้าติดตาม (`followCallerOf`) · แผงผลโทร (`FOLLOW_EFFECTIVE_MODE_SQL`)
 *    · กล่อง AI/คน หน้าหลัก (`FOLLOW_PLAN_AI_SQL` / `FOLLOW_PLAN_STAFF_SQL`) — ไม่งั้นกล่องไม่เท่าแผง
 */
import { describe, expect, it } from 'vitest';
import { followCallerOf } from '../../src/lib/followListFilter';
import { FOLLOW_PLAN_AI_SQL, FOLLOW_PLAN_STAFF_SQL } from '../../api/_lib/homeAiShareSql';
import { FOLLOW_BUCKET_SQL, FOLLOW_EFFECTIVE_MODE_SQL } from '../../api/_lib/homeLumosSummarySql';

describe('followCallerOf — ใครโทรจริง', () => {
  it('ตั้ง AI = AI เสมอ', () => {
    expect(followCallerOf({ call_mode: 'ai' })).toBe('ai');
    expect(followCallerOf({ call_mode: null as never })).toBe('ai');
  });

  it('🔴 ตั้งคนโทร แต่คิว AI จบแล้ว (completed/failed) และคนยังไม่ลงผล = AI', () => {
    expect(followCallerOf({ call_mode: 'manual', call_status: 'completed', staff_call_outcome: null })).toBe('ai');
    expect(followCallerOf({ call_mode: 'manual', call_status: 'failed', staff_call_outcome: '  ' })).toBe('ai');
  });

  it('คนลงผลเองแล้ว / AI ยังไม่ได้โทร = คนโทร', () => {
    expect(followCallerOf({ call_mode: 'manual', call_status: 'completed', staff_call_outcome: 'confirmed' })).toBe('manual');
    expect(followCallerOf({ call_mode: 'manual', call_status: 'pending' })).toBe('manual');
    expect(followCallerOf({ call_mode: 'manual', call_status: 'cancelled' })).toBe('manual');
    expect(followCallerOf({ call_mode: 'manual' })).toBe('manual');
  });
});

describe('SQL ฝั่งหน้าหลัก — กติกาเดียวกับจอ', () => {
  it('แผงผลโทร: โหมดจริง = คนโทร + ไม่มีผลคน + คิวจบ ⇒ ai · ถังใช้โหมดจริง', () => {
    const sql = FOLLOW_EFFECTIVE_MODE_SQL.replace(/\s+/g, ' ');
    expect(sql).toMatch(/f\.call_mode = 'manual' and nullif\(btrim\(f\.staff_call_outcome\), ''\) is null/);
    expect(sql).toMatch(/q\.status in \('completed', 'failed'\) then 'ai'/);
    expect(FOLLOW_BUCKET_SQL).toContain(`(${FOLLOW_EFFECTIVE_MODE_SQL}) is distinct from 'manual'`);
  });

  it('กล่อง AI/คน: คนโทร = ตั้งคนโทร และไม่ใช่เคสที่ AI โทรไปแล้ว · AI = ส่วนกลับ (AI + คน = ทั้งหมด)', () => {
    const ai = FOLLOW_PLAN_AI_SQL.replace(/\s+/g, ' ');
    const staff = FOLLOW_PLAN_STAFF_SQL.replace(/\s+/g, ' ');
    expect(ai).toMatch(/^\(f\.call_mode is distinct from 'manual' or \(f\.call_mode = 'manual'/);
    expect(staff).toMatch(/^\(f\.call_mode = 'manual' and not \(f\.call_mode = 'manual'/);
    for (const s of [ai, staff]) {
      expect(s).toMatch(/exists \(select 1 from .*lumos_dispatch_queue.* q where q\.channel = 'reminder'/);
      expect(s).toContain("q.status in ('completed', 'failed')");
    }
  });
});
