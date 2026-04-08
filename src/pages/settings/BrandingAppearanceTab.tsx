import React, { useRef } from 'react';
import { useBranding } from '@/contexts/BrandingContext';
import { hexToHslComponents, hslComponentsToHex } from '@/lib/brandingStorage';
import { BrandMark } from '@/components/shared/BrandMark';
import { Palette, ImagePlus, RotateCcw, Trash2 } from 'lucide-react';

const MAX_LOGO_CHARS = 1_200_000;

const BrandingAppearanceTab: React.FC = () => {
  const { config, updateConfig, resetToDefaults } = useBranding();
  const fileRef = useRef<HTMLInputElement>(null);

  const onLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = String(reader.result || '');
      if (data.length > MAX_LOGO_CHARS) {
        window.alert('ไฟล์รูปใหญ่เกินไป กรุณาใช้รูปขนาดเล็กลง (แนะนำไม่เกิน ~800KB)');
        return;
      }
      updateConfig({ logoDataUrl: data });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="glass-card rounded-xl p-4 md:p-6 border border-border space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Palette className="w-4 h-4 text-primary" />
          โลโก้และชื่อระบบ
        </h3>

        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">ชื่อที่แสดงในแถบหัว</label>
          <input
            type="text"
            value={config.appName}
            onChange={(e) => updateConfig({ appName: e.target.value })}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground"
            placeholder="So Recruit"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-secondary/30">
            <BrandMark size="md" />
            <BrandMark size="lg" />
          </div>
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium w-fit"
            >
              <ImagePlus className="w-4 h-4" />
              อัปโหลดโลโก้
            </button>
            {config.logoDataUrl && (
              <button
                type="button"
                onClick={() => updateConfig({ logoDataUrl: null })}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-foreground text-sm w-fit"
              >
                <Trash2 className="w-4 h-4" />
                ลบโลโก้ (ใช้ตัวอักษร)
              </button>
            )}
            <p className="text-[11px] text-muted-foreground">PNG / JPG แนะนำสี่เหลี่ยมจัตุรัส กว้างไม่เกิน ~800KB</p>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4 md:p-6 border border-border space-y-4">
        <h3 className="text-sm font-semibold text-foreground">สีหลัก (ปุ่ม ลิงก์ ไฮไลต์)</h3>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={hslComponentsToHex(config.primaryHsl)}
            onChange={(e) => updateConfig({ primaryHsl: hexToHslComponents(e.target.value) })}
            className="h-10 w-14 rounded cursor-pointer border border-border bg-transparent"
            title="สีหลัก"
          />
          <span className="text-xs text-muted-foreground font-mono">{config.primaryHsl}</span>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4 md:p-6 border border-border space-y-4">
        <h3 className="text-sm font-semibold text-foreground">สีพื้นหลังและข้อความ</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">พื้นหลังหลัก</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hslComponentsToHex(config.backgroundHsl)}
                onChange={(e) => updateConfig({ backgroundHsl: hexToHslComponents(e.target.value) })}
                className="h-10 w-full max-w-[4rem] rounded cursor-pointer border border-border"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">ข้อความหลัก</label>
            <input
              type="color"
              value={hslComponentsToHex(config.foregroundHsl)}
              onChange={(e) => updateConfig({ foregroundHsl: hexToHslComponents(e.target.value) })}
              className="h-10 w-full max-w-[4rem] rounded cursor-pointer border border-border"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">การ์ด / แผง</label>
            <input
              type="color"
              value={hslComponentsToHex(config.cardHsl)}
              onChange={(e) => updateConfig({ cardHsl: hexToHslComponents(e.target.value) })}
              className="h-10 w-full max-w-[4rem] rounded cursor-pointer border border-border"
            />
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4 md:p-6 border border-border space-y-4">
        <h3 className="text-sm font-semibold text-foreground">พื้นหลังหน้าจอ</h3>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="pageBg"
              checked={config.pageBackgroundMode === 'solid'}
              onChange={() => updateConfig({ pageBackgroundMode: 'solid' })}
            />
            สีพื้นเดียว (ใช้ “พื้นหลังหลัก”)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="pageBg"
              checked={config.pageBackgroundMode === 'gradient'}
              onChange={() => updateConfig({ pageBackgroundMode: 'gradient' })}
            />
            ไล่สี (Gradient)
          </label>
        </div>
        {config.pageBackgroundMode === 'gradient' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">สีต้นทาง</label>
              <input
                type="color"
                value={hslComponentsToHex(config.gradientFromHsl)}
                onChange={(e) => updateConfig({ gradientFromHsl: hexToHslComponents(e.target.value) })}
                className="h-10 w-full max-w-[4rem] rounded cursor-pointer border border-border"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">สีปลายทาง</label>
              <input
                type="color"
                value={hslComponentsToHex(config.gradientToHsl)}
                onChange={(e) => updateConfig({ gradientToHsl: hexToHslComponents(e.target.value) })}
                className="h-10 w-full max-w-[4rem] rounded cursor-pointer border border-border"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            if (window.confirm('รีเซ็ตเป็นค่าเริ่มต้นของระบบ?')) {
              resetToDefaults();
            }
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-secondary text-sm font-medium text-foreground"
        >
          <RotateCcw className="w-4 h-4" />
          รีเซ็ตค่าเริ่มต้น
        </button>
        <p className="text-xs text-muted-foreground self-center">
          การตั้งค่าถูกบันทึกในเบราว์เซอร์นี้อัตโนมัติ (localStorage)
        </p>
      </div>
    </div>
  );
};

export default BrandingAppearanceTab;
