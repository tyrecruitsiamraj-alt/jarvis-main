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

const TABS_LIST_CLASS: Record<TabsVariant, string> = {
  default: "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
  glass: [
    "relative inline-flex h-11 items-center justify-center gap-1 rounded-full p-1 text-muted-foreground",
    "border border-foreground/10 bg-gradient-to-b from-card/70 to-card/40 shadow-lg shadow-foreground/10 ring-1 ring-inset ring-card/60",
    "dark:from-card/60 dark:to-card/30 dark:shadow-background/40 dark:ring-foreground/5",
  ].join(" "),
};

const TABS_TRIGGER_CLASS: Record<TabsVariant, string> = {
  default:
    "rounded-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
  glass: [
    "h-full gap-1.5 rounded-full hover:text-foreground",
    "data-[state=active]:bg-gradient-to-b data-[state=active]:from-background data-[state=active]:to-background/70",
    "data-[state=active]:text-foreground data-[state=active]:shadow-md data-[state=active]:shadow-foreground/10",
    "data-[state=active]:ring-1 data-[state=active]:ring-primary/25 dark:data-[state=active]:ring-primary/40",
  ].join(" "),
};

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
