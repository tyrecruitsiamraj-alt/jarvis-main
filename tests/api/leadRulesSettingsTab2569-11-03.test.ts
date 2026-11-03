/**
 * เกณฑ์ความเร่งใบขอย้ายไปหน้าตั้งค่า (เจ้าของ 3 พ.ย. 2569 "ย้ายไปไว้ที่หน้าตั้งค่าเลยทีเดียว" → Choice "ย้ายช่องตัวเลขแบบเดิม")
 * ย้าย = หน้าใบขอไม่มีการ์ดแล้ว · หน้าตั้งค่ามีแท็บเดียวที่ตั้งได้
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SETTINGS_GROUP_TABS, SETTINGS_TAB_LABEL } from '@/lib/settingsNav';

describe('เกณฑ์ความเร่งใบขอ อยู่หน้าตั้งค่าที่เดียว', () => {
  it('มีแท็บในกลุ่มข้อมูลอ้างอิง ต่อจากสถานะทำงาน', () => {
    expect(SETTINGS_TAB_LABEL.leadRules).toBe('เกณฑ์ความเร่งใบขอ');
    expect(SETTINGS_GROUP_TABS.data.slice(0, 2)).toEqual(['workStatus', 'leadRules']);
    expect(readFileSync('src/pages/settings/AdminSettings.tsx', 'utf8')).toContain("{activeTab === 'leadRules' && <RequestLeadRulesTab />}");
  });
  it('แท็บใช้ตัวกรอกเดิมแบบไม่พับ · หน้าใบขอไม่มีการ์ดแล้ว', () => {
    expect(readFileSync('src/pages/settings/RequestLeadRulesTab.tsx', 'utf8')).toContain('<RequestLeadRulesCard');
    expect(readFileSync('src/pages/settings/RequestLeadRulesTab.tsx', 'utf8')).toContain('embedded');
    expect(readFileSync('src/pages/jobs/SiamrajUnitRequestDetailPage.tsx', 'utf8')).not.toContain('<RequestLeadRulesCard');
  });
});
