import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { devicesOf, readPhoneBoxStatus } from '../../api/_lib/phoneBox';

/** เจ้าของ 16 พ.ย. 2569 "ฉันจะใส่กุญแจให้ ถ้าใส่แล้วนายเช็คได้ไหม" — อ่านสถานะ phone-box อย่างเดียว */
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('phone-box: เช็กเครื่อง + บัญชี (อ่านอย่างเดียว)', () => {
  it('อุปกรณ์ → แถวบนจอ · ไม่มีบัญชี = null · ค่าแปลกไม่ล้ม', () => {
    expect(devicesOf({ devices: [{ serial: 'R5', account_id: 'a1', account_name: 'Grim', adb_state: 'device', device_online: true, facebook_foreground: true }] })).toEqual([
      { serial: 'R5', accountId: 'a1', accountName: 'Grim', online: true, adbState: 'device', facebookOpen: true, groups: null, groupsMapped: null },
    ]);
    expect(devicesOf({ devices: [{ serial: 'X', adb_state: 'offline' }] })[0]).toMatchObject({ accountId: null, online: false, facebookOpen: null });
    expect(devicesOf(null)).toEqual([]);
  });

  it('ใช้ Bearer · GET เท่านั้น · นับกลุ่มของบัญชีที่ผูก', async () => {
    const calls: Array<{ url: string; method: string; auth: string | null }> = [];
    const fake = (async (url: string, init?: RequestInit) => {
      const h = new Headers(init?.headers);
      calls.push({ url, method: init?.method ?? 'GET', auth: h.get('authorization') });
      if (url.endsWith('/v1/health')) return json({ status: 'ok', online_devices: 1 });
      if (url.endsWith('/v1/devices')) return json({ devices: [{ serial: 'R5', account_id: 'a1', device_online: true }, { serial: 'R6', device_online: false, adb_state: 'offline' }] });
      if (url.endsWith('/v1/accounts/a1/groups')) return json({ account_id: 'a1', groups: [{ name: 'g1', destination_mapped: true }, { name: 'g2', destination_mapped: false }] });
      return json({}, 404);
    }) as unknown as typeof fetch;
    const s = await readPhoneBoxStatus('https://pb.test', 'k123', fake);
    expect(s).toMatchObject({ ok: true, status: 'ok', onlineDevices: 1 });
    expect(s.ok && s.devices.map((d) => [d.serial, d.groups, d.groupsMapped])).toEqual([
      ['R5', 2, 1],
      ['R6', null, null],
    ]);
    expect(calls.every((c) => c.method === 'GET' && c.auth === 'Bearer k123')).toBe(true);
    expect(calls.some((c) => c.url.includes('/v1/posts'))).toBe(false);
  });

  it('กุญแจผิด = บอกบนจอ ไม่โยน error', async () => {
    const fake = (async () => json({ error: 'unauthorized' }, 401)) as unknown as typeof fetch;
    expect(await readPhoneBoxStatus('https://pb.test', 'bad', fake)).toEqual({ ok: false, message: 'กุญแจ phone-box ไม่ถูกต้อง' });
  });

  it('จอ: การ์ดอยู่หน้าเชื่อมระบบภายนอก · ช่องกุญแจเป็น password · ไม่มีปุ่มสั่งโพสต์', () => {
    const tab = readFileSync('src/pages/settings/IntegrationKeysTab.tsx', 'utf8');
    expect(tab).toContain('<PhoneBoxKeyCard />');
    const card = readFileSync('src/pages/settings/PhoneBoxKeyCard.tsx', 'utf8');
    expect(card).toContain('type="password"');
    expect(card).not.toMatch(/\/v1\/posts/);
    const h = readFileSync('api/_handlers/integration-keys.ts', 'utf8');
    expect(h).toContain('PHONE_BOX_KEY_NAME');
  });
});
