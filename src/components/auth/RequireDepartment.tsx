import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { APP_DEPARTMENT_CODES, APP_DEPARTMENT_LABELS } from '@/lib/departmentCodes';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/**
 * บังคับเลือกแผนกครั้งแรกสำหรับผู้ใช้ที่ไม่ใช่ admin และยังไม่มี department_code
 * (เช่น บัญชี Azure ที่ admin สร้างไว้ก่อน / ย้ายแผนกแล้วยังว่าง)
 */
const RequireDepartment: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, setMyDepartment } = useAuth();
  const [department, setDepartment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsDepartment =
    Boolean(user) && user!.role !== 'admin' && !user!.department_code?.trim();

  if (!needsDepartment) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!department) {
      setError('กรุณาเลือกแผนก');
      return;
    }
    setBusy(true);
    try {
      const msg = await setMyDepartment(department);
      if (msg) setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="jarvis-warm-bg min-h-[100dvh] flex items-center justify-center p-4">
      <div className="jarvis-frost w-full max-w-md p-6 sm:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <BrandMark size="lg" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              <BrandTitle />
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">เลือกแผนกก่อนใช้งาน</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          คุณจะเห็นใบขอหน่วยงานเฉพาะแผนกที่เลือกเท่านั้น — หากเลือกผิด ติดต่อ Admin ให้แก้ไข
        </p>

        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="firstDepartment" className="text-xs font-medium text-muted-foreground ml-1">
              แผนก <span className="text-destructive">*</span>
            </Label>
            <select
              id="firstDepartment"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              disabled={busy}
              className={cn('jarvis-soft-field min-h-[48px] w-full')}
            >
              <option value="">— เลือกแผนก —</option>
              {APP_DEPARTMENT_CODES.map((code) => (
                <option key={code} value={code}>
                  {APP_DEPARTMENT_LABELS[code]}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <p className="text-xs text-destructive text-center" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy || !department}
            className="jarvis-pill-btn w-full min-h-[52px] px-6 py-3 text-sm touch-manipulation"
          >
            {busy ? 'กำลังบันทึก…' : 'ยืนยันแผนก'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void logout()}
          className="w-full text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
};

export default RequireDepartment;
