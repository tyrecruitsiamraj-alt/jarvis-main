/**
 * หน่วยงานใน PostgreSQL schema แยก (เช่น so-operation) — อ่าน/เพิ่ม/แก้ไขที่นี่เท่านั้น
 * ตั้งค่า: SO_OPERATION_SCHEMA (จำเป็น) + SO_OPERATION_UNITS_TABLE (ถ้าว่างจะใช้ตาราง activity_to_saleco_request_position)
 */

function quotePgIdent(ident: string): string {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

/** ตารางหน่วยงานใน so-operation ตามโปรเจกต์ — override ได้ด้วย SO_OPERATION_UNITS_TABLE */
export const DEFAULT_SO_OPERATION_UNITS_TABLE = 'activity_to_saleco_request_position';

export type SoOperationUnitsMeta = {
  fq: string;
  quotedId: string;
  quotedName: string;
  quotedActive: string | null;
};

/** คืนค่า null ถ้ายังไม่ตั้งค่า SO_OPERATION_SCHEMA */
export function resolveSoOperationUnitsMeta(): SoOperationUnitsMeta | null {
  const schema = (process.env.SO_OPERATION_SCHEMA || '').trim();
  const tableRaw = (process.env.SO_OPERATION_UNITS_TABLE || '').trim();
  const table = tableRaw || (schema ? DEFAULT_SO_OPERATION_UNITS_TABLE : '');
  if (!schema || !table) return null;

  if (!/^[a-zA-Z0-9_-]{1,63}$/.test(schema)) return null;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(table)) return null;

  const idCol = (process.env.SO_OPERATION_UNIT_ID_COLUMN || 'id').trim() || 'id';
  const nameCol = (process.env.SO_OPERATION_UNIT_NAME_COLUMN || 'name').trim() || 'name';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(idCol)) return null;
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(nameCol)) return null;

  const activeRaw = (process.env.SO_OPERATION_UNIT_ACTIVE_COLUMN || '').trim();
  const quotedActive =
    activeRaw && /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(activeRaw) ? quotePgIdent(activeRaw) : null;

  const fq = `${quotePgIdent(schema)}.${quotePgIdent(table)}`;
  return {
    fq,
    quotedId: quotePgIdent(idCol),
    quotedName: quotePgIdent(nameCol),
    quotedActive,
  };
}

export type SoOperationUnitsSelectSql = { sql: string };

export function buildSoOperationUnitsSelectSql(): SoOperationUnitsSelectSql | null {
  const meta = resolveSoOperationUnitsMeta();
  if (!meta) return null;
  const where = meta.quotedActive ? ` where ${meta.quotedActive} = true` : '';
  const sql = `select ${meta.quotedId}::text as id, ${meta.quotedName}::text as name from ${meta.fq}${where} order by ${meta.quotedName} asc`;
  return { sql };
}

/** none = ให้ DB สร้าง id (serial/default); uuid = ใส่ gen_random_uuid() ตอน insert */
function idInsertMode(): 'none' | 'uuid' {
  const v = (process.env.SO_OPERATION_UNIT_ID_DEFAULT || 'none').trim().toLowerCase();
  return v === 'uuid' ? 'uuid' : 'none';
}

export function buildSoOperationUnitInsertSql(meta: SoOperationUnitsMeta): { sql: string } | null {
  const mode = idInsertMode();
  if (mode === 'uuid') {
    if (meta.quotedActive) {
      return {
        sql: `insert into ${meta.fq} (${meta.quotedId}, ${meta.quotedName}, ${meta.quotedActive}) values (gen_random_uuid(), $1, true) returning ${meta.quotedId}::text as id, ${meta.quotedName}::text as name`,
      };
    }
    return {
      sql: `insert into ${meta.fq} (${meta.quotedId}, ${meta.quotedName}) values (gen_random_uuid(), $1) returning ${meta.quotedId}::text as id, ${meta.quotedName}::text as name`,
    };
  }
  if (meta.quotedActive) {
    return {
      sql: `insert into ${meta.fq} (${meta.quotedName}, ${meta.quotedActive}) values ($1, true) returning ${meta.quotedId}::text as id, ${meta.quotedName}::text as name`,
    };
  }
  return {
    sql: `insert into ${meta.fq} (${meta.quotedName}) values ($1) returning ${meta.quotedId}::text as id, ${meta.quotedName}::text as name`,
  };
}

export function buildSoOperationUnitUpdateSql(meta: SoOperationUnitsMeta): string {
  return `update ${meta.fq} set ${meta.quotedName} = $2 where ${meta.quotedId}::text = $1 returning ${meta.quotedId}::text as id, ${meta.quotedName}::text as name`;
}
