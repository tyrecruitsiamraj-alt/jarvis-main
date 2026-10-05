import React from 'react';
import { Banknote, Calendar, Clock, Flag, Gift, MapPin, UserRound, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { JobRequest } from '@/types';
import { boardCardAge, boardCardGender, boardCardPlace } from '@/lib/boardCardFacts';
import { isOtBenefit, publicBenefitList, publicFieldVisible } from '@/lib/publicFieldVisibility';
import { benefitDisplayLabels, isRetiredBenefit } from '@/lib/extraBenefits';
import { payCycleCardText, payCyclesOf } from '@/lib/payCycle';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { benefitWithAmount, jobAverageIncome, jobBaseIncome } from '@/lib/jobPublicFacts';

const NUM = new Intl.NumberFormat('th-TH');

/**
 * ═══ ข้อมูลงานบนการ์ด — ตัวเดียวของการ์ดโพสต์ประกาศ · การ์ดหน้า /apply · ตัวอย่างขั้น 4 ═══
 *
 * เจ้าของ 5 ต.ค. 2569: *"หน้า Apply ติ๊กอะไรแล้วเห็นอะไร หน้า โพสต์ประกาศ ก็เห็นเหมือนกันสิ่
 * ไม่งั้นจะเช็คยังไงหล่ะว่าถูกต้องหรือเปล่า"* ⇒ ทุกช่องผ่าน `publicFieldVisible` ทั้งสองฝั่ง
 *
 * ลำดับตามที่เจ้าของเรียง: สถานที่ (จังหวัด · อำเภอ) · วันเวลาทำงาน · ฐานเงินเดือน · รายได้เฉลี่ย ·
 * สวัสดิการ (มียอดก็บอกยอด) · เพศ · อายุ — หัวการ์ด (หน่วยงาน · ตำแหน่ง · ผ่านมากี่วัน) อยู่ที่การ์ดแต่ละตัว
 *
 * `staff` = เปิดสีเตือนของช่องที่ยังไม่ครบ (ไม่ตั้งรายได้ / ไม่ระบุเพศ) — **เนื้อหาเหมือนกันทุกบรรทัด**
 */
export default function JobPublicFacts({
  job,
  staff = false,
  className,
}: {
  job: JobRequest;
  staff?: boolean;
  className?: string;
}) {
  const incomeShown = publicFieldVisible(job, 'income');
  const income = incomeShown ? jobBaseIncome(job) : null;
  const pay = incomeShown ? payCycleCardText(payCyclesOf(job)) : '';
  const average = publicFieldVisible(job, 'average_income') ? jobAverageIncome(job) : null;
  /**
   * สวัสดิการ — 🔴 ไม่มีโอที + ไม่มีรายการที่ถอดแล้ว (เจ้าของ 5 ต.ค. 2569: *"โอที ~75 บาท/ชม. เอาออก"* ·
   * รถรับส่ง · ปรับเงินเดือนประจำปี · โบนัสประจำปี · อาหารกลางวัน · ที่พัก/หอพัก *"เอาออก"*)
   */
  const benefits = publicBenefitList(job, benefitDisplayLabels(job.extra_benefits))
    .filter((b) => !isOtBenefit(b) && !isRetiredBenefit(b))
    .map((b) => benefitWithAmount(b, job.monthly_income_items));
  const gender = boardCardGender(job);
  const schedule = (job.work_schedule ?? '').trim();
  const requiredDate = publicFieldVisible(job, 'required_date') && job.required_date ? job.required_date : null;
  const boss = publicFieldVisible(job, 'boss_nationality') ? (job.boss_nationality ?? '').trim() : '';

  const row = cn('flex min-w-0 items-start gap-1.5 text-sm', DASH.muted);
  const icon = 'mt-0.5 h-4 w-4 shrink-0';

  return (
    <div className={cn('space-y-1', className)} data-testid="job-public-facts">
      <p className={row}>
        <MapPin className={icon} aria-hidden />
        <span className="line-clamp-2">{boardCardPlace(job)}</span>
      </p>
      <p className={row}>
        <Clock className={icon} aria-hidden />
        <span className="line-clamp-2">{schedule || 'ไม่ระบุวันเวลาทำงาน'}</span>
      </p>
      {incomeShown || average !== null ? (
        <p className={cn(row, 'flex-wrap gap-y-0.5')}>
          <Banknote className={icon} aria-hidden />
          {incomeShown ? (
            income ? (
              <span className="tabular-nums text-foreground" title={staff ? (income.hint ?? undefined) : undefined}>
                ฐานเงินเดือน {income.text}
              </span>
            ) : (
              <span className={staff ? TONE.warn.value : undefined}>ยังไม่ตั้งรายได้</span>
            )
          ) : null}
          {incomeShown && average !== null ? <span aria-hidden>·</span> : null}
          {average !== null ? (
            <span className="tabular-nums">รายได้เฉลี่ย {NUM.format(average)} บาท/เดือน</span>
          ) : null}
        </p>
      ) : null}
      {pay ? (
        <p className={row}>
          <Wallet className={icon} aria-hidden />
          <span>{pay}</span>
        </p>
      ) : null}
      {/* เรียงลงทีละบรรทัด (เจ้าของ 5 ต.ค. 2569: *"ให้มันเรียงลงไม่ใช่วางกองๆกันเละเทะ"*) */}
      {benefits.length > 0 ? (
        <div className={row} data-testid="job-public-benefits">
          <Gift className={icon} aria-hidden />
          <ul className="min-w-0 space-y-0.5">
            {benefits.map((b) => (
              <li key={b} className="text-foreground">
                {b}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className={row}>
        <UserRound className={icon} aria-hidden />
        <span className={cn(staff && !gender.known && TONE.warn.value)}>{gender.text}</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{boardCardAge(job)}</span>
      </p>
      {requiredDate || boss ? (
        <p className={cn(row, 'flex-wrap gap-x-3 gap-y-0.5')}>
          {requiredDate ? (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4 shrink-0" aria-hidden />
              ต้องการ {formatYmdDmyBe(requiredDate)}
            </span>
          ) : null}
          {boss ? (
            <span className="inline-flex items-center gap-1.5">
              <Flag className="h-4 w-4 shrink-0" aria-hidden />
              นายสัญชาติ {boss}
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
