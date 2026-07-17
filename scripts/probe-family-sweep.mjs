import '../server/bootstrap-env.ts';
import { listSiamrajUnitRequests } from '../api/_lib/siamrajUnitRequests.ts';
import { matchBoardCandidatesForJob } from '../api/_lib/boardCandidateMatcher.ts';

const jobs = await listSiamrajUnitRequests({ limit: 500, mode: 'all' });

const wantRequestNos = process.argv.slice(2);
const targets = wantRequestNos.length
  ? jobs.filter((j) => wantRequestNos.includes(j.request_no))
  : [];

console.log('targets:', targets.map((t) => t.request_no).join(', '));

for (const job of targets) {
  console.log(`\n================ ${job.request_no} (${job.id}) ================`);
  console.log('title fields:', {
    staff_title_name: job.staff_title_name,
    job_description_code_1: job.job_description_code_1,
    job_description_code_2: job.job_description_code_2,
    total_income: job.total_income,
    location_address: job.location_address,
  });
  try {
    const t0 = Date.now();
    const result = await matchBoardCandidatesForJob(job.id, job, { refresh: true });
    const ms = Date.now() - t0;
    console.log(`family: ${result.job_family_code} ${result.job_family_label}`);
    console.log(`pool_size=${result.pool_size} shortlisted=${result.shortlisted} matches=${result.matches.length} (${ms}ms)`);
    for (const m of result.matches) {
      console.log(`  [${m.tier}] #${m.card_id} ${m.full_name} | skill: ${m.job1_name}/${m.job2_name} | salary ask: ${m.required_salary} | reason: ${m.reason}`);
    }
  } catch (e) {
    console.log('ERROR:', e instanceof Error ? e.message : String(e));
  }
}
process.exit(0);
