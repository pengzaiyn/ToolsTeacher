import type { ReactNode } from 'react';

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
}

export function Table<T>({ columns, data, rowKey, caption }: TableProps<T>) {
  return (
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
          {data.map((row, idx) => (
            <tr key={rowKey(row, idx)} className="transition-colors hover:bg-surface-page">
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-4 align-top text-ink-primary ${col.className ?? ''}`}>
                  {col.render(row, idx)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

