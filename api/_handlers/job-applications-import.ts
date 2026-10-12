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
 * ⚠️ ใบที่นำเข้าไม่ผูกใบขอ ⇒ ผู้ใช้ที่ถูกล็อก BU ประทับแผนกตัวเองลงใบ (`staffEntryDepartment` · 11 ต.ค. 2569)
 *    เดิมกัน 403 ทั้งเส้น = คนล็อก BU (59/61) เลือกไฟล์แล้วขึ้น error ทันที · ล็อกแต่ไม่รู้แผนก ยังกันเหมือนเดิม
 * ⚠️ SheetJS 0.18.5 (ตัวเดียวกับนำเข้า OPL) — เส้นนี้เปิดเฉพาะเจ้าหน้าที่ที่ล็อกอิน · จำกัดขนาด/จำนวนแถว
 */
import * as XLSX from 'xlsx';
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { dbQuery, dbTransaction } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { staffEntryDepartment } from '../_lib/applicationScope.js';
import { toE164Thai } from '../_lib/thaiPhone.js';
import {
  IMPORT_MAX_ROWS,
  IMPORT_SHEET_NAME,
  IMPORT_TEMPLATE_FILENAME,
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
import { existingApplicationsByPhone, lockAndFindRepeat, recentPhoneApplications } from '../_lib/applicationRepeatGuard.js';
import { duplicateSheetRows, type ImportDuplicate } from '../../src/lib/applicantImportDuplicates.js';
import { buildImportTemplateBase64 } from '../_lib/importTemplate.js';
import { splitIrecruitDuplicates } from '../_lib/irecruitDuplicates.js';
import { listRecruitJobTitles } from '../_lib/recruitJobTitles.js';
import { logError } from '../_lib/logger.js';

const tbl = tableInAppSchema('public_job_applications');
/** ~1.5 MB ไฟล์จริง — รายชื่อ 500 แถวใช้ไม่ถึง 100 KB */
const MAX_BASE64_CHARS = 2 * 1024 * 1024;
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const NO_DEPARTMENT_MESSAGE = 'บัญชีนี้ยังไม่ได้ตั้งแผนก นำเข้าไม่ได้ — ให้แอดมินตั้งแผนกในหน้าผู้ใช้งานก่อน';

const text = (v: unknown, max = 200): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t ? t.slice(0, max) : null;
};


/** ไฟล์ → แถว (ชีต "ผู้สมัคร" ถ้ามี ไม่งั้นชีตแรก) · เซลล์เป็นข้อความตามที่ตาเห็นบน Excel */
/** ไฟล์รายชื่อซ้ำให้ดาวน์โหลด (.xlsx) — สร้างฝั่ง server ตัวเดียวกับไฟล์ตัวอย่าง */
function buildDuplicatesBase64(list: readonly ImportDuplicate[]): string {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(duplicateSheetRows(list));
  sheet['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 12 }, { wch: 48 }];
  XLSX.utils.book_append_sheet(wb, sheet, 'รายชื่อซ้ำ');
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
}

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
        // มี Dropdown ในไฟล์ (12 ต.ค. 2569) — ตำแหน่งจากรายชื่อกลาง · อ่านไม่ได้ = ไฟล์ยังมา แค่ไม่มี Dropdown ตำแหน่ง
        dataBase64: buildImportTemplateBase64(
          await listRecruitJobTitles()
            .then((list) => list.map((t) => t.name))
            .catch(() => []),
        ),
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

    // ใบไม่ผูกใบขอ ⇒ คนล็อก BU ประทับแผนกตัวเอง (เห็นใบที่นำเข้าผ่าน department_code) — กติกาเดียวกับเพิ่มข้อมูลผู้สมัคร
    const entryDept = await staffEntryDepartment(req.user);
    if (!entryDept.ok) return sendError(res, 403, 'Forbidden', NO_DEPARTMENT_MESSAGE);

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

    // รายชื่อซ้ำ (เจ้าของ 4 ต.ค. 2569) — เบอร์ที่มีใบในระบบแล้ว (ทุกช่วงเวลา) + เบอร์ซ้ำในไฟล์ · คิดก่อนติดป้ายข้าม
    const existing = await existingApplicationsByPhone((sql, params) => dbQuery(sql, params), phones);
    const duplicates: ImportDuplicate[] = [];
    for (const p of plans) {
      if ('value' in p) {
        const key = toE164Thai(p.value.phone);
        const hit = key ? existing.get(key) : undefined;
        if (!hit) continue;
        const block = key ? blocked.get(key) : undefined;
        duplicates.push({
          row: p.row,
          name: p.value.full_name,
          phone: p.value.phone,
          lastAppliedAt: hit.lastAt.toISOString(),
          lastStatus: hit.status,
          lastJob: hit.job,
          applications: hit.count,
          skipped: Boolean(block),
          note: block ?? 'เคยสมัครแล้ว เกิน 14 วัน นำเข้าได้',
        });
      } else if (/^เบอร์ซ้ำกับแถว/.test(p.reason)) {
        duplicates.push({
          row: p.row,
          name: p.name,
          phone: p.phone,
          lastAppliedAt: null,
          lastStatus: null,
          lastJob: null,
          applications: 0,
          skipped: true,
          note: p.reason,
        });
      }
    }
    const duplicatesOut =
      duplicates.length > 0 ? { duplicates, duplicatesFileBase64: buildDuplicatesBase64(duplicates) } : { duplicates };
    plans = markBlockedPhones(plans, blocked, toE164Thai);

    if (dryRun) {
      const preview = toPreviewRows(plans);
      return res.status(200).json({
        dryRun: true,
        rows: preview,
        ready: preview.filter((r) => r.ok).length,
        skipped: preview.filter((r) => !r.ok).length,
        ...duplicatesOut,
      });
    }

    // บันทึก — ทั้งไฟล์ในธุรกรรมเดียว · ล็อกเบอร์ทีละแถว **เรียงตามเบอร์** (คนนำเข้าพร้อมกันสองไฟล์ไม่ deadlock)
    // แล้วเช็คกติกาสมัครซ้ำอีกรอบ (มีคนสมัครเข้ามาระหว่างดูตัวอย่าง = ข้ามแถวนั้น)
    const staffName = req.user.email || null;
    const insertedIds: string[] = [];
    const insertedPhones = new Map<string, string>();
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
          staffInsertParams(p.value, staffName, entryDept.code),
        );
        if (ins[0]?.id) {
          insertedIds.push(ins[0].id);
          insertedPhones.set(ins[0].id, p.value.phone);
        }
      }
      return out;
    });

    // จดใบที่ซ้ำกับ iRecruit ภายใน 14 วัน (143 · 12 ต.ค. 2569) — ป้าย "ซ้ำ iRecruit" บนแท็บผู้สมัคร
    // ใบนำเข้า AI ไม่โทรเองอยู่แล้ว · อ่าน iRecruit ไม่ได้ = ไม่มีป้าย (ไม่ทำให้การนำเข้าล้ม)
    try {
      await splitIrecruitDuplicates(insertedIds.map((id) => ({ id, phone: insertedPhones.get(id) ?? null, created_at: new Date() })));
    } catch (e) {
      logError('job-applications-import irecruit dup check failed', e, { count: insertedIds.length });
    }

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
      ...duplicatesOut,
    });
  } catch (e) {
    return handleApiError(res, e, 'job-applications-import');
  }
}

export default withRbac(handler, 'job-applications');
