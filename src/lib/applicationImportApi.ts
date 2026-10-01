/**
 * นำเข้าผู้สมัครจาก Excel — ฝั่งหน้าเว็บ (เส้น `/api/job-applications-import` · 1 ต.ค. 2569)
 * ไฟล์ตัวอย่างสร้างที่ API (SheetJS อยู่ฝั่ง server ตัวเดียว ไม่ต้องลากเข้าหน้าเว็บ)
 */
import { apiFetch } from '@/lib/apiFetch';
import type { ImportPreviewRow } from '@/lib/applicantImport';

export type ApplicationImportResult = {
  dryRun: boolean;
  rows: ImportPreviewRow[];
  /** dry run = พร้อมบันทึกกี่แถว */
  ready?: number;
  /** บันทึกจริง = บันทึกได้กี่แถว */
  inserted?: number;
  skipped: number;
};

async function readError(r: Response, fallback: string): Promise<string> {
  const body = (await r.json().catch(() => null)) as { message?: string } | null;
  return body?.message || fallback;
}

/** อ่านไฟล์เป็น base64 (ไม่รวม data: prefix) */
export function readFileAsBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const comma = res.indexOf(',');
      resolve(comma >= 0 ? res.slice(comma + 1) : res);
    };
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(f);
  });
}

/** ดาวน์โหลดไฟล์ตัวอย่าง (.xlsx) — สร้าง blob แล้วกดลิงก์ให้ (คืนหน่วยความจำทันที) */
export async function downloadApplicationImportTemplate(): Promise<void> {
  const r = await apiFetch('/api/job-applications-import');
  if (!r.ok) throw new Error(await readError(r, 'ดาวน์โหลดไฟล์ตัวอย่างไม่สำเร็จ'));
  const { filename, mime, dataBase64 } = (await r.json()) as { filename: string; mime: string; dataBase64: string };
  const bytes = Uint8Array.from(atob(dataBase64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function runApplicationImport(input: {
  fileBase64: string;
  dryRun: boolean;
  responsibleName?: string | null;
  channelId?: string | null;
  channelLabel?: string | null;
}): Promise<ApplicationImportResult> {
  const r = await apiFetch('/api/job-applications-import', {
    method: 'POST',
    body: JSON.stringify({
      file_base64: input.fileBase64,
      dry_run: input.dryRun,
      responsible_name: input.responsibleName ?? null,
      channel_id: input.channelId ?? null,
      channel_label: input.channelLabel ?? null,
    }),
  });
  if (!r.ok) throw new Error(await readError(r, input.dryRun ? 'อ่านไฟล์ไม่สำเร็จ' : 'นำเข้าไม่สำเร็จ'));
  return (await r.json()) as ApplicationImportResult;
}
