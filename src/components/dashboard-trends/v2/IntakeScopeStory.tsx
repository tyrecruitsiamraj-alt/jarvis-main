/**
 * แผงข้างของหัวกล่องในส่วน "รายชื่อเข้ามาไปถึงไหน" (เจ้าของ 19 พ.ย. 2569 รวมส่วนผู้สมัครและผลการติดต่อเข้ามา
 * "ชอบที่บอกว่า ช่องทางไหน ใครเอาเข้ามา วิธีที่เข้ามา รายชื่อมาจากจังหวัดไหน ช่วงอายุ เพศ เอามารวมกัน" · Choice ถอดการ์ด 7 ใบ ใช้หัวกล่องแทน)
 * กราฟแท่ง BU × เดือนของคนในกล่อง → กดแท่ง = เรื่องเล่า (`ApplicantStory`) เหลือ BU นั้น
 * แนวโน้มของคนในกล่อง รายวัน/รายเดือน (เจ้าของ 19 พ.ย. 2569 Choice "ย้ายเข้าแต่ละเรื่อง + สลับวัน/เดือน") — กล่อง AI โทร = ผลโทรซ้อนแท่ง
 */
import React from 'react';
import { BU_UNKNOWN, buOfFact, bkkDay, type OutcomeSets } from '@/lib/recruitAudience';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { Button } from '@/components/ui/button';
import ApplicantStory from './ApplicantStory';
import { PULSE_MAX_DAYS, PulseChart, pulseDays, pulsePoints, type PulseGrain } from './PulseParts';
import { MonthCompareBars } from './MonthCompareBars';
import { fmt } from './V2Parts';

export default function IntakeScopeStory({
  boxKey,
  from,
  to,
  title,
  ids,
  cohort,
  sets,
  bus,
  months,
  onNames,
  resetKey,
}: {
  /** กล่องที่กด (`ai` = ผลโทรซ้อนแท่ง) */
  boxKey: string;
  from: string;
  to: string;
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
  const days = pulseDays(from, to);
  const [grain, setGrain] = React.useState<PulseGrain>(days > PULSE_MAX_DAYS ? 'month' : 'day');
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
    <section className="space-y-4" data-testid="v2-intake-story">
      <section className="min-w-0 space-y-2">
        <h3 className="text-sm font-medium">
          {title} {fmt(facts.length)} · แยกตาม BU
        </h3>
        <MonthCompareBars groups={groups} months={months} onPick={setBu} testId="v2-bu-chart" />
      </section>
      <section className="min-w-0 space-y-2" data-testid="v2-intake-trend">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">แนวโน้ม</h3>
          <div className="flex gap-1.5">
            <Button type="button" size="xs" variant={grain === 'day' ? 'default' : 'outline'} disabled={days > PULSE_MAX_DAYS} onClick={() => setGrain('day')}>
              รายวัน
            </Button>
            <Button type="button" size="xs" variant={grain === 'month' ? 'default' : 'outline'} onClick={() => setGrain('month')}>
              รายเดือน
            </Button>
          </div>
        </div>
        <PulseChart points={pulsePoints(facts, from, to, grain)} grain={grain} ai={boxKey === 'ai'} unitLabel={title} />
      </section>
      <ApplicantStory cohort={facts} sets={sets} bu={bu} onBu={setBu} scopeLabel={title} onNames={onNames} resetKey={resetKey} />
    </section>
  );
}
