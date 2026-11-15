import { useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatClassActionError } from '@/lib/classStorage';
import { supabase } from '@/lib/supabase';
import type { AssignmentType, McqQuestion } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';

interface AssignmentCreateModalProps {
  open: boolean;
  onClose: () => void;
  classId: string;
  onCreated: () => void | Promise<void>;
}

interface QuestionDraft extends McqQuestion {
  correctIndex: number;
}

const TYPE_OPTIONS = [
  { value: 'multiple_choice', label: 'Trắc nghiệm' },
  { value: 'essay', label: 'Tự luận' },
  { value: 'short_answer', label: 'Trả lời ngắn' },
  { value: 'file_upload', label: 'Nộp file' },
];

function newQuestionDraft(index: number): QuestionDraft {
  return {
    id: `q_${Date.now()}_${index}`,
    prompt: '',
    options: ['', '', '', ''],
    points: 1,
    correctIndex: 0,
  };
}

export function AssignmentCreateModal({
  open,
  onClose,
  classId,
  onCreated,
}: AssignmentCreateModalProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<AssignmentType>('multiple_choice');
  const [maxScore, setMaxScore] = useState('10');
  const [dueDate, setDueDate] = useState('');
  const [sampleAnswer, setSampleAnswer] = useState('');
  const [questions, setQuestions] = useState<QuestionDraft[]>([newQuestionDraft(1)]);

  function resetForm() {
    setTitle('');
    setDescription('');
    setType('multiple_choice');
    setMaxScore('10');
    setDueDate('');
    setSampleAnswer('');
    setQuestions([newQuestionDraft(1)]);
  }

  function updateQuestion(idx: number, patch: Partial<QuestionDraft>) {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  }

  function updateOption(qIdx: number, optIdx: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIdx
          ? { ...q, options: q.options.map((o, oi) => (oi === optIdx ? value : o)) }
          : q
      )
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề bài tập');
      return;
    }

    const parsedMax = Number(maxScore);
    if (!Number.isInteger(parsedMax) || parsedMax <= 0) {
      toast.error('Điểm tối đa phải là số nguyên dương');
      return;
    }

    let publicQuestions: McqQuestion[] = [];
    const answerKey: Record<string, number | string> = {};

    if (type === 'multiple_choice') {
      if (questions.length === 0) {
        toast.error('Bài trắc nghiệm cần ít nhất 1 câu hỏi');
        return;
      }
      for (let i = 0; i < questions.length; i += 1) {
        const q = questions[i];
        if (!q.prompt.trim()) {
          toast.error(`Câu ${i + 1}: Vui lòng nhập nội dung câu hỏi`);
          return;
        }
        if (q.options.some((opt) => !opt.trim())) {
          toast.error(`Câu ${i + 1}: Vui lòng nhập đủ 4 đáp án A, B, C, D`);
          return;
        }
        if (!Number.isFinite(q.points) || q.points <= 0) {
          toast.error(`Câu ${i + 1}: Điểm câu hỏi phải lớn hơn 0`);
          return;
        }
        publicQuestions.push({
          id: q.id,
          prompt: q.prompt.trim(),
          options: q.options.map((opt) => opt.trim()),
          points: q.points,
        });
        answerKey[q.id] = q.correctIndex;
      }
    } else if (type === 'short_answer' && sampleAnswer.trim()) {
      answerKey.expected = sampleAnswer.trim();
    }

    setSaving(true);
    try {
      const { data: created, error: aErr } = await supabase
        .from('assignments')
        .insert({
          class_id: classId,
          title: title.trim(),
          description: description.trim() || null,
          type,
          questions: publicQuestions,
          max_score: parsedMax,
          ai_grading: false,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          created_by: user.id,
        })
        .select('id')
        .single<{ id: string }>();

      if (aErr || !created) {
        throw new Error(aErr?.message || 'Không tạo được bài tập');
      }

      if (Object.keys(answerKey).length > 0) {
        const { error: kErr } = await supabase.from('assignment_keys').insert({
          assignment_id: created.id,
          answer_key: answerKey,
        });
        if (kErr) {
          await supabase.from('assignments').delete().eq('id', created.id);
          throw new Error('Không lưu được đáp án bài tập');
        }
      }

      toast.success('Đã giao bài tập mới cho lớp');
      resetForm();
      onClose();
      await onCreated();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không tạo được bài tập'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="Giao bài tập mới"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Tiêu đề bài tập"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="VD: Kiểm tra giữa kỳ Chương 1"
          required
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select
            label="Hình thức"
            value={type}
            onChange={(e) => setType(e.target.value as AssignmentType)}
            options={TYPE_OPTIONS}
            required
          />
          <Input
            label="Điểm tối đa"
            type="number"
            min={1}
            max={100}
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
            required
          />
          <Input
            label="Hạn nộp (tùy chọn)"
            type="datetime-local"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="assign-desc" className="text-sm font-semibold text-ink-primary">
            Hướng dẫn / Đề bài
          </label>
          <textarea
            id="assign-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Nhập yêu cầu chi tiết cho sinh viên..."
            className="w-full rounded-lg border border-line-strong bg-surface-card p-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          />
        </div>

        {type === 'short_answer' && (
          <Input
            label="Đáp án gợi ý (chỉ giáo viên xem)"
            value={sampleAnswer}
            onChange={(e) => setSampleAnswer(e.target.value)}
            placeholder="Đáp án được lưu riêng trong bảng assignment_keys"
          />
        )}

        {type === 'multiple_choice' && (
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-page p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-brand-navy">
                Danh sách câu hỏi ({questions.length})
              </p>
              <Button
                size="sm"
                variant="navy"
                onClick={() =>
                  setQuestions((prev) => [...prev, newQuestionDraft(prev.length + 1)])
                }
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Thêm câu</span>
              </Button>
            </div>

            {questions.map((q, qIdx) => (
              <div
                key={q.id}
                className="flex flex-col gap-4 rounded-lg border border-line bg-surface-card p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-brand-navy">Câu {qIdx + 1}</span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-ink-secondary">Điểm:</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={q.points}
                      onChange={(e) =>
                        updateQuestion(qIdx, { points: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="h-8 w-16 rounded border border-line-strong px-2 text-xs font-semibold"
                    />
                    {questions.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setQuestions((prev) => prev.filter((_, i) => i !== qIdx))
                        }
                        aria-label={`Xóa câu ${qIdx + 1}`}
                      >
                        <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </div>

                <Input
                  label="Nội dung câu hỏi"
                  value={q.prompt}
                  onChange={(e) => updateQuestion(qIdx, { prompt: e.target.value })}
                  required
                />

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {q.options.map((opt, optIdx) => {
                    const letter = String.fromCharCode(65 + optIdx);
                    return (
                      <div key={optIdx} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name={`correct_${q.id}`}
                          checked={q.correctIndex === optIdx}
                          onChange={() => updateQuestion(qIdx, { correctIndex: optIdx })}
                          aria-label={`Đáp án đúng là ${letter}`}
                          className="h-4 w-4 accent-brand-red"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateOption(qIdx, optIdx, e.target.value)}
                          placeholder={`Đáp án ${letter}`}
                          className="h-10 flex-1 rounded-lg border border-line-strong px-4 text-sm font-normal focus:border-brand-navy focus:outline-none"
                          required
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs font-normal text-ink-muted">
                  Chọn nút tròn bên cạnh đáp án đúng (đáp án được bảo mật riêng, sinh viên không đọc được).
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Hủy
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Giao bài tập
          </Button>
        </div>
      </form>
    </Modal>
  );
}

