import { logError } from './logger.js';
import {
  getTokenFromReq,
  verifyAuthToken,
  type UserRole,
  type JwtUserPayload,
} from './auth.js';

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
  const message = e instanceof Error ? e.message : String(e);
  const stack = e instanceof Error ? e.stack : undefined;
  logError(context, { ...fields, message, stack });
  res.status(500).json({ error: 'Internal server error', message });
}

const ROLE_LEVEL: Record<UserRole, number> = {
  admin: 3,
  supervisor: 2,
  staff: 1,
};

function meetsRole(userRole: UserRole, allowed: UserRole[]): boolean {
  const level = ROLE_LEVEL[userRole];
  return allowed.some((r) => level >= ROLE_LEVEL[r]);
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
    const token = getTokenFromReq(req);
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

/** Staff can read; supervisor+ can write (POST/PATCH/PUT/DELETE). */
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
