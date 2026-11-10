import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'gold'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'charcoal'
  | 'indigo';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  gold: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  warning: 'bg-amber-50 text-amber-800 border-amber-200/80',
  danger: 'bg-rose-50 text-rose-700 border-rose-200/80',
  neutral: 'bg-slate-50 text-slate-600 border-slate-200/70',
  charcoal: 'bg-slate-900 text-white border-slate-900',
  indigo: 'bg-[#EEF2FF] text-[#5448ED] border-[#C7D2FE]',
};

const dotClasses: Record<BadgeVariant, string> = {
  default: 'bg-slate-500',
  gold: 'bg-[#5448ED]',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  neutral: 'bg-slate-400',
  charcoal: 'bg-emerald-400',
  indigo: 'bg-[#5448ED]',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  className,
  dot = false,
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium rounded-md border tracking-normal whitespace-nowrap',
        variantClasses[variant] || variantClasses.default,
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClasses[variant] || dotClasses.default)} />}
      {children}
    </span>
  );
};

export function getClientStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'Active Client':
      return 'gold';
    case 'Completed':
      return 'success';
    case 'Qualified':
      return 'default';
    case 'Contacted':
      return 'warning';
    case 'Lost':
      return 'danger';
    case 'New':
    default:
      return 'neutral';
  }
}

export function getProjectStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'Completed':
      return 'success';
    case 'In Progress':
      return 'gold';
    case 'Approved':
      return 'charcoal';
    case 'Design':
    case 'Quotation':
    case 'Planning':
      return 'default';
    case 'On Hold':
      return 'warning';
    case 'Cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function getEnquiryStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'Converted':
      return 'success';
    case 'Quotation Sent':
    case 'Site Visit':
      return 'gold';
    case 'Follow-up Required':
      return 'warning';
    case 'Lost':
      return 'danger';
    case 'Contacted':
      return 'default';
    case 'New':
    default:
      return 'neutral';
  }
}
