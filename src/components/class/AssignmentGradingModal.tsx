import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Download, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatClassActionError, formatDateTimeVi, openPrivateBucketFile } from '@/lib/classStorage';
import { supabase } from '@/lib/supabase';
import type { Assignment, AssignmentKey, Grade, Submission } from '@/types/database';
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
  const [scoreInput, setScoreInput] = useState('');
  const [feedbackInput, setFeedbackInput] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);
  const [autoGrading, setAutoGrading] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);

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
    if (assignment) {
      void loadData();
    }
  }, [assignment, loadData]);

  function openSubmission(sub: Submission) {
    setActiveSubmission(sub);
    const existing = unwrapGrade(sub);
    setScoreInput(
      existing?.score !== null && existing?.score !== undefined ? String(existing.score) : ''
    );
    setFeedbackInput(existing?.feedback ?? '');
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
    if (scoreInput.trim() === '' || Number.isNaN(numScore) || numScore < 0 || numScore > assignment.max_score) {
      toast.error(`Điểm phải nằm trong khoảng từ 0 đến ${assignment.max_score}`);
      return;
    }

    setSavingGrade(true);
    try {
      const { error: gErr } = await supabase.from('grades').upsert(
        {
          submission_id: activeSubmission.id,
          score: numScore,
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

      toast.success(`Đã lưu điểm cho ${activeSubmission.student?.full_name ?? 'sinh viên'}`);
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

  const pendingMcqCount =
    assignment.type === 'multiple_choice'
      ? submissions.filter((s) => s.status === 'pending').length
      : 0;

  return (
    <Modal
      open={Boolean(assignment)}
      onClose={onClose}
      title={`Bài nộp: ${assignment.title}`}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="navy">Đã nộp: {submissions.length}</Badge>
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
        ) : submissions.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Chưa có sinh viên nào nộp bài"
            description="Bài làm của sinh viên sẽ xuất hiện tại đây sau khi nộp."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex max-h-96 flex-col divide-y divide-line overflow-y-auto rounded-xl border border-line">
              {submissions.map((sub) => {
                const g = unwrapGrade(sub);
                const selected = activeSubmission?.id === sub.id;
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => openSubmission(sub)}
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
              {!activeSubmission ? (
                <p className="py-8 text-center text-sm font-normal text-ink-muted">
                  Chọn một sinh viên ở danh sách bên trái để xem bài làm và chấm điểm.
                </p>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-base font-bold text-brand-navy">
                      {activeSubmission.student?.full_name}
                    </p>
                    <p className="text-xs font-normal text-ink-muted">
                      Nộp lúc: {formatDateTimeVi(activeSubmission.submitted_at)}
                    </p>
                  </div>

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
                    <div className="flex flex-col gap-2 rounded-lg bg-surface-card p-4">
                      {typeof activeSubmission.answers?.text === 'string' &&
                        activeSubmission.answers.text && (
                          <p className="whitespace-pre-line text-sm font-normal text-ink-primary">
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
                            <Download className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                            <span>Tải file bài làm</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {canGrade ? (
                    <form onSubmit={handleSaveGrade} className="flex flex-col gap-4 border-t border-line pt-4">
                      <Input
                        label={`Điểm (0 – ${assignment.max_score})`}
                        type="number"
                        step="0.25"
                        min={0}
                        max={assignment.max_score}
                        value={scoreInput}
                        onChange={(e) => setScoreInput(e.target.value)}
                        required
                      />
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
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

