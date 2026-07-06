import { apiFetch } from '@/lib/apiFetch';
import { readErrorMessage, readJsonSafe } from '@/lib/api';

export type OplImportResult = {
  dryRun: boolean;
  sheets: string[];
  excelSiteCount: number;
  openRequestCount: number;
  assignedCount: number;
  matchedSiteCount: number;
  unmatchedRequestCount: number;
  excelOnlySiteCount: number;
  oplNames: string[];
  inserted: number;
  updated: number;
  sample: Array<{ request_no: string; site_code: string; opl_name: string }>;
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error ?? new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

export async function importOplFromExcelFile(
  file: File,
  options?: { dryRun?: boolean },
): Promise<OplImportResult> {
  const file_base64 = await fileToBase64(file);
  const r = await apiFetch('/api/siamraj/opl-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_base64, dry_run: options?.dryRun ?? false }),
  });
  if (!r.ok) throw new Error(await readErrorMessage(r, 'นำเข้า OPL ไม่สำเร็จ'));
  return readJsonSafe<OplImportResult>(r);
}
