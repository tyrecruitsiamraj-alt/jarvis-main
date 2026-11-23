/**
 * ต้นฉบับเอกสารของบริษัท 5 ประเภท (ส่งเอกสารผ่าน LINE · 22 พ.ย. 2569)
 *
 * อัปโหลดจากหน้าตั้งค่า เก็บในฐาน — ไม่อยู่ใน public/ และไม่อยู่ใน repo (repo เป็น public) · เปิดอ่านได้เฉพาะ
 * ผู้สมัครในลิงก์ของตัวเอง กับเจ้าหน้าที่ที่มีสิทธิ์ · อัปโหลดใหม่ = รุ่นใหม่ (รุ่นเก่าไม่ถูกลบ ชุดที่ส่งไปแล้วยังอ้างรุ่นที่อ่านจริง)
 * หน้าเป็นภาพ PNG/JPG (ตัวทำ PDF ฝังได้สองชนิดนี้)
 */
import { dbQuery, dbTransaction } from '../postgres.js';
import { DocError, T, sha256Hex } from './core.js';
import { imageMime, imageSize } from '../../../src/lib/documents/uploadValidation.js';
import { isDocId, type DocId } from '../../../src/lib/documents/documentTypes.js';

export const TEMPLATE_MAX_PAGES = 12;
export const TEMPLATE_PAGE_MAX_BYTES = 3_000_000;

export type TemplatePage = { mime: string; bytes: Buffer; sha256: string; width: number | null; height: number | null };

/** ตรวจหน้าเอกสารที่อัปโหลด — PNG/JPG จริงเท่านั้น */
export function checkTemplatePage(bytes: Uint8Array): TemplatePage {
  if (bytes.length > TEMPLATE_PAGE_MAX_BYTES) throw new DocError(413, 'too_large', 'ไฟล์หน้าเอกสารใหญ่เกิน 3 MB');
  const mime = imageMime(bytes);
  if (mime !== 'image/png' && mime !== 'image/jpeg') throw new DocError(415, 'invalid_image', 'ต้นฉบับเอกสารใช้ภาพ PNG หรือ JPG');
  const size = imageSize(bytes);
  if (!size) throw new DocError(415, 'invalid_image', 'เปิดภาพนี้ไม่ได้');
  return { mime, bytes: Buffer.from(bytes), sha256: sha256Hex(bytes), width: size.width, height: size.height };
}

/** บันทึกต้นฉบับรุ่นใหม่ของเอกสาร 1 ประเภท (ทุกหน้าเรียงตามลำดับ) — รุ่นเดิมเลิกใช้ ไม่ลบ */
export async function saveTemplateVersion(
  docType: string,
  pages: TemplatePage[],
  by: { id: string; name: string },
): Promise<{ id: string; version: number; pageCount: number; sha256: string }> {
  if (!isDocId(docType)) throw new DocError(400, 'bad_request', 'ไม่รู้จักเอกสารประเภทนี้');
  if (pages.length < 1 || pages.length > TEMPLATE_MAX_PAGES) throw new DocError(400, 'bad_request', `ต้นฉบับต้องมี 1–${TEMPLATE_MAX_PAGES} หน้า`);
  const sha256 = sha256Hex(pages.map((p) => p.sha256).join(':'));
  return dbTransaction(async (client) => {
    // ล็อกต่อประเภท — สองคนอัปโหลดพร้อมกันไม่ได้เลขรุ่นซ้ำ
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`document_template:${docType}`]);
    const { rows: last } = await client.query<{ v: number | null }>(`select max(version) as v from ${T.templates} where doc_type = $1`, [docType]);
    const version = (last[0]?.v ?? 0) + 1;
    await client.query(`update ${T.templates} set is_active = false where doc_type = $1 and is_active`, [docType]);
    const { rows } = await client.query<{ id: string }>(
      `insert into ${T.templates} (doc_type, version, page_count, sha256, is_active, created_by, created_by_name)
       values ($1, $2, $3, $4, true, $5, $6) returning id`,
      [docType, version, pages.length, sha256, by.id, by.name],
    );
    const id = rows[0].id;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      await client.query(
        `insert into ${T.templatePages} (template_id, page_no, mime, size, sha256, width, height, bytes) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [id, i + 1, p.mime, p.bytes.length, p.sha256, p.width, p.height, p.bytes],
      );
    }
    return { id, version, pageCount: pages.length, sha256 };
  });
}

export type StoredTemplatePage = { mime: string; bytes: Buffer };

export async function getTemplatePage(templateId: string, pageNo: number): Promise<StoredTemplatePage | null> {
  const { rows } = await dbQuery<{ mime: string; bytes: Buffer }>(
    `select mime, bytes from ${T.templatePages} where template_id = $1 and page_no = $2`,
    [templateId, pageNo],
  );
  return rows[0] ? { mime: rows[0].mime, bytes: Buffer.from(rows[0].bytes) } : null;
}

export async function getTemplatePages(templateId: string): Promise<StoredTemplatePage[]> {
  const { rows } = await dbQuery<{ mime: string; bytes: Buffer }>(
    `select mime, bytes from ${T.templatePages} where template_id = $1 order by page_no`,
    [templateId],
  );
  return rows.map((r) => ({ mime: r.mime, bytes: Buffer.from(r.bytes) }));
}

/** หน้าของต้นฉบับรุ่นที่ใช้อยู่ (ผู้สมัครอ่านก่อนตอบ) */
export async function getActiveTemplatePage(docType: DocId, pageNo: number): Promise<StoredTemplatePage | null> {
  const { rows } = await dbQuery<{ mime: string; bytes: Buffer }>(
    `select p.mime, p.bytes from ${T.templatePages} p join ${T.templates} t on t.id = p.template_id
      where t.doc_type = $1 and t.is_active and p.page_no = $2`,
    [docType, pageNo],
  );
  return rows[0] ? { mime: rows[0].mime, bytes: Buffer.from(rows[0].bytes) } : null;
}
