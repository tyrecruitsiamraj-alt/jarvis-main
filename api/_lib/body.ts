import type { ApiReq } from './http.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAsyncIterable(value: unknown): value is AsyncIterable<Uint8Array> {
  const maybe = value as { [Symbol.asyncIterator]?: unknown };
  return typeof maybe[Symbol.asyncIterator] === 'function';
}

/** Read JSON body from Vercel-style req (body pre-parsed) or async iterable stream. */
export async function readJsonBody(req: unknown): Promise<unknown> {
  const maybeReq = req as ApiReq;
  const directBody = maybeReq.body;
  if (typeof directBody === 'string') {
    if (!directBody.trim()) return null;
    return JSON.parse(directBody) as unknown;
  }
  if (isPlainObject(directBody)) return directBody;
  if (isAsyncIterable(req)) {
    let text = '';
    for await (const chunk of req) text += Buffer.from(chunk).toString('utf8');
    if (!text.trim()) return null;
    return JSON.parse(text) as unknown;
  }
  return null;
}

export function getString(v: unknown): string | null {
  return typeof v === 'string' ? v.trim() : null;
}
