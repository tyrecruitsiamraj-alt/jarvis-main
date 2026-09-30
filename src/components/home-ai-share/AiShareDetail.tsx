/**
 * ═══ กราฟยอดใช้งานของหัวข้อที่เลือก (รอบ 3 → รอบ 18 · 30 ก.ย. 2569) ═══
 *
 * รอบ 5 เจ้าของ: *"พอเลือกดูอันไหนก็แสดงกราฟ · กราฟขอกราฟแท่ง default ย้อนหลัง 7 วัน ถ้าเปลี่ยน calendar ก็เปลี่ยนตาม ·
 * กราฟโชว์ว่ายอดใช้งานของแต่ละวัน แต่ละเดือนเท่าไหร่"*
 * - แท่งรายวันตลอดช่วงที่เลือก · ยาวเกิน 62 วัน = รายเดือน (`detailBuckets`)
 * - สวิตช์ "แยก BU" (รอบ 7) — ปิด (ค่าตั้งต้น) = ชั้นในแท่งเป็น AI โทร/คนโทร/ยังไม่โทร · เปิด = แต่ละ BU เท่าไหร่
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
import React, { useEffect, useId, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import AiShareUsageChart, { type UsageStack } from '@/components/home-ai-share/AiShareUsageChart';
import { segmentDotClass, segmentFillClass } from '@/components/home-ai-share/segmentStyle';
import { toneOfBu } from '@/components/team-online/teamOnlineTones';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
  drillWindow,
  rowsInRange,
  type AiShareDetailResponse,
  type AiShareGrain,
  type AiShareWindow,
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
}> = ({ title, unit, win, withBoth, data, loading, error }) => {
  /** สวิตช์ "แยก BU" — ปิดเป็นค่าตั้งต้น (ชั้นในแท่ง = AI/คน/ยังไม่โทร) */
  const [byBu, setByBu] = useState(false);
  /** ชั้นที่กดลงไปดู (รอบ 18) — ว่าง = ช่วงที่เลือกบนปฏิทิน · ตัวท้าย = ชั้นที่กำลังดู */
  const [drill, setDrill] = useState<AiShareWindow[]>([]);
  const switchId = useId();

  // เปลี่ยนหัวข้อ/ช่วงแล้วกลับชั้นบนสุด
  useEffect(() => {
    setDrill([]);
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
    const segmentStacks: UsageStack[] = AI_SHARE_SEGMENTS.filter((k) => k !== 'both' || withBoth || segments.both.some((v) => v > 0)).map(
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
    const first = buckets[0];
    const last = buckets[buckets.length - 1];
    const range = first && last ? rangeTextFull(first.from, last.to) : null;
    return { buckets, grain, segmentStacks, buStacks, range };
  }, [rows, shownWin, drill.length, today, withBoth, lockedBu]);
  const failed = error ?? data?.error ?? null;
  const per = view ? AI_SHARE_GRAIN_LABEL[view.grain] : 'วัน';

  /** กดแท่งหน่วยใหญ่ = ลงไปดูข้างใน (แท่งรายวันไม่มีข้างใน กราฟจึงไม่ส่งตัวกดมา) */
  const openBucket = (i: number) => {
    const b = view?.buckets[i];
    const next = b && view ? drillWindow(b, view.grain) : null;
    if (next) setDrill((d) => [...d, next]);
  };

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
        <div className="flex items-center gap-2">
          <Switch id={switchId} checked={byBu} onCheckedChange={setByBu} />
          <Label htmlFor={switchId} className="cursor-pointer text-sm font-normal text-muted-foreground">
            แยก BU
          </Label>
        </div>
      </div>

      {loading && !view ? (
        <Skeleton className="h-64 w-full rounded-2xl" aria-label={`กำลังโหลดกราฟ${title}`} />
      ) : failed && !view ? (
        <p className={cn('text-sm', TONE.danger.value)}>{failed}</p>
      ) : view ? (
        <AiShareUsageChart
          buckets={view.buckets}
          stacks={byBu ? view.buStacks : view.segmentStacks}
          flipKey={byBu ? 'bu' : 'segments'}
          hideZeroInTooltip={byBu}
          grain={view.grain}
          unit={unit}
          today={today}
          ariaLabel={`${title} ยอดใช้งานราย${per}${byBu ? ' แยก BU' : ''}`}
          onPick={view.grain === 'day' ? undefined : openBucket}
          pickHint={PICK_HINT[view.grain]}
        />
      ) : null}
    </section>
  );
};

export default AiShareDetail;
