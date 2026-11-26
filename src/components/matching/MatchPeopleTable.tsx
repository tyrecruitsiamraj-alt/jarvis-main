import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * ═══ ตารางคนของเราในป๊อปจับคู่ (โฉมใหม่ · เจ้าของ 26 พ.ย. 2569 Choice "ทำตามแบบร่าง ถอดตามนี้") ═══
 * เดิมคนละการ์ด ป้าย 7–8 อัน + ประโยคอธิบายซ้ำกับป้าย ⇒ คนละ 1 แถว คอลัมน์ตามที่ต้องใช้ตัดสินว่าจะโทรใคร
 * แท็บ ยังไม่โทร / โทรแล้ว (โทรแล้ว = เคยส่ง AI โทรในใบนี้) · ลำดับคนมาจากหน้า (น้ำหนักความสำคัญเดิม)
 * ติ๊กแล้วใช้แถบปุ่มเดิมท้ายป๊อป (เก็บไปโทรเอง · ส่ง AI โทร)
 */
export type MatchPersonRow = {
  id: number;
  name: string;
  age: number | null;
  home: string | null;
  /** ใกล้งานแค่ไหน · rank 0 อำเภอเดียวกัน · 1 จังหวัดเดียวกัน · 2 ภาคเดียวกัน · 3–4 ไกล · null = ไม่รู้ระดับ (ป้ายสาขา) */
  near: { label: string; rank: number | null } | null;
  salary: number | null;
  salaryOver: boolean;
  state: string | null;
  called: boolean;
  selectable: boolean;
  selected: boolean;
};

const NEAR_TONE = ['success', 'info', 'neutral', 'warn', 'warn'] as const;

type Tab = 'todo' | 'called';

export default function MatchPeopleTable({
  rows,
  onToggle,
  onToggleMany,
  onOpen,
  renderCall,
}: {
  rows: readonly MatchPersonRow[];
  onToggle: (id: number) => void;
  onToggleMany: (ids: number[], on: boolean) => void;
  onOpen: (id: number) => void;
  /** ผลโทรของคนนั้น (ป้ายผล + ยกเลิกการส่ง) — ใช้ตัวเดียวกับโฉมเดิม */
  renderCall: (id: number) => ReactNode;
}) {
  const [tab, setTab] = useState<Tab>('todo');
  const todo = rows.filter((r) => !r.called);
  const called = rows.filter((r) => r.called);
  const shown = tab === 'todo' ? todo : called;
  const pickable = shown.filter((r) => r.selectable);
  const allOn = pickable.length > 0 && pickable.every((r) => r.selected);
  const someOn = !allOn && pickable.some((r) => r.selected);
  return (
    <div className="space-y-2" data-testid="match-people-table">
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="todo" data-testid="match-people-tab-todo">
            ยังไม่โทร <span className="ml-1 tabular-nums">{todo.length.toLocaleString('th-TH')}</span>
          </TabsTrigger>
          <TabsTrigger value="called" data-testid="match-people-tab-called">
            โทรแล้ว <span className="ml-1 tabular-nums">{called.length.toLocaleString('th-TH')}</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allOn ? true : someOn ? 'indeterminate' : false}
                  disabled={pickable.length === 0}
                  onCheckedChange={(v) => onToggleMany(pickable.map((r) => r.id), v === true)}
                  aria-label="เลือกทุกคนในแท็บนี้"
                />
              </TableHead>
              <TableHead>ชื่อ</TableHead>
              <TableHead>อายุ</TableHead>
              <TableHead>บ้าน</TableHead>
              <TableHead>ใกล้งาน</TableHead>
              <TableHead>ขอเงินเดือน</TableHead>
              <TableHead>ตอนนี้</TableHead>
              {tab === 'called' ? <TableHead>ผลโทร</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={tab === 'called' ? 8 : 7} className="py-6 text-center text-sm text-muted-foreground">
                  0 คน
                </TableCell>
              </TableRow>
            ) : (
              shown.map((r) => {
                const tone = r.near?.rank != null ? NEAR_TONE[r.near.rank] ?? 'neutral' : 'neutral';
                return (
                  <TableRow key={r.id} data-state={r.selected ? 'selected' : undefined} data-testid={`match-person-${r.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={r.selected}
                        disabled={!r.selectable}
                        onCheckedChange={() => onToggle(r.id)}
                        aria-label={`เลือก ${r.name}`}
                        title={r.selectable ? undefined : 'ไม่มีเบอร์มือถือ'}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => onOpen(r.id)}
                        className="h-auto whitespace-normal p-0 text-left font-medium text-foreground"
                      >
                        {r.name}
                      </Button>
                    </TableCell>
                    <TableCell className="tabular-nums">{r.age ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{r.home ?? 'ไม่รู้'}</TableCell>
                    <TableCell>
                      {r.near ? (
                        <span className={cn('whitespace-nowrap', TONE[tone].chip)}>{r.near.label}</span>
                      ) : (
                        <span className="text-muted-foreground">ไม่รู้</span>
                      )}
                    </TableCell>
                    <TableCell className={cn('whitespace-nowrap tabular-nums', r.salaryOver && TONE.warn.value)}>
                      {r.salary ? r.salary.toLocaleString('th-TH') : '—'}
                      {r.salaryOver ? ' · ขอเกิน' : ''}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.state ?? '—'}</TableCell>
                    {tab === 'called' ? <TableCell className="min-w-40">{renderCall(r.id)}</TableCell> : null}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
