/**
 * รายชื่อของเลขที่กดในเส้นทางงานสรรหา (QA 18 ต.ค. 2569 — "เลขที่กดดูชื่อไม่ได้ พิสูจน์ไม่ได้ว่าจริง")
 * ภาพรวมส่งมาแค่ id ใบ (ไม่มีชื่อ/เบอร์) ⇒ ป๊อปดึงรายชื่อจากเส้นรายชื่อผู้สมัครที่ผู้ใช้มีสิทธิ์อยู่แล้ว แล้วกรองด้วย id
 * shadcn Dialog · ไม่ซ้อนป๊อป · ล้มแล้วมีปุ่มลองใหม่
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LoadErrorNotice from '@/components/shared/LoadErrorNotice';
import NamesSearchInput, { NAMES_PAGE, matchesNameQuery } from '@/components/shared/NamesSearchInput';
import type { PublicApplication } from '@/lib/publicApplicationsApi';
import { fetchApplicantNames, holderStateOf, holderSummary, type ApplicantNameRow, type HolderState } from '@/lib/recruitOverviewApi';
import { applicantWorkLink, applicationUnitLabel } from '@/lib/recruitRm';
import { localThaiPhone } from '@/lib/followDayReport';
import { formatYmdTh, toYmdBangkok } from '@/lib/dateTh';
import { friendlyErrorText } from '@/lib/friendlyError';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';

const NUM = new Intl.NumberFormat('th-TH');

export default function JourneyNamesDialog({
  open,
  onOpenChange,
  title,
  ids,
  notes,
  contentStyle,
}: {
  /** ธีมของหน้าที่เปิด (แผงอยู่นอกกล่องของหน้า · โฉมต้นแบบ ?home=v5 ส่งตัวแปรธีมมาให้) */
  contentStyle?: React.CSSProperties;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  ids: readonly string[];
  /** คอลัมน์ "ค้างที่" ต่อราย (หน้าความคุ้มค่า · ค้างอยู่ที่ใคร) */
  notes?: ReadonlyMap<string, string>;
}) {
  const cols = notes ? 6 : 5;
  const navigate = useNavigate();
  /** ชื่อตาม id ที่กด (29 ต.ค. 2569) — เดิมดึงลิสต์ผู้สมัครของผู้ใช้ทั้งก้อน คนที่เจ้าหน้าที่คนอื่นเก็บไปแล้วเลย "เปิดชื่อไม่ได้" */
  const [all, setAll] = useState<ApplicantNameRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    setAll(null);
  }, [ids]);

  useEffect(() => {
    if (!open || all) return;
    let alive = true;
    setError(null);
    fetchApplicantNames(ids)
      .then((rows) => alive && setAll(rows))
      .catch((e: unknown) => alive && setError(friendlyErrorText(e, 'โหลดรายชื่อไม่สำเร็จ')));
    return () => {
      alive = false;
    };
  }, [open, all, rev, ids]);

  /** ใครถือ · ทำถึงไหน · ค้างกี่วัน (11 พ.ย. 2569) — ยังไม่โทรขึ้นก่อน ค้างนานสุดก่อน */
  const [now] = useState(() => new Date());
  const stateOf = useMemo(() => new Map((all ?? []).map((a) => [a.id, holderStateOf(a, now)] as const)), [all, now]);
  const rank = (s: HolderState | undefined) => (s?.kind === 'waiting' ? 0 : s?.kind === 'free' ? 1 : 2);
  const rows = useMemo(() => {
    if (!all) return [];
    const want = new Set(ids);
    return all
      .filter((a) => want.has(a.id))
      .sort((x, y) => {
        const sx = stateOf.get(x.id);
        const sy = stateOf.get(y.id);
        const wait = (s: HolderState | undefined) => (s?.kind === 'waiting' ? (s.days ?? 0) : 0);
        return rank(sx) - rank(sy) || wait(sy) - wait(sx) || (y.created_at ?? '').localeCompare(x.created_at ?? '');
      });
  }, [all, ids, stateOf]);
  const summary = useMemo(() => holderSummary(rows.map((a) => stateOf.get(a.id) ?? { kind: 'free' as const })), [rows, stateOf]);
  // ค้นหา + ดูทีละ 50 (ชุดส่งต่อ G04) — เปิดชุดใหม่ = ล้าง (key ของป๊อปเปลี่ยนตามชุด ids)
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(NAMES_PAGE);
  const [seen, setSeen] = useState(ids);
  if (seen !== ids) {
    setSeen(ids);
    setQ('');
    setLimit(NAMES_PAGE);
  }
  const shown = useMemo(
    () => rows.filter((a) => matchesNameQuery([a.full_name, a.phone, applicationUnitLabel(a as PublicApplication)], q)),
    [rows, q],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" style={contentStyle}>
        <DialogHeader>
          <DialogTitle>
            {title} · {NUM.format(ids.length)} คน
          </DialogTitle>
          <DialogDescription className="sr-only">รายชื่อของช่องที่กดในเส้นทางของรายชื่อ</DialogDescription>
        </DialogHeader>
        {error ? (
          <LoadErrorNotice message={error} onRetry={() => setRev((n) => n + 1)} />
        ) : !all ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {/* สรุป: เก็บไปแล้วยังไม่โทร อยู่ที่ใคร ค้างนานสุดกี่วัน · ยังไม่มีคนเก็บ · โทรแล้ว */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm" data-testid="names-holder-summary">
              {summary.waiting.map((w) => (
                <span key={w.who} className={TONE.danger.value}>
                  {w.who} ยังไม่โทร {NUM.format(w.n)} คน{w.maxDays !== null ? ` ค้างนานสุด ${NUM.format(w.maxDays)} วัน` : ''}
                </span>
              ))}
              <span className="text-muted-foreground">ยังไม่มีคนเก็บ {NUM.format(summary.free)} คน</span>
              <span className="text-muted-foreground">โทรแล้ว {NUM.format(summary.called)} คน</span>
            </div>
            {rows.length > 5 ? (
              <NamesSearchInput value={q} onChange={(v) => { setQ(v); setLimit(NAMES_PAGE); }} found={q.trim() ? shown.length : null} />
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead className="hidden sm:table-cell">เบอร์</TableHead>
                  <TableHead className="hidden sm:table-cell">หน่วยงาน</TableHead>
                  <TableHead>อยู่ที่ใคร</TableHead>
                  {notes ? <TableHead>ค้างที่</TableHead> : null}
                  <TableHead className="hidden text-right sm:table-cell">วันที่กรอก</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={cols} className="text-center text-muted-foreground">
                      {rows.length === 0 ? 'ไม่มีรายชื่อ' : 'ไม่เจอชื่อที่ค้นหา'}
                    </TableCell>
                  </TableRow>
                ) : (
                  shown.slice(0, limit).map((a) => (
                    <TableRow key={a.id}>
                      {/* กดชื่อ = ไปทำงานกับคนนั้นต่อ (เจ้าของ 9 พ.ย. 2569 "บอกชื่อกดไปต้องเห็นชื่อแล้วกดไปทำงานต่อได้") */}
                      <TableCell className="min-w-32 font-medium">
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto whitespace-normal p-0 text-left font-medium"
                          onClick={() => {
                            onOpenChange(false);
                            navigate(applicantWorkLink(a.id));
                          }}
                          data-testid="journey-name-open"
                        >
                          {a.full_name || 'ไม่มีชื่อ'}
                        </Button>
                        {/* มือถือ: เบอร์/หน่วยงาน/วันที่ย้ายมาใต้ชื่อ (คอลัมน์ซ่อน) — ตรวจจอ 375 · 10 พ.ย. 2569 */}
                        <span className="block text-xs font-normal tabular-nums text-muted-foreground sm:hidden">
                          {[
                            a.phone ? localThaiPhone(a.phone) : null,
                            applicationUnitLabel(a as PublicApplication) || null,
                            a.created_at ? formatYmdTh(toYmdBangkok(new Date(a.created_at))) : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap tabular-nums sm:table-cell">{a.phone ? localThaiPhone(a.phone) : '—'}</TableCell>
                      <TableCell className="hidden max-w-56 truncate sm:table-cell">{applicationUnitLabel(a as PublicApplication) || '—'}</TableCell>
                      <TableCell className="min-w-32 text-sm">
                        <HolderCell state={stateOf.get(a.id)} />
                      </TableCell>
                      {notes ? <TableCell className="min-w-32">{notes.get(a.id) ?? '—'}</TableCell> : null}
                      <TableCell className="hidden whitespace-nowrap text-right tabular-nums sm:table-cell">
                        {a.created_at ? formatYmdTh(toYmdBangkok(new Date(a.created_at))) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {shown.length > limit ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setLimit((n) => n + NAMES_PAGE)}>
                ดูเพิ่ม ({NUM.format(shown.length - limit)} คน)
              </Button>
            ) : null}
            {rows.length < ids.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                เปิดชื่อไม่ได้ {NUM.format(ids.length - rows.length)} คน
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HolderCell({ state }: { state: HolderState | undefined }) {
  if (!state || state.kind === 'free') return <span className="text-muted-foreground">ยังไม่มีคนเก็บ</span>;
  if (state.kind === 'waiting') {
    return (
      <span className={cn('block', TONE.danger.value)}>
        {state.who}
        <span className="block text-xs">ยังไม่โทร{state.days !== null ? ` ค้าง ${NUM.format(state.days)} วัน` : ''}</span>
      </span>
    );
  }
  return (
    <span className="block">
      {state.who}
      <span className="block text-xs text-muted-foreground">
        {state.ok === true ? 'ติดต่อได้' : state.ok === false ? 'ติดต่อไม่ได้' : 'ลงผลแล้ว'} {formatYmdTh(toYmdBangkok(new Date(state.at)))}
      </span>
    </span>
  );
}
