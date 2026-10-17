import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { PDPA_POLICY, PDPA_POLICY_TITLE, PDPA_POLICY_URL } from '@/lib/pdpaConsent';

/**
 * ช่องติ๊กยินยอม PDPA (เจ้าของ 15 ต.ค. 2569) — ตัวเดียวทั้งหน้าสมัคร · เพิ่มข้อมูลผู้สมัคร · นำเข้า Excel
 * 🔴 17 ต.ค. 2569 เจ้าของ "Pdpa ต้องมีข้อความอันนี้ให้อ่านด้วย": "ข้าพเจ้าได้อ่านและยอมรับ <ข้อตกลง…>" กดชื่อข้อตกลงแล้ว
 * **กางข้อความเต็มลงมาในฟอร์ม** — ทั้ง 3 ฟอร์มอยู่ในป๊อปอยู่แล้ว ห้ามเปิดป๊อปซ้อนป๊อป · ข้อความอยู่ `src/lib/pdpaConsent.ts` ที่เดียว
 * ⚠️ ชื่อข้อตกลงเป็นปุ่มแยก ไม่อยู่ใน label — กดอ่านแล้วต้องไม่ติ๊กให้เอง
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
  /** คำนำหน้าชื่อข้อตกลง เช่น "ข้าพเจ้าได้อ่านและยอมรับ" */
  text: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  return (
    <div className={cn('space-y-2', className)} data-testid="pdpa-consent">
      <div className="flex items-start gap-2 text-sm text-foreground">
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onChange(v === true)}
          className="mt-0.5"
          aria-label={`${text} ${PDPA_POLICY_TITLE}`}
        />
        <p className="leading-relaxed">
          <label htmlFor={id} className="cursor-pointer">
            {text}
          </label>{' '}
          {PDPA_POLICY_URL ? (
            <a href={PDPA_POLICY_URL} target="_blank" rel="noreferrer" className="text-primary underline">
              {PDPA_POLICY_TITLE}
            </a>
          ) : (
            <Button
              type="button"
              variant="link"
              className="h-auto whitespace-normal p-0 text-left align-baseline text-sm underline"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {PDPA_POLICY_TITLE}
            </Button>
          )}
        </p>
      </div>
      {open ? (
        <div className="max-h-72 space-y-3 overflow-y-auto rounded-xl border bg-muted/30 p-4 text-sm text-foreground" data-testid="pdpa-policy">
          <p className="leading-relaxed">{PDPA_POLICY.intro}</p>
          {PDPA_POLICY.sections.map((s) => (
            <section key={s.title} className="space-y-1.5">
              <h4 className="font-medium text-primary">{s.title}</h4>
              {s.intro ? <p className="leading-relaxed">{s.intro}</p> : null}
              {s.bullets ? (
                <ul className="list-disc space-y-1 pl-5 leading-relaxed">
                  {s.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {s.outro ? <p className="leading-relaxed">{s.outro}</p> : null}
            </section>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            ย่อข้อตกลง
          </Button>
        </div>
      ) : null}
    </div>
  );
}
