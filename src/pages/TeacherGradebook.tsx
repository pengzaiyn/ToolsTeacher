import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isAdmin } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { CollegeClass } from '@/types/database';
import { Layout } from '@/components/Layout';
import { ClassGradebookPanel } from '@/components/class/ClassGradebookPanel';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

export function TeacherGradebook() {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedClassId = searchParams.get('classId') ?? '';

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<CollegeClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  const loadClasses = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('*, teacher:profiles!classes_teacher_id_fkey(id, full_name, email)')
        .order('name', { ascending: true })
        .returns<CollegeClass[]>();

      if (error) throw new Error(error.message);
      const list = data ?? [];
      setClasses(list);
      setSelectedClassId((prev) => {
        if (requestedClassId && list.some((c) => c.id === requestedClassId)) {
          return requestedClassId;
        }
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? '';
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tải được danh sách lớp học');
    } finally {
      setLoading(false);
    }
  }, [requestedClassId, toast]);

  useEffect(() => {
    void loadClasses();
  }, [loadClasses]);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? null,
    [classes, selectedClassId]
  );

  const canManage = Boolean(
    isAdmin(profile?.role) ||
      (profile?.role === 'teacher' && user && selectedClass && selectedClass.teacher_id === user.id)
  );

  function handleClassChange(nextId: string) {
    setSelectedClassId(nextId);
    if (nextId) {
      setSearchParams({ classId: nextId }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/teacher/tools"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-navy hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Quay lại Công cụ giảng dạy</span>
          </Link>

          {selectedClass && (
            <Link to={`/classes/${selectedClass.id}`}>
              <Button variant="secondary" size="sm">
                <BookOpen className="h-4 w-4" aria-hidden="true" />
                <span>Mở lớp {selectedClass.name}</span>
              </Button>
            </Link>
          )}
        </div>

        <section className="rounded-2xl border border-line bg-surface-card p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <FileSpreadsheet className="h-6 w-6 text-brand-red" aria-hidden="true" />
                <h1 className="text-2xl font-bold text-brand-navy">Sổ điểm tổng hợp Excel</h1>
                <Badge tone="red">Đợt 2</Badge>
              </div>
              <p className="text-sm font-normal text-ink-secondary">
                Gom điểm chuyên cần và bài tập theo trọng số tùy chỉnh, tự động quy đổi thang 10, xếp loại học lực và xuất sổ điểm Excel hoàn chỉnh.
              </p>
            </div>

            {classes.length > 0 && (
              <div className="w-full lg:w-80">
                <SearchableSelect
                  label="Lớp học"
                  value={selectedClassId}
                  onChange={handleClassChange}
                  searchPlaceholder="Tìm tên lớp, môn học..."
                  options={classes.map((c) => ({
                    value: c.id,
                    label: `${c.name}${c.subject ? ` — ${c.subject}` : ''}`,
                  }))}
                />
              </div>
            )}
          </div>
        </section>

        {loading ? (
          <LoadingState message="Đang tải danh sách lớp..." />
        ) : !selectedClass ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="Chưa có lớp học nào để tổng hợp điểm"
            description={
              isAdmin(profile?.role)
                ? 'Hãy tạo lớp học hoặc đồng bộ lớp từ Thời khóa biểu trước.'
                : 'Bạn chưa được phân công phụ trách lớp học nào. Vui lòng liên hệ Hiệu trưởng để gán giáo viên phụ trách lớp.'
            }
            action={
              <Link to="/classes">
                <Button variant="navy">Đi tới Lớp học</Button>
              </Link>
            }
          />
        ) : (
          <ClassGradebookPanel classItem={selectedClass} canManage={canManage} />
        )}
      </div>
    </Layout>
  );
}

