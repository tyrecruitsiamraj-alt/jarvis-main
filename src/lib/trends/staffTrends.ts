/**
 * ═══ ตารางเทียบเจ้าหน้าที่ — รวมงานของคนเดียวกันข้ามส่วน ═══
 *
 * คีย์ = รหัสผู้ใช้ (users.id) ตัวเดียวกับที่บันทึกตอนปล่อยประกาศ (`released_by`) และลงติดตาม (`created_by`)
 * ⇒ คนเดียวกันรวมเป็นแถวเดียวได้จริง · ไม่มีรหัส = ใช้ชื่อ (แถวเก่า/ระบบสร้างเอง)
 * ชื่อบนจอ = ชื่อเล่นจากหน้าผู้ใช้งาน (เส้นหลังบ้านเติมมาแล้ว) → ชื่อที่บันทึกไว้ตอนทำ
 *
 * ทุกตัวเลขนับในช่วงที่เลือก **เทียบช่วงก่อนหน้าที่ยาวเท่ากัน** ตามวันที่ของเหตุการณ์นั้น
 * (ปล่อย = วันกดปล่อย · ลงติดตาม = วันลง · ไปถึงแล้ว = วันปิดงาน)
 */
import { deltaPct, inRange } from './timeBuckets';
import { followEventYmd } from './followTrends';
import { bangkokYmd } from './timeBuckets';
import type { FollowTrendRow, ReleaseTrendRow } from './types';

export type StaffRow = {
  key: string;
  name: string;
  released: number;
  releasedPrev: number;
  registered: number;
  registeredPrev: number;
  success: number;
  successPrev: number;
  /** ไปถึงแล้ว ÷ ปิดงาน ในช่วงนี้ · null = ยังไม่มีงานปิด */
  successRate: number | null;
  /** เทียบช่วงก่อนของ "ปล่อย + ลงติดตาม" รวม */
  delta: number | null;
};

type Acc = Omit<StaffRow, 'successRate' | 'delta'> & { completed: number };

export function staffTable(
  input: { releases?: readonly ReleaseTrendRow[]; follow?: readonly FollowTrendRow[] },
  range: { from: string; to: string },
  previous: { from: string; to: string },
): StaffRow[] {
  const acc = new Map<string, Acc>();
  const get = (id: string | null, name: string | null): Acc => {
    const key = id ?? `name:${(name ?? '').trim() || 'ไม่ระบุ'}`;
    const cur = acc.get(key);
    if (cur) {
      if (name && (cur.name === 'ไม่ระบุ' || !cur.name)) cur.name = name;
      return cur;
    }
    const row: Acc = {
      key,
      name: (name ?? '').trim() || 'ไม่ระบุ',
      released: 0,
      releasedPrev: 0,
      registered: 0,
      registeredPrev: 0,
      success: 0,
      successPrev: 0,
      completed: 0,
    };
    acc.set(key, row);
    return row;
  };
  for (const r of input.releases ?? []) {
    const ymd = bangkokYmd(r.releasedAt);
    if (inRange(ymd, range.from, range.to)) get(r.staffId, r.staffName).released += 1;
    else if (inRange(ymd, previous.from, previous.to)) get(r.staffId, r.staffName).releasedPrev += 1;
  }
  for (const f of input.follow ?? []) {
    const reg = followEventYmd(f, 'registered');
    if (inRange(reg, range.from, range.to)) get(f.staffId, f.staffName).registered += 1;
    else if (inRange(reg, previous.from, previous.to)) get(f.staffId, f.staffName).registeredPrev += 1;
    const done = followEventYmd(f, 'completed');
    const ok = followEventYmd(f, 'success');
    if (inRange(done, range.from, range.to)) get(f.staffId, f.staffName).completed += 1;
    if (inRange(ok, range.from, range.to)) get(f.staffId, f.staffName).success += 1;
    else if (inRange(ok, previous.from, previous.to)) get(f.staffId, f.staffName).successPrev += 1;
  }
  return [...acc.values()]
    .filter((r) => r.released + r.registered + r.success + r.releasedPrev + r.registeredPrev + r.successPrev > 0)
    .map(({ completed, ...r }) => ({
      ...r,
      successRate: completed > 0 ? r.success / completed : null,
      delta: deltaPct(r.released + r.registered, r.releasedPrev + r.registeredPrev),
    }))
    .sort((a, b) => b.released + b.registered - (a.released + a.registered) || a.name.localeCompare(b.name, 'th'));
}
