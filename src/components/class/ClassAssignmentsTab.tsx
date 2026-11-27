import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Crown, Eye, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import {
  findStudentAssignmentGroup,
  resolveStudentEffectiveSubmission,
  resolveStudentScoreFromGrade,
} from '@/lib/assignmentGroups';
import { formatClassActionError, formatDateTimeVi } from '@/lib/classStorage';
import { isAssignmentPastDue } from '@/lib/submissionDeadline';
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

const LEGACY_TYPE_BADGE: Partial<Record<AssignmentType, { label: string; tone: BadgeTone }>> = {
  multiple_choice: { label: 'Trắc nghiệm', tone: 'navy' },
  essay: { label: 'Tự luận', tone: 'neutral' },
  short_answer: { label: 'Trả lời ngắn', tone: 'neutral' },
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
            .select(
              '*, student:profiles!submissions_student_id_fkey(id, full_name, email, student_code), grade:grades(*)'
            )
            .in(
              'assignment_id',
              list.map((a) => a.id)
            )
            .returns<Submission[]>();

          if (sErr) throw new Error(sErr.message);
          const allSubs = subData ?? [];
          const map = new Map<string, Submission>();
          list.forEach((assign) => {
            const effective = resolveStudentEffectiveSubmission(assign, user.id, allSubs);
            if (effective) {
              map.set(assign.id, effective);
            }
          });
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
              ? 'Giao bài tập cá nhân hoặc bài tập nhóm cho sinh viên trong lớp.'
              : 'Lớp học chưa có bài tập nào.'
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {assignments.map((item) => {
            const legacyMeta = LEGACY_TYPE_BADGE[item.type];
            const isGroupWork = item.work_mode === 'group';
            const myGroup =
              isStudentView && isGroupWork ? findStudentAssignmentGroup(item, user?.id) : null;
            const isLeader = Boolean(myGroup && user?.id && myGroup.leader_id === user.id);
            const mySub = mySubmissions.get(item.id) ?? null;
            const pastDue = isAssignmentPastDue(item.due_date);
            const myGrade: Grade | null = mySub?.grade
              ? Array.isArray(mySub.grade)
                ? mySub.grade[0] ?? null
                : mySub.grade
              : null;
            const resolvedScore = resolveStudentScoreFromGrade(myGrade, user?.id);

            let studentBtnLabel = 'Làm / Nộp bài';
            if (isGroupWork) {
              if (isLeader) {
                studentBtnLabel = mySub
                  ? pastDue
                    ? 'Xem bài nhóm'
                    : 'Xem / Sửa bài nhóm'
                  : pastDue
                    ? 'Đã hết hạn nộp'
                    : 'Nộp bài nhóm';
              } else {
                studentBtnLabel = 'Xem bài nhóm';
              }
            } else {
              studentBtnLabel = mySub
                ? pastDue
                  ? 'Xem bài làm'
                  : 'Xem / Sửa bài nộp'
                : pastDue
                  ? 'Đã hết hạn nộp'
                  : 'Làm / Nộp bài';
            }

            return (
              <article
                key={item.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-card p-6 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words text-base font-bold text-ink-primary">{item.title}</h3>
                    <Badge tone={isGroupWork ? 'red' : 'navy'}>
                      {isGroupWork ? 'Làm theo nhóm' : 'Làm cá nhân'}
                    </Badge>
                    {!isStudentView && isGroupWork && Array.isArray(item.groups) && item.groups.length > 0 && (
                      <Badge tone="neutral">{item.groups.length} nhóm</Badge>
                    )}
                    {isStudentView && myGroup && (
                      <Badge tone={isLeader ? 'navy' : 'neutral'}>
                        {isLeader ? `${myGroup.name} · Trưởng nhóm` : `${myGroup.name} · Thành viên`}
                      </Badge>
                    )}
                    {legacyMeta && <Badge tone={legacyMeta.tone}>{legacyMeta.label}</Badge>}
                    <Badge tone="neutral">Tối đa: {item.max_score}đ</Badge>
                    {pastDue && <Badge tone="red">Đã hết hạn</Badge>}
                    {isStudentView && (
                      mySub ? (
                        mySub.status === 'graded' && resolvedScore !== null ? (
                          <Badge tone="success">
                            Điểm: {resolvedScore}/{item.max_score}
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
                    <p className="line-clamp-2 break-words [overflow-wrap:anywhere] text-sm font-normal text-ink-secondary">
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
                      variant={
                        mySub || pastDue || (isGroupWork && !isLeader) ? 'secondary' : 'primary'
                      }
                      onClick={() => setStudentTarget(item)}
                    >
                      {isGroupWork && isLeader && !mySub && !pastDue ? (
                        <Crown className="h-4 w-4" aria-hidden="true" />
                      ) : isGroupWork && !isLeader ? (
                        <Users className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span>{studentBtnLabel}</span>
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
