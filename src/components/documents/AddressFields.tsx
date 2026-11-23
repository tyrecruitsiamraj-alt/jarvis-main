/**
 * ช่องที่อยู่ไทยของฟอร์มส่งเอกสาร — บ้านเลขที่ หมู่ ซอย ถนน + จังหวัด → อำเภอ/เขต → ตำบล/แขวง → รหัสไปรษณีย์ (22 พ.ย. 2569)
 * เปลี่ยนช่องบน = ช่องล่างที่ไม่เกี่ยวกันแล้วถูกล้าง (`updateAddress`) · ลากข้อมูลที่อยู่ทั้งประเทศ ใช้เฉพาะหน้าผู้สมัคร
 */
import { useId, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SearchableSelect from '@/components/shared/SearchableSelect';
import { selectedAddress, thaiProvinces, updateAddress, type ThaiAddress } from '@/lib/documents/thaiAddress';

const PROVINCE_OPTIONS = thaiProvinces.map((p) => ({ value: p.id, label: p.name })).sort((a, b) => a.label.localeCompare(b.label, 'th'));

export default function AddressFields({ value, onChange, name }: { value: ThaiAddress; onChange: (next: ThaiAddress) => void; name: string }) {
  const id = useId();
  const { province, district, subdistrict } = selectedAddress(value);
  const districts = useMemo(() => (province?.districts ?? []).map((d) => ({ value: d.id, label: d.prefix + d.name })), [province]);
  const subdistricts = useMemo(() => (district?.subdistricts ?? []).map((s) => ({ value: s.id, label: s.prefix + s.name })), [district]);
  const set = (key: keyof ThaiAddress, v: string) => onChange(updateAddress(value, key, v));
  const text = (key: 'house' | 'moo' | 'soi' | 'road', label: string, max: number, mode?: 'numeric') => (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-${key}`}>{label}</Label>
      <Input id={`${id}-${key}`} value={value[key]} maxLength={max} inputMode={mode} autoComplete="off" onChange={(e) => set(key, e.target.value)} />
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-3" data-testid={`address-${name}`}>
      {text('house', 'บ้านเลขที่', 30)}
      {text('moo', 'หมู่', 10, 'numeric')}
      {text('soi', 'ซอย', 60)}
      {text('road', 'ถนน', 60)}
      <div className="col-span-2 space-y-1.5">
        <Label>จังหวัด</Label>
        <SearchableSelect value={value.provinceId} onChange={(v) => set('provinceId', v)} options={PROVINCE_OPTIONS} placeholder="เลือกจังหวัด" searchPlaceholder="พิมพ์ชื่อจังหวัด" emptyText="ไม่พบจังหวัดนี้" ariaLabel={`จังหวัด ${name}`} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label>อำเภอ / เขต</Label>
        <SearchableSelect value={value.districtId} onChange={(v) => set('districtId', v)} options={districts} disabled={!province} placeholder={province ? 'เลือกอำเภอ / เขต' : 'เลือกจังหวัดก่อน'} searchPlaceholder="พิมพ์ชื่ออำเภอ / เขต" emptyText="ไม่พบอำเภอนี้" ariaLabel={`อำเภอ ${name}`} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label>ตำบล / แขวง</Label>
        <SearchableSelect value={value.subdistrictId} onChange={(v) => set('subdistrictId', v)} options={subdistricts} disabled={!district} placeholder={district ? 'เลือกตำบล / แขวง' : 'เลือกอำเภอก่อน'} searchPlaceholder="พิมพ์ชื่อตำบล / แขวง" emptyText="ไม่พบตำบลนี้" ariaLabel={`ตำบล ${name}`} />
      </div>
      <div className="col-span-2 space-y-1.5">
        <Label>รหัสไปรษณีย์</Label>
        <Select value={value.postalCode} onValueChange={(v) => onChange({ ...value, postalCode: v })} disabled={!subdistrict}>
          <SelectTrigger aria-label={`รหัสไปรษณีย์ ${name}`} className="tabular-nums">
            <SelectValue placeholder={subdistrict ? 'เลือกรหัสไปรษณีย์' : 'เลือกตำบลก่อน'} />
          </SelectTrigger>
          <SelectContent>
            {(subdistrict?.postalCodes ?? []).map((code) => (
              <SelectItem key={code} value={code} className="tabular-nums">
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
