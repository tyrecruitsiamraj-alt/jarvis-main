/**
 * รายชื่อจาก Scrap (เจ้าของ 17 พ.ย. 2569) — ตัวเดียวใช้สองที่
 *   - แท็บ "Scrap" ในหน้าใบขอ (`jobId`) — ใบนี้ Scrap มากี่คน ใครผ่าน/ไม่ผ่าน
 *   - แท็บผู้สมัคร ▾ Scrap ของหน้างานสรรหา (`jobId` ว่าง) — ทุกใบที่เห็นได้ เลือกดูทีละใบขอได้
 * ติ๊กแล้วกด "เก็บเข้าการติดต่อ" → ใบสมัครป้าย Scrap + Lead ของคนกด (AI ไม่โทรเอง) · แล้วมีปุ่มพาไปหน้าการติดต่อ
 * แถบเลือก/ปุ่มอยู่ที่เดิมตั้งแต่เปิดหน้า (กดแล้วของบนจอห้ามขยับ)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoaderCircle, PhoneCall } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { EM_DASH } from '@/lib/displayFallback';
import {
  countScrapResults,
  SCRAP_RESULT_LABEL,
  SCRAP_RESULT_ORDER,
  SCRAP_RESULT_TONE,
  SCRAP_TO_CONTACT_MAX,
  scrapInJarvisLabel,
  scrapPlatformLabel,
  scrapReasonLabel,
  type ScrapCandidateRow,
  type ScrapResult,
} from '@/lib/scrapCandidates';
import { addScrapCandidatesToContact, fetchScrapCandidatesAll, fetchScrapCandidatesOfJob } from '@/lib/scrapCandidatesApi';

const PAGE = 50;
const GENDER: Record<string, string> = { male: 'ชาย', female: 'หญิง' };
const ALL = '__all__';

type Props = {
  /** job id ของใบขอ — ว่าง = ทุกใบ (แท็บรวม) */
  jobId?: string | null;
  /** ชื่อใบขอตามเลขใบขอ (แท็บรวมใช้แสดงในตัวเลือก/คอลัมน์ใบขอ) */
  requestTitle?: (requestNo: string) => string | null;
  /** ยอดทั้งหมดหลังโหลด (แท็บของใบขอใช้โชว์เลข) */
  onTotal?: (n: number) => void;
  /** แท็บรวม: เลือกใบขอนี้ไว้ตั้งแต่เปิด (กดเลข Scrap จากตารางใบขอ) */
  initialRequest?: string | null;
};

/** ติ๊กได้ไหม — ไม่มีเบอร์/อยู่ในการติดต่อแล้ว = ไม่ได้ */
const pickable = (r: ScrapCandidateRow) => Boolean(r.phone) && !r.in_jarvis?.is_lead;

