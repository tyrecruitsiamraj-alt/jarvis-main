import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildDefaultMatrix,
  isFunctionEnabledForRole,
  primaryFunctionForPath,
  type AppFunctionId,
  type RoleFunctionMatrix,
} from '@/lib/roleFunctions';
import { fetchRolePermissions, patchRolePermission } from '@/lib/roleFunctionGrantsApi';
import type { UserRole } from '@/types';
import { meetsMinimumRole, minimumRoleForPath } from '@/lib/rbac';

type RolePermissionsContextValue = {
  matrix: RoleFunctionMatrix;
  loading: boolean;
  isFunctionEnabled: (functionId: AppFunctionId, role?: UserRole) => boolean;
  canAccessPathWithFunctions: (pathname: string, role?: UserRole) => boolean;
  updateGrant: (role: UserRole, functionId: AppFunctionId, enabled: boolean) => Promise<void>;
  savingKey: string | null;
};

const RolePermissionsContext = createContext<RolePermissionsContextValue | null>(null);

export function RolePermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [matrix, setMatrix] = useState<RoleFunctionMatrix>(() => buildDefaultMatrix());
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setMatrix(buildDefaultMatrix());
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchRolePermissions()
      .then((m) => {
        if (!cancelled) setMatrix(m);
      })
      .catch(() => {
        if (!cancelled) setMatrix(buildDefaultMatrix());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

  const isFunctionEnabled = useCallback(
    (functionId: AppFunctionId, role?: UserRole) => {
      const r = role ?? user?.role;
      if (!r) return false;
      return isFunctionEnabledForRole(r, functionId, matrix);
    },
    [matrix, user?.role],
  );

  const canAccessPathWithFunctions = useCallback(
    (pathname: string, role?: UserRole) => {
      const r = role ?? user?.role;
      if (!r) return false;
      if (!meetsMinimumRole(r, minimumRoleForPath(pathname))) return false;
      const fnId = primaryFunctionForPath(pathname);
      if (fnId && !isFunctionEnabledForRole(r, fnId, matrix)) return false;
      return true;
    },
    [matrix, user?.role],
  );

  const updateGrant = useCallback(async (role: UserRole, functionId: AppFunctionId, enabled: boolean) => {
    const key = `${role}:${functionId}`;
    setSavingKey(key);
    try {
      const next = await patchRolePermission(role, functionId, enabled);
      setMatrix(next);
    } finally {
      setSavingKey(null);
    }
  }, []);

  const value = useMemo(
    () => ({
      matrix,
      loading,
      isFunctionEnabled,
      canAccessPathWithFunctions,
      updateGrant,
      savingKey,
    }),
    [matrix, loading, isFunctionEnabled, canAccessPathWithFunctions, updateGrant, savingKey],
  );

  return <RolePermissionsContext.Provider value={value}>{children}</RolePermissionsContext.Provider>;
}

export function useRolePermissions(): RolePermissionsContextValue {
  const ctx = useContext(RolePermissionsContext);
  if (!ctx) {
    return {
      matrix: buildDefaultMatrix(),
      loading: false,
      isFunctionEnabled: (functionId, role) => isFunctionEnabledForRole(role!, functionId),
      canAccessPathWithFunctions: (pathname, role) => {
        if (!role) return false;
        if (!meetsMinimumRole(role, minimumRoleForPath(pathname))) return false;
        const fnId = primaryFunctionForPath(pathname);
        if (fnId && !isFunctionEnabledForRole(role, fnId)) return false;
        return true;
      },
      updateGrant: async () => {},
      savingKey: null,
    };
  }
  return ctx;
}
