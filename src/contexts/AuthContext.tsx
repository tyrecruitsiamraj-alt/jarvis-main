import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';
import { mockUsers } from '@/data/mockData';
import {
  isDemoMode,
  enableRuntimeDemo,
  clearRuntimeDemoFlag,
} from '@/lib/demoMode';
import { apiFetch } from '@/lib/apiFetch';
import { clearJobStaffApiCache, refreshJobStaffFromApi } from '@/lib/jobStaffRemote';
import { refreshWorkCalendarFromApi } from '@/lib/workCalendarStore';

const DEMO_STORAGE_KEY = 'jarvis_user_role';

interface AuthContextType {
  user: User | null;
  /** Demo only: pick a role without backend */
  loginAsDemo: (role: UserRole) => void;
  /** เลือกสิทธิ์ → cookie JWT จาก user คนแรกใน DB ที่มี role นั้น (ปิดได้ด้วย JARVIS_DEV_ROLE_LOGIN=false) */
  devRoleSignIn: (role: UserRole) => Promise<string | null>;
  /** Production: email + password → sets httpOnly cookie via API */
  signIn: (email: string, password: string) => Promise<string | null>;
  logout: () => void | Promise<void>;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
  isAuthenticated: boolean;
  bootstrapping: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 3,
  supervisor: 2,
  staff: 1,
};

function isStoredRole(s: string | null): s is UserRole {
  return s === 'admin' || s === 'supervisor' || s === 'staff';
}

function userForDemoRole(role: UserRole): User | null {
  if (isDemoMode()) {
    return mockUsers.find((u) => u.role === role) ?? null;
  }
  const name = (import.meta.env.VITE_APP_OPERATOR_NAME as string | undefined)?.trim() || 'Operator';
  const idByRole: Record<UserRole, string> = {
    admin: 'local-admin',
    supervisor: 'local-supervisor',
    staff: 'local-staff',
  };
  return {
    id: idByRole[role],
    username: role,
    full_name: name,
    email: '',
    role,
    is_active: true,
    created_at: new Date().toISOString().slice(0, 10),
  };
}

