import { FileCheck2 } from 'lucide-react';
import { formatDateVi } from '@/lib/week';
import type { GradeRow } from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, type TableColumn } from '@/components/ui/Table';

interface GradeTableProps {
  rows: GradeRow[];
}

export function GradeTable({ rows }: GradeTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileCheck2}
        title="Chưa có dữ liệu điểm"
        description="Lớp học này chưa có bài nộp được chấm điểm."
      />
    );
  }

  const columns: TableColumn<GradeRow>[] = [
    {
      key: 'student',
      header: 'Sinh viên',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink-primary">{row.student_name || '—'}</span>
          {row.student_code && (
            <span className="text-xs font-normal text-ink-muted">{row.student_code}</span>
          )}
        </div>
      ),
    },
    {
      key: 'assignment',
      header: 'Bài tập',
      render: (row) => <span className="font-normal">{row.assignment_title || '—'}</span>,
    },
    {
      key: 'score',
      header: 'Điểm',
      render: (row) => (
        <span className="font-bold text-brand-navy">
          {row.score !== null ? `${row.score}${row.max_score ? ` / ${row.max_score}` : ''}` : 'Chưa chấm'}
        </span>
      ),
    },
    {
      key: 'source',
      header: 'Hình thức',
      render: (row) =>
        row.is_ai ? <Badge tone="navy">AI hỗ trợ</Badge> : <Badge tone="neutral">Giáo viên</Badge>,
    },
    {
      key: 'feedback',
      header: 'Nhận xét',
      render: (row) => (
        <span className="text-sm font-normal text-ink-secondary">{row.feedback || '—'}</span>
      ),
    },
    {
      key: 'graded_at',
      header: 'Ngày chấm',
      render: (row) => (
        <span className="whitespace-nowrap text-xs font-normal text-ink-muted">
          {row.graded_at ? formatDateVi(row.graded_at) : '—'}
        </span>
      ),
    },
  ];

  return <Table columns={columns} data={rows} rowKey={(r) => r.id} caption="Bảng điểm lớp học" />;
}

