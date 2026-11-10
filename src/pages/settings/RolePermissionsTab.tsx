import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  APP_FUNCTIONS,
  type AppFunctionDef,
  ROLE_ORDER,
  functionGroups,
  roleHasFunction,
  type AppFunctionId,
} from '@/lib/roleFunctions';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { useAuth } from '@/contexts/AuthContext';
import { TONE } from '@/lib/designTokens';
import type { UserRole } from '@/types';
import { cn } from '@/lib/utils';

/**
 * หัวคอลัมน์สั้น (เจ้าของ 10 พ.ย. 2569 "จัดเรียงหน้าให้ดูหน่อย") — เดิมใช้ ROLE_LABELS เต็ม "Sale (อ่านอย่างเดียว)"
 * หัวกินที่จนชื่อฟังก์ชันโดนบีบตัดทีละพยางค์ · "อ่านอย่างเดียว" ย้ายเป็นบรรทัดรองใต้หัว
 */
const ROLE_HEAD: Record<UserRole, { name: string; note?: string }> = {
  sale: { name: 'Sale', note: 'อ่านอย่างเดียว' },
  opl: { name: 'OPL', note: 'อ่านอย่างเดียว' },
  staff: { name: 'Staff' },
  supervisor: { name: 'Supervisor' },
  admin: { name: 'Admin' },
};
const VIEW_AS_ROLES: UserRole[] = ['sale', 'opl', 'staff', 'supervisor'];

const RolePermissionsTab: React.FC = () => {
  const { matrix, loading, updateGrant, savingKey } = useRolePermissions();
  const { realRole, viewAsRole, setViewAsRole } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const groups = functionGroups();

  /**
   * "เปิดเฉพาะ admin" — ปิด opl/staff/supervisor ในคลิกเดียว
   * ใช้ตอนฟีเจอร์ยังไม่พร้อมเปิดใช้ แต่ deploy ขึ้นไปแล้ว (admin ทดสอบบนของจริงคนเดียว)
   * เดิมต้องปิดทีละ role ถ้าเผลอปิดไม่ครบ = คนอื่นยังเห็น
   */
  const adminOnly = async (fn: AppFunctionDef) => {
    setError(null);
    try {
      for (const role of ROLE_ORDER) {
        if (role === 'admin') continue;
        if (!roleHasFunction(role, fn, matrix)) continue;
        await updateGrant(role, fn.id, false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
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
      <Card className="space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-lg font-medium text-foreground">สิทธิ์ตาม role</h2>
          <p className="text-sm text-muted-foreground">สลับแล้วบันทึกทันที · เปลี่ยน role ของคนที่เมนูผู้ใช้งาน</p>
        </div>

        {/* ═══ ลองดูหน้าจอในมุมมองของ role อื่น (เจ้าของสั่ง 2 ก.ย. 2569) ═══
            *"ทำให้ Admin ดูมุมมองของ Role อื่นได้ จะได้ตรวจสอบว่าที่แก้ไปได้ตามนั้นไหม"*
            🔴 เขียนไว้ตรง ๆ ว่าเป็นแค่มุมมองจอ — ไม่ได้ลดสิทธิ์จริงฝั่งเซิร์ฟเวอร์ */}
        {realRole === 'admin' ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <span className="text-sm text-foreground">ดูจอแบบ role อื่น</span>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              className="flex-wrap justify-start"
              value={viewAsRole ?? ''}
              onValueChange={(v) => setViewAsRole(v ? (v as UserRole) : null)}
              aria-label="ดูจอแบบ role อื่น"
            >
              {VIEW_AS_ROLES.map((r) => (
                <ToggleGroupItem key={r} value={r}>
                  {ROLE_HEAD[r].name}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {viewAsRole ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setViewAsRole(null)}>
                กลับเป็น Admin
              </Button>
            ) : null}
            <span className="basis-full text-xs text-muted-foreground">
              จำลองจออย่างเดียว · กดปุ่มแล้วเซิร์ฟเวอร์ยังทำด้วยสิทธิ์ Admin ของคุณ
            </span>
          </div>
        ) : null}
      </Card>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </div>
      ) : null}

      {/* ตารางเดียวทั้งหน้า หัวคอลัมน์ชุดเดียว · กลุ่มเป็นแถวคั่น (เดิมการ์ดละกลุ่ม หัวซ้ำทุกการ์ด) */}
      <Card className="overflow-hidden p-0" aria-busy={loading}>
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-64">ฟังก์ชัน</TableHead>
                {ROLE_ORDER.map((role) => (
                  <TableHead key={role} className="w-28 whitespace-nowrap text-center">
                    <span className="block text-foreground">{ROLE_HEAD[role].name}</span>
                    {ROLE_HEAD[role].note ? <span className="block text-xs font-normal">{ROLE_HEAD[role].note}</span> : null}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => (
                <React.Fragment key={group}>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={ROLE_ORDER.length + 1} className="py-2 text-sm font-medium text-foreground">
                      {group}
                    </TableCell>
                  </TableRow>
                  {APP_FUNCTIONS.filter((f) => f.group === group).map((fn) => {
                    const adminOnlyNow = ROLE_ORDER.every((r) => r === 'admin' || !roleHasFunction(r, fn, matrix));
                    return (
                      <TableRow key={fn.id}>
                        <TableCell className="space-y-1.5">
                          <span className="block text-sm text-foreground">{fn.label}</span>
                          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>ขั้นต่ำ {ROLE_HEAD[fn.minimumRole].name}</span>
                            {adminOnlyNow ? (
                              <Badge variant="outline" className={cn('font-normal', TONE.warn.soft, TONE.warn.value)}>
                                เห็นเฉพาะ Admin
                              </Badge>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={() => void adminOnly(fn)}
                                disabled={loading || !!savingKey}
                                title="ปิดฟังก์ชันนี้ทุก role ยกเว้น Admin"
                              >
                                เปิดเฉพาะ Admin
                              </Button>
                            )}
                          </span>
                        </TableCell>
                        {ROLE_ORDER.map((role) => {
                          const allowed = roleHasFunction(role, fn, matrix);
                          const isOverride = allowed !== roleHasFunction(role, fn, null);
                          const saving = savingKey === `${role}:${fn.id}`;
                          return (
                            <TableCell key={role} className="text-center">
                              <span className="inline-flex flex-col items-center gap-1">
                                <Switch
                                  checked={allowed}
                                  disabled={loading || saving}
                                  onCheckedChange={(checked) => void handleToggle(role, fn.id, checked)}
                                  aria-label={`${fn.label} — ${ROLE_HEAD[role].name}`}
                                />
                                {/* ต่างจากค่าเริ่มของ role นี้ = มีคนแก้ไว้ (บอกด้วยคำ ไม่ใช่สีอย่างเดียว) */}
                                {isOverride ? <span className="whitespace-nowrap text-xs text-primary">แก้จากค่าเริ่ม</span> : null}
                              </span>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
};

export default RolePermissionsTab;
