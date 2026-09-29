import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useHomeV3 } from '@/lib/homeV3';
import { fetchCallRateSeries } from '@/lib/callFunnelApi';
import { bangkokTodayYmd, compareCallRate } from '@/lib/lumosCallRate';
import HomeSection from '@/components/home/HomeSection';
import { useAuth } from '@/contexts/AuthContext';
import { BrandTitle } from '@/components/shared/BrandMark';
import {
  fetchFlowSummary,
  confirmedThisMonth,
  callResultsThisMonth,
  callBoxCount,
  type FlowSummary,
} from '@/lib/flowSummaryApi';
import { buildCallDigest } from '@/lib/homeCallDigest';
import TeamBoardPanel from '@/components/home/TeamBoardPanel';
import { useHomeCallDialogs } from '@/components/home/useHomeCallDialogs';
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
/** ป๊อปผลโทร 3 ตัว (ผลจากการโทร · รอผล · รายละเอียดคน + จองตัว) ย้ายไป `useHomeCallDialogs` 29 ก.ย. 2569 — หน้าหลักโฉม 3 ก้อนใช้ตัวเดียวกัน */

const HomePageClassic: React.FC = () => {
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
   * เลขบนปุ่มสลับ BU — 🔴 **ต้องนับประชากรเดียวกับการ์ดที่มันกรอง**
   *
   * ของเดิมนับจากทะเบียนไซต์ทั้งก้อน (ปิด/ยกเลิกแล้วก็นับ) รวม 408 ใบ ขณะที่การ์ด
   * "ใบขอที่ยังเปิดรับ" นับเฉพาะใบที่ยังเปิด 287 ใบ ⇒ ปุ่มเขียน LBD 263 แล้วกดเข้าไป
   * เห็นเลขน้อยกว่านั้น คนอ่านสรุปทันทีว่า "เลขมั่ว" (บทเรียนเดิมของพจนานุกรมเมตริก:
   * เลขไม่ตรงข้ามจุดทำลายความเชื่อถือมากกว่าศัพท์ที่ไม่รู้จัก)
   *
   * ⚠️ ยังไม่มี flow-summary = ถอยไปใช้ของเดิมไปก่อน ดีกว่าไม่มีปุ่มให้กด
   */
  const buOptions = React.useMemo(() => {
    const open = flow?.jobs.open_by_bu;
    if (!open) return hud?.bu_options ?? [];
    return Object.entries(open)
      .map(([b, v]) => ({ bu: b, count: v.open_total }))
      .filter((o) => o.count > 0);
  }, [flow, hud]);

  /**
   * การ์ด "ใบขอที่ยังเปิดรับ" — เลือกชุดตัวเลขตาม BU ที่เลือกอยู่
   * ⚠️ BU ที่ยังไม่มีใบขอเปิดเลย = ทุกช่องเป็น 0 **ไม่ใช่ถอยไปใช้ยอดรวม**
   * (ถอยไปใช้ยอดรวมคือจอโกหกว่า BU นี้มีใบค้างอยู่ 287 ใบ)
   */
  const standingCard = React.useMemo(() => {
    if (!flow) return null;
    const j = flow.jobs;
    const slice = bu ? (j.open_by_bu?.[bu] ?? { open_total: 0, urgent: 0, sla_at_risk: 0, sla_breached: 0 }) : null;
    return slice
      ? buildOpenRequestsCard(slice.open_total, slice.urgent, {
          breached: slice.sla_breached,
          atRisk: slice.sla_at_risk,
        })
      : buildOpenRequestsCard(j.open_total, j.urgent, {
          breached: j.sla_breached ?? null,
          atRisk: j.sla_at_risk ?? null,
        });
  }, [flow, bu]);

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
        needsHuman: flow ? callBoxCount(flow, 'needs_human') : null,
        slaBreached: flow ? (flow.jobs.sla_breached ?? null) : null,
      }),
    [office, flow],
  );

  /**
   * สรุปผลโทรที่ต้องเห็นบนกล่องทีมเลย (เจ้าของสั่ง 7 ก.ย. 2569) — ประกอบจาก `flow`
   * ที่หน้านี้โหลดอยู่แล้ว **ไม่ยิงเส้นใหม่** และไม่มีนิยามเลขใหม่ (ดู lib/homeCallDigest)
   */
  const callDigest = React.useMemo(() => buildCallDigest(flow), [flow]);

  /** ป๊อปผลโทร + จองตัว — ตัวเดียวกับหน้าหลักโฉม 3 ก้อน (`useHomeCallDialogs`) */
  const callDialogs = useHomeCallDialogs({ flow, reloadFlow: () => void loadFlow() });

  /**
   * **Success Rate ตรง Lumos บนหน้าหลัก** (เจ้าของสั่ง 4 ก.ย. 2569)
   * 🔴 ใช้ทางเดียวกับแดชบอร์ดเป๊ะ — `fetchCallRateSeries` + `compareCallRate(series, 7)`
   * ถ้าคำนวณเองคนละสูตร สองหน้าจะโชว์ % ไม่ตรงกัน แล้วไม่มีใครเชื่อสักหน้า
   * ⚠️ โหลดพลาด = `null` ให้จอขึ้นขีด **ห้ามแปลงเป็น 0%**
   */
  const [successRate, setSuccessRate] = useState<{
    pct: number | null;
    connected: number;
    fromYmd: string;
    toYmd: string;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchCallRateSeries(60)
      .then((d) => {
        if (!alive || !d) return;
        const trend = compareCallRate(d.series, 7, bangkokTodayYmd());
        setSuccessRate({
          pct: trend.current.successRatePct,
          // 🔴 ฐานของ Success Rate = **สายที่ได้คุยจริง** ไม่ใช่ "คนที่รับสาย"
          // (15 ก.ย. 2569 — ต้องตรงกับตัวหารที่ใช้คำนวณจริง ไม่งั้นจอโชว์ฐานผิด)
          connected: trend.current.talked,
          // ช่วงจริงที่ % นี้นับ — จอเขียนกำกับ ไม่ใช่ให้คนเดาเองว่า "7 วันล่าสุด" คือวันไหน
          fromYmd: trend.current.fromYmd,
          toYmd: trend.current.toYmd,
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

      {/* 🔴 **เส้นแบ่ง "จบเรื่องหนึ่ง ขึ้นเรื่องใหม่"** (โฉมใหม่เท่านั้น · 7 ก.ย. 2569)
          audit งง-4: โฉมใหม่ทำให้ deck กับบอร์ดทีม **เป็นผืนขาวขอบบางเหมือนกันเป๊ะ**
          ห่างกันแค่ `space-y-5` ⇒ เลื่อนผ่านแล้วอ่านเป็นก้อนเดียว หาเส้นแบ่งไม่เจอ
          (ของเดิมสองก้อนเป็นพื้นเข้มก็จริง แต่แยกกันชัดกว่านี้)
          ⇒ ใส่หัวเรื่องกลุ่ม + เส้นบางคั่น: ข้างบน = **งานของฉัน** · ข้างล่าง = **ภาพรวมทั้งระบบ**
          ⚠️ ไม่มีข้อมูลเพิ่ม/ลด · ไม่มี CSS ใหม่ (utility ของ Tailwind + token ธีมล้วน) */}
      {uiV2 ? (
        <div className="flex items-center gap-3 pt-3">
          <h2 className="text-[12.5px] font-medium text-muted-foreground">
            ภาพรวมทั้งระบบ
          </h2>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>
      ) : null}

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
        onOpenCallResults={callDialogs.openCallResults}
        onOpenActiveCalls={callDialogs.openActiveCalls}
        successRate={successRate}
        /* 🔴 สรุปผลโทรบนกล่องทีม (เจ้าของสั่ง 7 ก.ย. 2569) — **โฉมใหม่เท่านั้น**
           v1 ได้ `null` ⇒ คอลัมน์ Lumos จบที่ปุ่มเดิมเป๊ะ ไม่ขยับ */
        callDigest={uiV2 ? callDigest : null}
        onOpenPerson={(it) => callDialogs.openPerson(it, 'good')}
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
              เทียบกับเมื่อวาน · การ์ด &ldquo;ใบขอที่ยังเปิดรับ&rdquo; ใบเดียวเป็นยอดสะสม ไม่ใช่ของวันนี้
              {/**
               * 🔴 **กรอง BU แล้วเลขหายไปไหน ต้องตอบได้** (เจ้าของถาม 15 ก.ย. 2569:
               * *"ทั้งหมดได้ 30 อยู่ LBD 20 แล้วที่เหลือไปไหน"*)
               * คำตอบคือรายการที่ยังไม่ระบุหน่วยงาน — ไม่ได้อยู่ BU ไหนเลย
               * ⇒ บอกจำนวนไปตรง ๆ ตอนกำลังกรองอยู่ ห้ามให้หายเงียบ
               */}
              {bu && hud?.no_bu && hud.no_bu.apptToday > 0 ? (
                <>
                  {' · '}
                  <span className="font-medium">
                    อีก {hud.no_bu.apptToday} รายยังไม่ระบุหน่วยงาน จึงไม่อยู่สายธุรกิจไหน
                  </span>
                </>
              ) : null}
            </>
          }
          action={
            <HomeBuFilter options={buOptions} value={bu} onChange={setBu} />
          }
        >
          <HomeKpiRow
            kpis={kpisWithRequests}
            /* ใบขอเปิดอยู่ + ด่วน + สถานะ SLA — ย้ายขึ้นมาจากแถบ funnel ที่ถอดออก
               (24 ส.ค. 2569) · ยังไม่มี flow-summary = ไม่ส่งการ์ดนี้ (ห้ามโชว์ 0 ที่ยังไม่รู้จริง) */
            /**
             * 🔴 **ต้องขยับตามปุ่มสลับ BU เหมือนการ์ดใบอื่น** (เจ้าของจับได้ 15 ก.ย. 2569:
             * *"มันก็ไม่เห็นเปลี่ยนตามเลย ค้าง LBD อยู่งั้นอะ"*)
             * ใบอื่นมาจาก `/api/home-kpis` ที่รับ BU อยู่แล้ว ส่วนใบนี้มาจาก flow-summary
             * ซึ่งเดิมส่งมาแต่ยอดรวม ⇒ กดสลับแล้วเห็นบางใบขยับ บางใบนิ่ง
             */
            standing={standingCard}
          />
        </HomeSection>
      ) : null}

      {/* ⚠️ ของที่เคยอยู่ตรงนี้ถูก **ยุบ** ตามคำสั่ง 26 ส.ค. 2569 (*"อันไหนข้อมูลเดียวกัน
          ก็ยุบ ๆ รวม ๆ ไป"*) — OpsRoomsPanel · funnel hero · HomeDigestPanels ·
          LumosCallHealthPanel · FollowTodayPanel — ที่ไปของแต่ละตัวเขียนไว้ที่
          คอมเมนต์เหนือหัวข้อ "ตัวเลขวันนี้" ข้างบน */}
      {/* เมนูหลักถูกถอดออก — ทุกโมดูลเข้าถึงได้จากปุ่ม ☰ (burger) ที่ header อยู่แล้ว */}

      {/* ป๊อปผลโทร 3 ตัว — `useHomeCallDialogs` (ไม่ซ้อน Dialog ใน Dialog) */}
      {callDialogs.dialogs}
    </div>
  );
};

/**
 * ═══ สวิตช์หน้าหลักโฉม 3 ก้อน (29 ก.ย. 2569 · ชั้นคู่ขนาน) ═══
 * `?home=v3` เปิด · `?home=classic` กลับหน้าเดิม · **ค่าตั้งต้น = หน้าเดิม (ด้านบน)** จนเจ้าของเคาะ — หน้าเดิมคือทางถอย
 * แผน: `docs/plan-home-v3-2569-09-29.md`
 */
const HomeV3Page = lazy(() => import('@/pages/HomeV3Page'));

const HomePage: React.FC = () => {
  const v3 = useHomeV3();
  if (!v3) return <HomePageClassic />;
  return (
    <Suspense fallback={null}>
      <HomeV3Page />
    </Suspense>
  );
};

export default HomePage;
