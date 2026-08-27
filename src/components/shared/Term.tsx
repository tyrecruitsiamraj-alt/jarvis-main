/**
 * `<Term>` — คำในบ้านที่มีคำอธิบายติดตัว
 *
 * 🔴 คนใหม่เจอศัพท์ 21 คำที่ไม่มีใครอธิบาย (audit 26 ส.ค. 2569) · ตัวนี้ทำให้
 * ทุกที่ที่พูดถึงศัพท์นั้น **ได้คำอธิบายชุดเดียวกัน** จาก `src/lib/glossary.ts`
 *
 * ใช้: `<Term k="lumos" />` หรือ `<Term k="sla">SLA / ด่วนก่อน</Term>`
 * (ใส่ children เมื่อคำบนจอยาวกว่าตัวศัพท์ แต่ยังหมายถึงเรื่องเดียวกัน)
 *
 * ⚠️ เส้นใต้แบบจุดคือสัญญาณสากลว่า "ชี้แล้วมีคำอธิบาย" — ห้ามเปลี่ยนเป็นลิงก์สีฟ้า
 * เพราะมันไม่ได้พาไปไหน (กติกา: ห้ามให้ของที่กดไม่ได้ดูเหมือนกดได้)
 */
import React from 'react';
import { cn } from '@/lib/utils';
import { GLOSSARY, glossaryHelp, type GlossaryKey } from '@/lib/glossary';

const Term: React.FC<{
  k: GlossaryKey;
  children?: React.ReactNode;
  className?: string;
}> = ({ k, children, className }) => (
  <abbr
    title={glossaryHelp(k)}
    className={cn(
      'cursor-help underline decoration-dotted decoration-slate-400 underline-offset-2 dark:decoration-slate-500',
      className,
    )}
  >
    {children ?? GLOSSARY[k].term}
  </abbr>
);

export default Term;
