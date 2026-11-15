import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CollegeClass, GradeRow } from '@/types/database';
import { GradeTable } from '@/components/GradeTable';
import { Layout } from '@/components/Layout';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface SubmissionGradeQueryRow {
  id: string;
  student: { full_name: string; student_code: string | null } | null;
  assignment: { title: string; max_score: number; class_id: string } | null;
  grade:
    | {
        id: string;
        score: number | null;
        feedback: string | null;
        graded_at: string | null;
        is_ai: boolean;
      }[]
    | null;
}

export function AdminClassDetail() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();

  const [cls, setCls] = useState<CollegeClass | null>(null);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const { data: classData, error: cErr } = await supabase
          .from('classes')
          .select('*, teacher:profiles!classes_teacher_id_fkey(id, full_name, email)')
          .eq('id', id)
          .maybeSingle<CollegeClass>();

        if (cErr) throw new Error(cErr.message);
        if (!active) return;
        setCls(classData ?? null);

        if (!classData) {
          setGrades([]);
          return;
        }

        const { data: subData, error: gErr } = await supabase
          .from('submissions')
          .select(
            'id, student:profiles!submissions_student_id_fkey(full_name, student_code), assignment:assignments!inner(title, max_score, class_id), grade:grades(id, score, feedback, graded_at, is_ai)'
          )
          .eq('assignment.class_id', id)
          .returns<SubmissionGradeQueryRow[]>();

        if (gErr) throw new Error(gErr.message);
        if (!active) return;

        const mapped: GradeRow[] = [];
        (subData ?? []).forEach((item) => {
          const g = Array.isArray(item.grade) ? item.grade[0] : item.grade;
          if (!g) return;
          mapped.push({
            id: g.id,
            submission_id: item.id,
            score: g.score,
            feedback: g.feedback,
            graded_at: g.graded_at,
            is_ai: g.is_ai,
            student_name: item.student?.full_name,
            student_code: item.student?.student_code,
            assignment_title: item.assignment?.title,
            max_score: item.assignment?.max_score,
          });
        });

        setGrades(mapped);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Không tải được chi tiết lớp học');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id, toast]);

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <Link
          to="/admin/classes"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-navy hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Quay lại danh sách lớp</span>
        </Link>

        {loading ? (
          <LoadingState message="Đang tải bảng điểm lớp..." />
        ) : !cls ? (
          <EmptyState
            icon={BookOpen}
            title="Không tìm thấy lớp học"
            description="Lớp học không tồn tại hoặc đã bị xóa."
          />
        ) : (
          <>
            <div className="rounded-xl border border-line bg-surface-card p-6">
              <h1 className="text-2xl font-bold text-brand-navy">{cls.name}</h1>
              <p className="mt-2 text-sm font-normal text-ink-secondary">
                Môn: {cls.subject || '—'} — Giáo viên: {cls.teacher?.full_name || 'Chưa có giáo viên'}
              </p>
            </div>
            <GradeTable rows={grades} />
          </>
        )}
      </div>
    </Layout>
  );
}

