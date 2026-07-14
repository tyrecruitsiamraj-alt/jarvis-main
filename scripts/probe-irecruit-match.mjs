import '../server/bootstrap-env.ts';
import { getSiamrajUnitRequestById } from '../api/_lib/siamrajUnitRequests.ts';
import { matchIrecruitCandidatesForJob } from '../api/_lib/irecruitCandidateMatcher.ts';

const jobId = process.argv[2] || 'siamraj-sql:LBM5904006';

const started = Date.now();
try {
  const job = await getSiamrajUnitRequestById(jobId);
  if (!job) {
    console.error('ไม่พบใบขอ', jobId);
    process.exit(1);
  }
  console.log('ใบขอ:', job.request_no, '|', job.staff_title_name || job.job_type, '|', job.unit_name);
  const r = await matchIrecruitCandidatesForJob(jobId, job, { refresh: false });
  console.log(`\nOK in ${Math.round((Date.now() - started) / 1000)}s`);
  console.log(`Job Family: ${r.job_family_code} ${r.job_family_label}`);
  console.log(`pool=${r.pool_size} shortlisted=${r.shortlisted} matches=${r.matches.length}\n`);
  for (const m of r.matches) {
    const tierIcon = m.tier === 'green' ? '🟢' : m.tier === 'red' ? '🔴' : '🟡';
    console.log(`${tierIcon} ${m.full_name} (#${m.id}, prescore=${m.prescore})`);
    console.log(`   สมัคร: ${m.position_name || m.job_name_th || '-'}`);
    console.log(`   ${m.location_label || '-'}${m.driving_licenses.length ? ' | ใบขับขี่: ' + m.driving_licenses.join(',') : ''}`);
    console.log(`   เหตุผล: ${m.reason}\n`);
  }
} catch (e) {
  console.error(`FAILED in ${Math.round((Date.now() - started) / 1000)}s:`, e instanceof Error ? e.message : e);
  process.exit(1);
}
