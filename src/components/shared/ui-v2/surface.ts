/**
 * ═══ ชุดคลาสพื้นผิว — ตัวแปลระหว่าง "แผงพื้นเข้มแบบเดิม" กับ "ผืนขาวโฉมใหม่" ═══
 *
 * ปัญหาที่แก้: แผงหลายตัว (funnel หน้าติดตาม · แผง AI โทรหน้าจับคู่งาน · hero ของ
 * Dashboard) ถูกเขียนไว้สำหรับ **พื้นเข้มเท่านั้น** — สีตัวหนังสือ/เส้นขอบ/พื้นกล่อง
 * ฝังเป็น `text-slate-400` `border-white/[0.14]` `bg-white/[0.07]` กระจายเต็มไฟล์
 * พอโฉมใหม่ย้ายแผงมาอยู่บนพื้นขาว ของพวกนี้จะจมหายไปกับพื้นทันที
 *
 * ⇒ รวมไว้ที่เดียว แล้วให้ไฟล์จอเรียก `useSurfaceKit()` ตัวเดียว
 * **เปลี่ยนแค่สี ไม่แตะโครง/ข้อมูล** · ปิดสวิตช์ `?ui=v1` = ได้ชุดเดิมกลับทั้งหมด
 *
 * 🔴 ไม่มี CSS ใหม่ — ทุกค่าเป็น utility ของ Tailwind + token ของธีม
 */
import type { ToneClasses } from '@/lib/designTokens';
import { useUiV2 } from '@/lib/uiV2';

export type SurfaceKit = {
  /** โฉมใหม่อยู่ไหม — ไว้ใช้กับเคสที่คลาสเดียวไม่พอ */
  v2: boolean;
  /** กล่องตัวเลขบนแผง */
  tile: string;
  /** hover ของกล่องที่กดได้ */
  tileHover: string;
  /** ป้ายเล็กเหนือตัวเลข */
  label: string;
  /** ตัวหนังสือรอง */
  muted: string;
  /** ตัวหนังสือจางสุด */
  faint: string;
  /** ตัวหนังสือเด่นบนแผง */
  strong: string;
  /** เส้นคั่นในแผง */
  line: string;
  /** ชิปเล็กบนแผง */
  chip: string;
  /** สีตัวเลขตามความหมาย — เลือกชุดที่อ่านออกบนพื้นของโฉมนั้น */
  toneValue: (t: ToneClasses) => string;
};

const DARK: Omit<SurfaceKit, 'v2'> = {
  tile: 'border border-white/[0.14] bg-white/[0.07]',
  tileHover: 'hover:bg-white/[0.12]',
  label: 'text-slate-400',
  muted: 'text-slate-400',
  faint: 'text-slate-500',
  strong: 'text-slate-200',
  line: 'border-white/10',
  chip: 'border border-white/[0.14] bg-white/[0.07] text-slate-200',
  toneValue: (t) => t.onDark,
};

const LIGHT: Omit<SurfaceKit, 'v2'> = {
  tile: 'border border-border bg-background/60',
  tileHover: 'hover:bg-accent',
  label: 'text-muted-foreground',
  muted: 'text-muted-foreground',
  faint: 'text-muted-foreground',
  strong: 'text-foreground',
  line: 'border-border',
  chip: 'border border-border bg-background/60 text-foreground',
  toneValue: (t) => t.value,
};

export function useSurfaceKit(): SurfaceKit {
  const v2 = useUiV2();
  return { v2, ...(v2 ? LIGHT : DARK) };
}
