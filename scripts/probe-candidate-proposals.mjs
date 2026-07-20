import '../server/bootstrap-env.ts';
import {
  upsertProposal,
  listProposalsForJob,
  listProposalsForJobs,
  updateProposal,
} from '../api/_lib/candidateProposals.ts';

const jobId = process.argv[2] || 'PROBE-JOB-1';

console.log('== upsert (board) ==');
const a = await upsertProposal({
  jobId,
  requestNo: 'REQ-PROBE-1',
  source: 'board',
  candidateRef: '99001',
  candidateName: 'ทดสอบ คนของเรา',
  candidatePhone: '0800000000',
  candidatePosition: 'พนักงานขับรถ / Valet',
  tier: 'green',
  reason: 'สกิลขับรถตรง พื้นที่ใกล้ site',
  status: 'reserved',
  userId: null,
  userName: 'probe@local',
});
console.log(a);

console.log('== upsert again (idempotent, change status→placed) ==');
const a2 = await upsertProposal({
  jobId,
  source: 'board',
  candidateRef: '99001',
  status: 'placed',
});
console.log('same id?', a2.id === a.id, '| status:', a2.status, '| reason kept:', a2.reason);

console.log('== upsert (irecruit) ==');
await upsertProposal({
  jobId,
  source: 'irecruit',
  candidateRef: '206387',
  candidateName: 'ทดสอบ iRecruit',
  tier: 'yellow',
  reason: 'ตำแหน่งใกล้เคียง',
});

console.log('== listProposalsForJob ==');
const list = await listProposalsForJob(jobId);
console.log('count:', list.length, list.map((p) => `${p.source}#${p.candidate_ref}=${p.status}`));

console.log('== listProposalsForJobs ==');
const map = await listProposalsForJobs([jobId, 'NOPE']);
console.log('jobs with proposals:', [...map.keys()]);

console.log('== updateProposal → cancelled ==');
const upd = await updateProposal(a.id, { status: 'cancelled' });
console.log('updated status:', upd?.status);

process.exit(0);
