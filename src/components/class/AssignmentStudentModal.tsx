import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Crown,
  Download,
  ExternalLink,
  Lock,
  Pencil,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  findStudentAssignmentGroup,
  isStudentAllowedToSubmitAssignment,
  resolveStudentScoreFromGrade,
} from '@/lib/assignmentGroups';
import {
  MAX_SUBMISSION_BYTES,
  formatClassActionError,
  formatDateTimeVi,
  getPrivateBucketSignedUrl,
  isImageFile,
  isImageStoragePath,
  openPrivateBucketFile,
  sanitizeStorageFileName,
} from '@/lib/classStorage';
import { canStudentModifySubmission } from '@/lib/submissionDeadline';
import { supabase } from '@/lib/supabase';
import type { Assignment, Grade, Submission } from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

interface AssignmentStudentModalProps {
  assignment: Assignment | null;
  submission: Submission | null;
  onClose: () => void;
  onSubmitted: () => void | Promise<void>;
}

function extractExistingMcqAnswers(submission: Submission | null): Record<string, number> {
  if (!submission?.answers) return {};
  const next: Record<string, number> = {};
  Object.entries(submission.answers).forEach(([key, val]) => {
    if (typeof val === 'number') {
      next[key] = val;
    }
  });
  return next;
}

function extractExistingTextAnswer(submission: Submission | null): string {
  if (!submission?.answers) return '';
  return typeof submission.answers.text === 'string' ? submission.answers.text : '';
}

