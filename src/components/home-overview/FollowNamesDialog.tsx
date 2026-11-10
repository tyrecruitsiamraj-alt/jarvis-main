/**
 * รายชื่อคนติดตามของเลขที่กดบนแผงติดตาม (เจ้าของ 9 พ.ย. 2569 "ทำแผงติดตามให้กดเห็นชื่อด้วย")
 * โหลดตอนเปิดเท่านั้น (`?summary=lumos&people=1`) · กดชื่อ = ไปหน้าติดตาม เปิดแผนของคนนั้น (`followPersonLink`)
 * shadcn Dialog · ไม่ซ้อนป๊อป (หน้าหลักปิดแผงก่อนเปิด) · ล้มแล้วมีปุ่มลองใหม่
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LoadErrorNotice from '@/components/shared/LoadErrorNotice';
import NamesSearchInput, { NAMES_PAGE, matchesNameQuery } from '@/components/shared/NamesSearchInput';
import { fetchHomeFollowPeople } from '@/lib/homeAiShareApi';
import type { AiShareWindow } from '@/lib/homeAiShare';
import { followPersonLink, type FollowBucketKey, type FollowPersonName } from '@/lib/homeLumosSummary';
import { localThaiPhone } from '@/lib/followDayReport';
import { trendBuLabel } from '@/lib/trends/bu';
import { friendlyErrorText } from '@/lib/friendlyError';

const NUM = new Intl.NumberFormat('th-TH');
const TEAM_LABEL = { main: 'คนเริ่มงาน', replacement: 'ส่งคนแทน' } as const;

export default function FollowNamesDialog({
  open,
  onOpenChange,
  title,
  q,
  bucket,
  contentStyle,
}: {
  /** ธีมของหน้าที่เปิด (แผงอยู่นอกกล่องของหน้า · โฉมต้นแบบ ?home=v5 ส่งตัวแปรธีมมาให้) */
  contentStyle?: React.CSSProperties;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** ช่วง/BU ชุดเดียวกับแผง */
  q: AiShareWindow & { bu?: string | null };
  /** ผลรายคนที่กด · null = ทุกคน */
  bucket: FollowBucketKey | null;
}) {
  const navigate = useNavigate();
  const qKey = `${q.from ?? ''}|${q.to ?? ''}|${q.bu ?? ''}`;
  const [all, setAll] = useState<{ key: string; people: FollowPersonName[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!open || all?.key === qKey) return;
    let alive = true;
    setError(null);
    fetchHomeFollowPeople(q)
      .then((d) => {
        if (!alive) return;
        if (d.error) setError(d.error);
        else setAll({ key: qKey, people: d.people });
      })
      .catch((e: unknown) => alive && setError(friendlyErrorText(e, 'โหลดรายชื่อไม่สำเร็จ')));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- q ชุดเดียวกับ qKey
  }, [open, qKey, rev, all?.key]);

  const rows = useMemo(() => {
    if (!all || all.key !== qKey) return null;
    return all.people.filter((p) => (bucket ? p.bucket === bucket : true)).sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'th'));
  }, [all, qKey, bucket]);
  // ค้นหา + ดูทีละ 50 (ชุดส่งต่อ G04) — เปิดชุดใหม่ (ช่วง/BU/ผลที่กด) = ล้าง
  const [term, setTerm] = useState('');
  const [limit, setLimit] = useState(NAMES_PAGE);
  const setKey = `${qKey}|${bucket ?? ''}|${title}`;
  const [seenSet, setSeenSet] = useState(setKey);
  if (seenSet !== setKey) {
    setSeenSet(setKey);
    setTerm('');
    setLimit(NAMES_PAGE);
  }
  const shown = useMemo(() => (rows ? rows.filter((p) => matchesNameQuery([p.name, p.phone], term)) : null), [rows, term]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" style={contentStyle}>
        <DialogHeader>
          <DialogTitle>
            {title}
            {rows ? ` · ${NUM.format(rows.length)} คน` : ''}
          </DialogTitle>
          <DialogDescription className="sr-only">รายชื่อคนติดตามของเลขที่กด</DialogDescription>
        </DialogHeader>
        {error ? (
          <LoadErrorNotice message={error} onRetry={() => setRev((n) => n + 1)} />
        ) : !rows ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        ) : (
          <div className="max-h-[60vh] space-y-2 overflow-y-auto">
            {rows.length > 5 ? (
              <NamesSearchInput value={term} onChange={(v) => { setTerm(v); setLimit(NAMES_PAGE); }} found={term.trim() ? (shown?.length ?? 0) : null} />
            ) : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead className="hidden sm:table-cell">เบอร์</TableHead>
                  <TableHead className="hidden sm:table-cell">ทีม</TableHead>
                  <TableHead className="text-right">สาย</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!shown || shown.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {rows.length === 0 ? 'ไม่มีรายชื่อ' : 'ไม่เจอชื่อที่ค้นหา'}
                    </TableCell>
                  </TableRow>
                ) : (
                  shown.slice(0, limit).map((p) => (
                    <TableRow key={p.entryId}>
                      <TableCell className="min-w-32 font-medium">
                        {/* กดชื่อ = ไปทำงานกับคนนั้นต่อที่หน้าติดตาม */}
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto whitespace-normal p-0 text-left font-medium"
                          disabled={!p.entryId}
                          onClick={() => {
                            onOpenChange(false);
                            navigate(followPersonLink(p));
                          }}
                          data-testid="follow-name-open"
                        >
                          {p.name || 'ไม่มีชื่อ'}
                        </Button>
                        {/* มือถือ: เบอร์/ทีมย้ายมาใต้ชื่อ (คอลัมน์ซ่อน) — ตรวจจอ 375 · 10 พ.ย. 2569 */}
                        <span className="block text-xs font-normal tabular-nums text-muted-foreground sm:hidden">
                          {[p.phone ? localThaiPhone(p.phone) : null, TEAM_LABEL[p.team], p.bu ? trendBuLabel(p.bu) : null].filter(Boolean).join(' · ')}
                        </span>
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap tabular-nums sm:table-cell">{p.phone ? localThaiPhone(p.phone) : '—'}</TableCell>
                      <TableCell className="hidden whitespace-nowrap sm:table-cell">
                        {TEAM_LABEL[p.team]}
                        {p.bu ? <span className="block text-xs text-muted-foreground">{trendBuLabel(p.bu)}</span> : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{NUM.format(p.calls)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {shown && shown.length > limit ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setLimit((n) => n + NAMES_PAGE)}>
                ดูเพิ่ม ({NUM.format(shown.length - limit)} คน)
              </Button>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
