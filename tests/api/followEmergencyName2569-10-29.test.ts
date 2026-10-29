/**
 * เบอร์ฉุกเฉินบนหน้าติดตาม + ชื่อเจ้าของเบอร์ (เจ้าของ 29 ต.ค. 2569 "ทำเลย เติมชื่อเจ้าของเบอร์")
 * เดิมขึ้นแค่ตัวเลข ส่วน "เพิ่มโดย" เป็นคนเพิ่มใบ ซึ่งหลายใบไม่ใช่เจ้าของเบอร์ (เบอร์ = คนแก้ใบล่าสุดใน iRecruit)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ชื่อเจ้าของเบอร์ฉุกเฉิน', () => {
  it('server: ชื่อเล่นจากหน้าผู้ใช้งาน (เบอร์เดียวหลายชื่อ = ไม่เดา) แล้วความจำเดิม · ทีละหลายเบอร์', () => {
    const lib = read('api/_lib/followStaffName.ts');
    expect(lib).toContain('export async function staffNamesOfPhones(');
    expect(lib).toContain('if (r.names.length === 1 && r.names[0]) out.set(r.k, r.names[0]);');
    const h = read('api/_handlers/follow.ts');
    expect(h).toContain('const emgNames = await staffNamesOfPhones(items.map((it) => it.emergency_phone));');
  });
  it('จอ: "เบอร์ · ชื่อ" บนแถว และในป๊อปรอบ · หาไม่เจอ = ขึ้นแค่เบอร์', () => {
    const cal = read('src/components/follow/FollowPlanningCalendar.tsx');
    expect(cal).toContain('{emgName.get(p) ? <span className="text-muted-foreground"> · {emgName.get(p)}</span> : null}');
    expect(read('src/components/follow/FollowRoundsDialog.tsx')).toContain("{it.emergency_name ? ` (${it.emergency_name})` : ''}");
  });
});
