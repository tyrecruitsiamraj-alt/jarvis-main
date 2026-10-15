import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { PDPA_POLICY_URL } from '@/lib/pdpaConsent';

/**
 * ช่องติ๊กยินยอม PDPA (เจ้าของ 15 ต.ค. 2569) — ตัวเดียวทั้งหน้าสมัคร · เพิ่มข้อมูลผู้สมัคร · นำเข้า Excel
 * ข้อความมาจาก `src/lib/pdpaConsent.ts` ที่เดียว · มีลิงก์นโยบายเมื่อบริษัทส่งมาแล้ว (`PDPA_POLICY_URL`)
 */
export default function PdpaConsentCheck({
  checked,
  onChange,
  text,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  text: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-2 text-sm text-foreground', className)} data-testid="pdpa-consent">
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
        aria-label={text}
      />
      <span>
        {text}
        {PDPA_POLICY_URL ? (
          <>
            {' '}
            <a href={PDPA_POLICY_URL} target="_blank" rel="noreferrer" className="text-primary underline">
              อ่านนโยบาย
            </a>
          </>
        ) : null}
      </span>
    </label>
  );
}
