import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DOCK_NAV_ITEMS, dockActiveIndex } from './dockNavConfig';
import './bottomDockNav.css';

type Props = {
  pathname: string;
  className?: string;
};

const BottomDockNav: React.FC<Props> = ({ pathname, className }) => {
  const navigate = useNavigate();
  const activeIndex = dockActiveIndex(pathname);

  return (
    <nav className={cn('bottom-dock', className)} aria-label="เมนูหลัก">
      <div className="bottom-dock__inner">
        <div className="bottom-dock__track">
          {DOCK_NAV_ITEMS.map((item, i) => {
            const Icon = item.icon;
            const active = i === activeIndex;
            return (
              <button
                key={item.path}
                type="button"
                className={cn('bottom-dock__btn', active && 'bottom-dock__btn--active')}
                onClick={() => navigate(item.path)}
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
