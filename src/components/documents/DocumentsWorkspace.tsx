/**
 * แท็บ "เอกสาร" ของงานสรรหา — ผู้สมัครที่มีลิงก์ส่งเอกสาร 1 แถวต่อคน + แผงชุดที่ส่ง (เจ้าของ 22 พ.ย. 2569)
 *
 * ลิงก์จากกระดิ่ง/ป๊อปผู้สมัคร: `?view=documents&applicationId=&packetId=` = เปิดแผงของคนนั้นและชุดนั้นทันที ไม่ต้องค้นหา
 * เปิดลิงก์ ≠ ส่งเอกสาร ≠ นำเข้า iRecruit · ชื่อตามเอกสารกับชื่อบัญชี LINE แยกกันเสมอ · อ่านแจ้งเตือนไม่เปลี่ยนสถานะเอกสาร
 * สิทธิ์ BU ตรวจที่เซิร์ฟเวอร์ทุกคำขอ (รวมภาพและ PDF) · หน้านี้โหลดเมื่อเปิดแท็บเท่านั้น
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import DocumentPacketSheet from '@/components/documents/DocumentPacketSheet';
import { useHeaderSearch } from '@/hooks/useHeaderSearch';
import { TONE } from '@/lib/designTokens';
import { formatDateTimeTh } from '@/lib/dateTh';
import { DEFAULT_PAGE_SIZE, getTotalPages, type PageSizeOption } from '@/lib/pagination';
import { cn } from '@/lib/utils';
import { DOCUMENT_STATUSES, DOCUMENT_STATUS_LABEL, type DocumentStatus } from '@/lib/documents/documentStatus';
import { parseDocumentsDeepLink } from '@/lib/documents/documentNotification';
import { fetchDocumentList, type DocumentListResponse } from '@/lib/documents/documentsStaffApi';

/** สีป้ายสถานะ — คำบอกสถานะเสมอ สีเป็นตัวช่วย */
export const STATUS_TONE: Record<DocumentStatus, string> = {
  not_opened: TONE.neutral.value,
  opened: TONE.info.value,
  needs_fix: TONE.danger.value,
  ready: TONE.success.value,
  imported: TONE.violet.value,
  link_expired: TONE.neutral.value,
  link_revoked: TONE.neutral.value,
};

export default function DocumentsWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { applicationId, packetId } = parseDocumentsDeepLink(searchParams);
  const [status, setStatus] = useState<DocumentStatus | 'all'>('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(DEFAULT_PAGE_SIZE);
  const [data, setData] = useState<DocumentListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rev, setRev] = useState(0);

  useHeaderSearch({ value: q, onChange: setQ, placeholder: 'ค้นหาชื่อผู้สมัคร หรือใบขอ…' });
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(q.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchDocumentList({ page, pageSize, status: status === 'all' ? null : status, q: query || null })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : 'โหลดรายการไม่ได้'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page, pageSize, status, query, rev]);

  const counts = useMemo(() => {
    const c = data?.counts ?? {};
    const all = DOCUMENT_STATUSES.reduce((n, s) => n + (c[s] ?? 0), 0);
    return { all, ...Object.fromEntries(DOCUMENT_STATUSES.map((s) => [s, c[s] ?? 0])) } as Record<DocumentStatus | 'all', number>;
  }, [data]);

  const openDetail = (appId: string, pId: string | null) => {
    const next = new URLSearchParams(searchParams);
    next.set('applicationId', appId);
    if (pId) next.set('packetId', pId);
    else next.delete('packetId');
    setSearchParams(next);
  };
  const closeDetail = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('applicationId');
    next.delete('packetId');
    setSearchParams(next);
  }, [searchParams, setSearchParams]);
  const selectPacket = (pId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('packetId', pId);
    setSearchParams(next, { replace: true });
  };

  const total = data?.total ?? 0;
  const totalPages = getTotalPages(total, pageSize);
  const items = data?.items ?? [];

  return (
    <div className="space-y-3" data-testid="documents-workspace">
      {data && !data.feature.enabled ? (
        <p className="text-sm text-muted-foreground">ระบบส่งเอกสารปิดอยู่ · ดูเอกสารเดิมได้</p>
      ) : null}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="สถานะเอกสาร">
        {(['all', ...DOCUMENT_STATUSES] as const).map((s) => (
          <Button
            key={s}
            type="button"
            size="xs"
            role="tab"
            aria-selected={status === s}
            variant={status === s ? 'default' : 'outline'}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            data-testid={`documents-status-${s}`}
          >
            {s === 'all' ? 'ทั้งหมด' : DOCUMENT_STATUS_LABEL[s]}
            <span className="tabular-nums">{counts[s]}</span>
          </Button>
        ))}
      </div>

      {error ? (
        <p className={cn('text-sm', TONE.danger.value)} role="alert">
          {error}
        </p>
      ) : null}

      <Card className="rounded-2xl p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ผู้สมัคร</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead>บัญชี LINE ผู้เปิดลิงก์</TableHead>
              <TableHead>ส่งเอกสาร</TableHead>
              <TableHead>ลิงก์</TableHead>
              <TableHead>BU</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {loading ? 'กำลังโหลด…' : 'ไม่มีรายการ'}
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => (
                <TableRow key={it.applicationId} className="cursor-pointer" onClick={() => openDetail(it.applicationId, it.packetId)} data-testid="documents-row">
                  <TableCell className="min-w-44">
                    <Button type="button" variant="link" className="h-auto p-0 text-left text-sm font-medium" onClick={(e) => { e.stopPropagation(); openDetail(it.applicationId, it.packetId); }}>
                      {it.applicantName}
                    </Button>
                    {it.jobLabel ? <p className="text-xs text-muted-foreground">{it.jobLabel}</p> : null}
                  </TableCell>
                  <TableCell className={cn('min-w-36 text-sm', STATUS_TONE[it.status])}>{DOCUMENT_STATUS_LABEL[it.status]}</TableCell>
                  <TableCell className="min-w-44">
                    {it.line ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          {it.line.pictureUrl ? <AvatarImage src={it.line.pictureUrl} alt={`รูป LINE ${it.line.displayName}`} /> : null}
                          <AvatarFallback className="text-xs">{it.line.displayName.slice(0, 1) || 'L'}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 text-xs">
                          <p className="truncate text-sm text-foreground">{it.line.displayName || '—'}</p>
                          <p className="text-muted-foreground">เปิด {formatDateTimeTh(it.line.firstOpenedAt)}</p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">ยังไม่มีผู้เปิด</span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-32 text-xs tabular-nums">{it.submittedAt ? formatDateTimeTh(it.submittedAt) : '—'}</TableCell>
                  <TableCell className="min-w-36 text-xs text-muted-foreground">
                    {formatDateTimeTh(it.linkCreatedAt)}
                    {it.linkCreatedByName ? <p>โดย {it.linkCreatedByName}</p> : null}
                  </TableCell>
                  <TableCell className="text-xs">{it.bu ?? '—'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <ListPaginationBar
        page={page}
        pageSize={pageSize}
        totalItems={total}
        totalPages={totalPages}
        pageFrom={total === 0 ? 0 : (page - 1) * pageSize + 1}
        pageTo={Math.min(page * pageSize, total)}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      <DocumentPacketSheet
        applicationId={applicationId}
        packetId={packetId}
        irecruitConnected={data?.irecruitConnected ?? false}
        onClose={closeDetail}
        onSelectPacket={selectPacket}
        onChanged={() => setRev((n) => n + 1)}
      />
    </div>
  );
}
