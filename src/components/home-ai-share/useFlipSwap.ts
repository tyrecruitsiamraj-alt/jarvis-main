/**
 * ═══ ตัวคุมจังหวะ "พลิกไพ่" ของแท่งกราฟ (รอบ 12 · 30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"ให้หมุนก้อนพวกแท่งกราฟ แบบหมุนเหมือนหมุนไพ่"* → Choice **"กดสวิตช์แยก BU แท่งพลิกทุกแท่ง"**
 * จังหวะ: `key` เปลี่ยน (สลับ AI/คน ↔ แยก BU) ⇒ `out` แท่งเดิมหุบลง (ยังโชว์ของเดิม) → ครบเวลาแล้วสลับเป็นของใหม่ →
 * `in` แท่งใหม่กางออก → ครบเวลาอีกรอบกลับเป็น `idle`
 * - ค่าใหม่ที่ `key` เดิม (ข้อมูลอัปเดตในโหมดเดิม) = เปลี่ยนทันที ไม่พลิก
 * - กดสลับไปแล้วสลับกลับก่อนหุบเสร็จ = กางของเดิมกลับ (ไม่ค้างหุบ)
 * - เครื่องตั้งลดการเคลื่อนไหว = เปลี่ยนทันที
 * ตัวคิดเวลาอย่างเดียว — ท่าหมุนอยู่ที่ `AiShareUsageChart` · เทสต์ที่ `useFlipSwap.test.ts`
 */
import { useEffect, useRef, useState } from 'react';

export type FlipPhase = 'idle' | 'out' | 'in';

type FlipState<T> = { shown: T; key: string; phase: FlipPhase };

export function useFlipSwap<T>(value: T, key: string, halfMs: number, reduced: boolean): { shown: T; phase: FlipPhase } {
  const [state, setState] = useState<FlipState<T>>({ shown: value, key, phase: 'idle' });
  const halfRef = useRef(halfMs);
  halfRef.current = halfMs;

  // ค่า/key ใหม่เข้ามา
  useEffect(() => {
    if (key === state.key) {
      if (value !== state.shown || state.phase === 'out') {
        setState((s) => ({ ...s, shown: value, phase: s.phase === 'out' ? 'in' : s.phase }));
      }
      return undefined;
    }
    if (reduced) {
      setState({ shown: value, key, phase: 'idle' });
      return undefined;
    }
    setState((s) => ({ ...s, phase: 'out' }));
    const timer = window.setTimeout(() => setState({ shown: value, key, phase: 'in' }), halfRef.current);
    return () => window.clearTimeout(timer);
    // ตั้งใจดูแค่ค่าใหม่กับ key ใหม่ — state ของตัวเองไม่ใช่ตัวจุด
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, key, reduced]);

  // กางเสร็จแล้วกลับเป็นปกติ (แท่งที่เกิดใหม่ทีหลังไม่ต้องกางจาก 0 อีก)
  useEffect(() => {
    if (state.phase !== 'in') return undefined;
    const timer = window.setTimeout(() => setState((s) => (s.phase === 'in' ? { ...s, phase: 'idle' } : s)), halfRef.current);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.key]);

  return { shown: state.shown, phase: state.phase };
}