export default function ScrapCandidatesPanel({ jobId = null, requestTitle, onTotal, initialRequest = null }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ScrapCandidateRow[] | null>(null);
  const [requests, setRequests] = useState<Array<{ request_no: string; total: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScrapResult | null>(null);
  const [requestPick, setRequestPick] = useState<string>(initialRequest?.toUpperCase() || ALL);
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; toContact: boolean } | null>(null);
  // เก็บ onTotal ไว้ใน ref — หน้าแม่ส่งฟังก์ชันใหม่ทุกรอบ ถ้าผูกกับ load จะโหลดวนไม่จบ
  const onTotalRef = useRef(onTotal);
  onTotalRef.current = onTotal;

  const load = useCallback(async () => {
    setError(null);
    try {
      if (jobId) {
        const d = await fetchScrapCandidatesOfJob(jobId);
        setRows(d.rows);
        onTotalRef.current?.(d.counts.total);
      } else {
        const d = await fetchScrapCandidatesAll();
        setRows(d.rows);
        setRequests(d.requests);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดรายชื่อ Scrap ไม่สำเร็จ');
      setRows((cur) => cur ?? []);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const inRequest = useMemo(() => (rows ?? []).filter((r) => requestPick === ALL || r.request_no === requestPick), [rows, requestPick]);
  const counts = useMemo(() => countScrapResults(inRequest), [inRequest]);
  const shown = useMemo(() => inRequest.filter((r) => !result || r.result === result), [inRequest, result]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE));
  const pageRows = shown.slice(page * PAGE, page * PAGE + PAGE);
  const pageSelectable = pageRows.filter(pickable);
  const allOnPage = pageSelectable.length > 0 && pageSelectable.every((r) => picked.has(r.candidate_id));

  useEffect(() => setPage(0), [result, requestPick]);

  const toggle = (id: string, on: boolean) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toContact = async () => {
    const chosen = (rows ?? []).filter((r) => picked.has(r.candidate_id));
    if (chosen.length === 0) return;
    if (chosen.length > SCRAP_TO_CONTACT_MAX) {
      setNotice({ text: `เก็บได้ครั้งละไม่เกิน ${SCRAP_TO_CONTACT_MAX} คน`, toContact: false });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      // ส่งทีละใบขอ (คนละใบขอ = ใบสมัครคนละใบขอ)
      const byRequest = new Map<string, string[]>();
      for (const r of chosen) byRequest.set(r.request_no, [...(byRequest.get(r.request_no) ?? []), r.candidate_id]);
      const results = (
        await Promise.all([...byRequest].map(([no, ids]) => addScrapCandidatesToContact(jobId ?? `siamraj-sql:${no}`, ids)))
      ).flat();
      const done = results.filter((r) => r.outcome !== 'skipped').length;
      const skipped = results.filter((r) => r.outcome === 'skipped');
      const skipText = skipped.length ? ` · ข้าม ${skipped.length} คน (${skipped.map((s) => `${s.name}: ${s.note}`).join(' · ')})` : '';
      setNotice({ text: `เก็บเข้าการติดต่อแล้ว ${done} คน${skipText}`, toContact: done > 0 });
      setPicked(new Set());
      await load();
    } catch (e) {
      setNotice({ text: e instanceof Error ? e.message : 'เก็บไม่สำเร็จ', toContact: false });
    } finally {
      setBusy(false);
    }
  };

  const titleOf = (no: string) => requestTitle?.(no) ?? null;

  return (
    <div className="space-y-3" data-testid="scrap-candidates">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-secondary/40 px-3.5 py-2.5 text-sm">
        {!jobId ? (
          <Select value={requestPick} onValueChange={setRequestPick}>
            <SelectTrigger className="h-8 w-full sm:w-72" aria-label="ใบขอ">
              <SelectValue placeholder="ทุกใบขอ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>ทุกใบขอ</SelectItem>
              {requests.map((r) => (
                <SelectItem key={r.request_no} value={r.request_no}>
                  {titleOf(r.request_no) ? `${titleOf(r.request_no)} · ${r.request_no}` : r.request_no} ({r.total})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Button type="button" size="xs" variant={result === null ? 'default' : 'outline'} className="rounded-full" aria-pressed={result === null} onClick={() => setResult(null)}>
          ทั้งหมด <span className="tabular-nums">{counts.total}</span>
        </Button>
        {SCRAP_RESULT_ORDER.map((k) => (
          <Button
            key={k}
            type="button"
            size="xs"
            variant={result === k ? 'default' : 'outline'}
            className="rounded-full"
            aria-pressed={result === k}
            onClick={() => setResult((cur) => (cur === k ? null : k))}
          >
            {SCRAP_RESULT_LABEL[k]} <span className="tabular-nums">{counts[k]}</span>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="tabular-nums text-muted-foreground">เลือก {picked.size} คน</span>
        <Button type="button" size="sm" disabled={picked.size === 0 || busy} onClick={() => void toContact()} data-testid="scrap-to-contact">
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <PhoneCall aria-hidden />}
          เก็บเข้าการติดต่อ
        </Button>
        {notice?.toContact ? (
          <Button type="button" size="sm" variant="outline" onClick={() => navigate('/jobs/board?view=contact')} data-testid="scrap-go-contact">
            ไปหน้าการติดต่อ
          </Button>
        ) : null}
        {notice ? <span className={cn('min-w-0 break-words', notice.toContact ? 'text-foreground' : 'text-destructive')}>{notice.text}</span> : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {rows === null ? (
        <p className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> กำลังโหลด…
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="เลือกทุกคนในหน้านี้"
                    checked={allOnPage}
                    disabled={pageSelectable.length === 0}
                    onCheckedChange={(v) => setPicked((cur) => {
                      const next = new Set(cur);
                      for (const r of pageSelectable) {
                        if (v === true) next.add(r.candidate_id);
                        else next.delete(r.candidate_id);
                      }
                      return next;
                    })}
                  />
                </TableHead>
                {!jobId ? <TableHead>ใบขอ</TableHead> : null}
                <TableHead>ชื่อ</TableHead>
                <TableHead>เบอร์</TableHead>
                <TableHead className="text-right">อายุ</TableHead>
                <TableHead>เพศ</TableHead>
                <TableHead>จังหวัด</TableHead>
                <TableHead>เว็บ</TableHead>
                <TableHead>ผล</TableHead>
                <TableHead>เหตุผล</TableHead>
                <TableHead>สถานะ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={jobId ? 10 : 11} className="py-8 text-center text-sm text-muted-foreground">
                    {counts.total === 0 ? 'ยังไม่มีรายชื่อจาก Scrap' : 'ไม่มีรายชื่อในกลุ่มนี้'}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => {
                  const tone = TONE[SCRAP_RESULT_TONE[r.result]];
                  const status = r.phone ? scrapInJarvisLabel(r.in_jarvis) : 'ไม่มีเบอร์';
                  return (
                    <TableRow key={`${r.request_no}-${r.candidate_id}`}>
                      <TableCell>
                        <Checkbox
                          aria-label={`เลือก ${r.full_name}`}
                          checked={picked.has(r.candidate_id)}
                          disabled={!pickable(r)}
                          onCheckedChange={(v) => toggle(r.candidate_id, v === true)}
                        />
                      </TableCell>
                      {!jobId ? (
                        <TableCell className="min-w-40 text-sm">
                          {titleOf(r.request_no) ?? r.request_no}
                          {titleOf(r.request_no) ? <span className="block text-xs text-muted-foreground">{r.request_no}</span> : null}
                        </TableCell>
                      ) : null}
                      <TableCell className="min-w-36 text-sm font-medium">{r.full_name}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">{r.phone ?? EM_DASH}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{r.age ?? EM_DASH}</TableCell>
                      <TableCell className="text-sm">{r.gender ? GENDER[r.gender] : EM_DASH}</TableCell>
                      <TableCell className="text-sm">{r.province ?? EM_DASH}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{scrapPlatformLabel(r.platform)}</TableCell>
                      <TableCell className="text-xs">
                        <span className={cn('inline-block whitespace-nowrap rounded-full border px-2 py-0.5 font-medium', tone.soft, tone.value)}>
                          {SCRAP_RESULT_LABEL[r.result]}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-48 text-xs text-muted-foreground">{r.reasons.length ? r.reasons.map(scrapReasonLabel).join(' · ') : EM_DASH}</TableCell>
                      <TableCell className="min-w-32 text-xs">{status ?? EM_DASH}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            หน้า {page + 1} จาก {pages} · {shown.length} คน
          </span>
          <Button type="button" size="xs" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            ก่อนหน้า
          </Button>
          <Button type="button" size="xs" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
            ถัดไป
          </Button>
        </div>
      ) : null}
    </div>
  );
}
