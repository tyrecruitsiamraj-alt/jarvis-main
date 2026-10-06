/**
 * ═══ หน้าหลักใหม่ — "ระบบไปกี่ %" (เจ้าของเริ่มใหม่ 30 ก.ย. 2569) ═══
 *
 * เจ้าของโละหน้าหลักเดิม (*"ลืมหน้าหลักไปเลยว่าเคยต้องการอะไร ฉันจะเริ่มใหม่"*) แล้วเริ่มจากเรื่องเดียว:
 * *"ฉันจะใช้เพื่อบอกว่าตอนนี้ระบบไปกี่ %"* — งานโทรหนักไปทาง AI หรือทางคน
 * รอบ 1: ติดตาม + ผู้สมัครในกล่องงาน เรียงบนล่างตามภาพที่เลือก
 * รอบ 2: *"เอาหน้าติดตามหลังเริ่มงานมาด้วย จับคู่งานด้วยเพิ่มมา · ช่วงฉันขอเป็น calendar"* ⇒ 4 หัวข้อ
 *        (ติดตาม → ดูแลหลังเริ่มงาน → ผู้สมัคร → จับคู่งาน) · คำบนจอเขียนแบบคนพูด ไม่ใช่ภาษา AI
 * รอบ 3: *"ด้านล่างเพิ่ม ใครกำลัง Online ใคร offline ใครยังไม่เข้าระบบ"* (แผงนี้ย้ายไป ตั้งค่า › ผู้ใช้งาน แล้ว รอบ 19) ·
 *        *"calendar มันดูยาก"* ⇒ `PeriodPicker` วันเดียว / ทั้งสัปดาห์ / ทั้งเดือน / ช่วงวัน · ค่าตั้งต้น **7 วันล่าสุด**
 * รอบ 4 (แบบอ้างอิง Dribbble 3 ลิงก์ เจ้าของเลือกเอง): เทียบกับช่วงก่อน · ป้ายหนักไปทางไหน · เกจครึ่งวง ·
 *        กราฟบอกวันที่มากสุด + เส้นเฉลี่ยต่อวัน
 * รอบ 5: *"แต่ละการ์ดมันเยอะไปหมด ทำเป็น Filter แบบ Dropdown ดีกว่า · พอเลือกดูอันไหนก็แสดงกราฟ · กราฟแท่ง
 *        ยอดใช้งานรายวัน/รายเดือน · กดดูกราฟไหนก็ Slide มาทางขวาว่ามาจาก BU ไหน · Style ขอแบบ Glass luxury"*
 *        ⇒ dropdown เลือกหัวข้อ (จำไว้ในเครื่อง) · แผงเดียว · แท่งซ้อน AI/คน · แผงเลื่อนแยก BU · โฉมกระจก
 * รอบ 6–8: ใครอยู่ในระบบปิดไว้ · ปุ่มปฏิทินเหลือไอคอน · ถอดเกจ/เส้นเฉลี่ย/แถว AI % · ยอดเป็นกล่อง Visual Control
 * รอบ 9: *"เอาอิโมจิใน Visual ออก · การ์ดกดแล้วหมุนเปลี่ยน · ในแท่งแบ่ง AI/คน/ไม่โทร/BU ว่ากี่ % · BU ไหนสีอะไร"*
 *        ⇒ เลข % ในแต่ละสีของแท่ง + ป้ายสีบอก % ทั้งช่วง · โหลดแถววัน×BU ที่หน้า
 * รอบ 10–12: dropdown ไปข้างปฏิทิน · *"ให้หมุนก้อนพวกแท่งกราฟเหมือนหมุนไพ่"* ⇒ กดสวิตช์แยก BU แท่งพลิกทีละแท่ง ·
 *        กล่องด้านบนเลิกพลิก (เจ้าของเลือก "เอาออก เหลือกล่องเฉย ๆ")
 * รอบ 17: กล่องเรียง ทั้งหมด → AI โทร → คนโทร → ยังไม่โทร · กดกล่อง = Popup รายชื่อ (`AiShareListDialog`) ·
 *        ปฏิทิน + dropdown ย้ายมาฝั่งซ้าย (ต่อจากชื่อหน้า) · ปฏิทินเหลือ "ช่วง" (เดือน/ทั้งปี + ปี) กับ "วันเดียว" ·
 *        แท่ง BU ขึ้นป้ายสีครบทุก BU · ในแท่งเหลือเลข + % · แกนล่างเหลือเลขวัน หัวกราฟบอกเดือน + ช่วงวัน
 * รอบ 18: ปฏิทิน วัน/สัปดาห์/เดือน/ปี กดสองครั้งเป็นช่วง + ปุ่มยืนยัน · เลือกหลายเดือน/ปี/สัปดาห์ = หนึ่งแท่งต่อหน่วย
 *        กดแท่งลงไปดูข้างใน · แผง "ผลโทร" ซ่อนไว้ · แท่งแคบลง · ช่องไฟ/ระยะบรรทัดเท่ากันทั้งหน้า (`EVEN_TYPE`)
 * รอบ 19: เจ้าของ *"ใครอยู่ในระบบ ย้ายไปหน้าอื่น หน้าตั้งค่าก็ได้"* → Choice "รวมเข้าตารางผู้ใช้งาน" ⇒ แผงท้ายหน้าถอดแล้ว
 *        ย้ายไป ตั้งค่า › ผู้ใช้งาน (`src/pages/settings/UserPresence.tsx`)
 *
 * นิยามอยู่ `src/lib/homeAiShare.ts` · ตัวเลขมาจาก `/api/home-ai-share` เส้นเดียว
 * 🔴 ชั้นคู่ขนาน: หน้านี้คือค่าตั้งต้นของ `/` (`?home=new`) · หน้าเดิมยังเรียกได้ที่ `?home=classic` (ทางถอย)
 * 🔴 ห้ามหยิบของหน้าหลักเดิม (deck · 3 ก้อน · ยอด Lumos) กลับมาใส่เอง — เจ้าของจะสั่งเพิ่มทีละเรื่อง
 * 🔴 โฉมกระจกไม่เบลอของที่เลื่อนจอ (เคยทำเว็บกระตุก 5 ก.ย. 2569) — แสงนวลข้างหลังเบลอมาแล้ว การ์ดแค่โปร่ง
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveTick } from '@/hooks/useLiveTick';
import { toYmdBangkok } from '@/lib/dateTh';
import AiShareCard, { type AiShareCardProps } from '@/components/home-ai-share/AiShareCard';
import AiShareDetail from '@/components/home-ai-share/AiShareDetail';
import AiShareListDialog from '@/components/home-ai-share/AiShareListDialog';
import HomeCallResultsPanel from '@/components/home-ai-share/HomeCallResultsPanel';
import PeriodPicker from '@/components/shared/PeriodPicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AI_SHARE_UNIT,
  defaultAiShareWindow,
  isAiShareBlock,
  sharesOfCalled,
  type AiShareBlockKey,
  type AiShareCounts,
  type AiShareDetailResponse,
  type AiShareListKey,
  type AiShareResponse,
  type AiShareWindow,
} from '@/lib/homeAiShare';
import { fetchHomeAiShare, fetchHomeAiShareDetail } from '@/lib/homeAiShareApi';
import { rangeText } from '@/lib/periodPick';
import { CONVEYOR_VAULT, conveyorLabel } from '@/lib/soRecruitNav';
import { trendBuLabel } from '@/lib/trends/bu';
import { EVEN_TYPE, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const CLOCK = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Bangkok' });

/**
 * อัปเดตสดทุก 30 วิ (เจ้าของ 6 ต.ค. 2569 "หน้าหลัก ต้องทำเป็น Interactive" → Choice "ตัวเลขอัปเดตเองสด ๆ")
 * 30 วิ = เท่ารอบ cache ของเส้น `/api/home-ai-share` (เร็วกว่านี้ได้เลขเดิม)
 */
