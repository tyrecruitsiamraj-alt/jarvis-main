import { describe, expect, it } from 'vitest';

import { CONVEYOR_STEPS } from '@/lib/soRecruitNav';
import { buildNextTasks, pickNextTask } from '@/lib/nextTask';

describe('buildNextTasks — คิวงานหน้าแรก', () => {
  it('ยังไม่รู้ค่า (null / ไม่มีคีย์) = ไม่มีบรรทัด ห้ามเดาเป็น 0', () => {
    expect(buildNextTasks({})).toEqual([]);
    expect(buildNextTasks({ followPastDue: null, applicantsUntouched: null })).toEqual([]);
  });

  it('รู้ว่าเป็น 0 = ไม่มีงานให้ทำ ⇒ ก็ไม่มีบรรทัดเหมือนกัน', () => {
    expect(buildNextTasks({ followPastDue: 0, applicantsUntouched: 0 })).toEqual([]);
  });

  it('เรียงตามความเสียหาย ไม่ใช่ตามจำนวน — คนที่รอสายอยู่มาก่อนยอดสะสม', () => {
    const tasks = buildNextTasks({ slaBreached: 202, followPastDue: 1 });
    expect(tasks.map((t) => t.key)).toEqual(['follow-past-due', 'sla-breached']);
    expect(pickNextTask(tasks)?.count).toBe(1);
  });

  it('หัวข้อมีตัวเลขจริงอยู่ในประโยค — คนอ่านแล้วรู้ปริมาณโดยไม่ต้องดูป้าย', () => {
    const [t] = buildNextTasks({ applicantsUntouched: 7 });
    expect(t.title).toContain('7');
    expect(t.reason).toBeTruthy();
    expect(t.badge).toBeTruthy();
    expect(t.path).toBe('/jobs/board?view=list');
    expect(t.stepKey).toBe('matching');
  });

  it('ทุกใบมีทางไปต่อ และคีย์ลำดับงานมีอยู่จริง', () => {
    const tasks = buildNextTasks({
      followPastDue: 1,
      followNotDispatched: 1,
      needsHuman: 2,
      claimedIdle: 3,
      applicantsUntouched: 4,
      callsStale: 5,
      slaBreached: 6,
    });
    expect(tasks).toHaveLength(7);
    for (const t of tasks) {
      expect(t.path.startsWith('/'), t.key).toBe(true);
      expect(t.action, t.key).toBeTruthy();
      /** 🔴 ผูกกับลำดับงานด้วย **คีย์** ไม่ใช่เลขขั้น (เลิกใช้เลข 28 ส.ค. 2569) */
      expect(
        CONVEYOR_STEPS.some((s) => s.key === t.stepKey),
        `${t.key} -> ${t.stepKey}`,
      ).toBe(true);
    }
    expect(new Set(tasks.map((t) => t.key)).size).toBe(7);
  });

  it('ถังสีแดงต้องมาก่อนสีเหลือง และเหลืองมาก่อนฟ้าเสมอ', () => {
    const tasks = buildNextTasks({
      slaBreached: 99,
      applicantsUntouched: 99,
      followPastDue: 99,
    });
    expect(tasks.map((t) => t.tone)).toEqual(['danger', 'warn', 'info']);
  });

  it('ลิสต์ว่าง → pickNextTask คืน null', () => {
    expect(pickNextTask([])).toBeNull();
  });
});
