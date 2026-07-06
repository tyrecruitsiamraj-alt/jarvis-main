import * as XLSX from 'xlsx';
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { getSiamrajSqlServerConfig } from './siamrajSqlServer.js';
import { upsertUnitAssignment } from './siamrajUnitAssignments.js';

const assignmentsTable = tableInAppSchema('siamraj_unit_assignments');
const rosterTable = tableInAppSchema('job_staff_roster');

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

type SiteOplMap = Record<string, string>;

function findColumns(headers: string[]): { siteIdx: number; oplIdx: number } | null {
  let siteIdx = -1;
  let oplIdx = -1;
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] ?? '').trim();
    if (h.toLowerCase() === 'site_code') siteIdx = i;
    if (h.includes('ผู้รับผิดชอบ') || h === 'OPL ชื่อ') oplIdx = i;
  }
  if (siteIdx >= 0 && oplIdx >= 0) return { siteIdx, oplIdx };
  return null;
}

function parseSheet(rows: unknown[][]): SiteOplMap {
  if (rows.length < 2) return {};
  const headers = (rows[0] ?? []).map((c) => String(c ?? '').trim());
  const cols = findColumns(headers);
  if (!cols) return {};

  const out: SiteOplMap = {};
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const site = String(row[cols.siteIdx] ?? '').trim();
    const name = String(row[cols.oplIdx] ?? '').trim();
    if (site && name) out[site] = name;
  }
  return out;
}

/** อ่านไฟล์ Site update (.xls / .xlsx) → map site_code → ชื่อ OPL */
export function parseOplExcelBuffer(buffer: Buffer): {
  siteOpl: SiteOplMap;
  sheets: string[];
  count: number;
} {
  const wb = XLSX.read(buffer, { type: 'buffer', codepage: 874 });
  const merged: SiteOplMap = {};
  const sheetsUsed: string[] = [];

  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    const part = parseSheet(rows);
    if (Object.keys(part).length > 0) {
      Object.assign(merged, part);
      sheetsUsed.push(name);
    }
  }

  if (Object.keys(merged).length === 0) {
    throw new Error('ไม่พบคอลัมน์ site_code และผู้รับผิดชอบ / OPL ชื่อ ในไฟล์');
  }

  return { siteOpl: merged, sheets: sheetsUsed, count: Object.keys(merged).length };
}

async function fetchOpenRequests(): Promise<Array<{ request_no: string; site_code: string }>> {
  if (!getSiamrajSqlServerConfig()) {
    throw new Error('ยังไม่ได้ตั้งค่า DB_HOST / DB_USER / DB_NAME สำหรับ SQL Server');
  }

  const rows = await siamrajSqlQuery<{ request_no: string; site_code: string }>(`
    SELECT
      RTRIM(A.request_no) AS request_no,
      RTRIM(A.site_code) AS site_code
    FROM st_request_head A
    WHERE A.status = 'A'
      AND A.is_stop = 'N'
      AND (A.stop_no IS NULL OR RTRIM(A.stop_no) = '')
      AND NOT EXISTS (SELECT 1 FROM st_inform_head IH WHERE IH.request_no = A.request_no)
      AND A.site_code IS NOT NULL
      AND RTRIM(A.site_code) <> ''
    ORDER BY A.request_no
  `);

  return rows.map((r) => ({
    request_no: String(r.request_no || '').trim(),
    site_code: String(r.site_code || '').trim(),
  }));
}

async function seedOplRoster(names: string[]): Promise<void> {
  for (const name of names) {
    const t = name.trim();
    if (!t) continue;
    await dbQuery(
      `
      insert into ${rosterTable} (role, display_name)
      select 'opl', $1
      where not exists (
        select 1 from ${rosterTable} r
        where r.role = 'opl' and lower(trim(r.display_name)) = lower(trim($1::text))
      )
      `,
      [t],
    );
  }
}

export async function runOplExcelImport(
  buffer: Buffer,
  options?: { dryRun?: boolean; userId?: string | null },
): Promise<OplImportResult> {
  const dryRun = options?.dryRun ?? false;
  const parsed = parseOplExcelBuffer(buffer);
  const siteOpl = parsed.siteOpl;
  const requests = await fetchOpenRequests();

  const assignments: Array<{ request_no: string; site_code: string; opl_name: string }> = [];
  const matchedSites = new Set<string>();

  for (const req of requests) {
    const opl = siteOpl[req.site_code];
    if (!opl) continue;
    matchedSites.add(req.site_code);
    assignments.push({ request_no: req.request_no, site_code: req.site_code, opl_name: opl });
  }

  const excelSites = new Set(Object.keys(siteOpl));
  const dbSites = new Set(requests.map((r) => r.site_code));
  const excelOnly = [...excelSites].filter((s) => !dbSites.has(s));
  const oplNames = [...new Set(Object.values(siteOpl))].sort((a, b) => a.localeCompare(b, 'th'));

  const base: OplImportResult = {
    dryRun,
    sheets: parsed.sheets,
    excelSiteCount: parsed.count,
    openRequestCount: requests.length,
    assignedCount: assignments.length,
    matchedSiteCount: matchedSites.size,
    unmatchedRequestCount: requests.length - assignments.length,
    excelOnlySiteCount: excelOnly.length,
    oplNames,
    inserted: 0,
    updated: 0,
    sample: assignments.slice(0, 10),
  };

  if (dryRun) return base;

  let inserted = 0;
  let updated = 0;

  for (const row of assignments) {
    const { rows: existing } = await dbQuery<{ request_no: string }>(
      `select request_no from ${assignmentsTable} where request_no = $1`,
      [row.request_no],
    );
    await upsertUnitAssignment({
      requestNo: row.request_no,
      oplName: row.opl_name,
      userId: options?.userId ?? null,
    });
    if (existing[0]) updated += 1;
    else inserted += 1;
  }

  await seedOplRoster(oplNames);

  return { ...base, inserted, updated };
}
