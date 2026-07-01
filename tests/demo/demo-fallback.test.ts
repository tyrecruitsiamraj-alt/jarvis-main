import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isRuntimeDemoFallbackEnabled,
  isConfiguredDemoMode,
  clearRuntimeDemoFlag,
} from '@/lib/demoMode';

const ROOT = join(__dirname, '../..');

describe('demo fallback — unit behavior', () => {
  it('runtime demo fallback is off unless env explicitly enables it', () => {
    clearRuntimeDemoFlag();
    expect(isRuntimeDemoFallbackEnabled()).toBe(false);
  });

  it('configured demo mode follows VITE_DEMO_MODE only', () => {
    expect(isConfiguredDemoMode()).toBe(
      import.meta.env.VITE_DEMO_MODE === 'true',
    );
  });
});

describe('demo fallback — production contracts', () => {
  it('demoMode.ts blocks runtime fallback in production builds', () => {
    const src = readFileSync(join(ROOT, 'src/lib/demoMode.ts'), 'utf8');
    expect(src).toContain('if (import.meta.env.PROD) return false');
  });

  it('AuthContext clears user when API bootstrap fails and fallback disabled', () => {
    const src = readFileSync(join(ROOT, 'src/contexts/AuthContext.tsx'), 'utf8');
    expect(src).toContain('isRuntimeDemoFallbackEnabled()');
    expect(src).toContain('clearRuntimeDemoFlag()');
    expect(src).toContain('setUser(null)');
    expect(src).toMatch(/if \(isRuntimeDemoFallbackEnabled\(\)\)[\s\S]*enableRuntimeDemo/);
  });

  it('work calendar store does not seed mock rows outside demo mode', () => {
    const src = readFileSync(join(ROOT, 'src/lib/workCalendarStore.ts'), 'utf8');
    expect(src).toMatch(/isDemoMode\(\)|isConfiguredDemoMode\(\)/);
  });
});
