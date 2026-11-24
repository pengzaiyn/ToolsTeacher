import { useEffect, useState, type ReactNode } from 'react';
import { Pagination } from '@/components/ui/Pagination';

export interface TableColumn<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T, index: number) => ReactNode;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  caption?: string;
  pageSize?: number;
  disablePagination?: boolean;
}

export function Table<T>({
  columns,
  data,
  rowKey,
  caption,
  pageSize = 10,
  disablePagination = false,
}: TableProps<T>) {
  const [page, setPage] = useState(1);
  const effectivePageSize = Math.max(1, pageSize);
  const totalPages = disablePagination ? 1 : Math.max(1, Math.ceil(data.length / effectivePageSize));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const startIndex = disablePagination ? 0 : (safePage - 1) * effectivePageSize;
  const visibleRows = disablePagination
    ? data
    : data.slice(startIndex, startIndex + effectivePageSize);

  return (
    <div className="flex flex-col gap-3">
      {!disablePagination && totalPages > 1 && (
        <div className="flex justify-end">
          <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <div className="w-full overflow-x-auto rounded-xl border border-line bg-surface-card">
        <table className="min-w-full border-collapse text-left text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="border-b border-line bg-surface-subtle">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`whitespace-nowrap px-4 py-4 text-xs font-bold uppercase tracking-wide text-ink-secondary ${col.className ?? ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visibleRows.map((row, idx) => {
              const globalIdx = startIndex + idx;
              return (
                <tr
                  key={rowKey(row, globalIdx)}
                  className="transition-colors hover:bg-surface-page"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-4 align-top text-ink-primary ${col.className ?? ''}`}
                    >
                      {col.render(row, globalIdx)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
