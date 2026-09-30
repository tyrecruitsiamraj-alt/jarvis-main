/**
 * ═══ กราฟยอดใช้งานของหัวข้อที่เลือก + แผงเลื่อน "มาจาก BU ไหน" (รอบ 3 → รอบ 5 · 30 ก.ย. 2569) ═══
 *
 * รอบ 5 เจ้าของ: *"พอเลือกดูอันไหนก็แสดงกราฟ · กราฟขอกราฟแท่ง default ย้อนหลัง 7 วัน ถ้าเปลี่ยน calendar ก็เปลี่ยนตาม ·
 * กราฟโชว์ว่ายอดใช้งานของแต่ละวัน แต่ละเดือนเท่าไหร่ · กดดูกราฟไหนก็โชว์แบบ Slide มาทางขวาว่ายอดใช้งาน 800
 * เกิดจาก BU ไหนบ้าง แล้วแต่ละ BU ใช้คนหรือ AI อย่างละเท่าไหร่"*
 * - แท่งรายวันตลอดช่วงที่เลือก · ยาวเกิน 62 วัน = รายเดือน (`detailBuckets`)
 * - สวิตช์ "แยก BU" (รอบ 7) — ปิด (ค่าตั้งต้น) = ชั้นในแท่งเป็น AI โทร/คนโทร/ยังไม่โทร · เปิด = แต่ละ BU เท่าไหร่
 *   รอบ 12: กดสวิตช์แล้วแท่งพลิกไพ่ทีละแท่งจากซ้ายไปขวา (`flipKey`) — เจ้าของ *"หมุนก้อนพวกแท่งกราฟเหมือนหมุนไพ่"*
 *   ยอดบนหัวแท่งเท่ากันทั้งสองแบบ (แถวชุดเดียวกัน) · ไม่จำค่า เปิดหน้าใหม่กลับเป็น AI/คน ตามที่เจ้าของบอก
 * - กดแท่งรายวัน = แผงเลื่อนจากขวาของวันนั้น · ปุ่ม "ดูทั้งหมด" = ของทั้งกราฟที่กำลังดู
 *   (รอบ 7 เจ้าของว่าคำเดิม "ดูแยก BU ทั้งช่วง" แปลก ๆ — กดแท่ง = วันเดียว · ดูทั้งหมด = ทุกวันรวมกัน)
 * - แถววัน × BU มาจากหน้า (รอบ 9 · หน้าโหลด `?detail=` ครั้งเดียว) — หน้าส่งมาเฉพาะชุดที่ตรงกับหัวข้อ/ช่วงที่เลือกอยู่
 * - รอบ 17: หัวกราฟบอก **เดือน + ช่วงวันที่กำลังดู** ("24–30 กันยายน 2569") แทนเดือนบนแกนล่าง (แกนเหลือเลขวัน) ·
 *   โหมดแยก BU ขึ้นครบทุก BU รอไว้ (บัญชีที่ถูกล็อก BU = BU ของตัวเองตัวเดียว) · ไม่รู้ BU = สีจางจุดกลวง
 *   (สีเทาเดียวกับ CR — ต้องแยกให้ออก)
 * - รอบ 18: เลือกหลายเดือน/ปี/สัปดาห์บนปฏิทิน = หนึ่งแท่งต่อหน่วย (ยอดรวม) · **กดแท่งหน่วยใหญ่ = ลงไปดูข้างใน**
 *   (เดือน/สัปดาห์ → รายวัน · ปี → รายเดือน · `drillWindow`) · ปุ่ม "กลับ" ขึ้นทีละชั้น · แถวชุดเดิม ไม่โหลดใหม่ ·
 *   เปลี่ยนหัวข้อ/ช่วงบนปฏิทิน = กลับชั้นบนสุด · กล่องตัวเลขด้านบนยังเป็นของทั้งช่วงที่เลือก (ไม่ตามการกดลงไปดู)
 */
import React, { useEffect, useId, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import AiShareBuSheet from '@/components/home-ai-share/AiShareBuSheet';
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
  bucketText,
  detailBuSeries,
  detailBuckets,
  detailSegments,
  drillWindow,
  rowsInRange,
  type AiShareDetailResponse,
  type AiShareGrain,
  type AiShareWindow,
} from '@/lib/homeAiShare';
import { periodLabel, rangeTextFull } from '@/lib/periodPick';
import { cn } from '@/lib/utils';

type Pick = { from: string; to: string; scope: string };

/** บรรทัดท้ายตอนจี้แท่ง — กดแล้วได้อะไร */
const PICK_HINT: Record<AiShareGrain, string> = {
  day: 'กดที่แท่งเพื่อดูแยก BU',
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
  /** เปิด/ปิดแยกจากของที่โชว์ — ปิดแล้วเนื้อในยังอยู่จนแผงเลื่อนออกพ้นจอ (ไม่วูบเป็นหน้าว่าง) */
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  /** สวิตช์ "แยก BU" — ปิดเป็นค่าตั้งต้น (ชั้นในแท่ง = AI/คน/ยังไม่โทร) */
  const [byBu, setByBu] = useState(false);
  /** ชั้นที่กดลงไปดู (รอบ 18) — ว่าง = ช่วงที่เลือกบนปฏิทิน · ตัวท้าย = ชั้นที่กำลังดู */
  const [drill, setDrill] = useState<AiShareWindow[]>([]);
  const switchId = useId();

  // เปลี่ยนหัวข้อ/ช่วงแล้วแผงเลื่อนของเก่าต้องปิด ไม่ค้างเลขชุดเดิม · กลับชั้นบนสุด
  useEffect(() => {
    setSheetOpen(false);
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
    return { buckets, grain, segmentStacks, buStacks, range, inView };
  }, [rows, shownWin, drill.length, today, withBoth, lockedBu]);
  const pickRows = useMemo(() => (rows && pick ? rowsInRange(rows, pick.from, pick.to) : []), [rows, pick]);
  const failed = error ?? data?.error ?? null;
  const hasWork = !!view && view.inView.some((r) => r.total > 0);
  const per = view ? AI_SHARE_GRAIN_LABEL[view.grain] : 'วัน';

  const open = (p: Pick) => {
    setPick(p);
    setSheetOpen(true);
  };
  /** กดแท่ง — รายวัน = แผงเลื่อนของวันนั้น · หน่วยใหญ่ = ลงไปดูข้างใน */
  const openBucket = (i: number) => {
    const b = view?.buckets[i];
    if (!b || !view) return;
    const next = drillWindow(b, view.grain);
    if (next) setDrill((d) => [...d, next]);
    else open({ from: b.from, to: b.to, scope: bucketText(b, view.grain, 'long') });
  };
  const openAll = () => {
    const first = view?.buckets[0];
    const last = view?.buckets[view.buckets.length - 1];
    if (first && last) open({ from: first.from, to: last.to, scope: drill.length > 0 ? (view?.range ?? '') : periodLabel(win, today) });
  };

  return (
    <section className="space-y-4" aria-label={`ยอดใช้งาน${title}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <Button type="button" variant="outline" size="xs" disabled={!hasWork} onClick={openAll}>
          ดูทั้งหมด
        </Button>
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
          onPick={openBucket}
          pickHint={PICK_HINT[view.grain]}
        />
      ) : null}

      {rows ? (
        <AiShareBuSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={title}
          scope={pick?.scope ?? ''}
          unit={unit}
          rows={pickRows}
          withBoth={withBoth}
        />
      ) : null}
    </section>
  );
};

export default AiShareDetail;
