import React from 'react';
import { ArrowRight, Ban, Banknote, Building2, EyeOff, MapPin, UserRound, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PrequestBadge from '@/components/jobs/PrequestBadge';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { getJobAgeChipInfo, JOB_AGE_CHIP_META } from '@/lib/jobUrgency';
import PublishReadinessChip from '@/components/jobs/PublishReadinessChip';
import { publicIncomeOf, readinessActionText, type PublishReadiness } from '@/lib/publishReadiness';
import { boardCardAge, boardCardGender, boardCardPlace, boardCardUnitName } from '@/lib/boardCardFacts';
import { isHiddenFromPublicByWorkStatus } from '@/lib/publicJobVisibility';
import { isUnitRequestWorkStatus, UNIT_REQUEST_WORK_STATUS_LABELS } from '@/lib/unitRequestWorkStatus';
import { releaseSkipText, type JobReleaseSkip } from '@/lib/jobReleaseSkips';

/**
 * ═══ การ์ดใบขอบนกล่องงาน — ฝั่งเจ้าหน้าที่ (แบบ A · 27 ก.ย. 2569 → กระชับแบบ C · 5 ต.ค. 2569) ═══
 *
 * แบบ C: ช่องไฟในการ์ดแคบลง (p-3 · gap-2) · เงิน/เพศ/อายุรวมบรรทัดเดียว · ขนาดตัวอักษรคงเดิม (เจ้าของเคยสั่งขยาย)
 *
 * เจ้าของ: *"หน้ากล่องงานไม่เข้ากับหน้าอื่นๆเลย รกมาก"* → เลือกแบบ A จากแบบร่าง
 * ⇒ การ์ดเหลือ 5 บรรทัด: ชื่อหน่วยงาน · ตำแหน่ง · พร้อมประกาศไหม/ขาดอะไร · ที่ไหน/เงินเท่าไหร่ · ผู้สมัคร + ปุ่มทำต่อ
 * 🔴 ตัวอักษร: เจ้าของสั่งขยาย ("ตัวอักษรในการ์ดยังเล็กไป") ⇒ เนื้อความ text-sm · ชื่อ text-lg · ตำแหน่ง text-base
 *    (ปุ่มยังเป็น xs ตามคำสั่ง "ปุ่มยังใหญ่ไป" — ห้ามขยายปุ่มตาม)
 * ของที่ย้ายออกจากการ์ด: ป้ายสวัสดิการ · ชิปช่องทาง/คลิก · แถบ % · เลขที่ใบขอ · สาเหตุที่ขอ →
 * ดูได้ในป๊อปไล่งาน (กดการ์ด) · ปุ่ม "หาคนทุกถัง + ให้ AI โทร" ย้ายไปหัวป๊อปไล่งาน
 *
 * 🔴 **แยกไฟล์จากการ์ดหน้าสมัครสาธารณะโดยตั้งใจ** — การ์ดเดิมใช้ร่วมสองหน้า แก้ฝั่งเจ้าหน้าที่แล้วหน้า
 * สาธารณะเพี้ยนตามได้ · ไฟล์นี้วาดอย่างเดียว ตัวเลข/ขั้นมาจากผู้เรียก (`releaseProgressOf` ฯลฯ ที่เดียว)
 * 🔴 ห้ามเครื่องหมายถูก (บ้านนี้ถอดติ๊กถูกไปสองรอบ)
 * 🔴 2 ต.ค. 2569 (เจ้าของเลือก B "ป๊อปหน้าเดียว ระบบร่างให้"): แถว "ติดขั้น N" + จุด 4 ขั้น → ชิป **พร้อมประกาศ / ขาด: … /
 *    ประกาศแล้ว** จาก `publishReadiness` ที่เดียว · ปุ่มท้ายการ์ดบอกว่าเปิดไปทำอะไร ("ตรวจแล้วประกาศ" / "เติม N ช่อง")
 * 🔴 ห้ามพาออกนอกกล่องงาน — กดการ์ด/ปุ่ม = เปิดป๊อปไล่งาน · ผู้สมัคร = สลับแท็บในหน้าเดิม
 */
export type BoardJobCardProps = {
  job: JobRequest;
  /** พร้อมประกาศไหม/ขาดอะไร — `null` = ทะเบียนยังโหลดไม่ครบ (ห้ามเดา "พร้อม" ทั้งที่ยังไม่รู้) */
  readiness: PublishReadiness | null;
  /**
   * จำนวนผู้สมัคร — `null` = ยอดยังไม่มา · `'error'` = โหลดยอดไม่ได้ (QA 5 ต.ค. 2569)
   * 🔴 สองแบบนี้ห้ามขึ้น "ยังไม่มีผู้สมัคร" — เดิมขึ้นตอนกำลังโหลด/โหลดพัง ทั้งที่ใบนั้นมีคนสมัครอยู่
   */
  applicants: number | null | 'error';
  /** ส่ง AI แล้ว x/y (เจ้าของเคาะ 22 ก.ย. 2569 ข้อ 6) — ไม่รู้/ยังไม่มีผู้สมัคร = ไม่ขึ้น */
  ai?: { sent: number; total: number } | null;
  /** กำลังดูใบที่ปิดแล้ว/ยกเลิก — ไม่มีปุ่มลงมือ (ส่งคนไปงานที่ไม่มีอยู่) */
  closed: boolean;
  onOpen: (job: JobRequest) => void;
  onApplicants: (job: JobRequest) => void;
  /** ทีม Online ตั้ง "ไม่ปล่อย + เหตุผล" ไว้ (29 ก.ย. 2569) — ใบที่ปล่อยแล้วไม่โชว์ (เซิร์ฟเวอร์ก็ไม่รับ) */
  skip?: JobReleaseSkip | null;
};

/** "บางพลี สมุทรปราการ" — อำเภอที่ทีม Online กรอก + จังหวัด · ไม่รู้ = บอกตรง ๆ (ไม่เดาจากจังหวัดไซต์) */
const BoardJobCard: React.FC<BoardJobCardProps> = ({ job, readiness, applicants, ai, closed, onOpen, onApplicants, skip }) => {
  const age = getJobAgeChipInfo(job);
  /** เงินต้องบอกหน่วยเสมอ — ตัวเดียวกับหน้าสาธารณะ/ป๊อปประกาศ (`publicIncomeOf`) · ไม่รู้หน่วย = คำเตือนใน tooltip */
  const money = publicIncomeOf(job);
  const gender = boardCardGender(job);
  const unitName = boardCardUnitName(job);
  const hidden = isUnitRequestWorkStatus(job.work_status) && isHiddenFromPublicByWorkStatus(job.work_status);
  /** ชิปสภาพ — ใบที่ ERP พาไปต่อแล้วและซ่อนจากหน้าสาธารณะมีชิปสถานะงานของตัวเองอยู่แล้ว · ใบที่ตั้งไม่ประกาศมีชิปแดง ⇒ ไม่ซ้ำ */
  const showReadiness = readiness !== null && !(readiness.kind === 'moved' && hidden) && readiness.kind !== 'skipped';

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(job)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(job);
        }
      }}
      className={cn(
        'group flex h-full cursor-pointer flex-col gap-2 rounded-2xl p-3 shadow-sm transition-colors hover:border-primary/30',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      )}
    >
      {/* ── ชื่อ + ตำแหน่ง · มุมขวา = ด่วน / ค้างกี่วัน ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <PrequestBadge job={job} />
          <h2 className="line-clamp-2 text-lg font-medium text-foreground group-hover:text-primary">
            {jobBoardCardTitle(job)}
          </h2>
          <p className="line-clamp-1 text-base font-medium text-primary">{publicJobPositionLabel(job)}</p>
          {/* ชื่อหน่วยงาน (เจ้าของ 4 ต.ค. 2569 ข้อ 7) — หัวการ์ดเป็นชื่อจุดทำงาน · ซ้ำกันไม่พิมพ์ซ้ำ */}
          {unitName ? (
            <p className={cn('flex min-w-0 items-center gap-1.5 text-sm', DASH.muted)}>
              <Building2 className="h-4 w-4 shrink-0" aria-hidden />
              <span className="line-clamp-2">{unitName}</span>
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {job.urgency === 'urgent' ? (
            <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-sm font-medium text-destructive">ด่วน</span>
          ) : null}
          {/* 🔴 ข้อความ/สีอายุจาก getJobAgeChipInfo ที่เดียว (ห้ามสเกลสีอายุชุดที่สอง) */}
          <span className={cn('rounded-md border px-1.5 py-0.5 text-sm font-medium', JOB_AGE_CHIP_META[age.level].chipCls)} title={age.title}>
            {age.cardText}
          </span>
        </div>
      </div>

      {/* ── พร้อมประกาศไหม / ขาดอะไร (2 ต.ค. 2569 — แทน "ติดขั้น N" + จุด 4 ขั้น) ── */}
      {showReadiness && readiness ? <PublishReadinessChip readiness={readiness} /> : null}

      {/* ── ที่ไหน (จังหวัด · เขต/อำเภอ) บรรทัดของตัวเอง ให้อ่านได้ครบ (4 ต.ค. 2569 ข้อ 7)
          · แบบ C (5 ต.ค. 2569): เงิน · เพศ · อายุ รวมบรรทัดเดียว (เดิม 2 บรรทัด) ── */}
      <div className="space-y-1">
        <p className={cn('flex min-w-0 items-start gap-1.5 text-sm', DASH.muted)}>
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="line-clamp-2">{boardCardPlace(job)}</span>
        </p>
        <p className={cn('flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm', DASH.muted)}>
          <Banknote className="h-4 w-4 shrink-0" aria-hidden />
          {money ? (
            <span className="tabular-nums" title={money.hint ?? undefined}>
              {money.text}
            </span>
          ) : (
            <span className={TONE.warn.value}>ยังไม่ตั้งรายได้</span>
          )}
          <span aria-hidden>·</span>
          {/* เพศ · อายุ — ไม่ระบุเพศ = สีเตือน (ประกาศไม่ได้จนกว่าจะเลือก) */}
          <UserRound className="h-4 w-4 shrink-0" aria-hidden />
          <span className={cn(!gender.known && TONE.warn.value)}>{gender.text}</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{boardCardAge(job)}</span>
        </p>
      </div>

      {/* สถานะงานที่ทำให้ประกาศไม่ขึ้นหน้าสาธารณะ — ต้องรู้ (เจ้าของสั่ง 17 ส.ค. 2569) */}
      {hidden && isUnitRequestWorkStatus(job.work_status) ? (
        <p className={cn('inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-sm', TONE.warn.chip)}>
          <EyeOff className="h-3.5 w-3.5" aria-hidden />
          {UNIT_REQUEST_WORK_STATUS_LABELS[job.work_status]} · ไม่ขึ้นประกาศ
        </p>
      ) : null}

      {/* "ไม่ปล่อย + เหตุผล" — ทีมต้องเห็นว่าใบนี้ตัดสินแล้ว (ไม่งั้นมีคนไล่ทำขั้นต่อซ้ำ) */}
      {skip && readiness?.kind !== 'released' ? (
        <p className={cn('inline-flex w-fit max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-sm', TONE.danger.chip)}>
          <Ban className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">ไม่ประกาศ · {releaseSkipText(skip)}</span>
        </p>
      ) : null}

      {/* ── ผู้สมัคร + ปุ่มทำต่อ — ตรึงก้นการ์ด ──
          🔴 ปุ่มอยู่ขวาแถวเดียวกันเสมอ (ไม่ตกบรรทัด) — "ส่ง AI แล้ว x/y" อยู่บรรทัดใต้จำนวนผู้สมัคร
          (หลังขยายตัวอักษร 27 ก.ย. 2569 ข้อความยาวขึ้น ปุ่มของบางใบตกบรรทัด การ์ดเลยสูงไม่เท่ากัน) */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/70 pt-2">
        <div className="min-w-0">
          {applicants === null ? (
            <Skeleton className="h-5 w-28" aria-label="กำลังโหลดผู้สมัคร" />
          ) : applicants === 'error' ? (
            <span className={cn('inline-flex items-center gap-1.5 text-sm', TONE.warn.value)}>
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              โหลดยอดผู้สมัครไม่ได้
            </span>
          ) : applicants > 0 ? (
            /* กดจำนวนผู้สมัคร = สลับไปแท็บรายชื่อผู้สมัครในหน้านี้ พร้อมติ๊กใบนี้ (ห้ามเด้งไปหน้าใบขอ) */
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onApplicants(job);
              }}
              className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-foreground hover:text-primary hover:underline"
            >
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              ผู้สมัคร {applicants.toLocaleString('th-TH')} คน
            </button>
          ) : (
            <span className={cn('inline-flex items-center gap-1.5 text-sm', DASH.muted)}>
              <Users className="h-4 w-4 shrink-0" aria-hidden />
              ยังไม่มีผู้สมัคร
            </span>
          )}
          {typeof applicants === 'number' && applicants > 0 && ai && ai.total > 0 ? (
            <p className={cn('mt-0.5 text-sm', ai.sent >= ai.total ? TONE.success.value : TONE.warn.value)}>
              ส่ง AI แล้ว {ai.sent}/{ai.total}
            </p>
          ) : null}
        </div>
        {closed ? null : (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(job);
            }}
            className="shrink-0 rounded-lg"
          >
            {readinessActionText(readiness)}
            <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </Card>
  );
};

export default BoardJobCard;
