import React from 'react';
import { cn } from '@/lib/utils';
import { avatarColor, nameInitials } from '@/lib/nameAvatar';

type Props = {
  name: string;
  className?: string;
  /** sm = ในตาราง · md = ในรายการที่มีหลายบรรทัด */
  size?: 'sm' | 'md';
};

/** ตัวย่อชื่อในวงกลม สีประจำคน (mockup rev.3 ข้อ 06/07) */
const NameAvatar: React.FC<Props> = ({ name, className, size = 'sm' }) => (
  <span
    aria-hidden
    className={cn(
      'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white',
      size === 'sm' ? 'h-6 w-6 text-[9px]' : 'h-8 w-8 text-[11px]',
      className,
    )}
    style={{ background: avatarColor(name) }}
  >
    {nameInitials(name)}
  </span>
);

export default NameAvatar;
