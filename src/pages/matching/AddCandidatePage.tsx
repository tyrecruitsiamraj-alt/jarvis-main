import React, { useMemo, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { apiUnreachableHint } from '@/lib/apiUnreachableHint';
import PageHeader from '@/components/shared/PageHeader';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { isConfiguredDemoMode } from '@/lib/demoMode';
import { createCandidate } from '@/lib/demoStorage';
import type { DrivingResult, Gender, YesNo } from '@/types';
const TITLE_PREFIX_SELECT = [
  { value: '', label: '— ไม่มี —' },
  { value: 'นาย', label: 'นาย' },
  { value: 'นาง', label: 'นาง' },
  { value: 'นางสาว', label: 'นางสาว' },
  { value: 'เด็กชาย', label: 'เด็กชาย' },
  { value: 'เด็กหญิง', label: 'เด็กหญิง' },
  { value: '__custom__', label: 'อื่น ๆ (พิมพ์เอง)' },
] as const;

const AddCandidatePage: React.FC = () => {
  const navigate = useNavigate();

  const [titlePrefixSelect, setTitlePrefixSelect] = useState('');
  const [titlePrefixCustom, setTitlePrefixCustom] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<Gender>('male');

  const [drinkingUi, setDrinkingUi] = useState<'ไม่ดื่ม' | 'ดื่ม'>('ไม่ดื่ม');
  const [smokingUi, setSmokingUi] = useState<'ไม่สูบ' | 'สูบ'>('ไม่สูบ');
  const [tattooUi, setTattooUi] = useState<'ไม่มี' | 'มี'>('ไม่มี');

  const [vanDriving, setVanDriving] = useState<DrivingResult>('not_tested');
  const [sedanDriving, setSedanDriving] = useState<DrivingResult>('not_tested');

  const [houseNo, setHouseNo] = useState('');
  const [village, setVillage] = useState('');
  const [road, setRoad] = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [district, setDistrict] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [applicationDate, setApplicationDate] = useState('');
  const [firstContactDate, setFirstContactDate] = useState('');
  const [firstWorkDate, setFirstWorkDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullAddress = useMemo(() => {
    return [
      houseNo ? `เลขที่ ${houseNo.trim()}` : '',
      village ? `อาคาร/หมู่บ้าน/โครงการ ${village.trim()}` : '',
      road ? `ถนน ${road.trim()}` : '',
      subdistrict ? `ตำบล/แขวง ${subdistrict.trim()}` : '',
      district ? `อำเภอ/เขต ${district.trim()}` : '',
      province ? `จังหวัด ${province.trim()}` : '',
      postalCode ? `รหัสไปรษณีย์ ${postalCode.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }, [houseNo, village, road, subdistrict, district, province, postalCode]);

  const uiToYesNo = (ui: string, yesUi: string): YesNo => (ui === yesUi ? 'yes' : 'no');

  const effectiveTitlePrefix = useMemo(() => {
    if (titlePrefixSelect === '__custom__') return titlePrefixCustom.trim();
    return titlePrefixSelect.trim();
  }, [titlePrefixSelect, titlePrefixCustom]);

  const handleSave = async () => {
    if (saving) return;
    setError(null);

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedPhone = phone.trim();
    const normalizedAge = age.trim() ? Number(age) : NaN;

    if (!normalizedFirstName) return setError('กรุณากรอกชื่อ');
    if (!normalizedLastName) return setError('กรุณากรอกนามสกุล');
    if (!normalizedPhone) return setError('กรุณากรอกเบอร์โทร');
    if (!Number.isFinite(normalizedAge) || normalizedAge <= 0) return setError('กรุณากรอกอายุให้ถูกต้อง');
    if (!houseNo.trim()) return setError('กรุณากรอกเลขที่');
    if (!subdistrict.trim()) return setError('กรุณากรอกตำบล/แขวง');
    if (!district.trim()) return setError('กรุณากรอกอำเภอ/เขต');
    if (!province.trim()) return setError('กรุณากรอกจังหวัด');

    const payload = {
      ...(effectiveTitlePrefix ? { title_prefix: effectiveTitlePrefix } : {}),
      first_name: normalizedFirstName,
      last_name: normalizedLastName,
      phone: normalizedPhone,
      age: Math.trunc(normalizedAge),
      gender,
      drinking: uiToYesNo(drinkingUi, 'ดื่ม'),
      smoking: uiToYesNo(smokingUi, 'สูบ'),
      tattoo: uiToYesNo(tattooUi, 'มี'),
      van_driving: vanDriving,
      sedan_driving: sedanDriving,
      address: fullAddress,
      application_date: applicationDate || undefined,
      first_contact_date: firstContactDate || undefined,
      first_work_date: firstWorkDate || undefined,
    };

    if (isConfiguredDemoMode()) {
      setSaving(true);
      try {
        createCandidate(payload);
        toast.success('บันทึกผู้สมัครแล้ว (โหมดสาธิต — เก็บในเครื่องนี้)');
        navigate('/matching/candidates');
      } finally {
        setSaving(false);
      }
      return;
    }

    try {
      setSaving(true);
      const r = await apiFetch('/api/candidates', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const body: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        const fromApi =
          body &&
          typeof body === 'object' &&
          ('message' in body || 'error' in body)
            ? String(
                (body as { message?: string; error?: string }).message ||
                  (body as { error?: string }).error ||
                  '',
              ).trim()
            : '';
        setError(
          fromApi ||
            (r.status === 401
              ? 'ไม่มี session (Missing auth cookie) — ล็อกอินด้วยอีเมล/รหัสผ่าน หรือตั้ง VITE_DEMO_MODE=true แล้วรัน dev ใหม่เพื่อบันทึกแบบสาธิต'
              : `บันทึกไม่สำเร็จ (HTTP ${r.status}) — ตรวจสอบ PostgreSQL และตาราง jarvis_rm.candidates`),
        );
        return;
      }
      navigate('/matching/candidates');
    } catch (e) {
      if (e instanceof TypeError) {
        setError(apiUnreachableHint());
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="เพิ่มผู้สมัครใหม่" backPath="/matching/candidates" />

      <div className="px-4 md:px-6">
        <div className="glass-card rounded-xl p-4 md:p-6 border border-border max-w-3xl space-y-4">
          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">คำนำหน้า</label>
              <select
                value={titlePrefixSelect}
                onChange={(e) => {
                  setTitlePrefixSelect(e.target.value);
                  if (e.target.value !== '__custom__') setTitlePrefixCustom('');
                }}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                {TITLE_PREFIX_SELECT.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {titlePrefixSelect === '__custom__' && (
                <input
                  type="text"
                  value={titlePrefixCustom}
                  onChange={(e) => setTitlePrefixCustom(e.target.value)}
                  placeholder="พิมพ์คำนำหน้า"
                  className="mt-2 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ชื่อ *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">นามสกุล *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">เบอร์โทร *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">อายุ *</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">เพศ *</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                <option value="male">ชาย</option>
                <option value="female">หญิง</option>
                <option value="other">อื่นๆ</option>
              </select>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">ข้อมูลเพิ่มเติม</h4>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ดื่มแอลกอฮอล์</label>
                <select
                  value={drinkingUi}
                  onChange={(e) => setDrinkingUi(e.target.value as typeof drinkingUi)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <option value="ไม่ดื่ม">ไม่ดื่ม</option>
                  <option value="ดื่ม">ดื่ม</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">สูบบุหรี่</label>
                <select
                  value={smokingUi}
                  onChange={(e) => setSmokingUi(e.target.value as typeof smokingUi)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <option value="ไม่สูบ">ไม่สูบ</option>
                  <option value="สูบ">สูบ</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">รอยสัก</label>
                <select
                  value={tattooUi}
                  onChange={(e) => setTattooUi(e.target.value as typeof tattooUi)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <option value="ไม่มี">ไม่มี</option>
                  <option value="มี">มี</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ผลขับรถตู้</label>
                <select
                  value={vanDriving}
                  onChange={(e) => setVanDriving(e.target.value as DrivingResult)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <option value="not_tested">ยังไม่สอบ</option>
                  <option value="passed">ผ่าน</option>
                  <option value="failed">ไม่ผ่าน</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ผลขับรถเก๋ง</label>
                <select
                  value={sedanDriving}
                  onChange={(e) => setSedanDriving(e.target.value as DrivingResult)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                >
                  <option value="not_tested">ยังไม่สอบ</option>
                  <option value="passed">ผ่าน</option>
                  <option value="failed">ไม่ผ่าน</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">ที่อยู่ปัจจุบัน</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">เลขที่ *</label>
                <input
                  type="text"
                  value={houseNo}
                  onChange={(e) => setHouseNo(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">อาคาร / หมู่บ้าน / โครงการ</label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ถนน</label>
                <input
                  type="text"
                  value={road}
                  onChange={(e) => setRoad(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ตำบล / แขวง *</label>
                <input
                  type="text"
                  value={subdistrict}
                  onChange={(e) => setSubdistrict(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">อำเภอ / เขต *</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">จังหวัด *</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">รหัสไปรษณีย์</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ตัวอย่างที่อยู่รวม</label>
                <div className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground min-h-[42px]">
                  {fullAddress || '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่สมัคร</label>
                <input
                  type="date"
                  value={applicationDate}
                  onChange={(e) => setApplicationDate(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่คุยครั้งแรก</label>
                <input
                  type="date"
                  value={firstContactDate}
                  onChange={(e) => setFirstContactDate(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่ลงงานครั้งแรก</label>
                <input
                  type="date"
                  value={firstWorkDate}
                  onChange={(e) => setFirstWorkDate(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/matching/candidates')}
              className="px-6 py-2.5 rounded-lg bg-secondary text-foreground font-medium text-sm"
            >
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddCandidatePage;