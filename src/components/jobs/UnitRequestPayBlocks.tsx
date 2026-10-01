/**
 * ═══ เงินของใบขอ — "อัตราตามใบขอ" + "คนที่ออก / เปลี่ยนตัว" (รายได้จริง 3 เดือน) ═══
 *
 * 🔴 **แหล่งเดียวของสองกล่องนี้** (แยกออกมา 26 ก.ย. 2569) — หน้าใบขอกับป๊อปไล่งาน
 * บนกล่องงานเรียกตัวเดียวกัน · เจ้าของเล่าหลักการทำงาน 26 ก.ย.:
 * > *"ใบขอที่มามันจะยังไม่สมบูรณ์ เพราะงั้นทีม online ควรดูรายละเอียดใบขอนั้น ๆ ได้แบบหน้า
 * >  ใบขอ … คนที่ออกหรือเปลี่ยนตัวมีรายได้ย้อนหลัง 3 เดือนประมาณเท่าไหร่"*
 * เดิมกล่องนี้อยู่ในหน้าใบขอที่เดียว ⇒ คนทำประกาศต้องออกจากป๊อปไปเปิดอีกหน้า
 * (ก๊อปไปวางอีกชุด = วันหน้าแก้ฝั่งเดียวแล้วเลขสองที่ไม่ตรงกัน — บทเรียนซ้ำของบ้านนี้)
 *
 * ⚠️ กติกาที่ติดมา ห้ามแก้เผลอ:
 * - เงินคนเก่ามี **สองชุดคนละเรื่อง**: อัตราตามเงื่อนไข (`hr_staff_changing`) vs จ่ายจริง (eSlip)
 * - รายได้จริง **แยกรายงวด ไม่เฉลี่ย** (เจ้าของสั่ง 25 ส.ค.) · ย้อนหลัง **3 เดือนจริง** (26 ก.ย.)
 * - ไม่รู้ค่า = "—" ห้ามขึ้น 0 · 0 ที่มาจากฐานจริงต้องขึ้น 0
 */
import React from 'react';
import { UserMinus } from 'lucide-react';

import { Field } from '@/components/jobs/UnitRequestInfoFields';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { payPeriodKind, resignCutOf, type PayPeriodKind } from '@/lib/resignedIncome';
import {
  amountText,
  hasDeductSide,
  moneyFieldText,
  resignedIncomeRows,
  visibleRateLines,
} from '@/lib/unitRequestDetail';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';

/** พื้นของกล่องย่อย — ทรงเดียวกับ `Field` (มีคู่โหมดมืด) */
const boxCls =
  'rounded-xl border border-white/70 bg-white/40 p-3 dark:border-white/10 dark:bg-white/[0.03]';
const rowLineCls = 'border-t border-white/60 dark:border-white/10';

const PERIOD_KIND_LABEL: Record<PayPeriodKind, string> = {
  half: 'ครึ่งเดือน',
  month: 'เต็มเดือน',
  partial: 'ไม่เต็มงวด',
};

/**
 * ป้ายท้ายงวด — 🔴 วันที่งวดดูเต็มแต่ **โดนวันออกงานตัด** ต้องบอก (46% ของงวดล่าสุด วัด 26 ก.ย.)
 * ไม่งั้นคนเห็นยอด 3,000 ในงวด "ครึ่งเดือน" แล้วเข้าใจว่าคนเก่าได้เดือนละ 6,000
 */
function periodNote(
  from: string | null,
  to: string | null,
  lastWorkingDay: string | null | undefined,
): { text: string; warn: boolean } | null {
  const cut = resignCutOf({ from, to }, lastWorkingDay);
  if (cut === 'after') return { text: 'จ่ายหลังวันออกงาน', warn: true };
  if (cut === 'mid') return { text: 'ออกกลางงวด', warn: true };
  const kind = payPeriodKind(from, to);
  return kind ? { text: PERIOD_KIND_LABEL[kind], warn: kind === 'partial' } : null;
}

/**
 * ตารางอัตราของใบขอจาก ERP (เจ้าของสั่ง 25 ส.ค. 2569)
 * 🔴 ใบขอหนึ่งใบมีเฉลี่ย 15 บรรทัด · ตัดแถวที่ทั้งจ่ายและเบิกเป็น 0 ทิ้ง
 * แต่บรรทัดค่าจ้างหลักโชว์เสมอ · ไม่มีบรรทัดเลย = ไม่วาดกล่อง
 */
