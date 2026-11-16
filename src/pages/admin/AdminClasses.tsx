import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar } from 'lucide-react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { classKey } from '@/lib/classKey';
import { fetchAllPages, supabase } from '@/lib/supabase';
import { formatDateVi } from '@/lib/week';
import type { CollegeClass, TimetableClassSummary } from '@/types/database';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/Spinner';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

export function AdminClasses() {
  const toast = useToast();
  const [classes, setClasses] = useState<CollegeClass[]>([]);
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());
  const [timetableCounts, setTimetableCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [{ data, error }, enrRows, { data: ttRows }] = await Promise.all([
          supabase
            .from('classes')
            .select('*, teacher:profiles!classes_teacher_id_fkey(id, full_name, email)')
            .order('created_at', { ascending: false })
            .returns<CollegeClass[]>(),
          fetchAllPages<{ class_id: string }>((from, to, withCount) =>
            supabase
              .from('enrollments')
              .select('class_id', withCount ? { count: 'exact' } : undefined)
              .range(from, to)
          ),
          supabase.rpc('timetable_classes'),
        ]);
        if (error) throw new Error(error.message);

        const eMap = new Map<string, number>();
        enrRows.forEach((row) => {
          eMap.set(row.class_id, (eMap.get(row.class_id) ?? 0) + 1);
        });

        setClasses(data ?? []);
        setMemberCounts(eMap);

        const tMap = new Map<string, number>();
        ((ttRows as TimetableClassSummary[] | null) ?? []).forEach((row) => {
          tMap.set(row.class_key, Number(row.entries));
        });
        setTimetableCounts(tMap);
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được danh sách lớp học');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh({
    channelName: 'admin-classes-realtime',
    tables: [{ table: 'classes' }, { table: 'enrollments' }, { table: 'timetable_entries' }],
    onRefresh: () => load(true),
  });

  const columns: TableColumn<CollegeClass>[] = [
    {
      key: 'name',
      header: 'Tên lớp',
      render: (row) => <span className="font-bold text-brand-navy">{row.name}</span>,
    },
    {
      key: 'subject',
      header: 'Môn học / Ngành',
      render: (row) => <span>{row.subject || '—'}</span>,
    },
    {
      key: 'teacher',
      header: 'Giáo viên phụ trách',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold">{row.teacher?.full_name || 'Chưa có giáo viên'}</span>
          {row.teacher?.email && (
            <span className="text-xs text-ink-muted">{row.teacher.email}</span>
          )}
        </div>
      ),
    },
    {
      key: 'stats',
      header: 'Sĩ số / TKB',
      render: (row) => {
        const stuCount = memberCounts.get(row.id) ?? 0;
        const key = row.class_key || classKey(row.name);
        const ttCount = timetableCounts.get(key) ?? 0;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="navy">{stuCount} SV</Badge>
            {ttCount > 0 && <Badge tone="success">{ttCount} buổi TKB</Badge>}
          </div>
        );
      },
    },
    {
      key: 'created_at',
      header: 'Ngày tạo',
      render: (row) => <span className="text-xs text-ink-muted">{formatDateVi(row.created_at)}</span>,
    },
    {
      key: 'detail',
      header: 'Thao tác',
      render: (row) => {
        const key = row.class_key || classKey(row.name);
        const ttCount = timetableCounts.get(key) ?? 0;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/classes/${row.id}`}>
              <Button size="sm" variant="navy">
                Vào lớp
              </Button>
            </Link>
            {ttCount > 0 && (
              <Link to={`/timetable?class=${encodeURIComponent(key)}`}>
                <Button size="sm" variant="secondary">
                  <Calendar className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                  <span>TKB</span>
                </Button>
              </Link>
            )}
            <Link to={`/admin/classes/${row.id}`}>
              <Button size="sm" variant="secondary">
                Bảng điểm
              </Button>
            </Link>
          </div>
        );
      },
    },
  ];

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Danh sách lớp học</h1>
            <p className="text-sm font-normal text-ink-secondary">
              Theo dõi các lớp học phần và bảng điểm toàn trường
            </p>
          </div>
          <Link to="/classes">
            <Button variant="primary">Quản lý lớp học</Button>
          </Link>
        </div>

        {loading ? (
          <LoadingState message="Đang tải danh sách lớp..." />
        ) : classes.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Chưa có lớp học nào"
            description="Vào trang Lớp học để tạo lớp mới và phân công giáo viên phụ trách."
          />
        ) : (
          <Table
            columns={columns}
            data={classes}
            rowKey={(row) => row.id}
            caption="Danh sách lớp học"
          />
        )}
      </div>
    </Layout>
  );
}

