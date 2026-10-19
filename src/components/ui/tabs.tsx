import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";
import { scrollIntoViewX } from "@/lib/scrollIntoViewX";

const Tabs = TabsPrimitive.Root;

/**
 * 🔴 `variant="glass"` = แถบเมนูกระจก (เจ้าของขอ 19 ต.ค. 2569: *"พวก menu bar ฉันอยากได้แบบ Glass Menu"*)
 * ภาษาเดียวกับ `<Card variant="glass">` — พื้นโปร่งไล่เฉด · เส้นผมจาง · ขอบในสว่าง · แท็บที่เลือกเป็นเม็ดกระจกนูนมีเส้นเบอร์กันดีจาง
 * สีทุกตัวมาจากตัวแปรธีม (สลับสว่าง/มืดเอง) · ⚠️ ไม่ใส่ backdrop-blur (เหตุผลเดียวกับการ์ดกระจก — เบลอของที่เลื่อนจอทำเว็บกระตุก)
 * ค่าตั้งต้น (`default`) หน้าตาเดิมทุกแถบ
 */
type TabsVariant = "default" | "glass";
const TabsVariantContext = React.createContext<TabsVariant>("default");

function TABS_LIST_CLASS_GLASS(): string {
  // รอบ 2 (เจ้าของ 19 ต.ค. 2569 "มันดูไม่ออกเลย" · "โหมดมืดก็ดูไม่ออก"): กระจกต้องเห็นชัด —
  // แสงสะท้อนครึ่งบน (before) · ขอบใสสว่าง · เงาลอย · พื้นขาวโปร่งไล่เฉด (มืด = ขาวจางบนพื้นเข้ม)
  return [
    "relative isolate inline-flex h-11 items-center justify-center gap-1 overflow-hidden rounded-full p-1 text-muted-foreground",
    "border border-white/80 bg-gradient-to-b from-white/90 via-white/60 to-white/40 shadow-xl shadow-foreground/15 ring-1 ring-foreground/5",
    "before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:-z-10 before:h-1/2 before:rounded-full before:bg-gradient-to-b before:from-white before:to-transparent",
    "dark:border-white/20 dark:from-white/20 dark:via-white/10 dark:to-white/5 dark:shadow-black/50 dark:ring-white/10 dark:before:from-white/25",
  ].join(" ");
}

const TABS_LIST_CLASS: Record<TabsVariant, string> = {
  default: "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
  glass: TABS_LIST_CLASS_GLASS(),
};

const TABS_TRIGGER_CLASS: Record<TabsVariant, string> = {
  default:
    "rounded-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
  glass: [
    "relative isolate h-full gap-1.5 overflow-hidden rounded-full border border-transparent hover:text-foreground",
    "data-[state=active]:border-primary/30 data-[state=active]:bg-gradient-to-b data-[state=active]:from-primary/25 data-[state=active]:to-primary/10",
    "data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:shadow-primary/25",
    "data-[state=active]:before:pointer-events-none data-[state=active]:before:absolute data-[state=active]:before:inset-x-2 data-[state=active]:before:top-0 data-[state=active]:before:-z-10 data-[state=active]:before:h-1/2 data-[state=active]:before:rounded-full data-[state=active]:before:bg-gradient-to-b data-[state=active]:before:from-white/70 data-[state=active]:before:to-transparent",
    "dark:data-[state=active]:border-primary/60 dark:data-[state=active]:from-primary/70 dark:data-[state=active]:to-primary/35 dark:data-[state=active]:text-primary-foreground dark:data-[state=active]:shadow-primary/40 dark:data-[state=active]:before:from-white/25",
  ].join(" "),
};

/**
 * แถบแท็บที่ทำเป็นปุ่มเอง (ไม่ได้ใช้ Radix Tabs — เช่นแท็บหน้างานสรรหา/ใบขอที่นำทางด้วย URL) ให้หน้าตากระจกชุดเดียวกัน
 * (เจ้าของ 19 ต.ค. 2569: "เปลี่ยนเป็นกระจกทั้งหมดเลย") — ใช้ class ชุดนี้ ห้ามปั้นสีแท็บเองรายหน้า
 */
export const glassTabsListClass = TABS_LIST_CLASS_GLASS();
export function glassTabClass(active: boolean): string {
  return cn(
    "relative isolate inline-flex shrink-0 items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? [
          "border-primary/30 bg-gradient-to-b from-primary/25 to-primary/10 text-primary shadow-md shadow-primary/25",
          "before:pointer-events-none before:absolute before:inset-x-2 before:top-0 before:-z-10 before:h-1/2 before:rounded-full before:bg-gradient-to-b before:from-white/70 before:to-transparent",
          "dark:border-primary/60 dark:from-primary/70 dark:to-primary/35 dark:text-primary-foreground dark:shadow-primary/40 dark:before:from-white/25",
        ].join(" ")
      : "border-transparent text-muted-foreground hover:text-foreground",
  );
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: TabsVariant }
>(({ className, variant = "default", ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List ref={ref} className={cn(TABS_LIST_CLASS[variant], className)} {...props} />
  </TabsVariantContext.Provider>
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  // แท็บที่เปิดอยู่ต้องอยู่ในจอเมื่อแถบล้นแนวนอน (มือถือ · QA รอบ 2 ข้อ 32) — เลื่อนเฉพาะแถบ ไม่เลื่อนหน้า
  const variant = React.useContext(TabsVariantContext);
  const innerRef = React.useRef<HTMLButtonElement | null>(null);
  React.useEffect(() => {
    const el = innerRef.current;
    if (el?.dataset.state === "active") scrollIntoViewX(el.parentElement, el);
  });
  const setRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  return (
  <TabsPrimitive.Trigger
    ref={setRef}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      TABS_TRIGGER_CLASS[variant],
      className,
    )}
    {...props}
  />
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
