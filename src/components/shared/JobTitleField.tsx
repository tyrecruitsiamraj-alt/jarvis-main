import React, { useEffect, useId, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { fetchRecruitJobTitles } from '@/lib/recruitJobTitlesApi';
import { jobTitleOptions, type RecruitJobTitle } from '@/lib/recruitJobTitles';

/**
 * ช่อง "ตำแหน่งงาน" — พิมพ์เองได้ + เติมคำจาก master ที่ยกมาจากระบบเดิม
 *
 * ใช้ที่ฟอร์ม "เพิ่มข้อมูลผู้สมัคร" (ตำแหน่งที่สนใจ) และ "สร้างลิงก์" (ตำแหน่งของประกาศ)
 * — เดิมเป็นช่องพิมพ์เปล่า ๆ ทั้งสองที่ ทำให้ชื่อตำแหน่งเดียวกันสะกดไม่เหมือนกันทุกใบ
 * แล้วรายงาน "ตำแหน่งไหนหาคนยาก" นับไม่ได้
 *
 * ⚠️ **เป็น input + datalist ไม่ใช่ select** — master ยกมา ณ วันหนึ่ง (479 ตำแหน่ง)
 * แต่งานใหม่เกิดทุกสัปดาห์ · ปิดทางพิมพ์เมื่อไหร่เจ้าหน้าที่จะกรอกฟอร์มไม่จบ
 * ค่าที่พิมพ์ใหม่บันทึกได้ตามปกติ แค่มีป้ายบอกว่ายังไม่มีใน master
 *
 * ⚠️ โหลดไม่ได้/ตารางยังไม่ migrate = ช่องยังใช้งานได้เหมือนเดิม (แค่ไม่มีตัวช่วยเติมคำ)
 * ไม่ขึ้น error ให้ผู้ใช้ เพราะไม่ได้ขัดขวางการกรอก
 */
const JobTitleField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  /** รหัส BU ของงาน — กรองลิสต์ให้เหลือของ BU นั้น + ที่ไม่ระบุ BU · ไม่ส่ง = ทุก BU */
  departmentCode?: string | null;
  label?: string;
  placeholder?: string;
  /** class ของ input — รับจากฟอร์มเพื่อให้หน้าตาตรงกับช่องอื่นในฟอร์มเดียวกัน */
  /** เพิ่มคลาสให้ช่อง (หน้าตาหลักมาจาก `Input` · 12 ต.ค. 2569) */
  inputClassName?: string;
  labelClassName: string;
}> = ({
  value,
  onChange,
  departmentCode = null,
  label = 'ตำแหน่งงาน',
  placeholder = 'เช่น ขับรถผู้บริหารไทย',
  inputClassName,
  labelClassName,
}) => {
  const listId = useId();
  const [titles, setTitles] = useState<RecruitJobTitle[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchRecruitJobTitles({ departmentCode })
      .then((rows) => {
        if (!cancelled) setTitles(rows);
      })
      .catch(() => {
        if (!cancelled) setTitles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [departmentCode]);

  const options = useMemo(() => jobTitleOptions(titles), [titles]);

  return (
    <div className="space-y-1.5">
      <label className={labelClassName} htmlFor={`${listId}-input`}>
        {label}
      </label>
      <Input
        id={`${listId}-input`}
        className={inputClassName}
        list={options.length > 0 ? listId : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {options.length > 0 ? (
        <datalist id={listId}>
          {options.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      ) : null}
      {/* ถอดบรรทัดอธิบายใต้ช่อง (QA 17 ต.ค. 2569: ขึ้น "ตำแหน่งใหม่ — ยังไม่มีในรายชื่อ…" ทั้งที่ค่ามาจากใบขอ · กติกาห้ามประโยคอธิบายบนจอ) */}
    </div>
  );
};

export default JobTitleField;
