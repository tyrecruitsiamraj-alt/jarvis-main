import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import { cn } from '@/lib/utils';

/**
 * ═══ ตัวแบ่งหน้าแบบเดียว ‹ 1/13 › (เจ้าของ Choice 12 ต.ค. 2569 · QA รอบ 2 ข้อ 43 — เดิม 5 แบบ) ═══
 * รูปที่เจ้าของเคาะเองบนหน้าติดตาม: *"แถบหน้า 1 2 3 4 มันเยอะไปทำให้มันแบบเป็น 1/... ได้ไหม"* (5 ต.ค.)
 * + *"เอาเป็น Dropdown ทีมงานบอกขี้เกียจเลื่อนทีละหน้า"* (6 ต.ค.)
 * ซ้าย = แสดงกี่รายการ + ต่อหน้า · ขวา = ‹ [1/13 ▾] › · หน้าเดียวก็ยังอยู่ (ปุ่มกดไม่ได้ · กติกาว่างแล้วห้ามหาย)
 * ใช้บน หน้าหลัก · ติดตาม · งานสรรหา — `page` นับจาก 1
 */
export type PagePagerSize = {
  value: number;
  options: readonly number[];
  /** ต่อท้ายตัวเลขในตัวเลือก เช่น "คน" · ไม่ส่ง = ตัวเลขเปล่า */
  unit?: string;
  onChange: (n: number) => void;
};

export function pagePagerOptions(count: number): Array<{ value: string; label: string }> {
  const n = Math.max(1, count);
  return Array.from({ length: n }, (_, i) => ({ value: String(i + 1), label: `${i + 1}/${n}` }));
}

export function PagePager({
  page,
  pageCount,
  onPageChange,
  summary,
  size,
  disabled = false,
  label = '',
  indicatorTestId = 'page-indicator',
  className,
  testId,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  /** คำซ้ายสุด เช่น "แสดง 1–20 จาก 343" */
  summary?: React.ReactNode;
  size?: PagePagerSize;
  /** กำลังโหลด — ปุ่มเปลี่ยนหน้ากดไม่ได้ */
  disabled?: boolean;
  /** ต่อท้ายชื่อปุ่ม (อ่านออกเสียง) เมื่อมีหลายตัวแบ่งหน้าในจอเดียว เช่น " (รายเดือน)" */
  label?: string;
  indicatorTestId?: string;
  className?: string;
  testId?: string;
}) {
  const count = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), count);
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2', className)} data-testid={testId}>
      <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums text-muted-foreground">
        {summary ? <span>{summary}</span> : null}
        {size ? (
          <span className="flex items-center gap-1.5">
            <span>ต่อหน้า</span>
            <ChoiceDropdown<string>
              value={String(size.value)}
              options={size.options.map((n) => ({ value: String(n), label: size.unit ? `${n} ${size.unit}` : String(n) }))}
              onChange={(v) => size.onChange(Number(v))}
              ariaLabel={`จำนวนต่อหน้า${label}`}
            />
          </span>
        ) : null}
      </div>
      <span className="flex items-center gap-1">
        <Button
          type="button"
          size="iconXs"
          variant="outline"
          aria-label={`หน้าก่อนหน้า${label}`}
          disabled={disabled || current <= 1}
          onClick={() => onPageChange(current - 1)}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <span aria-current="page" data-testid={indicatorTestId}>
          <ChoiceDropdown<string>
            value={String(current)}
            options={pagePagerOptions(count)}
            onChange={(v) => onPageChange(Number(v))}
            ariaLabel={`เลือกหน้า${label}`}
          />
        </span>
        <Button
          type="button"
          size="iconXs"
          variant="outline"
          aria-label={`หน้าถัดไป${label}`}
          disabled={disabled || current >= count}
          onClick={() => onPageChange(current + 1)}
        >
          <ChevronRight aria-hidden />
        </Button>
      </span>
    </div>
  );
}

export default PagePager;
