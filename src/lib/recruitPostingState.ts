/**
 * ═══ สถานะการออกหาคนรายใบ 9 แบบ — ภาพรวม v2 (เจ้าของ 17 พ.ย. 2569 · แบบ ZIP v2 IMPLEMENTATION ข้อ 4) ═══
 * แต่ละใบอยู่สถานะเดียว (ไม่ซ้อน) จากหลักฐานที่ระบบมี (`StuckSignals` เส้นเดิมของ /api/recruit-stuck):
 *   โพสต์แล้วมีรายชื่อ / โพสต์แล้วยังไม่มีรายชื่อ · รอ Autopost · ขึ้นหน้าประกาศอย่างเดียว · สร้างลิงก์แล้ว
 *   · มีรายชื่อแต่ไม่พบหลักฐานประกาศ · หาได้บางส่วน · เตรียมไว้ (สั่งแล้วไม่สำเร็จ/ยกเลิก) · ไม่พบหลักฐาน
 * ยังไม่เริ่มหา = ไม่พบหลักฐาน + เตรียมไว้ (ยังไม่พบการเผยแพร่) · ที่เหลือ = เริ่มหาคนแล้ว
 * ⚠️ ต่างจาก `isStartedRequest` (topics เดิม) ตรงคำสั่ง Autopost ที่ไม่สำเร็จ/ยกเลิก = ยังไม่เริ่ม (แบบ v2 · Gen link ≠ โพสต์สำเร็จ)
 * "ไม่พบหลักฐาน" ไม่ได้ยืนยันว่าไม่มีใครทำนอกระบบ
 */
import type { StuckRequest } from '@/lib/recruitStuck';

export const POSTING_STATES = ['postedApps', 'postedEmpty', 'queued', 'publicOnly', 'linked', 'namesOnly', 'fulfilledPartial', 'prepared', 'untouched'] as const;
export type PostingState = (typeof POSTING_STATES)[number];
export const POSTING_STATE_LABEL: Record<PostingState, string> = {
  postedApps: 'โพสต์ มีรายชื่อ',
  postedEmpty: 'โพสต์ ยังไม่มีรายชื่อ',
  queued: 'รอ Autopost',
  publicOnly: 'ขึ้นหน้าประกาศอย่างเดียว',
  linked: 'สร้างลิงก์แล้ว ยังไม่พบโพสต์',
  namesOnly: 'มีรายชื่อ ไม่พบหลักฐานประกาศ',
  fulfilledPartial: 'หาได้บางส่วนแล้ว',
  prepared: 'เตรียมไว้ ยังไม่เผยแพร่',
  untouched: 'ไม่พบหลักฐานการออกหาคน',
};
export const NOT_STARTED_STATES: readonly PostingState[] = ['untouched', 'prepared'];

export function postingStateOf(r: Pick<StuckRequest, 'signals' | 'applications' | 'filled'>): PostingState {
  const post = r.signals.post;
  const posted = post === 'posted' || post === 'completed' || post === 'filled';
  if (posted) return r.applications > 0 ? 'postedApps' : 'postedEmpty';
  if (post === 'pending' || post === 'in_progress') return 'queued';
  if (r.signals.released) return 'publicOnly';
  if (r.signals.links > 0) return 'linked';
  if (r.applications > 0) return 'namesOnly';
  if (r.filled > 0) return 'fulfilledPartial';
  if (post === 'rejected' || post === 'cancelled') return 'prepared';
  return 'untouched';
}

export const isPostingStarted = (r: Pick<StuckRequest, 'signals' | 'applications' | 'filled'>): boolean => !NOT_STARTED_STATES.includes(postingStateOf(r));
