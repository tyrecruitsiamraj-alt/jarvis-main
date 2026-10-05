import { Button } from '@/components/ui/button';

/**
 * ═══ แถวชิปกรองมีตัวเลข — แบบ C "การ์ดเดิมแต่กระชับ" (เจ้าของเคาะ 5 ต.ค. 2569 · ทุกแท็บของหน้างานสรรหา) ═══
 * แทนกล่องตัวเลขใหญ่ที่เคยซ้อนอยู่หัวแต่ละแท็บ · กดแล้วรายการข้างล่างกรองตาม
 * 🔴 เลข 0 ต้องโชว์ (ว่าง = 0 ห้ามหาย) · `null` = ยังโหลดไม่เสร็จ → "…" (ห้ามขึ้น 0 ปลอม)
 * ปุ่มมาจาก shadcn `Button` (ห้ามปั้นปุ่มเอง) — เลือกอยู่ = default · ไม่ได้เลือก = outline
 */
export type FilterChip<T extends string> = { id: T; label: string; count: number | null };

export default function FilterChips<T extends string>({
  chips,
  value,
  onChange,
  ariaLabel,
}: {
  chips: readonly FilterChip<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={ariaLabel}>
      {chips.map((c) => {
        const active = c.id === value;
        return (
          <Button
            key={c.id}
            type="button"
            size="xs"
            variant={active ? 'default' : 'outline'}
            aria-pressed={active}
            onClick={() => onChange(c.id)}
          >
            {c.label}
            <span className="tabular-nums">{c.count === null ? '…' : c.count.toLocaleString('th-TH')}</span>
          </Button>
        );
      })}
    </div>
  );
}
