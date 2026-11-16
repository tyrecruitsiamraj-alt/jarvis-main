import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { BU_COMPARE_COLUMNS, buComparePct, type BuCompareRow } from '@/lib/buCompare';
import TrendDelta from './TrendDelta';

/**
 * ตารางเทียบ BU (เจ้าของ 16 พ.ย. 2569 "BU ไหนเข้ามาเยอะ เข้ามาแล้วติดตรงไหน เทียบทุก Bu ได้") — แถวละ BU + รวม
 * ช่อง = เลข (กดดูรายชื่อ) · % ของขั้นก่อน (ดูว่าติดขั้นไหน) · เพิ่มขึ้น/ลดลงจากช่วงก่อน (BU เดียวกัน ขั้นเดียวกัน)
 * ตรรกะอยู่ `src/lib/buCompare.ts`
 */
export default function BuCompareTable({
  rows,
  total,
  prev,
  onOpen,
}: {
  rows: readonly BuCompareRow[];
  total: BuCompareRow;
  /** ช่วงก่อน (key แถว → แถว) · null = เทียบไม่ได้ */
  prev: ReadonlyMap<string, BuCompareRow> | null;
  onOpen: (title: string, ids: readonly string[]) => void;
}) {
  const line = (r: BuCompareRow, strong = false) => {
    const before = prev ? (prev.get(r.key) ?? null) : null;
    return (
      <TableRow key={r.key} className={cn(strong && 'bg-muted/40')} data-testid={`bu-compare-row-${r.key}`}>
        <TableCell className={cn('sticky left-0 z-10 whitespace-nowrap bg-card text-sm', strong && 'bg-muted font-medium')}>{r.label}</TableCell>
        {BU_COMPARE_COLUMNS.map((c) => {
          const cell = r.cells[c.key];
          const p = buComparePct(r, c.key);
          const canOpen = cell.value > 0 && cell.ids.length > 0;
          return (
            <TableCell key={c.key} className={cn('text-right align-top text-sm tabular-nums', strong && 'font-medium')}>
              {canOpen ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className={cn('-mr-2 px-2 text-sm tabular-nums', strong ? 'font-medium' : 'font-normal')}
                  onClick={() => onOpen(`${r.label} · ${c.label}`, cell.ids)}
                >
                  {fmt(cell.value)}
                </Button>
              ) : (
                <span className="inline-flex h-7 items-center text-muted-foreground">{fmt(cell.value)}</span>
              )}
              <span className="block min-h-4 text-xs font-normal text-muted-foreground">{p === null ? '' : `${p}%`}</span>
              <span className="block min-h-4">{prev ? <TrendDelta cur={cell.value} prev={before ? before.cells[c.key].value : 0} /> : null}</span>
            </TableCell>
          );
        })}
      </TableRow>
    );
  };

  return (
    <div className="overflow-x-auto" data-testid="bu-compare">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-card text-xs">BU</TableHead>
            {BU_COMPARE_COLUMNS.map((c) => {
              const of = BU_COMPARE_COLUMNS.find((x) => x.key === c.of);
              return (
                <TableHead key={c.key} className="whitespace-nowrap text-right align-bottom text-xs">
                  <span className="block">{c.label}</span>
                  <span className="block font-normal text-muted-foreground">{of ? `% ของ${of.label}` : ' '}</span>
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => line(r))}
          {line(total, true)}
        </TableBody>
      </Table>
    </div>
  );
}
