import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { isValidSchoolEmail, normalizeTeacherEmail, SCHOOL_DOMAIN } from '@/lib/email';
import { manageUsers, supabase } from '@/lib/supabase';
import type { ClassSubjectTeacher, CollegeClass, Profile } from '@/types/database';
import { AccountActions } from '@/components/AccountActions';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

type AdminTeacherTab = 'teachers' | 'classes';
type TeacherAssignFilter = 'all' | 'homeroom' | 'subject' | 'unassigned';
type ClassAssignFilter = 'all' | 'no_homeroom' | 'no_subject' | 'assigned';
type ModalClassFilter = 'all' | 'assigned' | 'no_homeroom';

type ClassBrief = Pick<CollegeClass, 'id' | 'name' | 'subject' | 'teacher_id'>;

interface TeacherSubjectDraft {
  checked: boolean;
  subjectName: string;
}

interface ClassSubjectDraftRow {
  teacherId: string;
  subjectName: string;
}

export function AdminTeachers() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<AdminTeacherTab>('teachers');
  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [classes, setClasses] = useState<ClassBrief[]>([]);
  const [subjectAssignments, setSubjectAssignments] = useState<ClassSubjectTeacher[]>([]);
  const [subjectTableReady, setSubjectTableReady] = useState(true);
  const [loading, setLoading] = useState(true);

  // Bộ lọc tab Giáo viên
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [assignFilter, setAssignFilter] = useState<TeacherAssignFilter>('all');

  // Bộ lọc tab Lớp học
  const [classSearch, setClassSearch] = useState('');
  const [classFilter, setClassFilter] = useState<ClassAssignFilter>('all');

  // Modal tạo giáo viên
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [fullName, setFullName] = useState('');
  const [subject, setSubject] = useState('');

  // Modal sửa thông tin giáo viên
  const [editing, setEditing] = useState<Profile | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSubject, setEditSubject] = useState('');

  // Modal phân lớp cho 1 giáo viên
  const [assignTeacher, setAssignTeacher] = useState<Profile | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignModalFilter, setAssignModalFilter] = useState<ModalClassFilter>('all');
  const [homeroomDraft, setHomeroomDraft] = useState<Set<string>>(() => new Set());
  const [subjectDraft, setSubjectDraft] = useState<Map<string, TeacherSubjectDraft>>(
    () => new Map()
  );
  const [assignSaving, setAssignSaving] = useState(false);

  // Modal phân công GV cho 1 lớp
  const [assignClass, setAssignClass] = useState<ClassBrief | null>(null);
  const [classHomeroomTeacherId, setClassHomeroomTeacherId] = useState('');
  const [classSubjectRows, setClassSubjectRows] = useState<ClassSubjectDraftRow[]>([]);
  const [newSubTeacherId, setNewSubTeacherId] = useState('');
  const [newSubSubjectName, setNewSubSubjectName] = useState('');
  const [classAssignSaving, setClassAssignSaving] = useState(false);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [teacherRes, classRes, subjectRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('role', 'teacher')
            .order('created_at', { ascending: false })
            .returns<Profile[]>(),
          supabase
            .from('classes')
            .select('id, name, subject, teacher_id')
            .order('name', { ascending: true })
            .returns<ClassBrief[]>(),
          supabase
            .from('class_teachers')
            .select('id, class_id, teacher_id, subject_name, created_at')
            .returns<ClassSubjectTeacher[]>(),
        ]);

        if (teacherRes.error) throw new Error(teacherRes.error.message);
        if (classRes.error) throw new Error(classRes.error.message);

        setTeachers(teacherRes.data ?? []);
        setClasses(classRes.data ?? []);

        if (subjectRes.error) {
          setSubjectTableReady(false);
          setSubjectAssignments([]);
        } else {
          setSubjectTableReady(true);
          setSubjectAssignments(subjectRes.data ?? []);
        }
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được dữ liệu giáo viên');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useRealtimeRefresh({
    channelName: 'admin-teachers-realtime',
    tables: [{ table: 'profiles' }, { table: 'classes' }, { table: 'class_teachers' }],
    onRefresh: () => loadData(true),
  });

  // Bản đồ tra cứu nhanh
  const teacherById = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const t of teachers) map.set(t.id, t);
    return map;
  }, [teachers]);

  const classById = useMemo(() => {
    const map = new Map<string, ClassBrief>();
    for (const c of classes) map.set(c.id, c);
    return map;
  }, [classes]);

  const homeroomByTeacher = useMemo(() => {
    const map = new Map<string, ClassBrief[]>();
    for (const c of classes) {
      if (!c.teacher_id) continue;
      const list = map.get(c.teacher_id) ?? [];
      list.push(c);
      map.set(c.teacher_id, list);
    }
    return map;
  }, [classes]);

  const subjectByTeacher = useMemo(() => {
    const map = new Map<string, ClassSubjectTeacher[]>();
    for (const row of subjectAssignments) {
      const list = map.get(row.teacher_id) ?? [];
      list.push(row);
      map.set(row.teacher_id, list);
    }
    return map;
  }, [subjectAssignments]);

  const subjectByClass = useMemo(() => {
    const map = new Map<string, ClassSubjectTeacher[]>();
    for (const row of subjectAssignments) {
      const list = map.get(row.class_id) ?? [];
      list.push(row);
      map.set(row.class_id, list);
    }
    return map;
  }, [subjectAssignments]);

  // Thống kê tổng quan
  const stats = useMemo(() => {
    let assignedTeachers = 0;
    for (const t of teachers) {
      const hasHomeroom = (homeroomByTeacher.get(t.id)?.length ?? 0) > 0;
      const hasSubject = (subjectByTeacher.get(t.id)?.length ?? 0) > 0;
      if (hasHomeroom || hasSubject) assignedTeachers += 1;
    }
    const classesWithoutHomeroom = classes.filter((c) => !c.teacher_id).length;
    return {
      totalTeachers: teachers.length,
      assignedTeachers,
      unassignedTeachers: teachers.length - assignedTeachers,
      classesWithoutHomeroom,
    };
  }, [teachers, classes, homeroomByTeacher, subjectByTeacher]);

  // Lọc danh sách giáo viên
  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => {
      if (statusFilter === 'active' && !t.is_active) return false;
      if (statusFilter === 'inactive' && t.is_active) return false;

      const hrList = homeroomByTeacher.get(t.id) ?? [];
      const sbList = subjectByTeacher.get(t.id) ?? [];

      if (assignFilter === 'homeroom' && hrList.length === 0) return false;
      if (assignFilter === 'subject' && sbList.length === 0) return false;
      if (assignFilter === 'unassigned' && (hrList.length > 0 || sbList.length > 0)) return false;

      if (!q) return true;

      const classNames = [
        ...hrList.map((c) => c.name),
        ...sbList.map((s) => classById.get(s.class_id)?.name ?? ''),
        ...sbList.map((s) => s.subject_name ?? ''),
      ]
        .join(' ')
        .toLowerCase();

      return (
        t.full_name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.subject ?? '').toLowerCase().includes(q) ||
        classNames.includes(q)
      );
    });
  }, [teachers, search, statusFilter, assignFilter, homeroomByTeacher, subjectByTeacher, classById]);

  // Lọc danh sách lớp học (Tab 2)
  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    return classes.filter((c) => {
      const hasHomeroom = Boolean(c.teacher_id);
      const sbList = subjectByClass.get(c.id) ?? [];

      if (classFilter === 'no_homeroom' && hasHomeroom) return false;
      if (classFilter === 'no_subject' && sbList.length > 0) return false;
      if (classFilter === 'assigned' && !hasHomeroom && sbList.length === 0) return false;

      if (!q) return true;
      const hrName = c.teacher_id ? teacherById.get(c.teacher_id)?.full_name ?? '' : '';
      const sbNames = sbList
        .map((s) => `${teacherById.get(s.teacher_id)?.full_name ?? ''} ${s.subject_name ?? ''}`)
        .join(' ');

      return (
        c.name.toLowerCase().includes(q) ||
        (c.subject ?? '').toLowerCase().includes(q) ||
        hrName.toLowerCase().includes(q) ||
        sbNames.toLowerCase().includes(q)
      );
    });
  }, [classes, classSearch, classFilter, subjectByClass, teacherById]);

  const activeTeacherOptions = useMemo(
    () =>
      teachers
        .filter((t) => t.is_active)
        .map((t) => ({
          value: t.id,
          label: t.subject ? `${t.full_name} — ${t.subject}` : `${t.full_name} (${t.email})`,
        })),
    [teachers]
  );

  const normalizedPreview = useMemo(() => normalizeTeacherEmail(emailInput), [emailInput]);

  async function handleCreateTeacher(event: FormEvent) {
    event.preventDefault();
    const email = normalizeTeacherEmail(emailInput);
    if (!email || !fullName.trim()) {
      toast.error('Vui lòng nhập email và họ tên giáo viên');
      return;
    }
    if (!isValidSchoolEmail(email)) {
      toast.error(`Email giáo viên phải có đuôi ${SCHOOL_DOMAIN}`);
      return;
    }

    setCreating(true);
    try {
      const res = await manageUsers({
        action: 'create_teacher',
        email,
        full_name: fullName.trim(),
        subject: subject.trim() || undefined,
      });
      toast.success(
        `Đã tạo tài khoản giáo viên ${res.user?.full_name ?? ''} (${res.user?.email ?? email})`
      );
      setCreateOpen(false);
      setEmailInput('');
      setFullName('');
      setSubject('');
      await loadData(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tạo được tài khoản giáo viên');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(teacher: Profile) {
    setEditing(teacher);
    setEditName(teacher.full_name);
    setEditSubject(teacher.subject ?? '');
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (!editName.trim()) {
      toast.error('Vui lòng nhập họ tên giáo viên');
      return;
    }

    setEditSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editName.trim(),
          subject: editSubject.trim() || null,
        })
        .eq('id', editing.id);

      if (error) throw new Error(error.message);
      toast.success(`Đã cập nhật thông tin giáo viên ${editName.trim()}`);
      setEditing(null);
      await loadData(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không lưu được thông tin');
    } finally {
      setEditSaving(false);
    }
  }

  // Mở Modal phân lớp cho 1 giáo viên
  function openAssignForTeacher(teacher: Profile) {
    setAssignTeacher(teacher);
    setAssignSearch('');
    setAssignModalFilter('all');

    const hrSet = new Set<string>();
    for (const c of classes) {
      if (c.teacher_id === teacher.id) hrSet.add(c.id);
    }
    setHomeroomDraft(hrSet);

    const sbMap = new Map<string, TeacherSubjectDraft>();
    for (const row of subjectByTeacher.get(teacher.id) ?? []) {
      sbMap.set(row.class_id, {
        checked: true,
        subjectName: row.subject_name ?? teacher.subject ?? '',
      });
    }
    setSubjectDraft(sbMap);
  }

  function toggleHomeroomDraft(classId: string) {
    setHomeroomDraft((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  function toggleSubjectDraft(classId: string, defaultSubject: string) {
    setSubjectDraft((prev) => {
      const next = new Map(prev);
      const current = next.get(classId);
      if (current?.checked) {
        next.delete(classId);
      } else {
        next.set(classId, {
          checked: true,
          subjectName: current?.subjectName || defaultSubject,
        });
      }
      return next;
    });
  }

  function updateSubjectDraftName(classId: string, value: string) {
    setSubjectDraft((prev) => {
      const next = new Map(prev);
      next.set(classId, { checked: true, subjectName: value });
      return next;
    });
  }

  async function handleSaveTeacherAssignment() {
    if (!assignTeacher) return;
    setAssignSaving(true);
    try {
      const teacherId = assignTeacher.id;

      // 1. Cập nhật lớp chủ nhiệm (classes.teacher_id)
      const prevHrIds = new Set(
        classes.filter((c) => c.teacher_id === teacherId).map((c) => c.id)
      );
      const toSetHr = [...homeroomDraft].filter((cid) => !prevHrIds.has(cid));
      const toUnsetHr = [...prevHrIds].filter((cid) => !homeroomDraft.has(cid));

      if (toSetHr.length > 0) {
        const { error } = await supabase
          .from('classes')
          .update({ teacher_id: teacherId })
          .in('id', toSetHr);
        if (error) throw new Error(error.message);
      }
      if (toUnsetHr.length > 0) {
        const { error } = await supabase
          .from('classes')
          .update({ teacher_id: null })
          .in('id', toUnsetHr);
        if (error) throw new Error(error.message);
      }

      // 2. Cập nhật lớp dạy bộ môn (class_teachers)
      if (subjectTableReady) {
        const prevSbRows = subjectByTeacher.get(teacherId) ?? [];
        const prevSbIds = new Set(prevSbRows.map((r) => r.class_id));

        const toRemoveSb = [...prevSbIds].filter((cid) => !subjectDraft.get(cid)?.checked);
        if (toRemoveSb.length > 0) {
          const { error } = await supabase
            .from('class_teachers')
            .delete()
            .eq('teacher_id', teacherId)
            .in('class_id', toRemoveSb);
          if (error) throw new Error(error.message);
        }

        const toUpsertSb = [...subjectDraft.entries()]
          .filter(([, draft]) => draft.checked)
          .map(([cid, draft]) => ({
            class_id: cid,
            teacher_id: teacherId,
            subject_name: draft.subjectName.trim() || null,
          }));

        if (toUpsertSb.length > 0) {
          const { error } = await supabase
            .from('class_teachers')
            .upsert(toUpsertSb, { onConflict: 'class_id,teacher_id' });
          if (error) throw new Error(error.message);
        }
      }

      toast.success(`Đã lưu phân lớp cho giáo viên ${assignTeacher.full_name}`);
      setAssignTeacher(null);
      await loadData(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không lưu được phân công lớp');
    } finally {
      setAssignSaving(false);
    }
  }

  // Mở Modal phân công giáo viên cho 1 lớp
  function openAssignForClass(cls: ClassBrief) {
    setAssignClass(cls);
    setClassHomeroomTeacherId(cls.teacher_id ?? '');
    const existing = subjectByClass.get(cls.id) ?? [];
    setClassSubjectRows(
      existing.map((r) => ({
        teacherId: r.teacher_id,
        subjectName: r.subject_name ?? '',
      }))
    );
    setNewSubTeacherId('');
    setNewSubSubjectName('');
  }

  function handleAddSubjectTeacherRow() {
    if (!newSubTeacherId) {
      toast.error('Vui lòng chọn giáo viên bộ môn');
      return;
    }
    if (classSubjectRows.some((r) => r.teacherId === newSubTeacherId)) {
      toast.error('Giáo viên này đã có trong danh sách bộ môn của lớp');
      return;
    }
    const chosenTeacher = teacherById.get(newSubTeacherId);
    setClassSubjectRows((prev) => [
      ...prev,
      {
        teacherId: newSubTeacherId,
        subjectName: newSubSubjectName.trim() || chosenTeacher?.subject || '',
      },
    ]);
    setNewSubTeacherId('');
    setNewSubSubjectName('');
  }

  function handleRemoveSubjectTeacherRow(teacherId: string) {
    setClassSubjectRows((prev) => prev.filter((r) => r.teacherId !== teacherId));
  }

  async function handleSaveClassAssignment() {
    if (!assignClass) return;
    setClassAssignSaving(true);
    try {
      const classId = assignClass.id;
      const nextHomeroom = classHomeroomTeacherId || null;

      if (nextHomeroom !== (assignClass.teacher_id ?? null)) {
        const { error } = await supabase
          .from('classes')
          .update({ teacher_id: nextHomeroom })
          .eq('id', classId);
        if (error) throw new Error(error.message);
      }

      if (subjectTableReady) {
        const prevIds = new Set((subjectByClass.get(classId) ?? []).map((r) => r.teacher_id));
        const nextIds = new Set(classSubjectRows.map((r) => r.teacherId));

        const toRemove = [...prevIds].filter((tid) => !nextIds.has(tid));
        if (toRemove.length > 0) {
          const { error } = await supabase
            .from('class_teachers')
            .delete()
            .eq('class_id', classId)
            .in('teacher_id', toRemove);
          if (error) throw new Error(error.message);
        }

        if (classSubjectRows.length > 0) {
          const payload = classSubjectRows.map((row) => ({
            class_id: classId,
            teacher_id: row.teacherId,
            subject_name: row.subjectName.trim() || null,
          }));
          const { error } = await supabase
            .from('class_teachers')
            .upsert(payload, { onConflict: 'class_id,teacher_id' });
          if (error) throw new Error(error.message);
        }
      }

      toast.success(`Đã cập nhật phân công giáo viên cho lớp ${assignClass.name}`);
      setAssignClass(null);
      await loadData(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không lưu được phân công giáo viên');
    } finally {
      setClassAssignSaving(false);
    }
  }

  // Danh sách lớp lọc trong Modal phân lớp cho giáo viên
  const modalFilteredClasses = useMemo(() => {
    if (!assignTeacher) return [];
    const q = assignSearch.trim().toLowerCase();
    return classes.filter((c) => {
      const isMine = homeroomDraft.has(c.id) || Boolean(subjectDraft.get(c.id)?.checked);
      if (assignModalFilter === 'assigned' && !isMine) return false;
      if (assignModalFilter === 'no_homeroom' && c.teacher_id !== null) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) || (c.subject ?? '').toLowerCase().includes(q)
      );
    });
  }, [assignTeacher, classes, assignSearch, assignModalFilter, homeroomDraft, subjectDraft]);

  const teacherColumns: TableColumn<Profile>[] = [
    {
      key: 'teacher',
      header: 'Giáo viên',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <span className="font-bold text-ink-primary">{row.full_name}</span>
          <span className="text-xs font-normal text-ink-muted">{row.email}</span>
          {row.subject && (
            <span className="text-xs font-semibold text-brand-navy">Bộ môn: {row.subject}</span>
          )}
        </div>
      ),
    },
    {
      key: 'homeroom',
      header: 'Lớp chủ nhiệm (GVCN)',
      render: (row) => {
        const list = homeroomByTeacher.get(row.id) ?? [];
        if (list.length === 0) {
          return <span className="text-xs font-normal text-ink-muted">Chưa chủ nhiệm</span>;
        }
        return (
          <div className="flex max-w-xs flex-wrap gap-1.5">
            {list.map((c) => (
              <Link key={c.id} to={`/classes/${c.id}`}>
                <Badge tone="red" className="hover:underline">
                  {c.name}
                </Badge>
              </Link>
            ))}
          </div>
        );
      },
    },
    {
      key: 'subject_classes',
      header: 'Lớp dạy bộ môn',
      render: (row) => {
        const list = subjectByTeacher.get(row.id) ?? [];
        if (list.length === 0) {
          return <span className="text-xs font-normal text-ink-muted">Chưa phân công</span>;
        }
        return (
          <div className="flex max-w-sm flex-wrap gap-1.5">
            {list.map((item) => {
              const cls = classById.get(item.class_id);
              if (!cls) return null;
              return (
                <Link key={item.id} to={`/classes/${cls.id}`}>
                  <Badge tone="navy" className="hover:underline">
                    {cls.name}
                    {item.subject_name ? ` · ${item.subject_name}` : ''}
                  </Badge>
                </Link>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => (
        <Badge tone={row.is_active ? 'success' : 'danger'}>
          {row.is_active ? 'Hoạt động' : 'Đã khóa'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="navy" onClick={() => openAssignForTeacher(row)}>
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            <span>Phân lớp</span>
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4 text-brand-navy" aria-hidden="true" />
            <span>Sửa</span>
          </Button>
          <AccountActions account={row} onUpdated={() => loadData(true)} />
        </div>
      ),
    },
  ];

  const classColumns: TableColumn<ClassBrief>[] = [
    {
      key: 'class',
      header: 'Lớp học',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <Link
            to={`/classes/${row.id}`}
            className="font-bold text-brand-navy hover:text-brand-red hover:underline"
          >
            {row.name}
          </Link>
          {row.subject && (
            <span className="text-xs font-normal text-ink-secondary">{row.subject}</span>
          )}
        </div>
      ),
    },
    {
      key: 'homeroom',
      header: 'Giáo viên chủ nhiệm',
      render: (row) => {
        const hr = row.teacher_id ? teacherById.get(row.teacher_id) : null;
        if (!hr) {
          return <Badge tone="warning">Chưa có GVCN</Badge>;
        }
        return (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-ink-primary">{hr.full_name}</span>
            <span className="text-xs font-normal text-ink-muted">{hr.email}</span>
          </div>
        );
      },
    },
    {
      key: 'subject_teachers',
      header: 'Giáo viên bộ môn',
      render: (row) => {
        const list = subjectByClass.get(row.id) ?? [];
        if (list.length === 0) {
          return <span className="text-xs font-normal text-ink-muted">Chưa phân công GV bộ môn</span>;
        }
        return (
          <div className="flex max-w-md flex-wrap gap-1.5">
            {list.map((item) => {
              const t = teacherById.get(item.teacher_id);
              return (
                <Badge key={item.id} tone="navy">
                  {t?.full_name || 'Giáo viên'}
                  {item.subject_name ? ` (${item.subject_name})` : ''}
                </Badge>
              );
            })}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'text-right',
      render: (row) => (
        <div className="flex justify-end">
          <Button size="sm" variant="navy" onClick={() => openAssignForClass(row)}>
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>Phân công GV</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Quản lý & Phân lớp giáo viên</h1>
            <p className="mt-1 text-sm font-normal text-ink-secondary">
              Quản lý tài khoản giảng viên, phân công giáo viên chủ nhiệm (GVCN) và giáo viên bộ môn cho từng lớp.
            </p>
          </div>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Thêm giáo viên</span>
          </Button>
        </div>

        {!subjectTableReady && (
          <div className="flex items-start gap-3 rounded-xl border border-status-warningBorder bg-status-warningBg p-4 text-sm text-status-warningText">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">Chưa kích hoạt bảng phân công giáo viên bộ môn</p>
              <p className="mt-1 text-xs font-normal">
                Vui lòng chạy file migration{' '}
                <code>supabase/migrations/20261122000001_class_teachers_assignment.sql</code> trên
                Supabase SQL Editor để bật chức năng gán nhiều giáo viên bộ môn cho từng lớp.
              </p>
            </div>
          </div>
        )}

        {/* Thống kê tổng quan */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface-card p-4">
            <p className="text-xs font-semibold text-ink-muted">Tổng giáo viên</p>
            <p className="mt-2 text-2xl font-bold text-brand-navy">{stats.totalTeachers}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-card p-4">
            <p className="text-xs font-semibold text-ink-muted">Đã được phân lớp</p>
            <p className="mt-2 text-2xl font-bold text-status-successText">
              {stats.assignedTeachers}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface-card p-4">
            <p className="text-xs font-semibold text-ink-muted">Chưa được phân lớp</p>
            <p className="mt-2 text-2xl font-bold text-brand-red">{stats.unassignedTeachers}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-card p-4">
            <p className="text-xs font-semibold text-ink-muted">Lớp chưa có GV chủ nhiệm</p>
            <p className="mt-2 text-2xl font-bold text-status-warningText">
              {stats.classesWithoutHomeroom}
            </p>
          </div>
        </div>

        {/* Chuyển đổi 2 góc nhìn: Theo giáo viên / Theo lớp học */}
        <div className="flex gap-2 border-b border-line pb-2" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'teachers'}
            onClick={() => setActiveTab('teachers')}
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
              activeTab === 'teachers'
                ? 'bg-brand-navy text-white'
                : 'bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
            }`}
          >
            <UserCheck className="h-4 w-4" aria-hidden="true" />
            <span>Theo giáo viên ({teachers.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'classes'}
            onClick={() => setActiveTab('classes')}
            className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors ${
              activeTab === 'classes'
                ? 'bg-brand-navy text-white'
                : 'bg-surface-card text-ink-secondary hover:bg-surface-subtle hover:text-ink-primary'
            }`}
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            <span>Phân công theo lớp ({classes.length})</span>
          </button>
        </div>

        {activeTab === 'teachers' ? (
          <>
            <section className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface-card p-4 md:grid-cols-12">
              <div className="md:col-span-6">
                <label
                  htmlFor="teacher-search"
                  className="mb-2 block text-sm font-semibold text-ink-primary"
                >
                  Tìm kiếm giáo viên hoặc tên lớp
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-ink-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="teacher-search"
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Tên GV, email, bộ môn, tên lớp (VD: UDPM24-01)..."
                    className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                  />
                </div>
              </div>

              <div className="md:col-span-3">
                <Select
                  label="Phân lớp"
                  value={assignFilter}
                  onChange={(e) => setAssignFilter(e.target.value as TeacherAssignFilter)}
                  options={[
                    { value: 'all', label: 'Tất cả' },
                    { value: 'homeroom', label: 'Có lớp chủ nhiệm' },
                    { value: 'subject', label: 'Có lớp bộ môn' },
                    { value: 'unassigned', label: 'Chưa phân lớp' },
                  ]}
                />
              </div>

              <div className="md:col-span-3">
                <Select
                  label="Trạng thái"
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')
                  }
                  options={[
                    { value: 'all', label: 'Tất cả' },
                    { value: 'active', label: 'Đang hoạt động' },
                    { value: 'inactive', label: 'Đã khóa' },
                  ]}
                />
              </div>
            </section>

            {loading ? (
              <LoadingState message="Đang tải danh sách giáo viên..." />
            ) : filteredTeachers.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title="Chưa có giáo viên phù hợp"
                description={
                  teachers.length === 0
                    ? 'Nhấn "Thêm giáo viên" để tạo tài khoản giảng viên.'
                    : 'Không tìm thấy giáo viên khớp bộ lọc hiện tại.'
                }
              />
            ) : (
              <Table
                columns={teacherColumns}
                data={filteredTeachers}
                rowKey={(row) => row.id}
                caption="Danh sách giáo viên và lớp phụ trách"
              />
            )}
          </>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface-card p-4 md:grid-cols-12">
              <div className="md:col-span-8">
                <label
                  htmlFor="class-assign-search"
                  className="mb-2 block text-sm font-semibold text-ink-primary"
                >
                  Tìm kiếm lớp học hoặc giáo viên
                </label>
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-ink-muted"
                    aria-hidden="true"
                  />
                  <input
                    id="class-assign-search"
                    type="search"
                    value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                    placeholder="Tên lớp, ngành học, tên GV chủ nhiệm hoặc GV bộ môn..."
                    className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                  />
                </div>
              </div>
              <div className="md:col-span-4">
                <Select
                  label="Tình trạng phân công"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value as ClassAssignFilter)}
                  options={[
                    { value: 'all', label: 'Tất cả lớp' },
                    { value: 'no_homeroom', label: 'Chưa có GV chủ nhiệm' },
                    { value: 'no_subject', label: 'Chưa có GV bộ môn' },
                    { value: 'assigned', label: 'Đã có giáo viên' },
                  ]}
                />
              </div>
            </section>

            {loading ? (
              <LoadingState message="Đang tải danh sách phân công lớp..." />
            ) : filteredClasses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Không có lớp học phù hợp"
                description="Không tìm thấy lớp học khớp với bộ lọc hiện tại."
              />
            ) : (
              <Table
                columns={classColumns}
                data={filteredClasses}
                rowKey={(row) => row.id}
                caption="Bảng phân công giáo viên chủ nhiệm và giáo viên bộ môn theo từng lớp"
              />
            )}
          </>
        )}
      </div>

      {/* Modal tạo giáo viên */}
      <Modal
        open={createOpen}
        onClose={() => {
          if (!creating) setCreateOpen(false);
        }}
        title="Tạo tài khoản giáo viên"
        size="md"
      >
        <form onSubmit={handleCreateTeacher} className="flex flex-col gap-4">
          <Input
            label="Họ và tên"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nguyễn Thị B"
            required
          />
          <Input
            label="Email hoặc tên tài khoản"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder={`giaovien hoặc giaovien${SCHOOL_DOMAIN}`}
            hint={
              normalizedPreview
                ? `Email sẽ tạo: ${normalizedPreview}`
                : `Có thể chỉ nhập phần trước @, hệ thống tự thêm ${SCHOOL_DOMAIN}`
            }
            required
          />
          <Input
            label="Bộ môn phụ trách chính"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="VD: Lập trình Web, Tiếng Anh, Kế toán..."
          />

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={creating}>
              Tạo giáo viên
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal sửa giáo viên */}
      <Modal
        open={Boolean(editing)}
        onClose={() => {
          if (!editSaving) setEditing(null);
        }}
        title="Cập nhật thông tin giáo viên"
        size="md"
      >
        {editing && (
          <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
            <div className="rounded-lg bg-surface-page p-4 text-xs font-normal text-ink-secondary">
              Email: <strong className="text-ink-primary">{editing.email}</strong>
            </div>
            <Input
              label="Họ và tên"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <Input
              label="Bộ môn phụ trách chính"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="VD: Lập trình Web, Tiếng Anh..."
            />
            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={editSaving}>
                Hủy
              </Button>
              <Button type="submit" variant="navy" loading={editSaving}>
                Lưu thay đổi
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Phân lớp cho 1 giáo viên (GVCN + GV bộ môn) */}
      <Modal
        open={Boolean(assignTeacher)}
        onClose={() => {
          if (!assignSaving) setAssignTeacher(null);
        }}
        title={assignTeacher ? `Phân lớp — ${assignTeacher.full_name}` : 'Phân lớp giáo viên'}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setAssignTeacher(null)}
              disabled={assignSaving}
            >
              Hủy
            </Button>
            <Button variant="primary" onClick={handleSaveTeacherAssignment} loading={assignSaving}>
              Lưu phân công
            </Button>
          </>
        }
      >
        {assignTeacher && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-page p-4 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="red">Chủ nhiệm: {homeroomDraft.size} lớp</Badge>
                <Badge tone="navy">Dạy bộ môn: {subjectDraft.size} lớp</Badge>
              </div>
              <span className="text-ink-muted">
                Bộ môn mặc định: <strong>{assignTeacher.subject || 'Chưa đặt'}</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
              <div className="relative sm:col-span-7">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Tìm tên lớp..."
                  className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                />
              </div>
              <div className="sm:col-span-5">
                <Select
                  aria-label="Lọc lớp trong hộp thoại"
                  value={assignModalFilter}
                  onChange={(e) => setAssignModalFilter(e.target.value as ModalClassFilter)}
                  options={[
                    { value: 'all', label: 'Tất cả lớp' },
                    { value: 'assigned', label: 'Đang chọn cho GV này' },
                    { value: 'no_homeroom', label: 'Lớp chưa có GVCN' },
                  ]}
                />
              </div>
            </div>

            <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-1">
              {modalFilteredClasses.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">
                  Không có lớp học phù hợp với bộ lọc.
                </p>
              ) : (
                modalFilteredClasses.map((cls) => {
                  const isHr = homeroomDraft.has(cls.id);
                  const sbState = subjectDraft.get(cls.id);
                  const isSb = Boolean(sbState?.checked);
                  const otherHr =
                    cls.teacher_id && cls.teacher_id !== assignTeacher.id
                      ? teacherById.get(cls.teacher_id)
                      : null;

                  return (
                    <div
                      key={cls.id}
                      className={`flex flex-col gap-2 rounded-xl border p-4 transition-colors ${
                        isHr || isSb
                          ? 'border-brand-navy/40 bg-brand-navySoft/30'
                          : 'border-line bg-surface-card'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-ink-primary">{cls.name}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                            {cls.subject && <span>{cls.subject}</span>}
                            {otherHr && (
                              <span className="text-status-warningText">
                                GVCN hiện tại: {otherHr.full_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-brand-red">
                            <input
                              type="checkbox"
                              checked={isHr}
                              onChange={() => toggleHomeroomDraft(cls.id)}
                              className="h-4 w-4 rounded border-line-strong text-brand-red focus:ring-brand-red"
                            />
                            <span>GV chủ nhiệm</span>
                          </label>

                          {subjectTableReady && (
                            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-brand-navy">
                              <input
                                type="checkbox"
                                checked={isSb}
                                onChange={() =>
                                  toggleSubjectDraft(cls.id, assignTeacher.subject ?? '')
                                }
                                className="h-4 w-4 rounded border-line-strong text-brand-navy focus:ring-brand-navy"
                              />
                              <span>GV bộ môn</span>
                            </label>
                          )}
                        </div>
                      </div>

                      {subjectTableReady && isSb && (
                        <input
                          type="text"
                          value={sbState?.subjectName ?? ''}
                          onChange={(e) => updateSubjectDraftName(cls.id, e.target.value)}
                          placeholder="Nhập môn giảng dạy ở lớp này (VD: Lập trình Web, Tiếng Anh)..."
                          className="h-9 w-full rounded-lg border border-line-strong bg-surface-card px-3 text-xs font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Phân công giáo viên cho 1 lớp cụ thể */}
      <Modal
        open={Boolean(assignClass)}
        onClose={() => {
          if (!classAssignSaving) setAssignClass(null);
        }}
        title={assignClass ? `Phân công giáo viên — Lớp ${assignClass.name}` : 'Phân công giáo viên'}
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setAssignClass(null)}
              disabled={classAssignSaving}
            >
              Hủy
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveClassAssignment}
              loading={classAssignSaving}
            >
              Lưu phân công
            </Button>
          </>
        }
      >
        {assignClass && (
          <div className="flex flex-col gap-6">
            <SearchableSelect
              label="Giáo viên chủ nhiệm (1 GV / lớp)"
              value={classHomeroomTeacherId}
              onChange={setClassHomeroomTeacherId}
              allowClear
              placeholder="-- Chưa phân công GV chủ nhiệm --"
              searchPlaceholder="Tìm tên, email hoặc bộ môn giáo viên..."
              options={activeTeacherOptions}
              hint="Giáo viên chủ nhiệm có quyền quản lý toàn diện lớp học này."
            />

            {subjectTableReady && (
              <div className="flex flex-col gap-4 border-t border-line pt-4">
                <div>
                  <h3 className="text-sm font-bold text-ink-primary">
                    Giáo viên bộ môn ({classSubjectRows.length})
                  </h3>
                  <p className="mt-1 text-xs font-normal text-ink-secondary">
                    Thêm các giáo viên giảng dạy từng môn học cho lớp {assignClass.name}.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-surface-page p-4 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <SearchableSelect
                      ariaLabel="Chọn giáo viên bộ môn"
                      value={newSubTeacherId}
                      onChange={(tid) => {
                        setNewSubTeacherId(tid);
                        const chosen = teacherById.get(tid);
                        if (chosen?.subject && !newSubSubjectName) {
                          setNewSubSubjectName(chosen.subject);
                        }
                      }}
                      placeholder="-- Chọn giáo viên --"
                      searchPlaceholder="Tìm tên hoặc email giáo viên..."
                      options={activeTeacherOptions}
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={newSubSubjectName}
                      onChange={(e) => setNewSubSubjectName(e.target.value)}
                      placeholder="Môn dạy (VD: Lập trình Web)..."
                      className="h-10 w-full rounded-lg border border-line-strong bg-surface-card px-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      variant="navy"
                      className="w-full"
                      onClick={handleAddSubjectTeacherRow}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      <span>Thêm</span>
                    </Button>
                  </div>
                </div>

                {classSubjectRows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line py-6 text-center text-xs text-ink-muted">
                    Chưa có giáo viên bộ môn nào được phân công cho lớp này.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {classSubjectRows.map((row) => {
                      const t = teacherById.get(row.teacherId);
                      return (
                        <div
                          key={row.teacherId}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-card p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-ink-primary">
                              {t?.full_name || 'Giáo viên'}
                            </p>
                            <p className="text-xs font-normal text-ink-muted">{t?.email}</p>
                          </div>
                          <input
                            type="text"
                            value={row.subjectName}
                            onChange={(e) =>
                              setClassSubjectRows((prev) =>
                                prev.map((item) =>
                                  item.teacherId === row.teacherId
                                    ? { ...item, subjectName: e.target.value }
                                    : item
                                )
                              )
                            }
                            placeholder="Tên môn dạy..."
                            className="h-9 w-full rounded-lg border border-line-strong bg-surface-page px-3 text-xs font-normal text-ink-primary sm:w-52"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRemoveSubjectTeacherRow(row.teacherId)}
                            aria-label={`Bỏ phân công ${t?.full_name ?? 'giáo viên'}`}
                          >
                            <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  );
}
