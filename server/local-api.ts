/**
 * API แบบท้องถิ่น — ไม่ต้องผูก Vercel / ไม่ใช้ vercel dev
 * รัน: npm run api:local   แล้วในอีกเทอร์มินัล: npm run dev
 */
import './bootstrap-env.ts';

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { URL } from 'node:url';

import { apiRoutes } from '../api/_handlers/registry.ts';
import { logError, logInfo, logWarn } from '../api/_lib/logger.ts';

type VercelLikeRes = {
  setHeader?: (name: string, value: string | string[]) => void;
  status: (code: number) => { json: (body: unknown) => void };
};

function createRes(res: ServerResponse): VercelLikeRes {
  return {
    setHeader(name: string, value: string | string[]) {
      res.setHeader(name, value);
    },
    status(code: number) {
      return {
        json(body: unknown) {
          if (res.writableEnded) return;
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(body));
        },
      };
    },
  };
}

function queryFromUrl(url: URL): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  url.searchParams.forEach((value, key) => {
    q[key] = value;
  });
  return q;
}

async function readBodyString(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function setCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
}

type Handler = (
  req: {
    method?: string;
    query?: Record<string, unknown>;
    body?: unknown;
    headers?: Record<string, string | string[] | undefined>;
  },
  res: VercelLikeRes,
) => Promise<void>;

const routes = apiRoutes as Record<string, Handler>;

const port = Number(process.env.LOCAL_API_PORT || process.env.PORT || 3000);

const server = createServer(async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  let pathname: string;
  try {
    pathname = new URL(req.url || '/', `http://127.0.0.1`).pathname;
  } catch {
    res.statusCode = 400;
    res.end('Bad URL');
    return;
  }

  const handler = routes[pathname];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found', path: pathname }));
    return;
  }

  const url = new URL(req.url || '/', `http://127.0.0.1`);
  const query = queryFromUrl(url);
  const requestId = randomUUID();
  const started = Date.now();

  let body: unknown = undefined;
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const raw = await readBodyString(req);
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (raw.trim() && ct.includes('application/json')) {
      try {
        body = JSON.parse(raw) as unknown;
      } catch {
        body = raw;
      }
    } else if (raw.trim()) {
      body = raw;
    }
  }

  const vercelReq = {
    method: req.method,
    query,
    body,
    headers: req.headers as Record<string, string | string[] | undefined>,
  };

  logInfo('api.request', {
    requestId,
    method: req.method,
    path: pathname,
    queryKeys: Object.keys(query),
  });

  try {
    await handler(vercelReq, createRes(res));
    const ms = Date.now() - started;
    if (res.statusCode >= 400) {
      logWarn('api.response', { requestId, statusCode: res.statusCode, ms });
    } else {
      logInfo('api.response', { requestId, statusCode: res.statusCode, ms });
    }
  } catch (e) {
    if (!res.writableEnded) {
      const message = e instanceof Error ? e.message : String(e);
      logError('api.unhandled', { requestId, message, stack: e instanceof Error ? e.stack : undefined });
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Unhandled server error', message }));
    }
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[jarvis] Local API (no Vercel)  http://127.0.0.1:${port}`);
  console.log(`[jarvis] เปิด Vite ด้วย npm run dev — proxy /api → พอร์ต ${port}`);
});
