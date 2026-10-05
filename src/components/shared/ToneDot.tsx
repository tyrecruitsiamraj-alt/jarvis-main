import { cn } from '@/lib/utils';
import { TONE, type ToneKey } from '@/lib/designTokens';

/**
 * จุดสีบอกสถานะ — แทนอิโมจิวงกลมสี (🔴🟢🟡🟠) ที่เจ้าของสั่งเอาออกทั้งระบบ 5 ต.ค. 2569
 * (*"อิโมจิที่ทำให้ดูเป็น Ai อะเอาออกด้วย"*) · สีมาจาก TONE ที่เดียว ความหมายเดิม (เขียว = ดี · แดง = ร้าย ฯลฯ)
 */
export default function ToneDot({ tone, className }: { tone: ToneKey; className?: string }) {
  return <span className={cn('inline-block h-2 w-2 shrink-0 rounded-full', TONE[tone].dot, className)} aria-hidden />;
}
