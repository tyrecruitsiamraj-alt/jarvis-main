import { probeOutboundIpAndTargets } from '../../_lib/outboundIpProbe.js';
import {
  saveOutboundIpCheck,
  listOutboundIpChecks,
  listOutboundIpRegistry,
  formatCheckForApi,
  formatRegistryForApi,
} from '../../_lib/outboundIpLogs.js';
import {
  withRbac,
  sendError,
  handleApiError,
  type AuthedReq,
  type ApiRes,
} from '../../_lib/http.js';

function parseLimit(q: unknown): number {
  const n = typeof q === 'string' ? Number(q) : typeof q === 'number' ? q : 50;
  return Math.min(200, Math.max(1, Number.isFinite(n) ? Math.trunc(n) : 50));
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  const mode = typeof req.query?.mode === 'string' ? req.query.mode : '';

  try {
    if (mode === 'history') {
      const limit = parseLimit(req.query?.limit);
      const [checks, registry] = await Promise.all([
        listOutboundIpChecks(limit),
        listOutboundIpRegistry(),
      ]);
      return res.status(200).json({
        checks: checks.map(formatCheckForApi),
        registry: registry.map(formatRegistryForApi),
      });
    }

    const result = await probeOutboundIpAndTargets();
    let logId: string | null = null;
    let saved = false;
    let saveError: string | null = null;

    try {
      const savedRow = await saveOutboundIpCheck(result, {
        id: req.user.sub,
        email: req.user.email,
      });
      logId = savedRow.checkId;
      saved = true;
    } catch (e) {
      saveError = e instanceof Error ? e.message : String(e);
    }

    const registry = saved ? await listOutboundIpRegistry() : [];

    return res.status(200).json({
      ...result,
      logId,
      saved,
      saveError,
      registry: registry.map(formatRegistryForApi),
    });
  } catch (e) {
    return handleApiError(res, e, 'diagnostics/outbound-ip', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'diagnostics-outbound-ip');
