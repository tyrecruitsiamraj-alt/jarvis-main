import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import {
  APP_FUNCTIONS,
  type AppFunctionDef,
  ROLE_LABELS,
  ROLE_ORDER,
  functionGroups,
  roleHasFunction,
  type AppFunctionId,
} from '@/lib/roleFunctions';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';

const RolePermissionsTab: React.FC = () => {
  const { matrix, loading, updateGrant, savingKey } = useRolePermissions();
  const [error, setError] = useState<string | null>(null);
  const groups = functionGroups();

  /**
   * "เปิดเฉพาะ admin" — ปิด opl/staff/supervisor ในคลิกเดียว
   * ใช้ตอนฟีเจอร์ยังไม่พร้อมเปิดใช้ แต่ deploy ขึ้นไปแล้ว (admin ทดสอบบนของจริงคนเดียว)
   * เดิมต้องปิดทีละ role ถ้าเผลอปิดไม่ครบ = คนอื่นยังเห็น
   */
  const adminOnly = async (fn: AppFunctionDef) => {
    for (const role of ROLE_ORDER) {
      if (role === 'admin') continue;
      if (!roleHasFunction(role, fn, matrix)) continue;
      await updateGrant(role, fn.id, false);
    }
  };

  const handleToggle = async (role: UserRole, functionId: AppFunctionId, next: boolean) => {
    setError(null);
    try {
      await updateGrant(role, functionId, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-[1.5rem] p-4 border border-white/70 text-sm text-muted-foreground space-y-1">
        <p>เปิด/ปิดฟังก์ชันให้แต่ละ role — บันทึกทันทีเมื่อสลับ</p>
        <p className="text-xs">ค่าเริ่มต้นตามลำดับ Admin &gt; Supervisor &gt; Staff · เปลี่ยน role ผู้ใช้ได้ที่แท็บ Users</p>
      </div>

      {error ? (
        <div className="text-sm text-destructive rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
          {error}
        </div>
      ) : null}

      {loading ? <div className="text-sm text-muted-foreground px-1">กำลังโหลดสิทธิ์…</div> : null}

      {groups.map((group) => (
        <div key={group} className="glass-card rounded-[1.5rem] border border-white/70 overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50 bg-secondary/20">
            <h3 className="text-sm font-semibold text-foreground">{group}</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">ฟังก์ชัน</th>
                  {ROLE_ORDER.map((role) => (
                    <th
                      key={role}
                      className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground w-28"
                    >
                      {ROLE_LABELS[role]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {APP_FUNCTIONS.filter((f) => f.group === group).map((fn) => (
                  <tr key={fn.id} className="border-b border-border/30 last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-foreground">{fn.label}</span>
                        {ROLE_ORDER.every((r) => r === 'admin' || !roleHasFunction(r, fn, matrix)) ? (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                            ยังไม่เปิดใช้ — เห็นเฉพาะ admin
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void adminOnly(fn)}
                            disabled={loading || !!savingKey}
                            className="rounded-full border border-border px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground hover:bg-secondary disabled:opacity-50"
                            title="ปิดฟีเจอร์นี้สำหรับทุก role ยกเว้น admin"
                          >
                            เปิดเฉพาะ admin
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">ขั้นต่ำ: {ROLE_LABELS[fn.minimumRole]}</div>
                    </td>
                    {ROLE_ORDER.map((role) => {
                      const allowed = roleHasFunction(role, fn, matrix);
                      const defaultAllowed = roleHasFunction(role, fn, null);
                      const key = `${role}:${fn.id}`;
                      const saving = savingKey === key;
                      const isOverride = allowed !== defaultAllowed;
                      return (
                        <td key={role} className="px-3 py-2.5">
                          <div className="flex flex-col items-center gap-1">
                            <Switch
                              checked={allowed}
                              disabled={loading || saving}
                              onCheckedChange={(checked) => void handleToggle(role, fn.id, checked)}
                              aria-label={`${fn.label} — ${ROLE_LABELS[role]}`}
                            />
                            {isOverride ? (
                              <span className={cn('text-[9px] font-medium', allowed ? 'text-primary' : 'text-muted-foreground')}>
                                {allowed ? 'เปิด' : 'ปิด'}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RolePermissionsTab;
