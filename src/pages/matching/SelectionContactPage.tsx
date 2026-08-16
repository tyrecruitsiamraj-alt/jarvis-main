import React from 'react';
import PageHeader from '@/components/shared/PageHeader';
import { MyCallsSection } from '@/pages/matching/MyCallsPage';
import { CALL_LANE_HINT } from '@/lib/callLane';
import { DASH } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * หน้า "การติดต่อ" ของ**เลนคัดสรร** (เจ้าของสั่ง 16 ส.ค. 2569: *"แยกนะ งานสรรหา
 * มีหน้าการติดต่อแล้ว งานคัดสรรก็ให้มีหน้าการติดต่อของเขาเอง ไม่ปนกัน"*)
 *
 * - เลนสรรหาใช้แท็บ "การติดต่อ" บนบอร์ดรับสมัคร (ของเดิม — ตอนนี้กรองเหลือเฉพาะ
 *   งานโทรคนที่ยังไม่สมัคร)
 * - หน้านี้คือฝั่งคัดสรร: งานโทรของคนที่**สมัครแล้ว** (คนบนบอร์ด + ใบสมัคร)
 *
 * ⚠️ เนื้อในเป็น MyCallsSection ตัวเดียวกัน ต่างแค่เลน — สองทีมย้ายไปช่วยกันได้
 * โดยไม่ต้องเรียนรู้หน้าจอใหม่
 */
const SelectionContactPage: React.FC = () => (
  <div className="relative">
    <PageHeader
      title="การติดต่อ (คัดสรร)"
      subtitle={CALL_LANE_HINT.selection}
      backPath="/matching/match"
    />
    <div className="space-y-4 px-4 py-4 md:px-6">
      <SelectionEmptyHint />
      <MyCallsSection lane="selection" />
    </div>
  </div>
);

/**
 * MyCallsSection ซ่อนตัวเองเมื่อไม่มีงานค้างและไม่มียอดวันนี้ (ออกแบบไว้สำหรับหน้าหลัก)
 * — บนหน้าที่ตั้งใจเปิดมาดู ถ้าว่างแล้วหน้าโล่งสนิทคนจะคิดว่าพัง จึงมี hint ค้างไว้เสมอ
 */
const SelectionEmptyHint: React.FC = () => (
  <p className={cn('rounded-xl border px-3 py-2 text-[11px]', DASH.card, DASH.muted)}>
    งานโทรมาจากปุ่ม “รับไปโทรเอง” บนหน้า Matching (คนบนบอร์ด) และปุ่มโทรในกล่องงาน
    (ใบสมัคร) — เก็บแล้ว AI จะไม่โทรทับเบอร์นั้น · งานเลนสรรหาอยู่ที่แท็บ “การติดต่อ”
    บนบอร์ดรับสมัคร
  </p>
);

export default SelectionContactPage;
