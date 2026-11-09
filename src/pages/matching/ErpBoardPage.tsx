import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, ListChecks, LoaderCircle, MessageSquare, Phone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import PageHeader from '@/components/shared/PageHeader';
import SearchField from '@/components/shared/SearchField';
import LoadErrorNotice from '@/components/shared/LoadErrorNotice';
import NameAvatar from '@/components/shared/NameAvatar';
import { FieldSelect, type FieldSelectOption } from '@/components/shared/FieldSelect';
import ErpBoardCardDialog from '@/components/matching/ErpBoardCardDialog';
import ErpBoardDashboard from '@/components/matching/ErpBoardDashboard';
import { ErpBoardStepLine, ErpBoardTagBadge } from '@/components/matching/ErpBoardBits';
import { useHeaderSearch } from '@/hooks/useHeaderSearch';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/apiFetch';
import { friendlyErrorText } from '@/lib/friendlyError';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import {
  EMPTY_ERP_BOARD_FILTERS,
  ERP_BOARD_READONLY_HINT,
  NO_ASSIGNEE,
  NO_STEP,
  assigneeOptions,
  cardsByColumn,
  erpBoardFilterCount,
  erpCardPosition,
  filterErpBoardCards,
  groupDaysByMonth,
  postErpBoardAction,
  type ErpBoardActionBody,
  type ErpBoardCard,
  type ErpBoardFilters,
  type ErpBoardLinkFilter,
  type ErpBoardOverview,
} from '@/lib/erpBoard';

/**
 * ═══ รายชื่อรอลงงาน = บอร์ดของ ERP (เจ้าของ 2 พ.ย. 2569 "เอาแบบนี้ เริ่มช่วง 1 เลย") ═══
 * หน้าตาตามแบบร่าง 2: แถบซ้ายเดือน → วัน · ตัวกรองแท็ก/ผู้ดูแล/ขั้นตอน/ผูกใบขอ · 8 ช่อง · ป๊อปการ์ด · Board/Dashboard
 * 3 พ.ย. 2569 ปุ่มบนการ์ด/ป๊อปกดได้แล้ว — จดฝั่ง Jarvis (บัญชี ERP อ่านอย่างเดียว) · หน้ารายชื่อเดิมยังเปิดได้ที่ ?view=list
 */
const CARDS_PER_COLUMN = 30;

type Selection = { kind: 'day'; itemId: number } | { kind: 'month'; key: string } | null;

function parseSelection(sp: URLSearchParams): Selection {
  const day = Number(sp.get('day'));
  if (Number.isInteger(day) && day > 0) return { kind: 'day', itemId: day };
  const month = sp.get('month');
  if (month && /^\d{4}-\d{2}$/.test(month)) return { kind: 'month', key: month };
  return null;
}

const ErpBoardPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<ErpBoardOverview | null>(null);
  const [cards, setCards] = useState<ErpBoardCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [filters, setFilters] = useState<ErpBoardFilters>(EMPTY_ERP_BOARD_FILTERS);
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [shown, setShown] = useState<Record<number, number>>({});
  const [openCard, setOpenCard] = useState<number | null>(null);
  const view = searchParams.get('tab') === 'dashboard' ? 'dashboard' : 'board';

  const months = useMemo(() => groupDaysByMonth(overview?.days ?? []), [overview]);
  const selection: Selection = useMemo(() => {
    const s = parseSelection(searchParams);
    if (s) return s;
    const latest = months[0]?.days[0];
    return latest ? { kind: 'day', itemId: latest.itemId } : null;
  }, [searchParams, months]);
  const selectedMonthKey =
    selection?.kind === 'month' ? selection.key : months.find((m) => m.days.some((d) => selection?.kind === 'day' && d.itemId === selection.itemId))?.key;
  const selectedLabel = useMemo(() => {
    if (!selection) return '';
    if (selection.kind === 'month') {
      const m = months.find((x) => x.key === selection.key);
      return m ? `${m.label} · ${m.cards} คน` : '';
    }
    const d = overview?.days.find((x) => x.itemId === selection.itemId);
    return d ? `${d.label} · ${d.cards} คน` : '';
  }, [selection, months, overview]);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/matching/board?overview=1')
      .then(async (r) => {
        if (!r.ok) throw new Error('โหลดบอร์ดไม่สำเร็จ');
        const d = (await r.json()) as ErpBoardOverview;
        if (!cancelled) setOverview(d);
      })
      .catch((e) => !cancelled && setError(friendlyErrorText(e, 'โหลดบอร์ดไม่สำเร็จ')));
    return () => {
      cancelled = true;
    };
  }, [rev]);

  const selectionKey = selection ? (selection.kind === 'day' ? `day:${selection.itemId}` : `month:${selection.key}`) : '';
  useEffect(() => {
    if (!overview || !selection) return;
    let cancelled = false;
    setCards(null);
    setShown({});
    const m = selection.kind === 'month' ? months.find((x) => x.key === selection.key) : null;
    const qs = selection.kind === 'day' ? `item=${selection.itemId}` : `from=${m?.from ?? `${selection.key}-01`}&to=${m?.to ?? `${selection.key}-31`}`;
    apiFetch(`/api/matching/board?${qs}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('โหลดรายชื่อไม่สำเร็จ');
        const d = (await r.json()) as { cards?: ErpBoardCard[] };
        if (!cancelled) setCards(d.cards ?? []);
      })
      .catch((e) => !cancelled && setError(friendlyErrorText(e, 'โหลดรายชื่อไม่สำเร็จ')));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- โหลดใหม่เมื่อเปลี่ยนวัน/เดือนเท่านั้น
  }, [overview, selectionKey, rev]);

  const pick = (next: Selection) => {
    const sp = new URLSearchParams(searchParams);
    sp.delete('day');
    sp.delete('month');
    if (next?.kind === 'day') sp.set('day', String(next.itemId));
    if (next?.kind === 'month') sp.set('month', next.key);
    setSearchParams(sp, { replace: true });
  };
  const setView = (v: string) => {
    const sp = new URLSearchParams(searchParams);
    if (v === 'dashboard') sp.set('tab', 'dashboard');
    else sp.delete('tab');
    setSearchParams(sp, { replace: true });
  };

  /** การ์ดหลังกดปุ่ม — แทนใบเดิมในรายการทันที (ย้ายช่องก็ย้ายบนจอเลย) */
  const replaceCard = (next: ErpBoardCard) => setCards((list) => (list ? list.map((c) => (c.cardId === next.cardId ? next : c)) : list));
  const act = async (cardId: number, body: ErpBoardActionBody, done: string) => {
    try {
      const d = await postErpBoardAction(cardId, body);
      replaceCard(d.card);
      toast.success(done);
    } catch (e) {
      toast.error(friendlyErrorText(e, 'บันทึกไม่สำเร็จ'));
    }
  };

  const filtered = useMemo(() => filterErpBoardCards(cards ?? [], filters), [cards, filters]);
  const columns = useMemo(() => cardsByColumn(overview?.columns ?? [], filtered), [overview, filtered]);
  const people = useMemo(() => assigneeOptions(cards ?? []), [cards]);
  const filterCount = erpBoardFilterCount(filters);

  const searchInHeader = useHeaderSearch({
    value: filters.q,
    onChange: (q) => setFilters((f) => ({ ...f, q })),
    placeholder: 'ค้นชื่อ / เบอร์',
  });

  const dayOptions: FieldSelectOption[] = months.flatMap((m) => [
    { value: `month:${m.key}`, label: `ทั้งเดือน · ${m.cards} คน`, group: m.label },
    ...m.days.map((d) => ({ value: `day:${d.itemId}`, label: `${d.label} · ${d.cards} คน`, group: m.label })),
  ]);
  const tagOptions: FieldSelectOption[] = [{ value: '', label: 'ทุกแท็ก' }, ...(overview?.tags ?? []).map((t) => ({ value: t.label, label: t.label }))];
  const assigneeOpts: FieldSelectOption[] = [
    { value: '', label: 'ทุกคน' },
    { value: NO_ASSIGNEE, label: 'ยังไม่มีผู้ดูแล' },
    ...people.map((p) => ({ value: p.name, label: `${p.name} · ${p.count}` })),
  ];
  const stepOptions: FieldSelectOption[] = [
    { value: '', label: 'ทุกขั้นตอน' },
    { value: NO_STEP, label: 'ยังไม่มีสถานะ' },
    ...(overview?.steps ?? []).map((s) => ({ value: s.label, label: `${s.seq}. ${s.label}` })),
  ];
  const linkOptions: FieldSelectOption[] = [
    { value: 'all', label: 'ผูกใบขอ / ยังไม่ผูก' },
    { value: 'linked', label: 'ผูกใบขอแล้ว' },
    { value: 'unlinked', label: 'ยังไม่ผูกใบขอ' },
  ];

  return (
    <div className="relative">
      <PageHeader
        title="รายชื่อรอลงงาน"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {searchInHeader ? null : (
              <SearchField
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                placeholder="ค้นชื่อ / เบอร์"
                wrapperClassName="w-full sm:w-64"
              />
            )}
            <Tabs value={view} onValueChange={setView}>
              <TabsList>
                <TabsTrigger value="board">บอร์ด</TabsTrigger>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" disabled title={ERP_BOARD_READONLY_HINT} data-testid="erp-board-import">
              <Plus aria-hidden /> นำเข้าจากผู้สมัคร
            </Button>
          </div>
        }
      />
      <div className="flex gap-4 px-4 pb-8 md:px-6">
        {/* แถบซ้ายแบบ ERP: เดือน → วัน (จอใหญ่) */}
        <aside className="hidden w-60 shrink-0 lg:block" data-testid="erp-board-tree">
          <p className={cn(DASH.label, 'mb-2')}>{overview?.boardName ?? 'บอร์ด'}</p>
          <div className={cn(DASH.card, 'flex items-center justify-between px-3 py-2')}>
            <span className={DASH.title}>ทั้งบอร์ด</span>
            <span className="text-sm font-medium tabular-nums">{(overview?.total ?? 0).toLocaleString()}</span>
          </div>
          <div className="mt-2 space-y-1">
            {months.map((m) => {
              const open = openMonths[m.key] ?? m.key === selectedMonthKey;
              const monthActive = selection?.kind === 'month' && selection.key === m.key;
              return (
                <Collapsible key={m.key} open={open} onOpenChange={(o) => setOpenMonths((x) => ({ ...x, [m.key]: o }))}>
                  <div className="flex items-center gap-1">
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={open ? `หุบ ${m.label}` : `กาง ${m.label}`}>
                        {open ? <ChevronDown /> : <ChevronRight />}
                      </Button>
                    </CollapsibleTrigger>
                    <Button
                      variant={monthActive ? 'secondary' : 'ghost'}
                      size="sm"
                      className="h-7 flex-1 justify-between px-2 font-normal"
                      onClick={() => pick({ kind: 'month', key: m.key })}
                    >
                      <span>{m.label}</span>
                      <span className="tabular-nums text-muted-foreground">{m.cards}</span>
                    </Button>
                  </div>
                  <CollapsibleContent className="space-y-0.5 pl-8">
                    {m.days.map((d) => {
                      const active = selection?.kind === 'day' && selection.itemId === d.itemId;
                      return (
                        <Button
                          key={d.itemId}
                          variant={active ? 'secondary' : 'ghost'}
                          size="sm"
                          className={cn('h-7 w-full justify-between px-2 font-normal', active && 'font-medium')}
                          onClick={() => pick({ kind: 'day', itemId: d.itemId })}
                          data-testid={`erp-board-day-${d.itemId}`}
                        >
                          <span className="flex items-center gap-1.5">
                            <CalendarDays aria-hidden />
                            {d.label}
                          </span>
                          <span className="tabular-nums text-muted-foreground">{d.cards}</span>
                        </Button>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-3">
          {error ? (
            <LoadErrorNotice
              message={error}
              onRetry={() => {
                setError(null);
                setRev((n) => n + 1);
              }}
            />
          ) : null}

          {/* ตัวกรอง — วัน (จอเล็กเลือกจากรายการ จอใหญ่กดแถบซ้าย) · แท็ก · ผู้ดูแล · ขั้นตอน · ผูกใบขอ */}
          <div className="flex flex-wrap items-center gap-2" data-testid="erp-board-filters">
            <Badge className="hidden h-9 rounded-lg px-3 text-sm lg:inline-flex" data-testid="erp-board-selected">
              {selectedLabel || '—'}
            </Badge>
            <div className="w-full sm:w-56 lg:hidden">
              <FieldSelect
                value={selectionKey}
                onChange={(v) => {
                  const [kind, id] = v.split(':');
                  pick(kind === 'month' ? { kind: 'month', key: id } : { kind: 'day', itemId: Number(id) });
                }}
                options={dayOptions}
                ariaLabel="เลือกวัน"
              />
            </div>
            <div className="min-w-28 flex-1 sm:w-36 sm:flex-none">
              <FieldSelect value={filters.tag ?? ''} onChange={(v) => setFilters((f) => ({ ...f, tag: v || null }))} options={tagOptions} ariaLabel="แท็ก" />
            </div>
            <div className="min-w-28 flex-1 sm:w-40 sm:flex-none">
              <FieldSelect value={filters.assignee ?? ''} onChange={(v) => setFilters((f) => ({ ...f, assignee: v || null }))} options={assigneeOpts} ariaLabel="ผู้ดูแล" />
            </div>
            <div className="min-w-28 flex-1 sm:w-48 sm:flex-none">
              <FieldSelect value={filters.step ?? ''} onChange={(v) => setFilters((f) => ({ ...f, step: v || null }))} options={stepOptions} ariaLabel="ขั้นตอน" />
            </div>
            <div className="min-w-28 flex-1 sm:w-44 sm:flex-none">
              <FieldSelect value={filters.link} onChange={(v) => setFilters((f) => ({ ...f, link: v as ErpBoardLinkFilter }))} options={linkOptions} ariaLabel="ผูกใบขอ" />
            </div>
            {filterCount > 0 || filters.q ? (
              <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_ERP_BOARD_FILTERS)}>
                ล้างตัวกรอง
              </Button>
            ) : null}
            {cards ? (
              <span className={cn(DASH.sub, 'ml-auto tabular-nums')} data-testid="erp-board-count">
                {filtered.length === cards.length ? `${cards.length} คน` : `${filtered.length} จาก ${cards.length} คน`}
              </span>
            ) : null}
          </div>

          {!cards && !error ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> กำลังโหลดบอร์ด…
            </p>
          ) : null}

          {cards && view === 'dashboard' ? <ErpBoardDashboard overview={overview} cards={filtered} /> : null}

          {cards && view === 'board' ? (
            <div className="flex gap-3 overflow-x-auto pb-2" data-testid="erp-board-columns">
              {columns.map(({ column, cards: list }) => {
                if (collapsed[column.id]) {
                  return (
                    <div key={column.id} className="flex w-12 shrink-0 flex-col items-center gap-2 rounded-xl bg-muted/60 py-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed((x) => ({ ...x, [column.id]: false }))} aria-label={`กาง ${column.label}`}>
                        <ChevronsRight />
                      </Button>
                      <span className="text-xs font-medium tabular-nums">{list.length}</span>
                      <span className="text-xs font-medium [writing-mode:vertical-rl]">{column.label}</span>
                    </div>
                  );
                }
                const limit = shown[column.id] ?? CARDS_PER_COLUMN;
                return (
                  <section
                    key={column.id}
                    className={cn('w-72 shrink-0 space-y-2 rounded-xl p-2', column.isDone ? TONE.success.wash : 'bg-muted/60')}
                    data-testid={`erp-board-column-${column.id}`}
                  >
                    <header className="flex items-center justify-between px-1">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {column.label}
                        <Badge variant="secondary" className="tabular-nums">
                          {list.length}
                        </Badge>
                      </span>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCollapsed((x) => ({ ...x, [column.id]: true }))} aria-label={`หุบ ${column.label}`}>
                        <ChevronsLeft />
                      </Button>
                    </header>
                    {list.length === 0 ? <p className={cn(DASH.sub, 'py-6 text-center')}>ไม่มีคน</p> : null}
                    {list.slice(0, limit).map((c) => (
                      <ErpBoardCardTile key={c.cardId} card={c} overview={overview} onOpen={() => setOpenCard(c.cardId)} onAction={(body, done) => void act(c.cardId, body, done)} />
                    ))}
                    {list.length > limit ? (
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setShown((x) => ({ ...x, [column.id]: limit + CARDS_PER_COLUMN }))}>
                        ดูเพิ่ม · เหลืออีก {list.length - limit} คน
                      </Button>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <ErpBoardCardDialog cardId={openCard} overview={overview} onClose={() => setOpenCard(null)} onChanged={replaceCard} />
    </div>
  );
};

function ErpBoardCardTile({
  card: c,
  overview,
  onOpen,
  onAction,
}: {
  card: ErpBoardCard;
  overview: ErpBoardOverview | null;
  onOpen: () => void;
  onAction: (body: ErpBoardActionBody, done: string) => void;
}) {
  const checklistTotal = overview?.checklist.length ?? 0;
  return (
    <article className={cn(DASH.card, 'space-y-1.5 p-3')} data-testid={`erp-board-card-${c.cardId}`}>
      <Button
        type="button"
        variant="ghost"
        onClick={onOpen}
        className="h-auto w-full flex-col items-stretch gap-1 whitespace-normal rounded-lg p-0 text-left font-normal hover:bg-transparent"
      >
        <p className={cn(DASH.cellStrong, 'text-sm')}>{c.title}</p>
        <p className={DASH.sub}>ตำแหน่ง: {erpCardPosition(c)}</p>
        <p className={DASH.sub}>
          ไซต์งาน: <span className={DASH.cell}>{c.site ?? '—'}</span>
        </p>
        <ErpBoardStepLine card={c} />
      </Button>
      {c.tags.length ? (
        <div className="flex flex-wrap gap-1">
          {c.tags.map((t) => (
            <ErpBoardTagBadge key={t} label={t} />
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {c.assignees.map((a) => (
          <NameAvatar key={a} name={a} />
        ))}
        <span className={cn('inline-flex items-center gap-1', c.calls ? DASH.cell : DASH.sub)}>
          <Phone className="h-3.5 w-3.5" aria-hidden />
          {c.calls ? `โทรแล้ว ${c.calls} ครั้ง` : 'ยังไม่โทร'}
        </span>
        <span className={cn('inline-flex items-center gap-1 tabular-nums', c.checklistDone && c.checklistDone >= checklistTotal ? TONE.success.value : DASH.sub)}>
          <ListChecks className="h-3.5 w-3.5" aria-hidden />
          {c.checklistDone}/{checklistTotal}
        </span>
      </div>
      {c.requestNos.length ? (
        <div className="flex flex-wrap gap-1">
          {c.requestNos.map((r) => (
            <Badge key={r} variant="outline" className="tabular-nums">
              {r}
            </Badge>
          ))}
        </div>
      ) : (
        <p className={cn('text-xs', TONE.danger.value)}>ยังไม่ผูกใบขอ</p>
      )}
      {c.lastComment ? (
        <p className={cn(DASH.sub, 'flex items-start gap-1')}>
          <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="line-clamp-1">
            {c.comments} · {c.lastComment}
          </span>
        </p>
      ) : null}
      <div className={cn('flex flex-wrap gap-1 border-t pt-1.5', DASH.divider)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
              + ผู้ดูแล
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
            {(overview?.staff ?? []).map((s) => {
              const on = c.assigneeIds.includes(s.id);
              return (
                <DropdownMenuCheckboxItem
                  key={s.id}
                  checked={on}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => onAction({ action: on ? 'unassign' : 'assign', staffId: s.id }, on ? `เอา ${s.name} ออกแล้ว` : `มอบหมายให้ ${s.name} แล้ว`)}
                >
                  {s.name}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={() => onAction({ action: 'call' }, 'บันทึกการโทรแล้ว')}>
          บันทึกการโทร
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
              แท็ก
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {(overview?.tags ?? []).map((t) => {
              const on = c.tagIds.includes(t.id);
              return (
                <DropdownMenuCheckboxItem
                  key={t.id}
                  checked={on}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={() => onAction({ action: on ? 'untag' : 'tag', tagId: t.id }, on ? `เอาแท็ก ${t.label} ออกแล้ว` : `ติดแท็ก ${t.label} แล้ว`)}
                >
                  {t.label}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </article>
  );
}

export default ErpBoardPage;
