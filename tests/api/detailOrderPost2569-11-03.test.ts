/**
 * สั่ง Autopost / ขอ Scrap จากหน้ารายละเอียดใบขอ (เจ้าของ 3 พ.ย. 2569 "ทำให้สั่ง autopost กับ Scrap ตรงนี้ได้ด้วยเลย")
 * ใช้ตัวเดียวกับป๊อปประกาศ ห้ามเขียนฟอร์มใหม่
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ใบขอมีแท็บ Autopost / Scrap / โพสต์เอง (เจ้าของ 13 พ.ย. 2569 "ย้ายไปเป็นอีกแท็บ")', () => {
  it('ใช้ OrderPostButton ตัวเดียวกับป๊อปประกาศ + ทำอะไรไปแล้ว · หน้ารายละเอียดไม่มีกล่องนี้แล้ว', () => {
    const tab = readFileSync('src/pages/jobs/UnitRequestTabPage.tsx', 'utf8');
    expect(tab).toContain("{tab === 'actions' ? (");
    expect(tab).toContain('<OrderPostButton job={job} onLinksChanged={() => setActionsRev((n) => n + 1)} />');
    expect(tab).toContain('<JobPostActionsPanel jobId={job.id} tab={actionsTab} onTabChange={setActionsTab} reloadKey={actionsRev} />');
    expect(tab.indexOf('data-testid="unit-actions-done"')).toBeLessThan(tab.indexOf('data-testid="unit-actions-order"'));
    const detail = readFileSync('src/pages/jobs/SiamrajUnitRequestDetailPage.tsx', 'utf8');
    expect(detail).not.toContain('data-testid="detail-order-post"');
    expect(detail).not.toContain('<OrderPostFold');
  });
});
