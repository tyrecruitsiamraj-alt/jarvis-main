import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** ดึงเฉพาะเวลาเริ่มจากค่า shift เช่น "08:00-17:00" → "08:00" */
export function shiftStartLabel(shift: string | null | undefined): string {
  const t = shift?.trim();
  if (!t) return '';
  const i = t.indexOf('-');
  if (i <= 0) return t;
  return t.slice(0, i).trim() || t;
}
