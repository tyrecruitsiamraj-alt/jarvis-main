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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Clock, FileText, Link2, Phone, Repeat, Users, type LucideIcon } from 'lucide-react';
import { useLiveTick } from '@/hooks/useLiveTick';
import { toYmdBangkok } from '@/lib/dateTh';
import { KpiTile } from '@/components/home-ai-share/HomeKpis';
import TopicReportCard, { useTopicReport } from '@/components/home-ai-share/TopicReportCard';
import { HomeSection, SegLegend, SplitBars, StatStrip, type StatItem } from '@/components/home-ai-share/HomeSections';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { segmentFillClass } from '@/components/home-ai-share/segmentStyle';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { metricHelp, type MetricKey } from '@/lib/metricDictionary';
import { countPill } from '@/lib/teamOnline';
import AiShareDetail from '@/components/home-ai-share/AiShareDetail';
import AiShareListDialog from '@/components/home-ai-share/AiShareListDialog';
import FollowCallerDialog from '@/components/home-ai-share/FollowCallerDialog';
import HomeOnlineTab from '@/components/home-ai-share/HomeOnlineTab';
import AiShareLumosStats, { FOLLOW_RESULT_COLS, useHomeLumosSummary } from '@/components/home-ai-share/AiShareLumosStats';
import {
  followBuSplit,
  followResultSplit,
  followTeamTotals,
  reportBuSplit,
  reportResultSplit,
  groupResultRows,
  splitCalledRow,
  splitTotalRow,
} from '@/lib/homeSplit';
import {
  buildAftercareReport,
  buildApplicantsReport,
  buildMatchingReport,
  emptyMatchingFlow,
  type ReportItem,
  type TopicReport,
} from '@/lib/homeTopicReport';
import PeriodPicker from '@/components/shared/PeriodPicker';
import { Card } from '@/components/ui/card';
import {
  AI_SHARE_SEGMENTS,
  AI_SHARE_SEGMENT_LABEL,
  AI_SHARE_UNIT,
  segmentsOfTotal,
  type AiShareSegment,
  defaultAiShareWindow,
  isAiShareBlock,
  homeQueryKey,
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
import { SITE_BU_TO_DEPT, trendBuLabel } from '@/lib/trends/bu';
import { EVEN_TYPE, TONE, type ToneKey } from '@/lib/designTokens';
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

/** ตัวเลือก BU (โฉมแบบ Codex 8 ต.ค. 2569) — รหัสแผนกชุดเดียวของทั้งระบบ · บัญชีที่ถูกล็อก BU ไม่เห็นตัวเลือกนี้ */
const BU_OPTIONS = [...new Set(Object.values(SITE_BU_TO_DEPT))];

/** สี + ไอคอนของกล่องแต่ละก้อน — สีชุดเดียวกับแท่ง (`AI_SHARE_CALLED_TONE`) */
const SEG_TILE: Record<AiShareSegment, { tone: ToneKey; icon: LucideIcon }> = {
  ai: { tone: 'primary', icon: Bot },
  staff: { tone: 'violet', icon: Users },
  both: { tone: 'teal', icon: Repeat },
  notCalled: { tone: 'neutral', icon: Clock },
};
const TOTAL_ICON: Record<AiShareBlockKey, LucideIcon> = { follow: Phone, aftercare: Phone, applicants: FileText, matching: Link2 };

/** รายงานว่าง (ชื่อขั้นครบ เลข 0) — ระหว่างโหลดการ์ดยังอยู่ครบ ไม่หุบ/ไม่ขึ้นคีย์ดิบ (กติกา "ว่างแล้วห้ามหาย") */
const EMPTY_REPORT: Record<'applicants' | 'matching' | 'aftercare', TopicReport> = {
  applicants: buildApplicantsReport([], 0, 0),
  matching: buildMatchingReport([], emptyMatchingFlow()),
  aftercare: buildAftercareReport([]),
};

/** ขั้นของรายงาน (`funnel`) ตามคีย์ — ไม่มี = 0 */
const stepOf = (r: TopicReport | null, key: string): ReportItem => r?.funnel.find((f) => f.key === key) ?? { key, label: key, value: 0 };
const extraOf = (r: TopicReport | null, title: string): StatItem[] => r?.extra.find((x) => x.title === title)?.items ?? [];

type BlockMeta = {
  key: AiShareBlockKey;
  title: string;
  unit: string;
  withBoth: boolean;
  metrics: { total: MetricKey } & Record<AiShareSegment, MetricKey | null>;
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
    metrics: {
      total: 'aiShare.followTotal',
      ai: 'aiShare.followAi',
      staff: 'aiShare.followStaff',
      both: null,
      notCalled: 'aiShare.followNotCalled',
    },
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
    metrics: {
      total: 'aiShare.appsTotal',
      ai: 'aiShare.appsAi',
      staff: 'aiShare.appsStaff',
      both: 'aiShare.appsBoth',
      notCalled: 'aiShare.appsNotCalled',
    },
  },
  {
    key: 'matching',
    title: conveyorLabel('matching'),
    unit: AI_SHARE_UNIT,
    withBoth: true,
    metrics: {
      total: 'aiShare.matchTotal',
      ai: 'aiShare.matchAi',
      staff: 'aiShare.matchStaff',
      both: 'aiShare.matchBoth',
      notCalled: 'aiShare.matchNotCalled',
    },
  },
];

