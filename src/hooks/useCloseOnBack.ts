/**
 * ═══ กดปุ่มย้อนกลับตอนป๊อปอัปเปิดอยู่ = **ปิดป๊อปอัป** ไม่ใช่เด้งออกจากหน้า ═══
 *
 * เจ้าของสั่งทดสอบเรื่องนี้เอง 5 ก.ย. 2569:
 * *"ทดสอบด้วย เวลาทำอะไรไป แล้วจะย้อนกลับไปหน้าเดิมมันกลับไหม
 *   ไม่ใช่ย้อนแล้วไปไหนไม่รู้ งงแน่"*
 *
 * 🔴 **ของจริงที่วัดได้ก่อนแก้:** เปิดหน้าสาธารณะ `/apply` → กดปุ่ม "สมัครงาน" → ฟอร์มเด้งขึ้น
 * → กดย้อนกลับ (บนมือถือคือปัดขอบจอ ซึ่งคนใช้แทนปุ่มปิดตลอด) → **หลุดไปหน้าอื่นทั้งหน้า
 * และของที่กรอกค้างไว้หายหมด** เพราะป๊อปอัปไม่ได้ฝากประวัติไว้ในเบราว์เซอร์
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ## วิธีทำงาน (รื้อใหม่ 5 ก.ย. 2569 · Wave 3.2 — ตอนนี้ใช้ทั้งระบบแล้ว)
 *
 * ของเดิมแต่ละป๊อปอัปฝากประวัติของตัวเอง ใช้ได้ตอนมีป๊อปอัปเดียว แต่**พังเมื่อเอาไปใช้ทั้งระบบ**
 * เพราะจอจริงมีทั้งป๊อปอัปซ้อนป๊อปอัป และป๊อปอัปที่ปิดตัวเองแล้วเปิดตัวถัดไปในจังหวะเดียวกัน
 * (ปิดตัวแรกสั่งถอยประวัติ ตัวที่สองปักป้ายใหม่ แล้วคำสั่งถอยที่ค้างอยู่ไปกินป้ายของตัวที่สอง
 * ⇒ ป๊อปอัปที่เพิ่งเปิดปิดตัวเองทันที)
 *
 * ของใหม่: **ป้ายเดียวทั้งระบบ** เก็บกองป๊อปอัปที่เปิดอยู่ไว้ในโมดูลนี้
 *
 * * เปิดตัวแรก ⇒ ปักป้ายหนึ่งชั้น (`pushState`) · เปิดตัวที่สอง สาม ⇒ **ไม่ปักเพิ่ม**
 * * กดย้อนกลับ ⇒ ปิด **ตัวบนสุด** ตัวเดียว แล้วปักป้ายคืนถ้ายังมีตัวล่างเปิดอยู่
 *   ⇒ กดย้อนกลับซ้ำ ๆ ก็ไล่ปิดทีละชั้น และ**ประวัติไม่บวม** (มีป้ายอยู่ชั้นเดียวเสมอ)
 * * ปิดเองด้วยปุ่ม/Escape ⇒ เก็บป้ายคืน (`history.back()`)
 * * ปิดตัวหนึ่งแล้วเปิดอีกตัวในจังหวะเดียวกัน ⇒ **หักกลบกันหมด ไม่แตะประวัติเลย**
 *   (เพราะเลื่อนไปเช็คสถานะทีเดียวหลัง React วาดเสร็จ ไม่ใช่สั่งทันทีตอนถอด)
 *
 * ⚠️ **ป๊อปอัปที่ผูกสถานะเปิด-ปิดไว้กับ URL อยู่แล้ว (เช่น `?jobId=`) ห้ามใช้ตัวนี้**
 * สองระบบจะแย่งกันจัดการประวัติ · จุดพวกนั้นใส่ `backClose={false}` ไว้ที่ `<Dialog>`/`<Sheet>`
 * และจัดการประวัติของตัวเองด้วย `useUrlDialogHistory`
 *
 * 🔴 **ตอนปักป้าย เราคัดลอก state เดิมของ react-router มาด้วย** (`usr`/`key`/`idx`)
 * ถ้าปักเป็น state เปล่า ตัวนับ `idx` ของ router จะหลุดเป็น NaN หลังคนกดเมนูจากในป๊อปอัป
 * แล้วเปลี่ยนหน้า (เจอตอนไล่เคส `AppNavDrawer` ที่ `navigate()` ก่อน `onClose()`)
 */
import { useEffect, useRef } from 'react';

/** ป้ายที่ปักไว้ใน history เพื่อรู้ว่า state ชั้นนี้เป็นของป๊อปอัป ไม่ใช่ของหน้าจริง */
const MARK = '__dialogBack__';

type Layer = { close: () => void };

/** ป๊อปอัปที่เปิดอยู่ตอนนี้ เรียงล่างขึ้นบน — ตัวท้ายสุดคือตัวที่ปุ่มย้อนกลับจะปิด */
const stack: Layer[] = [];

/** ตอนนี้เราปักป้ายไว้ในประวัติอยู่หรือเปล่า */
let marked = false;
let syncQueued = false;
let listening = false;

function currentEntryIsOurs(): boolean {
  if (typeof window === 'undefined') return false;
  const state = window.history.state as Record<string, unknown> | null;
  return Boolean(state?.[MARK]);
}

/**
 * ปรับประวัติให้ตรงกับกองป๊อปอัปที่เปิดอยู่ — เรียกซ้ำได้ ไม่ทำอะไรถ้าตรงอยู่แล้ว
 *
 * 🔴 ทำงาน**หลัง** React วาดเสร็จเสมอ (ผ่าน `scheduleSync`) จังหวะ "ปิดตัวหนึ่ง
 * เปิดอีกตัว" จึงหักกลบกันเองโดยไม่มีการถอยประวัติที่ค้างไปกินป้ายของตัวใหม่
 */
