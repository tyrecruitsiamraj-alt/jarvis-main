/**
 * สีของ 4 ก้อน (AI โทร · คนโทร · ทั้งสองทาง · ยังไม่โทร) ของหน้าหลัก — ที่เดียว ใช้ทั้งเกจ ป้าย กราฟ แผงเลื่อน
 * อ่านจาก `TONE` เท่านั้น (มีคู่ `dark:` ครบ) · ไม่มี hex
 * - `dot` = จุดหน้าป้าย/แถบ · ยังไม่โทร = วงกลวง (จุดทึบสีพื้นจมหายในโหมดมืด — เจอตอนตรวจจอจริง 30 ก.ย. 2569)
 * - `fill` = สีตัวหนังสือที่กราฟ recharts ใช้ผ่าน `fill="currentColor"` · ยังไม่โทร = เทา แล้วไปหรี่ด้วย opacity
 */
import { TONE } from '@/lib/designTokens';
import { AI_SHARE_CALLED_TONE, type AiShareSegment } from '@/lib/homeAiShare';

export const segmentDotClass = (k: AiShareSegment): string =>
  k === 'notCalled' ? 'bg-muted ring-1 ring-inset ring-muted-foreground/60' : TONE[AI_SHARE_CALLED_TONE[k]].dot;

export const segmentFillClass = (k: AiShareSegment): string =>
  k === 'notCalled' ? TONE.neutral.value : TONE[AI_SHARE_CALLED_TONE[k]].value;
