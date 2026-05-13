/**
 * อ่านรายการหน่วยงานจาก PostgreSQL schema แยก (เช่น so-operation) — ไม่ใช้ PGSCHEMA/jarvis_rm
 * ตั้งค่า: SO_OPERATION_SCHEMA + SO_OPERATION_UNITS_TABLE (และคอลัมน์ถ้าชื่อไม่ใช่ id/name)
 */

function quotePgIdent(ident: string): string {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

export type SoOperationUnitsSql = {
  /** SELECT … พร้อม order by name */
  sql: string;
};

/**
 * คืนค่า null ถ้ายังไม่ตั้งค่า schema + ตาราง — API จะตอบ 501
 */
export function buildSoOperationUnitsSelectSql(): SoOperationUnitsSql | null {
  const schema = (process.env.SO_OPERATION_SCHEMA || '').trim();
  const table = (process.env.SO_OPERATION_UNITS_TABLE || '').trim();
  if (!schema || !table) return null;

  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(schema)) return null;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(table)) return null;

  const idCol = (process.env.SO_OPERATION_UNIT_ID_COLUMN || 'id').trim() || 'id';
  const nameCol = (process.env.SO_OPERATION_UNIT_NAME_COLUMN || 'name').trim() || 'name';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(idCol)) return null;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(nameCol)) return null;

  const activeCol = (process.env.SO_OPERATION_UNIT_ACTIVE_COLUMN || '').trim();
  const where =
    activeCol && /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(activeCol)
      ? ` where ${quotePgIdent(activeCol)} = true`
      : '';

  const fq = `${quotePgIdent(schema)}.${quotePgIdent(table)}`;
  const sql = `select ${quotePgIdent(idCol)}::text as id, ${quotePgIdent(nameCol)}::text as name from ${fq}${where} order by ${quotePgIdent(nameCol)} asc`;

  return { sql };
}
