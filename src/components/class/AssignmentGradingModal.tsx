import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  CheckCircle2,
  Crown,
  Download,
  ExternalLink,
  SlidersHorizontal,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  findStudentAssignmentGroup,
  resolveStudentScoreFromGrade,
} from '@/lib/assignmentGroups';
import {
  formatClassActionError,
  formatDateTimeVi,
  getPrivateBucketSignedUrl,
  isImageStoragePath,
  openPrivateBucketFile,
} from '@/lib/classStorage';
import { supabase } from '@/lib/supabase';
import type {
  Assignment,
  AssignmentGroup,
  AssignmentKey,
  Grade,
  Submission,
} from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface AssignmentGradingModalProps {
  assignment: Assignment | null;
  canGrade: boolean;
  onClose: () => void;
  onUpdated: () => void | Promise<void>;
}

function unwrapGrade(submission: Submission): Grade | null {
  if (!submission.grade) return null;
  return Array.isArray(submission.grade) ? submission.grade[0] ?? null : submission.grade;
}

export function AssignmentGradingModal({
  assignment,
  canGrade,
  onClose,
  onUpdated,
}: AssignmentGradingModalProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [answerKey, setAnswerKey] = useState<Record<string, number | string> | null>(null);
  const [loading, setLoading] = useState(false);

  const [activeSubmission, setActiveSubmission] = useState<Submission | null>(null);
  const [activeGroup, setActiveGroup] = useState<AssignmentGroup | null>(null);
  const [scoreInput, setScoreInput] = useState('');
  const [customMemberMode, setCustomMemberMode] = useState(false);
  const [memberScoreInputs, setMemberScoreInputs] = useState<Record<string, string>>({});
  const [feedbackInput, setFeedbackInput] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);
  const [autoGrading, setAutoGrading] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!assignment) return;
    setLoading(true);
    try {
      const [{ data: subData, error: sErr }, keyRes] = await Promise.all([
        supabase
          .from('submissions')
          .select(
            '*, student:profiles!submissions_student_id_fkey(id, full_name, email, student_code), grade:grades(*)'
          )
          .eq('assignment_id', assignment.id)
          .order('submitted_at', { ascending: false })
          .returns<Submission[]>(),
        canGrade
          ? supabase
              .from('assignment_keys')
              .select('*')
              .eq('assignment_id', assignment.id)
              .maybeSingle<AssignmentKey>()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (sErr) throw new Error(sErr.message);
      setSubmissions(subData ?? []);
      setAnswerKey(keyRes.data?.answer_key ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tải được danh sách bài nộp');
    } finally {
      setLoading(false);
    }
  }, [assignment, canGrade, toast]);

  useEffect(() => {
    setActiveSubmission(null);
    setActiveGroup(null);
    if (assignment) {
      void loadData();
    }
  }, [assignment, loadData]);

  useEffect(() => {
    let mounted = true;
    const path = activeSubmission?.file_url;
    if (!path || !isImageStoragePath(path)) {
      setActiveImageUrl(null);
      return;
    }
    setActiveImageUrl(null);
    getPrivateBucketSignedUrl('submissions', path, 600)
      .then((url) => {
        if (mounted) setActiveImageUrl(url);
      })
      .catch(() => {
        if (mounted) setActiveImageUrl(null);
      });
    return () => {
      mounted = false;
    };
  }, [activeSubmission?.file_url]);

  function openSubmission(sub: Submission | null, group: AssignmentGroup | null = null) {
    setActiveSubmission(sub);
    const resolvedGroup =
      group ?? (assignment && sub ? findStudentAssignmentGroup(assignment, sub.student_id) : null);
    setActiveGroup(resolvedGroup);

    if (!sub) {
      setScoreInput('');
      setFeedbackInput('');
      setCustomMemberMode(false);
      setMemberScoreInputs({});
      return;
    }

    const existing = unwrapGrade(sub);
    const baseStr =
      existing?.score !== null && existing?.score !== undefined ? String(existing.score) : '';
    setScoreInput(baseStr);
    setFeedbackInput(existing?.feedback ?? '');

    if (resolvedGroup) {
      const nextInputs: Record<string, string> = {};
      let hasDifferentMemberScore = false;
      resolvedGroup.members.forEach((m) => {
        const resolved = resolveStudentScoreFromGrade(existing, m.student_id);
        nextInputs[m.student_id] = resolved !== null ? String(resolved) : baseStr;
        if (
          existing?.score !== null &&
          existing?.score !== undefined &&
          resolved !== null &&
          resolved !== Number(existing.score)
        ) {
          hasDifferentMemberScore = true;
        }
      });
      setMemberScoreInputs(nextInputs);
      setCustomMemberMode(hasDifferentMemberScore);
    } else {
      setMemberScoreInputs({});
      setCustomMemberMode(false);
    }
  }

  function handleLeaderScoreChange(nextVal: string) {
    const prevBase = scoreInput;
    setScoreInput(nextVal);
    if (activeGroup) {
      setMemberScoreInputs((prev) => {
        const copy = { ...prev };
        activeGroup.members.forEach((m) => {
          if (
            !customMemberMode ||
            m.student_id === activeGroup.leader_id ||
            copy[m.student_id] === undefined ||
            copy[m.student_id] === '' ||
            copy[m.student_id] === prevBase
          ) {
            copy[m.student_id] = nextVal;
          }
        });
        return copy;
      });
    }
  }

  function resetAllMembersToLeaderScore() {
    if (!activeGroup) return;
    const synced: Record<string, string> = {};
    activeGroup.members.forEach((m) => {
      synced[m.student_id] = scoreInput;
    });
    setMemberScoreInputs(synced);
  }

  function computeMcqScore(sub: Submission): { score: number; correctCount: number } | null {
    if (!assignment || assignment.type !== 'multiple_choice' || !answerKey) return null;
    const totalPoints = assignment.questions.reduce((sum, q) => sum + (q.points || 1), 0);
    if (totalPoints <= 0) return null;

    let earned = 0;
    let correctCount = 0;
    assignment.questions.forEach((q) => {
      if (sub.answers?.[q.id] === answerKey[q.id]) {
        earned += q.points || 1;
        correctCount += 1;
      }
    });

    const scaled = Math.round(((earned / totalPoints) * assignment.max_score) * 100) / 100;
    return { score: scaled, correctCount };
  }

  async function handleAutoGradeAll() {
    if (!assignment || !user || !answerKey) return;
    const pending = submissions.filter((s) => s.status === 'pending');
    if (pending.length === 0) {
      toast.info('Không có bài nộp nào đang chờ chấm');
      return;
    }

    setAutoGrading(true);
    try {
      const now = new Date().toISOString();
      const gradeRows = pending
        .map((sub) => {
          const calc = computeMcqScore(sub);
          if (!calc) return null;
          return {
            submission_id: sub.id,
            score: calc.score,
            feedback: `Đúng ${calc.correctCount}/${assignment.questions.length} câu trắc nghiệm.`,
            graded_by: user.id,
            is_ai: false,
            graded_at: now,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);

      const { error: gErr } = await supabase
        .from('grades')
        .upsert(gradeRows, { onConflict: 'submission_id' });
      if (gErr) throw new Error(gErr.message);

      const { error: uErr } = await supabase
        .from('submissions')
        .update({ status: 'graded' })
        .in(
          'id',
          pending.map((p) => p.id)
        );
      if (uErr) throw new Error(uErr.message);

      toast.success(`Đã chấm tự động ${gradeRows.length} bài trắc nghiệm`);
      await loadData();
      await onUpdated();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không chấm tự động được'));
    } finally {
      setAutoGrading(false);
    }
  }

  async function handleSaveGrade(event: FormEvent) {
    event.preventDefault();
    if (!assignment || !activeSubmission || !user) return;

    const numScore = Number(scoreInput);
    if (
      scoreInput.trim() === '' ||
      Number.isNaN(numScore) ||
      numScore < 0 ||
      numScore > assignment.max_score
    ) {
      toast.error(`Điểm phải nằm trong khoảng từ 0 đến ${assignment.max_score}`);
      return;
    }

    const memberScoresPayload: Record<string, number> = {};
    if (assignment.work_mode === 'group' && activeGroup) {
      for (const m of activeGroup.members) {
        const raw = customMemberMode
          ? (memberScoreInputs[m.student_id] ?? scoreInput).trim()
          : scoreInput.trim();
        const val = raw === '' ? numScore : Number(raw);
        if (Number.isNaN(val) || val < 0 || val > assignment.max_score) {
          toast.error(
            `Điểm của ${m.full_name} phải nằm trong khoảng từ 0 đến ${assignment.max_score}`
          );
          return;
        }
        memberScoresPayload[m.student_id] = val;
      }
    }

    const finalLeaderScore =
      activeGroup && memberScoresPayload[activeGroup.leader_id] !== undefined
        ? memberScoresPayload[activeGroup.leader_id]
        : numScore;

    setSavingGrade(true);
    try {
      const { error: gErr } = await supabase.from('grades').upsert(
        {
          submission_id: activeSubmission.id,
          score: finalLeaderScore,
          member_scores: memberScoresPayload,
          feedback: feedbackInput.trim() || null,
          graded_by: user.id,
          is_ai: false,
          graded_at: new Date().toISOString(),
        },
        { onConflict: 'submission_id' }
      );
      if (gErr) throw new Error(gErr.message);

      const { error: sErr } = await supabase
        .from('submissions')
        .update({ status: 'graded' })
        .eq('id', activeSubmission.id);
      if (sErr) throw new Error(sErr.message);

      toast.success(
        activeGroup
          ? `Đã lưu điểm cho ${activeGroup.name}`
          : `Đã lưu điểm cho ${activeSubmission.student?.full_name ?? 'sinh viên'}`
      );
      await loadData();
      await onUpdated();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không lưu được điểm'));
    } finally {
      setSavingGrade(false);
    }
  }

  async function handleOpenSubmittedFile(path: string) {
    setOpeningFile(true);
    try {
      await openPrivateBucketFile('submissions', path);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không mở được file bài nộp');
    } finally {
      setOpeningFile(false);
    }
  }

  if (!assignment) return null;

  const isGroupWork =
    assignment.work_mode === 'group' &&
    Array.isArray(assignment.groups) &&
    assignment.groups.length > 0;

  const pendingMcqCount =
    assignment.type === 'multiple_choice'
      ? submissions.filter((s) => s.status === 'pending').length
      : 0;

  return (
    <Modal
      open={Boolean(assignment)}
      onClose={onClose}
      title={`Bài nộp: ${assignment.title}`}
      size="xl"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={assignment.work_mode === 'group' ? 'red' : 'navy'}>
              {assignment.work_mode === 'group' ? 'Làm theo nhóm' : 'Làm cá nhân'}
            </Badge>
            <Badge tone="navy">
              {isGroupWork
                ? `Đã nộp: ${submissions.length}/${assignment.groups!.length} nhóm`
                : `Đã nộp: ${submissions.length}`}
            </Badge>
            <Badge tone="neutral">Điểm tối đa: {assignment.max_score}</Badge>
          </div>
          {canGrade && pendingMcqCount > 0 && answerKey && (
            <Button
              size="sm"
              variant="primary"
              loading={autoGrading}
              onClick={handleAutoGradeAll}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Chấm tự động trắc nghiệm ({pendingMcqCount})</span>
            </Button>
          )}
        </div>

        {canGrade && assignment.type === 'short_answer' && typeof answerKey?.expected === 'string' && (
          <div className="rounded-lg bg-brand-navySoft p-4 text-xs font-normal text-brand-navy">
            Đáp án gợi ý: <strong>{answerKey.expected}</strong>
          </div>
        )}

        {loading ? (
          <LoadingState message="Đang tải danh sách bài nộp..." />
        ) : !isGroupWork && submissions.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Chưa có sinh viên nào nộp bài"
            description="Bài làm của sinh viên sẽ xuất hiện tại đây sau khi nộp."
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
            <div className="flex max-h-[60vh] flex-col divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {isGroupWork
                ? assignment.groups!.map((group) => {
                    const leaderSub =
                      submissions.find((s) => s.student_id === group.leader_id) ?? null;
                    const g = leaderSub ? unwrapGrade(leaderSub) : null;
                    const leaderMember = group.members.find(
                      (m) => m.student_id === group.leader_id
                    );
                    const selected = activeGroup?.id === group.id;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => openSubmission(leaderSub, group)}
                        className={`flex items-center justify-between gap-2 p-4 text-left transition-colors ${
                          selected ? 'bg-brand-navySoft' : 'hover:bg-surface-page'
                        }`}
                      >
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-sm font-bold text-ink-primary">
                            {group.name} ({group.members.length} SV)
                          </span>
                          <span className="truncate text-xs font-normal text-ink-muted">
                            Trưởng nhóm: {leaderMember?.full_name ?? '—'}
                          </span>
                          {leaderSub && (
                            <span className="text-[11px] font-normal text-ink-muted">
                              Nộp lúc: {formatDateTimeVi(leaderSub.submitted_at)}
                            </span>
                          )}
                        </div>
                        {!leaderSub ? (
                          <Badge tone="neutral">Chưa nộp</Badge>
                        ) : leaderSub.status === 'graded' && g ? (
                          <Badge tone="success">
                            {g.score}/{assignment.max_score}
                          </Badge>
                        ) : (
                          <Badge tone="warning">Chờ chấm</Badge>
                        )}
                      </button>
                    );
                  })
                : submissions.map((sub) => {
                    const g = unwrapGrade(sub);
                    const selected = activeSubmission?.id === sub.id;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => openSubmission(sub, null)}
                        className={`flex items-center justify-between gap-2 p-4 text-left transition-colors ${
                          selected ? 'bg-brand-navySoft' : 'hover:bg-surface-page'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-ink-primary">
                            {sub.student?.full_name || '—'}
                          </span>
                          <span className="text-xs font-normal text-ink-muted">
                            {sub.student?.student_code || sub.student?.email} •{' '}
                            {formatDateTimeVi(sub.submitted_at)}
                          </span>
                        </div>
                        {sub.status === 'graded' && g ? (
                          <Badge tone="success">
                            {g.score}/{assignment.max_score}
                          </Badge>
                        ) : (
                          <Badge tone="warning">Chờ chấm</Badge>
                        )}
                      </button>
                    );
                  })}
            </div>

            <div className="rounded-xl border border-line bg-surface-page p-4">
              {!activeSubmission && !activeGroup ? (
                <p className="py-8 text-center text-sm font-normal text-ink-muted">
                  {isGroupWork
                    ? 'Chọn một nhóm ở danh sách bên trái để xem bài nộp và chấm điểm.'
                    : 'Chọn một sinh viên ở danh sách bên trái để xem bài làm và chấm điểm.'}
                </p>
              ) : activeGroup && !activeSubmission ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                    <span className="text-base font-bold text-brand-navy">{activeGroup.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeGroup.members.map((m) => {
                      const isLeader = m.student_id === activeGroup.leader_id;
                      return (
                        <span
                          key={m.student_id}
                          className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ${
                            isLeader
                              ? 'border-amber-400 bg-amber-50 font-bold text-brand-navy'
                              : 'border-line bg-surface-card text-ink-secondary'
                          }`}
                        >
                          {isLeader && <Crown className="h-3 w-3 text-amber-600" aria-hidden="true" />}
                          <span>{m.full_name}</span>
                        </span>
                      );
                    })}
                  </div>
                  <p className="rounded-lg border border-line bg-surface-card p-4 text-xs text-ink-muted">
                    Trưởng nhóm của {activeGroup.name} hiện chưa nộp bài.
                  </p>
                </div>
              ) : activeSubmission ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-base font-bold text-brand-navy">
                      {activeGroup
                        ? `${activeGroup.name} · Trưởng nhóm: ${activeSubmission.student?.full_name ?? ''}`
                        : activeSubmission.student?.full_name}
                    </p>
                    <p className="text-xs font-normal text-ink-muted">
                      Nộp lúc: {formatDateTimeVi(activeSubmission.submitted_at)}
                    </p>
                  </div>

                  {activeGroup && (
                    <div className="flex flex-wrap gap-1.5">
                      {activeGroup.members.map((m) => {
                        const isLeader = m.student_id === activeGroup.leader_id;
                        return (
                          <span
                            key={m.student_id}
                            className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] ${
                              isLeader
                                ? 'border-amber-400 bg-amber-50 font-bold text-brand-navy dark:bg-amber-950/30'
                                : 'border-line bg-surface-card text-ink-secondary'
                            }`}
                          >
                            {isLeader && <Crown className="h-3 w-3 text-amber-600" aria-hidden="true" />}
                            <span>{m.full_name}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {assignment.type === 'multiple_choice' ? (
                    <div className="flex max-h-48 flex-col gap-2 overflow-y-auto">
                      {assignment.questions.map((q, idx) => {
                        const chosen = activeSubmission.answers?.[q.id];
                        const correct = answerKey?.[q.id];
                        const isRight = chosen === correct;
                        return (
                          <div key={q.id} className="rounded-lg bg-surface-card p-2 text-xs">
                            <p className="font-semibold text-ink-primary">
                              Câu {idx + 1}: {q.prompt}
                            </p>
                            <p
                              className={`mt-1 font-semibold ${
                                isRight ? 'text-status-successText' : 'text-brand-red'
                              }`}
                            >
                              Chọn:{' '}
                              {typeof chosen === 'number'
                                ? `${String.fromCharCode(65 + chosen)}. ${q.options[chosen] ?? ''}`
                                : '—'}
                              {typeof correct === 'number' && !isRight
                                ? ` (Đúng: ${String.fromCharCode(65 + correct)})`
                                : ''}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 rounded-lg bg-surface-card p-4">
                      {activeImageUrl && (
                        <div className="overflow-hidden rounded-lg border border-line bg-surface-page p-2">
                          <a
                            href={activeImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={activeImageUrl}
                              alt={`Bài nộp của ${activeSubmission.student?.full_name ?? 'nhóm'}`}
                              className="max-h-[420px] w-full rounded object-contain"
                            />
                          </a>
                        </div>
                      )}
                      {typeof activeSubmission.answers?.text === 'string' &&
                        activeSubmission.answers.text && (
                          <p className="whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm font-normal text-ink-primary">
                            {activeSubmission.answers.text}
                          </p>
                        )}
                      {activeSubmission.file_url && (
                        <div>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={openingFile}
                            onClick={() => handleOpenSubmittedFile(activeSubmission.file_url!)}
                          >
                            {activeImageUrl ? (
                              <ExternalLink className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                            ) : (
                              <Download className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                            )}
                            <span>{activeImageUrl ? 'Mở ảnh kích thước gốc' : 'Tải file bài làm'}</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {canGrade ? (
                    <form onSubmit={handleSaveGrade} className="flex flex-col gap-4 border-t border-line pt-4">
                      <Input
                        label={
                          activeGroup
                            ? `Điểm Trưởng nhóm / Cả nhóm (0 – ${assignment.max_score})`
                            : `Điểm (0 – ${assignment.max_score})`
                        }
                        type="number"
                        step="0.25"
                        min={0}
                        max={assignment.max_score}
                        value={scoreInput}
                        onChange={(e) => handleLeaderScoreChange(e.target.value)}
                        required
                      />

                      {activeGroup && (
                        <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-card p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-ink-primary">
                              {customMemberMode
                                ? 'Đang nhập điểm riêng từng thành viên'
                                : 'Mặc định: Cả nhóm nhận bằng điểm Trưởng nhóm'}
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                if (customMemberMode) {
                                  resetAllMembersToLeaderScore();
                                  setCustomMemberMode(false);
                                } else {
                                  resetAllMembersToLeaderScore();
                                  setCustomMemberMode(true);
                                }
                              }}
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5 text-brand-navy" aria-hidden="true" />
                              <span>
                                {customMemberMode ? 'Dùng chung điểm nhóm' : 'Chấm riêng từng bạn'}
                              </span>
                            </Button>
                          </div>

                          {customMemberMode && (
                            <div className="mt-1 flex flex-col gap-2">
                              {activeGroup.members.map((m) => {
                                const isLeader = m.student_id === activeGroup.leader_id;
                                const val = memberScoreInputs[m.student_id] ?? scoreInput;
                                return (
                                  <div
                                    key={m.student_id}
                                    className="flex items-center justify-between gap-2 rounded border border-line bg-surface-page px-2.5 py-1.5 text-xs"
                                  >
                                    <span className="truncate font-medium text-ink-primary">
                                      {m.full_name}
                                      {isLeader ? ' (Trưởng nhóm)' : ''}
                                    </span>
                                    <input
                                      type="number"
                                      step="0.25"
                                      min={0}
                                      max={assignment.max_score}
                                      value={val}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setMemberScoreInputs((prev) => ({
                                          ...prev,
                                          [m.student_id]: v,
                                        }));
                                        if (isLeader) {
                                          setScoreInput(v);
                                        }
                                      }}
                                      className="h-8 w-20 rounded border border-line-strong bg-surface-card px-2 text-right text-xs font-bold text-brand-navy focus:border-brand-navy focus:outline-none"
                                      required
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col gap-2">
                        <label
                          htmlFor="grade-feedback"
                          className="text-sm font-semibold text-ink-primary"
                        >
                          Nhận xét
                        </label>
                        <textarea
                          id="grade-feedback"
                          rows={2}
                          value={feedbackInput}
                          onChange={(e) => setFeedbackInput(e.target.value)}
                          placeholder="Nhận xét bài làm..."
                          className="w-full rounded-lg border border-line-strong bg-surface-card p-2 text-sm font-normal text-ink-primary focus:border-brand-navy focus:outline-none"
                        />
                      </div>
                      <Button type="submit" variant="navy" loading={savingGrade}>
                        Lưu điểm
                      </Button>
                    </form>
                  ) : (
                    <div className="border-t border-line pt-4 text-sm">
                      {unwrapGrade(activeSubmission) ? (
                        <p className="font-semibold text-brand-navy">
                          Điểm: {unwrapGrade(activeSubmission)?.score} / {assignment.max_score}
                        </p>
                      ) : (
                        <p className="text-ink-muted">Giáo viên chưa chấm bài này.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
