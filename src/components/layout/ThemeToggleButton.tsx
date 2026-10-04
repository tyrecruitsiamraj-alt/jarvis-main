import React, { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadThemeMode, resolveTheme, setThemeMode } from '@/lib/theme';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * ปุ่มสลับโหมดสว่าง/มืดแบบปุ่มเดียว — หน้าประกาศ (/apply) ไม่มีปุ่มนี้มาก่อน (เจ้าของ 4 ต.ค. 2569:
 * *"ปุ่มโหมดมืด สว่าง สลับไม่มี"*) · จำค่าต่อเครื่องที่เดียวกับฝั่งเจ้าหน้าที่ (`setThemeMode`)
 * ไอคอนบอก "กดแล้วจะไปโหมดไหน" แบบเดียวกับหัวเว็บจอเล็กของฝั่งเจ้าหน้าที่
 */
const ThemeToggleButton: React.FC<{ className?: string }> = ({ className }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => resolveTheme(loadThemeMode()));
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    setTheme(next);
  };
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
      title={theme === 'dark' ? 'ตอนนี้โหมดมืด — กดเพื่อไปโหมดสว่าง' : 'ตอนนี้โหมดสว่าง — กดเพื่อไปโหมดมืด'}
      className={cn('shrink-0 text-muted-foreground hover:text-foreground', className)}
    >
      {theme === 'dark' ? <Sun className={TONE.warn.value} /> : <Moon className={TONE.info.value} />}
    </Button>
  );
};

export default ThemeToggleButton;
