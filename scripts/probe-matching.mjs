import '../server/bootstrap-env.ts';
import { buildMatchingSuggestions } from '../api/_lib/matchingEngine.ts';

const jobId = process.argv[2] || 'siamraj-sql:OPL6401022';
const result = await buildMatchingSuggestions({ jobId, limit: 5 });
console.log(
  JSON.stringify(
    {
      jobId,
      ok: Boolean(result),
      totalCandidates: result?.totalCandidates ?? 0,
      suggestions: result?.suggestions?.length ?? 0,
    },
    null,
    2,
  ),
);
