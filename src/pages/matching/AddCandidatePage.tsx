import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';
import { apiUnreachableHint } from '@/lib/apiUnreachableHint';
import PageHeader from '@/components/shared/PageHeader';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import DateSelectDmyBe from '@/components/shared/DateSelectDmyBe';
import type { DrivingResult, Gender, YesNo } from '@/types';
import { TITLE_PREFIX_OPTIONS } from '@/lib/titlePrefixOptions';

const AddCandidatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [titlePrefix, setTitlePrefix] = useState('');
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

  useEffect(() => {
    const first = searchParams.get('first_name') || '';
    const last = searchParams.get('last_name') || '';
    const phoneQuery = searchParams.get('phone') || '';
    const ageQuery = searchParams.get('age') || '';
    const sex = (searchParams.get('sex') || '').trim().toUpperCase();
    const provinceQuery = searchParams.get('province') || '';
    const districtQuery = searchParams.get('district') || '';

    if (first) setFirstName(first);
    if (last) setLastName(last);
    if (phoneQuery) setPhone(phoneQuery);
    if (ageQuery) setAge(ageQuery);
    if (provinceQuery) setProvince(provinceQuery);
    if (districtQuery) setDistrict(districtQuery);

    if (sex === 'M' || sex === 'MALE') setGender('male');
    else if (sex === 'F' || sex === 'FEMALE') setGender('female');
    else if (sex) setGender('other');
  }, [searchParams]);

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
      ...(titlePrefix.trim() ? { title_prefix: titlePrefix.trim() } : {}),
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
              ? 'ไม่มี session (Missing auth cookie) — ล็อกอินด้วยอีเมล/รหัสผ่าน'
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
        <div className="glass-card rounded-[1.5rem] p-4 md:p-6 border border-white/70 max-w-3xl space-y-4">
          {error && <div className="text-sm text-destructive">{error}</div>}
          {(searchParams.get('first_name') || searchParams.get('phone') || searchParams.get('location_label')) && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-xs text-blue-700">
              ดึงข้อมูลเบื้องต้นมาจาก iRecruit แล้ว กรุณาตรวจสอบและกรอกข้อมูลเพิ่มเติมก่อนบันทึก
              {searchParams.get('location_label') ? ` • พื้นที่: ${searchParams.get('location_label')}` : ''}
              {searchParams.get('job_name') ? ` • งานเดิม: ${searchParams.get('job_name')}` : ''}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">คำนำหน้า</label>
              <select
                value={titlePrefix}
                onChange={(e) => setTitlePrefix(e.target.value)}
                className="jarvis-soft-field"
              >
                {TITLE_PREFIX_OPTIONS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ชื่อ *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="jarvis-soft-field"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">นามสกุล *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="jarvis-soft-field"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">เบอร์โทร *</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="jarvis-soft-field"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">อายุ *</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="jarvis-soft-field"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">เพศ *</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
                className="jarvis-soft-field"
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
                  className="jarvis-soft-field"
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
                  className="jarvis-soft-field"
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
                  className="jarvis-soft-field"
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
                  className="jarvis-soft-field"
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
                  className="jarvis-soft-field"
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
                  className="jarvis-soft-field"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">อาคาร / หมู่บ้าน / โครงการ</label>
                <input
                  type="text"
                  value={village}
                  onChange={(e) => setVillage(e.target.value)}
                  className="jarvis-soft-field"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ถนน</label>
                <input
                  type="text"
                  value={road}
                  onChange={(e) => setRoad(e.target.value)}
                  className="jarvis-soft-field"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ตำบล / แขวง *</label>
                <input
                  type="text"
                  value={subdistrict}
                  onChange={(e) => setSubdistrict(e.target.value)}
                  className="jarvis-soft-field"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">อำเภอ / เขต *</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="jarvis-soft-field"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">จังหวัด *</label>
                <input
                  type="text"
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className="jarvis-soft-field"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">รหัสไปรษณีย์</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="jarvis-soft-field"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">ตัวอย่างที่อยู่รวม</label>
                <div className="jarvis-soft-field min-h-[42px]">
                  {fullAddress || '-'}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่สมัคร</label>
                <DateSelectDmyBe value={applicationDate} onChange={setApplicationDate} allowEmpty />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่คุยครั้งแรก</label>
                <DateSelectDmyBe value={firstContactDate} onChange={setFirstContactDate} allowEmpty />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">วันที่ลงงานครั้งแรก</label>
                <DateSelectDmyBe value={firstWorkDate} onChange={setFirstWorkDate} allowEmpty />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 jarvis-pill-btn font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
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