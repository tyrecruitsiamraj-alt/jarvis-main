/**
 * ส่งชื่อ/เบอร์จากหน้าคัดสรรไปตั้งตารางโทรที่ Follow (ข้อ 7)
 *
 * พังเงียบที่คุมไว้: แยกคำนำหน้าผิด → ฟอร์มได้ "นายนายสมชาย" หรือ "นาง" + "สาวมาลี"
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildFollowPrefillPath,
  hasFollowPrefill,
  readFollowPrefill,
  safeFollowBackPath,
  splitPrefillName,
} from '@/lib/followPrefill';

describe('buildFollowPrefillPath / readFollowPrefill', () => {
  it('ส่งค่าไปแล้วอ่านกลับได้ครบ', () => {
    const path = buildFollowPrefillPath({ name: 'นายสมชาย ใจดี', phone: '0812345678', topic: 'แจ้งเข้างาน' });
    const back = readFollowPrefill(path.split('?')[1]);
    expect(back).toEqual({ name: 'นายสมชาย ใจดี', phone: '0812345678', topic: 'แจ้งเข้างาน' });
  });

  it('ไม่มีค่าอะไรเลย = path เปล่า ไม่มี ?', () => {
    expect(buildFollowPrefillPath({})).toBe('/follow');
    expect(hasFollowPrefill(readFollowPrefill(''))).toBe(false);
  });

  it('ค่าว่าง/ช่องว่างล้วน ไม่ถูกส่ง', () => {
    expect(buildFollowPrefillPath({ name: '   ', phone: '' })).toBe('/follow');
  });

  it('ตัดความยาวกันยัดข้อความยาวลง query', () => {
    const long = 'ก'.repeat(400);
    const back = readFollowPrefill(buildFollowPrefillPath({ name: long }).split('?')[1]);
    expect(back.name).toHaveLength(200);
  });
});

describe('splitPrefillName', () => {
  it('"นายสมชาย ใจดี" → นาย + สมชาย + ใจดี', () => {
    expect(splitPrefillName('นายสมชาย ใจดี')).toEqual({ prefix: 'นาย', first: 'สมชาย', last: 'ใจดี' });
  });

  it('🔴 "นางสาวมาลี" ต้องได้ นางสาว ไม่ใช่ นาง + "สาวมาลี"', () => {
    expect(splitPrefillName('นางสาวมาลี รักงาน')).toEqual({
      prefix: 'นางสาว',
      first: 'มาลี',
      last: 'รักงาน',
    });
  });

  it('ไม่มีคำนำหน้า = prefix ว่าง (ห้ามเดาเพศ)', () => {
    expect(splitPrefillName('สมชาย ใจดี').prefix).toBe('');
  });

  it('ชื่อเดียวไม่มีนามสกุล', () => {
    expect(splitPrefillName('หมิว')).toEqual({ prefix: '', first: 'หมิว', last: '' });
  });

  it('นามสกุลหลายคำถูกรวมไว้ด้วยกัน', () => {
    expect(splitPrefillName('สมชาย ณ อยุธยา').last).toBe('ณ อยุธยา');
  });

  it('ว่างเปล่า = ทุกช่องว่าง ไม่พัง', () => {
    expect(splitPrefillName('')).toEqual({ prefix: '', first: '', last: '' });
  });
});

/**
 * 🔴 ทางเข้า + ทางกลับ (เจ้าของสั่ง 4 ต.ค. 2569: *"มันต้องไม่ได้มีแค่ Function นะ มันต้องมีทางเข้า และทางเอากลับ"*)
 */
describe('ทางกลับหน้าเดิมหลังตั้งรอบโทร', () => {
  it('ส่ง back + ชื่อหน้าไป-กลับครบ', () => {
    const url = buildFollowPrefillPath({ name: 'นายทดสอบ', back: '/aftercare', backLabel: 'ดูแลหลังเริ่มงาน' });
    const p = readFollowPrefill(url.split('?')[1]);
    expect(p.back).toBe('/aftercare');
    expect(p.backLabel).toBe('ดูแลหลังเริ่มงาน');
  });

  it('🔴 รับเฉพาะ path ในระบบ — กันลิงก์พาออกนอกเว็บ', () => {
    expect(safeFollowBackPath('/jobs/board?view=applicants')).toBe('/jobs/board?view=applicants');
    expect(safeFollowBackPath('//evil.example')).toBeUndefined();
    expect(safeFollowBackPath('https://evil.example')).toBeUndefined();
    expect(safeFollowBackPath('/a b')).toBeUndefined();
    expect(safeFollowBackPath('')).toBeUndefined();
    expect(readFollowPrefill('pf_name=x&pf_back=//evil').back).toBeUndefined();
  });

  it('ต้นทางที่พามาหน้าติดตามส่งทางกลับมาด้วย · หน้าติดตามมีปุ่มกลับในฟอร์มและหน้าเสร็จสิ้น', () => {
    const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
    const aftercare = read('src/pages/aftercare/AftercarePage.tsx');
    expect(aftercare.match(/back: '\/aftercare'/g)?.length).toBe(2);
    expect(aftercare).toContain('backPath="/follow"');
    expect(read('src/components/recruit-rm/SelectionProgressControls.tsx')).toContain('back: `${location.pathname}${location.search}`');
    const page = read('src/pages/follow/FollowPage.tsx');
    expect(page.match(/กลับหน้า\{returnTo\.label\}/g)?.length).toBe(2);
  });

  it('ป๊อปรายชื่อจากเลขในแผงขั้นตอนของสาย มีปุ่มจัดการ (ไม่ใช่ทางตัน) · ย้ายไปดูแลแล้วมีปุ่มไปหน้านั้น', () => {
    const read = (rel: string) => fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
    expect(read('src/components/follow/FollowCallRoundsPanel.tsx')).toContain('onOpenPerson(entry);');
    expect(read('src/pages/follow/FollowPage.tsx')).toContain('onOpenPerson={(e) => {');
    expect(read('src/components/follow/FollowCompletedCard.tsx')).toContain("navigate('/aftercare')");
  });
});
