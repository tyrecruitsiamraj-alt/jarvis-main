/**
 * งานส่งเอกสารผ่าน LINE ฝั่งเจ้าหน้าที่ — ตัวเรียก API (22 พ.ย. 2569)
 * ปุ่ม "ส่งเอกสาร" ในป๊อปผู้สมัคร (`/api/document-invitations`) · แท็บเอกสาร (`/api/document-packets`) · ตั้งค่า (`/api/document-settings`)
 * ไฟล์เบา — ห้าม import ข้อมูลที่อยู่/ตัวตรวจชุดเอกสารเข้ามา (หน้าเจ้าหน้าที่ไม่ต้องใช้)
 */
import { apiFetch, HttpError } from '@/lib/apiFetch';
import type { DocId } from './documentTypes';
import type { DocumentStatus } from './documentStatus';
import type { CreatedInvitation, DocumentDetail, DocumentList, ImportAttemptView, InvitationView } from './documentViews';

async function readJson<T>(r: Response): Promise<T> {
  const data = (await r.json().catch(() => null)) as (T & { message?: string; error?: string }) | null;
  if (!r.ok || !data) throw new HttpError(r.status, data?.message || data?.error || `ระบบตอบ ${r.status}`);
  return data;
}
const get = async <T>(url: string) => readJson<T>(await apiFetch(url, { cache: 'no-store' }));
const send = async <T>(url: string, method: 'POST' | 'PUT', body: unknown) =>
  readJson<T>(await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
const qs = (params: Record<string, string | number | null | undefined>) =>
  new URLSearchParams(Object.entries(params).flatMap(([k, v]) => (v === null || v === undefined || v === '' ? [] : [[k, String(v)]]))).toString();

export type FeatureState = { enabled: boolean; ready: boolean; problem: string | null };

// ─── ป๊อปผู้สมัคร ─────────────────────────────────────────────────────────────
export type ApplicationDocuments = {
  feature: FeatureState;
  application: { id: string; name: string; jobLabel: string | null };
  status: DocumentStatus | null;
  invitations: InvitationView[];
  latestPacketId: string | null;
};
export const fetchApplicationDocuments = (applicationId: string) => get<ApplicationDocuments>(`/api/document-invitations?${qs({ applicationId })}`);
export const createDocumentLink = (applicationId: string) => send<CreatedInvitation>('/api/document-invitations', 'POST', { applicationId });
export const revokeDocumentLink = (invitationId: string) => send<{ ok: true }>('/api/document-invitations', 'POST', { action: 'revoke', invitationId });

// ─── แท็บเอกสาร ──────────────────────────────────────────────────────────────
export type DocumentListResponse = DocumentList & { feature: FeatureState; irecruitConnected: boolean };
export const fetchDocumentList = (p: { page: number; pageSize: number; status?: string | null; q?: string | null }) =>
  get<DocumentListResponse>(`/api/document-packets?${qs(p)}`);
export const fetchDocumentDetail = (applicationId: string, packetId?: string | null) =>
  get<DocumentDetail>(`/api/document-packets?${qs({ applicationId, packetId })}`);

const packetAction = <T = { ok: true }>(body: Record<string, unknown>) => send<T>('/api/document-packets', 'POST', body);
export const flagPacket = (packetId: string, flag: boolean, note: string) => packetAction({ action: flag ? 'flag' : 'unflag', packetId, note });
export const acknowledgePacket = (packetId: string, note: string) => packetAction({ action: 'ack', packetId, note });
export const recordIrecruitImport = (packetId: string, department: string, externalId: string) =>
  packetAction<ImportAttemptView>({ action: 'import-record', packetId, department, externalId });
export const requestIrecruitImport = (packetId: string, department: string, idempotencyKey: string) =>
  packetAction<ImportAttemptView>({ action: 'import', packetId, department, idempotencyKey });
export const resolveIrecruitImport = (attemptId: string, result: { externalId: string } | { notFound: true }) =>
  packetAction<ImportAttemptView>({ action: 'import-resolve', attemptId, ...result });

export const packetFileUrl = (fileId: string) => `/api/document-packets?${qs({ file: fileId })}`;
export const packetPdfUrl = (packetId: string, doc: DocId, download = false) => `/api/document-packets?${qs({ pdf: doc, packetId, download: download ? 1 : null })}`;
export const packetTemplateUrl = (packetId: string, doc: DocId, page: number) => `/api/document-packets?${qs({ template: doc, page, packetId })}`;

// ─── ตั้งค่า ─────────────────────────────────────────────────────────────────
export type DocumentSettingsView = {
  enabled: boolean;
  ready: boolean;
  hasHistory: boolean;
  /** ต่อไปนี้มีเฉพาะผู้ดูแลระบบ */
  problems?: string[];
  mock?: boolean;
  lineChannelId?: string;
  liffId?: string;
  /** โมเดลอ่านบัตรบนเซิร์ฟเวอร์ Ollama ของบริษัท ('' = อ่านในมือถือ) · รายชื่อจากเซิร์ฟเวอร์จริง ไม่รวม :cloud */
  ocrModel?: string;
  ocrModels?: string[];
  ocrError?: string | null;
  irecruitConnected?: boolean;
  outbox?: { pending: number; failed: number };
  templates?: { docType: DocId; title: string; version: number | null; pages: number; updatedAt: string | null; updatedByName: string | null }[];
};
export const fetchDocumentSettings = () => get<DocumentSettingsView>('/api/document-settings');
export const saveDocumentSettings = (patch: { enabled?: boolean; lineChannelId?: string; liffId?: string; ocrModel?: string }) =>
  send<{ ok: true }>('/api/document-settings', 'PUT', patch);
export const uploadDocumentTemplate = (docType: DocId, pages: string[]) =>
  send<{ id: string; version: number; pageCount: number }>('/api/document-settings', 'POST', { action: 'template', docType, pages });
export const settingsTemplateUrl = (doc: DocId, page: number) => `/api/document-settings?${qs({ template: doc, page })}`;
