import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * 🔴 `variant="glass"` = การ์ดกระจกโฉมหรู (เจ้าของขอ 30 ก.ย. 2569: *"Style ขอแบบ Glass ให้มันดูมีความ luxury"*)
 * ยกภาษาจากการ์ดของหน้า Login ที่เจ้าของเคาะว่าสวย (`GLASS_CARD` ใน LoginPage) มาเป็น utility ของ Tailwind ล้วน
 * - พื้นขาวโปร่งไล่เฉดบนลงล่าง · เส้นผมกรมท่าจาง · เงานุ่มอมกรมท่า · ขอบในสว่าง · เส้นผมเบอร์กันดีกลางขอบบน
 * - สีทุกตัวอ่านจากตัวแปรธีม (`card` `foreground` `primary` `background`) ⇒ สลับสว่าง/มืดเอง ไม่มี hex
 * ⚠️ **ไม่ใส่ `backdrop-blur` โดยตั้งใจ** — เคยทำเว็บกระตุกทั้งแอป (5 ก.ย. 2569 · ดู `.glass-card` ใน index.css)
 *    ของที่อยู่หลังการ์ดคือแสงนวลที่เบลอมาแล้ว ⇒ โปร่งอย่างเดียวก็ได้กระจกหน้าตาเดียวกัน โดยไม่ต้องจ่ายค่าเบลอตอนเลื่อนจอ
 * ค่าตั้งต้น (`default`) ยังเป็น `.glass-card` ตัวเดิม ⇒ การ์ดทั้งแอปหน้าตาเหมือนเดิมทุกใบ
 */
const cardVariants = cva("text-card-foreground", {
  variants: {
    variant: {
      default: "glass-card",
      glass: [
        "relative rounded-2xl border border-foreground/10 bg-gradient-to-b from-card/75 to-card/55",
        "shadow-2xl shadow-foreground/10 ring-1 ring-inset ring-card/70",
        "before:pointer-events-none before:absolute before:inset-x-12 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-primary/50 before:to-transparent",
        "dark:from-card/70 dark:to-card/45 dark:shadow-background/50 dark:ring-foreground/5",
      ].join(" "),
    },
  },
  defaultVariants: { variant: "default" },
});

export interface CardProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-medium leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
