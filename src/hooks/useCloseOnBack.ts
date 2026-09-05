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
 * วิธีทำงาน: ตอนป๊อปอัปเปิด ฝาก state ปลอมไว้หนึ่งชั้น (`pushState`)
 * ถ้าคนกดย้อนกลับ = เบราว์เซอร์ถอย state ปลอมนั้นออก เราจึงสั่ง `onClose()` แทน
 * ถ้าคนปิดเองด้วยปุ่ม/Escape = เราถอย state ปลอมคืนให้ (`history.back()`) ประวัติจึงไม่บวม
 *
 * ⚠️ ห้ามใช้กับป๊อปอัปที่ผูกสถานะเปิด-ปิดไว้กับ URL อยู่แล้ว (เช่นหน้าที่ใช้ `?jobId=`)
 * เพราะสองระบบจะแย่งกันจัดการประวัติ
 */
import { useEffect, useRef } from 'react';

/** ป้ายที่ปักไว้ใน history เพื่อรู้ว่า state ชั้นนี้เป็นของป๊อปอัป ไม่ใช่ของหน้าจริง */
const MARK = '__dialogBack__';

export function useCloseOnBack(open: boolean, onClose: () => void): void {
  /** เก็บ `onClose` ล่าสุดไว้ใน ref — ไม่งั้น effect จะผูก/ถอด listener ทุกครั้งที่ re-render */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  /** เราเป็นคนปักป้ายเองหรือเปล่า — ใช้ตัดสินว่าตอนปิดต้องถอยประวัติคืนไหม */
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    window.history.pushState({ [MARK]: true }, '');
    pushedRef.current = true;

    const onPop = () => {
      // ถอยมาถึงตรงนี้ = คนกดย้อนกลับตอนป๊อปอัปเปิดอยู่ ⇒ ปิดป๊อปอัปแทนการเปลี่ยนหน้า
      pushedRef.current = false;
      closeRef.current();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      // ปิดด้วยวิธีอื่น (ปุ่มปิด/Escape/กดสำเร็จ) ⇒ เก็บ state ปลอมของเราคืน
      if (pushedRef.current && window.history.state?.[MARK]) {
        pushedRef.current = false;
        window.history.back();
      }
    };
  }, [open]);
}

export default useCloseOnBack;
