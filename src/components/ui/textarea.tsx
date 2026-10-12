import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        // หน้าตาเดียวกับ `Input` (12 ต.ค. 2569 · QA รอบ 2 ข้อ 44) — หน้าไหนเคยปั้น textarea เองด้วยคลาสช่องกรอก ใช้ตัวนี้แทน
        "jarvis-soft-field flex min-h-20 w-full placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