function syncMarker(): void {
  syncQueued = false;
  if (typeof window === 'undefined') return;

  const want = stack.length > 0;
  if (want === marked) return;

  if (want) {
    // คัดลอก state เดิมมาด้วย — ห้ามปักเป็น state เปล่า (ดูหมายเหตุหัวไฟล์)
    const current = (window.history.state as Record<string, unknown> | null) ?? {};
    window.history.pushState({ ...current, [MARK]: true }, '');
    marked = true;
    return;
  }

  marked = false;
  /**
   * 🔴 เก็บป้ายคืนเฉพาะตอนที่ **ชั้นบนสุดยังเป็นป้ายของเราจริง ๆ**
   * ถ้าระหว่างที่ป๊อปอัปเปิดอยู่มีการเปลี่ยนหน้า (เมนู ☰ กดเมนูแล้ว `navigate()`
   * ก่อนสั่งปิดเมนู) ชั้นบนสุดเป็นหน้าใหม่แล้ว — ถอยตรงนี้ = ยกเลิกการเปลี่ยนหน้าของคนใช้
   */
  if (currentEntryIsOurs()) window.history.back();
}

function scheduleSync(): void {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(syncMarker);
}

function onPop(): void {
  // ถอยมาถึงตรงนี้ = เบราว์เซอร์กินป้ายของเราไปแล้ว
  marked = false;
  const top = stack[stack.length - 1];
  // ไม่มีป๊อปอัปเปิดอยู่ = คนถอยจากหน้าอื่นมาเจอป้ายที่เราทิ้งไว้ ปล่อยให้ router ทำงานปกติ
  if (!top) return;
  top.close();
  /**
   * ป๊อปอัปบางตัวมีเงื่อนไขไม่ยอมปิด (เช่นกำลังบันทึกอยู่) — ถ้ามันไม่ปิดจริง
   * ต้องปักป้ายคืน ไม่งั้นกดย้อนกลับครั้งต่อไปจะหลุดออกจากหน้า
   * เช็คหลัง React วาดเสร็จ · `syncMarker` ไม่ทำอะไรถ้ามันปิดไปแล้วจริง
   */
  setTimeout(syncMarker, 0);
}

function ensureListening(): void {
  if (listening || typeof window === 'undefined') return;
  window.addEventListener('popstate', onPop);
  listening = true;
}

/**
 * @param open ป๊อปอัปนี้เปิดอยู่ไหม — `false` = ไม่ทำอะไรเลย
 * @param onClose สั่งปิดป๊อปอัป · ถ้าตัวป๊อปอัปมีเงื่อนไขห้ามปิด ให้ส่งตัวที่เคารพเงื่อนไขนั้น
 *   (ตัวห่อกลางที่ `components/ui/*` ส่ง `onOpenChange(false)` เข้ามา เงื่อนไขเดิมจึงยังทำงาน)
 */
export function useCloseOnBack(open: boolean, onClose: () => void): void {
  /** เก็บ `onClose` ล่าสุดไว้ใน ref — ไม่งั้น effect จะผูก/ถอด listener ทุกครั้งที่ re-render */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    ensureListening();

    const layer: Layer = { close: () => closeRef.current() };
    stack.push(layer);
    scheduleSync();

    return () => {
      const i = stack.lastIndexOf(layer);
      if (i >= 0) stack.splice(i, 1);
      scheduleSync();
    };
  }, [open]);
}

/** จำนวนป๊อปอัปที่เปิดอยู่ตอนนี้ — ใช้ในเทสต์และตอนไล่ปัญหา */
export function openDialogLayerCount(): number {
  return stack.length;
}

/**
 * ═══ กำลังจะ **เปลี่ยนหน้า** จากในป๊อปอัป (เช่นกดเมนูในลิ้นชัก ☰) ═══
 *
 * คืน `true` = ชั้นบนสุดของประวัติเป็นป้ายของป๊อปอัปอยู่ ⇒ **ให้ `navigate()` แบบ `replace`**
 * เพื่อ "ทับ" ป้ายนั้นด้วยหน้าใหม่
 *
 * 🔴 ไม่ทำแบบนี้แล้วเป็นยังไง (วัดจริงบนจอมือถือ 5 ก.ย. 2569):
 * เปิดเมนู ☰ (ปักป้าย) → กด "ติดตาม" → `navigate()` push หน้าใหม่ทับป้าย
 * ⇒ ประวัติเป็น `[หน้าเดิม, ป้าย, หน้าใหม่]` · กดย้อนกลับครั้งแรกกลับหน้าเดิมถูกต้อง
 * แต่ **กดครั้งที่สองแล้วไม่ไปไหน** เพราะไปตกที่ป้ายซึ่ง URL เดียวกับหน้าเดิม
 * (ป้ายเก็บคืนไม่ได้แล้ว เพราะถอยตอนนั้น = ยกเลิกการเปลี่ยนหน้าของคนใช้)
 *
 * ใช้คู่กันเสมอ: `navigate(path, { replace: consumeBackMarkerForNavigation() })`
 */
export function consumeBackMarkerForNavigation(): boolean {
  if (!marked || !currentEntryIsOurs()) return false;
  // หน้าใหม่กำลังจะไปทับป้ายนี้ ⇒ ถือว่าป้ายถูกใช้ไปแล้ว ห้ามพยายามเก็บคืนอีก
  marked = false;
  return true;
}

export default useCloseOnBack;
