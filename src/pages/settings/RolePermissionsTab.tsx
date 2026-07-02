import React from 'react';
import { Switch } from '@/components/ui/switch';
import {
  APP_FUNCTIONS,
  ROLE_LABELS,
  ROLE_ORDER,
  functionGroups,
  roleHasFunction,
} from '@/lib/roleFunctions';

const RolePermissionsTab: React.FC = () => {
  const groups = functionGroups();

  return (
    <div className="space-y-4">
      <div className="glass-card rounded-[1.5rem] p-4 border border-white/70 text-sm text-muted-foreground">
        แสดงสิทธิ์ตาม role ในระบบ (Admin &gt; Supervisor &gt; Staff) — เปลี่ยน role ของผู้ใช้ได้ที่แท็บ Users
      </div>

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
                    <td className="px-4 py-2.5 text-foreground">{fn.label}</td>
                    {ROLE_ORDER.map((role) => {
                      const allowed = roleHasFunction(role, fn);
                      return (
                        <td key={role} className="px-3 py-2.5">
                          <div className="flex justify-center">
                            <Switch checked={allowed} disabled aria-label={`${fn.label} — ${ROLE_LABELS[role]}`} />
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
