/**
 * ═══ กราฟยอดใช้งานของหัวข้อที่เลือก (รอบ 3 → รอบ 18 · 30 ก.ย. 2569) ═══
 *
 * รอบ 5 เจ้าของ: *"พอเลือกดูอันไหนก็แสดงกราฟ · กราฟขอกราฟแท่ง default ย้อนหลัง 7 วัน ถ้าเปลี่ยน calendar ก็เปลี่ยนตาม ·
 * กราฟโชว์ว่ายอดใช้งานของแต่ละวัน แต่ละเดือนเท่าไหร่"*
 * - แท่งรายวันตลอดช่วงที่เลือก · ยาวเกิน 62 วัน = รายเดือน (`detailBuckets`)
 * - แบ่งแท่งตาม (6 ต.ค. 2569 รวมสวิตช์ "แยก BU" + "แยกทีม" เป็นตัวเลือกเดียว): ใครโทร (ค่าตั้งต้น) · BU · ทีม (ติดตามเท่านั้น)
 *   รอบ 12: กดสวิตช์แล้วแท่งพลิกไพ่ทีละแท่งจากซ้ายไปขวา (`flipKey`) — เจ้าของ *"หมุนก้อนพวกแท่งกราฟเหมือนหมุนไพ่"*
 *   ยอดบนหัวแท่งเท่ากันทั้งสองแบบ (แถวชุดเดียวกัน) · ไม่จำค่า เปิดหน้าใหม่กลับเป็น AI/คน ตามที่เจ้าของบอก
 * - แถววัน × BU มาจากหน้า (รอบ 9 · หน้าโหลด `?detail=` ครั้งเดียว) — หน้าส่งมาเฉพาะชุดที่ตรงกับหัวข้อ/ช่วงที่เลือกอยู่
 * - รอบ 17: หัวกราฟบอก **เดือน + ช่วงวันที่กำลังดู** ("24–30 กันยายน 2569") แทนเดือนบนแกนล่าง (แกนเหลือเลขวัน) ·
 *   โหมดแยก BU ขึ้นครบทุก BU รอไว้ (บัญชีที่ถูกล็อก BU = BU ของตัวเองตัวเดียว) · ไม่รู้ BU = สีจางจุดกลวง
 *   (สีเทาเดียวกับ CR — ต้องแยกให้ออก)
 * - รอบ 18: เลือกหลายเดือน/ปี/สัปดาห์บนปฏิทิน = หนึ่งแท่งต่อหน่วย (ยอดรวม) · **กดแท่งหน่วยใหญ่ = ลงไปดูข้างใน**
 *   (เดือน/สัปดาห์ → รายวัน · ปี → รายเดือน · `drillWindow`) · ปุ่ม "กลับ" ขึ้นทีละชั้น · แถวชุดเดิม ไม่โหลดใหม่ ·
 *   เปลี่ยนหัวข้อ/ช่วงบนปฏิทิน = กลับชั้นบนสุด · กล่องตัวเลขด้านบนยังเป็นของทั้งช่วงที่เลือก (ไม่ตามการกดลงไปดู)
 * - 🔴 **แผงเลื่อนจากขวา + ปุ่ม "ดูทั้งหมด" ถอดแล้ว** (30 ก.ย. 2569 · เจ้าของ: *"ไอที่กดกราฟแท่งแล้วมีหน้า Slide ออกมา
 *   ฉันให้เอาออกแล้วหนิ ไม่ต้องมีแล้ว"*) ⇒ แท่งรายวันกดไม่ได้ (ไม่มีข้างในให้ลงไปแล้ว) · อย่าเอากลับมาเอง
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import AiShareUsageChart, { type UsageStack } from '@/components/home-ai-share/AiShareUsageChart';
import { segmentDotClass, segmentFillClass } from '@/components/home-ai-share/segmentStyle';
import { toneOfBu } from '@/components/team-online/teamOnlineTones';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TONE } from '@/lib/designTokens';
import { toYmdBangkok } from '@/lib/dateTh';
import {
  AI_SHARE_BUS,
  AI_SHARE_GRAIN_LABEL,
  AI_SHARE_SEGMENTS,
  AI_SHARE_SEGMENT_LABEL,
  UNKNOWN_BU,
  detailBuSeries,
  detailBuckets,
  detailSegments,
  detailTeamSeries,
  drillWindow,
  followTeamBreakdown,
  rowsInRange,
  type AiShareDetailResponse,
  type AiShareGrain,
  type AiShareWindow,
  type FollowTeamBreakdown,
} from '@/lib/homeAiShare';
import { rangeTextFull } from '@/lib/periodPick';
import { cn } from '@/lib/utils';

/** บรรทัดท้ายตอนจี้แท่ง — เฉพาะแท่งที่กดลงไปดูข้างในได้ (แท่งรายวันไม่มี) */
const PICK_HINT: Record<AiShareGrain, string | null> = {
  day: null,
  week: 'กดที่แท่งเพื่อดูรายวัน',
  month: 'กดที่แท่งเพื่อดูรายวัน',
  year: 'กดที่แท่งเพื่อดูรายเดือน',
};

