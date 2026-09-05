import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { useCloseOnBack } from "@/hooks/useCloseOnBack";
import { buttonVariants } from "@/components/ui/button";

/**
 * 🔴 **กดปุ่มย้อนกลับตอนป๊อปอัปเปิดอยู่ = ปิดป๊อปอัป ไม่ใช่หลุดออกจากหน้า** (5 ก.ย. 2569)
 *
 * เจ้าของสั่งเอง: *"เวลาทำอะไรไป แล้วจะย้อนกลับไปหน้าเดิมมันกลับไหม
 * ไม่ใช่ย้อนแล้วไปไหนไม่รู้ งงแน่"* — บนมือถือคนปัดขอบจอแทนปุ่มปิดตลอด
 *
 * ผูกไว้ **ที่เดียวตรงนี้** แทนการไล่ใส่ทีละจอ (จอจริงมี 40 กว่าจุด) ⇒ ป๊อปอัปใหม่ที่ใครเขียน
 * ต่อจากนี้ได้ฟรีทันที ไม่มีทางลืม · ตัวจัดการประวัติอยู่ที่ `@/hooks/useCloseOnBack`
 *
 * ทำงานเฉพาะตอนคุมสถานะจากข้างนอกจริง ๆ (`open` เป็น boolean **และ** ส่ง `onOpenChange` มา)
 * และสั่งปิดผ่าน `onOpenChange(false)` ⇒ **เงื่อนไขห้ามปิดของแต่ละจอยังทำงานเหมือนเดิม**
 * (เช่นตัวที่เขียนว่า `if (!open && !busy)` จะยังไม่ปิดตอนกำลังบันทึก)
 *
 * ⚠️ **`backClose={false}` = ปิดความสามารถนี้** ใช้กับป๊อปอัปที่ผูกสถานะเปิด-ปิดไว้กับ URL
 * อยู่แล้ว (`?jobId=`) เพราะสองระบบจะแย่งกันจัดการประวัติ — จุดพวกนั้นใช้
 * `useUrlDialogHistory` จัดการประวัติของตัวเอง
 */
function AlertDialog({
  backClose = true,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root> & { backClose?: boolean }) {
  const { open, onOpenChange } = props;
  const controlled = typeof open === "boolean" && typeof onOpenChange === "function";
  useCloseOnBack(backClose && controlled && open === true, () => onOpenChange?.(false));
  return <AlertDialogPrimitive.Root {...props} />;
}

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className,
      )}
      {...props}
    />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
