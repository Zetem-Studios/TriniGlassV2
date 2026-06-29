import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: 'cyan' | 'green' | 'amber' | 'red' | 'purple' | 'blue' | 'blue2';
  loading?: boolean;
  trend?: {
    value: number;
    label: string;
  };
}

export function KpiCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = 'cyan', 
  loading = false,
  trend
}: KpiCardProps) {
  const colorStyles = {
    cyan: 'bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400',
    green: 'bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400',
    amber: 'bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400',
    red: 'bg-danger-100 text-danger-600 dark:bg-danger-900/30 dark:text-danger-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    blue2: 'bg-info-100 text-info-600 dark:bg-info-900/30 dark:text-info-400',
  };

  if (loading) {
    return (
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl animate-shimmer">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
          <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        </div>
        <div className="mt-4 h-8 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="mt-2 h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
        {subtitle && <div className="mt-2 h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />}
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm transition-all duration-150 hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className={cn(
                'text-sm font-medium',
                trend.value >= 0 ? 'text-success-600 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'
              )}>
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn(
            'p-3 rounded-xl',
            colorStyles[color]
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}