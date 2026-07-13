import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, UserRole } from '@/types';
import { apiFetch } from '@/lib/apiFetch';
import { clearJobStaffApiCache, refreshJobStaffFromApi } from '@/lib/jobStaffRemote';
import { clearJobUnitPageSession } from '@/lib/jobUnitSessionState';
import { refreshWorkCalendarFromApi } from '@/lib/workCalendarStore';

interface AuthContextType {
  user: User | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signInWithDevRole: (role: UserRole) => Promise<string | null>;
  requestMagicLink: (email: string) => Promise<string | null>;
  signInWithMicrosoft: (returnTo?: string) => void;
  verifyMagicLink: (token: string) => Promise<string | null>;
  signUp: (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) => Promise<string | null>;
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
  admin: 4,
  supervisor: 3,
  staff: 2,
  opl: 1,
};

function mapApiUser(raw: Record<string, unknown>): User | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  const email = typeof raw.email === 'string' ? raw.email : '';
  const role = raw.role;
  if (!id || !email || (role !== 'admin' && role !== 'supervisor' && role !== 'staff' && role !== 'opl')) {
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
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
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
          clearJobStaffApiCache();
          setUser(null);
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
          clearJobStaffApiCache();
          setUser(null);
        }
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    let r: Response;
    try {
      r = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });
    } catch {
      return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — รัน npm run dev ให้ API ทำงานพร้อมหน้าเว็บ';
    }
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
            : r.status >= 500
              ? `เซิร์ฟเวอร์ API ล้ม (HTTP ${r.status}) — ไม่ใช่รหัสผิด ตรวจ Vercel/โดเมน`
              : `Sign in failed (HTTP ${r.status})`;
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

  const signInWithDevRole = useCallback(async (role: UserRole): Promise<string | null> => {
    let r: Response;
    try {
      r = await apiFetch('/api/auth/dev-role', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
    } catch {
      return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — รัน npm run dev ให้ API ทำงานพร้อมหน้าเว็บ';
    }
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
            : 'เข้าสู่ระบบด้วยสิทธิ์ไม่สำเร็จ';
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

  const requestMagicLink = useCallback(async (email: string): Promise<string | null> => {
    let r: Response;
    try {
      r = await apiFetch('/api/auth/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — รัน npm run dev ให้ API ทำงานพร้อมหน้าเว็บ';
    }
    let data: Record<string, unknown> = {};
    try {
      data = (await r.json()) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    if (!r.ok) {
      return (
        (typeof data.message === 'string' && data.message) ||
        (typeof data.error === 'string' && data.error) ||
        'ส่งลิงก์เข้าสู่ระบบไม่สำเร็จ'
      );
    }
    return null;
  }, []);

  const signInWithMicrosoft = useCallback((returnTo = '/') => {
    const safe =
      returnTo.startsWith('/') && !returnTo.startsWith('//') && !returnTo.startsWith('/api/')
        ? returnTo
        : '/';
    window.location.assign(`/api/auth/azure-ad/start?returnTo=${encodeURIComponent(safe)}`);
  }, []);

  const verifyMagicLink = useCallback(async (token: string): Promise<string | null> => {
    let r: Response;
    try {
      r = await apiFetch('/api/auth/magic-link-verify', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    } catch {
      return 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้';
    }
    let data: Record<string, unknown> = {};
    try {
      data = (await r.json()) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
    if (!r.ok) {
      return (
        (typeof data.message === 'string' && data.message) ||
        (typeof data.error === 'string' && data.error) ||
        'ลิงก์เข้าสู่ระบบไม่ถูกต้องหรือหมดอายุแล้ว'
      );
    }
    const rawUser = data.user as Record<string, unknown> | undefined;
    const u = rawUser ? mapApiUser(rawUser) : null;
    if (!u) return 'Invalid response from server';
    setUser(u);
    void refreshJobStaffFromApi();
    void refreshWorkCalendarFromApi();
    return null;
  }, []);

  const signUp = useCallback(
    async (payload: {
      email: string;
      password: string;
      first_name: string;
      last_name: string;
    }): Promise<string | null> => {
      const r = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: payload.email.trim(),
          password: payload.password,
          first_name: payload.first_name.trim(),
          last_name: payload.last_name.trim(),
        }),
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
              : 'Register failed';
        return msg;
      }
      return null;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' });
    } catch {
      /* still clear client state */
    }
    clearJobStaffApiCache();
    clearJobUnitPageSession();
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
        signIn,
        signInWithDevRole,
        requestMagicLink,
        signInWithMicrosoft,
        verifyMagicLink,
        signUp,
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