/** หัวข้อที่เลือกไว้ล่าสุด — จำในเครื่องของคนดูเท่านั้น (อ่านไม่ได้ = กลับไปติดตาม) */
const BLOCK_STORE = 'jarvis:home-ai-share:block';
/** ค่าของปุ่มแท็บทีม Online ในแถบหัวข้อ (ไม่ใช่ `AiShareBlockKey`) */
const ONLINE_TAB = 'online';
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
   * แท็บทีม Online (เจ้าของ 8 ต.ค. 2569 "แยกหน้าได้จาก 4 แท็บเป็น 5 แท็บ") — ใบขอ → ประกาศ → ผลประกาศ → ประเภทงาน → BU
   * แยกจาก `block` (ไม่ใช่ก้อนของตัวนับกล่องเดิม) · เลือกแล้วส่วนของหัวข้อเดิมซ่อนทั้งหมด
   */
  const [online, setOnline] = useState(false);
  /** BU ที่เลือก (null = ทุก BU) — ส่งไปทุกเส้นของหน้า · บัญชีที่ถูกล็อก BU เซิร์ฟเวอร์บังคับเอง */
  const [bu, setBu] = useState<string | null>(null);
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
  // ช่วง + BU เป็นก้อนเดียว (memo — ของใหม่ทุกครั้ง = ดึงซ้ำไม่จบ)
  const winQ = useMemo(() => ({ ...win, bu }), [win, bu]);
  const cardQ = useMemo(() => ({ ...cardWin, bu }), [cardWin, bu]);
  const choose = (v: string) => {
    if (v === ONLINE_TAB) {
      setOnline(true);
      return;
    }
    if (!isAiShareBlock(v)) return;
    setOnline(false);
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
  /** ผลโทร (การ์ดผลโทร + กล่องเลือกผล) — โหลดครั้งเดียวทั้งหน้า */
  const lumos = useHomeLumosSummary(block, cardQ, tick);
  /** รายงานของหัวข้ออื่น (ขั้น · ผลแยกก้อน · BU) — โหลดครั้งเดียวทั้งหน้า */
  const topic = useTopicReport(block === 'follow' ? null : block, cardQ, tick);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const cardWinRef = useRef(cardQ);
  cardWinRef.current = cardQ;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchHomeAiShare(cardQ)
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
  }, [cardQ]);

  // รอบอัปเดตสด — โหลดเงียบ ๆ เลขเดิมค้างไว้จนเลขใหม่มา · ล้มก็เงียบ (รอบหน้าลองใหม่ ห้ามล้างจอเป็น error)
  useEffect(() => {
    if (tick === 0) return;
    let alive = true;
    const w = cardWinRef.current;
    const key = homeQueryKey(w);
    fetchHomeAiShare(w)
      .then((d) => {
        // มาถึงหลังเปลี่ยน BU/ช่วง = ทิ้ง (เดิมเทียบแค่วัน ⇒ เลข BU เก่าทับของใหม่) · สำเร็จ = ล้างแถบล้มด้วย
        if (alive && homeQueryKey(cardWinRef.current) === key) {
          setData(d);
          setError(null);
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
  /** กราฟผูกกับคีย์คำขอ (หัวข้อ + ช่วงวัน + BU) — เปลี่ยน BU แล้วกราฟ BU เก่าห้ามค้าง (QA 10 ต.ค. 2569) */
  const [detail, setDetail] = useState<{ key: string; d: AiShareDetailResponse } | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setDetailLoading(true);
    setDetailError(null);
    const key = homeQueryKey(winQ, block);
    fetchHomeAiShareDetail(block, winQ)
      .then((d) => {
        if (alive) setDetail({ key, d });
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
  }, [block, winQ]);

  // กราฟอัปเดตสดด้วยรอบเดียวกัน — โหลดเงียบ (ไม่ขึ้นโครงโหลด กราฟไม่กระพริบ)
  const blockWinRef = useRef({ block, win: winQ });
  blockWinRef.current = { block, win: winQ };
  useEffect(() => {
    if (tick === 0) return;
    let alive = true;
    const { block: b, win: w } = blockWinRef.current;
    const key = homeQueryKey(w, b);
    fetchHomeAiShareDetail(b, w)
      .then((d) => {
        const cur = blockWinRef.current;
        if (alive && homeQueryKey(cur.win, cur.block) === key) setDetail({ key, d });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);

  // เปลี่ยนช่วงแล้วเลขเก่าห้ามค้างให้อ่านผิดช่วง — ใช้ข้อมูลเฉพาะเมื่อตรงกับช่วงที่เลือก
  const current =
    data && data.from === cardWin.from && data.to === cardWin.to && (data.forced_bu || (data.bu ?? null) === bu) ? data : null;
  const detailNow = detail && detail.key === homeQueryKey(winQ, block) ? detail.d : null;
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
  /** กล่องที่เปิดป๊อปแยกเรื่อง (ติดตาม · AI โทร/คนโทร) — null = ป๊อปรายชื่อเดิม */
  const callerList: 'ai' | 'manual' | null =
    meta.key === 'follow' && listKey === 'ai' ? 'ai' : meta.key === 'follow' && listKey === 'staff' ? 'manual' : null;
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

  /**
   * หัวข้อเป็นปุ่มเม็ดยาวเรียงกัน (เจ้าของ 7 ต.ค. 2569 Choice "ปุ่มเม็ดยาวเรียงกัน" จากภาพอ้างอิง) — แทน Dropdown
   * AI % ของแต่ละหัวข้อขึ้นตอนจี้ (`noteOf`) · ปุ่มที่เลือก = เบอร์กันดี (`primary`)
   */
  const picker = (
    <Tabs value={online ? ONLINE_TAB : meta.key} onValueChange={choose}>
      <TabsList aria-label="เลือกหัวข้อ" className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
        <TabsTrigger
          value={ONLINE_TAB}
          className="h-10 rounded-full border border-foreground/10 bg-card px-5 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
        >
          ทีม Online
        </TabsTrigger>
        {BLOCKS.map((b) => (
          <TabsTrigger
            key={b.key}
            value={b.key}
            title={noteOf(b.key)}
            className="h-10 rounded-full border border-foreground/10 bg-card px-5 text-sm font-medium text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
          >
            {b.title}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );

  // ── กล่องตัวเลข (โฉมแบบ Codex 8 ต.ค. 2569 · `HomeKpis`) ──
  const showBoth = meta.withBoth || (counts?.both ?? 0) > 0;
  const segs = AI_SHARE_SEGMENTS.filter((k) => (k !== 'both' || showBoth) && (k !== 'notCalled' || meta.key !== 'follow'));
  const shareOf = counts ? new Map(segmentsOfTotal(counts).map((x) => [x.key, x.pct])) : null;
  const prevCounts = prev ? prev[meta.key] : null;
  const pillOf = (cur: number, p: number | undefined) => (prevCounts && p !== undefined ? countPill(cur, p, null) : null);
  const compareTitle = prev ? `เทียบกับ ${rangeText(prev.from, prev.to)} ช่วงเวลาเดียวกัน` : undefined;
  // เลขมาถึงครั้งแรก = ขึ้นทันที ไม่วิ่งจาก 0 (คีย์เปลี่ยนตอนมีข้อมูล) · อัปเดตสดรอบต่อไปจึงค่อยวิ่ง
  const liveKey = `${meta.key}|${cardWin.from ?? ''}|${cardWin.to ?? ''}|${bu ?? ''}|${counts ? 'on' : 'off'}`;
  const total = counts?.total ?? 0;
  const helpOf = (k: AiShareSegment) => {
    const key = meta.metrics[k];
    const help = key ? metricHelp(key) : undefined;
    return k === 'notCalled' && hint ? [help, hint].filter(Boolean).join('\n') : help;
  };
  /** ช่วง · BU ใต้ชื่อการ์ด */
  const sub = `${cardWin.from && cardWin.to ? rangeText(cardWin.from, cardWin.to) : 'ทุกวัน'} · ${
    current?.bu ? trendBuLabel(current.bu) : bu ? trendBuLabel(bu) : 'ทุก BU'
  }`;
  /** ก้อนที่โชว์ในแท่ง — ติดตามตั้งได้ทางเดียว (AI / คน) · หัวข้ออื่นครบ 4 ก้อนแบบกล่อง */
  const barSegs: AiShareSegment[] =
    meta.key === 'follow' ? ['ai', 'staff'] : showBoth ? ['ai', 'staff', 'both', 'notCalled'] : ['ai', 'staff', 'notCalled'];

  /**
   * กล่องบอกในตัวว่าโทรแล้ว/ยังรอ/ยกเลิก (เจ้าของ 8 ต.ค. 2569 "AI โทร 162 โทรหมดเลยใช่ไหม หรือแค่บอกว่าสายที่จะต้องโทร")
   * ติดตาม/ดูแลหลังเริ่มงาน นับตามแผน (ตั้งให้ใครโทร) ⇒ เลขใหญ่ = สายที่ตั้งไว้ · หัวข้ออื่นนับเมื่อโทรแล้วจริง (มีกล่องยังไม่โทรแยก)
   * ติดตาม: ผลจากการ์ดผลโทร (`FollowBucket` — AI/คนเท่ากล่องพอดี ตัวตรวจเลขคุม) · ดูแล: ยังไม่มีผล = รอโทร
   */
  const report = meta.key === 'follow' ? null : topic.report;
  /** ขั้น/ส่วนท้าย ใช้รายงานว่างระหว่างโหลด · แท่งใช้ `report` จริง (ระหว่างโหลดขึ้นโครง) */
  const steps = meta.key === 'follow' ? null : (topic.report ?? EMPTY_REPORT[meta.key]);
  type Breakdown = Array<{ key: string; label: string; value: number; tone?: ToneKey }>;
  const followSplit = meta.key === 'follow' ? (lumos.current?.follow ?? null) : null;
  const fromFollowBucket = (b: { total: number; waiting: number; cancelled: number } | null, doneLabel: string): Breakdown | null =>
    b
      ? [
          { key: 'done', label: doneLabel, value: b.total - b.waiting - b.cancelled, tone: 'success' },
          { key: 'waiting', label: 'รอโทร', value: b.waiting, tone: 'info' },
          { key: 'cancelled', label: 'ยกเลิก', value: b.cancelled, tone: 'neutral' },
        ]
      : null;
  const fromReach = (seg: AiShareSegment | 'all'): Breakdown | null => {
    if (meta.key !== 'aftercare' || !report) return null;
    let waiting = 0;
    let all = 0;
    for (const c of report.cells) {
      if (seg !== 'all' && c.seg !== seg) continue;
      all += c.n;
      if (c.col === 'noResult') waiting += c.n;
    }
    return [
      { key: 'done', label: 'โทรแล้ว', value: all - waiting, tone: 'success' },
      { key: 'waiting', label: 'รอโทร', value: waiting, tone: 'info' },
    ];
  };
  const breakdownOf = (k: AiShareSegment | 'all'): Breakdown | null => {
    if (meta.key === 'follow' && followSplit) {
      if (k === 'ai') return fromFollowBucket(followSplit.ai, 'โทรแล้ว');
      if (k === 'staff') return fromFollowBucket(followSplit.staff, 'ลงผลแล้ว');
      if (k === 'all')
        return fromFollowBucket(
          {
            total: followSplit.ai.total + followSplit.staff.total,
            waiting: followSplit.ai.waiting + followSplit.staff.waiting,
            cancelled: followSplit.ai.cancelled + followSplit.staff.cancelled,
          },
          'โทรแล้ว',
        );
    }
    if (meta.key === 'aftercare' && k !== 'notCalled') return fromReach(k);
    return null;
  };

  const tiles = (
    <div
      className={cn(
        'grid grid-cols-1 gap-3 [&>*]:min-w-0',
        segs.length + 1 === 3
          ? 'sm:grid-cols-3'
          : segs.length + 1 === 4
            ? 'sm:grid-cols-2 lg:grid-cols-4'
            : 'sm:grid-cols-3 lg:grid-cols-5',
      )}
    >
      <KpiTile
        emphasis
        icon={TOTAL_ICON[meta.key]}
        label="ทั้งหมด"
        value={total}
        unit={meta.unit}
        liveKey={liveKey}
        loading={loading && !counts}
        pill={pillOf(total, prevCounts?.total)}
        pillTitle={compareTitle}
        foot={prevCounts && prev?.label ? `${prev.label} ${NUM.format(prevCounts.total)}` : null}
        hint={metricHelp(meta.metrics.total)}
        breakdown={breakdownOf('all')}
        onClick={() => openList('total')}
      />
      {segs.map((k) => (
        <KpiTile
          key={k}
          tone={SEG_TILE[k].tone}
          icon={SEG_TILE[k].icon}
          label={AI_SHARE_SEGMENT_LABEL[k]}
          value={counts ? counts[k] : 0}
          liveKey={liveKey}
          loading={loading && !counts}
          share={shareOf?.get(k) ?? 0}
          shareClass={segmentFillClass(k)}
          pill={counts ? pillOf(counts[k], prevCounts?.[k]) : null}
          pillTitle={compareTitle}
          hint={helpOf(k)}
          breakdown={breakdownOf(k)}
          onClick={() => openList(k)}
        />
      ))}
    </div>
  );

  const chart = (
    <Card variant="solid" className="min-w-0 p-5 sm:p-6 lg:col-span-3">
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
        hideBreakdown
      />
    </Card>
  );

  // ── ข้อมูลของแท่ง (ทุกแท่งแยก AI/คน · เจ้าของ "ไปเนี่ย AI โทร คนโทรเท่าไหร่ Bu ไหนใช้เยอะ") ──
  const followCells = meta.key === 'follow' ? (lumos.current?.followByBu ?? null) : null;
  const resultCols = followCells ? followResultSplit(followCells, FOLLOW_RESULT_COLS) : report ? reportResultSplit(report) : [];
  // แถวบนสุด = ทั้งหมด (เจ้าของ 8 ต.ค. 2569 "ผลโทรต้องไล่เป็น โทรทั้งหมด ไป ไม่ไป ขอเลื่อน สรุปไม่ได้ ล้มเหลว ยกเลิก รอดำเนินการ")
  // ก้อน (8 ต.ค. 2569 "รอโทรกับยกเลิกและโทรไปแยกก้อนให้ดูแล้วรู้"): ทั้งหมด │ โทรแล้ว + ผลย่อย │ ยกเลิก · รอ
  // ติดตาม/ดูแลนับตามผล (ไม่นับยกเลิก/รอ/ยังไม่มีผล) · งานสรรหา/จับคู่งานโทรแล้ว = ตัดก้อนยังไม่โทร (เท่ากล่อง AI + คน + สองทาง)
  const calledKeys =
    meta.key === 'follow'
      ? ['went', 'notWent', 'reschedule', 'unclear', 'failed']
      : resultCols.map((r) => r.key).filter((k) => k !== 'noResult');
  const resultRows = resultCols.length
    ? groupResultRows(
        splitTotalRow(resultCols, meta.key === 'follow' ? 'โทรทั้งหมด' : 'ทั้งหมด'),
        meta.key === 'follow' || meta.key === 'aftercare'
          ? splitCalledRow(resultCols, 'โทรแล้ว', { keys: calledKeys })
          : splitCalledRow(resultCols, 'โทรแล้ว', { dropSeg: 'notCalled' }),
        resultCols,
        calledKeys,
      )
    : [];
  const buRows = followCells ? followBuSplit(followCells) : report ? reportBuSplit(report) : [];
  const barsLoading = meta.key === 'follow' ? !followCells : !report;
  const failed = meta.key === 'follow' ? lumos.failed : topic.failed;
  const resultTone = new Map<string, ToneKey>(
    (meta.key === 'follow' ? FOLLOW_RESULT_COLS : (report?.cols ?? [])).map((c): [string, ToneKey] => [c.key, c.tone]),
  );
  const teams = followCells ? followTeamTotals(followCells) : null;

  const resultsCard = (
    <HomeSection
      title={meta.key === 'aftercare' ? 'ผลการติดต่อ' : 'ผลโทร'}
      sub={sub}
      className="lg:col-span-2"
      testId="home-results"
      right={<SegLegend segs={barSegs} />}
    >
      {failed ? <p className={cn('text-sm', TONE.danger.value)}>{failed}</p> : null}
      {meta.key === 'aftercare' ? (
        <StatStrip arrows testId="home-reach" items={[stepOf(steps, 'total'), stepOf(steps, 'called'), stepOf(steps, 'reached')]} />
      ) : null}
      <SplitBars
        rows={resultRows}
        segs={barSegs}
        loading={barsLoading && !failed}
        emptyText="ไม่มีรายชื่อ"
        testId="home-result-bars"
        dotOf={(k) => {
          const t = resultTone.get(k);
          return t ? TONE[t].dot : null;
        }}
      />
      {meta.key === 'aftercare' ? <StatStrip testId="home-waiting" items={extraOf(steps, 'ที่ยังรอ')} /> : null}
    </HomeSection>
  );

  const buCard = (
    <HomeSection title="แต่ละ BU ใช้เท่าไหร่" sub={sub} testId="home-bu" right={<SegLegend segs={barSegs} />}>
      <SplitBars rows={buRows} segs={barSegs} loading={barsLoading && !failed} emptyText="ไม่มีรายชื่อ" testId="home-bu-bars" />
    </HomeSection>
  );

  /** คู่ที่จับไว้รอ — แท่งเขียว/เหลือง/แดง (จับคู่งาน) */
  const matched = stepOf(steps, 'matched');
  const tierBar = (
    <div className="space-y-3 rounded-xl border border-foreground/10 p-4" data-testid="home-matched">
      <p className="flex items-baseline gap-2">
        <span className="text-sm text-muted-foreground">{matched.label === 'matched' ? 'คนที่จับคู่รอ' : matched.label}</span>
        <span className="text-2xl font-medium tabular-nums text-foreground">{NUM.format(matched.value)}</span>
      </p>
      <div className="flex h-4 overflow-hidden rounded-full bg-muted" aria-hidden>
        {(matched.parts ?? []).map((p) => (
          <span
            key={p.key}
            className={cn('h-full', TONE[p.tone ?? 'neutral'].dot)}
            style={{ width: `${matched.value > 0 ? (p.value / matched.value) * 100 : 0}%` }}
          />
        ))}
      </div>
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums">
        {(matched.parts ?? []).map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className={cn('h-2.5 w-2.5 rounded-full', TONE[p.tone ?? 'neutral'].dot)} aria-hidden />
            {p.label} <span className="font-medium text-foreground">{NUM.format(p.value)}</span>
          </span>
        ))}
      </p>
    </div>
  );

  const todoList = (title: string) => (
    <div className="space-y-2 rounded-xl border border-foreground/10 p-4" data-testid={`report-extra-${title}`}>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <ul className="divide-y divide-foreground/10">
        {extraOf(steps, title).map((it) => (
          <li key={it.key} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              {it.tone ? <span className={cn('h-2.5 w-2.5 rounded-full', TONE[it.tone].dot)} aria-hidden /> : null}
              {it.label}
            </span>
            <span className="text-base font-medium tabular-nums text-foreground">{NUM.format(it.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    // ช่องไฟ + ระยะบรรทัดเท่ากันทั้งหน้า (รอบ 18 · `EVEN_TYPE`) — ป๊อป/แผงที่ลอยออกนอกหน้าใส่ของตัวเองอีกที
    <div className={cn('relative isolate space-y-5 py-6 md:py-8', EVEN_TYPE)}>
      {/* หัวหน้า (โฉมแบบ Codex 8 ต.ค. 2569): ชื่อหน้า + สด · ปฏิทิน + BU ขวา → แถบหัวข้อเต็มแถว */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-medium text-foreground">หน้าหลัก</h1>
            {/* จุดเขียวกระพริบ = กำลังอัปเดตสด · เวลาที่เลขชุดนี้มาถึง (ช่วงที่จบไปแล้ว = ไม่มีจุด) */}
            {updatedAt ? (
              <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-muted-foreground" data-testid="home-live">
                {live ? <span className={cn('h-2 w-2 animate-pulse rounded-full', TONE.success.dot)} aria-hidden /> : null}
                {live ? 'สด · ' : ''}อัปเดต {CLOCK.format(updatedAt)}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* ปุ่มปฏิทินเป็นไอคอนอย่างเดียว ไม่มีคำนำหน้า (เจ้าของสั่งถอดทั้ง "7 วันล่าสุด" และ "ช่วง" 30 ก.ย. 2569) */}
            <PeriodPicker value={win} onChange={setWin} />
            {current?.forced_bu && current.bu ? (
              <span className="text-sm text-muted-foreground">{trendBuLabel(current.bu)}</span>
            ) : (
              <Select value={bu ?? 'all'} onValueChange={(v) => setBu(v === 'all' ? null : v)}>
                <SelectTrigger className="h-10 w-44 bg-card" aria-label="เลือก BU">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุก BU</SelectItem>
                  {BU_OPTIONS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {trendBuLabel(b)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        {picker}
      </div>

      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}
      {blockError ? <p className={cn('text-xs', TONE.danger.value)}>{blockError}</p> : null}
      {flag ? <p className={cn('text-xs', TONE.warn.value)}>{flag}</p> : null}

      {online ? <HomeOnlineTab q={winQ} tick={tick} /> : null}
      {online ? null : (
      <>
      {/* ชื่อหัวข้อสำหรับโปรแกรมอ่านจอ — งานสรรหา/จับคู่งาน การ์ดแรกใช้ชื่อส่วน (ติดตาม/ดูแล การ์ดแรกคือชื่อหัวข้อเอง) */}
      {meta.key === 'applicants' || meta.key === 'matching' ? <h2 className="sr-only">{meta.title}</h2> : null}

      {/* ── ติดตาม ── */}
      {meta.key === 'follow' ? (
        <HomeSection
          title={meta.title}
          sub={sub}
          testId="home-intro"
          right={
            <div className="flex gap-2" data-testid="home-teams">
              {(
                [
                  ['main', 'คนเริ่มงาน'],
                  ['replacement', 'ส่งคนแทน'],
                ] as const
              ).map(([k, label]) => (
                <span key={k} className={cn('rounded-xl px-4 py-2', k === 'main' ? TONE.info.wash : TONE.teal.wash)}>
                  <span className="block text-xs text-muted-foreground">{label}</span>
                  <span className="block text-xl font-medium tabular-nums text-foreground">{teams ? NUM.format(teams[k]) : '—'}</span>
                </span>
              ))}
            </div>
          }
        >
          {tiles}
        </HomeSection>
      ) : null}

      {/* ── งานสรรหา ── */}
      {meta.key === 'applicants' ? (
        <>
          <HomeSection title="ใบขอและการประกาศ" sub={sub} testId="home-intro">
            <StatStrip
              testId="report-funnel"
              items={[
                { ...stepOf(steps, 'jobsIn'), unit: 'ใบ' },
                { ...stepOf(steps, 'published'), unit: 'ใบ' },
              ]}
            />
          </HomeSection>
          <HomeSection title="ผู้สมัครและผลโทร" sub={sub}>
            {tiles}
            <StatStrip
              testId="report-steps"
              items={[
                { ...stepOf(steps, 'total'), unit: meta.unit },
                { ...stepOf(steps, 'fast'), unit: meta.unit },
              ]}
            />
          </HomeSection>
        </>
      ) : null}

      {/* ── จับคู่งาน ── */}
      {meta.key === 'matching' ? (
        <>
          <HomeSection title="ใบขอและการจับคู่" sub={sub} testId="home-intro">
            <StatStrip
              arrows
              testId="report-funnel"
              items={['jobsIn', 'jobsMatched', 'jobsRecommend'].map((k) => ({ ...stepOf(steps, k), unit: 'ใบ' }))}
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {tierBar}
              {todoList('ต้องสั่งงาน')}
            </div>
          </HomeSection>
          <HomeSection title="การโทรและผลลัพธ์" sub={sub}>
            {tiles}
            <StatStrip
              arrows
              testId="report-steps"
              items={['total', 'called', 'interested', 'reserved', 'placed'].map((k) => stepOf(steps, k))}
            />
          </HomeSection>
        </>
      ) : null}

      {/* ── ดูแลหลังเริ่มงาน ── */}
      {meta.key === 'aftercare' ? (
        <HomeSection title={meta.title} sub={sub} testId="home-intro">
          {tiles}
        </HomeSection>
      ) : null}

      {/* กราฟรายวัน + ผล (แท่งแยก AI/คน) · ช่วงตามแท่งที่กด */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 [&>*]:min-w-0">
        {chart}
        {resultsCard}
      </div>

      {buCard}

      {/* งานสรรหา: นัดหมาย (แยกใครโทรคนแรก) + ส่งต่อให้คน */}
      {meta.key === 'applicants' ? (
        <HomeSection title="การนัดหมาย" sub={sub} testId="home-appointment">
          <StatStrip arrows testId="report-appointment" items={['interested', 'appointment', 'showed'].map((k) => stepOf(steps, k))} />
          <div className="space-y-2" data-testid="report-extra-ส่งต่อให้คน">
            <h3 className="text-sm font-medium text-foreground">ส่งต่อให้คน</h3>
            <StatStrip items={extraOf(steps, 'ส่งต่อให้คน')} />
          </div>
        </HomeSection>
      ) : null}
      {meta.key === 'matching' ? (
        <HomeSection title="ส่งต่อให้คน" sub={sub} testId="report-extra-ส่งต่อให้คน">
          <StatStrip items={extraOf(steps, 'ส่งต่อให้คน')} />
        </HomeSection>
      ) : null}

      {/* ตารางราย BU — เรื่อง/ก้อน × ผล (ของเดิมครบ · เจ้าของ "ห้ามเพิ่ม หรือเอาข้อมูลอะไรฉันออก") */}
      {meta.key === 'follow' ? (
        <AiShareLumosStats block={meta.key} unit={meta.unit} data={lumos.current} failed={lumos.failed} />
      ) : (
        <TopicReportCard block={meta.key} report={report} failed={topic.failed} unit={meta.unit} />
      )}
      </>
      )}

      {/* หัวข้อติดตาม กด AI โทร / คนโทร = แยกเรื่อง → ผล → รายชื่อ (เจ้าของ 7 ต.ค. 2569 "ป๊อปเดิม เปลี่ยนข้างใน") */}
      <FollowCallerDialog
        key={`caller-${listSeq}`}
        open={listOpen && callerList !== null}
        onOpenChange={setListOpen}
        caller={callerList ?? 'ai'}
        blockTitle={meta.title}
        unit={meta.unit}
        win={cardQ}
        count={counts ? counts[listKey] : null}
      />

      <AiShareListDialog
        key={listSeq}
        open={listOpen && callerList === null}
        onOpenChange={setListOpen}
        block={meta.key}
        blockTitle={meta.title}
        listKey={listKey}
        unit={meta.unit}
        win={cardQ}
        count={counts ? counts[listKey] : null}
      />
    </div>
  );
};

export default HomeAiSharePage;
