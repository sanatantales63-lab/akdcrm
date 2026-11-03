import React from 'react';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  logoUrl?: string;
  collapsed?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  showTagline?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  logoUrl = '/logo.png',
  collapsed = false,
  size = 'md',
  className,
  showTagline = true,
}) => {
  const badgeSizes = {
    sm: 'w-8 h-8 rounded-lg text-xs',
    md: 'w-10 h-10 rounded-xl text-sm',
    lg: 'w-12 h-12 rounded-xl text-base',
  };

  return (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <div
        className={cn(
          'bg-slate-950 border border-slate-800 flex items-center justify-center p-1.5 shrink-0 shadow-xs overflow-hidden',
          badgeSizes[size]
        )}
      >
        <img
          src={logoUrl || '/logo.png'}
          alt="AKD Interior"
          className="w-full h-full object-contain"
          onError={(e) => {
            // Fallback gracefully if logo is missing
            const target = e.currentTarget;
            target.style.display = 'none';
            if (target.parentElement) {
              target.parentElement.innerHTML = '<span class="font-bold text-white text-xs">AKD</span>';
            }
          }}
        />
      </div>

      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-display font-bold tracking-tight text-slate-900 text-[14px]">
              AKD Interior
            </span>
          </div>
          {showTagline && (
            <span className="block text-[10px] font-semibold tracking-wider text-slate-600 uppercase mt-0.5 truncate">
              Studio Management
            </span>
          )}
        </div>
      )}
    </div>
  );
};
