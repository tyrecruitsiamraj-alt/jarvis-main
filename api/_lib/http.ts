import { logError } from './logger.js';
import { isProductionRuntime } from './runtime.js';
import {
  getTokenFromReq,
  getTokenFromAuthHeader,
  verifyAuthToken,
  type UserRole,
  type JwtUserPayload,
} from './auth.js';
import { checkApiAccess, meetsMinimumRole, type ApiResource } from './rbac.js';

export type ApiRes = {
  setHeader?: (name: string, value: string | string[]) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

export type ApiReq = {
  method?: string;
  body?: unknown;
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
};

export type AuthedReq = ApiReq & { user: JwtUserPayload };

export function sendError(
  res: ApiRes,
  code: number,
  error: string,
  message?: string,
  extra?: Record<string, unknown>,
): void {
  res.status(code).json({
    error,
    ...(message ? { message } : {}),
    ...extra,
  });
}

export function handleApiError(
  res: ApiRes,
  e: unknown,
  context: string,
  fields?: Record<string, unknown>,
): void {
  const detail = e instanceof Error ? e.message : String(e);
  const stack = e instanceof Error ? e.stack : undefined;
  logError(context, { ...fields, message: detail, stack });
  if (isProductionRuntime()) {
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
  res.status(500).json({ error: 'Internal server error', message: detail });
}


function meetsRole(userRole: UserRole, allowed: UserRole[]): boolean {
  return allowed.some((r) => meetsMinimumRole(userRole, r));
}

/**
 * Wrap a handler that requires a valid JWT. Optionally require minimum role(s).
 */
export function withAuth<T extends ApiReq>(
  handler: (req: AuthedReq, res: ApiRes) => Promise<void>,
  options?: { roles?: UserRole[] },
): (req: ApiReq, res: ApiRes) => Promise<void> {
  const allowed = options?.roles;

  return async (req: ApiReq, res: ApiRes) => {
    const token =
      getTokenFromReq(req) || (!isProductionRuntime() ? getTokenFromAuthHeader(req) : null);
    if (!token) {
      return sendError(res, 401, 'Unauthorized', 'Missing auth cookie');
    }
    try {
      const user = verifyAuthToken(token);
      if (allowed && allowed.length > 0 && !meetsRole(user.role, allowed)) {
        return sendError(res, 403, 'Forbidden', 'Insufficient role');
      }
      await handler({ ...req, user }, res);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes('jwt') || message.includes('token') || message.includes('secret')) {
        return sendError(res, 401, 'Unauthorized', 'Invalid or expired session');
      }
      return handleApiError(res, e, 'withAuth');
    }
  };
}

/**
 * Authenticated route with centralized RBAC (api/_lib/rbac.ts).
 * Backend is the authority — returns 403 when role is insufficient.
 */
export function withRbac(
  handler: (req: AuthedReq, res: ApiRes) => Promise<void>,
  resource: ApiResource,
  options?: { hintFromReq?: (req: ApiReq) => string | undefined },
): (req: ApiReq, res: ApiRes) => Promise<void> {
  return withAuth(async (req, res) => {
    const method = (req.method || 'GET').toUpperCase();
    const hint = options?.hintFromReq?.(req);
    const access = checkApiAccess(req.user.role, resource, method, hint);
    if (!access.ok) {
      return sendError(res, 403, 'Forbidden', access.message);
    }
    await handler(req, res);
  });
}

/** @deprecated Use withRbac(handler, resource) — kept for gradual migration. */
export function withAuthDataRoute(
  handler: (req: AuthedReq, res: ApiRes) => Promise<void>,
): (req: ApiReq, res: ApiRes) => Promise<void> {
  return async (req: ApiReq, res: ApiRes) => {
    const m = (req.method || 'GET').toUpperCase();
    const isWrite = m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
    const roles: UserRole[] = isWrite ? ['supervisor', 'admin'] : ['staff', 'supervisor', 'admin'];
    const inner = withAuth(handler, { roles });
    return inner(req, res);
  };
}

/** @deprecated Use withRbac(handler, resource) — kept for gradual migration. */
export function withAuthStaffCreateSupervisorMutate(
  handler: (req: AuthedReq, res: ApiRes) => Promise<void>,
): (req: ApiReq, res: ApiRes) => Promise<void> {
  return async (req: ApiReq, res: ApiRes) => {
    const m = (req.method || 'GET').toUpperCase();
    const roles: UserRole[] =
      m === 'PATCH' || m === 'PUT' || m === 'DELETE' ? ['supervisor', 'admin'] : ['staff', 'supervisor', 'admin'];
    const inner = withAuth(handler, { roles });
    return inner(req, res);
  };
}
