import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: ReactNode;
  onRowClick?: (item: T) => void;
  striped?: boolean;
  hoverable?: boolean;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyMessage = 'No hay datos disponibles',
  emptyIcon,
  onRowClick,
  striped = true,
  hoverable = true,
  className,
}: TableProps<T>) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  if (loading) {
    return (
      <div className={cn('table-container', className)}>
        <table className="table w-full" role="grid" aria-busy="true">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={cn('px-4 py-3', alignClasses[col.align || 'left'])} style={{ width: col.width }}>
                  <div className="animate-shimmer h-4 rounded w-3/4" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-3', alignClasses[col.align || 'left'])}>
                    <div className="animate-shimmer h-4 rounded w-3/4" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={cn('table-container', className)}>
      <table className="table w-full" role="grid">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-4 py-3 font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800 uppercase tracking-wider text-xs',
                  alignClasses[col.align || 'left'],
                  col.headerClassName
                )}
                style={{ width: col.width }}
                scope="col"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
          {data.length > 0 ? (
            data.map((item, index) => (
              <tr
                key={keyExtractor(item)}
                className={cn(
                  'transition-colors duration-100',
                  striped && index % 2 === 1 && 'bg-neutral-50 dark:bg-neutral-900/50',
                  hoverable && 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-sm text-neutral-900 dark:text-neutral-100',
                      alignClasses[col.align || 'left'],
                      col.className
                    )}
                  >
                    {col.render ? col.render(item, index) : String((item as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  {emptyIcon && (
                    <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-full text-neutral-400 dark:text-neutral-500">
                      {emptyIcon}
                    </div>
                  )}
                  <p className="font-medium text-neutral-900 dark:text-neutral-100">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}