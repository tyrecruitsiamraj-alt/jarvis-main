/**
 * ═══ ข้อมูลดิบของเส้นใบขอ 12 ขั้น (หน้าหลัก แท็บใบขอ · เจ้าของ 22 ต.ค. 2569) ═══
 * เซิร์ฟเวอร์ส่งข้อเท็จจริง (`/api/request-pipeline`) · หน้าเว็บนับเองด้วย `requestPipeline.ts` (ตัวนับเดียวกับเมนูใบขอ/ภาพรวมงานสรรหา)
 * ก้อนไหนอ่านไม่ได้ = null + เหตุใน `errors` (ห้ามส่ง 0 แทน)
 */
import type { ChannelPlacement } from './channelPlacement';
import type { RecruitAppFact } from './recruitOverviewTypes';

export type RequestPipelineResponse = {
  generatedAt: string;
  /** วันนี้ (YYYY-MM-DD เวลาไทย) */
  today: string;
  /** ช่วงของก้อนช่องทาง */
  window: { from: string; to: string };
  /** ใบสมัครของใบขอที่เปิดอยู่ ทุกช่วงเวลา (ไม่นับ Lead/ยกเลิกข้อมูล) */
  facts: RecruitAppFact[] | null;
  /** jobId ที่ประกาศแล้ว */
  releasedJobIds: string[] | null;
  /** ส่งคนแทน: รหัสไซต์ → [วันเข้างาน, จำนวนคน] (หน้าติดตามส่งคนแทน · ไม่นับที่ยกเลิก) */
  replacementBySite: Record<string, Array<[string, number]>> | null;
  /** วันแรกที่มีข้อมูลส่งคนแทน — ก่อนวันนี้ไม่รู้ว่าส่งไหม */
  replacementSince: string | null;
  /** ติดตามคนเริ่มงาน: รหัสไซต์ → วันเริ่มติดตามของแต่ละคน (หนึ่งชุดติดตาม = หนึ่งคน) */
  followStartsBySite: Record<string, string[]> | null;
  /** ดูแลหลังเริ่มงาน: รหัสไซต์ → วันเริ่มของแต่ละคน */
  aftercareBySite: Record<string, string[]> | null;
  /** ช่องทางที่ได้คนลงงาน (ตัวเดียวกับภาพรวมงานสรรหา) */
  channels: ChannelPlacement | null;
  errors: Partial<Record<'requests' | 'facts' | 'releases' | 'replacement' | 'follow' | 'channels', string>>;
};
