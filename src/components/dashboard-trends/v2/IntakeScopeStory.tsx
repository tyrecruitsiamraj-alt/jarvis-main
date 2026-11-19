/**
 * เรื่องเล่ารายชื่อของกล่องที่เลือกในส่วน "รายชื่อเข้ามาไปถึงไหน" (เจ้าของ 19 พ.ย. 2569 รวมส่วนผู้สมัครและผลการติดต่อเข้ามา
 * "ชอบที่บอกว่า ช่องทางไหน ใครเอาเข้ามา วิธีที่เข้ามา รายชื่อมาจากจังหวัดไหน ช่วงอายุ เพศ เอามารวมกัน" · Choice ถอดการ์ด 7 ใบ ใช้หัวกล่องแทน)
 * กราฟแท่ง BU × เดือนของคนในกล่อง → กดแท่ง = เรื่องเล่า (`ApplicantStory`) เหลือ BU นั้น
 */
import React from 'react';
import { BU_UNKNOWN, buOfFact, bkkDay, type OutcomeSets } from '@/lib/recruitAudience';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import ApplicantStory from './ApplicantStory';
import { MonthCompareBars } from './MonthCompareBars';
import { fmt } from './V2Parts';

export default function IntakeScopeStory({
  title,
  ids,
  cohort,
  sets,
  bus,
  months,
  onNames,
  resetKey,
}: {
  title: string;
  ids: readonly string[];
  cohort: readonly RecruitAppFact[];
  sets: OutcomeSets;
  bus: readonly string[];
  /** เดือนในช่วง (YYYY-MM) เรียงเก่า → ใหม่ */
  months: readonly string[];
  onNames: (title: string, ids: readonly string[]) => void;
  resetKey: string;
}) {
  const [bu, setBu] = React.useState<string | null>(null);
  React.useEffect(() => setBu(null), [resetKey]);
  const idSet = React.useMemo(() => new Set(ids), [ids]);
  const facts = React.useMemo(() => cohort.filter((f) => f.id && idSet.has(f.id)), [cohort, idSet]);
  /** BU × เดือน — BU ที่ไม่มีรายการเลยไม่ขึ้นแท่ง ("ไม่ระบุ BU" ขึ้นเมื่อมีจริง) */
  const groups = React.useMemo(
    () =>
      bus
        .map((b) => {
          const byMonth: Record<string, number> = {};
          for (const f of facts) if (buOfFact(f) === b) byMonth[bkkDay(f.createdAt).slice(0, 7)] = (byMonth[bkkDay(f.createdAt).slice(0, 7)] ?? 0) + 1;
          return { key: b, byMonth, total: Object.values(byMonth).reduce((a, n) => a + n, 0) };
        })
        .filter((g) => g.total > 0 || g.key !== BU_UNKNOWN)
        .sort((a, b) => b.total - a.total),
    [bus, facts],
  );
  return (
    <section className="space-y-4 border-t pt-4" data-testid="v2-intake-story">
      <section className="min-w-0 space-y-2">
        <h3 className="text-sm font-medium">
          {title} {fmt(facts.length)} · แยกตาม BU
        </h3>
        <MonthCompareBars groups={groups} months={months} onPick={setBu} testId="v2-bu-chart" />
      </section>
      <ApplicantStory cohort={facts} sets={sets} bu={bu} onBu={setBu} scopeLabel={title} onNames={onNames} resetKey={resetKey} />
    </section>
  );
}
