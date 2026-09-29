/**
 * แท็บล่างของหน้าทีม Online — แต่ละแท็บจบในตัว: กราฟแท่งเทียบ BU ต่อช่วงย่อย + เส้นแนวโน้ม แล้วตามด้วยตาราง
 *
 * เจ้าของสั่ง 29 ก.ย. 2569 (รอบ 2):
 * - คนใช้งาน = % ของบัญชีใน BU + *"แยกบอกด้วยว่า หัวหน้า Opl ฯลฯ อย่างละเท่าไหร่"*
 * - ใบขอเข้า = อัตรา · Lumos = ทุกเลน แยกสีตามเลน (ส่งไป · รอโทร · โทรแล้ว · สำเร็จ · ไม่สำเร็จ · Success rate)
 * - ติดตรงไหน ต่อ BU · Success ประกาศ (ตารางตามภาพต้นแบบ) · ความคุ้มค่า = เว้นไว้ก่อน (แท็บกดไม่ได้)
 * รอบ 4: *"มีรายชื่อมา มาจากไหน มาแล้วยังไง แล้วใบที่ยังไม่มาเยอะแค่ไหน นานแค่ไหน แต่ละ bu เป็นยังไง"*
 * ⇒ แท็บ "ผู้สมัคร" + "ใบยังไม่มีผู้สมัคร" · ตัวส่วนย้ายไป `TeamOnlineSections.tsx` (ใช้ร่วมกับแผงด้านขวาตอนกดการ์ด)
 *
 * กราฟเทียบทุก BU เสมอ (BU ที่เลือกเด่น ที่เหลือจาง) · ตารางตามตัวกรอง BU (ป้าย BU บนหัว) · ค่าที่อ่านไม่ได้ = "—"
 */
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { TeamOnlineResponse } from '@/lib/teamOnline';
import {
  ApplicantsSection,
  FunnelSection,
  LumosSection,
  NoApplicantsSection,
  RequestsSection,
  SuccessSection,
  UsersSection,
} from './TeamOnlineSections';

const TABS = [
  { key: 'users', label: 'คนใช้งาน' },
  { key: 'requests', label: 'ใบขอเข้า' },
  { key: 'applicants', label: 'ผู้สมัคร' },
  { key: 'noApplicants', label: 'ใบยังไม่มีผู้สมัคร' },
  { key: 'lumos', label: 'Lumos' },
  { key: 'funnel', label: 'ติดตรงไหน' },
  { key: 'success', label: 'Success ประกาศ' },
] as const;

const TeamOnlineTabs: React.FC<{ data: TeamOnlineResponse | null; loading: boolean }> = ({ data, loading }) => {
  const waiting = loading && !data;
  return (
    <Tabs defaultValue="users" className="space-y-3">
      <TabsList className="flex h-auto flex-wrap justify-start gap-1">
        {TABS.map((t) => (
          <TabsTrigger key={t.key} value={t.key} className="text-xs">
            {t.label}
          </TabsTrigger>
        ))}
        <TabsTrigger value="value" className="text-xs" disabled title="ยังไม่มีข้อมูลต้นทุน">
          ความคุ้มค่า
        </TabsTrigger>
      </TabsList>
      <TabsContent value="users">
        <UsersSection data={data} loading={waiting} />
      </TabsContent>
      <TabsContent value="requests">
        <RequestsSection data={data} loading={waiting} />
      </TabsContent>
      <TabsContent value="applicants">
        <ApplicantsSection data={data} loading={waiting} />
      </TabsContent>
      <TabsContent value="noApplicants">
        <NoApplicantsSection data={data} loading={waiting} limit={10} />
      </TabsContent>
      <TabsContent value="lumos">
        <LumosSection data={data} loading={waiting} />
      </TabsContent>
      <TabsContent value="funnel">
        <FunnelSection data={data} loading={waiting} />
      </TabsContent>
      <TabsContent value="success">
        <SuccessSection data={data} loading={waiting} />
      </TabsContent>
    </Tabs>
  );
};

export default TeamOnlineTabs;
