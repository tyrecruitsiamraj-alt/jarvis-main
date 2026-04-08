import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type BrandingConfig,
  DEFAULT_BRANDING,
  applyBrandingToDocument,
  loadBranding,
  saveBranding,
} from '@/lib/brandingStorage';
import { isDemoMode } from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/contexts/AuthContext';

type SyncResult = { ok: boolean; message?: string };

type BrandingContextValue = {
  config: BrandingConfig;
  setConfig: (next: BrandingConfig) => void;
  updateConfig: (partial: Partial<BrandingConfig>) => void;
  resetToDefaults: () => void;
  /** Admin: บันทึกธีม/โลโก้ลง DB — ผู้ใช้คนอื่นจะเห็นหลังรีเฟรช */
  syncBrandingToOrg: () => Promise<SyncResult>;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

function mergeServerPayload(remote: Record<string, unknown>): BrandingConfig {
  return { ...DEFAULT_BRANDING, ...remote } as BrandingConfig;
}

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [config, setConfigState] = useState<BrandingConfig>(() => loadBranding());

  useEffect(() => {
    if (isDemoMode()) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch('/api/branding');
        if (!r.ok || cancelled) return;
        const data = (await r.json()) as { config?: Record<string, unknown> | null };
        if (!data.config || typeof data.config !== 'object') return;
        setConfigState(mergeServerPayload(data.config));
      } catch {
        /* offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyBrandingToDocument(config);
    saveBranding(config);
  }, [config]);

  const setConfig = useCallback((next: BrandingConfig) => {
    setConfigState(next);
  }, []);

  const updateConfig = useCallback((partial: Partial<BrandingConfig>) => {
    setConfigState((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setConfigState({ ...DEFAULT_BRANDING });
  }, []);

  const syncBrandingToOrg = useCallback(async (): Promise<SyncResult> => {
    if (user?.role !== 'admin') {
      return { ok: false, message: 'เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่เผยแพร่ธีมได้' };
    }
    try {
      const r = await apiFetch('/api/branding', {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      let msg = '';
      try {
        const j = (await r.json()) as { message?: string; error?: string };
        msg = j.message || j.error || '';
      } catch {
        /* ignore */
      }
      if (!r.ok) {
        return { ok: false, message: msg || `บันทึกไม่สำเร็จ (HTTP ${r.status})` };
      }
      return { ok: true, message: 'เผยแพร่แล้ว — ผู้ใช้คนอื่นจะเห็นหลังรีเฟรชหน้า' };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : 'เครือข่ายผิดพลาด' };
    }
  }, [config, user?.role]);

  const value = useMemo(
    () => ({
      config,
      setConfig,
      updateConfig,
      resetToDefaults,
      syncBrandingToOrg,
    }),
    [config, setConfig, updateConfig, resetToDefaults, syncBrandingToOrg],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider');
  return ctx;
};