export function AssignmentStudentModal({
  assignment,
  submission,
  onClose,
  onSubmitted,
}: AssignmentStudentModalProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [submittedPreviewUrl, setSubmittedPreviewUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!assignment) return;
    setNowMs(Date.now());
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 15000);
    return () => window.clearInterval(timer);
  }, [assignment]);

  useEffect(() => {
    setMcqAnswers({});
    setTextAnswer('');
    setSelectedFile(null);
    setIsEditing(false);
    setConfirmOpen(false);
    setCancelConfirmOpen(false);
  }, [assignment?.id]);

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setLocalPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  useEffect(() => {
    let active = true;
    const fileUrl = submission?.file_url;
    if (!fileUrl || !isImageStoragePath(fileUrl)) {
      setSubmittedPreviewUrl(null);
      return;
    }
    getPrivateBucketSignedUrl('submissions', fileUrl, 600)
      .then((url) => {
        if (active) setSubmittedPreviewUrl(url);
      })
      .catch(() => {
        if (active) setSubmittedPreviewUrl(null);
      });
    return () => {
      active = false;
    };
  }, [submission?.file_url]);

  if (!assignment) return null;

  const isDeadlineOpen = canStudentModifySubmission(assignment.due_date, nowMs);
  const isGroupWork = assignment.work_mode === 'group';
  const myGroup = isGroupWork ? findStudentAssignmentGroup(assignment, user?.id) : null;
  const isAllowedToSubmit = isStudentAllowedToSubmitAssignment(assignment, user?.id);
  const canModify = isDeadlineOpen && isAllowedToSubmit;
  const groupLeaderMember =
    myGroup?.members.find((m) => m.student_id === myGroup.leader_id) ?? null;

  const grade: Grade | null = submission?.grade
    ? Array.isArray(submission.grade)
      ? submission.grade[0] ?? null
      : submission.grade
    : null;
  const myResolvedScore = resolveStudentScoreFromGrade(grade, user?.id);

  function startEditing() {
    if (!submission || !canModify) return;
    setMcqAnswers(extractExistingMcqAnswers(submission));
    setTextAnswer(extractExistingTextAnswer(submission));
    setSelectedFile(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setSelectedFile(null);
    setIsEditing(false);
  }

  function validateBeforeSubmit(): boolean {
    if (!assignment) return false;
    if (!isStudentAllowedToSubmitAssignment(assignment, user?.id)) {
      toast.error('Chỉ Trưởng nhóm mới đại diện nộp bài cho nhóm');
      return false;
    }
    if (!canStudentModifySubmission(assignment.due_date)) {
      toast.error('Đã hết thời gian nộp bài do giảng viên cài đặt');
      return false;
    }
    if (assignment.type === 'multiple_choice') {
      const unanswered = assignment.questions.some((q) => mcqAnswers[q.id] === undefined);
      if (unanswered) {
        toast.error('Vui lòng chọn đáp án cho tất cả câu hỏi trước khi nộp');
        return false;
      }
      return true;
    }
    if (assignment.type === 'file_upload') {
      const hasExistingFile = Boolean(submission?.file_url);
      if (!selectedFile && !hasExistingFile) {
        toast.error('Vui lòng tải lên ảnh bài làm để nộp');
        return false;
      }
      return true;
    }
    if (!textAnswer.trim()) {
      toast.error('Vui lòng nhập nội dung bài làm');
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!user || !assignment) return;
    if (!isStudentAllowedToSubmitAssignment(assignment, user.id)) {
      toast.error('Chỉ Trưởng nhóm mới có quyền nộp bài tập nhóm');
      setConfirmOpen(false);
      return;
    }
    if (!canStudentModifySubmission(assignment.due_date)) {
      toast.error('Đã hết thời gian nộp bài, không thể nộp hoặc chỉnh sửa nữa');
      setConfirmOpen(false);
      return;
    }

    setSubmitting(true);
    let uploadedNewPath: string | null = null;
    try {
      let filePath: string | null = submission?.file_url ?? null;
      let answersPayload: Record<string, number | string> = {};

      if (assignment.type === 'multiple_choice') {
        answersPayload = mcqAnswers;
      } else if (assignment.type === 'file_upload') {
        if (selectedFile) {
          const path = `${assignment.class_id}/${user.id}/${Date.now()}_${sanitizeStorageFileName(
            selectedFile.name
          )}`;
          const { error: upErr } = await supabase.storage
            .from('submissions')
            .upload(path, selectedFile, { upsert: false });
          if (upErr) throw new Error(upErr.message);
          uploadedNewPath = path;
          filePath = path;
        } else if (!filePath) {
          throw new Error('Thiếu ảnh bài nộp');
        }
        if (textAnswer.trim()) {
          answersPayload = { text: textAnswer.trim() };
        }
      } else {
        answersPayload = { text: textAnswer.trim() };
      }

      if (submission) {
        const previousFilePath = submission.file_url;
        const { error: updErr } = await supabase
          .from('submissions')
          .update({
            answers: answersPayload,
            file_url: filePath,
            status: 'pending',
            submitted_at: new Date().toISOString(),
          })
          .eq('id', submission.id)
          .eq('student_id', user.id);

        if (updErr) throw new Error(updErr.message);

        if (uploadedNewPath && previousFilePath && previousFilePath !== uploadedNewPath) {
          await supabase.storage.from('submissions').remove([previousFilePath]);
        }

        toast.success('Đã cập nhật và nộp lại bài thành công');
      } else {
        const { error: subErr } = await supabase.from('submissions').insert({
          assignment_id: assignment.id,
          student_id: user.id,
          answers: answersPayload,
          file_url: filePath,
          status: 'pending',
        });

        if (subErr) throw new Error(subErr.message);
        toast.success('Đã nộp bài thành công');
      }

      setConfirmOpen(false);
      setIsEditing(false);
      onClose();
      await onSubmitted();
    } catch (err) {
      if (uploadedNewPath) {
        await supabase.storage.from('submissions').remove([uploadedNewPath]);
      }
      toast.error(formatClassActionError(err, 'Không nộp được bài'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelSubmission() {
    if (!user || !assignment || !submission) return;
    if (!isStudentAllowedToSubmitAssignment(assignment, user.id)) {
      toast.error('Chỉ Trưởng nhóm mới có quyền hủy bài nộp của nhóm');
      setCancelConfirmOpen(false);
      return;
    }
    if (!canStudentModifySubmission(assignment.due_date)) {
      toast.error('Đã hết thời gian nộp bài, bạn không thể hủy hoặc xóa bài nộp');
      setCancelConfirmOpen(false);
      return;
    }

    setCanceling(true);
    try {
      const oldFilePath = submission.file_url;
      const { error: delErr } = await supabase
        .from('submissions')
        .delete()
        .eq('id', submission.id)
        .eq('student_id', user.id);

      if (delErr) throw new Error(delErr.message);

      if (oldFilePath && !/^https?:\/\//i.test(oldFilePath)) {
        await supabase.storage.from('submissions').remove([oldFilePath]);
      }

      toast.success('Đã hủy bài nộp');
      setCancelConfirmOpen(false);
      setIsEditing(false);
      onClose();
      await onSubmitted();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không hủy được bài nộp'));
    } finally {
      setCanceling(false);
    }
  }

  async function handleDownloadOwnFile() {
    if (!submission?.file_url) return;
    setOpeningFile(true);
    try {
      await openPrivateBucketFile('submissions', submission.file_url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không mở được ảnh đã nộp');
    } finally {
      setOpeningFile(false);
    }
  }

  const showSubmissionForm = isAllowedToSubmit && (!submission || isEditing);
  const existingFileName = submission?.file_url
    ? submission.file_url.split('/').pop() ?? submission.file_url
    : null;

  return (
    <>
      <Modal
        open={Boolean(assignment)}
        onClose={() => {
          if (!submitting && !canceling) onClose();
        }}
        title={assignment.title}
        size="lg"
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-page p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={isGroupWork ? 'red' : 'navy'}>
                {isGroupWork ? 'Làm theo nhóm' : 'Làm cá nhân'}
              </Badge>
              <Badge tone="navy">Điểm tối đa: {assignment.max_score}</Badge>
              <Badge tone={isDeadlineOpen ? 'neutral' : 'red'}>
                Hạn nộp: {formatDateTimeVi(assignment.due_date)}
              </Badge>
              {!isDeadlineOpen && <Badge tone="red">Đã hết hạn</Badge>}
            </div>
            {submission && (
              <Badge tone={submission.status === 'graded' ? 'success' : 'warning'}>
                {submission.status === 'graded' ? 'Đã chấm điểm' : 'Đã nộp — Chờ chấm'}
              </Badge>
            )}
          </div>

          {isGroupWork && (
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-page p-4">
              {myGroup ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                      <span className="text-sm font-bold text-brand-navy">{myGroup.name}</span>
                    </div>
                    <Badge tone={isAllowedToSubmit ? 'navy' : 'neutral'}>
                      {isAllowedToSubmit ? 'Bạn là Trưởng nhóm (Đại diện nộp bài)' : 'Bạn là Thành viên (Không phải nộp riêng)'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {myGroup.members.map((m) => {
                      const leader = m.student_id === myGroup.leader_id;
                      const isMe = m.student_id === user?.id;
                      return (
                        <span
                          key={m.student_id}
                          className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs ${
                            leader
                              ? 'border-amber-400 bg-amber-50 font-bold text-brand-navy dark:bg-amber-950/30'
                              : isMe
                                ? 'border-brand-navy/30 bg-brand-navySoft font-semibold text-brand-navy'
                                : 'border-line bg-surface-card text-ink-secondary'
                          }`}
                        >
                          {leader && <Crown className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />}
                          <span>{m.full_name}</span>
                          {leader && <span className="text-[10px] text-amber-800">(Trưởng nhóm)</span>}
                        </span>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-xs font-normal text-brand-red">
                  Tài khoản của bạn hiện chưa nằm trong danh sách phân nhóm của bài tập này. Vui lòng báo lại cho giảng viên.
                </p>
              )}
            </div>
          )}

          {assignment.description && (
            <div className="min-w-0 rounded-lg border border-line p-4">
              <p className="mb-2 text-xs font-bold uppercase text-ink-muted">Đề bài</p>
              <p className="whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm font-normal text-ink-primary">
                {assignment.description}
              </p>
            </div>
          )}

          {/* Trường hợp Thành viên nhóm (không phải Trưởng nhóm) và nhóm chưa nộp bài */}
          {isGroupWork && !isAllowedToSubmit && !submission ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-xl border border-line bg-brand-navySoft p-4 text-sm font-normal text-brand-navy">
                <Users className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-bold">
                    Trưởng nhóm {groupLeaderMember?.full_name ? `(${groupLeaderMember.full_name})` : ''} sẽ đại diện nộp bài
                  </p>
                  <p className="mt-1 text-xs">
                    Các thành viên trong nhóm không cần nộp bài riêng. Ngay khi Trưởng nhóm tải ảnh bài làm lên, bạn có thể xem bài nộp và điểm số của nhóm tại đây.
                  </p>
                </div>
              </div>
              <div className="flex justify-end border-t border-line pt-4">
                <Button variant="secondary" onClick={onClose}>
                  Đóng
                </Button>
              </div>
            </div>
          ) : !showSubmissionForm && submission ? (
            <div className="flex flex-col gap-4">
              {submission.status === 'graded' && grade && (
                <div className="flex flex-col gap-2 rounded-xl border border-status-successBorder bg-status-successBg p-4 text-status-successText">
                  <div className="flex items-center gap-2 text-base font-bold">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    <span>
                      Điểm của bạn: {myResolvedScore ?? '—'} / {assignment.max_score}
                    </span>
                  </div>
                  {grade.feedback && (
                    <p className="text-sm font-normal">Nhận xét: {grade.feedback}</p>
                  )}
                </div>
              )}

              {isAllowedToSubmit ? (
                isDeadlineOpen ? (
                  <div className="flex items-center gap-2 rounded-lg border border-line bg-brand-navySoft p-4 text-xs font-normal text-brand-navy">
                    <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      Còn trong thời gian nộp bài — bạn vẫn có thể chỉnh sửa nộp lại hoặc hủy bài đã nộp.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-status-dangerBorder bg-status-dangerBg p-4 text-xs font-normal text-status-dangerText">
                    <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>
                      Đã hết thời gian nộp bài — không thể chỉnh sửa hoặc hủy bài nộp.
                    </span>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-page p-3 text-xs font-normal text-ink-secondary">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-navy" aria-hidden="true" />
                  <span>
                    Bài tập nhóm đã được Trưởng nhóm {groupLeaderMember?.full_name ?? ''} nộp đại diện cho cả nhóm.
                  </span>
                </div>
              )}

              <div className="rounded-xl border border-line bg-surface-page p-4">
                <p className="mb-2 text-xs font-bold uppercase text-ink-muted">
                  {isGroupWork
                    ? `Bài nhóm nộp lúc ${formatDateTimeVi(submission.submitted_at)}`
                    : `Bài bạn đã nộp lúc ${formatDateTimeVi(submission.submitted_at)}`}
                </p>

                {assignment.type === 'multiple_choice' ? (
                  <div className="flex flex-col gap-2">
                    {assignment.questions.map((q, idx) => {
                      const chosen = submission.answers?.[q.id];
                      const chosenIdx = typeof chosen === 'number' ? chosen : -1;
                      return (
                        <div key={q.id} className="rounded-lg bg-surface-card p-4">
                          <p className="text-sm font-semibold text-ink-primary">
                            Câu {idx + 1}: {q.prompt}
                          </p>
                          <p className="mt-2 text-xs font-normal text-brand-navy">
                            Đã chọn:{' '}
                            {chosenIdx >= 0 && q.options[chosenIdx]
                              ? `${String.fromCharCode(65 + chosenIdx)}. ${q.options[chosenIdx]}`
                              : 'Chưa chọn'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {submittedPreviewUrl && (
                      <div className="overflow-hidden rounded-lg border border-line bg-surface-card p-2">
                        <a
                          href={submittedPreviewUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={submittedPreviewUrl}
                            alt="Ảnh bài nộp"
                            className="max-h-80 w-full rounded object-contain"
                          />
                        </a>
                      </div>
                    )}
                    {typeof submission.answers?.text === 'string' && submission.answers.text && (
                      <p className="whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm font-normal text-ink-primary">
                        {submission.answers.text}
                      </p>
                    )}
                    {submission.file_url && (
                      <div>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={openingFile}
                          onClick={handleDownloadOwnFile}
                        >
                          {submittedPreviewUrl ? (
                            <ExternalLink className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                          ) : (
                            <Download className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                          )}
                          <span>{submittedPreviewUrl ? 'Mở ảnh kích thước gốc' : 'Tải lại file đã nộp'}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                {canModify ? (
                  <Button
                    variant="secondary"
                    onClick={() => setCancelConfirmOpen(true)}
                    disabled={canceling}
                  >
                    <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                    <span>Hủy bài nộp</span>
                  </Button>
                ) : (
                  <div />
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" onClick={onClose}>
                    Đóng
                  </Button>
                  {canModify && (
                    <Button variant="primary" onClick={startEditing}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span>Chỉnh sửa & Nộp lại</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : !isDeadlineOpen ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 rounded-xl border border-status-dangerBorder bg-status-dangerBg p-4 text-sm font-normal text-status-dangerText">
                <Lock className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>
                  Đã hết thời gian nộp bài mà giảng viên cài đặt. Bạn không thể nộp bài mới.
                </span>
              </div>
              <div className="flex justify-end border-t border-line pt-4">
                <Button variant="secondary" onClick={onClose}>
                  Đóng
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {assignment.type === 'multiple_choice' && (
                <div className="flex flex-col gap-4">
                  {assignment.questions.map((q, qIdx) => (
                    <div key={q.id} className="rounded-xl border border-line p-4">
                      <p className="mb-4 text-sm font-bold text-ink-primary">
                        Câu {qIdx + 1} ({q.points} điểm): {q.prompt}
                      </p>
                      <div className="flex flex-col gap-2">
                        {q.options.map((opt, optIdx) => {
                          const letter = String.fromCharCode(65 + optIdx);
                          const checked = mcqAnswers[q.id] === optIdx;
                          return (
                            <label
                              key={optIdx}
                              className={`flex cursor-pointer items-center gap-2 rounded-lg border p-4 text-sm transition-colors ${
                                checked
                                  ? 'border-brand-navy bg-brand-navySoft font-semibold text-brand-navy'
                                  : 'border-line bg-surface-card hover:bg-surface-page'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`ans_${q.id}`}
                                checked={checked}
                                onChange={() =>
                                  setMcqAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                                }
                                className="h-4 w-4 accent-brand-red"
                              />
                              <span>
                                {letter}. {opt}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(assignment.type === 'essay' || assignment.type === 'short_answer') && (
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="student-answer-text"
                    className="text-sm font-semibold text-ink-primary"
                  >
                    Bài làm của bạn <span className="text-brand-red">*</span>
                  </label>
                  <textarea
                    id="student-answer-text"
                    rows={assignment.type === 'essay' ? 6 : 3}
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    placeholder="Nhập câu trả lời của bạn..."
                    className="w-full rounded-lg border border-line-strong bg-surface-card p-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                  />
                </div>
              )}

              {assignment.type === 'file_upload' && (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-ink-primary">
                      {isGroupWork ? 'Ảnh bài làm của nhóm' : 'Ảnh bài làm'}{' '}
                      <span className="text-brand-red">*</span>
                    </span>
                    {isEditing && existingFileName && !selectedFile && (
                      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-page p-4 text-xs text-ink-secondary">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            Đang giữ ảnh hiện tại: <strong className="text-ink-primary">{existingFileName}</strong> (chọn ảnh mới bên dưới nếu muốn thay thế)
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={openingFile}
                            onClick={handleDownloadOwnFile}
                          >
                            <ExternalLink className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                            <span>Xem ảnh cũ</span>
                          </Button>
                        </div>
                        {submittedPreviewUrl && (
                          <img
                            src={submittedPreviewUrl}
                            alt="Ảnh hiện tại"
                            className="max-h-56 w-full rounded border border-line bg-surface-card object-contain"
                          />
                        )}
                      </div>
                    )}
                    <FileDropzone
                      compact
                      accept="image/*"
                      hint="Tối đa 25 MB · Hỗ trợ ảnh JPG, PNG, WEBP, HEIC..."
                      disabled={submitting}
                      fileItem={
                        selectedFile
                          ? {
                              name: selectedFile.name,
                              size: selectedFile.size,
                              status: submitting ? 'uploading' : 'ready',
                            }
                          : null
                      }
                      onFileSelect={(file) => {
                        if (!isImageFile(file)) {
                          toast.error('Vui lòng chỉ chọn tệp hình ảnh (JPG, PNG, WEBP, HEIC...)');
                          return;
                        }
                        if (file.size > MAX_SUBMISSION_BYTES) {
                          toast.error('Ảnh nộp vượt quá giới hạn 25 MB');
                          return;
                        }
                        setSelectedFile(file);
                      }}
                      onClear={() => setSelectedFile(null)}
                    />
                    {localPreviewUrl && (
                      <div className="overflow-hidden rounded-lg border border-line bg-surface-page p-2">
                        <img
                          src={localPreviewUrl}
                          alt="Xem trước ảnh bài làm"
                          className="max-h-72 w-full rounded object-contain"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="student-file-note"
                      className="text-sm font-semibold text-ink-primary"
                    >
                      Ghi chú thêm (tùy chọn)
                    </label>
                    <textarea
                      id="student-file-note"
                      rows={2}
                      value={textAnswer}
                      onChange={(e) => setTextAnswer(e.target.value)}
                      placeholder="Ghi chú gửi giáo viên..."
                      className="w-full rounded-lg border border-line-strong bg-surface-card p-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <Button
                  variant="secondary"
                  onClick={isEditing ? cancelEditing : onClose}
                  disabled={submitting}
                >
                  {isEditing ? 'Quay lại' : 'Đóng'}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (validateBeforeSubmit()) setConfirmOpen(true);
                  }}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>
                    {submission
                      ? 'Lưu & Nộp lại'
                      : isGroupWork
                        ? 'Nộp bài cho nhóm'
                        : 'Nộp bài'}
                  </span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleSubmit}
        loading={submitting}
        confirmVariant="navy"
        confirmLabel={submission ? 'Xác nhận nộp lại' : 'Xác nhận nộp bài'}
        title={submission ? 'Xác nhận nộp lại bài' : 'Xác nhận nộp bài'}
        message={
          assignment.due_date
            ? 'Bạn vẫn có thể chỉnh sửa, nộp lại hoặc hủy bài nộp trước thời hạn giảng viên cài đặt. Khi hết hạn, bài làm sẽ được khóa. Bạn chắc chắn muốn nộp?'
            : 'Sau khi nộp, bạn vẫn có thể chỉnh sửa, nộp lại hoặc hủy bài nộp bất cứ lúc nào. Bạn chắc chắn muốn nộp?'
        }
      />

      <ConfirmDialog
        open={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleCancelSubmission}
        loading={canceling}
        confirmLabel="Xác nhận hủy bài nộp"
        title="Hủy và xóa bài đã nộp"
        message="Bài nộp hiện tại của bạn sẽ bị xóa để bạn có thể làm lại từ đầu (chỉ thực hiện được khi còn thời hạn nộp bài). Bạn chắc chắn muốn hủy bài nộp?"
      />
    </>
  );
}
