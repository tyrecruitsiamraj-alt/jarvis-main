import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { filterByMinimumRole } from '@/lib/rbac';
import { DOCK_NAV_ITEMS, dockActiveIndex, resolveDockNavTarget, type DockNavItem } from './dockNavConfig';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import './bottomDockNav.css';

type Props = {
  pathname: string;
  className?: string;
  items?: DockNavItem[];
};

const BottomDockNav: React.FC<Props> = ({ pathname, className, items }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFunctionEnabled } = useRolePermissions();
  const navItems = (items ?? filterByMinimumRole(DOCK_NAV_ITEMS, user?.role)).filter(
    (item) => !item.functionId || isFunctionEnabled(item.functionId),
  );
  const activeIndex = dockActiveIndex(pathname, navItems);

  return (
    <nav className={cn('bottom-dock', className)} aria-label="เมนูหลัก">
      <div className="bottom-dock__inner">
        <div className="bottom-dock__track">
          {navItems.map((item, i) => {
            const Icon = item.icon;
            const active = i === activeIndex;
            return (
              <button
                key={item.path}
                type="button"
                className={cn('bottom-dock__btn', active && 'bottom-dock__btn--active')}
                onClick={() => navigate(resolveDockNavTarget(item.path))}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
              >
                <span className="bottom-dock__icon-wrap">
                  <Icon className="h-[22px] w-[22px] shrink-0" strokeWidth={active ? 2.25 : 2} />
                </span>
                <span className="bottom-dock__label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomDockNav;
