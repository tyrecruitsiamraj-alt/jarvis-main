/**
 * ═══ แก้ "ติดตามครั้งที่" ในป๊อปแก้ไข (เจ้าของ 21 ต.ค. 2569 "แก้ไขครั้งที่ติดตามไม่ได้อะ") ═══
 * เดิม: ขั้น 3 ของป๊อปแก้ไขไม่มีช่องนี้ · ไม่อ่านค่าเดิม · เส้นแก้ไขไม่รับค่า
 * + ประวัติการสมัครนับใบนี้ด้วย ("สมัคร 2 ครั้ง แต่ประวัติการสมัครขึ้น 1 ครั้ง")
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { editDayBaseOf, editDayNosOf } from '@/lib/followEditDayNo';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('editDayNosOf', () => {
  const base = editDayBaseOf([
    { id: 'a', call_day: 2 },
    { id: 'b', call_day: 3 },
    { id: 'c', call_day: null },
  ]);

  it('ค่าเดิม = ครั้งที่ของวันแรก · ไม่มี = 1', () => {
    expect(base).toEqual({ ids: ['a', 'b', 'c'], days: [2, 3, 1], first: 2 });
  });

  it('🔴 เลือก 4 จาก 2 = ขยับทุกวันไป +2', () => {
    expect(editDayNosOf(base, 4)).toEqual([
      { id: 'a', no: 4 },
      { id: 'b', no: 5 },
      { id: 'c', no: 3 },
    ]);
  });

  it('ไม่เปลี่ยน = ไม่ส่งอะไร', () => {
    expect(editDayNosOf(base, 2)).toEqual([]);
    expect(editDayNosOf(null, 5)).toEqual([]);
  });

  it('เลือกขั้นที่มีชื่อ (ประเมิน 91) = ทุกสายเป็นขั้นนั้น', () => {
    expect(editDayNosOf(base, 91).map((x) => x.no)).toEqual([91, 91, 91]);
  });

  it('ไม่ต่ำกว่า 1', () => {
    expect(editDayNosOf(editDayBaseOf([{ id: 'a', call_day: 5 }, { id: 'b', call_day: 1 }]), 1).map((x) => x.no)).toEqual([1, 1]);
  });
});

describe('ต่อสายครบ', () => {
  it('ป๊อปแก้ไขมีช่อง + อ่านค่าเดิม + ส่งตอนบันทึก', () => {
    const page = read('src/pages/follow/FollowPage.tsx');
    expect(page).toContain('data-testid="edit-day-no"');
    expect(page).toContain('setPlanDayStart(base.first);');
    expect(page).toContain('...(dayNos.length > 0 ? { plan_day_nos: dayNos } : {}),');
  });

  it('API แก้ทั้งชุดรับ plan_day_nos เฉพาะสายของชุดที่ยังไม่ปิด', () => {
    const api = read('api/_handlers/follow.ts');
    expect(api).toContain('set plan_day_no = $3');
    expect(api).toMatch(/where id = \$2 and \$\{setWhere\} and cancelled_at is null and completed_at is null/);
  });

  it('ประวัติการสมัครนับใบนี้ด้วย + ป้าย "ใบนี้"', () => {
    const api = read('api/_handlers/job-applications.ts');
    expect(api).toContain('is_current: r.id === id,');
    expect(api).not.toMatch(/where phone_e164 = \$1 and id <> \$2/);
    expect(read('src/components/recruit-rm/ApplicantRecordTables.tsx')).toContain('{h.is_current ? <span className="block text-xs text-muted-foreground">ใบนี้</span> : null}');
  });
});
