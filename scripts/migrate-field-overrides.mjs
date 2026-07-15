import '../server/bootstrap-env.ts';
import { dbQuery } from '../api/_lib/postgres.ts';
import { tableInAppSchema } from '../api/_lib/schema.ts';

const table = tableInAppSchema('siamraj_unit_notes');
console.log('ALTER', table, 'ADD COLUMN field_overrides jsonb ...');
await dbQuery(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS field_overrides jsonb`);
const { rows } = await dbQuery(`select column_name, data_type from information_schema.columns where table_name='siamraj_unit_notes' and column_name='field_overrides'`);
console.log('result:', rows);
process.exit(0);
