/**
 * ส่งเอกสาร — ในป๊อปข้อมูลผู้สมัคร แท็บข้อมูล (เจ้าของ 22 พ.ย. 2569)
 *
 * กด "ส่งเอกสาร" = สร้างลิงก์เฉพาะใบสมัครนี้ (อายุ 24 ชม.) แล้วคัดลอกไปส่ง LINE เอง · ระบบไม่ส่งข้อความ LINE ให้
 * ลิงก์เต็มได้ครั้งเดียวตอนสร้าง (ฐานเก็บแค่แฮช) — จำไว้ในหน้านี้จนปิดแท็บ ปิดป๊อปแล้วเปิดใหม่ยังคัดลอกได้
 * เห็นว่าใครเปิดลิงก์ (ชื่อ/รูป LINE · เวลา) ก่อนผู้สมัครส่งเอกสาร · ส่งแล้วกดเปิดชุดเอกสารได้ทันที
 * ไม่สร้างลิงก์เองตอนเปิดป๊อป · ระบบปิดอยู่และใบนี้ไม่เคยมีลิงก์ = ไม่แสดงอะไร (ป๊อปหน้าตาเดิม)
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TONE } from '@/lib/designTokens';
import { formatDateTimeTh } from '@/lib/dateTh';
import { cn } from '@/lib/utils';
import { DOCUMENT_STATUS_LABEL, invitationStateLabel } from '@/lib/documents/documentStatus';
import { documentsDeepLink } from '@/lib/documents/documentNotification';
import { createDocumentLink, fetchApplicationDocuments, revokeDocumentLink, type ApplicationDocuments } from '@/lib/documents/documentsStaffApi';
import type { InvitationView } from '@/lib/documents/documentViews';

/** ลิงก์เต็มที่สร้างในหน้านี้ (ตามรหัสลิงก์) — อยู่ในหน่วยความจำของแท็บเท่านั้น ไม่เขียนลงเครื่อง */
const createdUrls = new Map<string, string>();

function LineOpener({ line }: { line: NonNullable<InvitationView['line']> }) {
  return (
    <div className="flex items-center gap-2" data-testid="doc-line-opener">
      <Avatar className="h-8 w-8">
        {line.pictureUrl ? <AvatarImage src={line.pictureUrl} alt={`รูป LINE ${line.displayName}`} /> : null}
        <AvatarFallback className="text-xs">{line.displayName.slice(0, 1) || 'L'}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 text-xs">
        <p className="truncate text-sm text-foreground">
          LINE: {line.displayName || '—'}
          {line.pictureUrl ? null : <span className="text-muted-foreground"> · ไม่มีรูป</span>}
        </p>
        <p className="text-muted-foreground">
          เปิดครั้งแรก {formatDateTimeTh(line.firstOpenedAt)}
          {line.openCount > 1 ? ` · ล่าสุด ${formatDateTimeTh(line.lastOpenedAt)} · เปิด ${line.openCount} ครั้ง` : ''}
        </p>
      </div>
    </div>
  );
}

