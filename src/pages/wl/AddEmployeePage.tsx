import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import type { EmployeeStatus } from '@/types';
import { reverseGeocodeLatLng, parseGoogleMapsUrl } from '@/lib/googleMaps';
import { apiFetch } from '@/lib/apiFetch';
import { toYmdLocal } from '@/lib/dateTh';
import DateSelectDmyBe from '@/components/shared/DateSelectDmyBe';

const AddEmployeePage: React.FC = () => {
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [employeeCode, setEmployeeCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<EmployeeStatus>('active');
  const [position, setPosition] = useState('');
  const [joinDate, setJoinDate] = useState(() => toYmdLocal(new Date()));

  const [locationMode, setLocationMode] = useState<'manual' | 'google' | 'latlong'>('manual');
  const [manualAddress, setManualAddress] = useState('');
  const [googleLink, setGoogleLink] = useState('');
  const [latText, setLatText] = useState('');
  const [lngText, setLngText] = useState('');
  const [geoError, setGeoError] = useState<string | null>(null);

  const parsedLatLng = useMemo(() => {
    const lat = latText.trim() ? Number(latText.trim()) : null;
    const lng = lngText.trim() ? Number(lngText.trim()) : null;
    const okLat = lat !== null && Number.isFinite(lat);
    const okLng = lng !== null && Number.isFinite(lng);
    return okLat && okLng ? { lat: lat as number, lng: lng as number } : null;
  }, [latText, lngText]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (locationMode !== 'google') return;
      setGeoError(null);

      const parsed = parseGoogleMapsUrl(googleLink);
      if (!parsed.ok) {
        setGeoError(parsed.error || 'ไม่สามารถอ่านลิงก์ Google Maps ได้');
        return;
      }

      if (typeof parsed.lat === 'number') setLatText(String(parsed.lat));
      if (typeof parsed.lng === 'number') setLngText(String(parsed.lng));
      if (parsed.addressCandidate) setManualAddress(parsed.addressCandidate);

      if (typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        try {
          const addr = await reverseGeocodeLatLng(parsed.lat, parsed.lng);
          if (!cancelled) setManualAddress(addr);
        } catch (e) {
          if (!cancelled) setGeoError(e instanceof Error ? e.message : String(e));
        }
      }
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [googleLink, locationMode]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (locationMode !== 'latlong') return;
      setGeoError(null);
      if (!parsedLatLng) return;
      try {
        const addr = await reverseGeocodeLatLng(parsedLatLng.lat, parsedLatLng.lng);
        if (!cancelled) setManualAddress(addr);
      } catch (e) {
        if (!cancelled) setGeoError(e instanceof Error ? e.message : String(e));
      }
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [parsedLatLng, locationMode]);

  const handleSave = async () => {
    if (saving) return;
    setFormError(null);
    setGeoError(null);

    const ec = employeeCode.trim();
    const fn = firstName.trim();
    const ln = lastName.trim();
    const p = phone.trim();
    const pos = position.trim();

    if (!ec) return setFormError('กรุณากรอกรหัสพนักงาน');
    if (!fn) return setFormError('กรุณากรอกชื่อ');
    if (!ln) return setFormError('กรุณากรอกนามสกุล');
    if (!p) return setFormError('กรุณากรอกเบอร์โทร');
    if (!pos) return setFormError('กรุณากรอกตำแหน่ง');
    if (!joinDate) return setFormError('กรุณาเลือกวันเริ่มงาน');

    setSaving(true);
    try {
      const payload = {
        employee_code: ec,
        first_name: fn,
        last_name: ln,
        nickname: nickname.trim() || undefined,
        phone: p,
        status,
        position: pos,
        join_date: joinDate,
        address: manualAddress.trim() || undefined,
        lat: parsedLatLng?.lat,
        lng: parsedLatLng?.lng,
      };

      const r = await apiFetch('/api/employees', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const body = await r.json().catch(() => null);
        throw new Error(body?.error || 'บันทึกไม่สำเร็จ');
      }

      navigate('/wl/employees');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="เพิ่มพนักงาน" backPath="/wl/employees" />
      <div className="px-4 md:px-6">
        <div className="glass-card rounded-xl p-4 md:p-6 border border-border max-w-2xl space-y-4">
          {formError && <div className="text-sm text-destructive">{formError}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">รหัสพนักงาน *</label>
              <input
                type="text"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ตำแหน่ง *</label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ชื่อเล่น</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
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
              <label className="text-xs font-medium text-muted-foreground mb-1 block">สถานะ *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              >
                <option value="active">ใช้งาน</option>
                <option value="inactive">ไม่ใช้งาน</option>
                <option value="suspended">ระงับ</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">เริ่มงาน * (วัน / เดือน / ปี พ.ศ.)</label>
              <DateSelectDmyBe value={joinDate} onChange={setJoinDate} />
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-3">ที่อยู่ (optional)</h4>
            <div className="flex gap-1.5 mb-3">
              {(['manual', 'google', 'latlong'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setLocationMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    locationMode === mode ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {mode === 'manual' ? 'พิมพ์เอง' : mode === 'google' ? 'Google Maps' : 'Lat, Long'}
                </button>
              ))}
            </div>

            {locationMode === 'manual' && (
              <input
                type="text"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="ที่อยู่..."
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            )}
            {locationMode === 'google' && (
              <>
                <input
                  type="url"
                  value={googleLink}
                  onChange={(e) => setGoogleLink(e.target.value)}
                  placeholder="Google Maps link..."
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
                <div className="text-xs text-muted-foreground mt-1">ที่อยู่ที่ตรวจพบ: {manualAddress || '-'}</div>
              </>
            )}
            {locationMode === 'latlong' && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={latText}
                  onChange={(e) => setLatText(e.target.value)}
                  placeholder="Latitude"
                  className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
                <input
                  type="text"
                  value={lngText}
                  onChange={(e) => setLngText(e.target.value)}
                  placeholder="Longitude"
                  className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
                />
              </div>
            )}

            {geoError && <div className="text-xs text-destructive mt-2">{geoError}</div>}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button
              onClick={() => navigate('/wl/employees')}
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

export default AddEmployeePage;

