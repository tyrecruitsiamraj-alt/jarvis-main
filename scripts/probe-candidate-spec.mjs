import '../server/bootstrap-env.ts';
import { analyzeCandidateSpecForJob } from '../api/_lib/candidateSpecAnalyzer.ts';

const job = {
  request_no: 'OPL-TEST-002',
  request_date: '2026-07-10',
  required_date: '2026-07-20',
  unit_name: 'กฟภ. จันทบุรี',
  site_code: 'PEA-CTB',
  location_address: 'จันทบุรี',
  staff_title_name: 'Quality Control ตรวจสอบคุณภาพระบบไฟฟ้า',
  position_units: '1',
  total_income: '18000',
  gender_requirement: 'ไม่จำกัด',
  age_range_min: '25',
  age_range_max: '45',
  request_action_name: 'ทดแทน (ลาออก)',
  resigned_reason: 'ลาออก',
};

const started = Date.now();
try {
  const analysis = await analyzeCandidateSpecForJob('probe-test', job, { refresh: true });
  console.log('OK in', Math.round((Date.now() - started) / 1000), 's');
  console.log('job_family:', analysis.job_family_code, analysis.job_family_label);
  console.log('summary:', analysis.summary);
  console.log('must_have:', analysis.must_have.length, 'items');
  for (const item of analysis.must_have) console.log('  -', item);
  console.log('adjacent:', analysis.adjacent_positions.length, 'items');
  for (const row of analysis.adjacent_positions) {
    console.log(`  [${row.tier}] ${row.title} — ${row.note}`);
  }
  console.log('excluded:', analysis.excluded_positions.length, 'items');
  for (const row of analysis.excluded_positions) {
    console.log(`  - ${row.title} — ${row.reason}`);
  }
} catch (e) {
  console.error('FAILED in', Math.round((Date.now() - started) / 1000), 's:', e instanceof Error ? e.message : e);
  process.exit(1);
}