export default function SendDocumentsSection({ applicationId }: { applicationId: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<ApplicationDocuments | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchApplicationDocuments(applicationId));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'อ่านสถานะเอกสารไม่ได้');
    }
  }, [applicationId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadError && !data) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="send-documents-error">
        ส่งเอกสาร: {loadError}
      </p>
    );
  }
  if (!data?.feature) return null;
  const { feature } = data;
  const invitations = data.invitations ?? [];
  if (!feature.enabled && invitations.length === 0) return null;

  const latest = invitations[0] ?? null;
  const latestUrl = latest ? (createdUrls.get(latest.id) ?? null) : null;
  const latestUsable = latest && !latest.revokedAt && !latest.submittedAt && Date.parse(latest.expiresAt) > Date.now();
  const canCreate = feature.enabled && feature.ready;

  /** `quiet` = คัดลอกให้เองหลังสร้างลิงก์ (บางเครื่องไม่ให้คัดลอกหลังรอเซิร์ฟเวอร์ — ไม่ต้องเตือน มีปุ่มคัดลอกให้กดอยู่แล้ว) */
  const copy = async (url: string, id: string, quiet = false) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
    } catch {
      setCopied(null);
      if (quiet) return;
      // เครื่องไม่ให้คัดลอก — เลือกข้อความในช่องให้ กดค้างคัดลอกเองได้
      const el = document.getElementById(`doc-link-${id}`) as HTMLInputElement | null;
      el?.focus();
      el?.select();
      setError('คัดลอกอัตโนมัติไม่ได้ กดค้างที่ลิงก์แล้วเลือกคัดลอก');
    }
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const made = await createDocumentLink(applicationId);
      createdUrls.set(made.invitationId, made.url);
      await load();
      await copy(made.url, made.invitationId, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างลิงก์ไม่ได้');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      await revokeDocumentLink(id);
      createdUrls.delete(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ยกเลิกลิงก์ไม่ได้');
    } finally {
      setBusy(false);
    }
  };

  const openDocs = (packetId: string | null) => {
    navigate(documentsDeepLink(applicationId, packetId));
  };

  return (
    <section className="space-y-3 rounded-xl border border-border p-3" data-testid="send-documents">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">ส่งเอกสาร</p>
          <p className="text-xs text-muted-foreground" data-testid="send-documents-status">
            {data.status ? DOCUMENT_STATUS_LABEL[data.status] : 'ยังไม่ได้สร้างลิงก์'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.latestPacketId ? (
            <Button type="button" size="sm" variant="outline" onClick={() => openDocs(data.latestPacketId)} data-testid="open-documents">
              เปิดเอกสาร
            </Button>
          ) : null}
          {canCreate ? (
            <Button type="button" size="sm" disabled={busy} onClick={() => void create()} data-testid="create-document-link">
              <Send aria-hidden /> {latest ? 'สร้างลิงก์ใหม่' : 'ส่งเอกสาร'}
            </Button>
          ) : null}
        </div>
      </div>

      {!feature.enabled ? <p className="text-xs text-muted-foreground">ระบบส่งเอกสารปิดอยู่ ดูของเดิมได้อย่างเดียว</p> : null}
      {feature.enabled && !feature.ready ? <p className={cn('text-xs', TONE.warn.value)}>ยังสร้างลิงก์ไม่ได้: {feature.problem}</p> : null}

      {latest && latestUsable && latestUrl ? (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Input id={`doc-link-${latest.id}`} readOnly value={latestUrl} className="min-w-0 flex-1 text-xs" aria-label="ลิงก์ส่งเอกสาร" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" size="sm" variant="outline" onClick={() => void copy(latestUrl, latest.id)} data-testid="copy-document-link">
              <Copy aria-hidden /> {copied === latest.id ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">ส่งลิงก์นี้ให้ผู้สมัครใน LINE · ใช้ได้ถึง {formatDateTimeTh(latest.expiresAt)}</p>
        </div>
      ) : null}
      {latest && latestUsable && !latestUrl ? (
        <p className="text-xs text-muted-foreground">ลิงก์ล่าสุดใช้ได้ถึง {formatDateTimeTh(latest.expiresAt)} · ต้องการคัดลอกอีกครั้ง กด "สร้างลิงก์ใหม่"</p>
      ) : null}

      {error ? (
        <p className={cn('text-xs', TONE.danger.value)} role="alert">
          {error}
        </p>
      ) : null}

      {invitations.length ? (
        <ul className="space-y-2" data-testid="document-links">
          {invitations.map((inv, i) => {
            const state = invitationStateLabel({ id: inv.id, createdAt: inv.createdAt, expiresAt: inv.expiresAt, revokedAt: inv.revokedAt, firstOpenedAt: inv.line?.firstOpenedAt ?? null, submittedAt: inv.submittedAt });
            const usable = !inv.revokedAt && !inv.submittedAt && Date.parse(inv.expiresAt) > Date.now();
            return (
              <li key={inv.id} className="space-y-1.5 rounded-lg border border-border/70 p-2" data-testid={`document-link-${i}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    ลิงก์ที่ {inv.revision} · สร้าง {formatDateTimeTh(inv.createdAt)}
                    {inv.createdByName ? ` โดย ${inv.createdByName}` : ''}
                  </span>
                  <span className="text-foreground">{state}</span>
                </div>
                {inv.line ? <LineOpener line={inv.line} /> : null}
                <div className="flex flex-wrap gap-2">
                  {inv.packetId ? (
                    <Button type="button" size="xs" variant="outline" onClick={() => openDocs(inv.packetId)}>
                      เปิดชุดนี้
                    </Button>
                  ) : null}
                  {usable ? (
                    <Button type="button" size="xs" variant="outline" disabled={busy} onClick={() => void revoke(inv.id)}>
                      ยกเลิกลิงก์
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
