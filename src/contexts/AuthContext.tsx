import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
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
    department_code: string;
  }) => Promise<string | null>;
  setMyDepartment: (department_code: string) => Promise<string | null>;
  logout: () => void | Promise<void>;
  hasPermission: (requiredRole: UserRole | UserRole[]) => boolean;
  isAuthenticated: boolean;
  bootstrapping: boolean;
  /**
   * ═══ ดูหน้าจอในมุมมองของ role อื่น (เจ้าของสั่ง 2 ก.ย. 2569) ═══
   * *"ทำให้ Admin สามารถดูมุมมองของ Role อื่นได้หน่อย จะได้ตรวจสอบว่าที่แก้ไปได้ตามนั้นไหม"*
   *
   * 🔴 **เป็นการจำลอง "หน้าจอ" เท่านั้น ไม่ใช่การสวมสิทธิ์จริง** — โทเคนที่ส่งไปกับทุก
   * request ยังเป็นของ admin ตัวจริง ⇒ ถ้าเผลอกดปุ่มที่ role นั้นไม่ควรกด **เซิร์ฟเวอร์
   * จะยอมให้ผ่าน** · จอต้องเตือนตลอดเวลาที่อยู่ในมุมมองนี้ (แถบบนสุดใน AppLayout)
   * ⚠️ ใช้ได้เฉพาะ admin ตัวจริงเท่านั้น — role อื่นเรียกแล้วไม่มีผล
   */
  realRole: UserRole | null;
  viewAsRole: UserRole | null;
  setViewAsRole: (role: UserRole | null) => void;
  /**
   * แผนกที่อยากเห็นระหว่างสวมมุมมอง (เจ้าของสั่ง 2 ก.ย. 2569:
   * *"จะเห็นแผนกไหนก็ค่อยไปเลือกตอน Admin เลือกมุมมองเอา"*)
   *
   * 🔴 บัญชี admin ส่วนใหญ่ **ไม่มีแผนก** — พอสวมเป็น role อื่นแล้วบังคับเลือกแผนก
   * จอจะเด้งไปหน้า "เลือกแผนกก่อนใช้งาน" ซึ่งสับสนและเสี่ยงไปตั้งแผนกให้บัญชีจริง
   * ⇒ เลือกที่นี่แทน · `null` = ดูแบบไม่ระบุแผนก (เหมือน admin)
   */
  viewAsDepartment: string | null;
  setViewAsDepartment: (code: string | null) => void;
}

