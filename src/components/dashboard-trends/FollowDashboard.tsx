import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { useTrendWindow } from '@/hooks/useTrendWindow';
import { fetchFollowTrendRows } from '@/lib/trends/api';
import { breakdown, seriesByBucket, sumInRange } from '@/lib/trends/timeBuckets';
import {
  FOLLOW_DIM_LABEL,
  FOLLOW_METRIC_LABEL,
  followCallerStats,
  followDimGetter,
  followEventYmd,
  followRoundPeople,
  rate,
  type FollowDim,
  type FollowMetric,
} from '@/lib/trends/followTrends';
import { formatTrendNumber as fmt, formatTrendPct as pct } from '@/lib/trends/format';
import type { FollowTrendRow } from '@/lib/trends/types';
import {
  DeltaChip,
  TrendBreakdown,
  TrendChart,
  TrendKpiCard,
  TrendSection,
  TrendState,
  TrendTable,
  TrendToolbar,
} from './TrendParts';
import { ChoiceDropdown } from '@/components/jobs/BoardFilterPanel';

/**
 * ═══ แท็บ "Dashboard" ของหน้าติดตาม — ติดตามเริ่มงานมุมผู้บริหาร (28 ก.ย. 2569) ═══
 *
 * ตอบ: ลงติดตามวันละเท่าไหร่ · โทรไปแล้วเท่าไหร่ ติดต่อได้กี่ % · คนที่ส่งไป **ถึงหน่วยงานจริง** กี่ % ·
 * ยกเลิก/ลาเท่าไหร่ · แยกหน่วยงาน (จัดกลุ่มด้วยรหัสไซต์) · เจ้าหน้าที่ · รอบโทร · ใครโทร
 * 🔴 ตัวเลขทั้งหมดจาก `lib/trends/followTrends` (นิยามกลาง + เทสต์) — จอนี้วาดอย่างเดียว
 * ⚠️ ข้อมูลติดตามเริ่มมีตั้งแต่ 13 ก.ย. 2569 — ช่วงก่อนหน้านั้นเป็น 0 จริง ไม่ใช่ทีมไม่ทำงาน
 */

const DIMS = (Object.keys(FOLLOW_DIM_LABEL) as FollowDim[]).map((value) => ({ value, label: FOLLOW_DIM_LABEL[value] }));

const BREAKDOWN_METRICS: readonly { value: FollowMetric; label: string }[] = (
  ['registered', 'success', 'dropped', 'called'] as FollowMetric[]
).map((value) => ({ value, label: FOLLOW_METRIC_LABEL[value] }));

