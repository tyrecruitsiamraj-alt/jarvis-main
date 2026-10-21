import React from 'react';
import { parseYmd, ceToBeYear } from '@/lib/dateTh';
import { appointmentTimeOf } from '@/lib/appointmentTime';
import type { PublicApplication } from '@/lib/publicApplicationsApi';

/**
 * ═══ ใบรายชื่อผู้สมัครงานสำหรับพิมพ์ — แบบฟอร์ม iRecruit (เจ้าของ 21 ต.ค. 2569) ═══
 * > *"นัดหมายตอน โหลดเป็น PDF มันต้องได้ข้อมูลประมาณนี้มากกว่าได้แต่ห้ามน้อยกว่า"* (แนบใบ iRecruit บูธโลตัส ลาดพร้าว)
 * หน้าละ สถานที่ + เวลา · คอลัมน์ครบตามใบ iRecruit: ลำดับ · เวลา · ชื่อ-นามสกุล · เบอร์โทรศัพท์ · ตำแหน่งงาน · ช่องทาง ·
 * หน่วยงาน · เจ้าหน้าที่ · หมายเหตุ (ว่างไว้เขียนมือ)
 * 🔴 บนจอซ่อน (`hidden print:block`) — โผล่เฉพาะตอนพิมพ์ ใน `.rm-print-area` (print CSS เดิม) · ไม่เพิ่ม CSS
 */
export type AppointmentPrintGroup = {
  key: string;
  ymd: string;
  place: string;
  time: string | null;
  rows: readonly PublicApplication[];
};

/** "ประจำวันที่ 21 เดือน 10 พ.ศ. 2569" แบบในใบ iRecruit */
function dayLine(ymd: string): string {
  const p = parseYmd(ymd);
  return p ? `ประจำวันที่ ${p.d} เดือน ${p.m} พ.ศ. ${ceToBeYear(p.y)}` : '';
}

const HEAD = ['ลำดับ', 'เวลา', 'ชื่อ-นามสกุล', 'เบอร์โทรศัพท์', 'ตำแหน่งงาน', 'ช่องทาง', 'หน่วยงาน', 'เจ้าหน้าที่', 'หมายเหตุ'] as const;

export default function AppointmentPrintSheet({ groups }: { groups: readonly AppointmentPrintGroup[] }) {
  return (
    <div className="hidden print:block" data-testid="appointment-print-sheet">
      {groups.length === 0 ? <p className="text-sm">ไม่มีนัด</p> : null}
      {groups.map((g, gi) => (
        <section key={g.key} className={gi < groups.length - 1 ? 'break-after-page' : undefined}>
          {/* หัวกระดาษอยู่ในตาราง — print CSS เดิมตั้งสีหมึกดำให้ table (โหมดมืดก็พิมพ์ดำ) · เส้นใช้สีตัวหนังสือ */}
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <td colSpan={HEAD.length} className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="leading-tight">
                      <p className="text-base font-medium">SIAM RAJATHANEE</p>
                      <p className="text-xs">PUBLIC COMPANY LIMITED</p>
                    </div>
                    <div className="flex-1 text-center">
                      <p className="text-base font-medium">
                        รายชื่อผู้สมัครงาน {g.place}
                        {g.time ? ` · ${g.time} น.` : ''}
                      </p>
                      <p className="text-sm">{dayLine(g.ymd)}</p>
                    </div>
                    <p className="text-xs">เริ่มใช้วันที่ 14 ธันวาคม 2562</p>
                  </div>
                </td>
              </tr>
              <tr>
                {HEAD.map((h) => (
                  <th key={h} className="border border-current px-1.5 py-1 text-center font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r, i) => (
                <tr key={r.id}>
                  <td className="border border-current px-1.5 py-1 text-center tabular-nums">{i + 1}</td>
                  <td className="border border-current px-1.5 py-1 text-center tabular-nums">{appointmentTimeOf(r.appointment_at) ?? ''}</td>
                  <td className="border border-current px-1.5 py-1">{r.full_name}</td>
                  <td className="border border-current px-1.5 py-1 text-center tabular-nums">{r.phone}</td>
                  <td className="border border-current px-1.5 py-1 text-center">{r.job_title || r.position_interest || ''}</td>
                  <td className="border border-current px-1.5 py-1 text-center">{r.channel_label || ''}</td>
                  <td className="border border-current px-1.5 py-1 text-center">{r.appointment_job || r.unit_name || ''}</td>
                  <td className="border border-current px-1.5 py-1 text-center">{r.appointment_by || ''}</td>
                  <td className="w-40 border border-current px-1.5 py-1" />
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
