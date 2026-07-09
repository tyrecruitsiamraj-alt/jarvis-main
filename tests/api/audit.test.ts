// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  auditContextFromAuthed,
  auditContextFromAnonymous,
  resolveRequestId,
} from '../../api/_lib/audit';
import { HARD_DELETE_BLOCKERS } from '../../api/_lib/destructiveEndpoints';

describe('audit context', () => {
  it('builds context from authenticated request', () => {
    const ctx = auditContextFromAuthed({
      method: 'POST',
      headers: {
        'x-request-id': 'req-123',
        'x-forwarded-for': '203.0.113.1, 10.0.0.1',
        'user-agent': 'JarvisTest/1.0',
      },
      user: {
        sub: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        email: 'admin@example.com',
        role: 'admin',
      },
    });
    expect(ctx.requestId).toBe('req-123');
    expect(ctx.userRole).toBe('admin');
    expect(ctx.ipAddress).toBe('203.0.113.1');
    expect(ctx.userAgent).toBe('JarvisTest/1.0');
  });

  it('builds anonymous context for auth flows', () => {
    const ctx = auditContextFromAnonymous(
      { method: 'POST', headers: {} },
      { userName: 'user@example.com' },
    );
    expect(ctx.userName).toBe('user@example.com');
    expect(ctx.requestId).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('generates request id when header missing', () => {
    const id = resolveRequestId({ method: 'GET', headers: {} });
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe('destructive endpoints registry', () => {
  it('lists remaining hard delete blockers', () => {
    expect(HARD_DELETE_BLOCKERS).toContain('DELETE /api/candidate-interviews');
  });
});
