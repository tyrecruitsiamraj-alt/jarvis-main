import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { DOCK_NAV_ITEMS, dockActiveIndex } from './dockNavConfig';
import { useDockKnob } from './useDockKnob';
import './bottomDockNav.css';

type Props = {
  pathname: string;
  className?: string;
};

const BottomDockNav: React.FC<Props> = ({ pathname, className }) => {
  const navigate = useNavigate();
  const activeIndex = dockActiveIndex(pathname);
  const { trackRef, setItemRef, knob } = useDockKnob(activeIndex, DOCK_NAV_ITEMS.length);

  return (
    <nav className={cn('bottom-dock', className)} aria-label="เมนูหลัก">
      <div className="bottom-dock__inner">
        <div ref={trackRef} className="bottom-dock__track">
          <div
            className="bottom-dock__knob"
            style={{
              width: knob.width,
              transform: `translate3d(${knob.left}px, 0, 0)`,
            }}
            aria-hidden
          />
          {DOCK_NAV_ITEMS.map((item, i) => {
            const Icon = item.icon;
            const active = i === activeIndex;
            return (
              <button
                key={item.path}
                ref={(el) => setItemRef(i, el)}
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
