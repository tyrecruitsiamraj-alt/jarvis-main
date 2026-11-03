import React, { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Phone, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import NameAvatar from '@/components/shared/NameAvatar';
import LoadErrorNotice from '@/components/shared/LoadErrorNotice';
import SearchableSelect from '@/components/shared/SearchableSelect';
import { FieldSelect } from '@/components/shared/FieldSelect';
import DateSelectDmyBe from '@/components/shared/DateSelectDmyBe';
import { ErpBoardStepLine, ErpBoardTagBadge } from '@/components/matching/ErpBoardBits';
import { apiFetch } from '@/lib/apiFetch';
import { friendlyErrorText } from '@/lib/friendlyError';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { fetchSiamrajUnitRequests } from '@/lib/siamrajUnitRequestsApi';
import { jobBoardCardTitle, publicJobPositionLabel } from '@/lib/unitRequestDisplay';
import {
  erpActivityLabel,
  erpCardPosition,
  postErpBoardAction,
  thDate,
  type ErpBoardActionBody,
  type ErpBoardCard,
  type ErpBoardCardDetail,
  type ErpBoardOverview,
} from '@/lib/erpBoard';

/**
 * ป๊อปการ์ดบอร์ดรายชื่อรอลงงาน (แบบร่าง 2 พ.ย. 2569 · ปุ่มกดได้ 3 พ.ย. 2569 จดฝั่ง Jarvis)
 * ซ้าย: ขั้นตอน 7 ขั้น · รายละเอียด · ใบขอที่ผูก · รายการตรวจสอบ · ประวัติขั้นตอน · ลงผลขั้นตอน · ย้ายไปช่อง
 * ขวา: ความคิดเห็น / กิจกรรม + ช่องเขียนความคิดเห็น
 * กติกาปุ่มตาม ERP ตรวจที่เซิร์ฟเวอร์ (api/_lib/erpBoardMerge.ts checkErpBoardAction) — จอแค่ส่งและโชว์ข้อความที่ได้กลับ
 */
const ErpBoardCardDialog: React.FC<{
  cardId: number | null;
  overview: ErpBoardOverview | null;
  onClose: () => void;
  onChanged: (card: ErpBoardCard) => void;
}> = ({ cardId, overview, onClose, onChanged }) => {
  const [detail, setDetail] = useState<ErpBoardCardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    setComment('');
    apiFetch(`/api/matching/board?card=${cardId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('โหลดการ์ดไม่สำเร็จ');
        const d = (await r.json()) as ErpBoardCardDetail;
        if (!cancelled) setDetail(d);
      })
      .catch((e) => !cancelled && setError(friendlyErrorText(e, 'โหลดการ์ดไม่สำเร็จ')));
    return () => {
      cancelled = true;
    };
  }, [cardId, rev]);

  const act = async (body: ErpBoardActionBody, done: string): Promise<boolean> => {
    if (!cardId) return false;
    setBusy(true);
    try {
      const d = await postErpBoardAction(cardId, body);
      setDetail(d);
      onChanged(d.card);
      toast.success(done);
      return true;
    } catch (e) {
      toast.error(friendlyErrorText(e, 'บันทึกไม่สำเร็จ'));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const c = detail?.card;
  const columns = overview?.columns ?? [];
  const column = columns.find((x) => x.id === c?.columnId);
  const steps = overview?.steps ?? [];
  const current = steps.find((s) => s.id === c?.stepId);
  const groups = groupChecklist(detail?.checklist ?? []);
  const done = (detail?.checklist ?? []).filter((x) => x.checked).length;

  const sendComment = async () => {
    if (!comment.trim()) return;
    if (await act({ action: 'comment', body: comment }, 'ส่งความคิดเห็นแล้ว')) setComment('');
  };

  return (
    <Dialog open={cardId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-5xl overflow-y-auto p-0" data-testid="erp-board-card-dialog">
        {error ? (
          <div className="p-6">
            <LoadErrorNotice message={error} onRetry={() => setRev((n) => n + 1)} />
          </div>
        ) : null}
        {!detail && !error ? (
          <p className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> กำลังโหลด…
          </p>
        ) : null}
        {c && detail ? (
          <div className="grid lg:grid-cols-3">
            <div className="space-y-5 p-6 lg:col-span-2">
              <DialogHeader className="space-y-1 text-left">
                <p className={DASH.sub}>
                  {overview?.boardName ?? 'บอร์ด'} › {column?.label ?? '—'}
                </p>
                <DialogTitle className="text-xl">{c.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-1">
                  อัปเดตล่าสุด {thDate(c.lastActivityAt, true)} · <Phone className="h-3.5 w-3.5" aria-hidden />
                  {c.calls ? `โทรแล้ว ${c.calls} ครั้ง` : 'ยังไม่โทร'}
                </DialogDescription>
              </DialogHeader>

              <ol className="pointer-events-none flex flex-wrap gap-1.5" data-testid="erp-board-steps">
                {steps.map((s) => {
                  const isCurrent = current?.id === s.id;
                  const isPast = current ? s.seq < current.seq : false;
                  return (
                    <li
                      key={s.id}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                        isCurrent ? TONE.primary.solid : isPast ? cn(TONE.success.soft, TONE.success.value) : cn(TONE.neutral.soft, TONE.neutral.value),
                      )}
                    >
                      <span className="tabular-nums">{s.seq}</span>
                      {s.label}
                    </li>
                  );
                })}
              </ol>
              <ErpBoardStepLine card={c} />

              <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                <Field label="ตำแหน่ง / ประเภทงาน" value={erpCardPosition(c)} />
                <Field label="ไซต์งาน" value={c.site} />
                <Field label="ผู้ดูแล" value={c.assignees.join(', ') || null} />
                <Field label="เบอร์โทร" value={c.mobile} />
                <Field label="นำเข้าขึ้นบอร์ด" value={thDate(c.createdAt, true)} />
                <Field label={current?.dateLabel ?? 'วันนัด'} value={c.scheduledAt ? thDate(c.scheduledAt) : null} />
              </dl>
              {c.tags.length ? (
                <div className="flex flex-wrap gap-1">
                  {c.tags.map((t) => (
                    <ErpBoardTagBadge key={t} label={t} />
                  ))}
                </div>
              ) : null}

              <LinkSection card={c} busy={busy} onAct={act} />

              <section className={cn('space-y-2 border-t pt-4', DASH.divider)} data-testid="erp-board-checklist">
                <h3 className={cn(DASH.title, 'flex justify-between')}>
                  รายการตรวจสอบ
                  <span className="tabular-nums">
                    {done}/{detail.checklist.length}
                  </span>
                </h3>
                {groups.map((g) => {
                  const gDone = g.items.filter((x) => x.checked).length;
                  return (
                    <div key={g.group} className={cn(DASH.card, 'space-y-1.5 p-3')}>
                      <p className={cn(DASH.title, 'flex justify-between')}>
                        {g.group}
                        <span className={cn('tabular-nums', gDone === g.items.length ? TONE.success.value : DASH.muted)}>
                          {gDone}/{g.items.length}
                        </span>
                      </p>
                      {g.items.map((it) => (
                        <label key={it.itemId} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={it.checked}
                            disabled={busy}
                            aria-label={it.item}
                            onCheckedChange={(v) =>
                              void act({ action: v === true ? 'check' : 'uncheck', itemId: it.itemId }, v === true ? `ติ๊ก ${it.item} แล้ว` : `เอาติ๊ก ${it.item} ออกแล้ว`)
                            }
                          />
                          {it.item}
                        </label>
                      ))}
                    </div>
                  );
                })}
              </section>

              {detail.track.length ? (
                <section className={cn('space-y-2 border-t pt-4', DASH.divider)}>
                  <h3 className={DASH.title}>ประวัติขั้นตอน</h3>
                  <ul className="space-y-1.5 text-sm">
                    {detail.track.map((t, i) => (
                      <li key={i} className={DASH.cell}>
                        <span className={DASH.sub}>{thDate(t.at, true)}</span> {t.step}
                        {t.outcome ? ` · ${t.outcome}` : ''}
                        {t.scheduledAt ? ` · ${thDate(t.scheduledAt)}` : ''}
                        {t.requestNo ? <span className="tabular-nums"> · {t.requestNo}</span> : null}
                        {t.by ? <span className={DASH.sub}> · {t.by}</span> : null}
                        {t.remark ? <span className={cn(DASH.sub, 'block')}>{t.remark}</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {overview ? <StepForm key={`${c.cardId}-${c.stepId}-${c.outcome}`} card={c} overview={overview} busy={busy} onAct={act} /> : null}

              <section className={cn('flex flex-wrap items-center gap-2 border-t pt-4', DASH.divider)}>
                <h3 className={cn(DASH.title, 'mr-auto')}>อยู่ช่อง {column?.label ?? '—'}</h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" disabled={busy} data-testid="erp-board-move">
                      ย้ายไปช่อง
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {columns
                      .filter((col) => col.id !== c.columnId)
                      .map((col) => {
                        const blocked = col.requiresLink && c.requestNos.length === 0;
                        return (
                          <DropdownMenuItem key={col.id} disabled={blocked} onSelect={() => void act({ action: 'move', columnId: col.id }, `ย้ายไป ${col.label} แล้ว`)}>
                            {col.label}
                            {blocked ? <span className={cn(DASH.sub, 'ml-2')}>ต้องผูกใบขอ</span> : null}
                          </DropdownMenuItem>
                        );
                      })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </section>
            </div>

            <aside className={cn('flex flex-col border-t p-4 lg:border-l lg:border-t-0', DASH.divider)}>
              <Tabs defaultValue="comments" className="flex-1">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="comments">ความคิดเห็น {detail.comments.length}</TabsTrigger>
                  <TabsTrigger value="activity">กิจกรรม {detail.activity.length}</TabsTrigger>
                </TabsList>
                <TabsContent value="comments" className="space-y-3">
                  {detail.comments.length === 0 ? <p className={cn(DASH.sub, 'py-4')}>ยังไม่มีความคิดเห็น</p> : null}
                  {detail.comments.map((m) => (
                    <div key={m.id} className="flex gap-2">
                      <NameAvatar name={m.who ?? '?'} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 text-xs">
                          <span className="font-medium">{m.who ?? '—'}</span> <span className={DASH.sub}>{thDate(m.at, true)}</span>
                          {m.mine ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="ml-auto h-6 px-2 text-xs"
                              disabled={busy}
                              onClick={() => void act({ action: 'comment_delete', commentId: Number(m.id.slice(2)) }, 'ลบความคิดเห็นแล้ว')}
                            >
                              ลบ
                            </Button>
                          ) : null}
                        </p>
                        <p className="whitespace-pre-line break-words text-sm">{m.text}</p>
                      </div>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="activity" className="space-y-2">
                  {detail.activity.length === 0 ? <p className={cn(DASH.sub, 'py-4')}>ยังไม่มีกิจกรรม</p> : null}
                  {detail.activity.map((a, i) => (
                    <p key={i} className={cn('border-b pb-2 text-xs', DASH.divider)}>
                      <span className={DASH.sub}>{thDate(a.at, true)}</span> <span className="font-medium">{erpActivityLabel(a.type)}</span>
                      {a.message ? ` ${a.message}` : ''}
                      {a.actor ? <span className={DASH.sub}> · {a.actor}</span> : null}
                    </p>
                  ))}
                </TabsContent>
              </Tabs>
              <form
                className="mt-4 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendComment();
                }}
              >
                <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="เขียนความคิดเห็น…" maxLength={1000} data-testid="erp-board-comment" />
                <Button type="submit" disabled={busy || !comment.trim()}>
                  ส่ง
                </Button>
              </form>
            </aside>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

type ActFn = (body: ErpBoardActionBody, done: string) => Promise<boolean>;

/** ผูกใบขอ: เลือกจากใบขอที่เปิดอยู่ (ชุดเดียวกับหน้าใบขอ) · เอาออกที่กากบาทบนป้าย */
function LinkSection({ card: c, busy, onAct }: { card: ErpBoardCard; busy: boolean; onAct: ActFn }) {
  const [jobs, setJobs] = useState<{ value: string; label: string; keywords: string }[] | null>(null);
  const [pick, setPick] = useState('');
  useEffect(() => {
    let cancelled = false;
    void fetchSiamrajUnitRequests(500)
      .then((list) => {
        if (cancelled) return;
        const seen = new Set<string>();
        setJobs(
          list
            .filter((j) => j.request_no && !seen.has(j.request_no) && seen.add(j.request_no))
            .map((j) => ({
              value: j.request_no as string,
              label: [j.request_no, jobBoardCardTitle(j), publicJobPositionLabel(j)].filter(Boolean).join(' · '),
              keywords: [j.unit_name, j.request_no].filter(Boolean).join(' '),
            })),
        );
      })
      .catch(() => !cancelled && setJobs([]));
    return () => {
      cancelled = true;
    };
  }, []);
  const options = useMemo(() => (jobs ?? []).filter((j) => !c.requestNos.includes(j.value)), [jobs, c.requestNos]);
  return (
    <section className={cn('space-y-2 border-t pt-4', DASH.divider)} data-testid="erp-board-link">
      <h3 className={DASH.title}>ใบขอที่ผูกกับคนนี้</h3>
      <div className="flex gap-2">
        <SearchableSelect
          value={pick}
          onChange={setPick}
          options={options}
          placeholder={jobs ? 'เลือกเลขที่ใบขอ…' : 'กำลังโหลดใบขอ…'}
          searchPlaceholder="ค้นเลขที่ใบขอ หน่วยงาน ตำแหน่ง"
          emptyText="ไม่เจอใบขอ"
          disabled={!jobs || busy}
          className="flex-1"
          ariaLabel="เลือกเลขที่ใบขอ"
        />
        <Button
          disabled={!pick || busy}
          onClick={() => void onAct({ action: 'link', requestNo: pick }, `ผูก ${pick} แล้ว`).then((ok) => ok && setPick(''))}
        >
          ผูกใบขอ
        </Button>
      </div>
      {c.requestNos.length ? (
        <div className="flex flex-wrap gap-1">
          {c.requestNos.map((r) => (
            <Badge key={r} variant="outline" className="gap-1 pr-1 tabular-nums">
              {r}
              <Button variant="ghost" size="icon" className="h-5 w-5" disabled={busy} aria-label={`เอา ${r} ออก`} onClick={() => void onAct({ action: 'unlink', requestNo: r }, `เอา ${r} ออกแล้ว`)}>
                <X />
              </Button>
            </Badge>
          ))}
        </div>
      ) : (
        <p className={cn('text-xs', TONE.danger.value)}>ยังไม่ผูกใบขอ</p>
      )}
    </section>
  );
}

/** ลงผลขั้นตอน — ขั้นที่ยังไม่มีผล = ขั้นเดิม · มีผลแล้ว = ขั้นถัดไป · ผล "ไม่ผ่าน" เลือก Drop / Re Use */
function StepForm({ card: c, overview, busy, onAct }: { card: ErpBoardCard; overview: ErpBoardOverview; busy: boolean; onAct: ActFn }) {
  const steps = overview.steps;
  const cur = steps.find((s) => s.id === c.stepId);
  const initial = !cur ? steps[0] : c.outcome ? (steps.find((s) => s.seq === cur.seq + 1) ?? cur) : cur;
  const [stepId, setStepId] = useState(String(initial?.id ?? ''));
  const [outcomeId, setOutcomeId] = useState('');
  const [date, setDate] = useState('');
  const [requestNo, setRequestNo] = useState(c.requestNos[0] ?? '');
  const [toColumnId, setToColumnId] = useState('');
  const [remark, setRemark] = useState('');
  const step = steps.find((s) => String(s.id) === stepId);
  const outcomes = overview.outcomes.filter((o) => String(o.stepId) === stepId);
  const outcome = outcomes.find((o) => String(o.id) === outcomeId);
  const targets = (outcome?.toColumnIds ?? []).map((id) => overview.columns.find((col) => col.id === id)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  const needTarget = targets.length > 1 && !toColumnId;
  const noLink = c.requestNos.length === 0;

  const submit = async () => {
    if (!step) return;
    const ok = await onAct(
      {
        action: 'step',
        stepId: step.id,
        outcomeId: outcome?.id ?? null,
        scheduledAt: step.hasDate && date ? `${date}T00:00:00+07:00` : null,
        requestNo: requestNo || null,
        toColumnId: toColumnId ? Number(toColumnId) : null,
        remark: remark.trim() || null,
      },
      `บันทึก ${step.label}${outcome ? ` · ${outcome.label}` : ''} แล้ว`,
    );
    if (ok) {
      setOutcomeId('');
      setDate('');
      setToColumnId('');
      setRemark('');
    }
  };

  return (
    <section className={cn('space-y-3 border-t pt-4', DASH.divider)} data-testid="erp-board-step-form">
      <h3 className={DASH.title}>ลงผลขั้นตอน</h3>
      {noLink ? <p className={cn('text-xs', TONE.danger.value)}>ผูกใบขอก่อนลงขั้นตอน</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <FieldSelect
          value={stepId}
          onChange={(v) => {
            setStepId(v);
            setOutcomeId('');
            setToColumnId('');
          }}
          options={steps.map((s) => ({ value: String(s.id), label: `${s.seq}. ${s.label}` }))}
          ariaLabel="ขั้นตอน"
        />
        <FieldSelect
          value={outcomeId}
          onChange={(v) => {
            setOutcomeId(v);
            setToColumnId('');
          }}
          options={[{ value: '', label: 'ยังไม่มีผล' }, ...outcomes.map((o) => ({ value: String(o.id), label: o.label }))]}
          ariaLabel="ผล"
        />
        {step?.hasDate ? (
          <label className="space-y-1 text-xs">
            <span className={DASH.sub}>{step.dateLabel ?? 'วันที่'}</span>
            <DateSelectDmyBe value={date} onChange={setDate} allowEmpty ariaLabel={step.dateLabel ?? 'วันที่'} />
          </label>
        ) : null}
        {c.requestNos.length > 1 ? (
          <label className="space-y-1 text-xs">
            <span className={DASH.sub}>ใบขอ</span>
            <FieldSelect value={requestNo} onChange={setRequestNo} options={c.requestNos.map((r) => ({ value: r, label: r }))} ariaLabel="ใบขอของขั้นนี้" />
          </label>
        ) : null}
        {targets.length > 1 ? (
          <label className="space-y-1 text-xs">
            <span className={DASH.sub}>ย้ายการ์ดไป</span>
            <FieldSelect
              value={toColumnId}
              onChange={setToColumnId}
              options={targets.map((t) => ({ value: String(t.id), label: t.label }))}
              placeholder="เลือกช่อง"
              ariaLabel="ย้ายการ์ดไป"
            />
          </label>
        ) : null}
        {targets.length === 1 ? <p className={cn(DASH.sub, 'self-center')}>การ์ดย้ายไป {targets[0].label}</p> : null}
      </div>
      <Input value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="หมายเหตุ" maxLength={500} aria-label="หมายเหตุ" />
      <Button disabled={busy || noLink || !step || needTarget} onClick={() => void submit()} data-testid="erp-board-step-save">
        บันทึกขั้นตอน
      </Button>
    </section>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className={DASH.sub}>{label}</dt>
      <dd className={cn(DASH.cell, 'text-sm')}>{value ?? '—'}</dd>
    </div>
  );
}

function groupChecklist(items: ErpBoardCardDetail['checklist']) {
  const out: { group: string; items: ErpBoardCardDetail['checklist'] }[] = [];
  for (const it of items) {
    const last = out[out.length - 1];
    if (last && last.group === it.group) last.items.push(it);
    else out.push({ group: it.group, items: [it] });
  }
  return out;
}

export default ErpBoardCardDialog;
