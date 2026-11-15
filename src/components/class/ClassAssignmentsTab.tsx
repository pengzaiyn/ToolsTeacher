import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Eye, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { formatClassActionError, formatDateTimeVi } from '@/lib/classStorage';
import { supabase } from '@/lib/supabase';
import type { Assignment, AssignmentType, Grade, Submission } from '@/types/database';
import { AssignmentCreateModal } from '@/components/class/AssignmentCreateModal';
import { AssignmentGradingModal } from '@/components/class/AssignmentGradingModal';
import { AssignmentStudentModal } from '@/components/class/AssignmentStudentModal';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface ClassAssignmentsTabProps {
  classId: string;
  canManage: boolean;
  isStudentView: boolean;
}

const TYPE_BADGE: Record<AssignmentType, { label: string; tone: BadgeTone }> = {
  multiple_choice: { label: 'Trắc nghiệm', tone: 'navy' },
  essay: { label: 'Tự luận', tone: 'neutral' },
  short_answer: { label: 'Trả lời ngắn', tone: 'neutral' },
  file_upload: { label: 'Nộp file', tone: 'red' },
};

export function ClassAssignmentsTab({
  classId,
  canManage,
  isStudentView,
}: ClassAssignmentsTabProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Map<string, Submission>>(new Map());
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [studentTarget, setStudentTarget] = useState<Assignment | null>(null);
  const [gradingTarget, setGradingTarget] = useState<Assignment | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Assignment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data: assignData, error: aErr } = await supabase
          .from('assignments')
          .select('*')
          .eq('class_id', classId)
          .order('created_at', { ascending: false })
          .returns<Assignment[]>();
        if (aErr) throw new Error(aErr.message);

        const list = assignData ?? [];
        setAssignments(list);

        if (isStudentView && user && list.length > 0) {
          const { data: subData, error: sErr } = await supabase
            .from('submissions')
            .select('*, grade:grades(*)')
            .eq('student_id', user.id)
            .in(
              'assignment_id',
              list.map((a) => a.id)
            )
            .returns<Submission[]>();

          if (sErr) throw new Error(sErr.message);
          const map = new Map<string, Submission>();
          (subData ?? []).forEach((s) => map.set(s.assignment_id, s));
          setMySubmissions(map);
        } else {
          setMySubmissions(new Map());
        }
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được danh sách bài tập');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [classId, isStudentView, user, toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh({
    channelName: `class-assignments-${classId}`,
    tables: [
      { table: 'assignments', filter: `class_id=eq.${classId}` },
      { table: 'submissions' },
      { table: 'grades' },
    ],
    onRefresh: () => load(true),
  });

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw new Error(error.message);
      toast.success('Đã xóa bài tập');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không xóa được bài tập'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-ink-primary">Bài tập & Kiểm tra</h2>
        {canManage && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Giao bài tập</span>
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState message="Đang tải bài tập..." />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Chưa có bài tập nào"
          description={
            canManage
              ? 'Giao bài tập trắc nghiệm, tự luận hoặc nộp file cho sinh viên trong lớp.'
              : 'Lớp học chưa có bài tập nào.'
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {assignments.map((item) => {
            const typeMeta = TYPE_BADGE[item.type];
            const mySub = mySubmissions.get(item.id) ?? null;
            const myGrade: Grade | null = mySub?.grade
              ? Array.isArray(mySub.grade)
                ? mySub.grade[0] ?? null
                : mySub.grade
              : null;

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-card p-6 sm:flex-row sm:items-center"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-ink-primary">{item.title}</h3>
                    <Badge tone={typeMeta.tone}>{typeMeta.label}</Badge>
                    <Badge tone="neutral">Tối đa: {item.max_score}đ</Badge>
                    {isStudentView && (
                      mySub ? (
                        mySub.status === 'graded' && myGrade ? (
                          <Badge tone="success">
                            Điểm: {myGrade.score}/{item.max_score}
                          </Badge>
                        ) : (
                          <Badge tone="warning">Đã nộp — Chờ chấm</Badge>
                        )
                      ) : (
                        <Badge tone="neutral">Chưa nộp</Badge>
                      )
                    )}
                  </div>
                  {item.description && (
                    <p className="line-clamp-2 text-sm font-normal text-ink-secondary">
                      {item.description}
                    </p>
                  )}
                  <p className="text-xs font-normal text-ink-muted">
                    Hạn nộp: {formatDateTimeVi(item.due_date)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isStudentView ? (
                    <Button
                      size="sm"
                      variant={mySub ? 'secondary' : 'primary'}
                      onClick={() => setStudentTarget(item)}
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                      <span>{mySub ? 'Xem bài làm' : 'Làm / Nộp bài'}</span>
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="navy"
                        onClick={() => setGradingTarget(item)}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        <span>{canManage ? 'Bài nộp & Chấm điểm' : 'Xem bài nộp'}</span>
                      </Button>
                      {canManage && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setDeleteTarget(item)}
                        >
                          <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                          <span>Xóa</span>
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AssignmentCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        classId={classId}
        onCreated={load}
      />

      <AssignmentStudentModal
        assignment={studentTarget}
        submission={studentTarget ? mySubmissions.get(studentTarget.id) ?? null : null}
        onClose={() => setStudentTarget(null)}
        onSubmitted={load}
      />

      <AssignmentGradingModal
        assignment={gradingTarget}
        canGrade={canManage}
        onClose={() => setGradingTarget(null)}
        onUpdated={load}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        confirmLabel="Xóa bài tập"
        title="Xác nhận xóa bài tập"
        message={`Bạn chắc chắn muốn xóa bài tập "${deleteTarget?.title ?? ''}"? Tất cả bài nộp và điểm của bài tập này sẽ bị xóa theo.`}
      />
    </div>
  );
}