const LIVE_MS = 30_000;
/** ช่วงที่เลือกยังมีวันนี้อยู่ไหม — จบไปแล้ว = เลขไม่เปลี่ยนอีก ไม่ต้องดึงซ้ำ */
const isLiveWindow = (w: AiShareWindow) => !w.to || w.to >= toYmdBangkok(new Date());

/** รายละเอียดของ "ยังไม่โทร" (ขึ้นตอนจี้) — บอกเฉพาะส่วนที่มีจริง */
const partsText = (parts: Array<[string, number]>) =>
  parts
    .filter(([, v]) => v > 0)
    .map(([label, v]) => `${label} ${NUM.format(v)}`)
    .join(' · ') || null;

/** ส่วนที่เหลือของ "ยังไม่โทร" หลังหักส่วนที่รู้เหตุแล้ว */
const restOf = (c: AiShareCounts, ...known: number[]) => Math.max(0, c.notCalled - known.reduce((s, v) => s + v, 0));

const STAFF_NOT_READY = 'ยังนับรายชื่อที่คนโทรไม่ได้ ต้องรออัปเดตระบบก่อน';

type BlockMeta = {
  key: AiShareBlockKey;
  title: string;
  unit: AiShareCardProps['unit'];
  withBoth: boolean;
  metrics: AiShareCardProps['metrics'];
};

