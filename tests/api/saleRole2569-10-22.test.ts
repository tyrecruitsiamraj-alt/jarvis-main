/**
 * บทบาท Sale (เจ้าของ 22 ต.ค. 2569 "ทำบทบาท sale ไว้รอ") — อ่านอย่างเดียวชุดเดียวกับ OPL จนกว่าหน้าประเมิน Tier เสร็จ
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isReadOnlyRole, meetsMinimumRole } from '@/lib/rbac';
import { isReadOnlyRole as apiReadOnly, meetsMinimumRole as apiMeets } from '../../api/_lib/rbac';
import { ROLE_LABELS, ROLE_ORDER } from '@/lib/roleFunctions';

const read = (f: string) => fs.readFileSync(path.join(process.cwd(), f), 'utf8');

describe('บทบาท Sale', () => {
  it('อ่านอย่างเดียว · สิทธิ์เท่า OPL ทั้งหน้าเว็บและเซิร์ฟเวอร์', () => {
    for (const [ro, meets] of [[isReadOnlyRole, meetsMinimumRole], [apiReadOnly, apiMeets]] as const) {
      expect(ro('sale')).toBe(true);
      expect(meets('sale', 'staff')).toBe(true);
      expect(meets('sale', 'supervisor')).toBe(false);
      expect(meets('sale', 'admin')).toBe(false);
    }
    expect(ROLE_ORDER).toContain('sale');
    expect(ROLE_LABELS.sale).toBe('Sale (อ่านอย่างเดียว)');
  });
  it('ตั้งบทบาทได้ทุกทางเข้า (ฐาน · login Microsoft · หน้าผู้ใช้งาน · หน้าเริ่มของบทบาท)', () => {
    expect(read('migrations/161_sale_role.sql')).toContain("CHECK (role IN ('admin', 'supervisor', 'staff', 'opl', 'sale'))");
    for (const f of ['api/_handlers/auth/azure-ad-callback.ts', 'api/_handlers/app-users.ts', 'api/_handlers/auth/login.ts', 'api/_lib/auth.ts']) {
      expect(read(f)).toMatch(/'sale'/);
    }
    expect(read('src/pages/settings/AdminSettings.tsx')).toContain('<option value="sale">');
    expect(read('src/App.tsx')).toContain('<Route path="/sale" element={<RoleHubPage role="sale" />} />');
  });
});
