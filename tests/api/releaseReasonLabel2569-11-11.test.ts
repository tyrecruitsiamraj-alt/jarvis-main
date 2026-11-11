// @vitest-environment node
/** แท็บการโทรบอกเหตุจริงที่งานหลุดจากมือ (เจ้าของ 11 พ.ย. 2569 "คืนงานไม่บันทึกผล คืออะไร" → Choice "บอกเหตุจริง") */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detailCallRows } from '@/lib/applicantDetail';

const hold = (id: string, release_reason: string | null, released = true) => ({
  id,
  held_at: `2026-11-0${id}T03:00:00Z`,
  held_by_name: 'อ้น',
  released_at: released ? '2026-11-10T03:00:00Z' : null,
  release_reason,
  outcome: null,
  note: null,
});

describe('เหตุที่คืนงาน', () => {
  it('หลุด 24 ชม. · ส่ง AI · กดคืน · หัวหน้าโอน · ไม่รู้เหตุ = คำเดิม · ยังถือ = ถือไว้โทรอยู่', () => {
    const rows = detailCallRows([], [hold('1', 'expired'), hold('2', 'to_ai'), hold('3', 'manual'), hold('4', 'transferred'), hold('5', null), hold('6', null, false)]);
    const by = Object.fromEntries(rows.map((r) => [r.key, r.result]));
    expect(by).toEqual({
      'staff-1': 'หลุด ครบ 24 ชม. ไม่ลงผล',
      'staff-2': 'ส่งให้ AI โทร',
      'staff-3': 'กดคืนงาน',
      'staff-4': 'หัวหน้าโอนงาน',
      'staff-5': 'คืนงานโดยไม่บันทึกผล',
      'staff-6': 'ถือไว้โทรอยู่',
    });
  });
});

describe('คอลัมน์ผลบอกติดต่อได้/ไม่ได้ + เหตุผลที่เลือก (เจ้าของ 11 พ.ย. 2569)', () => {
  const log = (id: string, createdAt: string, p: { ok: boolean; reasonLabel?: string | null; appointmentAt?: string | null }) => ({
    id, applicationId: 'app-1', reasonId: null, appointmentPlace: null, jobId: null, jobLabel: null, note: null, createdByName: 'ไอซ์', createdAt,
    reasonLabel: p.reasonLabel ?? null, appointmentAt: p.appointmentAt ?? null, ok: p.ok,
  });
  it('กดโทรแล้วลงผล = ผลอยู่แถวเดียวกัน · ลงผลโดยไม่กดโทรในระบบ = แถวของตัวเอง · ยังไม่ลงผล = บอกตรง ๆ', () => {
    const rows = detailCallRows(
      [{ id: 9, status: 'completed', created_at: '2026-10-12T07:00:00Z', result_at: '2026-10-12T07:16:00Z', outcome: 'confirmed', attempts: 1, next_attempt_at: null }],
      [],
      [
        { id: 'd1', at: '2026-10-28T04:03:00Z', by_name: 'Administrator' },
        { id: 'd2', at: '2026-11-05T04:00:00Z', by_name: 'ไอซ์' },
      ],
      [
        log('l1', '2026-10-28T04:10:00Z', { ok: false, reasonLabel: 'ปิดเครื่อง' }),
        log('l2', '2026-11-03T02:00:00Z', { ok: true, reasonLabel: 'ไม่สะดวกวันนัด' }),
      ],
    );
    expect(rows.map((r) => [r.key, r.result])).toEqual([
      ['dial-d2', 'โทรหาผู้สมัคร · ยังไม่ลงผล'],
      ['log-l2', 'ติดต่อได้ · นัดหมายไม่สำเร็จ · ไม่สะดวกวันนัด'],
      ['dial-d1', 'ติดต่อไม่ได้ · ปิดเครื่อง'],
      ['ai-9', 'ติดต่อได้ · สนใจ'],
    ]);
  });
});

describe('ติดต่อสำเร็จแล้วต้องเลือกผลนัด (เจ้าของ 11 พ.ย. 2569 "บังคับเลือก ถึงจะไม่หลุดการบันทึก")', () => {
  it('บันทึกไม่ได้จนกว่าจะเลือก นัดหมาย / นัดหมายไม่สำเร็จ · ติดต่อไม่สำเร็จต้องมีเหตุผล', () => {
    const src = readFileSync('src/components/recruit-rm/ApplicantContactDialog.tsx', 'utf8');
    expect(src).toContain("if (contactPicked === 'ok' && apptPick === null) return setError(");
    expect(src).toContain("if (contactFailPicked && !selectedReason) return setError('เลือกเหตุผลที่ติดต่อไม่สำเร็จ');");
    expect(src).toContain('detailCallRows(extras.aiCalls, extras.staffCalls, extras.dialCalls, logs)');
  });
});
