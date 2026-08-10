// @vitest-environment node
/**
 * บั๊กจริง 2 กลุ่มที่เจอตอนเปิด typecheck ให้ api/ ครั้งแรก (tsconfig.api.json)
 * — เดิม **ไม่มี config ไหนครอบ api/ เลย** ทั้งที่กติกาบอกให้เช็ค "สองคอนฟิก"
 *
 * 1. logError(msg, e, ctx): Error ไปนั่งช่อง fields (property ของ Error เป็น
 *    non-enumerable → spread ไม่ออก) และ context ถูกทิ้ง — log วิกฤตอย่าง
 *    "lumos.followup.failed" เลยไม่มีทั้งข้อความ error และ queueId
 * 2. เส้นปล่อยชุดโทร (callBatchDispatcher) อ้าง c.full_name ที่ไม่มีในชนิดข้อมูล
 *    → undefined เสมอ → Lumos โทรไปเรียกชื่อเล่นหรือ "การ์ด n" แทนชื่อจริง
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { logError } from '../../api/_lib/logger.js';

describe('logError — ต้องเก็บทั้ง error และ context', () => {
  const capture = () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    return {
      line: () => JSON.parse(String(spy.mock.calls[0][0])) as Record<string, unknown>,
      restore: () => spy.mockRestore(),
    };
  };

  it('(msg, Error, context) — แบบที่ 5 จุดในระบบเรียกอยู่จริง', () => {
    const c = capture();
    logError('lumos.followup.failed', new Error('DB ล่ม'), { queueId: 42 });
    const line = c.line();
    expect(line.msg).toBe('lumos.followup.failed');
    expect(line.message).toBe('DB ล่ม');
    expect(line.queueId).toBe(42);
    expect(String(line.stack)).toContain('Error');
    c.restore();
  });

  it('(msg, fields) แบบเดิมยังใช้ได้เหมือนเดิม', () => {
    const c = capture();
    logError('x.failed', { jobId: 'j1' });
    expect(c.line().jobId).toBe('j1');
    c.restore();
  });

  it('โยนของที่ไม่ใช่ Error มาก็ไม่หาย (สตริง/ตัวเลข → message)', () => {
    const c = capture();
    logError('x.failed', 'timeout 30s');
    expect(c.line().message).toBe('timeout 30s');
    c.restore();
  });
});

describe('เส้นปล่อยชุดโทร — ชื่อคนต้องประกอบจาก first/last จริง', () => {
  const src = readFileSync(
    path.resolve(process.cwd(), 'api/_lib/callBatchDispatcher.ts'),
    'utf8',
  );

  it('ไม่อ้าง c.full_name ที่ไม่มีอยู่จริงอีก (undefined เสมอ = เรียกชื่อผิดทุกราย)', () => {
    expect(src).not.toMatch(/full_name:\s*c\.full_name/);
    expect(src).toMatch(/\[c\.first_name, c\.last_name\]\.filter\(Boolean\)\.join\(' '\)/);
  });

  it('ฝั่ง iRecruit ส่ง job_name_th/position_name ให้ payload ครบ (บทพูด AI ต้องมีชื่อตำแหน่ง)', () => {
    expect(src).toMatch(/job_name_th: c\.job_name_th/);
    expect(src).toMatch(/position_name: c\.position_name/);
  });
});