const FollowDashboard: React.FC = () => {
  const win = useTrendWindow('day');
  const { range, previous, grain } = win;

  const [rows, setRows] = useState<FollowTrendRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFollowTrendRows(win.fetchFrom, win.today)
      .then((r) => !cancelled && setRows(r))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [win.fetchFrom, win.today, rev]);

  const [dim, setDim] = useState<FollowDim>('unit');
  const [metric, setMetric] = useState<FollowMetric>('registered');

  const data = useMemo(() => rows ?? [], [rows]);
  const count = (m: FollowMetric, r: { from: string; to: string }) => sumInRange(data, (x) => followEventYmd(x, m), r);

  const reg = useMemo(() => seriesByBucket(data, (x) => followEventYmd(x, 'registered'), range, grain), [data, range, grain]);
  const called = useMemo(() => seriesByBucket(data, (x) => followEventYmd(x, 'called'), range, grain), [data, range, grain]);
  const success = useMemo(() => seriesByBucket(data, (x) => followEventYmd(x, 'success'), range, grain), [data, range, grain]);
  const dropped = useMemo(() => seriesByBucket(data, (x) => followEventYmd(x, 'dropped'), range, grain), [data, range, grain]);

  const now = {
    registered: count('registered', range),
    called: count('called', range),
    connected: count('connected', range),
    completed: count('completed', range),
    success: count('success', range),
    dropped: count('dropped', range),
  };
  const prev = {
    registered: count('registered', previous),
    called: count('called', previous),
    connected: count('connected', previous),
    completed: count('completed', previous),
    success: count('success', previous),
    dropped: count('dropped', previous),
  };

  /** รอบแรกกี่คน รอบ 2 ขึ้นไปกี่คน + แยก AI/คนโทร (Journey ข้อ 15 · 3 ต.ค. 2569) */
  const roundNow = useMemo(() => followRoundPeople(data, range), [data, range]);
  const roundPrev = useMemo(() => followRoundPeople(data, previous), [data, previous]);
  const callerNow = useMemo(() => followCallerStats(data, range), [data, range]);
  const callerPrev = useMemo(() => followCallerStats(data, previous), [data, previous]);

  const dimRows = useMemo(
    () => breakdown(data, (x) => followEventYmd(x, metric), followDimGetter(dim, data), range, previous),
    [data, metric, dim, range, previous],
  );

  /** ตารางเจ้าหน้าที่ (เฉพาะงานติดตาม) — คีย์ = รหัสผู้ใช้ */
  const staff = useMemo(() => {
    const byStaff = new Map<string, { name: string; reg: number; regPrev: number; called: number; completed: number; success: number }>();
    for (const x of data) {
      const key = x.staffId ?? `name:${x.staffName ?? 'ไม่ระบุ'}`;
      const row = byStaff.get(key) ?? { name: x.staffName ?? 'ไม่ระบุ', reg: 0, regPrev: 0, called: 0, completed: 0, success: 0 };
      const inR = (m: FollowMetric) => {
        const y = followEventYmd(x, m);
        return Boolean(y && y >= range.from && y <= range.to);
      };
      const inP = (m: FollowMetric) => {
        const y = followEventYmd(x, m);
        return Boolean(y && y >= previous.from && y <= previous.to);
      };
      if (inR('registered')) row.reg += 1;
      if (inP('registered')) row.regPrev += 1;
      if (inR('called')) row.called += 1;
      if (inR('completed')) row.completed += 1;
      if (inR('success')) row.success += 1;
      byStaff.set(key, row);
    }
    return [...byStaff.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .filter((v) => v.reg + v.regPrev + v.called + v.completed > 0)
      .sort((a, b) => b.reg - a.reg || a.name.localeCompare(b.name, 'th'));
  }, [data, range, previous]);

  const firstYmd = useMemo(() => {
    let m: string | null = null;
    for (const x of data) {
      const y = followEventYmd(x, 'registered');
      if (y && (!m || y < m)) m = y;
    }
    return m;
  }, [data]);

  return (
    <div className="space-y-6">
      <TrendToolbar
        win={win}
        note={
          <>
            {range.from} ถึง {range.to} · เทียบ {previous.from} ถึง {previous.to}
            {firstYmd && firstYmd > range.from ? ` · ข้อมูลเริ่ม ${firstYmd}` : ''}
          </>
        }
      />
      <TrendState loading={loading && !rows} error={error} onRetry={() => setRev((n) => n + 1)} />
      {rows ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <TrendKpiCard label="ลงติดตาม" unit="ราย" value={now.registered} previous={prev.registered} tone="violet" spark={reg.map((p) => p.value)} />
            <TrendKpiCard label="โทรแล้ว" unit="สาย" value={now.called} previous={prev.called} tone="info" spark={called.map((p) => p.value)} />
            <TrendKpiCard label="ติดต่อได้" value={rate(now.connected, now.called)} previous={rate(prev.connected, prev.called)} asRate tone="teal" foot={`${fmt(now.connected)} จาก ${fmt(now.called)} สาย`} />
            <TrendKpiCard label="ไปถึงแล้ว" unit="คน" value={now.success} previous={prev.success} tone="success" spark={success.map((p) => p.value)} />
            <TrendKpiCard label="อัตราไปถึง" value={rate(now.success, now.completed)} previous={rate(prev.success, prev.completed)} asRate tone="success" foot={`${fmt(now.success)} จาก ${fmt(now.completed)} ที่ปิดงาน`} />
            <TrendKpiCard label="ยกเลิก / ลา / ไม่ไป" unit="คน" value={now.dropped} previous={prev.dropped} polarity="down-good" tone="danger" spark={dropped.map((p) => p.value)} />
          </div>

          {/* แถวที่สอง: รอบแรก/รอบถัดไป (นับคน) + แยก AI/คนโทรว่าโทรไปเท่าไหร่ ติดต่อได้เท่าไหร่
              (Journey ข้อ 15 + เจ้าของสั่ง 3 ต.ค. 2569 — นิยาม "ติดต่อได้" ตัวเดียวกับแถวบน) */}
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <TrendKpiCard label="สายแรก" unit="คน" value={roundNow.first} previous={roundPrev.first} tone="info" foot="นับตามวันนัดโทรในช่วง" />
            <TrendKpiCard label="สายที่ 2 ขึ้นไป" unit="คน" value={roundNow.later} previous={roundPrev.later} tone="violet" foot="นับตามวันนัดโทรในช่วง" />
            <TrendKpiCard
              label="AI ติดต่อได้"
              unit="สาย"
              value={callerNow.ai.connected}
              previous={callerPrev.ai.connected}
              tone="teal"
              foot={`จาก ${fmt(callerNow.ai.calls)} สายที่ AI โทร`}
            />
            <TrendKpiCard
              label="คนโทรติดต่อได้"
              unit="สาย"
              value={callerNow.manual.connected}
              previous={callerPrev.manual.connected}
              tone="warn"
              foot={`จาก ${fmt(callerNow.manual.calls)} สายที่คนลงผล`}
            />
          </div>

          <TrendSection title="ติดตามเริ่มงาน · แนวโน้ม">
            <Card className="space-y-4 rounded-2xl p-4">
              <TrendChart
                ariaLabel="ลงติดตาม โทรแล้ว ไปถึงแล้ว และยกเลิกลา ต่องวด"
                data={reg.map((p, i) => ({
                  label: p.label,
                  registered: p.value,
                  called: called[i]?.value ?? 0,
                  success: success[i]?.value ?? 0,
                  dropped: dropped[i]?.value ?? 0,
                }))}
                series={[
                  { key: 'registered', label: 'ลงติดตาม', kind: 'bar', tone: 'violet' },
                  { key: 'called', label: 'โทรแล้ว', kind: 'line', tone: 'info' },
                  { key: 'success', label: 'ไปถึงแล้ว', kind: 'line', tone: 'success' },
                  { key: 'dropped', label: 'ยกเลิก / ลา / ไม่ไป', kind: 'line', tone: 'danger', dashed: true },
                ]}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('text-xs', DASH.sub)}>นับ</span>
                <ChoiceDropdown<FollowMetric> value={metric} options={BREAKDOWN_METRICS} onChange={setMetric} ariaLabel="นับตัวเลขไหน" />
              </div>
              <TrendBreakdown<FollowDim>
                dims={DIMS}
                dim={dim}
                onDimChange={setDim}
                rows={dimRows}
                unit={`${FOLLOW_METRIC_LABEL[metric]} (${metric === 'called' ? 'สาย' : 'ราย'})`}
                polarity={metric === 'dropped' ? 'down-good' : 'up-good'}
                tone={metric === 'dropped' ? 'danger' : metric === 'success' ? 'success' : 'violet'}
              />
            </Card>
          </TrendSection>

          <TrendSection title="เทียบเจ้าหน้าที่">
            <Card className="rounded-2xl p-4">
              <TrendTable
                columns={[
                  { key: 'name', label: 'เจ้าหน้าที่' },
                  { key: 'reg', label: 'ลงติดตาม', align: 'right' },
                  { key: 'called', label: 'โทรแล้ว', align: 'right' },
                  { key: 'completed', label: 'ปิดงาน', align: 'right' },
                  { key: 'success', label: 'ไปถึงแล้ว', align: 'right' },
                  { key: 'rate', label: 'อัตราไปถึง', align: 'right' },
                  { key: 'delta', label: 'ลงติดตามเทียบช่วงก่อน', align: 'right' },
                ]}
                rows={staff.map((s) => ({
                  key: s.key,
                  cells: {
                    name: s.name,
                    reg: fmt(s.reg),
                    called: fmt(s.called),
                    completed: fmt(s.completed),
                    success: fmt(s.success),
                    rate: s.completed ? pct(s.success / s.completed) : '—',
                    delta: <DeltaChip current={s.reg} previous={s.regPrev} polarity="up-good" />,
                  },
                }))}
              />
            </Card>
          </TrendSection>
        </>
      ) : null}
    </div>
  );
};

export default FollowDashboard;
