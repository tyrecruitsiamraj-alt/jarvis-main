/** ก๊อปปี้: clipboard ถูกกัน = ถอยไป execCommand (27 ต.ค. 2569 เจ้าของกดก๊อปปี้ลิงก์ไม่ได้) */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './copyText';

afterEach(() => vi.restoreAllMocks());

describe('copyText', () => {
  it('clipboard ใช้ได้ = ใช้ clipboard', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true });
    await copyText('a');
    expect(write).toHaveBeenCalledWith('a');
  });

  it('clipboard ถูกกัน = ถอยไป execCommand · ไม่ได้ทั้งคู่ = throw', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true });
    const exec = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    await copyText('b');
    expect(exec).toHaveBeenCalledWith('copy');
    exec.mockReturnValue(false);
    await expect(copyText('c')).rejects.toThrow();
  });
});