/** ชื่อเมนูของหน้านั้น — คำในตัวเลือกต้องตรงกับเมนู (เจ้าของสั่ง 4 ต.ค. 2569) */
const vaultLabel = (key: string) => CONVEYOR_VAULT.find((v) => v.key === key)?.label ?? key;

/** ลำดับในตัวเลือก = ลำดับเดิมของหน้า (รอบ 2) · ติดตาม/ดูแลหลังเริ่มงานไม่มี "ทั้งสองทาง" (รอบหนึ่งตั้งได้ทางเดียว) · หน่วยเป็นรายชื่อทุกหัวข้อ (รอบ 18) */
const BLOCKS: readonly BlockMeta[] = [
  {
    key: 'follow',
    title: conveyorLabel('follow'),
    unit: AI_SHARE_UNIT,
    withBoth: false,
    metrics: { total: 'aiShare.followTotal', ai: 'aiShare.followAi', staff: 'aiShare.followStaff', both: null, notCalled: 'aiShare.followNotCalled' },
  },
  {
    key: 'aftercare',
    title: conveyorLabel('aftercare'),
    unit: AI_SHARE_UNIT,
    withBoth: false,
    metrics: {
      total: 'aiShare.aftercareTotal',
      ai: 'aiShare.aftercareAi',
      staff: 'aiShare.aftercareStaff',
      both: null,
      notCalled: 'aiShare.aftercareNotCalled',
    },
  },
  {
    key: 'applicants',
    title: vaultLabel('job-boxes'),
    unit: AI_SHARE_UNIT,
    withBoth: true,
    metrics: { total: 'aiShare.appsTotal', ai: 'aiShare.appsAi', staff: 'aiShare.appsStaff', both: 'aiShare.appsBoth', notCalled: 'aiShare.appsNotCalled' },
  },
  {
    key: 'matching',
    title: conveyorLabel('matching'),
    unit: AI_SHARE_UNIT,
    withBoth: true,
    metrics: { total: 'aiShare.matchTotal', ai: 'aiShare.matchAi', staff: 'aiShare.matchStaff', both: 'aiShare.matchBoth', notCalled: 'aiShare.matchNotCalled' },
  },
];

/** หัวข้อที่เลือกไว้ล่าสุด — จำในเครื่องของคนดูเท่านั้น (อ่านไม่ได้ = กลับไปติดตาม) */
const BLOCK_STORE = 'jarvis:home-ai-share:block';
function readBlock(): AiShareBlockKey {
  try {
    const v = window.localStorage.getItem(BLOCK_STORE);
    return isAiShareBlock(v) ? v : 'follow';
  } catch {
    return 'follow';
  }
}
function saveBlock(k: AiShareBlockKey) {
  try {
    window.localStorage.setItem(BLOCK_STORE, k);
  } catch {
    /* เก็บไม่ได้ก็แค่จำไม่ได้ */
  }
}

