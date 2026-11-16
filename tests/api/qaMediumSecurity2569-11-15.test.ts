// @vitest-environment node
/**
 * รีวิวโค้ด 15 พ.ย. 2569 ข้อระดับกลาง (เจ้าของ "แก้ข้อระดับกลางที่เหลือต่อเลย")
 * BU ล็อกที่เซิร์ฟเวอร์ (ผลโพสต์กลุ่ม) · ผู้ช่วย AI ปิดชื่อ/ที่อยู่ (Choice "ปิดชื่อและที่อยู่ด้วย") · AI ไม่ทับบทวิเคราะห์ที่ตรวจแล้ว
 * · ติดต่อได้ของ AI นิยามเดียว
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { maskPeopleJson } from '../../api/_lib/aiAssistant/tools';
import { isTalkedBucket } from '@/lib/callMicroOutcome';

const read = (p: string) => readFileSync(p, 'utf8');

describe('ผลโพสต์กลุ่ม Facebook เห็นเฉพาะ BU ในสิทธิ์', () => {
  it('so-post-groups ใช้ BU จากสิทธิ์ · so-post-summary กรองใบขอตามสิทธิ์', () => {
    const g = read('api/_handlers/so-post-groups.ts');
    // 16 พ.ย. 2569: ตัวเลือก BU ย้ายไป soPostBuOf (เทสต์ handler ครบ 3 แบบสิทธิ์อยู่ soPostGroupsBu2569-11-16)
    expect(g).toContain('soPostBuOf(await loadMatchingBuScope(req.user), buRaw || null)');
    expect(g).toContain('pickDashboardBuSet(scope, raw)');
    const s = read('api/_handlers/so-post-summary.ts');
    expect(s).toContain('loadScopedRequestNoSet(req.user)');
    expect(s).toContain('all.rows.filter((r) => r.requestNo && scoped.has(r.requestNo))');
  });
});

describe('ผู้ช่วย AI ปิดชื่อและที่อยู่ก่อนส่ง OpenAI', () => {
  it('ช่องชื่อคน/ที่อยู่ปิด · name ของระเบียนที่มีเบอร์ปิด · ชื่อใบขอ/จังหวัดยังอ่านได้', () => {
    const out = JSON.parse(
      maskPeopleJson(
        JSON.stringify({
          items: [{ full_name: 'สมชาย ใจดี', phone: '0811111111', name: 'สมชาย', province: 'ชลบุรี', address: '12 ม.3', sub_district: 'บางพระ', age: 35 }],
          job: { name: 'พนักงานขับรถผู้บริหาร', unit_name: 'Fashionisland' },
        }),
      ),
    );
    expect(out.items[0]).toMatchObject({ full_name: '[ชื่อ]', name: '[ชื่อ]', address: '[ที่อยู่]', sub_district: '[ที่อยู่]', province: 'ชลบุรี', age: 35 });
    expect(out.job).toEqual({ name: 'พนักงานขับรถผู้บริหาร', unit_name: 'Fashionisland' });
    expect(maskPeopleJson('ไม่ใช่ JSON')).toBe('ไม่ใช่ JSON');
    expect(read('api/_lib/aiAssistant/tools.ts')).toContain('maskPersonal(maskPeopleJson(payload))');
  });
});

describe('AI ร่างแบบทดสอบไม่ทับของที่เจ้าหน้าที่ตรวจแล้ว', () => {
  it('เบื้องหลังเขียนเฉพาะใบที่ยังไม่ตรวจ · กดร่างใหม่เองล้างสถานะตรวจแล้ว', () => {
    const lib = read('api/_lib/skillQuiz.ts');
    expect(lib).toContain('where id = $1::uuid and ($3::boolean or reviewed_at is null)');
    expect(lib).toContain('reviewed_at = null, reviewed_by_name = null');
    expect(read('api/_handlers/skill-quiz.ts')).toContain('draftQuizWithAi(id, { manual: true })');
    expect(read('api/_handlers/public/skill-quiz.ts')).toContain('void draftQuizWithAi(a.id)');
  });
});

describe('ติดต่อได้ของ AI นิยามเดียว', () => {
  it('คุยได้ = ตอบ/ไม่ไป/ยังไม่แน่ใจ/สรุปไม่ได้ · ไม่รับสาย/ผิดคน/รับแล้วเงียบ = ไม่ใช่', () => {
    expect(['said_yes', 'said_no', 'not_yet', 'talked_unclear'].every(isTalkedBucket)).toBe(true);
    expect(['no_pickup', 'wrong_person', 'picked_silent', null, 'confirmed'].some(isTalkedBucket)).toBe(false);
    expect(read('src/lib/callerResults.ts')).not.toContain('AI_REACHED');
  });
});