const AiShareDetail: React.FC<{
  title: string;
  unit: string;
  win: AiShareWindow;
  withBoth: boolean;
  /** แถววัน × BU ที่ตรงกับหัวข้อ/ช่วงที่เลือก (หน้าเป็นคนโหลด) · null = ยังไม่มา */
  data: AiShareDetailResponse | null;
  loading: boolean;
  error: string | null;
  /**
   * หัวข้อนี้แยกทีมได้ไหม (เฉพาะติดตาม · 4 ต.ค. 2569 "ติดตามคนเริ่มงาน กับ ติดตามส่งคนแทน แยกแล้วอย่างละเท่าไหร่")
   * true = มีสวิตช์ "แยกทีม" ข้างสวิตช์แยก BU
   */
  withTeams?: boolean;
  /** ไม่มีชั้น "ยังไม่โทร" ในแท่ง (หัวข้อติดตามแบบแผน) */
  hideNotCalled?: boolean;
  /**
   * แท่งรายวันที่กดเลือก → หน้าให้ตัวเลขด้านบนวิ่งตามวันนั้น (เจ้าของ 4 ต.ค. 2569 "เลือกแค่วันที่ 4 ตัวเลขไม่วิ่งตาม")
   * null = กลับไปทั้งช่วง
   */
  onFocusDay?: (w: AiShareWindow | null) => void;
  /**
   * หน้าวาด "รวมทั้งช่วง" เองที่คอลัมน์ขวา (เจ้าของ 7 ต.ค. 2569 เลย์เอาต์แบบภาพ) — ส่งค่าออกทาง `onBreakdown`
   * ไม่วาดกล่องใต้กราฟ · `resetKey` เปลี่ยน = กลับทั้งช่วง (ปุ่ม "ดูทั้งช่วง" อยู่ที่การ์ดของหน้า)
   */
  hideBreakdown?: boolean;
  resetKey?: number;
  onBreakdown?: (b: { label: string; picked: boolean; data: FollowTeamBreakdown } | null) => void;
}> = ({
  title,
  unit,
  win,
  withBoth,
  data,
  loading,
  error,
  withTeams = false,
  hideNotCalled = false,
  onFocusDay,
  hideBreakdown = false,
  resetKey = 0,
  onBreakdown,
}) => {
  /**
   * แท่งแบ่งตามอะไร — ตัวเลือกเดียว (6 ต.ค. 2569 · เจ้าของ: *"ปุ่ม แยกทีม แยก Bu มันจะทำแยกกันมาทำไม"*)
   * เดิมเป็นสวิตช์สองตัวที่เปิดได้ทีละตัว · ค่าตั้งต้น = ใครโทร (AI/คน) · "ทีม" มีเฉพาะหัวข้อติดตาม
   */
  const [splitBy, setSplitBy] = useState<'caller' | 'bu' | 'team'>('caller');
  /** แท่งรายวันที่กดเลือก (หัวข้อติดตาม) — null = ดูทั้งช่วงที่กราฟโชว์ */
  const [picked, setPicked] = useState<number | null>(null);
  /** ชั้นที่กดลงไปดู (รอบ 18) — ว่าง = ช่วงที่เลือกบนปฏิทิน · ตัวท้าย = ชั้นที่กำลังดู */
  const [drill, setDrill] = useState<AiShareWindow[]>([]);

  // เปลี่ยนหัวข้อ/ช่วงแล้วกลับชั้นบนสุด
  useEffect(() => {
    setDrill([]);
    setPicked(null);
  }, [title, win]);

  const today = toYmdBangkok(new Date());
  const rows = data?.rows ?? null;
  /** BU ที่ป้ายสีต้องขึ้นรอไว้ — ทุก BU ของบริษัท · บัญชีที่ถูกล็อก BU (คำตอบมี `bu`) = BU นั้นตัวเดียว */
  const lockedBu = data?.bu ?? null;
  /** ช่วงที่กราฟกำลังดู — ชั้นที่กดลงไปล่าสุด หรือช่วงบนปฏิทิน */
  const shownWin = drill[drill.length - 1] ?? win;
  const view = useMemo(() => {
    if (!rows) return null;
    const { buckets, grain } = detailBuckets(shownWin, rows, today);
    const inView = drill.length > 0 && shownWin.from && shownWin.to ? rowsInRange(rows, shownWin.from, shownWin.to) : rows;
    const segments = detailSegments(inView, buckets);
    // ทั้งสองทาง: ติดตาม/ดูแลหลังเริ่มงานไม่มี แต่ถ้ามีเลขจริงขึ้นมาต้องโชว์เสมอ
    const segmentStacks: UsageStack[] = AI_SHARE_SEGMENTS.filter(
      (k) => (k !== 'both' || withBoth || segments.both.some((v) => v > 0)) && (k !== 'notCalled' || !hideNotCalled),
    ).map(
      (k) => ({
        key: k,
        label: AI_SHARE_SEGMENT_LABEL[k],
        values: segments[k],
        fill: segmentFillClass(k),
        dot: k === 'notCalled' ? segmentDotClass(k) : undefined,
        muted: k === 'notCalled',
      }),
    );
    const buStacks: UsageStack[] = detailBuSeries(inView, buckets, lockedBu ? [lockedBu] : AI_SHARE_BUS).map((x) =>
      x.bu === UNKNOWN_BU
        ? { key: x.bu, label: x.bu, values: x.values, fill: TONE.neutral.value, dot: segmentDotClass('notCalled'), muted: true }
        : { key: x.bu, label: x.bu, title: x.label, values: x.values, fill: TONE[toneOfBu(x.bu)].value },
    );
    const team = detailTeamSeries(inView, buckets);
    const teamStacks: UsageStack[] = [
      { key: 'main', label: 'ติดตามคนเริ่มงาน', values: team.main, fill: TONE.info.value },
      { key: 'replacement', label: 'ติดตามส่งคนแทน', values: team.replacement, fill: TONE.violet.value },
    ];
    const first = buckets[0];
    const last = buckets[buckets.length - 1];
    const range = first && last ? rangeTextFull(first.from, last.to) : null;
    // แตกแยกทีม × AI/คน ของแท่งที่กด หรือทั้งช่วงที่โชว์ (4 ต.ค. 2569 "กดแท่งไปมันไปหนักเรื่องไหน")
    const teamRowsOf = (i: number | null) => {
      const b = i === null ? null : buckets[i];
      return b ? rowsInRange(inView, b.from, b.to) : inView;
    };
    return { buckets, grain, segmentStacks, buStacks, teamStacks, range, teamRowsOf };
  }, [rows, shownWin, drill.length, today, withBoth, lockedBu, hideNotCalled]);
  const teamOn = withTeams && splitBy === 'team';
  const byBu = splitBy === 'bu';
  const failed = error ?? data?.error ?? null;
  const per = view ? AI_SHARE_GRAIN_LABEL[view.grain] : 'วัน';

  /** กดแท่งหน่วยใหญ่ = ลงไปดูข้างใน (แท่งรายวันไม่มีข้างใน กราฟจึงไม่ส่งตัวกดมา) */
  const openBucket = (i: number) => {
    const b = view?.buckets[i];
    const next = b && view ? drillWindow(b, view.grain) : null;
    if (next) {
      setPicked(null);
      setDrill((d) => [...d, next]);
    }
  };
  /** แท่งรายวันของหัวข้อติดตาม = เลือกแท่งนั้นมาแตกดู (กดซ้ำ = กลับทั้งช่วง) */
  const pickDay = (i: number) => setPicked((cur) => (cur === i ? null : i));
  const pickedBucket = picked !== null ? view?.buckets[picked] ?? null : null;
  const focusFrom = pickedBucket?.from ?? null;
  const focusTo = pickedBucket?.to ?? null;
  useEffect(() => {
    onFocusDay?.(focusFrom && focusTo ? { from: focusFrom, to: focusTo } : null);
  }, [focusFrom, focusTo, onFocusDay]);
  const breakdown = withTeams && view ? followTeamBreakdown(view.teamRowsOf(pickedBucket ? picked : null)) : null;
  // ปุ่ม "ดูทั้งช่วง" ของหน้า
  useEffect(() => {
    if (resetKey > 0) setPicked(null);
  }, [resetKey]);
  // ส่งตัวเลขออกให้หน้า — เทียบด้วยคีย์ข้อความ (วัตถุใหม่ทุกรอบ ห้ามใช้เป็น deps ตรง ๆ ไม่งั้นวนไม่จบ)
  const breakdownLabel = pickedBucket ? rangeTextFull(pickedBucket.from, pickedBucket.to) : 'รวมทั้งช่วง';
  const breakdownKey = breakdown ? `${breakdownLabel}|${picked !== null}|${JSON.stringify(breakdown)}` : '';
  const breakdownRef = useRef(breakdown);
  breakdownRef.current = breakdown;
  useEffect(() => {
    if (!onBreakdown) return;
    const b = breakdownRef.current;
    onBreakdown(b ? { label: breakdownLabel, picked: pickedBucket !== null, data: b } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- คีย์ข้อความแทนวัตถุ
  }, [breakdownKey, onBreakdown]);

  return (
    <section className="space-y-4" aria-label={`ยอดใช้งาน${title}`}>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {drill.length > 0 ? (
          <Button type="button" variant="outline" size="xs" onClick={() => setDrill((d) => d.slice(0, -1))}>
            <ChevronLeft aria-hidden />
            กลับ
          </Button>
        ) : null}
        {/* หัวกราฟบอกเดือน + ช่วงวันที่กำลังดู (รอบ 17 · เจ้าของ: "ให้มันบอกในกราฟว่าดูเดือนอะไร วันไหนถึงวันไหน") */}
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-foreground">
          ยอดใช้งานราย{per}
          {view?.range ? <span className="font-normal tabular-nums text-muted-foreground">{view.range}</span> : null}
        </p>
        <Tabs value={teamOn ? 'team' : splitBy === 'team' ? 'caller' : splitBy} onValueChange={(v) => setSplitBy(v as typeof splitBy)}>
          <TabsList className="h-9 rounded-full bg-muted p-1" aria-label="แบ่งแท่งตาม">
            <TabsTrigger value="caller" className="rounded-full px-2.5 text-xs sm:px-4">
              ใครโทร
            </TabsTrigger>
            <TabsTrigger value="bu" className="rounded-full px-2.5 text-xs sm:px-4">
              BU
            </TabsTrigger>
            {withTeams ? (
              <TabsTrigger value="team" className="rounded-full px-2.5 text-xs sm:px-4">
                ทีม
              </TabsTrigger>
            ) : null}
          </TabsList>
        </Tabs>
      </div>

      {loading && !view ? (
        <Skeleton className="h-64 w-full rounded-2xl" aria-label={`กำลังโหลดกราฟ${title}`} />
      ) : failed && !view ? (
        <p className={cn('text-sm', TONE.danger.value)}>{failed}</p>
      ) : view ? (
        <AiShareUsageChart
          buckets={view.buckets}
          stacks={teamOn ? view.teamStacks : byBu ? view.buStacks : view.segmentStacks}
          flipKey={teamOn ? 'team' : byBu ? 'bu' : 'segments'}
          hideZeroInTooltip={byBu || teamOn}
          grain={view.grain}
          unit={unit}
          today={today}
          ariaLabel={`${title} ยอดใช้งานราย${per}${teamOn ? ' แยกทีม' : byBu ? ' แยก BU' : ''}`}
          onPick={view.grain === 'day' ? (withTeams ? pickDay : undefined) : openBucket}
          pickHint={view.grain === 'day' && withTeams ? 'กดที่แท่งเพื่อดูแยกตามทีม' : PICK_HINT[view.grain]}
        />
      ) : null}

      {/* แยกทีม × AI/คน ของแท่งที่กด (หรือทั้งช่วง) — หัวข้อติดตามเท่านั้น */}
      {breakdown && !hideBreakdown ? (
        <div className="space-y-2 rounded-xl border border-foreground/10 p-3" data-testid="follow-team-breakdown">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">
              {pickedBucket ? rangeTextFull(pickedBucket.from, pickedBucket.to) : 'รวมทั้งช่วง'}
            </p>
            {pickedBucket ? (
              <Button type="button" variant="link" size="xs" className="h-auto p-0" onClick={() => setPicked(null)}>
                ดูทั้งช่วง
              </Button>
            ) : null}
          </div>
          {(
            [
              ['main', 'ติดตามคนเริ่มงาน'],
              ['replacement', 'ติดตามส่งคนแทน'],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className="grid grid-cols-3 items-baseline gap-2 text-sm sm:grid-cols-4">
              <span className="col-span-3 text-muted-foreground sm:col-span-1">{label}</span>
              <span className="tabular-nums text-foreground">
                <span className="text-lg font-medium">{breakdown[k].total.toLocaleString('th-TH')}</span>{' '}
                <span className="text-xs text-muted-foreground">{unit}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                AI โทร <span className="font-medium text-foreground">{breakdown[k].ai.toLocaleString('th-TH')}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                คนโทร <span className="font-medium text-foreground">{breakdown[k].staff.toLocaleString('th-TH')}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default AiShareDetail;