const VIEW_AS_KEY = 'jarvis.viewAsRole';
const VIEW_AS_DEPT_KEY = 'jarvis.viewAsDepartment';
const VIEWABLE_ROLES: UserRole[] = ['opl', 'staff', 'supervisor', 'admin'];
function isViewableRole(v: string): v is UserRole {
  return (VIEWABLE_ROLES as string[]).includes(v);
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
    ...(typeof raw.department_code === 'string' && raw.department_code.trim()
      ? { department_code: raw.department_code.trim().toUpperCase() }
      : {}),
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  /**
   * มุมมองที่ admin กำลังดูอยู่ — เก็บใน sessionStorage เพื่อให้รีเฟรชแล้วยังอยู่ในมุมมองเดิม
   * (ปิดแท็บ = หลุดออกเอง · ไม่ใช่ของที่ควรค้างข้ามวัน)
   */
  const [viewAsRole, setViewAsRoleState] = useState<UserRole | null>(() => {
    try {
      const v = sessionStorage.getItem(VIEW_AS_KEY);
      return v && isViewableRole(v) ? v : null;
    } catch {
      return null;
    }
  });
  const [viewAsDepartment, setViewAsDepartmentState] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(VIEW_AS_DEPT_KEY) || null;
    } catch {
      return null;
    }
  });

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
      department_code: string;
    }): Promise<string | null> => {
      const r = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: payload.email.trim(),
          password: payload.password,
          first_name: payload.first_name.trim(),
          last_name: payload.last_name.trim(),
          department_code: payload.department_code.trim().toUpperCase(),
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
      // สมัครแล้วรอ admin อนุมัติ (is_active=false) — ไม่มี session กลับมา, ไม่ auto-login
      // คืนข้อความแจ้งผู้ใช้ (แสดงในหน้า Register) แทนการพาเข้าระบบ
      if (data.pending === true) {
        return typeof data.message === 'string'
          ? data.message
          : 'สมัครสำเร็จ — บัญชีของคุณรอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน';
      }
      const rawUser = data.user as Record<string, unknown> | undefined;
      const u = rawUser ? mapApiUser(rawUser) : null;
      if (u) {
        setUser(u);
        void refreshJobStaffFromApi();
        void refreshWorkCalendarFromApi();
      }
      return null;
    },
    [],
  );

  const setMyDepartment = useCallback(async (department_code: string): Promise<string | null> => {
    const r = await apiFetch('/api/auth/me', {
      method: 'PATCH',
      body: JSON.stringify({ department_code: department_code.trim().toUpperCase() }),
    });
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
        'บันทึกแผนกไม่สำเร็จ'
      );
    }
    const rawUser = data.user as Record<string, unknown> | undefined;
    const u = rawUser ? mapApiUser(rawUser) : null;
    if (!u) return 'Invalid response from server';
    setUser(u);
    return null;
  }, []);

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

  const realRole = user?.role ?? null;
  /** สลับมุมมองได้เฉพาะ admin ตัวจริง — เช็คจาก `realRole` ไม่ใช่ role ที่กำลังสวมอยู่ */
  const setViewAsRole = useCallback(
    (role: UserRole | null) => {
      if (realRole !== 'admin') return;
      setViewAsRoleState(role);
      try {
        if (role) sessionStorage.setItem(VIEW_AS_KEY, role);
        else sessionStorage.removeItem(VIEW_AS_KEY);
      } catch {
        /* โหมดส่วนตัวบางเบราว์เซอร์เขียนไม่ได้ — ยังใช้ได้ในแท็บนี้ */
      }
    },
    [realRole],
  );

  /**
   * ผู้ใช้ที่ทั้งแอปเห็น — สวม role ที่กำลังดูอยู่ให้ **ที่เดียว** แล้วทุกจุดที่อ่าน
   * `user.role` (เมนู · route guard · ตารางสิทธิ์) เปลี่ยนตามทันที ไม่ต้องไล่แก้ทีละที่
   */
  const setViewAsDepartment = useCallback(
    (code: string | null) => {
      if (realRole !== 'admin') return;
      setViewAsDepartmentState(code);
      try {
        if (code) sessionStorage.setItem(VIEW_AS_DEPT_KEY, code);
        else sessionStorage.removeItem(VIEW_AS_DEPT_KEY);
      } catch {
        /* เขียน sessionStorage ไม่ได้ก็ยังใช้ได้ในแท็บนี้ */
      }
    },
    [realRole],
  );

  const effectiveUser = useMemo<User | null>(() => {
    if (!user) return null;
    if (realRole !== 'admin' || !viewAsRole) return user;
    /**
     * สวม role + แผนกที่เลือกไว้ — **แผนกใส่เฉพาะตอนสวมมุมมอง** ไม่แตะข้อมูลบัญชีจริง
     * ไม่ได้เลือกแผนก = ปล่อยตามบัญชีเดิม (admin มักว่าง = เห็นทุกแผนก)
     */
    return {
      ...user,
      role: viewAsRole,
      ...(viewAsDepartment ? { department_code: viewAsDepartment } : {}),
    };
  }, [user, realRole, viewAsRole, viewAsDepartment]);

  const hasPermission = useCallback(
    (requiredRole: UserRole | UserRole[]) => {
      if (!effectiveUser) return false;
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      const userLevel = ROLE_HIERARCHY[effectiveUser.role];
      return roles.some((role) => userLevel >= ROLE_HIERARCHY[role]);
    },
    [effectiveUser],
  );

  return (
    <AuthContext.Provider
      value={{
        user: effectiveUser,
        realRole,
        viewAsRole: realRole === 'admin' ? viewAsRole : null,
        setViewAsRole,
        viewAsDepartment: realRole === 'admin' ? viewAsDepartment : null,
        setViewAsDepartment,
        signIn,
        signInWithDevRole,
        requestMagicLink,
        signInWithMicrosoft,
        verifyMagicLink,
        signUp,
        setMyDepartment,
        logout,
        hasPermission,
        isAuthenticated: !!effectiveUser,
        bootstrapping,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
