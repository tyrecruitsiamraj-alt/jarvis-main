import { useState, type ReactNode } from 'react';
import { ArrowRight, Bot, Eye, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * ═══ ตารางคนของเราในป๊อปจับคู่ (โฉมใหม่ · เจ้าของ 26 พ.ย. 2569) ═══
 * รอบ 1 Choice "ทำตามแบบร่าง ถอดตามนี้": คนละ 1 แถว · แท็บ ยังไม่โทร / โทรแล้ว
 * รอบ 2 เจ้าของ "ปุ่ม AI โทรอะไรไม่รู้เยอะแยะไปหมดงง … ทำให้มันดูง่าย ๆ แบบหน้าผู้สมัคร":
 *   ปุ่มแบบหน้าผู้สมัคร (`RmSearchBar` + `RmTable`) — เหนือตาราง "เก็บไปโทรเอง (n)" · "ส่ง AI โทร (n)" สำหรับคนที่ติ๊ก
 *   ทุกแถวมีปุ่มเดียวกันของคนนั้น + ดูรายละเอียด · สีและไอคอนชุดเดียวกับหน้าผู้สมัคร
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
  /** มีเบอร์มือถือ — ไม่มี = ติ๊ก/เก็บ/ส่งไม่ได้ */
  selectable: boolean;
  selected: boolean;
  /** มีคนรับไปตามอยู่ (ชื่อคน) — เก็บซ้ำ/ส่ง AI ทับไม่ได้ */
  heldBy: string | null;
};

const NEAR_TONE = ['success', 'info', 'neutral', 'warn', 'warn'] as const;
/** หน้าการติดต่อ (คนที่เก็บไปโทรเองอยู่ที่นี่) — ลิงก์เดียวกับเมนู */
const CONTACT_PAGE_PATH = '/jobs/board?view=contact';

type Tab = 'todo' | 'called';

export default function MatchPeopleTable({
  rows,
  selectedCount,
  busy,
  onToggle,
  onToggleMany,
  onOpen,
  onHoldSelected,
  onSendSelected,
  onHoldOne,
  onSendOne,
  renderCall,
}: {
  rows: readonly MatchPersonRow[];
  /** ติ๊กไว้ทั้งหมดในป๊อป (รวมคนที่ยังไม่สมัครข้างล่าง) — ตัวเลขบนปุ่มเหนือตาราง */
  selectedCount: number;
  busy: boolean;
  onToggle: (id: number) => void;
  onToggleMany: (ids: number[], on: boolean) => void;
  onOpen: (id: number) => void;
  onHoldSelected: () => void;
  /** ยิงสายจริง — ผู้เรียกเปิดป๊อปยืนยันรายชื่อก่อนเสมอ */
  onSendSelected: () => void;
  onHoldOne: (id: number) => void;
  onSendOne: (id: number) => void;
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
  const cols = tab === 'called' ? 9 : 8;
  return (
    <div className="space-y-2" data-testid="match-people-table">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="mr-auto">
          <TabsList>
            <TabsTrigger value="todo" data-testid="match-people-tab-todo">
              ยังไม่โทร <span className="ml-1 tabular-nums">{todo.length.toLocaleString('th-TH')}</span>
            </TabsTrigger>
            <TabsTrigger value="called" data-testid="match-people-tab-called">
              โทรแล้ว <span className="ml-1 tabular-nums">{called.length.toLocaleString('th-TH')}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {/* ปุ่มคู่เดียวกับแถบหน้าผู้สมัคร (`RmSearchBar`) — สี/ไอคอน/คำเดียวกัน */}
        <Button
          size="xs"
          type="button"
          onClick={onHoldSelected}
          disabled={selectedCount === 0 || busy}
          title={selectedCount === 0 ? 'ติ๊กเลือกแถวก่อน' : 'ล็อกคนที่ติ๊กเข้าถังโทรของคุณ — AI จะไม่โทรทับ · ไปโทรที่แท็บ "การติดต่อ"'}
          data-testid="match-hold-selected"
        >
          <Phone aria-hidden />
          เก็บไปโทรเอง{selectedCount > 0 ? ` (${selectedCount.toLocaleString('th-TH')})` : ''}
        </Button>
        <Button
          size="xs"
          variant="outline"
          type="button"
          onClick={onSendSelected}
          disabled={selectedCount === 0 || busy}
          title={selectedCount === 0 ? 'ติ๊กเลือกแถวก่อน' : `ส่ง ${selectedCount} คนให้ AI โทร — มีหน้ายืนยันรายชื่อก่อนโทรจริง`}
          className={TONE.violet.outline}
          data-testid="match-send-selected"
        >
          <Bot aria-hidden />
          ส่ง AI โทร{selectedCount > 0 ? ` (${selectedCount.toLocaleString('th-TH')})` : ''}
        </Button>
        {/* เก็บแล้วไปโทรต่อที่หน้าการติดต่อ (เจ้าของ 27 พ.ย. 2569 "เพิ่มปุ่มให้กดไปหน้าการติดต่อได้ที") */}
        <Button size="xs" variant="ghost" asChild data-testid="match-go-contact">
          <Link to={CONTACT_PAGE_PATH}>
            ไปหน้าการติดต่อ
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
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
              <TableHead className="text-right">ทำต่อ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={cols} className="py-6 text-center text-sm text-muted-foreground">
                  0 คน
                </TableCell>
              </TableRow>
            ) : (
              shown.map((r) => {
                const tone = r.near?.rank != null ? NEAR_TONE[r.near.rank] ?? 'neutral' : 'neutral';
                const blocked = !r.selectable ? 'ไม่มีเบอร์มือถือ' : r.heldBy ? `${r.heldBy} รับไปตามอยู่ · AI จะไม่โทรทับ` : null;
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
                    {/* ปุ่มบนแถวแบบหน้าผู้สมัคร (`RmTable`): เก็บไปโทรเอง (ไอคอน) · ส่ง AI โทร (มีคำ) · ดูรายละเอียด (ไอคอน) */}
                    <TableCell className="px-1.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="iconXs"
                          onClick={() => onHoldOne(r.id)}
                          disabled={Boolean(blocked) || busy}
                          title={blocked ?? 'เก็บไปโทรเอง'}
                          aria-label={`เก็บไปโทรเอง — ${r.name}`}
                          className="rounded-full text-muted-foreground hover:text-foreground"
                        >
                          <Phone aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => onSendOne(r.id)}
                          disabled={Boolean(blocked) || busy}
                          title={blocked ?? 'ส่ง AI โทร — มีหน้ายืนยันก่อนโทรจริง'}
                          aria-label={`ส่ง AI โทร — ${r.name}`}
                          className="rounded-full"
                        >
                          <Bot aria-hidden />
                          ส่ง AI โทร
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="iconXs"
                          onClick={() => onOpen(r.id)}
                          title="ดูรายละเอียด"
                          aria-label={`ดูรายละเอียด — ${r.name}`}
                          className="rounded-full text-muted-foreground hover:text-foreground"
                        >
                          <Eye aria-hidden />
                        </Button>
                      </div>
                    </TableCell>
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
