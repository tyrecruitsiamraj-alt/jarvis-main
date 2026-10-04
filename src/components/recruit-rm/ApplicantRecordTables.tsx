import React from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { EM_DASH } from '@/lib/displayFallback';
import { formatDateTimeTh, formatYmdDmyBe } from '@/lib/dateTh';
import {
  APPLICATION_STATUS_LABEL,
  type ApplicantHistoryItem,
  type AttendanceLogItem,
  type PublicApplication,
} from '@/lib/publicApplicationsApi';
import type { ContactLog } from '@/lib/applicationContactsApi';
import { appointmentLogs, attendanceLabel, isAppointmentFailedContact, type DetailCallRow } from '@/lib/applicantDetail';
import { ATTENDANCE_TONE } from '@/lib/appointmentAttendance';

/**
 * ตารางของแท็บประวัติ/การโทร/การติดต่อ/การนัดหมาย/ติดตามนัดหมาย ในป๊อปรายละเอียดผู้สมัคร
 * 🔴 ว่างก็ยังเป็นตาราง (หัวคอลัมน์ + แถว "ไม่มี…") — กติกาทั้งระบบ 1 ต.ค. 2569 สลับแท็บแล้วทรงไม่เปลี่ยน
 */
const Table: React.FC<{ head: string[]; empty: string; children: React.ReactNode; isEmpty: boolean }> = ({
  head,
  empty,
  children,
  isEmpty,
}) => (
  <div className="overflow-x-auto rounded-xl border border-border/70">
    <table className="min-w-full border-collapse text-left">
      <thead>
        <tr className={cn('border-b border-border', DASH.tableHead)}>
          {head.map((h) => (
            <th key={h} className="px-3 py-2 text-[11px] font-medium">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {isEmpty ? (
          <tr>
            <td colSpan={head.length} className="px-3 py-6 text-center text-xs text-muted-foreground">
              {empty}
            </td>
          </tr>
        ) : (
          children
        )}
      </tbody>
    </table>
  </div>
);

const Td: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <td className={cn('px-3 py-2 text-xs text-foreground', className)}>{children}</td>
);

const by = (name: string | null, at: string) => `${name || 'ไม่ระบุ'} · ${formatDateTimeTh(at)}`;

export const HistoryTable: React.FC<{ items: ApplicantHistoryItem[] }> = ({ items }) => (
  <Table head={['วันที่สมัคร', 'ตำแหน่ง / หน่วยงาน', 'ช่องทาง', 'สถานะ']} empty="ไม่มีใบสมัครอื่นของเบอร์นี้" isEmpty={items.length === 0}>
    {items.map((h) => (
      <tr key={h.id} className="border-b border-border/50 last:border-0">
        <Td className="whitespace-nowrap tabular-nums">{formatDateTimeTh(h.created_at)}</Td>
        <Td>{[h.job_title || h.position_interest, h.unit_name].filter(Boolean).join(' — ') || EM_DASH}</Td>
        <Td>{h.channel_label || EM_DASH}</Td>
        <Td>{APPLICATION_STATUS_LABEL[h.status as PublicApplication['status']] ?? h.status}</Td>
      </tr>
    ))}
  </Table>
);

export const CallsTable: React.FC<{ rows: DetailCallRow[]; application: PublicApplication }> = ({ rows, application: a }) => (
  <div className="space-y-2">
    {a.dial_count ? (
      <p className="text-xs text-muted-foreground">
        กดโทร (จดเวลา) {a.dial_count} ครั้ง
        {a.dialed_last_at ? ` · ล่าสุด ${formatDateTimeTh(a.dialed_last_at)}` : ''}
      </p>
    ) : null}
    <Table head={['เวลา', 'ใครโทร', 'ผล', 'หมายเหตุ']} empty="ยังไม่มีการโทร" isEmpty={rows.length === 0}>
      {rows.map((r) => (
        <tr key={r.key} className="border-b border-border/50 last:border-0">
          <Td className="whitespace-nowrap tabular-nums">{formatDateTimeTh(r.at)}</Td>
          <Td>{r.who}</Td>
          <Td>{r.result}</Td>
          <Td className="text-muted-foreground">{r.note || EM_DASH}</Td>
        </tr>
      ))}
    </Table>
  </div>
);

export const ContactsTable: React.FC<{ logs: ContactLog[] }> = ({ logs }) => (
  <Table head={['ผลการติดต่อ', 'เหตุผล', 'หมายเหตุ', 'บันทึกโดย']} empty="ยังไม่มีการบันทึกผลติดต่อ" isEmpty={logs.length === 0}>
    {logs.map((l) => (
      <tr key={l.id} className="border-b border-border/50 last:border-0">
        <Td className={cn('whitespace-nowrap font-medium', l.ok ? TONE.success.value : TONE.danger.value)}>
          {l.ok ? 'ติดต่อสำเร็จ' : 'ติดต่อไม่สำเร็จ'}
          {isAppointmentFailedContact(l) ? (
            <span className={cn('block text-xs font-normal', TONE.danger.value)}>นัดหมายไม่สำเร็จ</span>
          ) : null}
        </Td>
        <Td>{l.reasonLabel || EM_DASH}</Td>
        <Td className="text-muted-foreground">{l.note || EM_DASH}</Td>
        <Td className="whitespace-nowrap text-muted-foreground">{by(l.createdByName, l.createdAt)}</Td>
      </tr>
    ))}
  </Table>
);

export const AppointmentsTable: React.FC<{ logs: ContactLog[] }> = ({ logs }) => {
  const appts = appointmentLogs(logs);
  return (
    <Table
      head={['ผลการนัดหมาย', 'นัดหมายวันที่', 'สถานที่นัดหมาย', 'ลงหน่วยงาน', 'บันทึกโดย']}
      empty="ยังไม่มีนัดหมาย"
      isEmpty={appts.length === 0}
    >
      {appts.map((l) => {
        const failed = isAppointmentFailedContact(l);
        return (
        <tr key={l.id} className="border-b border-border/50 last:border-0">
          <Td className={cn('font-medium', failed ? TONE.danger.value : TONE.success.value)}>
            {failed ? 'นัดหมายไม่สำเร็จ' : 'นัดหมายสำเร็จ'}
            {failed ? <span className="block text-xs font-normal text-muted-foreground">{l.reasonLabel}</span> : null}
          </Td>
          <Td className="whitespace-nowrap tabular-nums">{failed ? EM_DASH : formatYmdDmyBe(l.appointmentAt)}</Td>
          <Td>{failed ? EM_DASH : l.appointmentPlace || EM_DASH}</Td>
          <Td>{failed ? EM_DASH : l.jobLabel || 'หาล่วงหน้า'}</Td>
          <Td className="whitespace-nowrap text-muted-foreground">{by(l.createdByName, l.createdAt)}</Td>
        </tr>
        );
      })}
    </Table>
  );
};

export const AttendanceTable: React.FC<{ logs: AttendanceLogItem[] }> = ({ logs }) => (
  <Table head={['นัดหมายวันที่', 'ผลการติดตามนัด', 'หมายเหตุ', 'บันทึกโดย']} empty="ยังไม่มีผลติดตามนัด" isEmpty={logs.length === 0}>
    {logs.map((l) => (
      <tr key={l.id} className="border-b border-border/50 last:border-0">
        <Td className="whitespace-nowrap tabular-nums">{formatYmdDmyBe(l.appointmentAt)}</Td>
        <Td className={cn('font-medium', TONE[ATTENDANCE_TONE[l.result]].value)}>{attendanceLabel(l)}</Td>
        <Td className="text-muted-foreground">{l.note || EM_DASH}</Td>
        <Td className="whitespace-nowrap text-muted-foreground">{by(l.recordedByName, l.createdAt)}</Td>
      </tr>
    ))}
  </Table>
);
