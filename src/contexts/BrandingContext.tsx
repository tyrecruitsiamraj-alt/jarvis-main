import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  type BrandingConfig,
  DEFAULT_BRANDING,
  applyBrandingToDocument,
  loadBranding,
  saveBranding,
} from '@/lib/brandingStorage';

type BrandingContextValue = {
  config: BrandingConfig;
  setConfig: (next: BrandingConfig) => void;
  updateConfig: (partial: Partial<BrandingConfig>) => void;
  resetToDefaults: () => void;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

export const BrandingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfigState] = useState<BrandingConfig>(() => loadBranding());

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

  const value = useMemo(
    () => ({ config, setConfig, updateConfig, resetToDefaults }),
    [config, setConfig, updateConfig, resetToDefaults],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
};

export const useBranding = () => {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error('useBranding must be used within BrandingProvider');
  return ctx;
};
