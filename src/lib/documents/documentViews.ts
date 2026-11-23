/**
 * รูปข้อมูลที่เซิร์ฟเวอร์ส่งให้หน้าจอของงานส่งเอกสารผ่าน LINE (22 พ.ย. 2569) — เซิร์ฟเวอร์กับหน้าเว็บใช้ไฟล์เดียวกัน
 * ไฟล์นี้มีแต่ type (ไม่ลากข้อมูลที่อยู่) หน้าเจ้าหน้าที่ import ได้
 */
import type { DocId, UploadKind } from './documentTypes';
import type { DocumentStatus } from './documentStatus';

export type ApplicantDocumentView = { id: DocId; title: string; answers: { value: string; label: string }[]; pages: number; hash: string };

export type DraftFileView = { id: string; kind: UploadKind; mime: string; size: number; sha256: string };

export type ApplicantState = {
  inviteKey: string;
  applicant: { name: string; jobLabel: string | null; bu: string | null };
  profile: { displayName: string; pictureUrl: string | null };
  expiresAt: string;
  formVersion: string;
  noticeVersion: string;
  documents: ApplicantDocumentView[];
  drafts: DraftFileView[];
  submitted: { packetId: string; submittedAt: string } | null;
};

export type CreatedInvitation = { invitationId: string; revision: number; url: string; expiresAt: string };

export type DocumentListItem = {
  applicationId: string;
  applicantName: string;
  jobLabel: string | null;
  bu: string | null;
  status: DocumentStatus;
  linkCreatedAt: string;
  linkCreatedByName: string | null;
  linkExpiresAt: string;
  line: { displayName: string; pictureUrl: string | null; firstOpenedAt: string; lastOpenedAt: string } | null;
  packetId: string | null;
  submittedAt: string | null;
  personName: string | null;
};

export type DocumentList = {
  items: DocumentListItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
};

export type InvitationView = {
  id: string;
  revision: number;
  createdAt: string;
  createdByName: string | null;
  expiresAt: string;
  revokedAt: string | null;
  revokedByName: string | null;
  /** บัญชี LINE ที่เปิดลิงก์นี้ — ลิงก์ที่ยังไม่มีใครเปิด = null (ไม่เอาบัญชีของลิงก์เก่ามาแสดง) */
  line: { userId: string; displayName: string; pictureUrl: string | null; verifiedAt: string | null; firstOpenedAt: string; lastOpenedAt: string; openCount: number } | null;
  packetId: string | null;
  submittedAt: string | null;
};

export type PacketSummary = { id: string; revision: number; submittedAt: string; personName: string; erased: boolean };

export type ImportAttemptView = {
  id: string;
  department: string;
  mode: string;
  status: string;
  externalId: string | null;
  error: string | null;
  requestedByName: string | null;
  createdAt: string;
};

export type PacketView = {
  id: string;
  invitationId: string;
  revision: number;
  submittedAt: string;
  formVersion: string;
  payloadHash: string;
  erased: boolean;
  personName: string;
  person: { key: string; label: string; value: string }[];
  addresses: { registered: string; current: string; sameAsRegistered: boolean } | null;
  consents: { doc: string; title: string; answer: string; label: string; followUp: boolean; templateVersion: number | null; pages: number }[];
  signature: { method: string; name: string; image: string } | null;
  files: { id: string; kind: UploadKind; label: string; mime: string; size: number; sha256: string }[];
  ocr: { kind: UploadKind; label: string; status: string; confidence: number | null; warnings: string[]; text: string }[];
  /** ช่องที่ผู้สมัครแก้จากที่ OCR อ่านได้ */
  ocrEdits: { label: string; ocr: string; final: string }[];
  attention: { code: string; text: string }[];
  line: { userId: string; displayName: string; pictureUrl: string | null; verifiedAt: string; senderRelation: string };
  review: { flag: boolean; note: string | null; byName: string | null; at: string | null };
  attentionAck: { at: string; byName: string | null; note: string | null } | null;
  imports: ImportAttemptView[];
};

export type DocumentDetail = {
  application: { id: string; name: string; jobLabel: string | null; bu: string | null };
  status: DocumentStatus | null;
  invitations: InvitationView[];
  packets: PacketSummary[];
  packet: PacketView | null;
  events: { type: string; at: string; actorType: string; actorName: string | null; detail: Record<string, unknown> | null }[];
};
