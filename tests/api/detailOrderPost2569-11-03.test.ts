/**
 * สั่ง Autopost / ขอ Scrap จากหน้ารายละเอียดใบขอ (เจ้าของ 3 พ.ย. 2569 "ทำให้สั่ง autopost กับ Scrap ตรงนี้ได้ด้วยเลย")
 * ใช้ตัวเดียวกับป๊อปประกาศ ห้ามเขียนฟอร์มใหม่
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('หน้ารายละเอียดใบขอมีกล่อง Autopost / Scrap', () => {
  it('ใช้ OrderPostButton ตัวเดียวกับป๊อปประกาศ', () => {
    const src = readFileSync('src/pages/jobs/SiamrajUnitRequestDetailPage.tsx', 'utf8');
    expect(src).toContain("import OrderPostButton from '@/components/jobs/OrderPostButton';");
    expect(src).toContain('<OrderPostButton job={data} />');
    expect(src).toContain('data-testid="detail-order-post"');
  });
});
