import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { importOplFromExcelFile, type OplImportResult } from '@/lib/oplImportApi';
import {
  JOB_STAFF_ROSTER_CHANGED_EVENT,
  refreshJobStaffFromApi,
} from '@/lib/jobStaffRemote';

const OplExcelImportPanel: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<OplImportResult | null>(null);
  const [done, setDone] = useState<OplImportResult | null>(null);

  const pickFile = (f: File | null) => {
    setFile(f);
    setPreview(null);
    setDone(null);
    setError(null);
  };

  const run = async (dryRun: boolean) => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await importOplFromExcelFile(file, { dryRun });
      if (dryRun) {
        setPreview(result);
        setDone(null);
      } else {
        setDone(result);
        setPreview(null);
        await refreshJobStaffFromApi();
        window.dispatchEvent(new Event(JOB_STAFF_ROSTER_CHANGED_EVENT));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'นำเข้าไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const Summary: React.FC<{ data: OplImportResult; title: string }> = ({ data, title }) => (
    <div className="rounded-xl border border-border/70 bg-secondary/20 p-3 space-y-2 text-sm">
      <p className="font-medium text-foreground">{title}</p>
      <ul className="text-xs text-muted-foreground space-y-1">
        <li>ชีตที่ใช้: {data.sheets.join(', ') || '—'}</li>
        <li>ไซต์ใน Excel: {data.excelSiteCount}</li>
        <li>ใบขอเปิดใน DB: {data.openRequestCount}</li>
        <li>จะใส่ OPL ให้: <strong className="text-foreground">{data.assignedCount}</strong> ใบขอ ({data.matchedSiteCount} ไซต์)</li>
        <li>ใบขอที่ไซต์ไม่อยู่ใน Excel: {data.unmatchedRequestCount}</li>
        <li>ไซต์ใน Excel ที่ไม่มีใบขอเปิด: {data.excelOnlySiteCount}</li>
        <li>ชื่อ OPL: {data.oplNames.join(', ') || '—'}</li>
        {!data.dryRun && (
          <li>
            บันทึกแล้ว — เพิ่มใหม่ {data.inserted}, อัปเดต {data.updated}
          </li>
        )}
      </ul>
      {data.sample.length > 0 ? (
        <div className="text-[11px] text-muted-foreground border-t border-border/50 pt-2">
          <p className="font-medium mb-1">ตัวอย่าง (10 รายการแรก)</p>
          {data.sample.map((row) => (
            <div key={row.request_no}>
              {row.request_no} · {row.site_code} → {row.opl_name}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="glass-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-start gap-2">
        <FileSpreadsheet className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-foreground text-sm">นำเข้าเจ้าหน้าที่ OPL จาก Excel</h3>
          <p className="text-xs text-muted-foreground mt-1">
            อัปโหลดไฟล์ Site update (.xls / .xlsx) — จับคู่ด้วย <code className="text-[10px]">site_code</code> กับใบขอจาก DB แล้วใส่ช่อง OPL อัตโนมัติ
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="text-sm px-3 py-2 rounded-lg border border-border bg-background hover:bg-secondary/50 inline-flex items-center gap-1.5"
        >
          <Upload className="w-4 h-4" />
          เลือกไฟล์
        </button>
        {file ? (
          <span className="text-xs text-muted-foreground truncate max-w-[240px]">{file.name}</span>
        ) : (
          <span className="text-xs text-muted-foreground">ยังไม่ได้เลือกไฟล์</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!file || busy}
          onClick={() => void run(true)}
          className={cn(
            'text-sm px-4 py-2 rounded-lg border border-border',
            !file || busy ? 'opacity-50' : 'hover:bg-secondary/50',
          )}
        >
          {busy ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="w-4 h-4 animate-spin" /> กำลังตรวจสอบ…
            </span>
          ) : (
            'ดูผลก่อนนำเข้า'
          )}
        </button>
        <button
          type="button"
          disabled={!file || busy}
          onClick={() => {
            if (!window.confirm('นำเข้า OPL ตามไฟล์นี้เลย?\nจะอัปเดตเฉพาะช่องเจ้าหน้าที่ OPL')) return;
            void run(false);
          }}
          className={cn('text-sm px-4 py-2 jarvis-pill-btn', (!file || busy) && 'opacity-50')}
        >
          นำเข้าจริง
        </button>
      </div>

      {error ? (
        <p className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
          {error}
        </p>
      ) : null}

      {preview ? <Summary data={preview} title="ผลตรวจสอบ (ยังไม่บันทึก)" /> : null}
      {done ? <Summary data={done} title="นำเข้าสำเร็จ" /> : null}
    </div>
  );
};

export default OplExcelImportPanel;
