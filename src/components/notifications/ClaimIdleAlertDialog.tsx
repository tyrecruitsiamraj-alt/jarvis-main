import React from 'react';
import { useNavigate } from 'react-router-dom';
import { consumeBackMarkerForNavigation } from '@/hooks/useCloseOnBack';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { pickClaimIdleAlert, shouldSeeClaimIdleAlert } from '@/lib/claimIdleAlert';
import { TONE } from '@/lib/designTokens';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * ป๊อปเตือนหัวหน้า "มีคนเก็บชื่อไว้แล้วไม่โทร ระบบถอดให้แล้ว" (Phase 5.8)
 *
 * เจ้าของสั่งว่าต้อง **เด้งทันที** ไม่ใช่รอให้ไปเปิดหน้าดูเอง (บทเรียนเดียวกับยามเฝ้าระบบ:
 * "หน้าสถานะไม่ใช่คำตอบ — การเตือนที่วิ่งมาหาต่างหาก")
 *
 * ⚠️ ตรรกะว่าจะเด้งใบไหน/ใครเห็น อยู่ที่ `src/lib/claimIdleAlert.ts` (pure + มีเทสต์)
 * ⚠️ ใช้ `AlertDialog` ของ shadcn — mount ที่ AppLayout ระดับนอกสุด ไม่ได้อยู่ใน Dialog อื่น
 * ⚠️ กดปิด/กดไปดู = mark อ่านแล้วทั้งคู่ → ไม่เด้งซ้ำทุกครั้งที่เปลี่ยนหน้า
 */
const ClaimIdleAlertDialog: React.FC = () => {
  const { user } = useAuth();
  const { notifications, markAsRead } = useNotifications();
  const navigate = useNavigate();

  if (!shouldSeeClaimIdleAlert(user?.role)) return null;
  const alert = pickClaimIdleAlert(notifications);
  if (!alert) return null;

  const dismiss = () => markAsRead(alert.id);
  const goSee = () => {
    markAsRead(alert.id);
    // 🔴 `replace` ตอนที่ป๊อปนี้ปักชั้นประวัติไว้ — เหตุผลเดียวกับเมนู ☰
    // (ดู `consumeBackMarkerForNavigation` ใน `@/hooks/useCloseOnBack`)
    navigate(alert.link || '/jobs/board?view=list&bucket=awaiting_call_choice', {
      replace: consumeBackMarkerForNavigation(),
    });
  };

  return (
    <AlertDialog open onOpenChange={(o) => !o && dismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{alert.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {alert.message}
            <br />
            ระบบถอดชื่อออกให้แล้ว — ใบเหล่านี้รออยู่ในกอง <b>"เลือกวิธีโทร"</b> ให้เลือกว่าจะ
            เก็บไปโทรเองหรือส่ง AI โทร · ถ้าไม่เลือกภายใน 1 วัน AI จะรับไปโทรเอง
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={dismiss}>รับทราบ</AlertDialogCancel>
          <AlertDialogAction onClick={goSee} className={TONE.primary.solid}>
            ไปดูกอง "เลือกวิธีโทร"
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ClaimIdleAlertDialog;
