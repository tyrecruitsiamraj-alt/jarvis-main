/**
 * แผงชุดเอกสารของผู้สมัคร 1 คน — เปิดจากแท็บเอกสาร/กระดิ่ง/ป๊อปผู้สมัคร (เจ้าของ 22 พ.ย. 2569)
 *
 * เห็นชุดที่ส่งจริงทั้งชุด: ข้อมูลที่ผู้สมัครตรวจแล้ว · ภาพ 3 ใบ + ผล OCR · ช่องที่แก้จาก OCR · คำตอบ 5 ฉบับ + PDF รายฉบับ · ลายเซ็น · บัญชี LINE ผู้ส่ง
 * ข้อมูลครบ = พร้อมนำเข้า iRecruit ไม่ต้องกดอนุมัติทีละฉบับ · มีเรื่องต้องดู = แสดงเฉพาะจุด · ไม่ตัดสินรับ/ไม่รับเข้าทำงาน
 * iRecruit ยังไม่มีทางรับข้อมูลจากระบบ — HR คีย์ใน iRecruit เอง แล้วบันทึกเลขที่ที่นี่ ("นำเข้าแล้ว" ต้องมีเลขที่)
 */
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { TONE } from '@/lib/designTokens';
import { formatDateTimeTh, formatYmdTh } from '@/lib/dateTh';
import { cn } from '@/lib/utils';
import { DOCUMENT_STATUS_LABEL, invitationStateLabel } from '@/lib/documents/documentStatus';
import { IRECRUIT_DIVISIONS, SENDER_RELATION_LABEL, SIGNATURE_METHOD_LABEL, type DocId, type SenderRelation } from '@/lib/documents/documentTypes';
import type { DocumentDetail, PacketView } from '@/lib/documents/documentViews';
import {
  acknowledgePacket,
  fetchDocumentDetail,
  flagPacket,
  packetFileUrl,
  packetPdfUrl,
  packetTemplateUrl,
  recordIrecruitImport,
  requestIrecruitImport,
  resolveIrecruitImport,
} from '@/lib/documents/documentsStaffApi';

const EVENT_LABEL: Record<string, string> = {
  link_created: 'สร้างลิงก์',
  link_revoked: 'ยกเลิกลิงก์',
  opened: 'เปิดลิงก์',
  reopened: 'เปิดลิงก์อีกครั้ง',
  account_conflict: 'บัญชี LINE อื่นพยายามเปิดลิงก์',
  file_uploaded: 'แนบภาพ',
  file_replaced: 'แนบภาพใหม่แทนภาพเดิม',
  submitted: 'ส่งเอกสาร',
  review_flagged: 'ทำเครื่องหมายต้องแก้ไข',
  review_cleared: 'เอาเครื่องหมายต้องแก้ไขออก',
  attention_acknowledged: 'บันทึกว่าคุยกับผู้สมัครแล้ว',
  import_requested: 'สั่งนำเข้า iRecruit',
  import_result: 'ผลนำเข้า iRecruit',
  notification_delivered: 'แจ้งเจ้าหน้าที่แล้ว',
};
const IMPORT_STATUS_LABEL: Record<string, string> = { success: 'นำเข้าแล้ว', failed: 'ไม่สำเร็จ', pending: 'กำลังนำเข้า', unknown: 'ไม่รู้ผล ต้องตรวจใน iRecruit' };

/** วันที่ในชุด (YYYY-MM-DD) แสดงแบบไทย · ค่าอื่นแสดงตามที่ผู้สมัครส่ง */
const shown = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? formatYmdTh(v) : v);

const Section = ({ title, children, testId }: { title: string; children: React.ReactNode; testId?: string }) => (
  <section className="space-y-2" data-testid={testId}>
    <h3 className="text-sm font-medium text-foreground">{title}</h3>
    {children}
  </section>
);

