/**
 * `GET/POST /api/job-applications-import` — นำเข้าผู้สมัครจาก Excel (เจ้าของสั่ง 1 ต.ค. 2569)
 *
 * GET  → ไฟล์ตัวอย่าง `{ filename, mime, dataBase64 }` (ชีตผู้สมัคร + ชีตค่าที่ใช้ได้)
 * POST `{ file_base64, dry_run, responsible_name?, channel_id?, channel_label? }`
 *      dry_run = ตัวอย่างก่อนบันทึก (ไม่เขียนอะไร) · ไม่ใช่ dry_run = บันทึกแถวที่ผ่าน
 *
 * 🔴 กติกาต่อแถว = ปุ่ม "เพิ่มข้อมูลผู้สมัคร" ทุกตัวอักษร (`parseStaffApplication` + insert ชุดเดียวกัน)
 * 🔴 เบอร์ที่สมัครเข้ามาภายใน 14 วันข้าม (กติกาสมัครซ้ำ) — ตรวจก่อนเพื่อโชว์ในตัวอย่าง + **ตัดสินอีกชั้นตอนบันทึก**
 *    ในธุรกรรมเดียว ล็อกเบอร์ทีละแถว (เรียงเบอร์ กัน deadlock) · ติดกติกา = ข้ามแถวนั้น · error อื่น = ไม่บันทึกทั้งไฟล์
 * 🔴 นำเข้าแล้ว **AI ยังไม่โทร** — ส่งเองจากแท็บผู้สมัคร (ปุ่มที่ยิงสายต้องมีป๊อปยืนยันรายชื่อ)
 * ⚠️ ใบที่นำเข้าไม่ผูกใบขอ (เหมือนปุ่มเพิ่มข้อมูลผู้สมัครในแท็บผู้สมัคร) ⇒ ผู้ใช้ที่ถูกล็อก BU นำเข้าไม่ได้
 *    (คีย์แล้วจะมองไม่เห็นใบของตัวเอง — กติกาเดียวกับ createByStaff)
 * ⚠️ SheetJS 0.18.5 (ตัวเดียวกับนำเข้า OPL) — เส้นนี้เปิดเฉพาะเจ้าหน้าที่ที่ล็อกอิน · จำกัดขนาด/จำนวนแถว
 */
import * as XLSX from 'xlsx';
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { dbQuery, dbTransaction } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { loadScopedJobIdSet } from '../_lib/siamrajUnitRequests.js';
import { toE164Thai } from '../_lib/thaiPhone.js';
import {
  IMPORT_MAX_ROWS,
  IMPORT_SHEET_NAME,
  IMPORT_TEMPLATE_FILENAME,
  IMPORT_VALUES_SHEET_NAME,
  importTemplateHeaders,
  importValuesSheet,
  mapImportHeader,
  markBlockedPhones,
  planImportRows,
  toPreviewRows,
  type ImportRowPlan,
} from '../../src/lib/applicantImport.js';
import {
  STAFF_INSERT_COLUMNS,
  STAFF_INSERT_VALUES,
  staffInsertParams,
} from '../../src/lib/staffApplicationInput.js';
import { repeatImportReason } from '../../src/lib/applicationRepeat.js';
import { lockAndFindRepeat, recentPhoneApplications } from '../_lib/applicationRepeatGuard.js';

const tbl = tableInAppSchema('public_job_applications');
/** ~1.5 MB ไฟล์จริง — รายชื่อ 500 แถวใช้ไม่ถึง 100 KB */
const MAX_BASE64_CHARS = 2 * 1024 * 1024;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const BU_LOCKED_MESSAGE =
  'ใบที่นำเข้ายังไม่ผูกใบขอ ผู้ใช้ที่ถูกล็อก BU จะมองไม่เห็นใบของตัวเอง — ให้แอดมินนำเข้าแทน';

const text = (v: unknown, max = 200): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t ? t.slice(0, max) : null;
};

