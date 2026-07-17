import '../server/bootstrap-env.ts';
import { listBoardReadyCandidates } from '../api/_lib/boardCandidatesSql.ts';
const pool = await listBoardReadyCandidates({ limit: 1000 });
console.log('pool size:', pool.length);
const counts = {};
for (const c of pool) {
  const key = `${c.job1_name || ''}`.trim() || '(ว่าง)';
  counts[key] = (counts[key]||0)+1;
}
const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]);
for (const [k,v] of sorted) console.log(v, k);
process.exit(0);