function mapApiUser(raw: Record<string, unknown>): User | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  const email = typeof raw.email === 'string' ? raw.email : '';
  const role = raw.role;
  if (!id || !email || (role !== 'admin' && role !== 'supervisor' && role !== 'staff')) {
    return null;
  }
  return {
    id,
    username: typeof raw.username === 'string' ? raw.username : email,
    full_name: typeof raw.full_name === 'string' ? raw.full_name : email,
    email,
    role,
    is_active: raw.is_active !== false,
    created_at:
      typeof raw.created_at === 'string'
        ? raw.created_at.slice(0, 10)
        : new Date().toISOString().slice(0, 10),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    if (!isDemoMode()) return null;
    const saved = localStorage.getItem(DEMO_STORAGE_KEY);
    if (saved && isStoredRole(saved)) {
      return userForDemoRole(saved);
    }
    return null;
  });
  const [bootstrapping, setBootstrapping] = useState(() => !isDemoMode());

  useEffect(() => {
    if (isDemoMode()) {
      setBootstrapping(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const r = await apiFetch('/api/auth/me');
        if (cancelled) return;
        if (!r.ok) {
          if (r.status === 401 || r.status === 403) {
            setUser(null);
            clearJobStaffApiCache();
            return;
          }
          enableRuntimeDemo();
          clearJobStaffApiCache();
          const saved = localStorage.getItem(DEMO_STORAGE_KEY);
          if (saved && isStoredRole(saved)) {
            setUser(userForDemoRole(saved) ?? null);
          } else {
            setUser(null);
          }
          return;
        }
        const data = (await r.json()) as { user?: Record<string, unknown> };
        const u = data.user ? mapApiUser(data.user) : null;
        setUser(u);
        if (u) {
          void refreshJobStaffFromApi();
          void refreshWorkCalendarFromApi();
        } else clearJobStaffApiCache();
      } catch {
        if (!cancelled) {
          enableRuntimeDemo();
          clearJobStaffApiCache();
          const saved = localStorage.getItem(DEMO_STORAGE_KEY);
          if (saved && isStoredRole(saved)) {
            setUser(userForDemoRole(saved) ?? null);
          } else {
            setUser(null);
          }
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loginAsDemo = useCallback((role: UserRole) => {
    const next = userForDemoRole(role);
    if (next) {
      setUser(next);
      localStorage.setItem(DEMO_STORAGE_KEY, role);
    }
  }, []);

  const devRoleSignIn = useCallback(async (role: UserRole): Promise<string | null> => {
    try {
      const r = await apiFetch('/api/auth/dev-role', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      const text = await r.text();
      let data: Record<string, unknown> = {};
      try {
        if (text.trim()) data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        /* ไม่ใช่ JSON (เช่น HTML จากพร็อกซี) */
      }
      if (!r.ok) {
        const fromBody =
          typeof data.message === 'string'
            ? data.message
            : typeof data.error === 'string'
              ? data.error
              : '';
        if (fromBody) return fromBody;
        const t = text.trim();
        const looksLikeHtml = /^\s*</.test(t) || /<\s*html/i.test(t);
        if (
          !t ||
          looksLikeHtml ||
          r.status === 405 ||
          r.status === 502 ||
          r.status === 503 ||
          r.status === 504
        ) {
          enableRuntimeDemo();
          const next = userForDemoRole(role);
          if (next) {
            setUser(next);
            localStorage.setItem(DEMO_STORAGE_KEY, role);
          }
          return null;
        }
        const snippet = t.slice(0, 180);
        return snippet || `เข้าสู่ระบบไม่สำเร็จ (HTTP ${r.status})`;
      }
      const rawUser = data.user as Record<string, unknown> | undefined;
      const u = rawUser ? mapApiUser(rawUser) : null;
      if (!u) return 'คำตอบจากเซิร์ฟเวอร์ไม่ถูกต้อง';
      setUser(u);
      void refreshJobStaffFromApi();
      void refreshWorkCalendarFromApi();
      return null;
    } catch (e) {
      if (e instanceof TypeError) {
        enableRuntimeDemo();
        const next = userForDemoRole(role);
        if (next) {
          setUser(next);
          localStorage.setItem(DEMO_STORAGE_KEY, role);
        }
        return null;
      }
      return e instanceof Error ? e.message : 'Dev role sign-in failed';
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    const r = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });
    let data: Record<string, unknown> = {};
    try {
      data = (await r.json()) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    if (!r.ok) {
      const msg =
        typeof data.message === 'string'
          ? data.message
          : typeof data.error === 'string'
            ? data.error
            : 'Sign in failed';
      return msg;
    }
    const rawUser = data.user as Record<string, unknown> | undefined;
    const u = rawUser ? mapApiUser(rawUser) : null;
    if (!u) return 'Invalid response from server';
    setUser(u);
    void refreshJobStaffFromApi();
    void refreshWorkCalendarFromApi();
    return null;
  }, []);

  const logout = useCallback(async () => {
    if (isDemoMode()) {
      setUser(null);
      localStorage.removeItem(DEMO_STORAGE_KEY);
      clearRuntimeDemoFlag();
      return;
    }
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' });
    } catch {
      /* still clear client state */
    }
    clearJobStaffApiCache();
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (requiredRole: UserRole | UserRole[]) => {
      if (!user) return false;
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      const userLevel = ROLE_HIERARCHY[user.role];
      return roles.some((role) => userLevel >= ROLE_HIERARCHY[role]);
    },
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loginAsDemo,
        devRoleSignIn,
        signIn,
        logout,
        hasPermission,
        isAuthenticated: !!user,
        bootstrapping,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
