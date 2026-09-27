import React from 'react';
import { ArrowRight, EyeOff, MapPin, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PrequestBadge from '@/components/jobs/PrequestBadge';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { jobBoardCardTitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import { getJobAgeChipInfo, JOB_AGE_CHIP_META } from '@/lib/jobUrgency';
import { RELEASE_STEP_ORDER, type ReleaseProgress } from '@/lib/boardRelease';
import { boardProvinceOf } from '@/lib/boardFilters';
import { UNSPECIFIED } from '@/lib/facetEngine';
import { INCOME_PERIOD_LABEL } from '@/lib/incomeBreakdown';
import { incomeDisplay } from '@/lib/incomeLabel';
import { isHiddenFromPublicByWorkStatus } from '@/lib/publicJobVisibility';
import { isUnitRequestWorkStatus, UNIT_REQUEST_WORK_STATUS_LABELS } from '@/lib/unitRequestWorkStatus';

/**
 * ═══ การ์ดใบขอบนกล่องงาน — ฝั่งเจ้าหน้าที่ (แบบ A · 27 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"หน้ากล่องงานไม่เข้ากับหน้าอื่นๆเลย รกมาก"* → เลือกแบบ A จากแบบร่าง
 * ⇒ การ์ดเหลือ 5 บรรทัด: ชื่อหน่วยงาน · ตำแหน่ง · อยู่ขั้นไหน · ที่ไหน/เงินเท่าไหร่ · ผู้สมัคร + ปุ่มทำต่อ
 * ของที่ย้ายออกจากการ์ด: ป้ายสวัสดิการ · ชิปช่องทาง/คลิก · แถบ % · เลขที่ใบขอ · สาเหตุที่ขอ →
 * ดูได้ในป๊อปไล่งาน (กดการ์ด) · ปุ่ม "หาคนทุกถัง + ให้ AI โทร" ย้ายไปหัวป๊อปไล่งาน
 *
 * 🔴 **แยกไฟล์จากการ์ดหน้าสมัครสาธารณะโดยตั้งใจ** — การ์ดเดิมใช้ร่วมสองหน้า แก้ฝั่งเจ้าหน้าที่แล้วหน้า
 * สาธารณะเพี้ยนตามได้ · ไฟล์นี้วาดอย่างเดียว ตัวเลข/ขั้นมาจากผู้เรียก (`releaseProgressOf` ฯลฯ ที่เดียว)
 * 🔴 ห้ามเครื่องหมายถูก (บ้านนี้ถอดติ๊กถูกไปสองรอบ) — ขั้นที่ทำแล้วใช้จุดสีเข้มแทน
 * 🔴 ห้ามพาออกนอกกล่องงาน — กดการ์ด/ปุ่ม = เปิดป๊อปไล่งาน · ผู้สมัคร = สลับแท็บในหน้าเดิม
 */
export type BoardJobCardProps = {
  job: JobRequest;
  /** ขั้นของใบ — `null` = ทะเบียนยังโหลดไม่ครบ (ห้ามเดาขั้น 1 · 0%) */
  progress: ReleaseProgress | null;
  applicants: number;
  /** ส่ง AI แล้ว x/y (เจ้าของเคาะ 22 ก.ย. 2569 ข้อ 6) — ไม่รู้/ยังไม่มีผู้สมัคร = ไม่ขึ้น */
  ai?: { sent: number; total: number } | null;
  /** กำลังดูใบที่ปิดแล้ว/ยกเลิก — ไม่มีปุ่มลงมือ (ส่งคนไปงานที่ไม่มีอยู่) */
  closed: boolean;
  onOpen: (job: JobRequest) => void;
  onApplicants: (job: JobRequest) => void;
};

/** "บางพลี สมุทรปราการ" — อำเภอที่ทีม Online กรอก + จังหวัด · ไม่รู้ = บอกตรง ๆ (ไม่เดาจากจังหวัดไซต์) */
function shortPlace(job: JobRequest): string {
  const province = boardProvinceOf(job);
  const district = (job.override_district ?? '').trim();
  const parts = [district, province === UNSPECIFIED ? '' : province].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'ยังไม่ระบุสถานที่';
}

/** เงินต้องบอกหน่วยเสมอ — ตัวเดียวกับการ์ดเดิม/หน้าจับคู่ (`incomeDisplay`) · ไม่รู้หน่วย = คำเตือนใน tooltip */
function moneyOf(job: JobRequest): { text: string; hint: string | null } | null {
  if (job.income_display) {
    return {
      text: `฿${job.income_display.total.toLocaleString('th-TH')} ${INCOME_PERIOD_LABEL[job.income_display.period]}`,
      hint: null,
    };
  }
  const d = incomeDisplay({ totalIncome: job.total_income, monthlyIncome: job.monthly_income });
  return d ? { text: d.text, hint: d.hint } : null;
}

const BoardJobCard: React.FC<BoardJobCardProps> = ({ job, progress, applicants, ai, closed, onOpen, onApplicants }) => {
  const age = getJobAgeChipInfo(job);
  const money = moneyOf(job);
  const hidden = isUnitRequestWorkStatus(job.work_status) && isHiddenFromPublicByWorkStatus(job.work_status);
  const step = progress && !progress.released ? progress.currentStep : null;

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
        'group flex h-full cursor-pointer flex-col gap-3 rounded-2xl p-4 shadow-sm transition-colors hover:border-primary/30',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      )}
    >
      {/* ── ชื่อ + ตำแหน่ง · มุมขวา = ด่วน / ค้างกี่วัน ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <PrequestBadge job={job} />
          <h2 className="line-clamp-2 text-base font-medium text-foreground group-hover:text-primary">
            {jobBoardCardTitle(job)}
          </h2>
          <p className="line-clamp-1 text-sm font-medium text-primary">{publicJobPositionLabel(job)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {job.urgency === 'urgent' ? (
            <span className="rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">ด่วน</span>
          ) : null}
          {/* 🔴 ข้อความ/สีอายุจาก getJobAgeChipInfo ที่เดียว (ห้ามสเกลสีอายุชุดที่สอง) */}
          <span className={cn('rounded-md border px-1.5 py-0.5 text-xs font-medium', JOB_AGE_CHIP_META[age.level].chipCls)} title={age.title}>
            {age.cardText}
          </span>
        </div>
      </div>

      {/* ── อยู่ขั้นไหน (จุด 4 ขั้น · ไม่มีติ๊กถูก) ── */}
      {progress ? (
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1" aria-hidden>
            {RELEASE_STEP_ORDER.map((key, i) => (
              <span
                key={key}
                className={cn(
                  'h-2 w-2 rounded-full',
                  i + 1 <= progress.doneSteps
                    ? TONE.success.dot
                    : !progress.released && i + 1 === progress.currentStep
                      ? TONE.warn.dot /* ขั้นที่ค้าง = เหลืองแบบ "ยังไม่ปล่อย" (สีหลักเบอร์กันดีอ่านเป็นสัญญาณเตือน) */
                      : 'bg-muted',
                )}
              />
            ))}
          </span>
          <span className={cn('min-w-0 truncate', progress.released ? TONE.success.value : 'text-foreground')}>
            {progress.label}
          </span>
        </div>
      ) : null}

      {/* ── ที่ไหน · เงินเท่าไหร่ ── */}
      <p className={cn('flex min-w-0 items-center gap-1.5 text-xs', DASH.muted)}>
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{shortPlace(job)}</span>
        {money ? (
          <>
            <span aria-hidden>·</span>
            <span className="shrink-0 tabular-nums" title={money.hint ?? undefined}>
              {money.text}
            </span>
          </>
        ) : null}
      </p>

      {/* สถานะงานที่ทำให้ประกาศไม่ขึ้นหน้าสาธารณะ — ต้องรู้ (เจ้าของสั่ง 17 ส.ค. 2569) */}
      {hidden && isUnitRequestWorkStatus(job.work_status) ? (
        <p className={cn('inline-flex w-fit items-center gap-1 rounded-md px-2 py-0.5 text-xs', TONE.warn.chip)}>
          <EyeOff className="h-3 w-3" aria-hidden />
          {UNIT_REQUEST_WORK_STATUS_LABELS[job.work_status]} · ไม่ขึ้นประกาศ
        </p>
      ) : null}

      {/* ── ผู้สมัคร + ปุ่มทำต่อ — ตรึงก้นการ์ด ── */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
        {applicants > 0 ? (
          /* กดจำนวนผู้สมัคร = สลับไปแท็บรายชื่อผู้สมัครในหน้านี้ พร้อมติ๊กใบนี้ (ห้ามเด้งไปหน้าใบขอ) */
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onApplicants(job);
            }}
            className="inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-foreground hover:text-primary hover:underline"
          >
            <Users className="h-3.5 w-3.5" aria-hidden />
            ผู้สมัคร {applicants.toLocaleString('th-TH')} คน
            {ai && ai.total > 0 ? (
              <span className={cn('font-normal', ai.sent >= ai.total ? TONE.success.value : TONE.warn.value)}>
                · ส่ง AI แล้ว {ai.sent}/{ai.total}
              </span>
            ) : null}
          </button>
        ) : (
          <span className={cn('inline-flex items-center gap-1.5 text-xs', DASH.muted)}>
            <Users className="h-3.5 w-3.5" aria-hidden />
            ยังไม่มีผู้สมัคร
          </span>
        )}
        {closed ? null : (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(job);
            }}
            className="rounded-lg"
          >
            {step ? `ทำต่อขั้น ${step}` : 'เปิดดู'}
            <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </Card>
  );
};

export default BoardJobCard;
