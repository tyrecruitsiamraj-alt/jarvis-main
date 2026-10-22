/**
 * ตั้งค่า › เชื่อมระบบภายนอก (เจ้าของ 22 ต.ค. 2569 "ทุกอย่างต้องทำผ่าน UI ได้นะ") — ออก/ยกเลิก key ได้จากหน้าจอ
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SETTINGS_GROUP_TABS, SETTINGS_TAB_LABEL } from '@/lib/settingsNav';
import { isIntegrationName } from '@/lib/integrationKeys';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('เชื่อมระบบภายนอก', () => {
  it('มีแท็บในตั้งค่า กลุ่มระบบอัตโนมัติ', () => {
    expect(SETTINGS_GROUP_TABS.automation).toContain('integrations');
    expect(SETTINGS_TAB_LABEL.integrations).toBe('เชื่อมระบบภายนอก');
    expect(read('src/pages/settings/AdminSettings.tsx')).toContain("{activeTab === 'integrations' && <IntegrationKeysTab />}");
  });
  it('API แอดมินเท่านั้น · ออกใหม่เก็บแค่แฮช + ล้างแคช · ยกเลิกล้างแคช · จดบันทึก', () => {
    const h = read('api/_handlers/integration-keys.ts');
    expect(h).toContain("if (req.user.role !== 'admin') return sendError(res, 403");
    expect(h).toContain('[name, sha256Hex(key)]');
    expect(h.match(/clearIntegrationKeyCache\(name\)/g)?.length).toBe(2);
    expect(h).toContain("action: 'integration_key.issue'");
    expect(h).toContain("action: 'integration_key.revoke'");
    expect(read('api/_handlers/registry.ts')).toContain("'/api/integration-keys': integrationKeysHandler");
    expect(isIntegrationName('so-scraping')).toBe(true);
    expect(isIntegrationName('x')).toBe(false);
  });
  it('หน้าจอ: ออกใหม่/ยกเลิกต้องยืนยัน · key ใหม่ขึ้นครั้งเดียวพร้อมปุ่มก๊อป · ใช้ล่าสุด · ยอดคอมเมนต์', () => {
    const t = read('src/pages/settings/IntegrationKeysTab.tsx');
    for (const id of ['integration-issue', 'integration-revoke', 'integration-confirm', 'integration-new-key', 'integration-last-used', 'integration-stats']) {
      expect(t).toContain(id);
    }
    expect(read('migrations/162_integration_key_last_used.sql')).toContain('add column if not exists last_used_at');
  });
});