const HomeAiSharePage: React.FC = () => {
  const [win, setWin] = useState<AiShareWindow>(() => defaultAiShareWindow());
  const [data, setData] = useState<AiShareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [block, setBlock] = useState<AiShareBlockKey>(readBlock);
  /**
   * วันที่กดแท่งในกราฟ (หัวข้อติดตาม · 4 ต.ค. 2569) — กล่องตัวเลข/รายชื่อ/ผลโทร วิ่งตามวันนั้น
   * เหมือนเลือกวันนั้นบนปฏิทิน · null = ช่วงบนปฏิทิน · เปลี่ยนช่วง/หัวข้อแล้วล้าง
   */
  const [focus, setFocus] = useState<AiShareWindow | null>(null);
  const onFocusDay = useCallback((w: AiShareWindow | null) => {
    setFocus((cur) => (cur?.from === w?.from && cur?.to === w?.to ? cur : w));
  }, []);
  useEffect(() => {
    setFocus(null);
  }, [win, block]);
  const cardWin = focus ?? win;
  const choose = (v: string) => {
    if (!isAiShareBlock(v)) return;
    setBlock(v);
    saveBlock(v);
  };

  /**
   * Popup รายชื่อตอนกดกล่อง (รอบ 17) — เปิด/ปิดแยกจากกล่องที่โชว์ (ปิดแล้วชื่อชุดเดิมยังอยู่จนป๊อปจางหาย ไม่วูบเป็นหน้าว่าง) ·
   * `listSeq` เปลี่ยนทุกครั้งที่เปิด = Popup เริ่มใหม่ที่หน้าแรก ไม่ค้างหน้าของรอบก่อน
   */
  const [listOpen, setListOpen] = useState(false);
  const [listKey, setListKey] = useState<AiShareListKey>('total');
  const [listSeq, setListSeq] = useState(0);
  const openList = (k: AiShareListKey) => {
    setListKey(k);
    setListSeq((n) => n + 1);
    setListOpen(true);
  };

  /** อัปเดตสด — เลขรอบ (ตัวเดียวทั้งหน้า ส่งต่อให้กราฟ/แผงผลโทร) · เวลาที่โหลดสำเร็จล่าสุด */
  const live = isLiveWindow(cardWin);
  const tick = useLiveTick(live, LIVE_MS);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const cardWinRef = useRef(cardWin);
  cardWinRef.current = cardWin;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchHomeAiShare(cardWin)
      .then((d) => {
        if (alive) {
          setData(d);
          setUpdatedAt(new Date());
        }
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error && e.message ? e.message : 'โหลดหน้าหลักไม่ขึ้น ลองรีเฟรชอีกครั้ง');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [cardWin]);

  // รอบอัปเดตสด — โหลดเงียบ ๆ เลขเดิมค้างไว้จนเลขใหม่มา · ล้มก็เงียบ (รอบหน้าลองใหม่ ห้ามล้างจอเป็น error)
  useEffect(() => {
    if (tick === 0) return;
    let alive = true;
    const w = cardWinRef.current;
    fetchHomeAiShare(w)
      .then((d) => {
        if (alive && d.from === cardWinRef.current.from && d.to === cardWinRef.current.to) {
          setData(d);
          setUpdatedAt(new Date());
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);

  /**
   * แถววัน × BU ของหัวข้อที่เลือก — โหลดที่หน้า ส่งให้กราฟยอดใช้งาน (รอบ 9 ย้ายขึ้นมาจากกราฟ ·
   * รอบ 12 กล่องเลิกพลิกแล้ว เหลือกราฟใช้คนเดียว)
   */
  const [detail, setDetail] = useState<AiShareDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setDetailLoading(true);
    setDetailError(null);
    fetchHomeAiShareDetail(block, win)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch((e: unknown) => {
        if (alive) setDetailError(e instanceof Error && e.message ? e.message : 'โหลดกราฟไม่ขึ้น ลองอีกครั้ง');
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [block, win]);

  // กราฟอัปเดตสดด้วยรอบเดียวกัน — โหลดเงียบ (ไม่ขึ้นโครงโหลด กราฟไม่กระพริบ)
  const blockWinRef = useRef({ block, win });
  blockWinRef.current = { block, win };
  useEffect(() => {
    if (tick === 0) return;
    let alive = true;
    const { block: b, win: w } = blockWinRef.current;
    fetchHomeAiShareDetail(b, w)
      .then((d) => {
        const cur = blockWinRef.current;
        if (alive && d.block === cur.block && d.from === cur.win.from && d.to === cur.win.to) setDetail(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);

  // เปลี่ยนช่วงแล้วเลขเก่าห้ามค้างให้อ่านผิดช่วง — ใช้ข้อมูลเฉพาะเมื่อตรงกับช่วงที่เลือก
  const current = data && data.from === cardWin.from && data.to === cardWin.to ? data : null;
  const detailNow = detail && detail.block === block && detail.from === win.from && detail.to === win.to ? detail : null;
  const meta = BLOCKS.find((b) => b.key === block) ?? BLOCKS[0];
  const counts: AiShareCounts | null = current?.[meta.key] ?? null;
  const staffFlag = current && !current.follow_staff_ready ? STAFF_NOT_READY : null;
  const blockError = current?.errors[meta.key] ?? (error ? 'โหลดไม่ขึ้น' : null);
  const prev = current?.previous ?? null;

  const hint = (() => {
    if (!current) return null;
    if (meta.key === 'follow' || meta.key === 'aftercare') {
      const f = current[meta.key];
      return f
        ? partsText([
            ['รอ AI โทร', f.waitingAi],
            ['รอคนโทร', f.waitingStaff],
            ['ไม่ได้ส่งให้ AI', restOf(f, f.waitingAi, f.waitingStaff)],
          ])
        : null;
    }
    if (meta.key === 'applicants') {
      const a = current.applicants;
      return a
        ? partsText([
            ['รอ AI โทร', a.waitingAi],
            ['มีคนเก็บไว้', a.held],
            ['ยังไม่มีใครแตะ', a.untouched],
          ])
        : null;
    }
    const m = current.matching;
    return m
      ? partsText([
          ['รอ AI โทร', m.waitingAi],
          ['เจ้าหน้าที่รับไปแล้ว', m.holding],
          ['ไม่มีผลกลับมา', restOf(m, m.waitingAi, m.holding)],
        ])
      : null;
  })();
  // หัวข้อติดตามนับแบบแผน (ตั้งให้ใครโทร) ไม่พึ่งช่องผลของคนโทร ⇒ ไม่มีธง "ยังนับคนโทรไม่ได้"
  const flag = meta.key === 'aftercare' ? (counts && counts.total > 0 ? staffFlag : null) : null;


  /** เลขท้ายของแต่ละตัวเลือก — ดูเทียบทั้ง 4 หัวข้อได้โดยไม่ต้องกดสลับ */
  const noteOf = (key: AiShareBlockKey) => {
    if (!current) return '';
    const c = current[key];
    if (!c) return current.errors[key] ? 'โหลดไม่ขึ้น' : '';
    if (c.total <= 0) return 'ยังไม่มีงาน';
    const s = sharesOfCalled(c);
    return s ? `AI ${NUM.format(s.ai)}%` : 'AI —';
  };

  const picker = (
    <Select value={meta.key} onValueChange={choose}>
      {/* `!` = ชนะ `.jarvis-soft-field` ของ SelectTrigger ซึ่งอยู่ชั้น utilities หลัง Tailwind (แบบเดียวกับ TONE.bar) */}
      <SelectTrigger aria-label="เลือกหัวข้อ" className="h-10 min-w-52 gap-3 !w-auto !rounded-full !text-base font-medium">
        <SelectValue>{meta.title}</SelectValue>
      </SelectTrigger>
      <SelectContent className={cn('rounded-xl', EVEN_TYPE)}>
        {BLOCKS.map((b) => (
          <SelectItem key={b.key} value={b.key} className="py-2">
            <span className="flex w-80 items-center justify-between gap-6">
              <span>{b.title}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{noteOf(b.key)}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    // ช่องไฟ + ระยะบรรทัดเท่ากันทั้งหน้า (รอบ 18 · `EVEN_TYPE`) — ป๊อป/แผงที่ลอยออกนอกหน้าใส่ของตัวเองอีกที
    <div className={cn('relative isolate space-y-6 py-6 md:py-8', EVEN_TYPE)}>
      {/* แสงนวลกรมท่า/เบอร์กันดีข้างหลังการ์ดกระจก (ภาษาเดียวกับหน้า Login) — เบลอที่ตัวแสงครั้งเดียว ไม่เบลอตอนเลื่อนจอ */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        {/* ความเข้มเทียบกับแสงของหน้า Login (`LOGIN_SCENE.auraNavy` .16 · `auraBurgundy` .12) */}
        <div className="absolute right-0 top-0 h-80 w-80 rounded-full bg-primary/15 blur-3xl dark:bg-primary/20" />
        <div className="absolute left-0 top-1/4 h-96 w-96 rounded-full bg-foreground/15 blur-3xl dark:bg-foreground/5" />
        <div className="absolute bottom-10 right-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl dark:bg-primary/10" />
      </div>

      {/* ฝั่งซ้ายทั้งแถว (รอบ 17 · เจ้าของ: "calendar และ Dropdown ย้ายไปฝั่งซ้าย") — ชื่อหน้า → ปฏิทิน → dropdown หัวข้อ */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h1 className="text-2xl font-light text-foreground">หน้าหลัก</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* ปุ่มปฏิทินเป็นไอคอนอย่างเดียว ไม่มีคำนำหน้า (เจ้าของสั่งถอดทั้ง "7 วันล่าสุด" และ "ช่วง" 30 ก.ย. 2569) */}
          <PeriodPicker value={win} onChange={setWin} />
          {/* dropdown หัวข้ออยู่ข้างปฏิทิน (รอบ 10 · เจ้าของ: "ย้าย Dropdown ไปไว้ข้าง calendar") สูงเท่าปุ่มปฏิทิน */}
          {picker}
          {current?.forced_bu && current.bu ? (
            <span className="text-sm text-muted-foreground">{trendBuLabel(current.bu)}</span>
          ) : null}
          {/* จุดเขียวกระพริบ = กำลังอัปเดตสด · เวลาที่เลขชุดนี้มาถึง (ช่วงที่จบไปแล้ว = ไม่มีจุด) */}
          {updatedAt ? (
            <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground" data-testid="home-live">
              {live ? <span className={cn('h-2 w-2 animate-pulse rounded-full', TONE.success.dot)} aria-hidden /> : null}
              {live ? 'สด · ' : ''}อัปเดต {CLOCK.format(updatedAt)}
            </span>
          ) : null}
        </div>
      </div>

      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}

      <AiShareCard
        title={meta.title}
        unit={meta.unit}
        counts={counts}
        loading={loading}
        error={blockError}
        withBoth={meta.withBoth}
        metrics={meta.metrics}
        notCalledHint={hint}
        flag={flag}
        previous={prev ? prev[meta.key] : null}
        previousLabel={prev?.label ?? null}
        previousRange={prev ? rangeText(prev.from, prev.to) : null}
        onPick={openList}
        hideNotCalled={meta.key === 'follow'}
        liveKey={`${meta.key}|${cardWin.from ?? ''}|${cardWin.to ?? ''}`}
      >
        <AiShareDetail
          withTeams={meta.key === 'follow'}
          hideNotCalled={meta.key === 'follow'}
          onFocusDay={onFocusDay}
          unit={meta.unit}
          title={meta.title}
          win={win}
          withBoth={meta.withBoth}
          data={detailNow}
          loading={detailLoading}
          error={detailError}
        />
      </AiShareCard>

      <AiShareListDialog
        key={listSeq}
        open={listOpen}
        onOpenChange={setListOpen}
        block={meta.key}
        blockTitle={meta.title}
        listKey={listKey}
        unit={meta.unit}
        win={cardWin}
        count={counts ? counts[listKey] : null}
      />

      {/* ผลโทร ซ่อนไว้ กดแล้วกาง (รอบ 18) · "ใครอยู่ในระบบ" ย้ายไป ตั้งค่า › ผู้ใช้งาน แล้ว (รอบ 19) */}
      <HomeCallResultsPanel block={meta.key} blockTitle={meta.title} win={cardWin} tick={tick} />
    </div>
  );
};

export default HomeAiSharePage;
