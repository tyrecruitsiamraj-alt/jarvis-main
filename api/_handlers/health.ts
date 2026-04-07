import { getDatabaseUrl } from '../_lib/env.js';
import { dbPing } from '../_lib/postgres.js';
import { logError } from '../_lib/logger.js';

type Res = {
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

export default async function handler(_req: unknown, res: Res) {
  const dbUrl = getDatabaseUrl();

  if (!dbUrl) {
    return res.status(200).json({
      ok: true,
      message: 'API is working',
      db: { enabled: false, reachable: null },
    });
  }

  try {
    const reachable = await dbPing();
    if (!reachable) throw new Error('DB ping failed');

    return res.status(200).json({
      ok: true,
      message: 'API is working',
      db: { enabled: true, reachable: true },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    logError('health.db_unreachable', { message });
    return res.status(503).json({
      ok: false,
      message: 'API is working, but database is not reachable',
      db: { enabled: true, reachable: false, error: message },
    });
  }
}