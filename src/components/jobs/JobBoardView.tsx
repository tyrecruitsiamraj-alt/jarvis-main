import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import { jobBoardCardTitle, unitRequestCardSubtitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { extractJobSubtypeLabel } from '@/lib/siamrajUnitFilters';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { EM_DASH, dashIfEmpty } from '@/lib/displayFallback';
import { inferProvinceFromAddress, inferSubdistrictFromAddress } from '@/lib/parseThaiJobAddress';
import { displayDistrictLine } from '@/lib/displayJobLocation';
import { resolveApplyPositionPreset } from '@/lib/jobBoardPositionPreset';
import JobBoardTopFilters from '@/components/jobs/JobBoardTopFilters';
import SearchField from '@/components/shared/SearchField';
import PublicApplyDialog from '@/components/jobs/PublicApplyDialog';
import JobApplicantsDialog from '@/components/jobs/JobApplicantsDialog';
import GenApplyLinkDialog from '@/components/jobs/GenApplyLinkDialog';
import EditPostingDialog from '@/components/jobs/EditPostingDialog';
import RecruitBoardTools from '@/components/jobs/RecruitBoardTools';
import RecruitFunnelPanel from '@/components/recruit-rm/RecruitFunnelPanel';
import PageHeroStrip, { heroButton } from '@/components/shared/PageHeroStrip';
import { fetchJobApplicationCounts } from '@/lib/publicApplicationsApi';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import { getTotalPages, type PageSizeOption } from '@/lib/pagination';
import { fetchRecruitPostings } from '@/lib/recruitPostingsApi';
import { STANDALONE_POSTING_KINDS, type RecruitPosting } from '@/lib/recruitPostings';
import { TONE, type ToneKey } from '@/lib/designTokens';
import { useJobBoardFilters } from '@/hooks/useJobBoardFilters';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { MapPin, Sparkles, Briefcase, Calendar, Banknote, RefreshCw, FileText, Send, Users, Link2, Pencil, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

function staffAssigneeLine(j: JobRequest): string | null {
  const parts = [
    j.opl_name ? `OPL ${j.opl_name}` : null,
    j.recruiter_name ? `สรรหา ${j.recruiter_name}` : null,
    j.screener_name ? `คัดสรร ${j.screener_name}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** BU ตั้งต้นของกล่องลอยที่ยังไม่มีประกาศ — ผู้ใช้แก้ได้ในฟอร์ม (ชุดเดียวกับ RecruitBoardTools) */
const BOARD_DEFAULT_BU = 'LBD';

/** สีกล่องลอยต่อประเภท (mockup rev.3 ข้อ 04) — ม่วง/ม่วง/ฟ้า/ส้ม/เขียว ตามลำดับใน STANDALONE_POSTING_KINDS */
const STANDALONE_KIND_TONE: Record<string, ToneKey> = {
  thai_executive: 'violet',
  foreign_executive: 'violet',
  central: 'info',
  valet: 'orange',
  government: 'success',
};

export type JobBoardViewProps = {
  jobs: JobRequest[];
  loading: boolean;
  loadError?: string | null;
  variant?: 'public' | 'staff';
  searchPlaceholder?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  detailReturnTo?: string;
  /**
   * มุมมองของบอร์ดฝั่งเจ้าหน้าที่ (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก: รวมหน้า RM เข้าบอร์ด
   * · 13 ส.ค. 2569: ยก "การติดต่อ"/"ติดตามนัดหมาย" ขึ้นเป็นแท็บระดับบอร์ด)
   * 'board' = กล่องงาน · ที่เหลือ = เนื้อ RM คนละแท็บ (ส่งมาทาง listContent —
   * StaffJobBoardPage เป็นคนเลือกแท็บให้ RmWorkspace ตาม view)
   * ⚠️ ตัวเนื้อ list ถูก import ที่ StaffJobBoardPage ไม่ใช่ที่นี่ — ไฟล์นี้ใช้ร่วมกับ
   * หน้าสมัครสาธารณะ ห้ามลากโค้ด RM เข้ามาใน bundle
   */
  view?: BoardViewId;
  onViewChange?: (view: BoardViewId) => void;
  listContent?: React.ReactNode;
};

/** แท็บระดับบอร์ด — 'board' คือกล่องงาน ที่เหลือ mapped เข้าแท็บของ RmWorkspace */
export type BoardViewId = 'board' | 'list' | 'contact' | 'appointments';

const JobBoardView: React.FC<JobBoardViewProps> = ({
  jobs,
  loading,
  loadError,
  variant = 'public',
  searchPlaceholder,
  onRefresh,
  refreshing,
  detailReturnTo = '/jobs/board',
  view = 'board',
  onViewChange,
  listContent,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<JobRequest | null>(null);
  const positionPreset = useMemo(
    () => (variant === 'public' ? resolveApplyPositionPreset(searchParams.get('pos')) : null),
    [variant, searchParams],
  );
  const filters = useJobBoardFilters(jobs, {
    initialPosition: positionPreset?.positionFilter,
    lockPosition: positionPreset?.locked,
    drivingPositionGroup: positionPreset?.isDrivingGroup,
  });
  const isStaff = variant === 'staff';

  /**
   * ตัวกรอง "ประเภทงาน" + "เจ้าหน้าที่สรรหา" (เจ้าของสั่งเพิ่ม 13 ส.ค. 2569)
   * ⚠️ **ส่งเฉพาะฝั่งเจ้าหน้าที่** — ชื่อเจ้าหน้าที่สรรหาเป็นข้อมูลภายใน
   * ห้ามหลุดออกหน้าสมัครสาธารณะ ซึ่งใช้ component ตัวเดียวกันนี้
   */
  const staffOnlyFilterProps = isStaff
    ? {
        recruiterFilter: filters.recruiterFilter,
        onRecruiterFilterChange: filters.setRecruiterFilter,
        recruiterOptions: filters.recruiterOptions,
        contractTypeFilter: filters.contractTypeFilter,
        onContractTypeFilterChange: filters.setContractTypeFilter,
        contractTypeOptions: filters.contractTypeOptions,
      }
    : {};

  // จำนวนผู้สมัครต่อใบ (เจ้าหน้าที่) — ประกาศตรงนี้เพราะการเรียงการ์ดข้างล่างต้องใช้
  const [applicantCounts, setApplicantCounts] = useState<Record<string, number>>({});

  // แบ่งหน้าการ์ดประกาศ — ใช้แถบเลขหน้ากลางของระบบ (เลือกจำนวนต่อหน้าได้เหมือนหน้าอื่น)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);
  const totalPages = getTotalPages(filters.filtered.length, pageSize);
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  // ใบที่มีคนกรอกใบสมัครเข้ามาแล้วขึ้นก่อน (เจ้าของสั่ง 13 ส.ค. 2569:
  // "เรียงใบที่มีคนกรอกเข้ามาไว้บนๆ") — sort เป็น stable ลำดับเดิมในแต่ละกลุ่มไม่เปลี่ยน
  // ฝั่งสาธารณะไม่มี applicantCounts (โหลดเฉพาะเจ้าหน้าที่) = ไม่เรียงใหม่ พฤติกรรมเดิม
  const orderedJobs = useMemo(() => {
    const rank = (id: string) => ((applicantCounts[id] ?? 0) > 0 ? 0 : 1);
    return [...filters.filtered].sort((a, b) => rank(a.id) - rank(b.id));
  }, [filters.filtered, applicantCounts]);
  const visibleJobs = orderedJobs.slice(pageStart, pageStart + pageSize);

  // เปลี่ยนตัวกรองแล้วจำนวนผลลด — กันค้างอยู่หน้าที่หายไป
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyJob, setApplyJob] = useState<JobRequest | null>(null);

  const openApply = (job: JobRequest | null = null) => {
    setApplyJob(job);
    setApplyOpen(true);
  };

  // เจ้าหน้าที่: กดการ์ดเพื่อดูผู้สมัครที่กรอกฟอร์มของงานนั้น
  // (state จำนวนผู้สมัครต่อใบย้ายไปประกาศไว้ข้างบน — การเรียงการ์ดต้องใช้ก่อนถึงตรงนี้)
  const [applicantsJob, setApplicantsJob] = useState<JobRequest | null>(null);
  // เจ้าหน้าที่: สร้างลิงก์รับสมัครของงาน (Gen Link)
  const [genLinkJob, setGenLinkJob] = useState<JobRequest | null>(null);
  /** สร้างลิงก์ของกล่องลอย — กดจากการ์ดกล่องลอยตรง ๆ ไม่ต้องผ่านตัวเลือกประเภทอีกชั้น */
  const [genStandalone, setGenStandalone] = useState<
    { kind: string; kindLabel: string; departmentCode: string } | null
  >(null);
  // เจ้าหน้าที่: แก้เนื้อหาประกาศที่สร้างไว้แล้ว (mockup rev.3 ข้อ 04)
  const [editPosting, setEditPosting] = useState<RecruitPosting | null>(null);
  // สาธารณะ: เปิดฟอร์มสมัครอัตโนมัติจาก deep link /apply?job=<id>
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  /**
   * ประกาศของบอร์ด (mockup rev.3 ข้อ 04) — ใช้ 2 ที่:
   * แถวกล่องลอย = รวมผู้สมัครต่อประเภทที่ไม่ผูกใบขอ · ชิปบนการ์ด = ช่องทางที่ปล่อยลิงก์ + ยอดคลิก
   * ล้มเหลวก็ปล่อยเงียบเหมือน applicantCounts — เป็นข้อมูลเสริม ไม่ใช่ตัวหลักของหน้า
   */
  const [postings, setPostings] = useState<Awaited<ReturnType<typeof fetchRecruitPostings>>>([]);
  /** บวกหนึ่งเพื่อสั่งโหลดประกาศใหม่ — ใช้หลังสร้าง/แก้ประกาศ ไม่งั้นชิปช่องทางกับปุ่มแก้ไขไม่อัปเดตจนรีเฟรชหน้า */
  const [postingsRev, setPostingsRev] = useState(0);

  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;
    fetchRecruitPostings()
      .then((p) => {
        if (!cancelled) setPostings(p);
      })
      .catch(() => {
        /* ข้อมูลเสริม — ไม่ต้องรบกวนคนใช้งาน */
      });
    return () => {
      cancelled = true;
    };
  }, [isStaff, postingsRev]);

  /**
   * ประเภทกล่องลอย → สรุปของจริงต่อประเภท (นับจากประกาศที่ไม่ผูกใบขอเท่านั้น)
   * เก็บชื่อประกาศ/จังหวัด/BU มาด้วย เพราะการ์ดกล่องลอยใช้โครงเดียวกับการ์ดใบขอ
   * ซึ่งมีบรรทัดคำบรรยายกับบรรทัดสถานที่ — **ทุกค่ามาจากประกาศจริง ไม่มีค่าตกแต่ง**
   */
  const standaloneSummary = useMemo(() => {
    const acc: Record<
      string,
      { postings: number; applicants: number; titles: string[]; provinces: string[]; bus: string[] }
    > = {};
    for (const k of STANDALONE_POSTING_KINDS) {
      acc[k.code] = { postings: 0, applicants: 0, titles: [], provinces: [], bus: [] };
    }
    for (const p of postings) {
      if (!p.standaloneKind || !acc[p.standaloneKind]) continue;
      const a = acc[p.standaloneKind];
      a.postings += 1;
      a.applicants += p.applicationCount ?? 0;
      const title = p.title?.trim();
      if (title && !a.titles.includes(title)) a.titles.push(title);
      const province = p.province?.trim();
      if (province && !a.provinces.includes(province)) a.provinces.push(province);
      const bu = p.departmentCode?.trim();
      if (bu && !a.bus.includes(bu)) a.bus.push(bu);
    }
    return acc;
  }, [postings]);

  /**
   * ใบขอ → ประกาศล่าสุดของใบนั้น — ใช้กับปุ่ม "แก้ไข" บนการ์ด (mockup rev.3 ข้อ 04)
   * ใบเดียวมีได้หลายประกาศ เลือกใบล่าสุดเพราะเป็นตัวที่กำลังใช้รับสมัครอยู่
   * (API เรียงมาแบบ created_at DESC แล้ว จึงเอาตัวแรกที่เจอ)
   */
  const latestPostingByJob = useMemo(() => {
    const map = new Map<string, RecruitPosting>();
    for (const p of postings) {
      if (!p.jobId || map.has(p.jobId)) continue;
      map.set(p.jobId, p);
    }
    return map;
  }, [postings]);

  /** ใบขอ → ช่องทางที่ปล่อยลิงก์ไว้ (รวมยอดคลิกของช่องทางเดียวกันเข้าด้วยกัน) */
  const channelsByJob = useMemo(() => {
    const map = new Map<string, { label: string; hits: number }[]>();
    for (const p of postings) {
      if (!p.jobId) continue;
      const acc = new Map<string, number>();
      for (const l of p.links) {
        const label = (l.channelLabel || 'ลิงก์กลาง').trim();
        acc.set(label, (acc.get(label) ?? 0) + (l.hitCount ?? 0));
      }
      const prev = map.get(p.jobId) ?? [];
      map.set(p.jobId, [...prev, ...[...acc].map(([label, hits]) => ({ label, hits }))]);
    }
    return map;
  }, [postings]);

  useEffect(() => {
    if (!isStaff) return;
    let cancelled = false;
    fetchJobApplicationCounts()
      .then((c) => {
        if (!cancelled) setApplicantCounts(c);
      })
      .catch(() => {
        /* badge is optional — ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [isStaff, jobs]);

  useEffect(() => {
    if (isStaff || deepLinkHandled || loading) return;
    const jobId = searchParams.get('job');
    if (!jobId) return;
    setDeepLinkHandled(true);
    const match = jobs.find((j) => j.id === jobId);
    if (match) openApply(match);
  }, [isStaff, deepLinkHandled, loading, searchParams, jobs]);

  return (
    <div className="relative bg-gradient-to-b from-blue-100/35 via-blue-50/10 to-transparent">

      <div className="relative mx-auto max-w-6xl px-4 md:px-6 pt-8 pb-6 md:pt-12 md:pb-10">
        {/* ฝั่งเจ้าหน้าที่ = hero เข้มตาม mockup rev.3 ข้อ 04 · ฝั่งคนนอกคงหัวสว่างเดิมไว้ (หน้าแบรนด์) */}
        {isStaff ? (
          <PageHeroStrip
            eyebrow="บอร์ดงานเปิดรับ · เจ้าหน้าที่"
            title="งานสรรหา"
            meta={loading ? undefined : `· ${filters.visibleCount.toLocaleString('th-TH')} ตำแหน่ง`}
            actions={
              <>
                {/* ค้นหาอยู่ในแถบหัวเดียวกับชื่อหน้า+ปุ่ม แบบหน้า Dashboard
                    (เจ้าของสั่ง 13 ส.ค. 2569: "ย้ายไปด้านบนแบบของหน้า Dashboard")
                    — เดิมอยู่ใต้แผงตัวเลข 9 ช่อง ต้องกวาดตาลงไปหา
                    ⚠️ เฉพาะมุมมอง "กล่องงาน" — แท็บอื่น (รายชื่อ/ติดต่อ/นัดหมาย) มีช่องค้นหา
                    ของตัวเองใน RmWorkspace ถ้าโชว์ตัวนี้ด้วยจะมีสองช่องที่ค้นคนละเรื่อง */}
                {view === 'board' ? (
                  <SearchField
                    compact
                    placeholder={searchPlaceholder}
                    value={filters.search}
                    onChange={(e) => filters.setSearch(e.target.value)}
                    wrapperClassName="w-full min-w-0 sm:w-72 lg:w-80"
                  />
                ) : null}
                {/* งานระดับตั้งค่าของบอร์ด — จัดการช่องทาง + สร้างประกาศลอย */}
                <RecruitBoardTools variant="onDark" />
                {onRefresh ? (
                  <button
                    type="button"
                    onClick={() => void onRefresh()}
                    disabled={loading || refreshing}
                    className={cn(heroButton, 'disabled:opacity-50')}
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
                    รีเฟรชข้อมูล
                  </button>
                ) : null}
              </>
            }
          />
        ) : (
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/40 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 mb-3">
                <Sparkles className="h-3.5 w-3.5" />
                บอร์ดประกาศรับสมัคร
              </div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight leading-tight">
                ค้นหางานที่เหมาะกับคุณ
              </h1>
              <p className="mt-2.5 text-sm md:text-base text-muted-foreground leading-relaxed max-w-xl">
                เลือกตำแหน่งที่สนใจ แล้วกรอกใบสมัครได้ทันที{' '}
                <span className="font-medium text-foreground">ทีมสรรหาจะติดต่อกลับ</span>
              </p>
            </div>
          </div>
        )}

        {/*
          แผงคุม 9 ตัวเลขของงานสรรหา — ตัวเดียวกับที่อยู่หน้า /recruit/rm
          ⚠️ เจ้าหน้าที่เท่านั้น — บอร์ดตัวนี้ใช้เป็นหน้าสาธารณะด้วย ยอดภายในห้ามหลุดออกไป
          ⚠️ **เฉพาะมุมมอง "รายชื่อผู้สมัคร"** (เจ้าของสั่ง 13 ส.ค. 2569:
          "ภาพรวมงานสรรหา อยู่แค่หน้ารายชื่อผู้สมัครก็พอ หน้าอื่นๆในนี้ไม่ต้องมี")
          — ตัวเลขในแผงเป็นเรื่องของ **คน** (กรอกมา/ติดต่อ/นัดหมาย) ไม่ใช่เรื่องของ
          ใบขอ จึงไม่เข้ากับมุมมองกล่องงาน และดันเนื้อหาจริงตกจอไปเปล่า ๆ
        */}
        {isStaff && view === 'list' ? (
          <div className="mt-6">
            <RecruitFunnelPanel />
          </div>
        ) : null}

        {/* ⚠️ ช่องค้นหาของเจ้าหน้าที่เคยอยู่ตรงนี้ (ใต้แผงตัวเลข 9 ช่อง) — ย้ายขึ้นไปอยู่ใน
            แถบหัวข้าง ๆ ปุ่มแล้ว แบบหน้า Dashboard (เจ้าของสั่ง 13 ส.ค. 2569)
            หน้าสาธารณะช่องค้นหายังอยู่ที่เดิมในแถบตัวกรอง — คนนอกไม่มีแถบหัวเข้ม */}

        {/* แท็บสลับมุมมอง (เจ้าของเคาะ 11 ส.ค. 2569 รอบหก: รวมหน้า RM เข้าบอร์ด)
            เจ้าของสั่งเพิ่ม 13 ส.ค. 2569: ยก "การติดต่อ" กับ "ติดตามนัดหมาย" จากแท็บย่อย
            ของ RM ขึ้นมาอยู่ระดับเดียวกับกล่องงาน/รายชื่อผู้สมัคร (แท็บย่อยใน RmWorkspace
            ถูกซ่อนเมื่อคุมจากข้างนอก) · โผล่เฉพาะเจ้าหน้าที่ — หน้าสาธารณะไม่มีทางเห็น */}
        {isStaff && onViewChange ? (
          <div className="mt-6 flex flex-wrap items-center gap-1 border-b border-border/60">
            {(
              [
                { id: 'board', label: 'กล่องงาน' },
                { id: 'list', label: 'รายชื่อผู้สมัคร' },
                { id: 'contact', label: 'การติดต่อ' },
                { id: 'appointments', label: 'ติดตามนัดหมาย' },
              ] as const
            ).map((v) => {
              const active = view === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onViewChange(v.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'px-4 py-2.5 text-sm font-semibold transition-colors',
                    active
                      ? cn(TONE.primary.value, 'border-b-2 border-current')
                      : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {v.label}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* มุมมองฝั่ง RM (รายชื่อผู้สมัคร/การติดต่อ/ติดตามนัดหมาย) — แทนที่ก้อน
            กล่องลอย+ตัวกรอง+การ์ดทั้งหมด · hero + แผงภาพรวมข้างบนคงอยู่ทุกมุมมอง */}
        {isStaff && view !== 'board' && listContent ? (
          <div className="mt-4 pb-10">{listContent}</div>
        ) : (
          <>
        <JobBoardTopFilters
          search={filters.search}
          onSearchChange={filters.setSearch}
          chip={filters.chip}
          onChipChange={filters.setChip}
          provinceFilter={filters.provinceFilter}
          onProvinceFilterChange={filters.onProvinceFilterChange}
          districtFilter={filters.districtFilter}
          onDistrictFilterChange={filters.setDistrictFilter}
          positionFilter={filters.positionFilter}
          onPositionFilterChange={filters.setPositionFilter}
          lockPosition={filters.lockPosition}
          subtypeFilter={filters.subtypeFilter}
          onSubtypeFilterChange={filters.setSubtypeFilter}
          provinceOptions={filters.provinceOptions}
          districtOptions={filters.districtOptions}
          positionOptions={filters.positionOptions}
          subtypeOptions={filters.subtypeOptions}
          {...staffOnlyFilterProps}
          loading={loading}
          searchPlaceholder={searchPlaceholder}
          hideSearch={isStaff}
          resultCount={loading ? undefined : filters.filtered.length}
          totalCount={loading ? undefined : filters.visibleCount}
        />

        {loadError ? <p className="mt-4 text-sm text-destructive">{loadError}</p> : null}

        {loading && (
          <p className="mt-10 text-sm text-muted-foreground animate-pulse text-center">กำลังโหลดประกาศงาน...</p>
        )}

        {!loading && filters.usedRelatedFallback && filters.search.trim() && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            ไม่พบผลที่ตรงคำค้นทั้งหมด — แสดงงานที่ใกล้เคียงแทน
          </p>
        )}

        {!loading && filters.filtered.length === 0 && (
          <div className="mt-10 jarvis-frost rounded-[1.5rem] border border-dashed border-white/70 p-10 text-center">
            <Briefcase className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="font-medium text-foreground">ยังไม่มีตำแหน่งที่ตรงกับตัวกรอง</p>
            <p className="mt-1 text-sm text-muted-foreground">ลองเปลี่ยนคำค้นหาหรือกด &quot;ทั้งหมด&quot;</p>
          </div>
        )}

        {isStaff ? (
          <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-[#b08d4f] dark:text-[#cfae72]">
            ประกาศจากใบขอ
          </p>
        ) : null}
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleJobs.map((job) => (
            <Card
              key={job.id}
              onClick={isStaff ? () => setApplicantsJob(job) : undefined}
              role={isStaff ? 'button' : undefined}
              tabIndex={isStaff ? 0 : undefined}
              onKeyDown={
                isStaff
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setApplicantsJob(job);
                      }
                    }
                  : undefined
              }
              className={cn(
                // flex-col + h-full: grid ยืดกล่องสูงเท่ากันอยู่แล้ว แต่ลูกเรียงชิดบน
                // พื้นที่เหลือจึงกองใต้ footer → แถบ "ผู้สมัคร N คน" ของแต่ละใบลอยคนละระดับ
                // (⚠️ ใส่ที่จุดเรียกใช้เท่านั้น ห้ามแก้ ui/card.tsx ซึ่งทั้งแอปใช้ร่วมกัน)
                'group jarvis-interactive-card flex h-full flex-col overflow-hidden rounded-[1.5rem] border-white/70 transition-all duration-300 hover:border-blue-300/40',
                isStaff && 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
              )}
            >
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {jobBoardCardTitle(job)}
                    </h2>
                    <p className="mt-1 line-clamp-2 text-xs leading-4 text-muted-foreground">
                      {unitRequestCardSubtitle(job) || EM_DASH}
                    </p>
                    {/* เลขที่ใบขอโชว์เฉพาะเจ้าหน้าที่ (หน้าสมัครสาธารณะไม่ต้องเห็น จึงไม่จองที่)
                        แต่ในฝั่งเจ้าหน้าที่ต้องมีที่ยืนทุกใบ ไม่งั้นแถวล่างเลื่อนไม่ตรงกัน */}
                    {isStaff ? (
                      <p className="mt-0.5 font-mono text-[11px] leading-4 text-muted-foreground/80">
                        {dashIfEmpty(job.request_no)}
                      </p>
                    ) : null}
                  </div>
                  {job.urgency === 'urgent' && (
                    <span className="shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-destructive">
                      ด่วน
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                    {publicJobPositionLabel(job)}
                  </span>
                  {job.job_description_code_1 && job.job_type ? (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {JOB_TYPE_LABELS[job.job_type]}
                    </span>
                  ) : (
                    <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                      {JOB_CATEGORY_LABELS[job.job_category]}
                    </span>
                  )}
                </div>
              </CardHeader>
              {/* flex-1: ดูดพื้นที่เหลือของกล่องไว้ที่นี่ ให้ footer ถูกตรึงก้นการ์ด
                  ความแปรผันของเนื้อด้านบน (ชิปช่องทางที่หายทั้งบล็อกในบางใบ ฯลฯ)
                  จึงไม่ทำให้แถบ "ผู้สมัคร N คน" ของแต่ละใบอยู่คนละระดับอีก */}
              <CardContent className="flex-1 space-y-2 pb-4">
                <p className="flex items-start gap-2 text-xs leading-4 text-muted-foreground line-clamp-2">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600/70" />
                  {/* ข้อความสำรองแบบเดียวกับการ์ดกล่องลอย ('ไม่ได้ระบุจังหวัด') —
                      คำที่ผู้สมัครทั่วไปอ่านรู้เรื่อง เพราะโผล่บนหน้าสมัครสาธารณะด้วย */}
                  {job.location_address?.trim() || 'ไม่ได้ระบุสถานที่'}
                </p>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="inline-flex items-center gap-1 text-foreground font-semibold">
                    <Banknote className="h-3.5 w-3.5 text-success" />
                    ฿{job.total_income.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    ต้องการ {formatYmdDmyBe(job.required_date)}
                  </span>
                </div>
              </CardContent>
              <CardFooter className="mt-auto flex-col items-stretch gap-2 border-t border-border/60 bg-muted/20 pt-3">
                {isStaff ? (
                  <>
                    {/* ชิปช่องทางที่ปล่อยลิงก์ไว้ + ยอดคลิก (mockup rev.3 ข้อ 04) */}
                    {(channelsByJob.get(job.id) ?? []).length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(channelsByJob.get(job.id) ?? []).slice(0, 3).map((c, i) => (
                          <span
                            key={`${c.label}-${i}`}
                            className={i === 0 ? TONE.primary.chip : TONE.neutral.chip}
                            title={`${c.label} · คลิก ${c.hits.toLocaleString('th-TH')} ครั้ง`}
                          >
                            {c.label} · คลิก {c.hits.toLocaleString('th-TH')}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Users className="h-3.5 w-3.5 text-blue-600/80" />
                        ผู้สมัคร {applicantCounts[job.id] ?? 0} คน
                      </span>
                      <div className="flex items-center gap-2">
                        {/* ค้นหาคนที่ยังไม่สมัคร (เจ้าของสั่ง 13 ส.ค. 2569: "ขอปุ่มนี้ใน
                            บอร์ดรับสมัครงาน ตามกล่องงานแต่ละงานด้วย") — พาไปหน้า Matching
                            ของใบนั้นแล้วค้นให้เลยด้วย `?ir=1`
                            ⚠️ ที่นี่ทำได้แค่ navigate เป็นสตริง **ห้าม import อะไรจาก
                            pages/matching เข้าไฟล์นี้** เพราะไฟล์นี้ใช้ร่วมกับหน้าสมัคร
                            สาธารณะ /apply (bundle ฝั่ง public จะบวมและลากโค้ดหลังบ้านไปด้วย)
                            · อยู่ในบล็อก isStaff จึงไม่มีทางโผล่บนหน้าสาธารณะ */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/matching/match?jobId=${encodeURIComponent(job.id)}&ir=1`);
                          }}
                          title="เปิดใบขอนี้ในหน้า Matching แล้วค้นหาคนในฐานที่ยังไม่ได้สมัครงานนี้"
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary"
                        >
                          <Search className="h-3.5 w-3.5" />
                          ค้นหาคนที่ยังไม่สมัคร
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGenLinkJob(job);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          สร้างลิงก์
                        </button>
                        {/* แก้ไข — โชว์เฉพาะใบที่สร้างประกาศไว้แล้ว ใบที่ยังไม่มีให้กด "สร้างลิงก์" ก่อน */}
                        {latestPostingByJob.has(job.id) ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditPosting(latestPostingByJob.get(job.id) ?? null);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-secondary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            แก้ไข
                          </button>
                        ) : null}
                        <span className="text-[11px] font-medium text-blue-600 dark:text-blue-300 group-hover:underline">
                          ดูรายชื่อ →
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex w-full gap-2">
                    <button
                      type="button"
                      onClick={() => setSelected(job)}
                      className="flex-1 rounded-lg border border-border bg-background py-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-secondary"
                    >
                      รายละเอียด
                    </button>
                    <button
                      type="button"
                      onClick={() => openApply(job)}
                      className="jarvis-pill-btn flex-1 py-2.5 text-xs font-semibold"
                    >
                      สมัครงาน
                      <Send className="h-3.5 w-3.5 opacity-90" />
                    </button>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* แถบเลขหน้า — ตัวเดียวกับหน้าหน่วยงาน/ผู้สมัคร เลือกจำนวนต่อหน้าได้ (20/40/60/100) */}
        {filters.filtered.length > 0 ? (
          <div className="pb-10 pt-4">
            <ListPaginationBar
              page={currentPage}
              pageSize={pageSize}
              totalItems={filters.filtered.length}
              totalPages={totalPages}
              pageFrom={pageStart + 1}
              pageTo={pageStart + visibleJobs.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>

        ) : null}

        {/*
          กล่องลอย (ไม่ผูกใบขอ) — เจ้าของสั่ง 13 ส.ค. 2569 ให้ "เอาลงมารวม" ท้ายลิสต์
          (เดิมอยู่เหนือตัวกรอง ดันใบขอจริงตกจอ) · ทรงการ์ดเดียวกับการ์ดใบขอ (11 ส.ค. 2569)
          (`jarvis-interactive-card` · หัวข้อ → ชิป → เนื้อ → แถบล่าง) แทนกล่องเล็กแบน ๆ เดิม

          ⚠️ ไม่มีลิงก์ "ดูรายชื่อ →" เหมือนการ์ดใบขอ — ใบสมัครฝั่งเราผูกกับ `job_id`
          ไม่ได้ผูกกับประกาศ จึงยังกรองรายชื่อ "เฉพาะกล่องลอยประเภทนี้" ไม่ได้จริง
          ใส่ปุ่มไปก็เป็นปุ่มหลอก · การกดการ์ด = สร้างลิงก์ของประเภทนั้น ซึ่งทำได้จริง
        */}
        {isStaff && postings.some((p) => p.standaloneKind) ? (
          <div className="mt-6">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#b08d4f] dark:text-[#cfae72]">
              กล่องลอย (ไม่ผูกใบขอ)
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {STANDALONE_POSTING_KINDS.map((k) => {
                const tone = TONE[STANDALONE_KIND_TONE[k.code] ?? 'neutral'];
                const s =
                  standaloneSummary[k.code] ??
                  { postings: 0, applicants: 0, titles: [], provinces: [], bus: [] };
                const openGen = () =>
                  setGenStandalone({
                    kind: k.code,
                    kindLabel: k.label,
                    departmentCode: s.bus[0] ?? BOARD_DEFAULT_BU,
                  });
                return (
                  <Card
                    key={k.code}
                    onClick={openGen}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openGen();
                      }
                    }}
                    className={cn(
                      'group jarvis-interactive-card cursor-pointer overflow-hidden rounded-[1.5rem] border-white/70 transition-all duration-300 hover:border-blue-300/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                      s.postings === 0 && 'opacity-60',
                    )}
                  >
                    <CardHeader className="space-y-3 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground transition-colors group-hover:text-blue-600">
                            {k.label}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {s.titles.length > 0 ? s.titles.join(' • ') : 'ยังไม่มีประกาศของประเภทนี้'}
                          </p>
                        </div>
                        <span className={cn('shrink-0', tone.chip)}>
                          {s.postings.toLocaleString('th-TH')} ประกาศ
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                          กล่องลอย
                        </span>
                        {s.bus.map((bu) => (
                          <span
                            key={bu}
                            className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {bu}
                          </span>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 pb-4">
                      <p className="flex items-start gap-2 text-xs text-muted-foreground line-clamp-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600/70" />
                        {s.provinces.length > 0 ? s.provinces.join(' · ') : 'ไม่ได้ระบุจังหวัด'}
                      </p>
                    </CardContent>
                    <CardFooter className="flex-col items-stretch gap-2 border-t border-border/60 bg-muted/20 pt-3">
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Users className="h-3.5 w-3.5 text-blue-600/80" />
                          ผู้สมัคร {s.applicants.toLocaleString('th-TH')} คน
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-300 group-hover:underline">
                          <Link2 className="h-3.5 w-3.5" />
                          สร้างลิงก์ →
                        </span>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : null}
          </>
        )}

        {!isStaff ? (
          <div className="mx-auto max-w-md pb-14 pt-2 text-center">
            <div className="jarvis-frost rounded-2xl border border-white/70 px-6 py-8">
              <p className="text-sm font-medium text-foreground">พร้อมสมัครแล้ว?</p>
              <p className="mt-1 text-xs text-muted-foreground">กรอกใบสมัครสั้นๆ แล้วทีมสรรหาจะติดต่อกลับ</p>
              <button
                type="button"
                onClick={() => openApply(null)}
                className="jarvis-pill-btn mt-5 inline-flex w-full justify-center px-8 py-3.5 text-sm font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                กรอกใบสมัครงาน
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="flex max-h-[min(92dvh,820px)] w-[min(calc(100vw-1.25rem),32rem)] max-w-none flex-col gap-0 overflow-hidden border-border/80 p-0">
          <DialogHeader className="shrink-0 border-b border-border/50 px-5 pb-3 pt-5 text-left">
            <DialogTitle className="pr-8 text-base font-semibold leading-snug sm:text-lg break-words">
              {selected ? jobBoardCardTitle(selected) : ''}
            </DialogTitle>
            <DialogDescription className="sr-only">
              รายละเอียดตำแหน่งงาน
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 text-sm">
                <div className="flex flex-wrap gap-2">
                <span className="rounded-lg bg-secondary px-2.5 py-1 text-xs font-medium">
                  {publicJobPositionLabel(selected)}
                </span>
                {selected.job_description_code_1 ? (
                  <span className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                    {JOB_TYPE_LABELS[selected.job_type]}
                  </span>
                ) : (
                  <span className="rounded-lg bg-muted px-2.5 py-1 text-xs">
                    {JOB_CATEGORY_LABELS[selected.job_category]}
                  </span>
                )}
                {selected.urgency === 'urgent' && (
                  <span className="rounded-lg bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive">
                    รับด่วน
                  </span>
                )}
              </div>
              <dl className="grid gap-0 text-xs sm:text-sm">
                {isStaff && selected.request_no ? (
                  <div className="border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">เลขที่ใบขอ</dt>
                    <dd className="mt-0.5 font-mono font-medium text-foreground">{selected.request_no}</dd>
                  </div>
                ) : null}
                <div className="border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">สถานที่</dt>
                  <dd className="mt-0.5 font-medium leading-relaxed text-foreground break-words">
                    {selected.location_address}
                  </dd>
                </div>
                <div className="border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">ตำบล / แขวง</dt>
                  <dd className="mt-0.5 font-medium text-foreground break-words">
                    {inferSubdistrictFromAddress(selected.location_address || '') ?? '—'}
                  </dd>
                </div>
                <div className="border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">อำเภอ / เขต</dt>
                  <dd className="mt-0.5 font-medium text-foreground break-words">
                    {displayDistrictLine(selected.location_address || '') ?? '—'}
                  </dd>
                </div>
                <div className="border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">จังหวัด</dt>
                  <dd className="mt-0.5 font-medium text-foreground break-words">
                    {inferProvinceFromAddress(selected.location_address || '') ?? '—'}
                  </dd>
                </div>
                {extractJobSubtypeLabel(selected) !== 'ไม่ระบุ' ? (
                  <div className="border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">ลักษณะงานย่อย</dt>
                    <dd className="mt-0.5 font-medium text-foreground break-words">
                      {extractJobSubtypeLabel(selected)}
                    </dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">ฐานเงินเดือน</dt>
                  <dd className="text-success font-semibold">฿{selected.total_income.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                  <dt className="text-muted-foreground">วันที่ต้องการคน</dt>
                  <dd>{formatYmdDmyBe(selected.required_date)}</dd>
                </div>
                {(selected.age_range_min != null || selected.age_range_max != null) && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">ช่วงอายุ</dt>
                    <dd>
                      {selected.age_range_min ?? '—'} – {selected.age_range_max ?? '—'} ปี
                    </dd>
                  </div>
                )}
                {selected.gender_requirement && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">เพศ</dt>
                    <dd>{selected.gender_requirement}</dd>
                  </div>
                )}
                {selected.vehicle_required && (
                  <div className="flex justify-between gap-4 border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">รถที่ใช้</dt>
                    <dd className="text-right break-words">{selected.vehicle_required}</dd>
                  </div>
                )}
                {selected.work_schedule && (
                  <div className="border-b border-border/60 py-2.5">
                    <dt className="text-muted-foreground">เวลาทำงาน</dt>
                    <dd className="mt-0.5 break-words">{selected.work_schedule}</dd>
                  </div>
                )}
                {isStaff && staffAssigneeLine(selected) ? (
                  <div className="py-2.5">
                    <dt className="text-muted-foreground">ผู้รับผิดชอบ</dt>
                    <dd className="mt-0.5 font-medium leading-relaxed text-foreground break-words">
                      {staffAssigneeLine(selected)}
                    </dd>
                  </div>
                ) : null}
              </dl>
              </div>
              <div className="flex shrink-0 flex-col gap-2 border-t border-border/50 px-5 py-4">
                {isStaff ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      navigateToUnitRequest(selected, navigate, { returnTo: detailReturnTo });
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-semibold text-foreground hover:bg-secondary"
                  >
                    <FileText className="h-4 w-4" />
                    เปิดใบขอในระบบ
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    const job = selected;
                    setSelected(null);
                    openApply(job);
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
                >
                  สมัครตำแหน่งนี้
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PublicApplyDialog
        open={applyOpen}
        job={applyJob}
        onClose={() => setApplyOpen(false)}
      />

      <JobApplicantsDialog
        open={!!applicantsJob}
        job={applicantsJob}
        onClose={() => setApplicantsJob(null)}
      />

      <GenApplyLinkDialog
        open={!!genLinkJob}
        job={genLinkJob}
        onClose={() => setGenLinkJob(null)}
        onCreated={() => setPostingsRev((n) => n + 1)}
      />

      <GenApplyLinkDialog
        open={!!genStandalone}
        job={null}
        standalone={genStandalone}
        onClose={() => setGenStandalone(null)}
        onCreated={() => setPostingsRev((n) => n + 1)}
      />

      <EditPostingDialog
        posting={editPosting}
        onClose={() => setEditPosting(null)}
        onSaved={() => setPostingsRev((n) => n + 1)}
      />
    </div>
  );
};

export default JobBoardView;
