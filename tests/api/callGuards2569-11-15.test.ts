// @vitest-environment node
/**
 * กันสั่ง AI โทรหาคนจริงโดยไม่ตั้งใจ (QA + รีวิวโค้ด 15 พ.ย. 2569 · เจ้าของ "แก้เรื่องที่ 1 เลย")
 * 1. ค้นผู้สมัคร iRecruit ?send=1 ผ่าน GET = 405 (10 พ.ย. แก้เลนสรรหา/คัดสรรแล้วแต่ตกเส้นนี้)
 * 2. ผู้ช่วย AI อ่าน (GET) เส้นที่ทำให้โทรได้ไม่ได้ — GET รันทันทีไม่ขึ้นการ์ด
 * 3. การ์ด "ทำเลย" บอกของจริงที่จะยิง (ทำอะไร · ที่ไหน · ค่าที่ส่ง) ไม่ใช่แค่สรุปของ AI
 * 4. "ส่งทั้งหมดที่แมท" ส่งเฉพาะคนที่ AI แนะนำ ไม่รวมคนห่างไกลที่โชว์อยู่
 * 5. ปุ่มส่ง AI โทรบนแถวผู้สมัครมีคำ
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveCall, searchApi } from '../../api/_lib/aiAssistant/tools';
import { describePending } from '@/lib/aiChatPendingView';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ค้นผู้สมัคร iRecruit สั่งโทรได้จาก POST เท่านั้น', () => {
  it('GET ?send=1 = 405 · หน้าจับคู่งานส่ง POST', () => {
    const h = read('api/_handlers/matching-irecruit-candidates.ts');
    expect(h).toContain("if (wantsSend && method !== 'POST') {");
    expect(h).toContain('const forceSend = wantsSend;');
    expect(read('src/pages/matching/MatchingPage.tsx')).toContain(
      "apiFetch(`/api/matching/irecruit-candidates?${params.toString()}`, send ? { method: 'POST' } : undefined)",
    );
  });
});

describe('ผู้ช่วย AI อ่านเส้นที่ทำให้โทรไม่ได้', () => {
  const refused = (m: string, p: string) => !resolveCall(m, p).ok;
  it('ค้นผู้สมัคร iRecruit ทุกแบบ · GET ที่มี send/run/dispatch บนเส้นที่ไปถึงคน = ไม่ได้', () => {
    expect(refused('GET', '/api/matching/irecruit-candidates?jobId=OPL6911001')).toBe(true);
    expect(refused('GET', '/api/matching/irecruit-candidates?jobId=OPL6911001&send=1')).toBe(true);
    expect(refused('POST', '/api/matching/irecruit-candidates?jobId=OPL6911001&send=1')).toBe(true);
    expect(refused('GET', '/api/matching/recruit-lane?jobId=OPL6911001&send=1')).toBe(true);
    expect(refused('GET', '/api/matching/selection-recall?jobId=OPL6911001&send=1')).toBe(true);
  });
  it('อ่านธรรมดายังได้ · สารบัญบอกว่าใช้ไม่ได้', () => {
    expect(resolveCall('GET', '/api/matching/recruit-lane?jobId=OPL6911001').ok).toBe(true);
    expect(resolveCall('GET', '/api/follow?limit=5').ok).toBe(true);
    expect(searchApi('irecruit candidates')).not.toMatch(/\/api\/matching\/irecruit-candidates \[อ่านอย่างเดียว\]/);
  });
});

describe('การ์ด "ทำเลย" บอกของจริงที่จะยิง', () => {
  it('ลบ/แก้/เพิ่ม · เส้น · ค่าท้ายลิงก์ + ทุกช่องใน body', () => {
    const d = describePending({ method: 'DELETE', path: '/api/app-users?id=5f2c', body: null });
    expect(d).toEqual({ verb: 'ลบ', target: 'app-users', fields: [{ key: 'id', value: '5f2c' }], more: 0 });
    const p = describePending({ method: 'PATCH', path: '/api/role-permissions', body: { role: 'staff', grants: ['a', 'b'] } });
    expect(p.verb).toBe('แก้');
    expect(p.fields).toEqual([
      { key: 'role', value: 'staff' },
      { key: 'grants', value: '["a","b"]' },
    ]);
    expect(describePending({ method: 'POST', path: '/api/x', body: { t: 'ก'.repeat(200) } }).fields[0].value.length).toBe(121);
  });
  it('การ์ดโชว์รายละเอียดใต้สรุปของ AI', () => {
    const chat = read('src/components/ai/AiChat.tsx');
    expect(chat).toContain('<PendingDetail method={pending.method} path={pending.path} body={pending.body} />');
  });
});

describe('ส่งทั้งหมดที่แมท = เฉพาะ AI แนะนำ', () => {
  it('ไม่ตามสวิตช์โชว์คนห่างไกล', () => {
    const page = read('src/pages/matching/MatchingPage.tsx');
    const blk = page.slice(page.indexOf('const approveAllTargets = useMemo('), page.indexOf('const approveAllCount ='));
    expect(blk).not.toContain('showDistantCandidates');
    expect(blk.match(/isRecommendedTier\(m\.tier\) &&/g)).toHaveLength(2);
  });
});

describe('ปุ่มส่ง AI โทรบนแถวผู้สมัครมีคำ', () => {
  it('worded ทุกแถว', () => {
    const t = read('src/components/recruit-rm/RmTable.tsx');
    expect(t).toContain("const worded = tab === 'contact' || (tab === 'appointments' && a === 'rule') || a === 'ai' || a === 'nocall' || a === 'docs' || a === 'irecruit';");
    expect(t).toContain("a === 'ai' ? 'ส่ง AI โทร' : a === 'nocall' ?");
  });
});
