import React from 'react';
import { FieldSelect } from '@/components/shared/FieldSelect';
import { useOptionalAuthUser } from '@/contexts/AuthContext';
import { fetchResponsibleNames } from '@/lib/applicationImportApi';
import { LINK_RESPONSIBLE_LANES } from '@/lib/recruitPostings';
import {
  linkResponsibleOptions,
  linkResponsibleValue,
  mergeResponsibleStaff,
  type LinkResponsibleOption,
  type LinkResponsibleStaff,
} from '@/lib/linkResponsible';

/**
 * ผู้รับผิดชอบของลิงก์ที่จะ Gen (เจ้าของ 19 พ.ย. 2569) — รายชื่อ = สายสรรหา + ทีม Online · โหลดใหม่ทุกครั้งที่ `resetKey` เปลี่ยน
 * ค่าเริ่ม = คนในรายชื่อที่ชื่อตรงกับ `preferredName` (ผู้รับผิดชอบของกล่องลอย) › คนกด
 * ใช้ทั้งฟอร์ม Gen link (`GenApplyLinkDialog`) และ Gen link เพิ่ม (`AddChannelLinks`) ⇒ สองที่เลือกจากรายชื่อเดียวกัน
 */
export function useLinkResponsible(
  resetKey: unknown,
  preferredName: string | null = null,
): {
  value: string;
  setValue: (id: string) => void;
  options: LinkResponsibleOption[];
} {
  const me = useOptionalAuthUser();
  const [staff, setStaff] = React.useState<LinkResponsibleStaff[]>([]);
  const [picked, setPicked] = React.useState('');
  React.useEffect(() => {
    let alive = true;
    setPicked('');
    // สายไหนโหลดไม่ได้ = ข้ามสายนั้น ที่เหลือยังเลือกได้ (คนกดอยู่ในรายชื่อเสมอ)
    void Promise.all(
      LINK_RESPONSIBLE_LANES.map((lane) => fetchResponsibleNames(lane).catch(() => [] as LinkResponsibleStaff[])),
    ).then((lists) => {
      if (alive) setStaff(mergeResponsibleStaff(lists));
    });
    return () => {
      alive = false;
    };
  }, [resetKey]);
  return {
    value: linkResponsibleValue(picked, me, staff, preferredName),
    setValue: setPicked,
    options: linkResponsibleOptions(staff, me),
  };
}

const LinkResponsibleField: React.FC<{
  value: string;
  onChange: (id: string) => void;
  options: LinkResponsibleOption[];
  disabled?: boolean;
}> = ({ value, onChange, options, disabled }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-medium text-muted-foreground">ผู้รับผิดชอบ</label>
    <FieldSelect
      ariaLabel="ผู้รับผิดชอบ"
      testId="link-responsible"
      value={value}
      onChange={onChange}
      options={options}
      disabled={disabled}
    />
  </div>
);

export default LinkResponsibleField;
