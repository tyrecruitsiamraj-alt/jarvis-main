import React, { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import { useListPagination } from '@/hooks/useListPagination';
import { DASH, TONE } from '@/lib/designTokens';
import { PhoneOff, Phone, ExternalLink, X } from 'lucide-react';
import {
  listActiveProposalsWithWarnings,
  cancelProposal,
  declineProposalAfterCall,
  proposalStatusLabel,
  proposalStatusChip,
  type CandidateProposal,
  type ProposalCallWarning,
  type ProposalSource,
} from '@/lib/candidateProposalsApi';

/**
 * แหล่งที่มาของผู้สมัคร (ไม่ใช่ "สถานะ" — สีสถานะยังมาจาก candidateProposalsApi เท่านั้น)
 * คนของเรา = info (ฟ้า) · iRecruit = primary (น้ำเงิน) ตามความหมายที่ล็อกไว้ใน designTokens.ts
 */
const SOURCE_META: Record<ProposalSource, { label: string; cls: string }> = {
  board: { label: 'คนของเรา', cls: TONE.info.chip },
  irecruit: { label: 'iRecruit', cls: TONE.primary.chip },
  // ใบสมัครจากบอร์ดรับสมัคร (S9) — จองจากใบที่โทรแล้วสนใจ
  application: { label: 'ใบสมัคร', cls: TONE.success.chip },
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
}

const ReservationsPage: React.FC = () => {
  const [items, setItems] = useState<CandidateProposal[]>([]);
  /** ธง "เพิ่งมีผลโทรว่าไม่สนใจ" ต่อ id การจอง — server แนบมากับลิสต์ */
  const [callWarnings, setCallWarnings] = useState<Record<string, ProposalCallWarning>>({});
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<'all' | ProposalSource>('all');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listActiveProposalsWithWarnings();
      setItems(data.items);
      setCallWarnings(data.callWarnings);
    } catch {
      setError('โหลดรายการไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(
    () => items.filter((it) => (sourceFilter === 'all' ? true : it.source === sourceFilter)),
    [items, sourceFilter],
  );

  /** แบ่งหน้า (เจ้าของสั่ง 22 ส.ค. 2569) — hook กลาง ได้ dropdown ต่อหน้าชุดเดียวกันทุกหน้า */
  const { pageItems, bar, resetPage } = useListPagination(rows);

  const cancel = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await cancelProposal(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setConfirmingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  /** โทรแล้วเขาไม่สนใจ — โยนออกจากการจอง (rejected) ให้เสนอใบอื่นได้ ไม่ต้องย้อนไปเปิดใบขอ */
  const declineAfterCall = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await declineProposalAfterCall(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
      setConfirmingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="รายชื่อคนจอง"
        subtitle="ผู้สมัครที่กำลังจอง/ติดต่อ/ลงงานอยู่ — 1 คนจองได้ทีละใบขอเท่านั้น"
        backPath="/matching"
      />
      <div className="px-4 md:px-6 space-y-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">คนที่จองอยู่ ({rows.length})</h2>
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value as 'all' | ProposalSource);
              resetPage();
            }}
            className="jarvis-soft-field min-h-[40px] text-xs w-auto"
          >
            <option value="all">ทุกแหล่ง</option>
            <option value="board">คนของเรา</option>
            <option value="irecruit">iRecruit</option>
          </select>
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">กำลังโหลด…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-white/80 bg-white/30 px-4 py-8 text-center">
            ยังไม่มีใครถูกจองอยู่ตอนนี้
          </p>
        ) : (
          <ul className="space-y-3">
            {pageItems.map((it) => {
              const src = SOURCE_META[it.source];
              const confirming = confirmingId === it.id;
              const busy = busyId === it.id;
              return (
                <li key={it.id} className="glass-card rounded-2xl border border-white/70 p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={src.cls}>{src.label}</span>
                    <span
                      className={proposalStatusChip(it.status)}
                    >
                      {proposalStatusLabel(it.status)}
                    </span>
                    <span className="text-[11px] text-muted-foreground ml-auto">{formatWhen(it.updated_at)}</span>
                  </div>
                  <h3 className={cn('text-sm', DASH.cellStrong, 'font-semibold')}>
                    {it.candidate_name || `#${it.candidate_ref}`}
                  </h3>
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    {it.candidate_position ? <span>{it.candidate_position}</span> : null}
                    {it.branch_name ? (
                      <span className={cn('font-medium', TONE.primary.value)}>สาขา: {it.branch_name}</span>
                    ) : null}
                    {it.candidate_phone ? (
                      <a
                        href={`tel:${it.candidate_phone}`}
                        className={cn('inline-flex items-center gap-1 hover:underline', TONE.info.value)}
                      >
                        <Phone className="h-3 w-3" /> {it.candidate_phone}
                      </a>
                    ) : null}
                  </div>
                  {it.reason ? (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">— {it.reason}</p>
                  ) : null}
                  {(() => {
                    const w = callWarnings[it.id];
                    if (!w) return null;
                    // ผลที่เก่ากว่าการจองล่าสุดไม่ใช่สัญญาณ (คนจองอาจรู้อยู่แล้วตอนกด)
                    if (new Date(w.at).getTime() <= new Date(it.updated_at).getTime()) return null;
                    const strong = w.scope === 'all';
                    return (
                      <p
                        className={cn(
                          'flex flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium',
                          strong ? TONE.danger.soft : TONE.warn.soft,
                          strong ? TONE.danger.value : TONE.warn.value,
                        )}
                      >
                        <PhoneOff className="h-3 w-3 shrink-0" />
                        {strong
                          ? 'ผลโทรล่าสุด: ไม่หางานแล้ว'
                          : 'ผลโทรล่าสุด: ไม่สนใจงานนี้'}{' '}
                        · {formatWhen(w.at)}
                        {w.byName ? ` · โดย ${w.byName}` : ' · จาก AI'}
                        <span className="basis-full text-[10px] font-normal opacity-80">
                          ระบบไม่ถอนจองให้เอง (เบอร์ผิด/คนละคนก็มี) — ถ้าจริงกดปุ่ม "โยนกลับ" ด้านล่าง
                        </span>
                      </p>
                    );
                  })()}
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    <span>จองไว้กับใบขอ: {it.request_no || it.job_id}</span>
                    <a
                      href={`/matching/match?jobId=${encodeURIComponent(it.job_id)}`}
                      className={cn('inline-flex items-center gap-0.5 hover:underline', TONE.primary.value)}
                    >
                      เปิดใบขอ <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {confirming ? (
                      <>
                        <span className="text-[11px] text-destructive self-center">ยกเลิกการจองนี้แน่ใจนะ?</span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void cancel(it.id)}
                          className={cn(
                            'rounded-full border border-transparent px-3 py-1 text-[11px] font-semibold disabled:opacity-60',
                            TONE.danger.solid,
                          )}
                        >
                          {busy ? 'กำลังยกเลิก…' : 'ยืนยันยกเลิก'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className={cn(
                            'rounded-full border px-3 py-1 text-[11px]',
                            TONE.neutral.soft,
                            TONE.neutral.value,
                            TONE.neutral.softHover,
                          )}
                        >
                          ไม่ยกเลิก
                        </button>
                      </>
                    ) : (
                      <>
                        {/* ผลโทรบอกว่าไม่สนใจ → โยนกลับจากหน้านี้ได้เลย (logic เดียวกับ
                            ปุ่ม "ไม่ผ่าน" ในหน้า Matching แค่ย้ายมาให้กดถึง) · ลงงานแล้วไม่โชว์ */}
                        {it.status !== 'placed' ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void declineAfterCall(it.id)}
                            title="เอาออกจากการจอง (ไม่ผ่าน) — เขาจะถูกเสนอกับใบขออื่นได้"
                            className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium disabled:opacity-60',
                              TONE.warn.soft,
                              TONE.warn.value,
                              TONE.warn.softHover,
                            )}
                          >
                            <PhoneOff className="h-3 w-3" /> {busy ? 'กำลังบันทึก…' : 'โทรแล้วไม่สนใจ — โยนกลับ'}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setConfirmingId(it.id)}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium',
                            TONE.danger.soft,
                            TONE.danger.value,
                            TONE.danger.softHover,
                          )}
                        >
                          <X className="h-3 w-3" /> ยกเลิกจอง
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* แถบเลขหน้า — ตัวเดียวกับทุกหน้าในระบบ */}
        {!loading && rows.length > 0 ? <ListPaginationBar {...bar} /> : null}
      </div>
    </div>
  );
};

export default ReservationsPage;
