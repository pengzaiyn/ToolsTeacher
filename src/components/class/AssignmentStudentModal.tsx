import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  MAX_SUBMISSION_BYTES,
  formatDateTimeVi,
  openPrivateBucketFile,
  sanitizeStorageFileName,
} from '@/lib/classStorage';
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [openingFile, setOpeningFile] = useState(false);

  useEffect(() => {
    setMcqAnswers({});
    setTextAnswer('');
    setSelectedFile(null);
    setConfirmOpen(false);
  }, [assignment?.id]);

  if (!assignment) return null;

  const grade: Grade | null = submission?.grade
    ? Array.isArray(submission.grade)
      ? submission.grade[0] ?? null
      : submission.grade
    : null;

  function validateBeforeSubmit(): boolean {
    if (!assignment) return false;
    if (assignment.type === 'multiple_choice') {
      const unanswered = assignment.questions.some((q) => mcqAnswers[q.id] === undefined);
      if (unanswered) {
        toast.error('Vui lòng chọn đáp án cho tất cả câu hỏi trước khi nộp');
        return false;
      }
      return true;
    }
    if (assignment.type === 'file_upload') {
      if (!selectedFile) {
        toast.error('Vui lòng chọn file bài làm để nộp');
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
    setSubmitting(true);
    try {
      let filePath: string | null = null;
      let answersPayload: Record<string, number | string> = {};

      if (assignment.type === 'multiple_choice') {
        answersPayload = mcqAnswers;
      } else if (assignment.type === 'file_upload') {
        if (!selectedFile) throw new Error('Thiếu file bài nộp');
        const path = `${assignment.class_id}/${user.id}/${Date.now()}_${sanitizeStorageFileName(
          selectedFile.name
        )}`;
        const { error: upErr } = await supabase.storage
          .from('submissions')
          .upload(path, selectedFile, { upsert: false });
        if (upErr) throw new Error(upErr.message);
        filePath = path;
        if (textAnswer.trim()) {
          answersPayload = { text: textAnswer.trim() };
        }
      } else {
        answersPayload = { text: textAnswer.trim() };
      }

      const { error: subErr } = await supabase.from('submissions').insert({
        assignment_id: assignment.id,
        student_id: user.id,
        answers: answersPayload,
        file_url: filePath,
        status: 'pending',
      });

      if (subErr) throw new Error(subErr.message);

      toast.success('Đã nộp bài thành công');
      setConfirmOpen(false);
      onClose();
      await onSubmitted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không nộp được bài');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadOwnFile() {
    if (!submission?.file_url) return;
    setOpeningFile(true);
    try {
      await openPrivateBucketFile('submissions', submission.file_url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không mở được file đã nộp');
    } finally {
      setOpeningFile(false);
    }
  }

  return (
    <>
      <Modal
        open={Boolean(assignment)}
        onClose={() => {
          if (!submitting) onClose();
        }}
        title={assignment.title}
        size="lg"
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-page p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="navy">Điểm tối đa: {assignment.max_score}</Badge>
              <Badge tone="neutral">Hạn nộp: {formatDateTimeVi(assignment.due_date)}</Badge>
            </div>
            {submission && (
              <Badge tone={submission.status === 'graded' ? 'success' : 'warning'}>
                {submission.status === 'graded' ? 'Đã chấm điểm' : 'Đã nộp — Chờ chấm'}
              </Badge>
            )}
          </div>

          {assignment.description && (
            <div className="rounded-lg border border-line p-4">
              <p className="mb-2 text-xs font-bold uppercase text-ink-muted">Đề bài</p>
              <p className="whitespace-pre-line text-sm font-normal text-ink-primary">
                {assignment.description}
              </p>
            </div>
          )}

          {submission ? (
            <div className="flex flex-col gap-4">
              {submission.status === 'graded' && grade && (
                <div className="flex flex-col gap-2 rounded-xl border border-status-successBorder bg-status-successBg p-4 text-status-successText">
                  <div className="flex items-center gap-2 text-base font-bold">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    <span>
                      Điểm số: {grade.score ?? '—'} / {assignment.max_score}
                    </span>
                  </div>
                  {grade.feedback && (
                    <p className="text-sm font-normal">Nhận xét: {grade.feedback}</p>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-line bg-surface-page p-4">
                <p className="mb-2 text-xs font-bold uppercase text-ink-muted">
                  Bài bạn đã nộp lúc {formatDateTimeVi(submission.submitted_at)}
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
                  <div className="flex flex-col gap-2">
                    {typeof submission.answers?.text === 'string' && submission.answers.text && (
                      <p className="whitespace-pre-line text-sm font-normal text-ink-primary">
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
                          <Download className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                          <span>Tải lại file đã nộp</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
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
                  <FileDropzone
                    compact
                    hint="Tối đa 25 MB · Hỗ trợ PDF, DOCX, ZIP, ảnh..."
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
                      if (file.size > MAX_SUBMISSION_BYTES) {
                        toast.error('File nộp vượt quá giới hạn 25 MB');
                        return;
                      }
                      setSelectedFile(file);
                    }}
                    onClear={() => setSelectedFile(null)}
                  />
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
                <Button variant="secondary" onClick={onClose}>
                  Đóng
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (validateBeforeSubmit()) setConfirmOpen(true);
                  }}
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>Nộp bài</span>
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
        confirmLabel="Xác nhận nộp bài"
        title="Xác nhận nộp bài"
        message="Sau khi nộp bài, bạn sẽ không thể chỉnh sửa lại bài làm. Bạn chắc chắn muốn nộp?"
      />
    </>
  );
}

