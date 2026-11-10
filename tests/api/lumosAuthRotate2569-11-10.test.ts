// @vitest-environment node
/**
 * สลับรหัส Lumos (ตรวจทั้งระบบ 10 พ.ย. 2569 — รหัสเดิมหลุดในเอกสารบน repo สาธารณะ)
 * ช่วงสลับรับได้ทั้งรหัสเดิมและรหัสใหม่ · เทียบแบบเวลาคงที่ · deploy ส่งค่าใหม่ลง .env
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { matchLumosKey, sameSecret, withLumosAuth } from '../../api/_lib/lumos-auth';

const OLD = 'old-key-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const NEW = 'new-key-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function mockRes() {
  const out = { status: 0, body: null as unknown };
  const res = {
    status(c: number) {
      out.status = c;
      return res;
    },
    json(b: unknown) {
      out.body = b;
      return res;
    },
    setHeader() {
      return res;
    },
  };
  return { res, out };
}

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe('รหัส Lumos', () => {
  it('ตรงชุดไหน · ไม่ตรง = null · ไม่ได้ตั้งชุดใหม่ = รับแค่ชุดเดิม', () => {
    expect(matchLumosKey(OLD, OLD, NEW)).toBe('current');
    expect(matchLumosKey(NEW, OLD, NEW)).toBe('next');
    expect(matchLumosKey('wrong', OLD, NEW)).toBeNull();
    expect(matchLumosKey(NEW, OLD, null)).toBeNull();
    expect(sameSecret('a', 'a')).toBe(true);
    expect(sameSecret('a', 'ab')).toBe(false);
  });
  it('ช่วงสลับ: ทั้งรหัสเดิมและรหัสใหม่ผ่าน · รหัสอื่น 401', async () => {
    process.env.LUMOS_API_KEY = OLD;
    process.env.LUMOS_API_KEY_NEXT = NEW;
    let calls = 0;
    const h = withLumosAuth(async (_req, res) => {
      calls++;
      (res as unknown as { status: (n: number) => { json: (b: unknown) => void } }).status(200).json({ ok: true });
    });
    for (const [tok, want] of [[OLD, 200], [NEW, 200], ['nope-nope-nope', 401]] as const) {
      const { res, out } = mockRes();
      await h({ method: 'GET', headers: { authorization: `Bearer ${tok}` } }, res as never);
      expect(out.status).toBe(want);
    }
    expect(calls).toBe(2);
  });
  it('deploy ส่ง LUMOS_API_KEY_NEXT ลง .env', () => {
    expect(readFileSync('.github/workflows/deploy.yml', 'utf8')).toContain('./scripts/sync-env.sh .env LUMOS_API_KEY_NEXT "${{ secrets.LUMOS_API_KEY_NEXT }}"');
  });
});
