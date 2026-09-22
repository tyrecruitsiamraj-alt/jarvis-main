import React from 'react';
import { MapPin, Phone, Wallet } from 'lucide-react';

/**
 * ═══ การ์ดหน้าสมัครสาธารณะ — presentational ล้วน (แยกออกมา 22 ก.ย. 2569) ═══
 *
 * เจ้าของเคาะ (นิยามกล่องงานข้อ 4): ก่อน gen link ต้อง **ดูตัวอย่างได้ว่าหน้าสมัคร
 * จะออกมาหน้าตายังไง** · หน้าจริง (`PublicPostingApplyPage`) กับตัวอย่างในป๊อปสร้างลิงก์
 * ต้องใช้ component ตัวเดียวกัน — ห้ามก๊อปโครงไปวาดใหม่ (ไม่งั้นตัวอย่างกับของจริงเพี้ยนกัน)
 *
 * 🔴 รับข้อมูลเป็น props ล้วน ไม่ fetch เอง — หน้าจริงส่งจาก posting snapshot ·
 * ป๊อปสร้างลิงก์ส่งจากค่าที่กรอกอยู่ (ยังไม่ได้เซฟ) ⇒ ตัวอย่างตรงกับของจริงเสมอ
 *
 * `footer` = พื้นที่ปุ่ม (หน้าจริงใส่ปุ่ม "กรอกใบสมัคร" จริง · ตัวอย่างใส่ป้ายบอกว่าตัวอย่าง)
 */
export type PublicPostingPreviewData = {
  title: string;
  detail?: string | null;
  locationText?: string | null;
  salaryText?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
};

const PublicPostingPreview: React.FC<{
  data: PublicPostingPreviewData;
  footer?: React.ReactNode;
}> = ({ data, footer }) => {
  const contact = [data.contactName, data.contactPhone].filter(Boolean).join(' · ');
  return (
    <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-[0_24px_60px_-28px_rgba(16,24,43,0.35),0_2px_8px_rgba(16,24,43,0.08)] sm:p-7">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-gold">
        So Recruit · รับสมัครงาน
      </p>
      <h1 className="mt-2 text-xl font-medium leading-snug text-foreground sm:text-2xl">
        {data.title || 'ยังไม่ได้ตั้งชื่อประกาศ'}
      </h1>

      {data.detail ? (
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {data.detail}
        </p>
      ) : null}

      <div className="mt-4 space-y-2 text-sm text-foreground">
        {data.locationText ? (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" aria-hidden />
            <span>{data.locationText}</span>
          </p>
        ) : null}
        {data.salaryText ? (
          <p className="flex items-start gap-2">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" aria-hidden />
            <span>{data.salaryText}</span>
          </p>
        ) : null}
        {contact ? (
          <p className="flex items-start gap-2">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" aria-hidden />
            <span>{contact}</span>
          </p>
        ) : null}
      </div>

      {footer}
    </div>
  );
};

export default PublicPostingPreview;