function useAction(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ทำรายการไม่ได้');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function PacketBody({ packet, irecruitConnected, onChanged }: { packet: PacketView; irecruitConnected: boolean; onChanged: () => void }) {
  const [ackNote, setAckNote] = useState('');
  const [flagNote, setFlagNote] = useState('');
  const [division, setDivision] = useState('');
  const [externalId, setExternalId] = useState('');
  const [resolveId, setResolveId] = useState('');
  const action = useAction(onChanged);
  const imported = packet.imports.find((i) => i.status === 'success') ?? null;
  const unknown = packet.imports.find((i) => i.status === 'unknown' || i.status === 'pending') ?? null;
  const needsAck = packet.attention.length > 0 && !packet.attentionAck;

  if (packet.erased) {
    return <p className="text-sm text-muted-foreground">ชุดนี้ถูกลบข้อมูลตามคำขอข้อมูลส่วนบุคคลแล้ว</p>;
  }
  return (
    <div className="space-y-5">
      {packet.attention.length ? (
        <Section title="เรื่องที่ต้องดู" testId="packet-attention">
          <ul className={cn('list-disc space-y-1 rounded-xl border p-3 pl-7 text-sm', TONE.warn.soft, TONE.warn.value)}>
            {packet.attention.map((a) => (
              <li key={a.code + a.text}>{a.text}</li>
            ))}
          </ul>
          {packet.attentionAck ? (
            <p className="text-xs text-muted-foreground">
              คุยกับผู้สมัครแล้ว · {packet.attentionAck.byName ?? '—'} · {formatDateTimeTh(packet.attentionAck.at)}
              {packet.attentionAck.note ? ` · ${packet.attentionAck.note}` : ''}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Input className="min-w-0 flex-1" placeholder="บันทึกสั้น ๆ (ไม่ใส่ก็ได้)" maxLength={300} value={ackNote} onChange={(e) => setAckNote(e.target.value)} aria-label="บันทึกการคุยกับผู้สมัคร" />
              <Button type="button" size="sm" disabled={action.busy} onClick={() => void action.run(() => acknowledgePacket(packet.id, ackNote.trim()))} data-testid="packet-ack">
                บันทึกว่าคุยกับผู้สมัครแล้ว
              </Button>
            </div>
          )}
        </Section>
      ) : null}

      <Section title="ข้อมูลผู้สมัคร" testId="packet-person">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-xl border border-border p-3 text-sm sm:grid-cols-2">
          {packet.person.map((p) => (
            <div key={p.key} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{p.label}</dt>
              <dd className="break-words text-foreground">{shown(p.value)}</dd>
            </div>
          ))}
          {packet.addresses ? (
            <>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">ที่อยู่ตามทะเบียนบ้าน</dt>
                <dd className="break-words text-foreground">{packet.addresses.registered}</dd>
              </div>
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-xs text-muted-foreground">ที่อยู่ปัจจุบัน</dt>
                <dd className="break-words text-foreground">{packet.addresses.sameAsRegistered ? 'เหมือนทะเบียนบ้าน' : packet.addresses.current}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </Section>

      <Section title="ภาพที่แนบ" testId="packet-files">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {packet.files.map((f) => {
            const ocr = packet.ocr.find((o) => o.kind === f.kind);
            return (
              <div key={f.id} className="space-y-1.5">
                <a href={packetFileUrl(f.id)} target="_blank" rel="noreferrer" className="block">
                  <img src={packetFileUrl(f.id)} alt={f.label} className="w-full rounded-xl border border-border" />
                </a>
                <p className="text-xs text-foreground">{f.label}</p>
                {ocr && f.kind !== 'house' ? (
                  <p className="text-xs text-muted-foreground">
                    {ocr.status === 'read' ? `อ่านจากภาพ · ความมั่นใจ ${ocr.confidence ?? 0}%` : 'ไม่มีผลอ่านจากภาพ ผู้สมัครกรอกเอง'}
                  </p>
                ) : null}
                {ocr?.warnings.length ? (
                  <ul className={cn('list-disc space-y-0.5 pl-4 text-xs', TONE.warn.value)}>
                    {ocr.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
                {ocr?.text ? (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button type="button" variant="ghost" size="xs" className="px-0">
                        ข้อความที่อ่านได้ <ChevronDown aria-hidden />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-border p-2 text-xs text-foreground">{ocr.text}</pre>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </div>
            );
          })}
        </div>
        {packet.ocrEdits.length ? (
          <div className="space-y-1 rounded-xl border border-border p-3" data-testid="packet-ocr-edits">
            <p className="text-xs text-muted-foreground">ช่องที่ผู้สมัครแก้จากที่อ่านได้</p>
            {packet.ocrEdits.map((e) => (
              <p key={e.label} className="text-sm text-foreground">
                {e.label}: <span className="text-muted-foreground line-through">{shown(e.ocr)}</span> → {shown(e.final)}
              </p>
            ))}
          </div>
        ) : null}
      </Section>

      <Section title="เอกสาร" testId="packet-consents">
        <ul className="divide-y divide-border rounded-xl border border-border">
          {packet.consents.map((c) => (
            <li key={c.doc} className="space-y-1.5 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{c.title}</p>
                  <p className={cn('text-xs', c.followUp ? TONE.danger.value : TONE.success.value)}>{c.label}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button asChild size="xs" variant="outline">
                    <a href={packetPdfUrl(packet.id, c.doc as DocId)} target="_blank" rel="noreferrer">
                      เปิด PDF
                    </a>
                  </Button>
                  <Button asChild size="xs" variant="outline">
                    <a href={packetPdfUrl(packet.id, c.doc as DocId, true)}>ดาวน์โหลด</a>
                  </Button>
                </div>
              </div>
              {c.pages ? (
                <p className="text-xs text-muted-foreground">
                  ต้นฉบับรุ่น {c.templateVersion ?? '—'} ·{' '}
                  {Array.from({ length: c.pages }, (_, i) => (
                    <a key={i} href={packetTemplateUrl(packet.id, c.doc as DocId, i + 1)} target="_blank" rel="noreferrer" className="text-primary underline">
                      หน้า {i + 1}
                    </a>
                  )).reduce<React.ReactNode[]>((acc, el, i) => (i ? [...acc, ' · ', el] : [el]), [])}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      {packet.signature ? (
        <Section title="ลายเซ็น" testId="packet-signature">
          <div className="space-y-1 rounded-xl border border-border p-3">
            {packet.signature.method === 'drawn' && packet.signature.image ? (
              <img src={packet.signature.image} alt={`ลายเซ็น ${packet.signature.name}`} className="max-h-28 rounded-lg bg-white" />
            ) : (
              <p className="text-xl text-foreground">{packet.signature.name}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {SIGNATURE_METHOD_LABEL[packet.signature.method as 'typed' | 'drawn'] ?? packet.signature.method} · {packet.signature.name}
            </p>
          </div>
        </Section>
      ) : null}

      <Section title="ผู้ส่ง" testId="packet-sender">
        <div className="flex items-center gap-3">
          <Avatar>
            {packet.line.pictureUrl ? <AvatarImage src={packet.line.pictureUrl} alt={`รูป LINE ${packet.line.displayName}`} /> : null}
            <AvatarFallback>{packet.line.displayName.slice(0, 1) || 'L'}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-sm">
            <p className="truncate text-foreground">
              LINE: {packet.line.displayName}
              {packet.line.pictureUrl ? null : <span className="text-muted-foreground"> · ไม่มีรูป</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {SENDER_RELATION_LABEL[packet.line.senderRelation as SenderRelation] ?? packet.line.senderRelation} · ส่ง {formatDateTimeTh(packet.submittedAt)}
            </p>
          </div>
        </div>
      </Section>

      <Separator />
      <Section title="ต้องแก้ไข" testId="packet-flag">
        {packet.review.flag ? (
          <div className="space-y-2">
            <p className={cn('text-sm', TONE.danger.value)}>
              ต้องแก้ไข{packet.review.note ? `: ${packet.review.note}` : ''} · {packet.review.byName ?? '—'} · {packet.review.at ? formatDateTimeTh(packet.review.at) : ''}
            </p>
            <Button type="button" size="sm" variant="outline" disabled={action.busy} onClick={() => void action.run(() => flagPacket(packet.id, false, ''))}>
              ไม่ต้องแก้ไขแล้ว
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Input className="min-w-0 flex-1" placeholder="ต้องแก้อะไร" maxLength={300} value={flagNote} onChange={(e) => setFlagNote(e.target.value)} aria-label="สิ่งที่ต้องแก้ไข" />
            <Button type="button" size="sm" variant="outline" disabled={action.busy} onClick={() => void action.run(() => flagPacket(packet.id, true, flagNote.trim()))} data-testid="packet-flag-on">
              ทำเครื่องหมายต้องแก้ไข
            </Button>
          </div>
        )}
      </Section>

      <Section title="iRecruit" testId="packet-irecruit">
        {imported ? (
          <p className={cn('text-sm', TONE.success.value)} data-testid="packet-imported">
            นำเข้าแล้ว · เลขที่ {imported.externalId} · แผนก {imported.department} · {imported.requestedByName ?? '—'} · {formatDateTimeTh(imported.createdAt)}
          </p>
        ) : unknown ? (
          <div className="space-y-2">
            <p className={cn('text-sm', TONE.warn.value)}>{IMPORT_STATUS_LABEL[unknown.status]} · แผนก {unknown.department}</p>
            <div className="flex flex-wrap gap-2">
              <Input className="min-w-0 flex-1" placeholder="เลขที่ผู้สมัครใน iRecruit" maxLength={40} value={resolveId} onChange={(e) => setResolveId(e.target.value)} aria-label="เลขที่ผู้สมัครใน iRecruit" />
              <Button type="button" size="sm" disabled={action.busy || !resolveId.trim()} onClick={() => void action.run(() => resolveIrecruitImport(unknown.id, { externalId: resolveId.trim() }))}>
                พบแล้ว บันทึกเลขที่
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={action.busy} onClick={() => void action.run(() => resolveIrecruitImport(unknown.id, { notFound: true }))}>
                ไม่พบใน iRecruit
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>แผนก</Label>
                <Select value={division} onValueChange={setDivision}>
                  <SelectTrigger aria-label="แผนกใน iRecruit">
                    <SelectValue placeholder="เลือกแผนก" />
                  </SelectTrigger>
                  <SelectContent>
                    {IRECRUIT_DIVISIONS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>เลขที่ผู้สมัครใน iRecruit</Label>
                <Input maxLength={40} value={externalId} onChange={(e) => setExternalId(e.target.value)} aria-label="เลขที่ผู้สมัครใน iRecruit" data-testid="irecruit-external-id" />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={action.busy || !division || !externalId.trim()}
                onClick={() => void action.run(() => recordIrecruitImport(packet.id, division, externalId.trim()))}
                data-testid="irecruit-record"
              >
                บันทึกเลขที่ iRecruit
              </Button>
              {irecruitConnected ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={action.busy || !division}
                  onClick={() => void action.run(() => requestIrecruitImport(packet.id, division, crypto.randomUUID()))}
                >
                  นำเข้า iRecruit
                </Button>
              ) : null}
            </div>
          </div>
        )}
        {packet.imports.filter((i) => i !== imported).length ? (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {packet.imports
              .filter((i) => i !== imported)
              .map((i) => (
                <li key={i.id}>
                  {formatDateTimeTh(i.createdAt)} · {IMPORT_STATUS_LABEL[i.status] ?? i.status} · แผนก {i.department}
                  {i.error ? ` · ${i.error}` : ''}
                </li>
              ))}
          </ul>
        ) : null}
      </Section>
      {action.error ? (
        <p className={cn('text-sm', TONE.danger.value)} role="alert">
          {action.error}
        </p>
      ) : null}
    </div>
  );
}

export default function DocumentPacketSheet({
  applicationId,
  packetId,
  irecruitConnected,
  onClose,
  onSelectPacket,
  onChanged,
}: {
  applicationId: string | null;
  packetId: string | null;
  irecruitConnected: boolean;
  onClose: () => void;
  onSelectPacket: (packetId: string) => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!applicationId) {
      setDetail(null);
      setError(null);
      return;
    }
    let alive = true;
    setError(null);
    fetchDocumentDetail(applicationId, packetId)
      .then((d) => alive && setDetail(d))
      .catch((e: unknown) => {
        if (!alive) return;
        // ไม่มีสิทธิ์/ไม่พบ = ไม่โชว์ข้อมูลของใครเลย (ไม่เปิดชุดอื่นแทน)
        setDetail(null);
        setError(e instanceof Error ? e.message : 'เปิดเอกสารไม่ได้');
      });
    return () => {
      alive = false;
    };
  }, [applicationId, packetId, rev]);

  const view = detail && detail.application.id === applicationId ? detail : null;
  const changed = () => {
    setRev((n) => n + 1);
    onChanged();
  };

  return (
    <Sheet open={Boolean(applicationId)} onOpenChange={(o) => !o && onClose()}>
      {/* โฟกัสหลุดออกนอกแผง (เช่น toast ที่กดเปิดมาหายไป) ไม่ใช่การปิดแผง — ปิดด้วยปุ่มปิด กดพื้นหลัง หรือ Esc (DOC-064) */}
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl" data-testid="document-sheet" onFocusOutside={(e) => e.preventDefault()}>
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle>{view?.application.name ?? 'เอกสารผู้สมัคร'}</SheetTitle>
          <SheetDescription>
            {view ? [view.application.jobLabel, view.application.bu, view.status ? DOCUMENT_STATUS_LABEL[view.status] : null].filter(Boolean).join(' · ') : error ? '' : 'กำลังโหลด…'}
          </SheetDescription>
        </SheetHeader>

        {error ? (
          <p className={cn('mt-4 text-sm', TONE.danger.value)} role="alert" data-testid="document-sheet-error">
            {error}
          </p>
        ) : null}

        {view ? (
          <div className="mt-4 space-y-5">
            <Section title="ลิงก์" testId="sheet-links">
              <ul className="space-y-2">
                {view.invitations.map((inv) => (
                  <li key={inv.id} className="space-y-1.5 rounded-xl border border-border p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        ลิงก์ที่ {inv.revision} · สร้าง {formatDateTimeTh(inv.createdAt)}
                        {inv.createdByName ? ` โดย ${inv.createdByName}` : ''}
                        {inv.revokedAt ? ` · ยกเลิก ${formatDateTimeTh(inv.revokedAt)}${inv.revokedByName ? ` โดย ${inv.revokedByName}` : ''}` : ''}
                      </span>
                      <span className="text-foreground">
                        {invitationStateLabel({ id: inv.id, createdAt: inv.createdAt, expiresAt: inv.expiresAt, revokedAt: inv.revokedAt, firstOpenedAt: inv.line?.firstOpenedAt ?? null, submittedAt: inv.submittedAt })}
                      </span>
                    </div>
                    {inv.line ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          {inv.line.pictureUrl ? <AvatarImage src={inv.line.pictureUrl} alt={`รูป LINE ${inv.line.displayName}`} /> : null}
                          <AvatarFallback className="text-xs">{inv.line.displayName.slice(0, 1) || 'L'}</AvatarFallback>
                        </Avatar>
                        <p className="min-w-0 text-foreground">
                          LINE: {inv.line.displayName || '—'}
                          {inv.line.pictureUrl ? '' : ' · ไม่มีรูป'} · เปิดครั้งแรก {formatDateTimeTh(inv.line.firstOpenedAt)}
                          {inv.line.openCount > 1 ? ` · ล่าสุด ${formatDateTimeTh(inv.line.lastOpenedAt)}` : ''}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">ยังไม่มีผู้เปิดลิงก์นี้</p>
                    )}
                  </li>
                ))}
              </ul>
            </Section>

            {view.packets.length > 1 ? (
              <div className="flex flex-wrap gap-2" role="tablist" aria-label="ชุดที่ส่ง">
                {view.packets.map((p, i) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="xs"
                    role="tab"
                    aria-selected={view.packet?.id === p.id}
                    variant={view.packet?.id === p.id ? 'default' : 'outline'}
                    onClick={() => onSelectPacket(p.id)}
                  >
                    ชุดที่ {view.packets.length - i} · {formatDateTimeTh(p.submittedAt)}
                  </Button>
                ))}
              </div>
            ) : null}

            {view.packet ? (
              <PacketBody key={view.packet.id} packet={view.packet} irecruitConnected={irecruitConnected} onChanged={changed} />
            ) : (
              <p className="text-sm text-muted-foreground">ยังไม่ได้ส่งเอกสาร</p>
            )}

            {view.events.length ? (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="px-0">
                    ประวัติ <ChevronDown aria-hidden />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="space-y-1 text-xs text-muted-foreground" data-testid="sheet-events">
                    {view.events.map((e, i) => (
                      <li key={`${e.type}-${e.at}-${i}`}>
                        {formatDateTimeTh(e.at)} · {EVENT_LABEL[e.type] ?? e.type}
                        {e.actorName ? ` · ${e.actorName}` : ''}
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
