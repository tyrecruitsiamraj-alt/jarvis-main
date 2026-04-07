import { getPgSchema } from './env.js';

/**
 * Qualified PostgreSQL table id: `"schema".table`
 * Uses PGSCHEMA / DATABASE_SCHEMA when set; otherwise `jarvis_rm` (same as jobs/employees handlers).
 */
export function tableInAppSchema(table: string): string {
  const s = getPgSchema();
  const schema = s || 'jarvis_rm';
  return `"${schema}".${table}`;
}
