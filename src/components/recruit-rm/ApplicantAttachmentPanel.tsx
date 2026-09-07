/**
 * ═══ ไฟล์แนบของผู้สมัคร — เปิดดูได้จริงในป๊อป "ดูรายละเอียด" ═══
 *
 * เจ้าของแจ้ง 7 ก.ย. 2569: กดปุ่มตา "ดูรายละเอียด" แล้ว *"มีไฟล์แนบมาแต่ดูไม่ได้"*
 * ต้นเหตุ: ป๊อปรายละเอียดไม่เคยวาดส่วนไฟล์แนบเลย (ตารางขึ้นไอคอน 📄 อยู่ แต่ในป๊อป
 * ไม่มีทั้งลิงก์และปุ่ม) — เส้น `/api/job-application-document` มีอยู่และทำงานปกติ
 *
 * กติกาที่ยึด:
 * - 🔴 **ห้ามซ้อน Dialog ใน Dialog** ⇒ พรีวิวอยู่ในเนื้อป๊อปเดิม + มีลิงก์เปิดแท็บใหม่
 * - โหลด **เมื่อกดเท่านั้น** — ไฟล์เป็น base64 ก้อนใหญ่ ไม่ควรลากมาทุกครั้งที่เปิดคน
 * - `blob:` ไม่ใช่ `data:` (เบราว์เซอร์บล็อก data: URL ในแท็บใหม่/iframe)
 * - เส้น API เป็น GET อ่านอย่างเดียว + RBAC + จำกัด BU ของเดิม — ไม่แตะ ไม่เปิด public
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { fetchApplicationDocument } from '@/lib/publicApplicationsApi';
import {
  attachmentFilename,
  attachmentKind,
  attachmentKindLabel,
  base64ToBlob,
  type AttachmentKind,
} from '@/lib/applicantDocument';
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react';

type Loaded = { url: string; filename: string; mime: string; kind: AttachmentKind };

export default function ApplicantAttachmentPanel({
  applicationId,
  hasDocument,
  filename,
  mime,
}: {
  applicationId: string;
  /** จาก `/api/job-applications` (`document_bytes is not null`) — `false`/ไม่มี = ไม่วาดอะไรเลย */
  hasDocument?: boolean;
  filename?: string;
  mime?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<Loaded | null>(null);
  /** เก็บ URL ไว้คืนหน่วยความจำ — ไม่ revoke = ไฟล์ค้างในแท็บจนกว่าจะรีเฟรช */
  const urlRef = useRef<string | null>(null);

  const release = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  };

  // เปิดคนใหม่ = ล้างของคนเก่าเสมอ (ไม่งั้นไฟล์คนก่อนค้างอยู่ในป๊อปของคนถัดไป)
  useEffect(() => {
    setDoc(null);
    setError(null);
    setBusy(false);
    release();
    return release;
  }, [applicationId]);

  if (hasDocument !== true) return null;

  const shownName = attachmentFilename(filename);

  const load = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const d = await fetchApplicationDocument(applicationId);
      release();
      const blob = base64ToBlob(d.dataBase64, d.mime);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setDoc({
        url,
        filename: attachmentFilename(d.filename),
        mime: d.mime,
        kind: attachmentKind(d.mime, d.filename),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เปิดไฟล์แนบไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn('space-y-2 rounded-xl border px-3 py-2.5 text-xs', TONE.neutral.soft)}>
      <div className="flex items-center gap-2">
        <FileText className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground" title={shownName}>
          {shownName}
        </span>
        <span className={cn('shrink-0 text-[10px]', DASH.muted)}>
          {attachmentKindLabel(doc ? doc.kind : attachmentKind(mime, filename))}
        </span>
      </div>

      {doc ? (
        <>
          {/* พรีวิวในป๊อปเดิม — ไม่เปิด Dialog ซ้อน Dialog */}
          {doc.kind === 'image' ? (
            <img
              src={doc.url}
              alt={`ไฟล์แนบของผู้สมัคร — ${doc.filename}`}
              className="max-h-[50vh] w-full rounded-lg border border-border object-contain"
            />
          ) : doc.kind === 'pdf' ? (
            <iframe
              src={doc.url}
              title={`ไฟล์แนบของผู้สมัคร — ${doc.filename}`}
              className="h-[50vh] w-full rounded-lg border border-border bg-white"
            />
          ) : (
            <p className={DASH.muted}>
              ไฟล์ชนิดนี้เปิดดูในหน้านี้ไม่ได้ — กด "เปิดแท็บใหม่" หรือ "ดาวน์โหลด"
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {/*
              🔴 เป็น <a> ไม่ใช่ window.open() — เปิดแท็บหลัง await จะโดน popup blocker
              (ผู้ใช้กดลิงก์เอง = user gesture จริง เบราว์เซอร์ไม่บล็อก)
            */}
            <a
              href={doc.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" aria-hidden /> เปิดแท็บใหม่
            </a>
            <a
              href={doc.url}
              download={doc.filename}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <Download className="h-3 w-3" aria-hidden /> ดาวน์โหลด
            </a>
          </div>
        </>
      ) : (
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={() => void load()}
          disabled={busy}
          className="justify-center"
        >
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null} เปิดดูไฟล์แนบ
        </Button>
      )}

      {error ? <p className={cn('text-[11px]', TONE.danger.value)}>{error}</p> : null}
    </div>
  );
}
