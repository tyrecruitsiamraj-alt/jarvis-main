import React from 'react';
import { cn } from '@/lib/utils';
import { useBranding } from '@/contexts/BrandingContext';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';

const sizeClass: Record<Size, { box: string; text: string; img: string }> = {
  xs: { box: 'w-6 h-6 rounded-md', text: 'text-[10px]', img: 'w-6 h-6 rounded-md' },
  sm: { box: 'w-7 h-7 rounded-lg', text: 'text-xs', img: 'w-7 h-7 rounded-lg' },
  md: { box: 'w-8 h-8 rounded-lg', text: 'text-sm', img: 'w-8 h-8 rounded-lg' },
  lg: { box: 'w-16 h-16 rounded-2xl', text: 'text-2xl', img: 'w-16 h-16 rounded-2xl' },
  xl: { box: 'w-28 h-28 rounded-3xl', text: 'text-3xl', img: 'w-28 h-28 rounded-3xl p-3' },
  hero: {
    box: 'w-44 h-44 rounded-full',
    text: 'text-4xl',
    /* ทรง hero — พื้นโปร่งเหมือนกัน (เจ้าของสั่ง 4 ก.ย. 2569) */
    img: 'w-44 h-44 rounded-full p-5 object-contain',
  },
};

export const BrandMark: React.FC<{ size?: Size; className?: string }> = ({ size = 'md', className }) => {
  const { config } = useBranding();
  const s = sizeClass[size];
  const letter = (config.appName || 'S').trim().charAt(0).toUpperCase() || 'S';

  if (config.logoDataUrl) {
    return (
      <img
        src={config.logoDataUrl}
        alt=""
        /**
         * 🔴 **พื้นหลังโลโก้โปร่งใส** (เจ้าของสั่ง 4 ก.ย. 2569) — เดิมใส่ `bg-card`
         * + ขอบ ทำให้โลโก้เป็นสี่เหลี่ยมขาวแปะอยู่บนพื้นทุกที่ (เห็นชัดสุดที่หน้าล็อกอิน
         * ซึ่งพื้นเป็นภาพ) · ไฟล์โลโก้เป็น PNG โปร่งอยู่แล้ว ไม่ต้องมีพื้นรอง
         */
        className={cn(s.img, 'object-contain', className)}
      />
    );
  }

  return (
    <div className={cn(s.box, 'bg-primary flex items-center justify-center shrink-0', className)}>
      <span className={cn('text-primary-foreground font-bold', s.text)}>{letter}</span>
    </div>
  );
};

export const BrandTitle: React.FC<{ className?: string }> = ({ className }) => {
  const { config } = useBranding();
  return <span className={className}>{config.appName || 'So Recruit'}</span>;
};
