import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { useUiV2 } from "@/lib/uiV2";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /**
         * 🔴 **สีมาจากตัวแปรธีมล้วน ๆ** (5 ก.ย. 2569 — เจ้าของสั่งให้ทั้งระบบใช้จานสี
         * เดียวกับหน้า Login) · ของเดิม `default` เป็นหมึกดำ `--jarvis-ink` และ `link`
         * เป็นฟ้า `text-blue-600` ⇒ ปุ่มหลักทั้งแอปเป็นสีดำ คนละเรื่องกับปุ่มเบอร์กันดี
         * ที่เจ้าของเคาะบนหน้า Login · ตอนนี้ทุก variant อ่านจาก `--primary`/`--accent`/
         * `--border` ⇒ เปลี่ยนจานสีที่ `src/index.css` ที่เดียว ปุ่มทั้งระบบเปลี่ยนตาม
         * ⚠️ `outline`/`secondary`/`ghost` เดิมใช้ `bg-white/xx` ตายตัว ⇒ บนธีมมืด
         * ต้องเขียนคู่ `dark:` ทุกครั้ง (ลืมบ่อย) · token ของธีมสลับให้เองอยู่แล้ว
         */
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-0.5",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full",
        outline:
          "border border-border bg-background/70 text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground rounded-full",
        link: "text-primary underline-offset-4 hover:underline rounded-none",
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
    /**
     * 🔴 **โฉมใหม่ไม่มี "แถบ hero พื้นเข้ม" แล้ว** (5 ก.ย. 2569 · สวิตช์ `?ui=v2`)
     * ปุ่ม `hero`/`heroSolid` ถูกออกแบบมาให้อ่านออกบนพื้นเข้มเท่านั้น พอแถบหัวกลายเป็น
     * พื้นขาว ปุ่มขาวโปร่งจะหายไปกับพื้น ⇒ แปลงเป็นปุ่มมาตรฐานของธีมให้อัตโนมัติ
     * (แปลงที่นี่ที่เดียว ทุกหน้าที่ใช้ปุ่มบนแถบหัวได้ตามหมด · ปิดสวิตช์ = กลับของเดิม)
     */
    const v2 = useUiV2();
    const resolved = v2 && variant === "hero" ? "outline" : v2 && variant === "heroSolid" ? "default" : variant;
    return <Comp className={cn(buttonVariants({ variant: resolved, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
