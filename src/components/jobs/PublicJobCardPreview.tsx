import React from 'react';
import { Banknote, Calendar, Flag, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { jobBoardCardSubtitle, jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { publicSafeAddress } from '@/lib/publicJobPrivacy';
import { publicBenefitList, publicFieldVisible } from '@/lib/publicFieldVisibility';
import { publicIncomeOf } from '@/lib/publishReadiness';
import { benefitDisplayLabels } from '@/lib/extraBenefits';
import { payCycleText, payCyclesOf } from '@/lib/payCycle';
import { publicJobTitle } from '@/lib/publicJobTitle';
import { formatYmdDmyBe } from '@/lib/dateTh';

/**
 * ═══ "คนนอกจะเห็นแบบนี้" — การ์ดใบงานบนหน้าสมัครสาธารณะ (/apply) แบบย่อ สำหรับป๊อปประกาศ (2 ต.ค. 2569) ═══
 *
 * 🔴 ทุกช่องใช้ตัวคำนวณชุดเดียวกับการ์ดฝั่งคนนอกใน `JobBoardView` + `api/_handlers/public/jobs.ts`:
 * สถานที่ = `publicSafeAddress` (ที่อยู่ดิบไม่มีทางหลุด) · รายได้ = `publicIncomeOf` · ช่องที่ติ๊กซ่อน = `publicFieldVisible`
 * ⇒ แก้ช่องในป๊อปแล้วการ์ดนี้เปลี่ยนตามทันที และตรงกับที่ผู้สมัครจะเห็น
 * ⚠️ ไม่มีของภายใน (เลขที่ใบขอ · ผู้ติดต่อ · ค่าปรับ · อายุงาน) — การ์ดนี้คือมุมมองคนนอกเท่านั้น
 */
export default function PublicJobCardPreview({ job, className }: { job: JobRequest; className?: string }) {
  const place = publicSafeAddress(job);
  const income = publicFieldVisible(job, 'income') ? publicIncomeOf(job) : null;
  const benefits = publicBenefitList(job, benefitDisplayLabels(job.extra_benefits));
  const pay = publicFieldVisible(job, 'income') ? payCycleText(payCyclesOf(job)) : '';
  const subtitle = jobBoardCardSubtitle(job);
  return (
    <Card className={cn('space-y-3 rounded-2xl p-4', className)} data-testid="public-job-preview">
      <div className="space-y-1">
        <h3 className="line-clamp-2 text-base font-medium text-foreground">{jobBoardCardTitle(job)}</h3>
        <p className="line-clamp-2 text-sm font-medium text-primary">{publicJobTitle(job)}</p>
        {subtitle ? <p className="line-clamp-2 text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" aria-hidden />
        <span>{place || 'ไม่ได้ระบุสถานที่'}</span>
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        {income ? (
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Banknote className="h-4 w-4 text-success" aria-hidden />
            {income.text}
          </span>
        ) : null}
        {publicFieldVisible(job, 'required_date') && job.required_date ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-4 w-4" aria-hidden />
            ต้องการ {formatYmdDmyBe(job.required_date)}
          </span>
        ) : null}
        {job.boss_nationality?.trim() && publicFieldVisible(job, 'boss_nationality') ? (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Flag className="h-4 w-4" aria-hidden />
            นายสัญชาติ {job.boss_nationality.trim()}
          </span>
        ) : null}
      </div>
      {pay || benefits.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {pay ? <span className={cn('whitespace-nowrap', TONE.info.chip)}>{pay}</span> : null}
          {benefits.map((b) => (
            <span key={b} className={cn('whitespace-nowrap', TONE.success.chip)}>
              {b}
            </span>
          ))}
        </div>
      ) : null}
      {/* ปุ่มของหน้าสาธารณะ — ในตัวอย่างเป็นแค่ป้าย (กดไม่ได้) */}
      <p className="rounded-full bg-primary py-2 text-center text-sm font-medium text-primary-foreground" aria-hidden>
        สมัครงาน
      </p>
    </Card>
  );
}
