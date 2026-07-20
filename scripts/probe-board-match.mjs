import '../server/bootstrap-env.ts';
import { getSiamrajUnitRequestById } from '../api/_lib/siamrajUnitRequests.ts';
import { matchBoardCandidatesForJob } from '../api/_lib/boardCandidateMatcher.ts';

const jobId = process.argv[2] || 'siamraj-sql:LBM5904006';

const started = Date.now();
const job = await getSiamrajUnitRequestById(jobId);
if (!job) {
  console.error('ไม่พบใบขอ', jobId);
  process.exit(1);
}
console.log('ใบขอ:', job.request_no, '|', job.job_description_code_1 || job.staff_title_name, '|', job.unit_name);
try {
  const r = await matchBoardCandidatesForJob(jobId, job, { refresh: false });
  console.log(`\nOK in ${Math.round((Date.now() - started) / 1000)}s`);
  console.log(`Family: ${r.job_family_code} ${r.job_family_label} | pool=${r.pool_size} shortlist=${r.shortlisted} matches=${r.matches.length}\n`);
  for (const m of r.matches) {
    const icon = m.tier === 'green' ? '🟢' : m.tier === 'red' ? '🔴' : '🟡';
    console.log(`${icon} ${m.full_name} (#${m.card_id}, prescore=${m.prescore})`);
    console.log(`   สกิล: ${[m.job1_name, m.job2_name].filter(Boolean).join(' / ')} | ${[m.amphur_name, m.province_name].filter(Boolean).join(' ')} | ขอ ${m.required_salary ?? '-'}`);
    console.log(`   เหตุผล: ${m.reason}\n`);
  }
} catch (e) {
  console.error(`FAILED in ${Math.round((Date.now() - started) / 1000)}s:`, e instanceof Error ? e.message : e);
  process.exit(1);
}
process.exit(0);
