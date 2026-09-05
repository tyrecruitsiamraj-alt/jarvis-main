/**
 * ═══ ป๊อปอัปที่ผูกสถานะเปิด-ปิดไว้กับ URL (`?jobId=`) กับปุ่มย้อนกลับ ═══
 *
 * Wave 3.3 ของ `docs/plan-quality-100-2569-09-05.md` (5 ก.ย. 2569)
 *
 * 🔴 **ของจริงที่วัดได้ก่อนแก้** (หน้า `/matching/match` และ `/matching/pre-check`):
 * กดการ์ดใบขอ → แผงรายละเอียดเปิด **โดยไม่แตะ URL เลย** ⇒ กดย้อนกลับ = **หลุดออกจากหน้า
 * ทั้งหน้า** ทั้งที่คนใช้แค่อยากปิดแผงกลับไปดูลิสต์เดิม (บนมือถือคนปัดย้อนกลับแทนปุ่มปิดตลอด)
 * ส่วนตอนปิดด้วยปุ่มก็ใช้ `replace` ลบ `jobId` ทิ้ง ประวัติจึงไม่ตรงกับสิ่งที่คนเห็นบนจอ
 *
 * ⚠️ ป๊อปอัปพวกนี้ **ห้ามใช้ `useCloseOnBack`** (ตัวห่อกลางที่ `components/ui/*`)
 * เพราะจะมีสองระบบแย่งกันจัดการประวัติ — จุดที่ใช้ตัวนี้ต้องใส่ `backClose={false}` ด้วย
 *
 * ## ครบวงที่ทำให้ประวัติตรงกับสิ่งที่คนเห็น
 *
 * | คนทำอะไร | เราทำอะไร |
 * | --- | --- |
 * | กดการ์ดเปิดรายละเอียด | **push** `?jobId=…` ⇒ กดย้อนกลับ = ปิดรายละเอียด กลับลิสต์เดิม |
 * | กดย้อนกลับตอนเปิดอยู่ | `jobId` หลุดจาก URL ⇒ เราสั่ง `onClose()` ให้แผงปิดตาม |
 * | ปิดด้วยปุ่ม X **หลังจากที่เรา push มาเอง** | `history.back()` — ไม่ push ทับ ประวัติจึงไม่บวม |
 * | เข้าหน้าด้วยลิงก์ตรงที่มี `jobId` แล้วกดปิด | `replace` ลบ `jobId` แบบเดิม (ไม่มีอะไรให้ back) |
 *
 * 🔴 **ห้ามทำพฤติกรรมสองหน้าไม่เหมือนกัน** — ทั้ง `MatchingPage` และ `PreCheckPage`
 * ใช้ไฟล์นี้ตัวเดียวกัน อยากเปลี่ยนพฤติกรรมให้แก้ที่นี่ที่เดียว
 */
import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export type UrlDialogHistory = {
  /** เปิดรายละเอียด: ใส่ค่าลง URL แบบ **push** (ย้อนกลับ = ปิด) */
  openWithUrl: (value: string) => void;
  /** ปิดด้วยปุ่ม: ถอยประวัติถ้าเราเป็นคน push มา · ไม่งั้นลบค่าทิ้งแบบ `replace` */
  closeAndSyncUrl: () => void;
};

export function useUrlDialogHistory(opts: {
  /** ชื่อพารามิเตอร์บน URL เช่น `'jobId'` */
  param: string;
  /** ตอนนี้แผงรายละเอียดเปิดอยู่ไหม */
  isOpen: boolean;
  /** สั่งปิดแผง — ถูกเรียกเมื่อค่าหลุดจาก URL (คนกดย้อนกลับ) */
  onClose: () => void;
}): UrlDialogHistory {
  const { param, isOpen } = opts;
  const [searchParams, setSearchParams] = useSearchParams();

  /** เก็บ `onClose` ล่าสุดไว้ใน ref — ไม่ให้ effect ผูกใหม่ทุก re-render */
  const closeRef = useRef(opts.onClose);
  closeRef.current = opts.onClose;

  /**
   * เราเป็นคนใส่ค่านี้ลง URL เองหรือเปล่า
   * (ตรงข้ามกับ "เข้ามาด้วยลิงก์ตรง/รีเฟรชหน้า" ซึ่งไม่มีชั้นประวัติให้ถอย)
   */
  const pushedRef = useRef(false);

  const current = searchParams.get(param);

  /** ค่าของรอบก่อน — ใช้แยก "เคยมีแล้วหายไป" (คนกดย้อนกลับ) ออกจาก "ยังไม่เคยมี" */
  const prevValueRef = useRef<string | null>(current);

  /** ค่าที่เราเพิ่งสั่งเปิด แต่ URL ยังตามมาไม่ถึง */
  const pendingOpenRef = useRef<string | null>(null);

  /**
   * 🔴 คนกดย้อนกลับตอนแผงเปิดอยู่ ⇒ ค่าหลุดจาก URL ⇒ ปิดแผงตาม (ไม่ใช่ปล่อยค้างเปิด)
   *
   * ⚠️ **ต้องเช็คว่า "เคยมีค่าแล้วหายไป" เท่านั้น** ห้ามปิดเพียงเพราะตอนนี้ไม่มีค่า —
   * เจอบั๊กจริงตอนทดสอบบนจอ 5 ก.ย. 2569: กดการ์ดเปิดใบขอ → แผงเปิดแล้วปิดเองใน 25ms
   * เพราะจังหวะที่ `setJobDetail` (อัปเดตด่วน) กับการเปลี่ยน URL ของ react-router
   * (อัปเดตแบบ transition) ลงคนละรอบวาด ⇒ มีรอบหนึ่งที่ "แผงเปิดแล้วแต่ URL ยังไม่มีค่า"
   * ถ้าตีความรอบนั้นว่าคนกดย้อนกลับ แผงจะปิดตัวเองทันทีที่เปิด
   */
  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = current;

    if (current) {
      pendingOpenRef.current = null;
      return;
    }
    // ไม่มีค่าใน URL แล้ว = ไม่มีชั้นประวัติของเราให้ถอยอีก
    pushedRef.current = false;
    if (isOpen && prev && !pendingOpenRef.current) closeRef.current();
  }, [isOpen, current]);

  const openWithUrl = useCallback(
    (value: string) => {
      if (searchParams.get(param) === value) return;
      const next = new URLSearchParams(searchParams);
      next.set(param, value);
      pushedRef.current = true;
      pendingOpenRef.current = value;
      // 🔴 push (ไม่ใช่ replace) — นี่คือสิ่งที่ทำให้ปุ่มย้อนกลับ = ปิดรายละเอียด
      setSearchParams(next);
    },
    [param, searchParams, setSearchParams],
  );

  const closeAndSyncUrl = useCallback(() => {
    if (!searchParams.get(param)) return;
    if (pushedRef.current) {
      pushedRef.current = false;
      // ถอยชั้นที่เรา push ไว้เอง — ค่าหลุดจาก URL ให้เอง และประวัติไม่บวม
      window.history.back();
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete(param);
    setSearchParams(next, { replace: true });
  }, [param, searchParams, setSearchParams]);

  return { openWithUrl, closeAndSyncUrl };
}

export default useUrlDialogHistory;
