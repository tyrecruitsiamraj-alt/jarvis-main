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
  // รอบ 4 (เจ้าของ 19 ต.ค. 2569 "เอาแค่ปุ่มแต่พื้นหลังไม่ต้อง"): แถบไม่มีพื้น — เหลือเม็ดกระจกของแท็บที่เลือก (`GlassTabIndicator`)
  return "relative inline-flex h-11 items-center justify-center gap-1 rounded-full p-1 text-muted-foreground";
}

/** เม็ดกระจกแบบ A (เจ้าของเลือก 19 ต.ค. 2569) — กระจกสีเบอร์กันดี · เส้นขอบบนสว่างบาง ๆ · เงาลอย */
// 19 ต.ค. 2569 เจ้าของเลือก "C กรมท่าทึบ" ในโหมดสว่าง (เบอร์กันดีโปร่งดูออกชมพู) · โหมดมืดคงเม็ดกระจกเบอร์กันดีเดิม
const GLASS_PILL = [
  "rounded-full border border-foreground bg-foreground shadow-md shadow-foreground/20",
  "dark:border-white/25 dark:bg-transparent dark:bg-gradient-to-b dark:from-primary/80 dark:to-primary/55 dark:shadow-primary/40",
  "dark:before:pointer-events-none dark:before:absolute dark:before:inset-x-3 dark:before:top-0 dark:before:h-px dark:before:bg-gradient-to-r dark:before:from-transparent dark:before:via-white/70 dark:before:to-transparent",
].join(" ");

/**
 * เม็ดกระจกที่ "วิ่งตาม" แท็บที่เลือก (เจ้าของ 19 ต.ค. 2569: *"เวลากด menu อื่นให้ไอปุ่มที่เป็น glass มันวิ่งตาม"*)
 * วางเป็นลูกตัวแรกของแถบ (แถบต้อง `relative`) · หาแท็บที่เลือกจาก data-state=active / aria-selected / aria-current
 * แล้วเลื่อนไปทับด้วย transition · แถบเลื่อนแนวนอนได้ (offsetLeft อยู่ในกรอบเดียวกัน) · ตัดแอนิเมชันเมื่อเครื่องตั้งลดการเคลื่อนไหว
 */
export function GlassTabIndicator() {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const [box, setBox] = React.useState<{ l: number; t: number; w: number; h: number } | null>(null);
  React.useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const measure = () => {
      const active = parent.querySelector<HTMLElement>(
        '[role="tab"][data-state="active"], [aria-selected="true"], [aria-current="page"]',
      );
      setBox((prev) => {
        if (!active) return null;
        const next = { l: active.offsetLeft, t: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight };
        return prev && prev.l === next.l && prev.t === next.t && prev.w === next.w && prev.h === next.h ? prev : next;
      });
    };
    measure();
    const mo = new MutationObserver(measure);
    mo.observe(parent, { attributes: true, subtree: true, attributeFilter: ["data-state", "aria-selected", "aria-current"] });
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(parent);
    for (const child of Array.from(parent.children)) ro?.observe(child);
    return () => {
      mo.disconnect();
      ro?.disconnect();
    };
  }, []);
  return (
    <span
      ref={ref}
      aria-hidden
      className={cn(
        "pointer-events-none absolute z-0 transition-all duration-300 ease-out motion-reduce:transition-none",
        GLASS_PILL,
        !box && "opacity-0",
      )}
      style={box ? { left: box.l, top: box.t, width: box.w, height: box.h } : undefined}
    />
  );
}

const TABS_LIST_CLASS: Record<TabsVariant, string> = {
  default: "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
  glass: TABS_LIST_CLASS_GLASS(),
};

const TABS_TRIGGER_CLASS: Record<TabsVariant, string> = {
  default:
    "rounded-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
  glass: [
    "relative z-10 h-full gap-1.5 rounded-full transition-colors duration-300 hover:text-foreground",
    "data-[state=active]:text-white data-[state=active]:hover:text-white",
  ].join(" "),
};

/**
 * แถบแท็บที่ทำเป็นปุ่มเอง (ไม่ได้ใช้ Radix Tabs — เช่นแท็บหน้างานสรรหา/ใบขอที่นำทางด้วย URL) ให้หน้าตากระจกชุดเดียวกัน
 * (เจ้าของ 19 ต.ค. 2569: "เปลี่ยนเป็นกระจกทั้งหมดเลย") — ใช้ class ชุดนี้ ห้ามปั้นสีแท็บเองรายหน้า
 */
export const glassTabsListClass = TABS_LIST_CLASS_GLASS();
export function glassTabClass(active: boolean): string {
  return cn(
    "relative z-10 inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-300",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    active ? "text-white" : "text-muted-foreground hover:text-foreground",
  );
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { variant?: TabsVariant }
>(({ className, variant = "default", ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List ref={ref} className={cn(TABS_LIST_CLASS[variant], className)} {...props}>
      {variant === "glass" ? <GlassTabIndicator /> : null}
      {props.children}
    </TabsPrimitive.List>
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
