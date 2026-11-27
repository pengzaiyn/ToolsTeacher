import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Crown, Shuffle, Sparkles, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  buildAssignmentGroupsFromTeams,
  randomizeGroupLeaders,
} from '@/lib/assignmentGroups';
import { splitIntoTeams, type KitStudent } from '@/lib/classroomKit';
import { formatClassActionError } from '@/lib/classStorage';
import { isDroppedOutStudent } from '@/lib/roles';
import { supabase } from '@/lib/supabase';
import type { AssignmentGroup, AssignmentWorkMode, Enrollment } from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface AssignmentCreateModalProps {
  open: boolean;
  onClose: () => void;
  classId: string;
  onCreated: () => void | Promise<void>;
}

const WORK_MODE_OPTIONS: { value: AssignmentWorkMode; label: string }[] = [
  { value: 'individual', label: 'Làm cá nhân' },
  { value: 'group', label: 'Làm theo nhóm' },
];

const GROUP_PRESETS = [2, 3, 4, 5, 6];

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
  const [workMode, setWorkMode] = useState<AssignmentWorkMode>('individual');
  const [maxScore, setMaxScore] = useState('10');
  const [dueDate, setDueDate] = useState('');

  const [classStudents, setClassStudents] = useState<KitStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [splitMode, setSplitMode] = useState<'by_count' | 'by_size'>('by_count');
  const [splitValue, setSplitValue] = useState('4');
  const [groups, setGroups] = useState<AssignmentGroup[]>([]);

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('enrollments')
        .select(
          '*, student:profiles!enrollments_student_id_fkey(id, full_name, email, student_code, class_name, is_active, academic_status)'
        )
        .eq('class_id', classId)
        .returns<Enrollment[]>();

      if (error) throw new Error(error.message);

      const valid: KitStudent[] = (data ?? [])
        .filter((enr) => enr.student && enr.student.is_active !== false && !isDroppedOutStudent(enr.student))
        .map((enr) => ({
          id: enr.student!.id,
          name: enr.student!.full_name,
          code: enr.student!.student_code,
          className: enr.student!.class_name,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

      setClassStudents(valid);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tải được danh sách sinh viên của lớp');
    } finally {
      setLoadingStudents(false);
    }
  }, [classId, toast]);

  useEffect(() => {
    if (open && workMode === 'group') {
      void loadStudents();
    }
  }, [open, workMode, loadStudents]);

  function resetForm() {
    setTitle('');
    setDescription('');
    setWorkMode('individual');
    setMaxScore('10');
    setDueDate('');
    setSplitMode('by_count');
    setSplitValue('4');
    setGroups([]);
  }

  function handleSplitGroups() {
    if (classStudents.length === 0) {
      toast.error('Lớp chưa có sinh viên đang học để chia nhóm');
      return;
    }
    const parsed = Number.parseInt(splitValue, 10);
    if (!Number.isFinite(parsed) || parsed < 1) {
      toast.error(
        splitMode === 'by_count' ? 'Số nhóm phải từ 1 trở lên' : 'Số sinh viên mỗi nhóm phải từ 1 trở lên'
      );
      return;
    }
    const teams = splitIntoTeams(classStudents, splitMode, parsed);
    setGroups(buildAssignmentGroupsFromTeams(teams));
  }

  function handleRandomizeLeaders() {
    if (groups.length === 0) return;
    setGroups((prev) => randomizeGroupLeaders(prev));
    toast.success('Đã chọn ngẫu nhiên Trưởng nhóm cho tất cả các nhóm');
  }

  function handleSelectLeader(groupId: string, studentId: string) {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, leader_id: studentId } : g))
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

    if (workMode === 'group') {
      if (groups.length === 0) {
        toast.error('Vui lòng bấm "Chia nhóm ngay" trước khi giao bài tập nhóm');
        return;
      }
      const missingLeader = groups.some(
        (g) => !g.leader_id || !g.members.some((m) => m.student_id === g.leader_id)
      );
      if (missingLeader) {
        toast.error('Mỗi nhóm cần có 1 Trưởng nhóm hợp lệ');
        return;
      }
    }

    setSaving(true);
    try {
      const { error: aErr } = await supabase.from('assignments').insert({
        class_id: classId,
        title: title.trim(),
        description: description.trim() || null,
        type: 'file_upload',
        work_mode: workMode,
        groups: workMode === 'group' ? groups : [],
        questions: [],
        max_score: parsedMax,
        ai_grading: false,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        created_by: user.id,
      });

      if (aErr) {
        throw new Error(aErr.message || 'Không tạo được bài tập');
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
            label="Hình thức làm bài"
            value={workMode}
            onChange={(e) => setWorkMode(e.target.value as AssignmentWorkMode)}
            options={WORK_MODE_OPTIONS}
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

        {workMode === 'group' && (
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-page p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                <span className="text-sm font-bold text-brand-navy">
                  Chia nhóm & Chọn Trưởng nhóm ({classStudents.length} SV)
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={splitMode === 'by_count' ? 'navy' : 'secondary'}
                  onClick={() => setSplitMode('by_count')}
                >
                  Theo số nhóm
                </Button>
                <Button
                  size="sm"
                  variant={splitMode === 'by_size' ? 'navy' : 'secondary'}
                  onClick={() => setSplitMode('by_size')}
                >
                  Theo số SV / nhóm
                </Button>
              </div>
            </div>

            {loadingStudents ? (
              <div className="flex items-center gap-2 py-4 text-xs text-ink-secondary">
                <Spinner className="h-4 w-4" />
                <span>Đang tải danh sách sinh viên lớp học...</span>
              </div>
            ) : classStudents.length === 0 ? (
              <p className="text-xs font-normal text-brand-red">
                Lớp hiện chưa có sinh viên đang học để chia nhóm. Vui lòng thêm sinh viên vào lớp trước.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="w-full sm:w-44">
                    <Input
                      label={splitMode === 'by_count' ? 'Số nhóm muốn chia' : 'Số SV mỗi nhóm'}
                      type="number"
                      min={1}
                      max={Math.max(1, classStudents.length)}
                      value={splitValue}
                      onChange={(e) => setSplitValue(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {GROUP_PRESETS.map((num) => (
                      <Button
                        key={num}
                        size="sm"
                        variant={splitValue === String(num) ? 'navy' : 'secondary'}
                        onClick={() => setSplitValue(String(num))}
                      >
                        {num} {splitMode === 'by_count' ? 'nhóm' : 'SV'}
                      </Button>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                    <Button size="sm" variant="primary" onClick={handleSplitGroups}>
                      <Shuffle className="h-4 w-4" aria-hidden="true" />
                      <span>{groups.length > 0 ? 'Xáo trộn chia lại' : 'Chia nhóm ngay'}</span>
                    </Button>
                    {groups.length > 0 && (
                      <Button size="sm" variant="navy" onClick={handleRandomizeLeaders}>
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        <span>Chọn random trưởng nhóm</span>
                      </Button>
                    )}
                  </div>
                </div>

                {groups.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-normal text-ink-muted">
                      Chỉ <strong>Trưởng nhóm</strong> đại diện nộp bài cho nhóm. Bạn có thể bấm &quot;Chọn random trưởng nhóm&quot; hoặc bấm trực tiếp vào tên sinh viên để đổi Trưởng nhóm.
                    </p>
                    <div className="grid max-h-64 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                      {groups.map((group) => (
                        <div
                          key={group.id}
                          className="flex flex-col gap-2 rounded-lg border border-line bg-surface-card p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-brand-navy">{group.name}</span>
                            <Badge tone="neutral">{group.members.length} SV</Badge>
                          </div>
                          <div className="flex flex-col gap-1">
                            {group.members.map((member) => {
                              const isLeader = group.leader_id === member.student_id;
                              return (
                                <button
                                  key={member.student_id}
                                  type="button"
                                  onClick={() => handleSelectLeader(group.id, member.student_id)}
                                  title="Bấm để đặt làm Trưởng nhóm"
                                  className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                                    isLeader
                                      ? 'border-amber-400 bg-amber-50 font-bold text-brand-navy dark:bg-amber-950/30'
                                      : 'border-transparent hover:bg-surface-page text-ink-primary'
                                  }`}
                                >
                                  <span className="truncate">
                                    {member.full_name}
                                    {member.student_code ? ` (${member.student_code})` : ''}
                                  </span>
                                  {isLeader && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
                                      <Crown className="h-3 w-3" aria-hidden="true" />
                                      <span>Trưởng nhóm</span>
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="assign-desc" className="text-sm font-semibold text-ink-primary">
            Hướng dẫn / Đề bài
          </label>
          <textarea
            id="assign-desc"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Nhập yêu cầu chi tiết cho sinh viên..."
            className="w-full rounded-lg border border-line-strong bg-surface-card p-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          />
        </div>

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
