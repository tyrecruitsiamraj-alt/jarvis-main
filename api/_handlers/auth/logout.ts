import { buildClearCookieHeader } from '../../_lib/auth.js';
import { type ApiReq, type ApiRes } from '../../_lib/http.js';

export default async function handler(_req: ApiReq, res: ApiRes) {
  res.setHeader?.('Set-Cookie', buildClearCookieHeader());
  return res.status(200).json({ ok: true });
}