export function RequestRateLinesBlock({ job }: { job: JobRequest }) {
  const lines = visibleRateLines(job);
  if (lines.length === 0) return null;
  return (
    <div className={boxCls}>
      <div className="text-xs font-medium text-foreground">อัตราตามใบขอ (ERP)</div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full table-fixed text-xs">
          <thead>
            <tr className="text-left text-[10px] text-muted-foreground">
              {/* table-fixed + ความกว้างคงที่ — บนมือถือ 375px ตัวเลขทั้งสองคอลัมน์
                  ต้องเห็นครบโดยไม่ต้องเลื่อนแนวนอน (ชื่อรายการตัดบรรทัดเอา) */}
              <th className="w-1/2 pb-1 pr-2 font-medium">รายการ</th>
              <th className="w-1/4 pb-1 pr-2 text-right font-medium">อัตราจ่าย (บาท)</th>
              <th className="w-1/4 pb-1 text-right font-medium">อัตราเบิก (บาท)</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.seq} className={rowLineCls}>
                <td className="break-words py-1 pr-2">
                  {l.fee_name || '—'}
                  {l.is_wage ? (
                    <span className="ml-1 text-[10px] text-muted-foreground">(ค่าจ้างหลัก)</span>
                  ) : null}
                  {l.remark ? <div className="text-[10px] text-muted-foreground">{l.remark}</div> : null}
                </td>
                {/* 0 ที่มาจากฐานจริงต้องขึ้น 0 — ต่างจากไม่มีค่าที่ขึ้น "—" */}
                <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">
                  {amountText(l.payment_rate) ?? '—'}
                </td>
                <td className="whitespace-nowrap py-1 text-right tabular-nums">
                  {amountText(l.draw_rate) ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * คนที่ออก / เปลี่ยนตัว — ชื่อ · สาเหตุ · อัตราตามเงื่อนไข · **รายได้จริงย้อนหลัง 3 เดือน**
 *
 * 🔴 **ต้องบอกที่มา** (เจ้าของถาม 27 ส.ค. 2569: "ดึงมาจากไหน เพราะเหมือนมันไม่ตรง"):
 * ยอด eSlip สุทธิของไซต์นี้เท่านั้น (เมนู ERP PR-4813) · งวดส่วนใหญ่เป็นครึ่งเดือน
 * ⇒ แต่ละแถวติดป้ายชนิดงวด (ครึ่งเดือน/เต็มเดือน/ไม่เต็มงวด) ให้เทียบกับเงินเดือนได้ถูก
 */
export function ResignedEmployeeBlock({
  job,
  compact = false,
}: {
  job: JobRequest;
  /**
   * ป๊อปกล่องงาน (เจ้าของ Choice 1 ต.ค. 2569 "4 ขั้นเดิม แต่ตัดของรก"): ไม่ต้องมีหัวกล่อง (ปุ่มพับเป็นหัวแทน)
   * + ถอดประโยคอธิบายยาว เหลือที่มาสั้น ๆ · หน้าใบขอยังเต็มเหมือนเดิม
   */
  compact?: boolean;
}) {
  const incomeRows = resignedIncomeRows(job);
  const showDeduct = incomeRows ? hasDeductSide(incomeRows) : false;
  const months = job.resigned_income_3m ?? [];
  return (
    <div className={cn(boxCls, 'space-y-2')}>
      {compact ? null : (
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <UserMinus className={cn('h-3.5 w-3.5', TONE.primary.value)} aria-hidden />
          คนที่ออก / เปลี่ยนตัว
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="ชื่อ - นามสกุล" value={job.resigned_employee_name} />
        <Field label="สาเหตุที่ลาออก" value={job.resigned_reason} />
        <Field label="รุ่น/ประเภทรถ" value={job.vehicle_required} />
        {/* วันออกงานตามใบขอ — ตัวที่ใช้ตัด "ออกกลางงวด" ในตารางข้างล่าง ต้องเห็นว่าเอาวันไหนมาตัด
            (คำเดียวกับช่องใน "ข้อมูลใบขอ" — `UnitRequestInfoFields`) */}
        <Field
          label="ทำงานวันสุดท้าย"
          value={job.lastWorkingDay ? formatYmdDmyBe(job.lastWorkingDay) : undefined}
        />
      </div>

      {/* อัตราตามเงื่อนไขของคนคนนี้ — คนละเรื่องกับรายได้จริงข้างล่าง
          🔴 ใช้คำ ERP ตรง ๆ ("ฝั่งจ่าย"/"ฝั่งเบิก") ไม่ตีความว่าฝั่งไหนเป็นเงินของใคร */}
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="อัตราตามเงื่อนไข (ฝั่งจ่าย)" value={moneyFieldText(job.resigned_wage_fee_rate)} />
        <Field label="อัตราตามเงื่อนไข (ฝั่งเบิก)" value={moneyFieldText(job.resigned_wage_draw_rate)} />
        <Field label="อัตรานี้มีผลตั้งแต่" value={job.resigned_wage_effective_date} />
      </div>

      {/* ── รายได้จริงย้อนหลัง 3 เดือน — **แยกรายงวด ไม่ใช่ค่าเฉลี่ย** ── */}
      <div className={boxCls}>
        <div className="text-xs font-medium text-foreground">
          รายได้จริงย้อนหลัง 3 เดือนของงานนี้
          {compact ? <span className="ml-1 font-normal text-muted-foreground">จาก eSlip ของไซต์นี้</span> : null}
        </div>
        {compact ? null : (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            ยอดเดียวกับ<span className="font-medium">ใบแจ้งเงินเดือน (eSlip)</span>
            ของไซต์นี้เท่านั้น — เมนู ERP <span className="font-mono">PR-4813</span> · นับ 3 เดือนย้อนจากงวดล่าสุด
            (งวดครึ่งเดือนจะมี 6 งวด · งวดเต็มเดือนมี 3 งวด)
          </p>
        )}
        {incomeRows ? (
          <table className="mt-2 w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] text-muted-foreground">
                {/* 🔴 คอลัมน์ตามใบแจ้งเงินเดือน — **สุทธิ** คือตัวที่เจ้าของถาม
                    ("ยอดที่เขารับจริง") จึงอยู่ขวาสุดและเด่นกว่า · เงินหักโชว์เฉพาะตอนมีจริง */}
                <th className="pb-1 pr-2 font-medium">งวด</th>
                <th className="pb-1 pr-2 text-right font-medium">เงินได้ (บาท)</th>
                {showDeduct ? <th className="pb-1 pr-2 text-right font-medium">หัก (บาท)</th> : null}
                <th className="pb-1 text-right font-medium">สุทธิ (บาท)</th>
              </tr>
            </thead>
            <tbody>
              {incomeRows.map((r, i) => {
                const note = periodNote(months[i]?.from ?? null, months[i]?.to ?? null, job.lastWorkingDay);
                return (
                  <tr key={r.key} className={rowLineCls}>
                    <td className="break-words py-1 pr-2">
                      {r.period}
                      {note ? (
                        <span
                          className={cn('ml-1 text-[10px]', note.warn ? TONE.warn.value : 'text-muted-foreground')}
                        >
                          ({note.text})
                        </span>
                      ) : null}
                    </td>
                    {/* null = งวดนั้นไม่มีบรรทัดฝั่งนี้ ⇒ "—" ห้ามขึ้น 0 */}
                    <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums">
                      {amountText(r.pay) ?? '—'}
                    </td>
                    {showDeduct ? (
                      <td className="whitespace-nowrap py-1 pr-2 text-right tabular-nums text-muted-foreground">
                        {amountText(r.deduct) ?? '—'}
                      </td>
                    ) : null}
                    <td className="whitespace-nowrap py-1 text-right font-medium tabular-nums text-foreground">
                      {amountText(r.net) ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          // ไม่มีของ ต้องบอกว่าไม่มี ห้ามปล่อยว่างให้คนเดาว่าพัง (414 ใบเข้าเคสนี้หลังกรองไซต์)
          <p className="mt-1 text-xs text-muted-foreground">
            {compact
              ? 'ไม่พบงวดจ่ายในไซต์นี้'
              : 'ไม่พบงวดจ่ายของคนคนนี้ในไซต์ของใบขอนี้ — อาจยังไม่ถึงรอบจ่าย เปิดไซต์ใหม่ (ไม่มีคนเก่า) หรือเงินที่เคยได้มาจากไซต์อื่น'}
          </p>
        )}
        {compact ? null : (
          <p className="mt-1 text-[10px] text-muted-foreground">
            เงินได้ = ค่าแรง · ล่วงเวลา · เบี้ยเลี้ยง รวมกัน · หัก = ภาษี · ประกันสังคม · เงินประกัน · หนี้อื่น —
            งวดแรกหรืองวดสุดท้ายของคนที่เพิ่งเข้า/เพิ่งออกมักไม่เต็มงวด ยอดจึงดูต่ำ
          </p>
        )}
      </div>
    </div>
  );
}
