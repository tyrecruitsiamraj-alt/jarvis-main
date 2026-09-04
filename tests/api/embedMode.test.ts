// @vitest-environment node
/**
 * โหมดฝัง iframe ของหน้าสาธารณะ (เจ้าของถาม 3 ก.ย. 2569)
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. `?embed=1` ตัดได้แค่ **เปลือก** (หัว/ท้าย/พื้นหลัง) — เนื้อหาและปุ่มสมัครต้องครบ
 * 2. ข้อความที่ส่งหาหน้าแม่มีแค่ **ความสูง** ห้ามมีข้อมูลอื่นติดไป
 * 3. ไม่ได้อยู่ในกรอบ = ไม่ต้องส่งอะไรเลย
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isEmbedMode, EMBED_HEIGHT_MESSAGE } from '../../src/lib/embedMode';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('isEmbedMode', () => {
  it('รับ ?embed=1 และ ?embed=true', () => {
    expect(isEmbedMode('?embed=1')).toBe(true);
    expect(isEmbedMode('?embed=true')).toBe(true);
  });

  it('ไม่ใส่ / ใส่ค่าอื่น = โหมดปกติ', () => {
    expect(isEmbedMode('')).toBe(false);
    expect(isEmbedMode('?embed=0')).toBe(false);
    expect(isEmbedMode('?pos=ขับรถ')).toBe(false);
  });

  it('อยู่ร่วมกับตัวกรองอื่นได้ (ลิงก์ฝังยังส่งตำแหน่งได้)', () => {
    expect(isEmbedMode('?pos=ขับรถ&embed=1')).toBe(true);
  });
});

describe('เลย์เอาต์โหมดฝัง', () => {
  const layout = read('src/components/layout/PublicApplyLayout.tsx');

  it('โหมดฝังคืนแค่เนื้อใน — ไม่มีหัว/ท้ายของเรา', () => {
    const branch = layout.slice(layout.indexOf('if (embed)'), layout.indexOf('if (embed)') + 200);
    expect(branch).toContain('{children}');
    expect(branch).not.toContain('<header');
    expect(branch).not.toContain('<footer');
  });

  it('🔴 ตัดแค่เปลือก — children (เนื้อหา+ปุ่มสมัคร) ยังถูกเรนเดอร์เสมอ', () => {
    // ทั้งสองทางเดินต้องมี {children}
    expect(layout.match(/\{children\}/g)?.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ข้อความบอกความสูง', () => {
  const src = read('src/lib/embedMode.ts');

  it('ชื่อข้อความเจาะจง กันชนกับสคริปต์อื่นบนหน้าที่เอาไปฝัง', () => {
    expect(EMBED_HEIGHT_MESSAGE).toBe('so-recruit:height');
  });

  it('ส่งแค่ type กับ height — ไม่มีข้อมูลอื่น', () => {
    expect(src).toMatch(/postMessage\(\{ type: EMBED_HEIGHT_MESSAGE, height: h \}/);
  });

  it('ไม่ได้อยู่ในกรอบ = ไม่ส่งอะไรเลย', () => {
    expect(src).toMatch(/if \(!isFramed\(\)\) return \(\) => \{\};/);
  });
});
