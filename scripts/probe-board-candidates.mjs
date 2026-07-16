import '../server/bootstrap-env.ts';
import { listBoardReadyCandidates } from '../api/_lib/boardCandidatesSql.ts';

const rows = await listBoardReadyCandidates({ limit: 500 });
console.log('pool size:', rows.length);
for (const c of rows.slice(0, 5)) {
  console.log(
    `- #${c.card_id} ${c.first_name?.[0] || ''}*** ${c.nick_name || ''} | ${c.job1_name || '-'} / ${c.job2_name || '-'} | ${c.amphur_name || ''} ${c.province_name || ''} | เงินเดือนขอ ${c.required_salary ?? '-'} | ${c.column_label}`,
  );
}
// สถิติฟิลด์สำคัญ
const stat = (k, f) => console.log(`${k}: ${rows.filter(f).length}/${rows.length}`);
stat('มี job1_name', (c) => c.job1_name);
stat('มี job2_name', (c) => c.job2_name);
stat('มี province', (c) => c.province_name);
stat('มี mobile', (c) => c.mobile);
stat('มี age', (c) => c.age != null);
process.exit(0);
