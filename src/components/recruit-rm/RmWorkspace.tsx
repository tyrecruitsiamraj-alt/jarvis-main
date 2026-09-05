import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import { getTotalPages, type PageSizeOption } from '@/lib/pagination';
import DateRangeCalendarPicker, { type DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import RmSearchBar from '@/components/recruit-rm/RmSearchBar';
import RmTable from '@/components/recruit-rm/RmTable';
import { MyCallsSection } from '@/pages/matching/MyCallsPage';
import AddApplicantDialog from '@/components/recruit-rm/AddApplicantDialog';
import ApplicantContactDialog from '@/components/recruit-rm/ApplicantContactDialog';
import {
  EMPTY_RM_FILTERS,
  RM_ROW_ACTION_LABEL,
  RM_TABS,
  RM_TAB_LABEL,
  filterApplications,
  isInRmTab,
  isInRmListView,
  isRmListView,
  RM_LIST_VIEWS,
  RM_LIST_VIEW_LABEL,
  type RmListView,
  rmTabHasLeadTools,
  type RmRowAction,
  type RmTab,
} from '@/lib/recruitRm';
import {
  chooseApplicationCall,
  fetchAllJobApplications,
  markApplicationDialed,
  recordAppointmentAttendance,
  setJobApplicationLead,
  type CallChoiceOutcome,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import { summarizeCallChoice } from '@/lib/callChoiceSummary';
import CallChoiceConfirmDialog from '@/components/recruit-rm/CallChoiceConfirmDialog';
import { ATTENDANCE_LABEL, type AttendanceResult } from '@/lib/appointmentAttendance';
import { buildAppointmentBoard } from '@/lib/appointmentBoard';
import { fetchRecruitRmOverview, type RecruitRmOverview } from '@/lib/recruitRmOverviewApi';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { RM_BUCKET_LABEL, isRmBucket } from '@/lib/recruitRmOverviewApi';
import {
  LEAD_VIEW_HINT,
  summarizeLeadUpdate,
  type LeadUpdateResult,
} from '@/lib/recruitLead';
import { fetchCallHoldsByPhones, type CallHold } from '@/lib/callHoldsApi';
import { canHoldApplication } from '@/lib/recruitRm';
import { choiceCountdown } from '@/lib/callChoiceGuard';
import { useAuth } from '@/contexts/AuthContext';

/**
 * พื้นที่ทำงาน "รายชื่อผู้สมัคร" — เนื้อของหน้างานสรรหา (RM) เดิมทั้งก้อน
 *
 * เจ้าของเคาะ 11 ส.ค. 2569 รอบหก: รวมหน้า RM เข้ากับบอร์ดรับสมัครเป็นแท็บสลับมุมมอง
 * ("แยกกล่องงาน แต่ยังดึงเก็บไปแบบหน้า RM ได้") — component นี้คือมุมมองฝั่ง list
 * ถูก mount โดย `StaffJobBoardPage` (ไม่ใช่ใน JobBoardView — กันโค้ด RM รั่วเข้า
 * bundle หน้าสมัครสาธารณะ) · หน้า `/recruit/rm` เดิมเหลือเป็น redirect เข้าบอร์ด
 *
 * ⚠️ ไม่มี RecruitFunnelPanel ในนี้ — บอร์ดมีแผงภาพรวมของตัวเองอยู่แล้ว (โชว์ทั้งสองมุมมอง)
 * ⚠️ แท็บอยู่ใน `?tab=` เหมือนเดิม และต้อง **คง query param อื่นไว้** (`?view=` ของบอร์ด)
 *    — สร้าง URLSearchParams จากของเดิมเสมอ ห้ามเขียนทับทั้งก้อน
 *
 * ═══ ของที่ยังไม่ได้ต่อ (ขึ้นข้อความบอกตรง ๆ ไม่ปล่อยกดแล้วเงียบ) ═══
 * TODO(api) ระบบ Lead (เก็บ/ลบ Lead) — ยังไม่มีตารางฝั่งเรา
 * TODO(api) ปุ่ม "ช่องทาง"/"สร้างลิงก์" บนแถบนี้ — ของจริงอยู่ที่แถบบอร์ด (มุมมองกล่องงาน)
 */

const PAGE_SIZE_DEFAULT: PageSizeOption = 20;

/** แถวที่โชว์ในแถบ "เลือกวิธีโทร" ก่อนยุบ — เกินนี้ใช้ปุ่มทั้งหมด/กล่องบนแดชบอร์ด */
const AWAITING_ROWS_SHOWN = 5;

function isRmTab(v: string | null): v is RmTab {
  return !!v && (RM_TABS as readonly string[]).includes(v);
}

const RmWorkspace: React.FC<{
  /**
   * แท็บที่ถูกคุมจากข้างนอก (เจ้าของสั่ง 13 ส.ค. 2569: "การติดต่อ"/"ติดตามนัดหมาย"
   * เป็นแท็บระดับบอร์ดแล้ว) — ส่งมา = ล็อกแท็บนั้นและซ่อนแถบแท็บย่อยข้างใน
   * ไม่ส่ง = พฤติกรรมเดิม (อ่านจาก ?tab= · มีแถบแท็บของตัวเอง)
   */
  tab?: RmTab;
}> = ({ tab: controlledTab }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: RmTab = controlledTab ?? (isRmTab(tabParam) ? tabParam : 'candidates');
  /**
   * มุมมองย่อยของแท็บ "รายชื่อผู้สมัคร" (เจ้าของสั่ง 13 ส.ค. 2569 ให้แบ่ง 3 อัน)
   * เก็บใน `?list=` เพื่อให้ refresh/แชร์ลิงก์แล้วยังอยู่มุมมองเดิม — แพตเทิร์นเดียวกับ ?tab=
   */
  const listParam = searchParams.get('list');
  const listView: RmListView = isRmListView(listParam) ? listParam : 'all';

  const [rows, setRows] = useState<PublicApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(PAGE_SIZE_DEFAULT);
  /** ข้อความบอกว่ายังไม่ได้ต่อของจริง — ดีกว่าปุ่มที่กดแล้วเงียบ */
  const [notice, setNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  /** dialog รายละเอียด+บันทึกผลติดต่อ (ลิสต์ข้อ 7) — เปิดจากปุ่ม "ดูรายละเอียด"/"บันทึกผลนัดหมาย" */
  const [contactApp, setContactApp] = useState<PublicApplication | null>(null);
  const { user } = useAuth();
  /** ล็อกโทรของแถวในหน้า (คีย์ = application id) — โชว์ 🔒 + กันกดซ้ำ */
  const [holdByRef, setHoldByRef] = useState<Record<string, CallHold>>({});
  const [holdingSelected, setHoldingSelected] = useState(false);
  /**
   * มุมมอง "คลังสำรอง (Lead)" — ใบที่ถูกปัดออกจากรายชื่อทำงาน
   * เก็บใน `?lead=1` เพื่อให้ refresh/แชร์ลิงก์แล้วยังอยู่มุมมองเดิม (แพตเทิร์นเดียวกับ ?tab=)
   * ⚠️ การกรองอยู่ฝั่ง server — ลิสต์ปกติไม่เคยมีแถว Lead ติดมาให้ต้องกรองซ้ำ
   */
  const leadView = searchParams.get('lead') === '1';
  const [leadBusy, setLeadBusy] = useState(false);

  /**
   * drill-down จากกล่อง Dashboard (`?bucket=` — S6) · เงื่อนไขกรองอยู่ฝั่ง server
   * (นิยามเดียวกับตัวนับบนกล่อง — เลขบนกล่องจึงเท่ากับแถวที่เห็นเสมอ)
   * โหมดนี้ **ข้ามตัวแบ่งแท็บ** — ถังหนึ่งมีได้ทั้ง Lead/claim/แถวปกติ ถ้าปล่อยให้
   * isInRmTab หั่นต่อ เลขจะไม่ตรงกล่องแล้วเหมือนของหาย
   */
  const bucket = isRmBucket(searchParams.get('bucket')) ? searchParams.get('bucket') : null;
  const clearBucket = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('bucket');
    // 🔴 **push ไม่ใช่ replace** (5 ก.ย. 2569) — นี่คือ "คนกดเปลี่ยนมุมมองเอง"
    // ถ้า replace ประวัติจะถูกทับ ⇒ กดย้อนกลับแล้ว **หลุดออกจากหน้านี้ไปเลย**
    // (เจ้าของทดสอบเจอเอง: อยู่กล่องงาน → กดแท็บรายชื่อผู้สมัคร → ย้อนกลับ → เด้งไปหน้าแรก)
    setSearchParams(params);
    setSelectedIds([]);
    setPage(1);
  };

  const load = () => {
    setLoading(true);
    setLoadError(null);
    fetchAllJobApplications(leadView, bucket)
      .then(setRows)
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'โหลดรายชื่อผู้สมัครไม่สำเร็จ'))
      .finally(() => setLoading(false));
  };
  useEffect(load, [leadView, bucket]);

  /** สลับมุมมอง — ต้องคง query param อื่นไว้ (`?view=` ของบอร์ด · `?tab=` · `?list=`) */
  const setLeadView = (on: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (on) next.set('lead', '1');
    else next.delete('lead');
    setSearchParams(next);
    setSelectedIds([]);
    setPage(1);
    setNotice(null);
  };

  /**
   * เก็บ/ลบ Lead เป็นชุด — ยิงทีละใบแล้วสรุปผลรวม (ไม่มี endpoint bulk)
   * ⚠️ ล้มบางใบต้องรายงาน ไม่ใช่กลืน (summarizeLeadUpdate มีเทสต์คุม)
   */
  const applyLead = async (lead: boolean) => {
    if (selectedIds.length === 0 || leadBusy) return;
    setLeadBusy(true);
    setNotice(null);
    const results: LeadUpdateResult[] = await Promise.all(
      selectedIds.map((id) =>
        setJobApplicationLead(id, lead)
          .then((): LeadUpdateResult => ({ ok: true }))
          .catch(
            (e): LeadUpdateResult => ({
              ok: false,
              message: e instanceof Error ? e.message : 'ไม่ทราบสาเหตุ',
            }),
          ),
      ),
    );
    setNotice(summarizeLeadUpdate(results, lead).message);
    setSelectedIds([]);
    setLeadBusy(false);
    load();
  };

  /**
   * บันทึกผลติดตามนัด มา/ไม่มา (แท็บนัดหมาย · migration 089) — append-only ล่าสุดชนะ
   * server เป็นด่านตัดสิน (ก่อนวันนัด = 400) · เสร็จแล้ว reload ให้ชิปบนแถวอัปเดต
   */
  const onAttendance = (row: PublicApplication, result: AttendanceResult) => {
    if (!row.appointment_at) return;
    setNotice(null);
    void recordAppointmentAttendance({
      applicationId: row.id,
      appointmentAt: row.appointment_at,
      result,
    })
      .then(() => {
        setNotice(`บันทึกผลนัดของ ${row.full_name}: ${ATTENDANCE_LABEL[result]} แล้ว`);
        load();
      })
      .catch((e) => setNotice(e instanceof Error ? e.message : 'บันทึกผลนัดไม่สำเร็จ'));
  };

  /**
   * ตัวกรองวันที่สมัคร (เจ้าของสั่ง 22 ส.ค. 2569: *"หน้าผู้สมัครขอเป็นแบบ filter แบบ
   * calendar ที่กดแล้วข้อมูลเปลี่ยนตามวันที่เลือก"*)
   *
   * ⚠️ ไม่ผูกกับ URL — ต่างจากแท็บ/มุมมอง/bucket ที่คนแชร์ลิงก์กันจริง
   * ช่วงวันเป็นของ "คนที่กำลังนั่งดู" ไม่ใช่ของลิงก์ (และ bucket drill-down
   * มีความหมายของช่วงเวลาอยู่ในตัวแล้ว)
   */
  const [dateRange, setDateRange] = useState<DateRangeYmd | null>(null);
  /** เปลี่ยนช่วงวัน = กลับหน้า 1 + ล้างที่ติ๊กไว้ (ของที่ติ๊กอาจหลุดออกจากชุดที่เห็นแล้ว) */
  const changeDateRange = (next: DateRangeYmd | null) => {
    setDateRange(next);
    setPage(1);
    setSelectedIds([]);
  };

  /** จำนวนต่อแท็บ — นิยามเดียวกับตัวกรอง (isInRmTab) เลขบนแท็บจึงตรงกับที่เห็นเสมอ */
  const tabCounts = useMemo(() => {
    const out = {} as Record<RmTab, number>;
    for (const t of RM_TABS) out[t] = rows.filter((r) => isInRmTab(r, t)).length;
    return out;
  }, [rows]);

  /** ตัวกรองที่หน้านี้ใช้จริง — สามกลุ่มเดิมไม่มี UI แล้ว (ถอด 17 ส.ค. 2569) เหลือช่วงวันที่ */
  const rmFilters = useMemo(
    () => ({ ...EMPTY_RM_FILTERS, dateFrom: dateRange?.from ?? null, dateTo: dateRange?.to ?? null }),
    [dateRange],
  );

  const filtered = useMemo(() => {
    // โหมด drill-down: server กรองด้วยนิยามเดียวกับกล่องแล้ว — แสดงตามนั้นตรง ๆ
    // (หั่นต่อด้วยแท็บ/ตัวกรอง = เลขไม่ตรงกล่อง)
    if (bucket) return rows;
    const base = filterApplications(rows, tab, rmFilters, keyword);
    // มุมมองย่อยใช้เฉพาะแท็บรายชื่อผู้สมัคร — แท็บอื่นมีความหมายของตัวเองอยู่แล้ว
    if (tab !== 'candidates') return base;
    return base.filter((r) => isInRmListView(r, listView));
  }, [rows, tab, keyword, listView, bucket, rmFilters]);

  /** บอร์ดสรุปนัดต่อวัน (ข้อ 12 · 20 ส.ค. 2569) — คิดจากชุดเดียวกับตาราง เลขจึงตรงกันเสมอ */
  const appointmentBoard = useMemo(() => buildAppointmentBoard(filtered), [filtered]);

  /**
   * ใบที่รออยู่ในกอง "เลือกวิธีโทร" (Phase 5.9) — คิดจาก **ชุดที่โหลดมาทั้งก้อน** ไม่ใช่
   * `filtered` เพราะแถบนี้เป็น "งานที่ต้องลงมือ" ระดับหน้า ไม่ใช่ผลของตัวกรอง/คำค้น
   * (กรองอยู่แล้วเห็นเลขน้อยลง = คนคิดว่างานหมดแล้ว)
   * ⚠️ ต้องเช็ค `!r.claimed` ด้วย — มีคนกดเก็บใหม่ระหว่างรอ = ไม่ต้องเลือกอีก
   */
  const awaitingChoiceRows = useMemo(
    () => rows.filter((r) => r.unclaimed_at && !r.call_choice && !r.claimed),
    [rows],
  );
  /** หมุดเวลาเดียวต่อการ render — ทุกป้ายนับถอยหลังจึงนับจากจุดเดียวกัน
   *  (แพตเทิร์นเดียวกับ RmTable ที่จับเวลาครั้งเดียวต่อ render ไม่ต้อง memo) */
  const now = new Date();

  /**
   * ก้อน "นัด → มาไหม" ที่ย้ายมาจากศูนย์คุมงานสรรหา (เจ้าของสั่ง 20 ส.ค. 2569 —
   * เคาะ Choice: "แค่ย้ายก้อนนั้นไป อันอื่น ๆ เก็บไว้") · ยอด**ทั้งระบบ**จาก API เดิม
   * ตัวเดียวกับศูนย์คุม (`/api/recruit-rm-overview`) — บอร์ดข้างล่างนับจากรายการ
   * ในหน้านี้ (ผ่านตัวกรอง) สองชุดจึงใกล้กันแต่ไม่จำเป็นต้องเท่ากัน มีป้ายบอกแหล่งกำกับ
   * · โหลดล้ม = ไม่แสดงแถว (ข้อมูลเสริม ห้ามทำหน้าหลักพัง)
   */
  const [rmOverview, setRmOverview] = useState<RecruitRmOverview | null>(null);
  useEffect(() => {
    if (tab !== 'appointments') return;
    let cancelled = false;
    fetchRecruitRmOverview()
      .then((d) => {
        if (!cancelled) setRmOverview(d);
      })
      .catch(() => {
        if (!cancelled) setRmOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tab]);

  /** เลขบนปุ่มมุมมองย่อย — นับหลังตัวกรอง/คำค้นเดียวกัน เลขจึงตรงกับที่เห็นเสมอ */
  const listViewCounts = useMemo(() => {
    const base = filterApplications(rows, 'candidates', rmFilters, keyword);
    const out = {} as Record<RmListView, number>;
    for (const v of RM_LIST_VIEWS) out[v] = base.filter((r) => isInRmListView(r, v)).length;
    return out;
  }, [rows, keyword, rmFilters]);

  const setListView = (next: RmListView) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'all') params.delete('list');
    else params.set('list', next);
    setSearchParams(params);
    setSelectedIds([]);
    setPage(1);
  };

  const totalPages = getTotalPages(filtered.length, pageSize);
  const currentPage = Math.min(page, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  /**
   * โหลดสถานะล็อกของแถวในหน้านี้ — server จับคู่ด้วยเบอร์ E.164 แล้วคืน map คีย์ ref
   * อ่านไม่ได้ = ทุกแถวดูเป็น "ว่าง" ซึ่งยังปลอดภัย เพราะ server เป็นคนตัดสินตอนกดจริง
   */
  useEffect(() => {
    if (pageRows.length === 0) return;
    let cancelled = false;
    void fetchCallHoldsByPhones(pageRows.map((r) => r.phone)).then((map) => {
      if (cancelled) return;
      setHoldByRef((prev) => {
        // เขียนสถานะของ "แถวในหน้านี้" ใหม่ทั้งก้อน — มีล็อก = ตั้ง · ไม่มี = ลบคีย์ออก
        // ⚠️ ห้าม merge ทางเดียว: เดิมพอคืน/หมดอายุล็อก แถวยังโชว์ 📞 + ปุ่มโทร disabled
        // ค้างจนกว่าจะ reload ทั้งหน้า (กด "รีเฟรช" ก็ไม่ช่วยเพราะ load() ไม่แตะ holdByRef)
        // · map คีย์ด้วย candidateRef ของล็อก (= application id) → map.get(row.id)
        const next = { ...prev };
        for (const row of pageRows) {
          const hold = map.get(row.id);
          if (hold) next[row.id] = hold;
          else delete next[row.id];
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [pageRows]);

  const setTab = (next: RmTab) => {
    // ⚠️ ต่อยอดจาก params เดิมเสมอ — ?view= ของบอร์ดต้องรอด ไม่งั้นสลับแท็บแล้วเด้งกลับกล่องงาน
    const params = new URLSearchParams(searchParams);
    params.set('tab', next);
    setSearchParams(params);
    // ล้างที่ติ๊กไว้ตอนสลับแท็บ — ปุ่ม action คนละชุด ติ๊กค้างข้ามแท็บแล้วสับสน
    setSelectedIds([]);
    setNotice(null);
    setPage(1);
  };

  /** ปุ่มแถวที่ยังไม่ต่อของจริง — ขึ้นข้อความ ดีกว่ากดแล้วเงียบ */
  const todo = (what: string) => setNotice(`${what} — ยังไม่ได้ต่อกับระบบจริง`);

  /**
   * "เก็บไปโทรเอง" — ปุ่มเดียวที่รวม claim + ล็อกเบอร์ (เจ้าของเคาะ 22 ส.ค. 2569)
   *
   * 🔴 ยิงเส้นเดียว `/api/application-call-choice` ให้ **server ทำทั้งสองอย่างในคำสั่งเดียว**
   * ห้ามให้หน้าเว็บยิงสองเส้นเอง: เดิมทำแบบนั้นแล้วมีสภาพครึ่ง ๆ (จองใบได้แต่เบอร์ไม่ถูกล็อก
   * = AI โทรทับ) โดยที่คนกดไม่รู้ · ตอนนี้ server รายงาน skipped กลับมาให้อ่านได้ทุกใบ
   */
  const keepForSelf = async (ids: string[]) => {
    if (ids.length === 0) return;
    setNotice(null);
    try {
      const outcome = await chooseApplicationCall(ids, 'manual');
      setNotice(`${summarizeCallChoice(outcome)} — ไปโทร+บันทึกผลที่แท็บ "การโทรของฉัน"`);
      load(); // ใบย้ายแท็บ (claimed_by_me) + ป้ายล็อกเปลี่ยน ต้องเห็นทันที
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'เก็บไปโทรเองไม่สำเร็จ');
    }
  };

  /**
   * "ส่ง AI โทร" — ยิงสายจริง จึงต้องผ่าน popup ยืนยันรายชื่อทุกครั้ง (กติกาเจ้าของ)
   * เก็บ id ที่รอยืนยันไว้ก่อน แล้วยิงตอนกดยืนยันในป๊อป
   */
  const [aiConfirmIds, setAiConfirmIds] = useState<string[] | null>(null);
  const [aiSending, setAiSending] = useState(false);
  const askSendAi = (ids: string[]) => {
    if (ids.length === 0) return;
    setNotice(null);
    setAiConfirmIds(ids);
  };
  const confirmSendAi = async () => {
    if (!aiConfirmIds || aiSending) return;
    setAiSending(true);
    try {
      const outcome: CallChoiceOutcome = await chooseApplicationCall(aiConfirmIds, 'ai');
      setNotice(summarizeCallChoice(outcome));
      setAiConfirmIds(null);
      setSelectedIds([]);
      load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'ส่ง AI โทรไม่สำเร็จ');
      setAiConfirmIds(null);
    } finally {
      setAiSending(false);
    }
  };
  /** ชื่อของ id ที่รอยืนยัน — ป๊อปต้องโชว์ชื่อจริง ไม่ใช่แค่จำนวน */
  const aiConfirmNames = useMemo(
    () =>
      (aiConfirmIds ?? [])
        .map((id) => rows.find((r) => r.id === id)?.full_name)
        .filter((n): n is string => Boolean(n)),
    [aiConfirmIds, rows],
  );

  const onRowAction = (action: RmRowAction, row: PublicApplication) => {
    if (action === 'call') {
      // ปุ่มถูก disable ไว้แล้วถ้าจับไม่ได้ — เช็คซ้ำกันหลุดจาก keyboard/สคริปต์
      if (!canHoldApplication(row).ok || holdByRef[row.id]) return;
      void keepForSelf([row.id]);
      return;
    }
    /**
     * "กดโทร" — จดเวลาที่ยกหูโทรออก (095 · เจ้าของสั่ง 17 ส.ค. 2569 ข้อ 5)
     * อัปเดตแถวในหน้าเลยไม่ต้อง reload ทั้งลิสต์ (คนกดรัว ๆ ทีละหลายคน)
     * ⚠️ ล้มแล้วต้องบอก — ถ้าเงียบ คนจะคิดว่าจดแล้วทั้งที่ไม่ได้จด
     */
    if (action === 'dial') {
      setNotice(null);
      void markApplicationDialed(row.id)
        .then((r) => {
          setRows((prev) =>
            prev.map((x) =>
              x.id === row.id
                ? {
                    ...x,
                    dialed_first_at: r.dialed_first_at ?? undefined,
                    dialed_last_at: r.dialed_last_at ?? undefined,
                    dial_count: r.dial_count,
                  }
                : x,
            ),
          );
          setNotice(`จดเวลาโทรของ ${row.full_name} แล้ว`);
        })
        .catch((e: unknown) => {
          setNotice(e instanceof Error ? e.message : 'จดเวลาโทรไม่สำเร็จ');
        });
      return;
    }
    // ดูรายละเอียด/บันทึกผล → dialog ติดต่อสำเร็จ-ไม่สำเร็จ (ลิสต์ข้อ 7 · 14 ส.ค. 2569)
    if (action === 'view' || action === 'rule') {
      setContactApp(row);
      return;
    }
    todo(`"${RM_ROW_ACTION_LABEL[action]}" ของ ${row.full_name}`);
  };

  /** "เก็บไปโทรเอง" จากแถวที่ติ๊ก — ทำงานได้ทุกแท็บ (ปุ่มรวมของเจ้าของ 22 ส.ค. 2569) */
  const keepSelectedForSelf = async () => {
    if (selectedIds.length === 0 || holdingSelected) return;
    setHoldingSelected(true);
    try {
      await keepForSelf(pageRows.filter((r) => selectedIds.includes(r.id)).map((r) => r.id));
      setSelectedIds([]);
    } finally {
      setHoldingSelected(false);
    }
  };

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAll = () =>
    setSelectedIds((prev) =>
      pageRows.every((r) => prev.includes(r.id))
        ? prev.filter((id) => !pageRows.some((r) => r.id === id))
        : [...new Set([...prev, ...pageRows.map((r) => r.id)])],
    );

  return (
    <div>
      {/* แถบแท็บย่อย — โผล่เฉพาะโหมดไม่ถูกคุมจากข้างนอก (ตอนนี้บอร์ดคุมด้วย ?view= แล้ว
          แถบนี้จึงไม่ขึ้นบนบอร์ด — คงไว้เผื่อ RmWorkspace ถูกใช้เดี่ยว ๆ ที่อื่น) */}
      {/* ⚠️ ป้าย "ข้อมูลผู้สมัคร · N รายการ" ถูกเอาออก (เจ้าของสั่ง 14 ส.ค. 2569) —
          ซ้ำกับ tab bar ระดับบอร์ดที่มีชื่อแท็บ+จำนวนอยู่แล้ว · เหลือแค่ปุ่มรีเฟรช */}
      {controlledTab ? (
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={load} disabled={loading} >
            <RefreshCw className={cn(loading && 'animate-spin')} aria-hidden /> รีเฟรช
          </Button>
        </div>
      ) : (
        <div className={cn('flex flex-wrap items-center gap-1 border-b', DASH.divider)}>
          {RM_TABS.map((t) => {
            const active = t === tab;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative px-4 py-2.5 text-sm font-semibold transition-colors',
                  active
                    ? cn(TONE.primary.value, 'border-b-2 border-current')
                    : cn(DASH.muted, 'border-b-2 border-transparent hover:text-foreground'),
                )}
              >
                {RM_TAB_LABEL[t]}
                <span className={cn('ml-1.5 font-mono text-[11px] tabular-nums', active ? '' : DASH.muted)}>
                  {loading ? '…' : tabCounts[t].toLocaleString('th-TH')}
                </span>
              </button>
            );
          })}
          <Button variant="secondary" size="sm"
            type="button"
            onClick={load}
            disabled={loading}
            className="ml-auto"
          >
            <RefreshCw className={cn(loading && 'animate-spin')} aria-hidden /> รีเฟรช
          </Button>
        </div>
      )}

      {/* แท็บย่อย 3 อันของ "รายชื่อผู้สมัคร" (เจ้าของสั่ง 13 ส.ค. 2569)
          แบ่งด้วย **ผลโทร** ไม่ใช่สถานะใบสมัคร · เห็นครบทั้ง 3 เสมอแม้ยอดเป็น 0
          (0 คือคำตอบ ไม่ใช่ช่องว่าง) · โผล่เฉพาะแท็บนี้ — แท็บอื่นมีความหมายของตัวเอง */}
      {tab === 'candidates' ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {RM_LIST_VIEWS.map((v) => {
            const active = v === listView;
            return (
              <button
                key={v}
                type="button"
                onClick={() => setListView(v)}
                aria-pressed={active}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : cn('bg-muted hover:bg-muted/70', DASH.muted),
                )}
              >
                {RM_LIST_VIEW_LABEL[v]}
                <span className="ml-1.5 font-mono text-[11px] tabular-nums">
                  {loading ? '…' : listViewCounts[v].toLocaleString('th-TH')}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* แผงตัวกรองด้านข้าง (ช่องทางสมัคร/จังหวัด/สถานะใบสมัคร) ถูกถอดออกทั้งหมด
          (เจ้าของสั่ง 17 ส.ค. 2569: "เอาออกจากทุกหน้าไปเลย") — คัดรายชื่อใช้
          แท็บ + มุมมองย่อย + ช่องค้นหาที่มีอยู่แล้ว
          🔴 ห้ามเอาสามกลุ่มนั้นกลับมาโดยไม่ได้สั่งใหม่ */}

      {/* ตัวกรองวันที่สมัคร (เจ้าของสั่ง 22 ส.ค. 2569) — ใช้ปฏิทินตัวเดียวกับหน้า Dashboard
          ⚠️ ไม่โผล่ในโหมด drill-down (?bucket=) เพราะ server กรองมาแล้ว
          ถ้าให้กรองซ้ำที่นี่ เลขจะไม่ตรงกับกล่องที่กดมา */}
      {!bucket ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={cn('text-xs font-medium', DASH.label)}>วันที่สมัคร</span>
          <DateRangeCalendarPicker value={dateRange} onChange={changeDateRange} />
          {dateRange ? (
            <span className={cn('text-xs', DASH.sub)}>
              กรองแล้ว — เหลือ {filtered.length.toLocaleString('th-TH')} รายชื่อ
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4">
        <div className="min-w-0 flex-1 space-y-3">
          {/* ⚠️ RmToolbar (ช่องทาง/สร้างลิงก์/เหตุผล) ถูกเอาออก (เจ้าของสั่ง 14 ส.ค. 2569:
              "กล่องช่องทาง ฯลฯ มีแค่หน้ากล่องงาน") — เครื่องมือพวกนี้เหลือที่ RecruitBoardTools
              บนกล่องงาน (view=board) เท่านั้น · เหลือแค่ค้นหา + เพิ่มผู้สมัคร + Lead */}
          <div className={cn('rounded-2xl border p-3', DASH.card)}>
            <RmSearchBar
              keyword={keyword}
              onKeywordChange={(v) => {
                setKeyword(v);
                setPage(1);
              }}
              onSearch={() => setPage(1)}
              showLeadTools={rmTabHasLeadTools(tab)}
              selectedCount={selectedIds.length}
              onSaveLead={() => void applyLead(true)}
              onDeleteLead={() => void applyLead(false)}
              leadBusy={leadBusy}
              leadView={leadView}
              onAddApplicant={() => setAddOpen(true)}
              onHoldSelected={() => void keepSelectedForSelf()}
              holdingSelected={holdingSelected}
              onSendAiSelected={() => askSendAi(selectedIds)}
            />
          </div>

          {notice ? (
            <p className={cn('rounded-xl border px-3 py-2 text-[12px]', TONE.warn.soft, TONE.warn.value)}>
              {notice}
            </p>
          ) : null}

          {/* อยู่คลังสำรองต้องบอกให้รู้ตัว ไม่งั้นอ่านว่า "รายชื่อหายไปไหนหมด" */}
          {leadView ? (
            <p className={cn('rounded-xl border px-3 py-2 text-[11px]', TONE.violet.soft, TONE.violet.value)}>
              {LEAD_VIEW_HINT}
            </p>
          ) : null}

          {tab === 'appointments' ? (
            <div className="space-y-2 rm-appointments-head">
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* เจ้าของนิยาม 14 ส.ค. 2569: "ติดตามการนัดหมายเป็นแค่หน้าเอาไว้ดูว่านัดที่ไหน
                    วันไหน และกี่คน โหลดเป็น PDF ได้" — สรุปหัว + ปุ่มพิมพ์ (window.print
                    ฝั่งเบราว์เซอร์ — เจ้าของเคาะ ไม่เพิ่ม lib) · print CSS ซ่อนส่วนอื่นของหน้า */}
                <p className={cn('rounded-xl border px-3 py-2 text-[11px]', TONE.info.soft, TONE.info.value)}>
                  นัดสัมภาษณ์ <b>{filtered.filter((r) => r.appointment_at).length.toLocaleString('th-TH')}</b> คน
                  จากทั้งหมด {filtered.length.toLocaleString('th-TH')} คนที่รับเข้าทำงาน ·
                  วันนัดมาจากผลโทร "สนใจ→นัดได้" หรือบันทึกผลติดต่อ "สำเร็จ→นัดได้"
                </p>
                <Button variant="secondary" size="sm" type="button" onClick={() => window.print()} className="shrink-0">
                  🖨 โหลดเป็น PDF
                </Button>
              </div>

              {/* ก้อน "นัด → มาไหม" ที่ย้ายมาจากศูนย์คุมงานสรรหา (20 ส.ค. 2569) —
                  ยอดทั้งระบบจากฐานของเรา · ต่างจากบอร์ดข้างล่างที่นับจากรายการในหน้า */}
              {rmOverview ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    นัด → มาไหม (ยอดทั้งระบบ · ย้ายมาจากศูนย์คุมงานสรรหา)
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        ['สำเร็จ · นัดได้', rmOverview.appointment.scheduled, 'success', null],
                        ['สำเร็จ · ยังนัดไม่ได้', rmOverview.appointment.successNoAppointment, 'warn', null],
                        [
                          'นัดแล้ว · มา',
                          rmOverview.attendance ? rmOverview.attendance.showed : null,
                          'success',
                          rmOverview.attendance
                            ? rmOverview.attendance.overdueNoResult > 0
                              ? null // เลขนี้แยกไปเป็นกล่องกดได้ข้างล่าง (Phase 7.6)
                              : `นัดข้างหน้า ${rmOverview.attendance.upcoming}`
                            : null,
                        ],
                        [
                          'นัดแล้ว · ไม่มา',
                          rmOverview.attendance ? rmOverview.attendance.noShow : null,
                          'danger',
                          null,
                        ],
                      ] as const
                    ).map(([label, n, toneKey, sub]) => (
                      <div key={label} className={cn('rounded-xl border px-3 py-2', TONE[toneKey].soft)}>
                        <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
                        <p className={cn('text-xl font-bold tabular-nums', TONE[toneKey].num)}>
                          {n == null ? '—' : n.toLocaleString('th-TH')}
                        </p>
                        {sub ? <p className="text-[10px] text-muted-foreground">{sub}</p> : null}
                      </div>
                    ))}
                  </div>
                  {/* Phase 7.6 — เลข "เลยนัดยังไม่บันทึกผล" เดิมเป็นข้อความเฉย ๆ กดไม่ได้
                      ตอนนี้เป็นกล่องกดแล้วลงไปเห็นรายชื่อจริง (ถัง `overdue_no_result`
                      นิยามเดียวกับตัวนับ — เทสต์ bucket-parity คุมอยู่) */}
                  {rmOverview.attendance && rmOverview.attendance.overdueNoResult > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams(searchParams);
                        params.set('bucket', 'overdue_no_result');
                        setSearchParams(params);
                        setSelectedIds([]);
                        setPage(1);
                      }}
                      className={cn(
                        'w-full rounded-xl border px-3 py-2 text-left text-xs',
                        TONE.danger.soft,
                        TONE.danger.softHover,
                      )}
                    >
                      <span className={cn('font-semibold', TONE.danger.value)}>
                        เลยวันนัดแล้วยังไม่บันทึกผล {rmOverview.attendance.overdueNoResult} ใบ
                      </span>
                      <span className={cn('ml-1', DASH.muted)}>— กดเพื่อดูรายชื่อและบันทึก มา/ไม่มา</span>
                    </button>
                  ) : null}
                </div>
              ) : null}

              {/* บอร์ดสรุปนัด (เจ้าของสั่ง 20 ส.ค. 2569 ข้อ 12: *"มีบอร์ดแสดงว่านัดทั้งหมด
                  เท่าไหร่ มาเท่าไหร่ ไม่มาเท่าไหร่"* + รายวัน) — ตรรกะที่ appointmentBoard.ts
                  · สีจาก TONE ที่เดียว · "รอผล" ต้องเห็นเป็นเลข ไม่ใช่หาย */}
              {appointmentBoard.total.total > 0 ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(
                      [
                        ['นัดทั้งหมด', appointmentBoard.total.total, 'info'],
                        ['มา', appointmentBoard.total.showed, 'success'],
                        ['ไม่มา', appointmentBoard.total.noShow, 'danger'],
                        ['รอผล / เลื่อนนัด', appointmentBoard.total.pending + appointmentBoard.total.rescheduled, 'warn'],
                      ] as const
                    ).map(([label, n, toneKey]) => (
                      <div key={label} className={cn('rounded-xl border px-3 py-2', TONE[toneKey].soft)}>
                        <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
                        <p className={cn('text-xl font-bold tabular-nums', TONE[toneKey].num)}>
                          {n.toLocaleString('th-TH')}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-border/70">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className={cn('text-left', DASH.tableHead)}>
                          <th className="px-3 py-2 font-medium">วันนัด</th>
                          <th className="px-3 py-2 text-center font-medium">นัดทั้งหมด</th>
                          <th className="px-3 py-2 text-center font-medium">มา</th>
                          <th className="px-3 py-2 text-center font-medium">ไม่มา</th>
                          <th className="px-3 py-2 text-center font-medium">เลื่อนนัด</th>
                          <th className="px-3 py-2 text-center font-medium">รอผล</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appointmentBoard.days.map((d) => (
                          <tr key={d.date} className={cn('border-t', DASH.tableRow)}>
                            <td className={cn('px-3 py-2 whitespace-nowrap', DASH.cellStrong)}>
                              {formatYmdDmyBe(d.date)}
                            </td>
                            <td className={cn('px-3 py-2 text-center tabular-nums', DASH.cell)}>{d.total}</td>
                            <td className={cn('px-3 py-2 text-center tabular-nums', TONE.success.value)}>{d.showed}</td>
                            <td className={cn('px-3 py-2 text-center tabular-nums', TONE.danger.value)}>{d.noShow}</td>
                            <td className={cn('px-3 py-2 text-center tabular-nums', TONE.warn.value)}>{d.rescheduled}</td>
                            <td className={cn('px-3 py-2 text-center tabular-nums', DASH.cellMuted)}>{d.pending}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* แท็บ "การโทรของฉัน" มี 2 ส่วนที่ **ทำงานคนละแบบ** (เจ้าของสั่ง 14 ส.ค. 2569):
              1. เก็บไปโทรเอง (call hold ผูกเบอร์ · มาจากหน้า Matching + ปุ่มโทรในแท็บนี้) — MyCallsSection
                 เจ้าของ pain: "เก็บไปโทรเองแล้วไปอยู่ไหนหาไม่เจอ" → ให้มีที่ถาวรตรงนี้
              2. เก็บไปติดต่อ (claim บนใบสมัคร) — RmTable ด้านล่าง
              ⚠️ MyCallsSection ซ่อนตัวเองเมื่อไม่มีงานโทรค้าง (holds=0) — hint จึงบอกไว้เสมอ */}
          {tab === 'contact' ? (
            <>
              <p className={cn('rounded-xl border px-3 py-2 text-[11px]', TONE.primary.soft, TONE.primary.value)}>
                <b>2 ส่วนที่ทำงานคนละแบบ:</b> ① เก็บไปโทรเอง (จากหน้า Matching — ผูกเบอร์
                มีเวลาโทร) โผล่ด้านบนตอนมีงานค้าง · ② เก็บไปติดต่อ (ใบที่คุณเก็บ) อยู่ในตารางด้านล่าง
              </p>
              {/* บอร์ดรับสมัคร = พื้นที่ของทีมสรรหา → เห็นเฉพาะงานโทรเลนสรรหา
                  (คนยังไม่สมัคร) · งานเลนคัดสรรมีหน้าของตัวเองที่ /matching/contact
                  (เจ้าของสั่ง 16 ส.ค. 2569: "ไม่ปนกัน") */}
              <MyCallsSection lane="recruit" />
            </>
          ) : null}

          {loadError ? (
            <p className={cn('rounded-xl border px-3 py-2 text-[12px]', TONE.danger.soft, TONE.danger.value)}>
              {loadError} —{' '}
              <button type="button" onClick={load} className="underline">
                ลองใหม่
              </button>
            </p>
          ) : loading ? (
            <p className={cn('rounded-xl border px-3 py-6 text-center text-sm', DASH.card, DASH.muted)}>
              กำลังโหลดใบสมัคร…
            </p>
          ) : (
            <>
              {/* แถบบอกโหมด drill-down จากกล่อง dashboard — เลขต้องเท่ากล่องที่กดมา */}
              {bucket ? (
                <div
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs',
                    TONE.primary.soft,
                  )}
                >
                  <span>
                    กำลังดูจากกล่อง: <b>{RM_BUCKET_LABEL[bucket]}</b> ({filtered.length} ใบ) —
                    มุมมองนี้รวมทุกแท็บ/ทุกสถานะ
                  </span>
                  <Button variant="ghost" size="sm" type="button" onClick={clearBucket} className="shrink-0">
                    ✕ ล้าง
                  </Button>
                </div>
              ) : null}
              {/* กอง "เลือกวิธีโทร" (Phase 5.9) — ใบที่ worker ถอด claim เพราะดองเกิน 1 วัน
                  🔴 ซ่อนตัวเองเมื่อไม่มีของ (แพตเทิร์นเดียวกับ MyCallsSection) — แถบที่ขึ้น
                  ทุกวันด้วยเลข 0 คือขยะ (เจ้าของ: "ของน้อยคือสัญญาณ ของเยอะคือพื้นหลัง") */}
              {awaitingChoiceRows.length > 0 ? (
                <div className={cn('space-y-2 rounded-xl border px-3 py-2.5', TONE.warn.soft)}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className={cn('text-xs font-semibold', TONE.warn.value)}>
                      ต้องเลือกวิธีโทร {awaitingChoiceRows.length.toLocaleString('th-TH')} คน —
                      ถูกถอดจากคนที่เก็บไว้แล้วไม่โทรเกิน 1 วัน
                    </p>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <Button variant="secondary" size="sm"
                        type="button"
                        onClick={() => void keepForSelf(awaitingChoiceRows.map((r) => r.id))}
                        >
                        เก็บไปโทรเองทั้งหมด
                      </Button>
                      <Button size="sm"
                        type="button"
                        onClick={() => askSendAi(awaitingChoiceRows.map((r) => r.id))}
                        >
                        ส่ง AI โทรทั้งหมด
                      </Button>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {awaitingChoiceRows.slice(0, AWAITING_ROWS_SHOWN).map((r) => {
                      const cd = choiceCountdown(r.unclaimed_at, now);
                      return (
                        <li
                          key={r.id}
                          className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-1 text-[11px] first:border-0 first:pt-0"
                        >
                          <span className="min-w-0">
                            <b className={DASH.cellStrong}>{r.full_name}</b>
                            {r.unclaimed_from_name ? (
                              <span className={DASH.muted}> · เดิม {r.unclaimed_from_name} เก็บไว้</span>
                            ) : null}
                            {cd ? (
                              <span className={cd.overdue ? TONE.danger.value : TONE.warn.value}>
                                {' '}
                                · {cd.label}
                              </span>
                            ) : null}
                          </span>
                          <span className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void keepForSelf([r.id])}
                              className={cn(
                                // min-h-9 = 36px กดโดนด้วยนิ้วบนมือถือ (เกณฑ์ของ panel เอกสาร)
                                'inline-flex min-h-9 items-center rounded-full border px-3 font-semibold',
                                TONE.primary.outline,
                              )}
                            >
                              โทรเอง
                            </button>
                            <button
                              type="button"
                              onClick={() => askSendAi([r.id])}
                              className={cn(
                                'inline-flex min-h-9 items-center rounded-full border px-3 font-semibold',
                                TONE.violet.outline,
                              )}
                            >
                              ส่ง AI โทร (ยิงสายจริง)
                            </button>
                          </span>
                        </li>
                      );
                    })}
                    {awaitingChoiceRows.length > AWAITING_ROWS_SHOWN ? (
                      <li className={cn('pt-1 text-[11px]', DASH.muted)}>
                        และอีก {awaitingChoiceRows.length - AWAITING_ROWS_SHOWN} คน — ใช้ปุ่ม
                        "ทั้งหมด" ด้านบน หรือกดกล่อง "รอเลือกวิธีโทร" บนแดชบอร์ดเพื่อดูครบ
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}

              {/* rm-print-area: ตอนกด "โหลดเป็น PDF" print CSS จะโชว์เฉพาะก้อนนี้
                  (เฉพาะแท็บนัดหมาย — แท็บอื่นพิมพ์ทั้งหน้าตามปกติ) */}
              <div className={tab === 'appointments' ? 'rm-print-area' : undefined}>
              <RmTable
                tab={tab}
                rows={pageRows}
                selectedIds={selectedIds}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
                onAction={onRowAction}
                holdByRef={holdByRef}
                onAttendance={onAttendance}
              />
              </div>
              <ListPaginationBar
                page={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={filtered.length}
                pageFrom={filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                pageTo={Math.min(currentPage * pageSize, filtered.length)}
                onPageChange={setPage}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setPage(1);
                }}
              />
            </>
          )}
        </div>
      </div>

      <AddApplicantDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setNotice('บันทึกผู้สมัครแล้ว');
          load(); // ใบใหม่ต้องโผล่ในตารางทันที ไม่ต้องให้กดรีเฟรชเอง
        }}
      />

      {/* ยืนยันก่อนให้ AI โทรจริง — โชว์รายชื่อ (Phase 5.9/5.12 · กติกา: ปุ่มที่ยิงสายต้องมีป๊อป) */}
      <CallChoiceConfirmDialog
        open={aiConfirmIds !== null}
        names={aiConfirmNames}
        busy={aiSending}
        onCancel={() => setAiConfirmIds(null)}
        onConfirm={() => void confirmSendAi()}
      />

      {/* dialog รายละเอียด + ติดต่อสำเร็จ/ไม่สำเร็จ + นัด (ลิสต์ข้อ 7 · 14 ส.ค. 2569) */}
      <ApplicantContactDialog
        application={contactApp}
        onClose={() => setContactApp(null)}
        onSaved={() => {
          setNotice('บันทึกผลติดต่อแล้ว');
          load(); // สถานะใบเปลี่ยน (นัดได้ = converted) แถวอาจย้ายแท็บ — โหลดใหม่ให้เห็นทันที
        }}
      />
    </div>
  );
};

export default RmWorkspace;
