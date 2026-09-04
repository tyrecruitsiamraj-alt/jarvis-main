import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // สีมาจากตัวแปรธีม (--jarvis-ink* ประกาศใน src/index.css ทั้ง :root และ .dark)
        // จึงสลับตามธีมเองโดยไม่ต้องมี dark: ที่นี่ · เส้นในโทน teal เฉพาะธีมมืดให้เข้าภาษา HUD
        default:
          "bg-[var(--jarvis-ink)] text-white shadow-[var(--jarvis-ink-shadow)] hover:bg-[var(--jarvis-ink-hover)] hover:-translate-y-0.5 dark:ring-1 dark:ring-inset dark:ring-teal-300/20 dark:hover:ring-teal-300/40",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full",
        outline:
          "border border-white/80 bg-white/50 hover:bg-white/75 text-foreground dark:border-white/15 dark:bg-white/5 dark:hover:bg-white/10",
        secondary:
          "bg-white/60 border border-white/80 text-secondary-foreground hover:bg-white/80 dark:border-white/15 dark:bg-white/[0.08] dark:hover:bg-white/15",
        ghost: "hover:bg-white/50 hover:text-foreground rounded-full dark:hover:bg-white/10",
        link: "text-blue-600 underline-offset-4 hover:underline rounded-none dark:text-blue-300",
        /**
         * 🔴 ปุ่มบน **แถบ hero พื้นเข้ม** (4 ก.ย. 2569) — ย้ายมาจากคลาส `heroButton` /
         * `heroButtonSolid` ที่เคยประกาศเองใน `PageHeroStrip.tsx` ซึ่งผิดกติกา
         * "ห้ามปั้นปุ่มเอง" · พื้นเข้มตลอดทั้งสองธีมจึงไม่มีคู่ `dark:`
         */
        hero: "border border-white/20 bg-white/10 text-white hover:bg-white/20",
        heroSolid: "bg-hero text-white hover:bg-hero-hover",
      },
      /**
       * 🔴 **ขนาดไอคอนผูกกับขนาดปุ่ม** (แก้ 4 ก.ย. 2569 — เจ้าของทักเรื่องปุ่มไอคอน)
       *
       * ของเดิม base บังคับ `[&_svg]:size-4` ตัวเดียวทุกขนาด และ selector ลูก
       * (`.[&_svg]:size-4 svg`) **ชนะคลาสบนตัวไอคอนเอง** ⇒ ที่โค้ดเขียน `h-3 w-3`
       * ไม่มีผลเลย · วัดจริงบนหน้าติดตาม: ปุ่มข้อความ 11px เท่ากันแต่ไอคอนออกมา
       * **3 ขนาดในแถวเดียวกัน** (14px ที่ยังเป็น button ดิบ · 16px · 18px ที่แปลงแล้ว)
       * ⇒ ให้แต่ละ size มีขนาดไอคอนของตัวเอง แก้ที่นี่ที่เดียว ทั้งระบบเปลี่ยนพร้อมกัน
       */
      size: {
        default: "h-10 px-5 py-2 [&_svg]:size-4",
        sm: "h-9 px-4 text-xs [&_svg]:size-3.5",
        lg: "h-12 px-8 text-base [&_svg]:size-5",
        icon: "h-10 w-10 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
