/**
 * ตัวเลขที่วิ่งจากค่าเดิมไปค่าใหม่ทุกครั้งที่ข้อมูลเปลี่ยน — รวมตอนเปลี่ยนช่วง/BU (เจ้าของ 24 ต.ค. 2569
 * *"Interactive ที่เวลาเปลี่ยนข้อมูลนะ"*) · ใช้ `useCountUp` ตัวเดียวกับกล่องหน้าหลัก แต่ไม่รีเซ็ตตอนเปลี่ยนช่วง
 * ระหว่างโหลดช่วงใหม่ (value = null) ค้างเลขเดิมไว้ ไม่โชว์ "—" คั่น — เลขวิ่งจากค่าเดิมตรงไปค่าใหม่
 * "—" เฉพาะตอนยังไม่เคยมีค่าเลย · ค่าแรกขึ้นทันที (คีย์เปลี่ยนจาก none → exec) ไม่วิ่งจาก 0 · ทศนิยม = คูณก่อนวิ่งแล้วหารกลับ (useCountUp คืนจำนวนเต็ม)
 */
import { useRef } from 'react';
import { useCountUp } from '@/hooks/useCountUp';

const FMT = new Map<number, Intl.NumberFormat>();
function fmtOf(decimals: number): Intl.NumberFormat {
  let f = FMT.get(decimals);
  if (!f) {
    f = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
    FMT.set(decimals, f);
  }
  return f;
}

export default function Num({ value, decimals = 0 }: { value: number | null | undefined; decimals?: number }) {
  const last = useRef<number | null>(null);
  if (value != null) last.current = value;
  const held = value ?? last.current;
  const scale = 10 ** decimals;
  const shown = useCountUp(Math.round((held ?? 0) * scale), held == null ? 'none' : 'exec');
  if (held == null) return <>—</>;
  return <>{fmtOf(decimals).format(shown / scale)}</>;
}
