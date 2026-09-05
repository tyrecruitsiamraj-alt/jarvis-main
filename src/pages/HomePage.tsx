import React, { useEffect, useState } from 'react';
import { fetchCallRateSeries } from '@/lib/callFunnelApi';
import { bangkokTodayYmd, compareCallRate } from '@/lib/lumosCallRate';
import HomeSection from '@/components/home/HomeSection';
import { Button } from '@/components/ui/button';
import {
  useNavigate } from 'react-router-dom';
import {
  PhoneForwarded,
  Phone,
  PhoneCall,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { BrandTitle } from '@/components/shared/BrandMark';
import { cn } from '@/lib/utils';
import { TONE, type ToneKey } from '@/lib/designTokens';
import {
  fetchFlowSummary,
  confirmedThisMonth,
  callResultsThisMonth,
  type FlowSummary,
  type FlowFollowUpItem,
  type PostingStages,
} from '@/lib/flowSummaryApi';
import {
  bookingActionFor,
  bookingTargetFromPersonRef,
} from '@/lib/callResultBooking';
import { ProposalConflictError, saveProposal } from '@/lib/candidateProposalsApi';
import TeamBoardPanel from '@/components/home/TeamBoardPanel';
import { fetchOfficeTeam, type OfficeTeamResponse } from '@/lib/officeTeamApi';
import { fetchOfficeFloor, type OfficeFloorResponse } from '@/lib/officeFloorApi';
import { buildNextTasks } from '@/lib/nextTask';
import CommandDeck from '@/components/home/CommandDeck';
import HomeDeckV2 from '@/components/home/HomeDeckV2';
import { useUiV2 } from '@/lib/uiV2';
import { useConveyorCounts } from '@/hooks/useConveyorCounts';

import HomeKpiRow from '@/components/home/HomeKpiRow';
import HomeBuFilter from '@/components/home/HomeBuFilter';
import { fetchHomeKpis, type HomeKpisResponse } from '@/lib/homeKpiApi';
import { buildOpenRequestsCard } from '@/lib/homeKpi';
import { lumosConnectRate } from '@/lib/lumosLinkHealth';


/**
 * โครงคอลัมน์ของ funnel — การ์ด 4 ช่องกว้างเท่ากัน คั่นด้วยช่องลูกศร 3 ช่อง
 * (เหลือ 4 ขั้นตั้งแต่ 12 ส.ค. 2569 — เจ้าของสั่งเอากล่อง "จองตัวอยู่ / ลงงาน" ออก)
 *
 * ⚠️ ทั้งสองแถว (เส้นหลัก / เส้นที่ไม่มีคนแนะนำ) ต้องใช้ค่านี้ตัวเดียวกัน คอลัมน์จึงตรงกันเสมอ
 * เดิมใช้ flex ล้วน ซึ่งแบ่งความกว้างตาม **เนื้อหา** ของแต่ละแถว แถวล่างจึงกว้างกว่าและเยื้อง
 * (วัดจริง: การ์ด 214 vs 206 · เยื้อง 8–32px) `minmax(0,1fr)` บังคับให้ทุกช่องเท่ากันไม่ว่าข้างในยาวแค่ไหน
 * มือถือถอยเป็นเรียงลงล่างเหมือนเดิม
 */

/**
 * ก้อนตัวเลข 1 ขั้นใน funnel — กดแล้วพาไปหน้าที่เกี่ยวข้อง
 * สีทั้งแถบหัวการ์ดและตัวเลขมาจาก token กลางตัวเดียว (@/lib/designTokens) ไม่ประกาศ class สีที่นี่
 */
/**
 * โทนของ 4 กล่องผลโทร (เจ้าของกำหนด 12 ส.ค. 2569) — ทิศทางสีชุดเดียวกับ callOutcomeTone:
 * เขียว=จบดี · เหลือง=ยังไม่จบ รอโทรซ้ำ · ส้ม=ต้องคนตาม · แดง=จบไม่ดี
 */
const FOLLOW_UP_TONE = {
  good: {
    tone: 'success',
    dot: '🟢',
    hint: 'สนใจงาน — พร้อมให้จอง',
  },
  warn: {
    tone: 'warn',
    dot: '🟡',
    hint: 'ไม่สะดวก — รอ AI โทรซ้ำตามนัด',
  },
  act: {
    tone: 'orange',
    dot: '🟠',
    hint: 'ไม่สะดวก — ต้องคนเร่งจัดการ',
  },
  bad: {
    tone: 'danger',
    dot: '🔴',
    hint: 'ไม่สนใจงาน',
  },
} as const satisfies Record<string, { tone: ToneKey; dot: string; hint: string }>;
type FollowUpTone = keyof typeof FOLLOW_UP_TONE;

/** รายชื่อคนในกล่องผลโทร — สีของแถวบอกปลายทางเอง กดแล้วเปิดรายละเอียดคน */
function FollowUpList({
  items,
  tone,
  onOpen,
  max = 3,
}: {
  items: FlowFollowUpItem[];
  tone: FollowUpTone;
  onOpen: (item: FlowFollowUpItem) => void;
  /** จำนวนชื่อที่โชว์ก่อนยุบเป็น "…และอีก N" */
  max?: number;
}) {
  const t = FOLLOW_UP_TONE[tone];
  if (items.length === 0) {
    return <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">— ไม่มีรายชื่อ</p>;
  }
  return (
    <div className="mt-1.5 space-y-1">
      {items.slice(0, max).map((it) => (
        <button
          key={`${it.job_ref}:${it.person_ref}`}
          type="button"
          onClick={() => onOpen(it)}
          title={t.hint}
          className={cn(
            'w-full rounded-lg border px-2 py-1.5 text-left',
            TONE[t.tone].soft,
            TONE[t.tone].softHover,
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-foreground">
              <span aria-hidden>{t.dot}</span> {it.name || it.person_ref}
            </span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{it.request_no}</span>
          </div>
          {it.summary ? <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{it.summary}</p> : null}
        </button>
      ))}
      {items.length > max ? (
        <p className="text-[10px] text-muted-foreground">…และอีก {items.length - max} รายการ</p>
      ) : null}
    </div>
  );
}

/**
 * บรรทัดสถานะของการ์ด Content/Scraping — "รอดำเนินการ X · กำลังทำ Y · โพสแล้ว Z"
 * (เจ้าของสั่ง 13 ส.ค. 2569: ต้องบอกด้วยว่าไปถึงขั้นไหนแล้ว) · โชว์เฉพาะขั้นที่มีจริง
 * ป้ายใช้ชุดเดียวกับหน้าคำขอโพส (jobPostingStatusLabel) — เห็นคำเดียวกันทุกหน้า
 */
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  /**
   * 🔴 **สวิตช์โฉมใหม่** (5 ก.ย. 2569) — ระบบอยู่บน production แล้ว
   * ค่าตั้งต้น = ปิด ⇒ ทุกคนเห็นของเดิม 100% · เปิดดูเองด้วย `?ui=v2` (ปิดด้วย `?ui=v1`)
   * ข้อมูลที่ป้อนให้สองโฉมเป็น **ชุดเดียวกันทุกตัว** ต่างกันแค่เปลือก
   */
  const uiV2 = useUiV2();

  // สรุปการไหลของงาน — ของหลักของหน้านี้ (เมนูทั้งหมดอยู่ใน burger แล้ว)
  const [flow, setFlow] = useState<FlowSummary | null>(null);
  const [flowLoading, setFlowLoading] = useState(true);
  // กดชื่อคนในกล่องผลโทร → เปิดรายละเอียดคน + งานที่แมทไป ก่อนตัดสินใจเปิดใบขอ
  const [personDetail, setPersonDetail] = useState<{ item: FlowFollowUpItem; tone: FollowUpTone } | null>(null);
  // กดขั้น "ผลจากการโทร" → dialog 4 กล่อง (สนใจ/รอโทรซ้ำ/ต้องเร่งจัดการ/ไม่สนใจ) พร้อมชื่อคน
  const [callResultsOpen, setCallResultsOpen] = useState(false);
  // กดขั้น "ส่ง AI โทร" → dialog รายชื่อคนที่ถูกส่งไปแล้วและยังไม่มีผลกลับ
  const [activeCallsOpen, setActiveCallsOpen] = useState(false);
  /**
   * ปุ่ม "จองตัวเลย" ในกล่อง "สนใจงาน" — ปลายทางที่ `CALL_RESULT_DESTINATION.confirmed`
   * สัญญาไว้ว่า "เข้าเส้นจองตัว" แต่ไม่เคยมีปุ่มรออยู่จริง (ดู src/lib/callResultBooking.ts)
   * เก็บคีย์ที่จองแล้วไว้เพื่อกันกดซ้ำ — flow-summary จะตัดคนที่จองแล้วออกจากกล่องเองตอนโหลดใหม่
   */
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookedKeys, setBookedKeys] = useState<Record<string, true>>({});
  const [bookingError, setBookingError] = useState<string | null>(null);
  /** ฉากห้องทำงาน (เจ้าของสั่ง 22 ส.ค. 2569) — เลขดิบจาก /api/office-floor */
  const [office, setOffice] = useState<OfficeFloorResponse | null>(null);
  /**
   * KPI แถวบน + ตัวกรอง BU (Phase 10)
   * 🔴 โหลดล้มแล้ว **ซ่อนแถบไปเลย** — ห้ามขึ้นกรอบ error คาหน้าแรก (กติกาเดียวกับฉาก)
   */
  const [bu, setBu] = useState<string | null>(null);
  const [hud, setHud] = useState<HomeKpisResponse | null>(null);
  const [officeLoading, setOfficeLoading] = useState(true);
  /** ภาพรวม (KPI · ฉาก · funnel) หุบเป็นค่าตั้งต้น — เหตุผลเต็มอยู่ที่ปุ่มใน JSX */
  /** บอร์ด 4 ทีม — โหลดล้มไม่ล้มหน้า (แผงบอกเอง "โหลดไม่สำเร็จ" กดรีเฟรชได้) */
  const [team, setTeam] = useState<OfficeTeamResponse | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);

  const loadTeam = async () => {
    setTeamLoading(true);
    try {
      setTeam(await fetchOfficeTeam());
    } catch {
      setTeam(null);
    } finally {
      setTeamLoading(false);
    }
  };
  /** เลขบน node ของฉาก JARVIS Core — cache เดียวกับแถบเมนู (ไม่ยิงเส้นเพิ่ม) */
  const conveyorCounts = useConveyorCounts();

  const loadFlow = async () => {
    setFlowLoading(true);
    try {
      setFlow(await fetchFlowSummary());
    } catch {
      setFlow(null);
    } finally {
      setFlowLoading(false);
    }
  };

  /**
   * ฉากห้องทำงาน — โหลดคนละเส้นกับ flow-summary โดยตั้งใจ (เส้นนี้อ่านแต่ pg จึงเร็ว
   * ไม่ต้องรอ ERP) · ถ้าเส้นนี้ล้ม ฉากซ่อนตัวเองไปเลย ส่วนที่เหลือของหน้าแรกยังทำงานปกติ
   */
  const loadOffice = async () => {
    setOfficeLoading(true);
    try {
      setOffice(await fetchOfficeFloor());
    } catch {
      setOffice(null);
    } finally {
      setOfficeLoading(false);
    }
  };

  /** KPI + ตัวเลือก BU — โหลดใหม่ทุกครั้งที่สลับ BU (cache ฝั่ง API 20 วิ) */
  const loadHud = async (nextBu: string | null) => {
    try {
      setHud(await fetchHomeKpis(nextBu));
    } catch {
      setHud(null);
    }
  };

  useEffect(() => {
    void loadFlow();
    void loadOffice();
    void loadTeam();
  }, []);

  useEffect(() => {
    void loadHud(bu);
  }, [bu]);

  /**
   * "ใบขอเข้าใหม่วันนี้" มาจาก **flow-summary (ERP)** ไม่ใช่ `/api/home-kpis`
   * เพราะฝั่ง PostgreSQL ไม่มีวันที่ส่งใบขอ (`job_site_map` เก็บแค่ job_id/site_code)
   * และ `/api/home-kpis` ตั้งใจไม่แตะ MSSQL เพื่อให้หน้าแรกเบา
   *
   * 🔴 ต้องขยับตามปุ่มสลับ BU เหมือนการ์ดใบอื่น ⇒ flow-summary ส่ง `new_by_bu` มาให้
   * เลือกเอง · BU ที่ยังไม่มีใบเข้าใหม่ = ไม่มีคีย์ ⇒ ถือเป็น 0 (ถูกต้อง ไม่ใช่ "ไม่รู้")
   */
  const kpisWithRequests = React.useMemo(() => {
    if (!hud) return null;
    if (!flow) return hud.kpis;
    const pair = bu
      ? (flow.jobs.new_by_bu?.[bu] ?? { today: 0, yesterday: 0 })
      : { today: flow.jobs.new_today ?? 0, yesterday: flow.jobs.new_yesterday ?? 0 };
    return { ...hud.kpis, newRequests: pair };
  }, [hud, flow, bu]);

  /**
   * คิวงาน "ต้องทำอะไรก่อน" — ประกอบจากสองเส้นที่หน้านี้โหลดอยู่แล้ว **ไม่ยิงเส้นใหม่**
   * เส้นไหนยังไม่มา ช่องของเส้นนั้นเป็น `undefined` ⇒ ถังนั้นหายไปจากคิว
   * (ไม่ใช่กลายเป็น 0 ซึ่งจะอ่านว่า "ตรวจแล้วไม่มีงาน")
   */
  const nextTasks = React.useMemo(
    () =>
      buildNextTasks({
        followPastDue: office ? office.counts.follow.pastDue : null,
        applicantsUntouched: office ? office.counts.intake.untouched : null,
        claimedIdle: office ? office.counts.intake.claimedIdle : null,
        callsStale: flow ? flow.lumos.stale_delivered : null,
        needsHuman: flow ? flow.call_boxes.needs_human.length : null,
        slaBreached: flow ? (flow.jobs.sla_breached ?? null) : null,
      }),
    [office, flow],
  );

  /** คีย์กันกดซ้ำ — คนเดียวโผล่ได้หลายใบขอ จึงต้องผูกกับใบด้วย ไม่ใช่แค่ตัวคน */
  const bookingKeyOf = (item: FlowFollowUpItem) => `${item.job_ref}::${item.person_ref}`;

  /**
   * จองตัวจากผลโทร "สนใจ" — ใช้เส้นเดียวกับปุ่มจองในหน้า Matching (`saveProposal`)
   * จึงติดกติกาเดิมครบ: 1 คนจองได้ใบเดียว (backend ตอบ 409 พร้อมบอกว่าติดใบไหน)
   */
  const bookFromCallResult = async (item: FlowFollowUpItem) => {
    const target = bookingTargetFromPersonRef(item.person_ref);
    if (!target || bookingBusy) return;
    setBookingBusy(true);
    setBookingError(null);
    try {
      await saveProposal({
        jobId: item.job_ref,
        requestNo: item.request_no || null,
        source: target.source,
        candidateRef: target.candidateRef,
        candidateName: item.name,
        candidatePhone: item.phone,
        // ⚠️ ไม่ส่ง candidatePosition — `job_position` คือตำแหน่งของ **ใบขอ** ไม่ใช่ของผู้สมัคร
        //    ยัดลงไปจะได้ประวัติการจองที่บอกอาชีพผู้สมัครผิดโดยไม่มีใครทัก
        operatorName: user?.full_name || user?.username || null,
        status: 'reserved',
      });
      setBookedKeys((prev) => ({ ...prev, [bookingKeyOf(item)]: true }));
      // กล่อง "สนใจงาน" นับเฉพาะคนที่ยังไม่มีใครรับช่วงต่อ — โหลดใหม่แล้วคนนี้จะหลุดออกเอง
      void loadFlow();
    } catch (e) {
      if (e instanceof ProposalConflictError) {
        const where = e.conflict.request_no || e.conflict.job_id;
        setBookingError(`จองไม่ได้ — ติดจองอยู่กับใบขอ ${where} อยู่แล้ว ต้องยกเลิกใบนั้นก่อน`);
      } else {
        setBookingError(e instanceof Error ? e.message : 'จองตัวไม่สำเร็จ');
      }
    } finally {
      setBookingBusy(false);
    }
  };

  /**
   * **Success Rate ตรง Lumos บนหน้าหลัก** (เจ้าของสั่ง 4 ก.ย. 2569)
   * 🔴 ใช้ทางเดียวกับแดชบอร์ดเป๊ะ — `fetchCallRateSeries` + `compareCallRate(series, 7)`
   * ถ้าคำนวณเองคนละสูตร สองหน้าจะโชว์ % ไม่ตรงกัน แล้วไม่มีใครเชื่อสักหน้า
   * ⚠️ โหลดพลาด = `null` ให้จอขึ้นขีด **ห้ามแปลงเป็น 0%**
   */
  const [successRate, setSuccessRate] = useState<{ pct: number | null; connected: number } | null>(
    null,
  );

  useEffect(() => {
    let alive = true;
    void fetchCallRateSeries(60)
      .then((d) => {
        if (!alive || !d) return;
        const trend = compareCallRate(d.series, 7, bangkokTodayYmd());
        setSuccessRate({
          pct: trend.current.successRatePct,
          connected: trend.current.connected,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';

  return (
    /* 🔴 **จังหวะแนวตั้งชุดเดียว** (เจ้าของทัก 3 ก.ย. 2569 ว่าหน้าหลักดูสะเปะสะปะ)
       เดิมแต่ละแผงใส่ `mb-` ของตัวเอง (mb-5 · mb-3 · mb-6) ระยะห่างจึงไม่เท่ากันทั้งหน้า
       ⇒ ใช้ `space-y-5` ที่กล่องนอกอันเดียว แผงลูกไม่ต้องรู้เรื่องระยะห่างอีก */
    <div className="relative -mx-4 space-y-5 px-4 py-6 sm:-mx-5 sm:px-5 md:-mx-6 md:px-6 md:py-8 lg:-mx-8 lg:px-8">
      {/* ── Command Deck — ทั้งหน้าเป็นจอบัญชาการผืนเดียว (เจ้าของสั่งรอบสอง
          26 ส.ค. 2569 หลังตีตกรอบแรกว่า "รก ไม่สวย" · อ้างอิง cayla-flax.vercel.app) ──
          ทักทาย · หน้าปัด · งานถัดไป · คิว · แถบ 6 ขั้น รวมอยู่ใน canvas เดียว
          เลขมาจาก cache เดียวกับแถบเมนู (useConveyorCounts) ไม่ยิงเส้นเพิ่ม
          ใต้ deck คือบอร์ด 4 ทีมเมตริกครบ ทุกแถวกดนำทางได้ (TeamBoardPanel) */}
      {uiV2 ? (
        <HomeDeckV2
          greeting={greeting}
          userName={user?.full_name || user?.username || ''}
          tasks={nextTasks}
          loading={flowLoading || officeLoading}
          statusInput={{
            followPastDue: office ? office.counts.follow.pastDue : null,
            applicantsUntouched: office ? office.counts.intake.untouched : null,
            slaBreached: flow ? (flow.jobs.sla_breached ?? null) : null,
          }}
        />
      ) : (
        <CommandDeck
          greeting={greeting}
          userName={user?.full_name || user?.username || ''}
          tasks={nextTasks}
          loading={flowLoading || officeLoading}
          statusInput={{
            followPastDue: office ? office.counts.follow.pastDue : null,
            applicantsUntouched: office ? office.counts.intake.untouched : null,
            slaBreached: flow ? (flow.jobs.sla_breached ?? null) : null,
          }}
        />
      )}

      {/* ── บอร์ด 4 ทีม — เมตริกครบตามสเปกเจ้าของ + ทุกบรรทัดกดนำทางได้ ──
          🔴 ลำดับคำสั่งที่วนมาสามรอบ (จำให้ขึ้นใจ):
          1. เจ้าของพิมพ์สเปกเมตริก 4 ทีมเอง → ทำบอร์ด+ฉาก iso → ตีตก "ฉาก/ความ
             พยายาม visual" (ไม่ใช่เมตริก)
          2. ผมเข้าใจผิด ยุบเหลือการ์ดเปล่า 4 ใบ → โดนด่า "กล่องโง่ ๆ ที่ไม่รู้อะไร
             แล้วก็ต้องไปไล่กดหาเอง"
          3. เจ้าของ clarify: *"กล่องแต่ละทีมตอนแรกบอกรายละเอียดหมดเลย ฉันโอเคกะ
             แบบนั้น เลยให้ทำเป็นกดรายละเอียดอันไหนก็นำทางไปอันนั้น"*
          ⇒ เมตริกครบ + ทุกแถวกดได้ · ไม่มีฉาก/รายชื่อคน · tile 6 ขั้นบน deck
          ถูกตัดไปแล้ว (นำทางซ้ำ) — เลข 6 ขั้นอยู่ที่เมนูสายพานซ้ายมือ */}
      <TeamBoardPanel
        skin={uiV2 ? 'plain' : 'deck'}
        team={team}
        loading={teamLoading}
        onRefresh={() => void loadTeam()}
        floor={office ? office.counts : null}
        onOpenCallResults={() => setCallResultsOpen(true)}
        onOpenActiveCalls={() => setActiveCallsOpen(true)}
        successRate={successRate}
      />

      {/*
        🔴 **ภาพรวมหุบเป็นค่าตั้งต้น** (เจ้าของเคาะ 26 ส.ค. 2569) — และถูก **ยุบ**
        รอบสอง (เจ้าของสั่ง: *"อันไหนข้อมูลเดียวกันก็ยุบ ๆ รวม ๆ ไป มันจะได้ไม่เยอะ"*)
        เหลือแค่แถบ KPI "เหตุการณ์วันนี้" ที่ไม่ซ้ำกับใคร · ของที่ถูกยุบและ**ที่ไปของมัน**:
        - ผังห้อง (OpsRoomsPanel) → บอร์ดทีมแผนก (ตัวเลขถัง = deck + โซน AI)
        - LumosCallHealthPanel → โซน AI ของบอร์ดทีม (dialog เดิมสองตัวยังเปิดได้จากที่นั่น)
        - FollowTodayPanel → คิวบน deck (เลยนัด/ไม่ได้ส่ง AI) + หน้า Follow เอง
        - HomeDigestPanels → แถบ "ขยับล่าสุด" ของบอร์ดทีม + Dashboard
      */}
      {/* 🔴 **เลิกหุบแล้ว** (เจ้าของสั่ง 27 ส.ค. 2569: *"ซ่อนตัวเลขวันนี้ ข้อมูลในกล่องนี้
          เอาขึ้นมาโชว์เลยไม่ต้องคอยกดซ่อน"*) — ปุ่ม "ดูตัวเลขวันนี้" ถูกถอดออก
          ⚠️ หัวข้อต้องบอกให้ชัดว่าอะไรเป็นของวันนี้ อะไรเป็นยอดสะสม เพราะแถวนี้ปนกันอยู่:
          การ์ดใบแรก (ใบขอเปิดอยู่) เป็น **ยอดคงค้างตอนนี้** ส่วนที่เหลือเป็น
          **เหตุการณ์ของวันนี้เทียบเมื่อวาน** — เจ้าของถามตรง ๆ ว่า "ข้อมูลมันเฉพาะ
          วันนี้หรอหรือตลอด" ⇒ ต้องเขียนไว้บนจอ ไม่ใช่ให้เดา */}


      {/* ── KPI แถวบน + ตัวกรอง BU (Phase 10 · ตามภาพอ้างอิง 24 ส.ค. 2569) ──
          ตัวเลขทุกใบเป็น "เหตุการณ์วันนี้เทียบเมื่อวาน" ของจริง — ตัวที่เทียบไม่ได้
          จะไม่วาดลูกศรให้ (เหตุผลเต็มใน src/lib/homeKpi.ts)
          ⚠️ ซ่อนตัวเองเมื่อโหลดไม่ได้ เหมือนฉากห้องทำงาน */}
      {hud ? (
        /* 🔴 หัวข้อ + ตัวกรอง + การ์ด KPI อยู่ใน **เปลือกเดียวกับแผงอื่น** (HomeSection
           ที่ประกอบจาก Card ของ shadcn) — เดิมสามอย่างนี้ลอยอยู่บนพื้นเปล่า
           ไม่มีขอบไม่มีพื้น เลยดูหลุดจากบอร์ดข้างบนคนละเรื่อง */
        <HomeSection
          title="ตัวเลขวันนี้"
          subtitle={
            <>
              เทียบกับเมื่อวาน · แยกตามหน่วยธุรกิจได้ —{' '}
              <span className="font-medium">
                การ์ด &ldquo;ใบขอเปิดอยู่&rdquo; ใบเดียวเป็นยอดสะสม ไม่ใช่ของวันนี้
              </span>
            </>
          }
          action={
            <HomeBuFilter options={hud.bu_options} value={bu} onChange={setBu} />
          }
        >
          <HomeKpiRow
            kpis={kpisWithRequests}
            /* ใบขอเปิดอยู่ + ด่วน + สถานะ SLA — ย้ายขึ้นมาจากแถบ funnel ที่ถอดออก
               (24 ส.ค. 2569) · ยังไม่มี flow-summary = ไม่ส่งการ์ดนี้ (ห้ามโชว์ 0 ที่ยังไม่รู้จริง) */
            standing={
              flow
                ? buildOpenRequestsCard(flow.jobs.open_total, flow.jobs.urgent, {
                    breached: flow.jobs.sla_breached ?? null,
                    atRisk: flow.jobs.sla_at_risk ?? null,
                  })
                : null
            }
          />
        </HomeSection>
      ) : null}

      {/* ⚠️ ของที่เคยอยู่ตรงนี้ถูก **ยุบ** ตามคำสั่ง 26 ส.ค. 2569 (*"อันไหนข้อมูลเดียวกัน
          ก็ยุบ ๆ รวม ๆ ไป"*) — OpsRoomsPanel · funnel hero · HomeDigestPanels ·
          LumosCallHealthPanel · FollowTodayPanel — ที่ไปของแต่ละตัวเขียนไว้ที่
          คอมเมนต์เหนือหัวข้อ "ตัวเลขวันนี้" ข้างบน */}
      {/* เมนูหลักถูกถอดออก — ทุกโมดูลเข้าถึงได้จากปุ่ม ☰ (burger) ที่ header อยู่แล้ว */}

      {/* dialog "ผลจากการโทร" — 4 กล่องปลายทางพร้อมชื่อคน (เจ้าของกำหนดชุดกล่อง 12 ส.ค. 2569)
          กดชื่อ → เปิด personDetail ต่อ (dialog ซ้อนกัน — ตัวนี้ยังเปิดค้างไว้ให้กดคนถัดไป) */}
      <Dialog open={callResultsOpen} onOpenChange={setCallResultsOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground">ผลจากการโทร — ใครอยู่ปลายทางไหน</DialogTitle>
            <DialogDescription>
              สนใจ/ไม่สนใจนับของเดือนนี้ · รอโทรซ้ำ/ต้องเร่งจัดการคือของค้างตอนนี้ · กดชื่อเพื่อดูรายละเอียด
            </DialogDescription>
          </DialogHeader>
          {flow ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  { key: 'confirmed', label: 'สนใจงาน', tone: 'good', icon: PhoneCall },
                  { key: 'retry', label: 'ไม่สะดวก — รอ AI โทรซ้ำ', tone: 'warn', icon: PhoneForwarded },
                  { key: 'needs_human', label: 'ไม่สะดวก — ต้องเร่งจัดการ', tone: 'act', icon: AlertTriangle },
                  { key: 'declined', label: 'ไม่สนใจงาน', tone: 'bad', icon: Phone },
                ] as const
              ).map(({ key, label, tone, icon: Icon }) => {
                const items = flow.call_boxes[key];
                const t = FOLLOW_UP_TONE[tone];
                return (
                  <div key={key} className={cn('rounded-2xl border p-3', TONE[t.tone].soft)}>
                    <div className={cn('flex items-center gap-1.5 text-xs font-semibold', TONE[t.tone].num)}>
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {label} ({items.length})
                    </div>
                    <FollowUpList
                      items={items}
                      tone={tone}
                      max={5}
                      onOpen={(it) => {
                        // ล้าง error ของคนก่อนหน้า ไม่งั้นข้อความ "ติดจองใบอื่น" ค้างข้ามคน
                        setBookingError(null);
                        setPersonDetail({ item: it, tone });
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* dialog "ส่ง AI โทร" — รายชื่อคนที่ถูกส่งไปแล้วตอนนี้ (ยังไม่มีผลกลับ)
          แถวที่ค้างเกิน 2 วันขึ้นธงแดงให้เช็คกับทีม Lumos — แทนกล่อง "ติดขัด" เดิม */}
      <Dialog open={activeCallsOpen} onOpenChange={setActiveCallsOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            {/* ยอดจริงมาจากตัวนับในคิว ไม่ใช่ความยาวลิสต์ — ลิสต์ถูกตัดที่ 100 รายการแรก
                (ใช้ length จะโกหกทันทีที่ของจริงเกิน 100 — เจอจริง: ค้าง 1,484 โชว์ "100") */}
            <DialogTitle className="text-foreground">
              ส่ง AI โทร — รายชื่อที่รอผลอยู่ตอนนี้ (
              {((flow?.lumos.waiting_call ?? 0) + (flow?.lumos.delivered_waiting ?? 0)).toLocaleString('th-TH')})
            </DialogTitle>
            <DialogDescription>
              เรียงคนที่ค้างนานขึ้นก่อน · 🔴 = เกิน 2 วันยังไม่มีผลกลับ ควรเช็คกับทีม Lumos
              {flow && (flow.lumos.waiting_call + flow.lumos.delivered_waiting) > flow.active_calls.length
                ? ` · โชว์ ${flow.active_calls.length} รายการแรก`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {flow ? (
            flow.active_calls.length === 0 ? (
              <p className="text-sm text-muted-foreground">ไม่มีสายที่รอผลอยู่ตอนนี้</p>
            ) : (
              <div className="space-y-1">
                {flow.active_calls.map((it) => (
                  <button
                    key={`${it.job_ref}:${it.person_ref}`}
                    type="button"
                    onClick={() => setPersonDetail({ item: it, tone: it.stale ? 'bad' : 'warn' })}
                    className={cn(
                      'w-full rounded-lg border px-2 py-1.5 text-left',
                      it.stale ? TONE.danger.soft : TONE.primary.soft,
                      it.stale ? TONE.danger.softHover : TONE.primary.softHover,
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] font-medium text-foreground">
                        <span aria-hidden>{it.stale ? '🔴' : '📞'}</span> {it.name || it.person_ref}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{it.request_no}</span>
                    </div>
                    {it.stale ? (
                      <p className={cn('mt-0.5 text-[10px] font-medium', TONE.danger.value)}>
                        เกิน 2 วันยังไม่มีผลกลับ — ควรเช็คกับทีม Lumos
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            )
          ) : null}
        </DialogContent>
      </Dialog>

      {/* กดชื่อคนในกล่องผลโทร → รายละเอียดคน + แมทกับงานอะไรไป ก่อนเปิดใบขอ */}
      <Dialog open={!!personDetail} onOpenChange={(o) => !o && setPersonDetail(null)}>
        <DialogContent className="max-w-sm">
          {personDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  <span aria-hidden>{FOLLOW_UP_TONE[personDetail.tone].dot}</span>{' '}
                  {personDetail.item.name || personDetail.item.person_ref}
                </DialogTitle>
                <DialogDescription>{FOLLOW_UP_TONE[personDetail.tone].hint}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className={cn('rounded-xl border px-3 py-2.5 space-y-1', TONE.neutral.soft)}>
                  <p className="text-[11px] font-semibold text-muted-foreground">แมทกับใบขอ</p>
                  <p className="text-sm font-semibold text-foreground">
                    {personDetail.item.job_position || 'ไม่ระบุตำแหน่ง'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {personDetail.item.job_unit || '—'} ·{' '}
                    <span className="font-mono">{personDetail.item.request_no}</span>
                  </p>
                </div>
                <div className={cn('rounded-xl border px-3 py-2.5 space-y-1', TONE.neutral.soft)}>
                  <p className="text-[11px] font-semibold text-muted-foreground">ผลการโทรล่าสุด</p>
                  <p className="text-xs leading-relaxed text-foreground">
                    {personDetail.item.summary || 'ยังไม่มีสรุปบทสนทนา'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(personDetail.item.updated_at).toLocaleString('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                {/* ปุ่มจอง — เฉพาะกล่อง "สนใจงาน" (tone good) ตามที่เจ้าของกำหนดปลายทางของผลนี้
                    ปิดปุ่มเมื่อไหร่ต้องมีเหตุผลให้อ่านเสมอ (bookingActionFor · มีเทสต์บังคับ) */}
                {personDetail.tone === 'good'
                  ? (() => {
                      const item = personDetail.item;
                      const target = bookingTargetFromPersonRef(item.person_ref);
                      const action = bookingActionFor({
                        target,
                        jobId: item.job_ref,
                        personRef: item.person_ref,
                        alreadyBooked: bookedKeys[bookingKeyOf(item)] === true,
                        busy: bookingBusy,
                      });
                      return (
                        <div className={cn('rounded-xl border px-3 py-2.5 space-y-1.5', TONE.violet.soft)}>
                          <p className={cn('text-[11px] font-semibold', TONE.violet.num)}>
                            สนใจงานแล้ว — จองตัวไว้เลย
                          </p>
                          <button
                            type="button"
                            onClick={() => void bookFromCallResult(item)}
                            disabled={action.disabled}
                            className={cn(
                              'w-full rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50',
                              TONE.violet.solid,
                            )}
                          >
                            {bookedKeys[bookingKeyOf(item)] ? 'จองตัวแล้ว ✓' : 'จองตัวเลย'}
                          </button>
                          {action.reason ? (
                            <p className="text-[10px] text-muted-foreground">{action.reason}</p>
                          ) : null}
                          {bookingError ? (
                            <p className={cn('text-[10px] font-medium', TONE.danger.value)}>{bookingError}</p>
                          ) : null}
                        </div>
                      );
                    })()
                  : null}
                <div className="flex flex-wrap justify-end gap-2">
                  {/* 🔴 ปุ่มทั้งคู่ใช้ Button ของ shadcn — เลิกใช้คลาส `jarvis-btn-*`
                      ที่ปั้นปุ่มขึ้นเองใน CSS (ขัดกติกา UI · เจ้าของย้ำ 3 ก.ย. 2569) */}
                  {personDetail.item.phone ? (
                    <Button asChild variant="secondary" size="sm">
                      <a href={`tel:${personDetail.item.phone}`}>
                        <Phone aria-hidden /> {personDetail.item.phone}
                      </a>
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      const jobRef = personDetail.item.job_ref;
                      setPersonDetail(null);
                      navigate(`/matching/match?jobId=${encodeURIComponent(jobRef)}`);
                    }}
                  >
                    เปิดใบขอนี้ →
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomePage;