function buildTemplateBase64(): string {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([importTemplateHeaders()]);
  sheet['!cols'] = importTemplateHeaders().map((h) => ({ wch: Math.max(12, h.length + 4) }));
  XLSX.utils.book_append_sheet(wb, sheet, IMPORT_SHEET_NAME);
  const values = XLSX.utils.aoa_to_sheet(importValuesSheet());
  values['!cols'] = [{ wch: 10 }, { wch: 36 }, { wch: 32 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, values, IMPORT_VALUES_SHEET_NAME);
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
}

/** ไฟล์ → แถว (ชีต "ผู้สมัคร" ถ้ามี ไม่งั้นชีตแรก) · เซลล์เป็นข้อความตามที่ตาเห็นบน Excel */
function readSheetRows(buffer: Buffer): unknown[][] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const name = wb.SheetNames.includes(IMPORT_SHEET_NAME) ? IMPORT_SHEET_NAME : wb.SheetNames[0];
  const sheet = name ? wb.Sheets[name] : undefined;
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false });
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({
        filename: IMPORT_TEMPLATE_FILENAME,
        mime: XLSX_MIME,
        dataBase64: buildTemplateBase64(),
      });
    }
    if (method !== 'POST') {
      res.setHeader?.('Allow', 'GET, POST');
      return sendError(res, 405, 'Method not allowed');
    }

    const raw = (await readJsonBody(req)) as Record<string, unknown> | null;
    const fileBase64 = typeof raw?.file_base64 === 'string' ? raw.file_base64.trim() : '';
    if (!fileBase64) return sendError(res, 400, 'Bad request', 'ยังไม่ได้เลือกไฟล์');
    if (fileBase64.length > MAX_BASE64_CHARS) return sendError(res, 400, 'Bad request', 'ไฟล์ใหญ่เกินไป');
    const dryRun = raw?.dry_run === true;

    // ผู้ใช้ที่ถูกล็อก BU นำเข้าไม่ได้ (ใบไม่ผูกใบขอ) — กติกาเดียวกับปุ่มเพิ่มข้อมูลผู้สมัคร
    if (await loadScopedJobIdSet(req.user)) return sendError(res, 403, 'Forbidden', BU_LOCKED_MESSAGE);

    let rows: unknown[][];
    try {
      rows = readSheetRows(Buffer.from(fileBase64, 'base64'));
    } catch {
      return sendError(res, 400, 'Bad request', 'อ่านไฟล์ไม่ได้ — ใช้ไฟล์ Excel (.xlsx) จากปุ่มดาวน์โหลดไฟล์ตัวอย่าง');
    }
    const [header = [], ...data] = rows;
    const { index, missing } = mapImportHeader(header);
    if (missing.length > 0) {
      return sendError(res, 400, 'Bad request', `ไฟล์ไม่มีคอลัมน์: ${missing.join(', ')}`);
    }
    if (data.length > IMPORT_MAX_ROWS) {
      return sendError(res, 400, 'Bad request', `นำเข้าได้ครั้งละไม่เกิน ${IMPORT_MAX_ROWS} แถว`);
    }

    const shared = {
      responsible_name: text(raw?.responsible_name),
      channel_id: text(raw?.channel_id, 64),
      channel_label: text(raw?.channel_label),
    };
    let plans: ImportRowPlan[] = planImportRows(data, index, shared);

    // เบอร์ที่สมัครเข้ามาภายใน 14 วัน — โชว์ในตัวอย่างว่าจะข้าม พร้อมวันที่นำเข้าได้
    const phones = [...new Set(plans.flatMap((p) => ('value' in p ? [p.value.phone] : [])))];
    const recent = await recentPhoneApplications((sql, params) => dbQuery(sql, params), phones);
    const blocked = new Map([...recent].map(([key, lastAt]) => [key, repeatImportReason(lastAt)]));
    plans = markBlockedPhones(plans, blocked, toE164Thai);

    if (dryRun) {
      const preview = toPreviewRows(plans);
      return res.status(200).json({
        dryRun: true,
        rows: preview,
        ready: preview.filter((r) => r.ok).length,
        skipped: preview.filter((r) => !r.ok).length,
      });
    }

    // บันทึก — ทั้งไฟล์ในธุรกรรมเดียว · ล็อกเบอร์ทีละแถว **เรียงตามเบอร์** (คนนำเข้าพร้อมกันสองไฟล์ไม่ deadlock)
    // แล้วเช็คกติกาสมัครซ้ำอีกรอบ (มีคนสมัครเข้ามาระหว่างดูตัวอย่าง = ข้ามแถวนั้น)
    const staffName = req.user.email || null;
    const insertedIds: string[] = [];
    plans = await dbTransaction(async (client) => {
      const out = [...plans];
      const order = out
        .map((p, i) => ({ p, i }))
        .filter((x) => 'value' in x.p)
        .sort((a, b) => ('value' in a.p && 'value' in b.p ? a.p.value.phone.localeCompare(b.p.value.phone) : 0));
      for (const { p, i } of order) {
        if (!('value' in p)) continue;
        const hit = await lockAndFindRepeat(client, { phone: p.value.phone });
        if (hit) {
          out[i] = { row: p.row, ok: false, reason: repeatImportReason(hit.lastAt), name: p.value.full_name, phone: p.value.phone };
          continue;
        }
        const { rows: ins } = await client.query<{ id: string }>(
          `insert into ${tbl} (${STAFF_INSERT_COLUMNS}) values (${STAFF_INSERT_VALUES}) returning id`,
          staffInsertParams(p.value, staffName),
        );
        if (ins[0]?.id) insertedIds.push(ins[0].id);
      }
      return out;
    });

    const result = toPreviewRows(plans);
    await auditFromAuthed(req, {
      action: 'job_application.import',
      entityType: 'job_application',
      entityId: 'bulk',
      after: { inserted: insertedIds.length, skipped: result.filter((r) => !r.ok).length },
    });
    return res.status(200).json({
      dryRun: false,
      rows: result,
      inserted: insertedIds.length,
      skipped: result.filter((r) => !r.ok).length,
    });
  } catch (e) {
    return handleApiError(res, e, 'job-applications-import');
  }
}

export default withRbac(handler, 'job-applications');
