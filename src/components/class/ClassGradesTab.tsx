import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { GradeRow } from '@/types/database';
import { GradeTable } from '@/components/GradeTable';
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

export function ClassGradesTab({ classId }: { classId: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(
          'id, student:profiles!submissions_student_id_fkey(full_name, student_code), assignment:assignments!inner(title, max_score, class_id), grade:grades(id, score, feedback, graded_at, is_ai)'
        )
        .eq('assignment.class_id', classId)
        .returns<SubmissionGradeQueryRow[]>();

      if (error) throw new Error(error.message);

      const mapped: GradeRow[] = [];
      (data ?? []).forEach((item) => {
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

      setRows(mapped);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tải được bảng điểm');
    } finally {
      setLoading(false);
    }
  }, [classId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <LoadingState message="Đang tải bảng điểm..." />;
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink-primary">Bảng điểm lớp học</h2>
      <GradeTable rows={rows} />
    </div>
  );
}

