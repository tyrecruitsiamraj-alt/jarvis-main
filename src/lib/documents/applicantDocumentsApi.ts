/**
 * หน้าส่งเอกสารของผู้สมัคร — ตัวเรียก `/api/public/applicant-documents` (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 * สิทธิ์อยู่ในคุกกี้ HttpOnly ที่เซิร์ฟเวอร์ตั้งตอนเปิดลิงก์ — หน้าเว็บไม่ถือรหัสอะไรนอกจาก `k` (คีย์ของลิงก์ที่เปิดอยู่)
 */
import type { ApplicantState, DraftFileView } from './documentViews';
import type { DocId, UploadKind } from './documentTypes';
import type { OcrResult } from './ocrFields';

const BASE = '/api/public/applicant-documents';

export class ApplicantApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(url: string, body?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApplicantApiError(0, 'network', 'เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง');
  }
  const data = (await r.json().catch(() => null)) as (T & { error?: string; message?: string }) | null;
  if (!r.ok || !data) throw new ApplicantApiError(r.status, data?.error ?? 'error', data?.message ?? 'ทำรายการไม่ได้ ลองอีกครั้ง');
  return data;
}

const q = (params: Record<string, string | number>) =>
  `${BASE}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}`;

/** serverOcr = อ่านบัตรด้วยโมเดลบนเซิร์ฟเวอร์ของบริษัทก่อน (ตั้งโมเดลไว้ที่หน้าตั้งค่า) · ไม่ได้ = อ่านในมือถือ */
export type ApplicantConfig = { enabled: boolean; liffId: string; mock: boolean; serverOcr?: boolean };
export const fetchApplicantConfig = () => call<ApplicantConfig>(q({ action: 'config' }));
export const openApplicantSession = (invitation: string, idToken: string) => call<ApplicantState>(BASE, { action: 'session', invitation, idToken });
export const fetchApplicantState = (k: string) => call<ApplicantState>(q({ action: 'state', k }));

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
export const uploadApplicantImage = async (k: string, kind: UploadKind, blob: Blob) =>
  call<DraftFileView>(BASE, { action: 'upload', k, kind, dataBase64: await blobToBase64(blob) });

/** อ่านภาพที่แนบไว้ด้วยโมเดลบนเซิร์ฟเวอร์ของบริษัท (ราว 40 วินาที) — ล้ม = ผู้เรียกใช้ตัวอ่านในมือถือแทน */
export const readApplicantImageOnServer = (k: string, id: string) => call<OcrResult>(BASE, { action: 'ocr', k, id });

export type SubmitResult = { packetId: string; submittedAt: string; already: boolean };
export const submitApplicantPacket = (k: string, packet: Record<string, unknown>) => call<SubmitResult>(BASE, { ...packet, action: 'submit', k });

export type ApplicantReceipt = { packetId: string; submittedAt: string; personName: string; consents: Record<string, string> };
export const fetchApplicantReceipt = (k: string) => call<ApplicantReceipt>(q({ action: 'receipt', k }));

export const applicantFileUrl = (k: string, id: string) => q({ action: 'file', k, id });
export const applicantTemplateUrl = (k: string, doc: DocId, page: number) => q({ action: 'template', k, doc, page });
export const applicantPdfUrl = (k: string, doc: DocId) => q({ action: 'pdf', k, doc });
