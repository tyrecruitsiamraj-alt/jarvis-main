import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { APP_DEPARTMENT_CODES } from '@/lib/departmentCodes';

/**
 * แถบเตือนตอน admin ดูหน้าจอในมุมมองของ role อื่น (เจ้าของสั่ง 2 ก.ย. 2569)
 *
 * 🔴 **ต้องเรนเดอร์นอกทุก guard และนอก AppLayout** — สวมมุมมองแล้วอาจโดนเด้งไปหน้าที่
 * ไม่มีเมนู (เช่นหน้าเลือกแผนก หรือหน้าที่ role นั้นเข้าไม่ได้) ถ้าปุ่มออกอยู่ในเลย์เอาต์
 * จะกลายเป็นทางตัน ต้องไปล้าง sessionStorage เอง
 *
 * 🔴 **เขียนตรง ๆ ว่าเป็นการจำลองหน้าจอ** — โทเคนที่ส่งไปกับทุก request ยังเป็นของ admin
 * ตัวจริง กดปุ่มที่ role นั้นไม่ควรกด เซิร์ฟเวอร์ก็ยังยอมให้ผ่าน
 */
const ViewAsRoleBanner: React.FC = () => {
  const { realRole, viewAsRole, setViewAsRole, viewAsDepartment, setViewAsDepartment } = useAuth();
  if (!viewAsRole) return null;

  return (
    <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-300 bg-amber-100 px-3 py-1.5 text-[12px] font-medium text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <span>
        กำลังดูหน้าจอในมุมมองของ <b className="uppercase">{viewAsRole}</b> — เห็นเมนู/ปุ่มเท่าที่ role นี้เห็น
      </span>
      <span className="opacity-80">
        ⚠️ จำลองหน้าจอเท่านั้น · ถ้ากดปุ่ม เซิร์ฟเวอร์ยังทำงานด้วยสิทธิ์ {realRole} ของคุณจริง ๆ
      </span>
      {/* เลือกแผนกจากแถบนี้เลย (เจ้าของสั่ง 2 ก.ย. 2569: *"จะเห็นแผนกไหนก็ค่อยไปเลือก
          ตอน Admin เลือกมุมมองเอา"*) — วางในหน้าตั้งค่าไม่ได้ เพราะสวมเป็น role อื่นแล้ว
          หน้าตั้งค่าถูกกันไม่ให้เข้า เลือกทีหลังจะไม่มีที่ให้เลือก */}
      <label className="inline-flex items-center gap-1">
        แผนก
        <select
          value={viewAsDepartment ?? ''}
          onChange={(e) => setViewAsDepartment(e.target.value || null)}
          className="rounded-full border border-amber-500 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900 dark:text-amber-100"
        >
          <option value="">ทุกแผนก</option>
          {APP_DEPARTMENT_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={() => setViewAsRole(null)}
        className="rounded-full border border-amber-500 px-2.5 py-0.5 text-[11px] font-semibold hover:bg-amber-200 dark:hover:bg-amber-900"
      >
        ออกจากมุมมองนี้
      </button>
    </div>
  );
};

export default ViewAsRoleBanner;
