import React, { useEffect, useState } from 'react';
import {
  useNavigate } from 'react-router-dom';
import {
  PhoneForwarded,
  Phone,
  PhoneCall,
  AlertTriangle,
  RefreshCw,
  LoaderCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { BrandTitle } from '@/components/shared/BrandMark';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { HUD, HUD_HEX, HUD_INK, TONE, type ToneKey } from '@/lib/designTokens';
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
import FollowTodayPanel from '@/components/home/FollowTodayPanel';
import LumosCallHealthPanel from '@/components/home/LumosCallHealthPanel';
import OfficeRooms from '@/components/home/OfficeRooms';
import { buildOfficeFloor, composeOfficeFloorRaw } from '@/lib/officeFloor';
import { fetchOfficeFloor, type OfficeFloorResponse } from '@/lib/officeFloorApi';
import HomeKpiRow from '@/components/home/HomeKpiRow';
import HomeBuFilter from '@/components/home/HomeBuFilter';
import HomeDigestPanels from '@/components/home/HomeDigestPanels';
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

  // สรุปการไหลของงาน — ของหลักของหน้านี้ (เมนูทั้งหมดอยู่ใน burger แล้ว)
  const [flow, setFlow] = useState<FlowSummary | null>(null);
  const [flowLoading, setFlowLoading] = useState(true);
  // เวลาที่ใช้คิด "Lumos เงียบมานานแค่ไหน" — ตั้งใหม่ทุกครั้งที่โหลดข้อมูล
  // (ไม่ใช้ Date.now() ตอน render ตรง ๆ เพื่อให้เลขนิ่ง ไม่ขยับทุก re-render)
  const [nowMs, setNowMs] = useState(() => Date.now());
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

  const loadFlow = async () => {
    setFlowLoading(true);
    try {
      setFlow(await fetchFlowSummary());
      setNowMs(Date.now());
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
  }, []);

  useEffect(() => {
    void loadHud(bu);
  }, [bu]);

  /**
   * เลขฝั่งใบขอ (เปิดกี่ใบ · AI คิดให้แล้วกี่ใบ) มาจาก flow-summary ที่หน้านี้โหลดอยู่แล้ว
   * — ยังไม่มา = ส่ง null ไป แล้วโต๊ะคัดสรรจะไม่โชว์ช่อง "ยังไม่มีคนแนะนำ" (ห้ามโชว์ 0
   * ที่แปลว่าคนละเรื่องกับ "ยังไม่รู้")
   */
  const officeDesks = React.useMemo(() => {
    if (!office) return null;
    return buildOfficeFloor(
      composeOfficeFloorRaw(office.counts, {
        jobsOpen: flow ? flow.jobs.open_total : null,
        jobsWithMatch: flow ? flow.jobs.with_recommend : 0,
      }),
    );
  }, [office, flow]);

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';

  return (
    <div className="relative -mx-4 sm:-mx-5 md:-mx-6 lg:-mx-8 px-4 sm:px-5 md:px-6 lg:px-8 py-6 md:py-8">
      {/* ทักทายสั้น ๆ บรรทัดเดียว — login ปุ๊บต้องเห็น "การไหลของงานสรรหา" ทันที */}
      <p className="mb-4 text-sm text-muted-foreground">
        {greeting} <span className="font-semibold text-foreground">{user?.full_name}</span> ·{' '}
        <BrandTitle className="font-medium" />
      </p>

      {/* ── KPI แถวบน + ตัวกรอง BU (Phase 10 · ตามภาพอ้างอิง 24 ส.ค. 2569) ──
          ตัวเลขทุกใบเป็น "เหตุการณ์วันนี้เทียบเมื่อวาน" ของจริง — ตัวที่เทียบไม่ได้
          จะไม่วาดลูกศรให้ (เหตุผลเต็มใน src/lib/homeKpi.ts)
          ⚠️ ซ่อนตัวเองเมื่อโหลดไม่ได้ เหมือนฉากห้องทำงาน */}
      {hud ? (
        <>
          <HomeBuFilter
            options={hud.bu_options}
            value={bu}
            onChange={setBu}
            className="mb-3"
          />
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
            className="mb-6"
          />
        </>
      ) : null}

      {/* ฉากห้องทำงาน (เจ้าของสั่ง 22 ส.ค. 2569) — วางไว้เหนือ funnel เพราะตอบคำถามแรก
          ที่คนเปิดระบบมาถาม: "วันนี้ต้องไปช่วยโต๊ะไหน" · funnel ด้านล่างตอบ "งานไหลไปถึงไหน"
          ⚠️ ฉากซ่อนตัวเองเมื่อโหลดไม่ได้ — ห้ามขึ้นกรอบเปล่าคาหน้าแรก */}
      {officeDesks ? (
        <OfficeRooms
          desks={officeDesks}
          generatedAt={office?.generated_at ?? null}
          loading={officeLoading}
          onRefresh={() => void loadOffice()}
          className="mb-8"
        />
      ) : null}

      {/* การไหลของงานสรรหา — งานเข้า → AI → โทร → จอง → ลงงาน (กดตัวเลขเพื่อไปหน้านั้น) */}
      {flowLoading && !flow ? (
        <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin text-blue-500" aria-hidden />
          กำลังโหลดภาพรวมการไหลของงาน…
        </p>
      ) : null}
      {!flowLoading && !flow ? (
        <div className="glass-card mb-8 rounded-2xl border border-white/70 p-5 text-sm text-muted-foreground">
          โหลดภาพรวมไม่สำเร็จ —{' '}
          <button type="button" onClick={() => void loadFlow()} className="font-medium text-blue-600 hover:underline">
            ลองใหม่
          </button>{' '}
          หรือเปิดเมนูจากปุ่ม ☰ มุมซ้ายบน
        </div>
      ) : null}
      {flow ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 space-y-3"
        >
          {/* Funnel อยู่ใน hero เข้มตาม mockup rev.3 ข้อ 01 — เข้าระบบมาเจอการไหลของงานก่อนทุกอย่าง
              เจ้าของสั่ง 10 ส.ค. 2569: แยก 2 บรรทัด — แถวบนคือเส้นที่ "มีคนแนะนำ" เดินต่อได้
              แถวล่างคือใบที่ AI ไม่พบคน ซึ่งไม่ได้เดินต่อในเส้นนี้ แต่โยงไป Content/Scraping
              (เดิมทั้งหมดอยู่แถวเดียว เส้นแยกเลยจมหาย อ่านผิดว่า Content ต่อจาก "จองตัว/ลงงาน") */}
          {/* ไม่ติดป้าย "เดือนนี้" ทั้งแถบ — ตัวเลขปนกันสองแบบ (ของค้างนับทั้งหมด ·
              การเคลื่อนไหวนับเดือนนี้) ป้ายรวมจะโกหกครึ่งนึงเสมอ ให้บรรทัดท้ายอธิบายแทน */}
          {/* ⚠️ แถบ "การไหลของงานสรรหา" (funnel 7 กล่อง) เคยอยู่ตรงนี้ —
              **เจ้าของสั่งถอดออก 24 ส.ค. 2569**: *"อยากให้มีแค่ 4 ห้องแต่มี Dashboard
              บอกครบทั้งระบบ"* · วัดจริงก่อนถอด: 4 ใน 7 กล่องซ้ำกับการ์ดห้องไปแล้ว
              (AI แนะนำคนแล้ว = ห้องคัดสรร · Content/Scraping = Online Room ·
              ผลจากการโทร = แผง "ผลโทรเดือนนี้")
              🔴 สองเลขที่ไม่ซ้ำใครถูกย้ายไปแล้ว ไม่ได้ทิ้ง:
              • "ใบขอเปิดอยู่ + ด่วนกี่ใบ" → การ์ดใบแรกของแถว KPI (`buildOpenRequestsCard`)
              • "ยังไม่มีคนแนะนำ" → แถวในการ์ดห้องคัดสรร (`fillRows` ของ officeRooms)
              dialog สองตัว (ผลจากการโทร · รายชื่อรอผล) ไม่กำพร้า — เปิดจากแผง Lumos ได้เหมือนเดิม */}

          {/* ⚠️ เคยมี <CallFunnelPanel defaultSource="all" /> ตรงนี้ — เจ้าของสั่งเอาออก 10 ส.ค. 2569
              funnel การโทรอยู่หน้า Follow (ล็อกของหน้านั้น) และหน้า Matching (กดสลับต้นทางได้) */}

          {/* ⚠️ แผงอนุมัติชุด (CallBatchPanel) เคยอยู่ตรงนี้ — เจ้าของสั่งเอาออก 10 ส.ค. 2569
              **ย้ายไปหน้า Matching ไม่ได้ลบ** เพราะชุดที่รออนุมัติต้องมีที่ให้กด
              ไม่งั้นจะค้างถาวร (ตอนนี้มีค้างจริงบนฐาน) · หน้า Matching คือที่ที่ชุดถูกสร้าง
              จึงเป็นที่ที่ตรงกับงานที่สุด */}
          {/* ⚠️ กล่อง "งานโทรของฉัน" (CallStatusPanel) เคยอยู่ตรงนี้ — เจ้าของสั่งเอาออก
              10 ส.ค. 2569 · ลบคอมโพเนนต์ทิ้งด้วย ไม่มีหน้าไหนใช้แล้ว
              งานโทรที่ตัวเองถืออยู่ยังเห็นได้ที่การ์ดผู้สมัครในหน้า Matching (CallHoldPanel) */}

          {/* ⚠️ กล่องติดตามท้ายหน้า ("สนใจงานแล้ว — รอคนกดจอง" · "ไม่รับสาย — ควรโทรซ้ำ" ·
              "ติดขัด — ต้องมีคนตัดสินใจ") เคยอยู่ตรงนี้ — เจ้าของสั่งเอาออก 12 ส.ค. 2569
              เพราะหลักการเดียวกับ "ผลจากการโทร": รายชื่อทั้งหมดย้ายเข้า dialog 4 กล่อง
              (กดที่ขั้น "ผลจากการโทร") · ใบด่วนค้าง → บรรทัดย่อยของ "ยังไม่มีคนแนะนำ" ·
              ค้างเกิน 2 วัน → ธงแดงใน dialog "ส่ง AI โทร" — ทุกตัวเลขมีที่ไป ไม่มีตัวไหนหาย */}

          {/* แผงผลโทรจาก AI (เจ้าของสั่ง 13 ส.ค. 2569: "ดูว่าเขาส่งผลลัพมาไหม ส่งไปกี่คน
              โทรไปกี่คน ผลเป็นยังไง") — วางใต้แถบการไหลของงานเพราะเป็นการซูมเข้าไปที่
              ขั้น "ส่ง AI โทร → ผลจากการโทร" ของแถบนั้น ไม่ใช่เรื่องใหม่คนละเรื่อง */}
          {/* ── สามแผงล่าง (Phase 10.2) — อัปเดตล่าสุด · ผลงานเด่นวันนี้ · ผลโทรเดือนนี้ ── */}
          {hud ? (
            <HomeDigestPanels
              deskToday={hud.desk_today}
              outcomesMonth={flow?.lumos.outcomes_month ?? null}
              className="mb-6"
            />
          ) : null}

          {/* ── ห้อง 4 · AI Call (ทีม Lumos) ──────────────────────────────────
              เจ้าของสั่ง 24 ส.ค. 2569: สองแผงเรื่องสาย *"เอาไว้กับทีม Lumos"*
              ⇒ จับเข้ากลุ่มเดียวกันใต้หัวข้อของห้อง AI Call (สีเดียวกับห้องในฉาก)
              ไม่ใช่แผงลอยท้ายหน้าที่ไม่รู้ว่าเป็นของทีมไหน */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full font-mono text-[11px] font-bold"
                style={{ background: HUD_HEX.danger, color: HUD_INK.hex }}
              >
                4
              </span>
              <span className={HUD.eyebrow} style={{ color: HUD_HEX.danger }}>
                ห้อง AI Call · ทีม Lumos
              </span>
              <span className={cn('flex-1 border-t', HUD.divider)} />
            </div>

            <LumosCallHealthPanel
              flow={flow}
              nowMs={nowMs}
              onOpenWaiting={() => setActiveCallsOpen(true)}
              onOpenResults={() => setCallResultsOpen(true)}
            />

          {/* "งาน Follow วันนี้" (เจ้าของสั่ง 14 ส.ค. 2569) — แทนที่ "โทรของฉัน" ที่ย้าย
              ไปหน้า Matching แล้ว · เห็นทันทีว่าวันนี้ส่งกี่คน + ผลราย 3 รอบ */}
            <FollowTodayPanel />
          </div>
        </motion.section>
      ) : null}
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
                  {personDetail.item.phone ? (
                    <a href={`tel:${personDetail.item.phone}`} className="jarvis-btn-secondary">
                      <Phone className="h-3 w-3" /> {personDetail.item.phone}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      const jobRef = personDetail.item.job_ref;
                      setPersonDetail(null);
                      navigate(`/matching/match?jobId=${encodeURIComponent(jobRef)}`);
                    }}
                    className="jarvis-btn-primary"
                  >
                    เปิดใบขอนี้ →
                  </button>
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
