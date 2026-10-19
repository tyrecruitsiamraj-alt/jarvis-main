// @vitest-environment node
/**
 * เจ้าของ 19 ต.ค. 2569 (หน้าไล่งานของใบ › ตรวจสอบ):
 * - "หาพื้นที่จากตรงนี้เอาเลขที่ใบขอมาโชว์หน่อย" → เลขที่ใบขอชิดขวาแถวป้ายช่องที่ขาด
 * - "พวก menu bar ฉันอยากได้แบบ Glass Menu" → `TabsList variant="glass"` (variant ใน ui/tabs ที่เดียว · ไม่เขียน CSS ใหม่)
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(p, 'utf8');

describe('หน้าไล่งานของใบ', () => {
  it('เลขที่ใบขออยู่แถวเดียวกับป้ายช่องที่ขาด', () => {
    const src = read('src/pages/jobs/BoardPostingPage.tsx');
    expect(src).toContain('data-testid="quick-request-no"');
    expect(src).toContain('{job.request_no}');
  });
  it('แถบตรวจสอบ/รายชื่อ เป็นแถบกระจก', () => {
    expect(read('src/pages/jobs/BoardPostingPage.tsx')).toContain('<TabsList variant="glass"');
  });
});

describe('ui/tabs: variant glass', () => {
  const src = read('src/components/ui/tabs.tsx');
  it('มี glass ทั้งแถบและแท็บ · ค่าตั้งต้นหน้าตาเดิม · ไม่เบลอ · ไม่มี hex', () => {
    expect(src).toContain('glass: [');
    expect(src).toContain('default: "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground"');
    expect(src).not.toMatch(/"[^"\n]*backdrop-blur/);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});
