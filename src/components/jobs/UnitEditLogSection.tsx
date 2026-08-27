/**
 * ประวัติการแก้ไขของใบขอ — **ใครแก้อะไรไป**
 *
 * เจ้าของสั่ง 18 ส.ค. 2569: *"เพิ่ม log การแก้ไขไว้ด้วยนะหน้ากล่องงาน ว่าใครแก้อะไรไป"*
 * · clarify 21 ส.ค.: *"ฉันหมายถึงหน้ากล่องงาน — ของหน้าใบงานทำแบบเดิม เคยไม่มีก็ไม่ต้องมี"*
 *
 * 🔴 ย้ายออกจากป๊อปอัปการ์ดกล่องงานมาเป็น component 27 ส.ค. 2569 (ป๊อปนั้นถูกถอดทั้งดวง
 * เพราะเจ้าของสั่ง *"พอกดแล้วก็พาไปดูข้อมูล ไม่เอาแบบ Popup เด้ง"*) — ตอนนี้อยู่ในแท็บ
 * "ประกาศ / ลิงก์สมัคร" ของใบขอ ซึ่งเป็นที่ที่การแก้เกิดขึ้นจริง
 *
 * ⚠️ **staff เท่านั้น** — ชื่อคนแก้เป็นข้อมูลภายใน ผู้เรียกต้องกั้นเอง
 * ⚠️ โหลดล้ม = โชว์ข้อความ ไม่พาหน้าล้ม
 */
import React from 'react';

import { fetchUnitEditLog, unitRequestNoteKey } from '@/lib/siamrajUnitRequestsApi';
import { describeUnitEdit, UNIT_EDIT_TITLE, type UnitEditLogItem } from '@/lib/unitEditLog';
import type { JobRequest } from '@/types';

const UnitEditLogSection: React.FC<{ job: JobRequest | null }> = ({ job }) => {
  const [items, setItems] = React.useState<UnitEditLogItem[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!job) {
      setItems(null);
      return;
    }
    let cancelled = false;
    setItems(null);
    setFailed(false);
    fetchUnitEditLog(unitRequestNoteKey(job))
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [job]);

  return (
    <div className="space-y-1.5">
      {failed ? (
        <p className="text-xs text-muted-foreground">
          โหลดประวัติไม่ได้ตอนนี้ — ข้อมูลใบขอส่วนอื่นยังใช้ได้ปกติ
        </p>
      ) : items == null ? (
        <p className="text-xs text-muted-foreground">กำลังโหลดประวัติ…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">ยังไม่มีการแก้ไขใบนี้ในระบบ Jarvis</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => {
            const lines = describeUnitEdit(it);
            return (
              <li key={it.id} className="rounded-xl border border-border/60 bg-secondary/30 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{it.user_name || 'ไม่ทราบชื่อ'}</span>
                  {' · '}
                  {UNIT_EDIT_TITLE[it.entity_type] ?? it.entity_type}
                  {' · '}
                  {new Date(it.created_at).toLocaleString('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
                {lines.length > 0 ? (
                  <ul className="mt-0.5 space-y-0.5">
                    {lines.map((line, i) => (
                      <li key={i} className="text-xs text-foreground">
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">บันทึกโดยไม่มีช่องที่เปลี่ยน</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default UnitEditLogSection;
