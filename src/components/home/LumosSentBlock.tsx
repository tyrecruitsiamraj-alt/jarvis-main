import React, { useMemo, useState } from 'react';
import DateRangeCalendarPicker, { type DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import { TONE } from '@/lib/designTokens';
import { METRICS, metricHelp } from '@/lib/metricDictionary';
import { bangkokTodayYmd } from '@/lib/lumosCallRate';
import { buLabel } from '@/lib/homeBu';
import { LUMOS_ROUTE_LABEL, type LumosSentRow, type LumosSentState } from '@/lib/officeTeam';
import { lumosSentBuOptions, summarizeLumosSent } from '@/lib/lumosSentSummary';
import { siteBuOf } from '@/lib/trends/bu';

/**
 * ═══ หัวคอลัมน์ Lumos บนหน้าแรก — "ส่งให้ Lumos ทั้งระบบ" (เจ้าของสั่ง 28 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"ในกล่องงานดูแล้วงง แล้วจะรู้ได้ไงว่าทั้งระบบส่งไปหา Lumos ทั้งหมดเท่าไหร่ เอาไว้หน้าแรกเลยได้ไหม"*
 * → Choice: ยอดรวมหัวคอลัมน์ Lumos (แบบร่างที่เลือก) · วันนี้ · เดือนนี้ · ทั้งหมด + *"เรื่องช่วงดูได้ด้วย
 * แยก bu ดุได้ด้วย"* · นับเป็นสาย
 *
 * 🔴 ตัวเลขทั้งหมดจาก `summarizeLumosSent` (มีเทสต์) — ไฟล์นี้วาดอย่างเดียว
 * 🔴 ยอด "ทั้งหมด" (ทุก BU) = ส่งให้ AI ไปแล้ว ของสามเส้นทางข้างล่างรวมกันเป๊ะ · แจกสถานะ/เส้นทางบวกกันได้ยอดของช่วงที่ดู
 * ⚠️ อ่านไม่ได้ = "วัดไม่ได้" (ห้าม 0 ปลอม) · เซิร์ฟเวอร์รุ่นเก่ายังไม่ส่ง field = ไม่วาดก้อนนี้
 */

// Intl ระดับโมดูล (กติกาโปรเจกต์)
const NUM = new Intl.NumberFormat('th-TH');
const fmt = (n: number) => NUM.format(n);

const ALL_BU = '__all__';

/** ป้ายสถานะจากพจนานุกรมเมตริก (คำเดียวกับแถวของแต่ละเส้นทางข้างล่าง) */
const STATE_PARTS: ReadonlyArray<[LumosSentState, string]> = [
  ['pending', METRICS['lumos.pending'].label],
  ['waiting', METRICS['lumos.waiting'].label],
  ['done', METRICS['lumos.done'].label],
  ['cancelled', METRICS['lumos.cancelled'].label],
  ['other', 'สถานะอื่น'],
];

const LumosSentBlock: React.FC<{
  rows: LumosSentRow[] | null | undefined;
  loading?: boolean;
  error?: string;
  /**
   * BU จากตัวกรองของหน้า (หน้าหลักโฉม 3 ก้อน · "BU เดียวคุมทั้งหน้า" — 29 ก.ย. 2569)
   * `undefined` = ของเดิม (ก้อนนี้มีตัวเลือก BU ของตัวเอง) · ส่งมา (รวม null = ทั้งหมด) = ใช้ BU ของหน้า ไม่มีตัวเลือกของตัวเอง
   * รับ BU กลางชุดแผนก แล้วแปลงเป็นชุดไซต์ของแถวรายวัน (`siteBuOf`)
   */
  pageBu?: string | null;
}> = ({ rows, loading, error, pageBu }) => {
  const external = pageBu !== undefined;
  const [ownBu, setBu] = useState<string | null>(null);
  const bu = external ? siteBuOf(pageBu) : ownBu;
  const [range, setRange] = useState<DateRangeYmd | null>(null);
  const data = useMemo(() => rows ?? [], [rows]);
  const today = bangkokTodayYmd();
  const s = useMemo(() => summarizeLumosSent(data, { today, bu, range }), [data, today, bu, range]);
  const buOptions = useMemo(
    () => [
      { value: ALL_BU, label: 'ทุก BU' },
      ...lumosSentBuOptions(data).map((o) => ({ value: o.bu, label: `${buLabel(o.bu)} · ${fmt(o.count)} สาย` })),
    ],
    [data],
  );

  // เซิร์ฟเวอร์ยังไม่ส่ง field นี้ (ช่วง deploy) — ไม่วาดดีกว่าวาด 0
  if (rows === undefined && !error && !loading) return null;
  const known = Boolean(rows);
  const num = (n: number) => (known ? fmt(n) : '—');

  return (
    <li className="mb-3 list-none rounded-xl border border-border/70 p-3">
      <div className="flex items-baseline justify-between gap-2" title={metricHelp('lumos.sent_all')}>
        <span className="text-xs font-medium text-foreground">
          {METRICS['lumos.sent_all'].label}
          {bu ? ` · ${bu}` : ''}
        </span>
        <span className="text-xs text-muted-foreground/70">{METRICS['lumos.sent_all'].unit}</span>
      </div>
      {error ? (
        /* Error ไม่เงียบ — กติกาเดียวกับทีมที่วัดไม่ได้ */
        <p className={`mt-1.5 text-xs ${TONE.warn.value}`}>วัดไม่ได้ — {error}</p>
      ) : (
        <>
          <dl className="mt-1.5 grid grid-cols-3 gap-2">
            {(
              [
                ['วันนี้', s.today],
                ['เดือนนี้', s.month],
                ['ทั้งหมด', s.all],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-medium tabular-nums text-foreground">{num(value)}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <DateRangeCalendarPicker triggerVariant="filter" value={range} onChange={setRange} />
            {external ? null : (
              <ChoiceDropdown
                value={bu ?? ALL_BU}
                options={buOptions}
                onChange={(v) => setBu(v === ALL_BU ? null : v)}
                triggerLabel={bu ?? 'ทุก BU'}
                ariaLabel="เลือก BU"
                active={bu !== null}
              />
            )}
          </div>
          {known ? (
            <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  {range && s.range !== null ? `ช่วงที่เลือก ${fmt(s.range)} สาย` : 'ทั้งหมด'}
                </span>
                {' — '}
                {STATE_PARTS.filter(([k]) => k !== 'other' || s.states.other > 0)
                  .map(([k, label]) => `${label} ${fmt(s.states[k])}`)
                  .join(' · ')}
              </p>
              <p className="tabular-nums">
                {(['public', 'match', 'follow', 'other'] as const)
                  .filter((k) => k !== 'other' || s.routes.other > 0)
                  .map((k) => `${LUMOS_ROUTE_LABEL[k]} ${fmt(s.routes[k])}`)
                  .join(' · ')}
              </p>
              {s.unknownBu ? (
                <p className={TONE.warn.value}>
                  ไม่รู้ BU อีก {fmt(s.unknownBu)} สาย — ไม่อยู่ใน BU ไหน
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </li>
  );
};

export default LumosSentBlock;
