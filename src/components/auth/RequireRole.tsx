import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { canAccessPath, roleHomePath } from '@/lib/rbac';

/**
 * UX route guard — redirects to the user's role home when path requires a higher role.
 * Security is enforced on the API; never rely on this alone.
 */
const RequireRole: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  if (canAccessPath(user.role, location.pathname)) {
    return <>{children}</>;
  }

  return <Navigate to={roleHomePath(user.role)} replace state={{ from: location.pathname }} />;
};

export default RequireRole;
