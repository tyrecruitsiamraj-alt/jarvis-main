import React, { useEffect, useState } from 'react';
import { LoaderCircle, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import NameAvatar from '@/components/shared/NameAvatar';
import LoadErrorNotice from '@/components/shared/LoadErrorNotice';
import { ErpBoardStepLine, ErpBoardTagBadge } from '@/components/matching/ErpBoardBits';
import { apiFetch } from '@/lib/apiFetch';
import { friendlyErrorText } from '@/lib/friendlyError';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { ERP_BOARD_READONLY_HINT, erpActivityLabel, erpCardPosition, thDate, type ErpBoardCardDetail, type ErpBoardOverview } from '@/lib/erpBoard';

/**
 * ป๊อปการ์ดบอร์ด ERP (ช่วง 1 อ่านอย่างเดียว · แบบร่าง 2 พ.ย. 2569)
 * ซ้าย: ขั้นตอน 7 ขั้น · รายละเอียด · ใบขอที่ผูก · รายการตรวจสอบ 3 ชุด · ขั้นต่อไป (ปิดไว้)
 * ขวา: ความคิดเห็น / กิจกรรม · ช่องเขียนความคิดเห็นปิดไว้จนกว่าช่วง 2
 */
const ErpBoardCardDialog: React.FC<{ cardId: number | null; overview: ErpBoardOverview | null; onClose: () => void }> = ({ cardId, overview, onClose }) => {
  const [detail, setDetail] = useState<ErpBoardCardDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
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

  const c = detail?.card;
  const column = overview?.columns.find((x) => x.id === c?.columnId);
  const steps = overview?.steps ?? [];
  const current = steps.find((s) => s.label === c?.step);
  const next = current ? steps.find((s) => s.seq === current.seq + 1) : steps[0];
  const groups = groupChecklist(detail?.checklist ?? []);
  const done = (detail?.checklist ?? []).filter((x) => x.checked).length;

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

              <section className={cn('space-y-2 border-t pt-4', DASH.divider)}>
                <h3 className={DASH.title}>ใบขอที่ผูกกับคนนี้</h3>
                <div className="flex gap-2">
                  <Input placeholder="เลือกเลขที่ใบขอ…" disabled title={ERP_BOARD_READONLY_HINT} />
                  <Button disabled title={ERP_BOARD_READONLY_HINT}>
                    ผูกใบขอ
                  </Button>
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
              </section>

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
                        <label key={it.item} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={it.checked} disabled aria-label={it.item} />
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

              <section className={cn('space-y-2 border-t pt-4', DASH.divider)}>
                <h3 className={DASH.title}>ขั้นต่อไป</h3>
                <div className="flex flex-wrap gap-2">
                  {next ? (
                    <Button size="sm" disabled title={ERP_BOARD_READONLY_HINT}>
                      {next.label}
                    </Button>
                  ) : null}
                  {['ไม่มีงาน', 'Re Use', 'Drop'].map((x) => (
                    <Button key={x} size="sm" variant="outline" disabled title={ERP_BOARD_READONLY_HINT}>
                      ย้ายไป {x}
                    </Button>
                  ))}
                </div>
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
                  {detail.comments.map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <NameAvatar name={m.who ?? '?'} size="md" />
                      <div className="min-w-0">
                        <p className="text-xs">
                          <span className="font-medium">{m.who ?? '—'}</span> <span className={DASH.sub}>{thDate(m.at, true)}</span>
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
              <Input className="mt-4" placeholder="เขียนความคิดเห็น…" disabled title={ERP_BOARD_READONLY_HINT} />
            </aside>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

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
