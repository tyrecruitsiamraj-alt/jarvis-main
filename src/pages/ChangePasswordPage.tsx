import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { apiFetch } from '@/lib/apiFetch';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setOk(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    if (newPassword.length < 8) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('ยืนยันรหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }
    if (currentPassword === newPassword) {
      setError('รหัสผ่านใหม่ต้องไม่ซ้ำรหัสเดิม');
      return;
    }

    setBusy(true);
    try {
      const r = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      const body = (await r.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!r.ok) {
        setError(body.message || body.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOk(body.message || 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว');
    } catch {
      setError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="เปลี่ยนรหัสผ่าน" subtitle="อัปเดตรหัสผ่านสำหรับบัญชีของคุณ" backPath="/" />

      <div className="px-4 md:px-6">
        <div className="glass-card rounded-xl p-4 md:p-6 border border-border max-w-xl space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">รหัสผ่านเดิม</label>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">รหัสผ่านใหม่</label>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ยืนยันรหัสผ่านใหม่</label>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            {ok ? (
              <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
                {ok}
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground"
              >
                กลับหน้าแรก
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordPage;
