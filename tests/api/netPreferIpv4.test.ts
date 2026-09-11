// @vitest-environment node
/**
 * บังคับออกเน็ตทาง IPv4 ก่อน (11 ก.ย. 2569)
 *
 * เหตุจริงจาก log: `ENETUNREACH ... Local (:::0)` = เครื่องไม่มีทางออก IPv6
 * แต่ DNS ปลายทางตอบ AAAA มาด้วย ⇒ เสียเวลากับเส้นตายทุกครั้ง
 */
import { describe, expect, it, vi, afterEach } from 'vitest';
import dns from 'node:dns';
import net from 'node:net';
import { preferIpv4 } from '../../api/_lib/netPreferIpv4.js';

afterEach(() => vi.restoreAllMocks());

describe('preferIpv4', () => {
  it('🔴 ค่าเริ่มต้น = เปิด · ตั้งทั้ง ipv4first และปิด autoSelectFamily', () => {
    const order = vi.spyOn(dns, 'setDefaultResultOrder').mockImplementation(() => undefined);
    const family = vi
      .spyOn(net, 'setDefaultAutoSelectFamily')
      .mockImplementation(() => undefined);
    expect(preferIpv4({})).toBe(true);
    expect(order).toHaveBeenCalledWith('ipv4first');
    expect(family).toHaveBeenCalledWith(false);
  });

  it('ปิดได้ด้วย NET_PREFER_IPV4=false (เผื่อวันหนึ่งเครื่องมี IPv6 จริง)', () => {
    const order = vi.spyOn(dns, 'setDefaultResultOrder').mockImplementation(() => undefined);
    expect(preferIpv4({ NET_PREFER_IPV4: 'false' })).toBe(false);
    expect(order).not.toHaveBeenCalled();
  });

  it('🔴 ตั้งไม่ได้ห้ามทำให้ process ล้ม — แค่กลับไปช้าเหมือนเดิม', () => {
    vi.spyOn(dns, 'setDefaultResultOrder').mockImplementation(() => {
      throw new Error('ตั้งไม่ได้');
    });
    expect(() => preferIpv4({})).not.toThrow();
    expect(preferIpv4({})).toBe(false);
  });

  it('Node ที่ไม่มี setDefaultAutoSelectFamily ก็ยังผ่าน (ได้ผลจาก ipv4first)', () => {
    vi.spyOn(dns, 'setDefaultResultOrder').mockImplementation(() => undefined);
    const orig = net.setDefaultAutoSelectFamily;
    // @ts-expect-error — จำลอง runtime เก่าที่ไม่มีฟังก์ชันนี้
    net.setDefaultAutoSelectFamily = undefined;
    try {
      expect(preferIpv4({})).toBe(true);
    } finally {
      net.setDefaultAutoSelectFamily = orig;
    }
  });
});
