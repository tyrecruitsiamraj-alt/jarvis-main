/**
 * ส่งชื่อ/เบอร์จากหน้าคัดสรรไปตั้งตารางโทรที่ Follow (ข้อ 7)
 *
 * พังเงียบที่คุมไว้: แยกคำนำหน้าผิด → ฟอร์มได้ "นายนายสมชาย" หรือ "นาง" + "สาวมาลี"
 */
import { describe, expect, it } from 'vitest';
import {
  buildFollowPrefillPath,
  hasFollowPrefill,
  readFollowPrefill,
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
