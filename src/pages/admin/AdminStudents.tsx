import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileSpreadsheet,
  Globe,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { classKey } from '@/lib/classKey';
import { normalizeStudentCode, studentEmail } from '@/lib/email';
import { fetchAllPages, manageUsers, supabase } from '@/lib/supabase';
import { formatDateVi } from '@/lib/week';
import type { Gender, Profile, TimetableClassSummary } from '@/types/database';
import { AccountActions } from '@/components/AccountActions';
import { Layout } from '@/components/Layout';
import { StudentImportModal } from '@/components/admin/StudentImportModal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

const GENDER_OPTIONS = [
  { value: '', label: 'Chưa cập nhật' },
  { value: 'Nam', label: 'Nam' },
  { value: 'Nữ', label: 'Nữ' },
  { value: 'Khác', label: 'Khác' },
];

const PAGE_SIZE = 50;

type StudentTab = 'domestic' | 'foreign' | 'all';
type SearchMode = 'all' | 'name' | 'code' | 'email' | 'class' | 'major';

const SEARCH_MODE_OPTIONS: { value: SearchMode; label: string; placeholder: string }[] = [
  { value: 'all', label: 'Tất cả thông tin', placeholder: 'Tìm tên (có/không dấu), MSV, email, lớp, ngành...' },
  { value: 'name', label: 'Họ và tên', placeholder: 'Nhập họ tên có dấu hoặc không dấu (VD: nguyen van a)...' },
  { value: 'code', label: 'Mã sinh viên', placeholder: 'Nhập MSV hoặc nhiều MSV cách nhau dấu phẩy (VD: 6111..., 5111...)...' },
  { value: 'email', label: 'Email', placeholder: 'Nhập email hoặc phần tên email...' },
  { value: 'class', label: 'Lớp học', placeholder: 'Nhập tên lớp (VD: 10A4, UDPM, SBS25)...' },
  { value: 'major', label: 'Ngành đào tạo', placeholder: 'Nhập tên hoặc mã ngành (VD: Thiết kế, CNTT, Tiếng Nhật)...' },
];

const VN_SURNAME_RE =
  /^(nguyen|tran|le|pham|hoang|huynh|phan|vu|vo|dang|bui|do|ho|ngo|duong|ly|dao|dinh|doan|truong|vuong|phung|mai|trinh|ta|ha|cao|chu|lam|luong|to|kieu|quach|tang|thach|mac|ninh|trieu|nghiem|nham|kim|la|thai|tong|uong|khong|khuat|lai|luu|lu|man|nguy|nong|sam|son|su|than|thieu|thinh|tu|vi|yen|au|bach|be|cam|chau|che|chi|cong|cung|dam|diep|giang|giap|hang|hau|hinh|khuong|khuc|lac|lan|lieu|loc|lo|luc|ma|mong|nghia|ngoc|nhu|ong|pho|phu|phuong|quang|quyen|tac|thao|thien|thoi|thuy|tieu|tinh|trang|tri|trung|tuy|ung|van|vien|vinh|xuan)\b/i;

function stripVietnamese(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

function isForeignStudent(student: Profile): boolean {
  const edu = (student.education_system ?? '').trim().toUpperCase();
  const cls = (student.class_name ?? '').trim().toUpperCase();
  const name = student.full_name.trim();
  if (edu === 'SBS' || /^SBS/.test(cls) || /-MM\b/.test(cls)) return true;
  if (name && !/[\u00C0-\u1EF9]/.test(name) && !VN_SURNAME_RE.test(name.toLowerCase())) {
    return true;
  }
  return false;
}

export function AdminStudents() {
  const toast = useToast();

  const [students, setStudents] = useState<Profile[]>([]);
  const [timetableClasses, setTimetableClasses] = useState<string[]>([]);
  const [systemClasses, setSystemClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [studentTab, setStudentTab] = useState<StudentTab>('domestic');
  const [searchMode, setSearchMode] = useState<SearchMode>('all');
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [eduFilter, setEduFilter] = useState('all');
  const [cohortFilter, setCohortFilter] = useState('all');
  const [academicFilter, setAcademicFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [className, setClassName] = useState('');
  const [admissionsAdvisor, setAdmissionsAdvisor] = useState('');
  const [educationSystem, setEducationSystem] = useState('');
  const [major, setMajor] = useState('');
  const [cohort, setCohort] = useState('');

  const [editing, setEditing] = useState<Profile | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState<Gender | ''>('');
  const [editDob, setEditDob] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editAdvisor, setEditAdvisor] = useState('');
  const [editEducationSystem, setEditEducationSystem] = useState('');
  const [editMajor, setEditMajor] = useState('');
  const [editCohort, setEditCohort] = useState('');
  const [editAcademicStatus, setEditAcademicStatus] = useState('');

  const [deleting, setDeleting] = useState<Profile | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [allStudents, { data: ttData }, { data: clsData }] = await Promise.all([
          fetchAllPages<Profile>((from, to, withCount) =>
            supabase
              .from('profiles')
              .select('*', withCount ? { count: 'exact' } : undefined)
              .eq('role', 'student')
              .order('created_at', { ascending: false })
              .range(from, to)
              .returns<Profile[]>()
          ),
          supabase.rpc('timetable_classes'),
          supabase.from('classes').select('name').order('name', { ascending: true }),
        ]);
        setStudents(allStudents);
        const ttRows = (ttData as TimetableClassSummary[] | null) ?? [];
        setTimetableClasses(ttRows.map((r) => r.class_name));
        setSystemClasses(((clsData as { name: string }[] | null) ?? []).map((r) => r.name));
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được danh sách sinh viên');
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
    channelName: 'admin-students-realtime',
    tables: [{ table: 'profiles' }, { table: 'classes' }],
    onRefresh: () => loadData(true),
  });

  const tabCounts = useMemo(() => {
    let foreign = 0;
    for (const s of students) {
      if (isForeignStudent(s)) foreign += 1;
    }
    return {
      all: students.length,
      foreign,
      domestic: students.length - foreign,
    };
  }, [students]);

  const tabStudents = useMemo(() => {
    if (studentTab === 'all') return students;
    return students.filter((s) =>
      studentTab === 'foreign' ? isForeignStudent(s) : !isForeignStudent(s)
    );
  }, [students, studentTab]);

  const classSuggestions = useMemo(() => {
    const map = new Map<string, string>();
    const sourceNames =
      studentTab === 'all'
        ? [...systemClasses, ...timetableClasses, ...tabStudents.map((s) => s.class_name ?? '')]
        : tabStudents.map((s) => s.class_name ?? '');
    sourceNames.forEach((name) => {
      const cleaned = name.trim().replace(/\s+/g, ' ');
      if (!cleaned) return;
      const key = classKey(cleaned);
      if (!map.has(key)) map.set(key, cleaned);
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [tabStudents, studentTab, timetableClasses, systemClasses]);

  const eduOptions = useMemo(() => {
    const set = new Set<string>();
    tabStudents.forEach((s) => {
      if (s.education_system?.trim()) set.add(s.education_system.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [tabStudents]);

  const cohortOptions = useMemo(() => {
    const set = new Set<string>();
    tabStudents.forEach((s) => {
      if (s.cohort?.trim()) set.add(s.cohort.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [tabStudents]);

  const academicOptions = useMemo(() => {
    const set = new Set<string>();
    tabStudents.forEach((s) => {
      if (s.academic_status?.trim()) set.add(s.academic_status.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [tabStudents]);

  const filtered = useMemo(() => {
    const rawQ = search.trim();
    const qLower = rawQ.toLowerCase();
    const qPlain = stripVietnamese(rawQ);
    const codeTokens =
      searchMode === 'code' && rawQ
        ? rawQ
            .split(/[\s,;]+/)
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean)
        : [];

    return tabStudents.filter((s) => {
      if (statusFilter === 'active' && !s.is_active) return false;
      if (statusFilter === 'inactive' && s.is_active) return false;
      if (classFilter === 'unassigned' && s.class_key) return false;
      if (classFilter !== 'all' && classFilter !== 'unassigned' && s.class_key !== classFilter) {
        return false;
      }
      if (eduFilter !== 'all' && (s.education_system ?? '').trim() !== eduFilter) return false;
      if (cohortFilter !== 'all' && (s.cohort ?? '').trim() !== cohortFilter) return false;
      if (academicFilter !== 'all' && (s.academic_status ?? '').trim() !== academicFilter) {
        return false;
      }
      if (!rawQ) return true;

      const namePlain = stripVietnamese(s.full_name);
      const codeLower = (s.student_code ?? '').toLowerCase();
      const emailLower = s.email.toLowerCase();
      const classPlain = stripVietnamese(s.class_name ?? '');
      const majorPlain = stripVietnamese(s.major ?? '');

      if (searchMode === 'name') {
        return s.full_name.toLowerCase().includes(qLower) || namePlain.includes(qPlain);
      }
      if (searchMode === 'code') {
        if (codeTokens.length > 1) {
          return codeTokens.some((tok) => codeLower.includes(tok));
        }
        return codeLower.includes(qLower);
      }
      if (searchMode === 'email') {
        return emailLower.includes(qLower);
      }
      if (searchMode === 'class') {
        return (s.class_name ?? '').toLowerCase().includes(qLower) || classPlain.includes(qPlain);
      }
      if (searchMode === 'major') {
        return (s.major ?? '').toLowerCase().includes(qLower) || majorPlain.includes(qPlain);
      }

      return (
        s.full_name.toLowerCase().includes(qLower) ||
        namePlain.includes(qPlain) ||
        emailLower.includes(qLower) ||
        codeLower.includes(qLower) ||
        (s.class_name ?? '').toLowerCase().includes(qLower) ||
        classPlain.includes(qPlain) ||
        majorPlain.includes(qPlain) ||
        stripVietnamese(s.education_system ?? '').includes(qPlain) ||
        (s.cohort ?? '').toLowerCase().includes(qLower) ||
        stripVietnamese(s.academic_status ?? '').includes(qPlain) ||
        stripVietnamese(s.admissions_advisor ?? '').includes(qPlain)
      );
    });
  }, [
    tabStudents,
    search,
    searchMode,
    classFilter,
    eduFilter,
    cohortFilter,
    academicFilter,
    statusFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [studentTab, search, searchMode, classFilter, eduFilter, cohortFilter, academicFilter, statusFilter]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    classFilter !== 'all' ||
    eduFilter !== 'all' ||
    cohortFilter !== 'all' ||
    academicFilter !== 'all' ||
    statusFilter !== 'all';

  function resetAllFilters() {
    setSearch('');
    setSearchMode('all');
    setClassFilter('all');
    setEduFilter('all');
    setCohortFilter('all');
    setAcademicFilter('all');
    setStatusFilter('all');
  }

  function handleTabChange(nextTab: StudentTab) {
    setStudentTab(nextTab);
    setClassFilter('all');
    setEduFilter('all');
    setCohortFilter('all');
    setAcademicFilter('all');
  }

  const emailPreview = useMemo(() => {
    const normalized = normalizeStudentCode(studentCode);
    if (!normalized || !fullName.trim()) return null;
    return studentEmail(fullName, normalized);
  }, [fullName, studentCode]);

  const duplicateStudentOwner = useMemo(() => {
    const normalized = normalizeStudentCode(studentCode);
    if (!normalized) return null;
    return students.find((s) => s.student_code?.trim() === normalized) ?? null;
  }, [studentCode, students]);

  const duplicateEmailOwner = useMemo(() => {
    if (!emailPreview) return null;
    const lower = emailPreview.toLowerCase();
    return students.find((s) => s.email.toLowerCase() === lower) ?? null;
  }, [emailPreview, students]);

  function resetCreateForm() {
    setFullName('');
    setGender('');
    setDateOfBirth('');
    setStudentCode('');
    setClassName('');
    setAdmissionsAdvisor('');
    setEducationSystem('');
    setMajor('');
    setCohort('');
  }

  async function handleCreateStudent(event: FormEvent) {
    event.preventDefault();
    if (!fullName.trim()) {
      toast.error('Vui lòng nhập họ tên sinh viên');
      return;
    }
    const trimmedCode = studentCode.trim();
    const normalizedCode = trimmedCode ? normalizeStudentCode(trimmedCode) : undefined;
    if (trimmedCode && !normalizedCode) {
      toast.error('Mã sinh viên phải gồm 6–20 ký tự chữ/số (hoặc nhập 7 số cuối)');
      return;
    }

    setCreating(true);
    try {
      const res = await manageUsers({
        action: 'create_student',
        full_name: fullName.trim(),
        gender: gender || undefined,
        date_of_birth: dateOfBirth || undefined,
        student_code: normalizedCode ?? undefined,
        class_name: className.trim() || undefined,
        admissions_advisor: admissionsAdvisor.trim() || undefined,
        education_system: educationSystem.trim() || undefined,
        major: major.trim() || undefined,
        cohort: cohort.trim() || undefined,
      });
      toast.success(
        `Đã tạo tài khoản sinh viên ${res.user?.full_name ?? ''} (${res.user?.email ?? ''})`
      );
      setCreateOpen(false);
      resetCreateForm();
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tạo được sinh viên');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(student: Profile) {
    setEditing(student);
    setEditName(student.full_name);
    setEditGender(student.gender ?? '');
    setEditDob(student.date_of_birth ?? '');
    setEditClass(student.class_name ?? '');
    setEditAdvisor(student.admissions_advisor ?? '');
    setEditEducationSystem(student.education_system ?? '');
    setEditMajor(student.major ?? '');
    setEditCohort(student.cohort ?? '');
    setEditAcademicStatus(student.academic_status ?? '');
  }

  async function handleSaveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    if (!editName.trim()) {
      toast.error('Vui lòng nhập họ tên sinh viên');
      return;
    }

    setEditSaving(true);
    try {
      const cleanClass = editClass.trim().replace(/\s+/g, ' ');
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editName.trim(),
          gender: editGender || null,
          date_of_birth: editDob || null,
          class_name: cleanClass || null,
          class_key: cleanClass ? classKey(cleanClass) : null,
          admissions_advisor: editAdvisor.trim() || null,
          education_system: editEducationSystem.trim() || null,
          major: editMajor.trim() || null,
          cohort: editCohort.trim() || null,
          academic_status: editAcademicStatus.trim() || null,
        })
        .eq('id', editing.id);

      if (error) throw new Error(error.message);
      toast.success(`Đã cập nhật hồ sơ sinh viên ${editName.trim()}`);
      setEditing(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không lưu được thay đổi');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    setDeletingLoading(true);
    try {
      await manageUsers({ action: 'delete_student', user_id: deleting.id });
      toast.success(`Đã xóa tài khoản sinh viên ${deleting.full_name}`);
      setDeleting(null);
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không xóa được sinh viên');
    } finally {
      setDeletingLoading(false);
    }
  }

  const columns: TableColumn<Profile>[] = [
    {
      key: 'student',
      header: 'Sinh viên',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-ink-primary">{row.full_name}</span>
          <span className="text-xs font-normal text-ink-muted">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Mã SV',
      render: (row) => (
        <span className="whitespace-nowrap font-semibold text-brand-navy">
          {row.student_code || '—'}
        </span>
      ),
    },
    {
      key: 'class',
      header: 'Lớp học',
      render: (row) =>
        row.class_name ? (
          <Badge tone="navy">{row.class_name}</Badge>
        ) : (
          <span className="text-xs font-normal text-ink-muted">Chưa gán lớp</span>
        ),
    },
    {
      key: 'bio',
      header: 'Đào tạo / Ngành',
      render: (row) => (
        <div className="flex flex-col text-xs font-normal text-ink-secondary">
          <span className="font-medium text-ink-primary">{row.major || '—'}</span>
          <span>
            {[row.education_system, row.cohort].filter(Boolean).join(' • ') ||
              [row.gender, row.date_of_birth ? formatDateVi(row.date_of_birth) : null]
                .filter(Boolean)
                .join(' • ') ||
              '—'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (row) => (
        <div className="flex flex-col items-start gap-1">
          <Badge tone={row.is_active ? 'success' : 'danger'}>
            {row.is_active ? 'Hoạt động' : 'Đã khóa'}
          </Badge>
          {row.academic_status && (
            <span className="text-xs text-ink-muted">{row.academic_status}</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4 text-brand-navy" aria-hidden="true" />
            <span>Sửa / Gán lớp</span>
          </Button>
          <AccountActions account={row} onUpdated={loadData} />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setDeleting(row)}
            title="Xóa tài khoản sinh viên"
          >
            <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
            <span>Xóa</span>
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
            <h1 className="text-2xl font-bold text-brand-navy">Quản lý sinh viên</h1>
            <p className="text-sm font-normal text-ink-secondary">
              Tạo tài khoản theo quy chuẩn nhà trường, gán lớp học và quản lý trạng thái truy cập
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              <span>Nhập từ Excel</span>
            </Button>
            <Button variant="primary" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Thêm sinh viên</span>
            </Button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Phân loại sinh viên"
          className="flex flex-wrap items-center gap-2 border-b border-line pb-3"
        >
          <button
            type="button"
            role="tab"
            aria-selected={studentTab === 'domestic'}
            onClick={() => handleTabChange('domestic')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              studentTab === 'domestic'
                ? 'bg-brand-navy text-white'
                : 'bg-surface-card text-ink-secondary hover:bg-surface-page hover:text-ink-primary'
            }`}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>Sinh viên Việt Nam</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                studentTab === 'domestic' ? 'bg-white/20 text-white' : 'bg-surface-page text-ink-muted'
              }`}
            >
              {tabCounts.domestic}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={studentTab === 'foreign'}
            onClick={() => handleTabChange('foreign')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              studentTab === 'foreign'
                ? 'bg-brand-red text-white'
                : 'bg-surface-card text-ink-secondary hover:bg-surface-page hover:text-ink-primary'
            }`}
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span>Sinh viên nước ngoài</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                studentTab === 'foreign' ? 'bg-white/20 text-white' : 'bg-surface-page text-ink-muted'
              }`}
            >
              {tabCounts.foreign}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={studentTab === 'all'}
            onClick={() => handleTabChange('all')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              studentTab === 'all'
                ? 'bg-brand-navy text-white'
                : 'bg-surface-card text-ink-secondary hover:bg-surface-page hover:text-ink-primary'
            }`}
          >
            <span>Tất cả</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                studentTab === 'all' ? 'bg-white/20 text-white' : 'bg-surface-page text-ink-muted'
              }`}
            >
              {tabCounts.all}
            </span>
          </button>
        </div>

        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <Select
                label="Tìm theo"
                value={searchMode}
                onChange={(e) => setSearchMode(e.target.value as SearchMode)}
                options={SEARCH_MODE_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: opt.label,
                }))}
              />
            </div>

            <div className="md:col-span-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="student-search" className="block text-sm font-semibold text-ink-primary">
                  Từ khóa tìm kiếm
                </label>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Xóa bộ lọc</span>
                  </button>
                )}
              </div>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-3 h-4 w-4 text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  id="student-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    SEARCH_MODE_OPTIONS.find((opt) => opt.value === searchMode)?.placeholder ??
                    'Tìm kiếm sinh viên...'
                  }
                  className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Select
              label="Lọc theo lớp"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Tất cả lớp' },
                { value: 'unassigned', label: 'Chưa gán lớp' },
                ...classSuggestions.map((cls) => ({ value: classKey(cls), label: cls })),
              ]}
            />

            <Select
              label="Hệ đào tạo"
              value={eduFilter}
              onChange={(e) => setEduFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Tất cả hệ' },
                ...eduOptions.map((edu) => ({ value: edu, label: edu })),
              ]}
            />

            <Select
              label="Khóa"
              value={cohortFilter}
              onChange={(e) => setCohortFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Tất cả khóa' },
                ...cohortOptions.map((c) => ({ value: c, label: c })),
              ]}
            />

            <Select
              label="Tình trạng học"
              value={academicFilter}
              onChange={(e) => setAcademicFilter(e.target.value)}
              options={[
                { value: 'all', label: 'Tất cả tình trạng' },
                ...academicOptions.map((st) => ({ value: st, label: st })),
              ]}
            />

            <Select
              label="Tài khoản"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              options={[
                { value: 'all', label: 'Tất cả' },
                { value: 'active', label: 'Đang hoạt động' },
                { value: 'inactive', label: 'Đã khóa' },
              ]}
            />
          </div>
        </section>

        {loading ? (
          <LoadingState message="Đang tải danh sách sinh viên..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Chưa có sinh viên phù hợp"
            description={
              students.length === 0
                ? 'Nhấn "Thêm sinh viên" để tạo tài khoản sinh viên đầu tiên.'
                : 'Không tìm thấy sinh viên khớp bộ lọc hiện tại.'
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {(() => {
              const startPage = Math.max(1, currentPage - 2);
              const endPage = Math.min(totalPages, currentPage + 2);
              const pageNumbers: number[] = [];
              for (let p = startPage; p <= endPage; p += 1) pageNumbers.push(p);

              const paginationBar = (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-card px-4 py-2 text-xs text-ink-secondary">
                  <span>
                    Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–
                    {Math.min(currentPage * PAGE_SIZE, filtered.length)} trên tổng{' '}
                    <strong className="text-ink-primary">{filtered.length}</strong> sinh viên
                  </span>
                  {totalPages > 1 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={currentPage <= 1}
                        onClick={() => setPage(1)}
                        title="Trang đầu"
                        aria-label="Trang đầu"
                      >
                        <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={currentPage <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        title="Trang trước"
                        aria-label="Trang trước"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      {startPage > 1 && <span className="px-1 text-ink-muted">...</span>}
                      {pageNumbers.map((p) => (
                        <Button
                          key={p}
                          size="sm"
                          variant={p === currentPage ? 'navy' : 'secondary'}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </Button>
                      ))}
                      {endPage < totalPages && <span className="px-1 text-ink-muted">...</span>}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={currentPage >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        title="Trang sau"
                        aria-label="Trang sau"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={currentPage >= totalPages}
                        onClick={() => setPage(totalPages)}
                        title="Trang cuối"
                        aria-label="Trang cuối"
                      >
                        <ChevronsRight className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </div>
              );

              return (
                <>
                  {paginationBar}
                  <Table
                    columns={columns}
                    data={paginated}
                    rowKey={(row) => row.id}
                    caption="Danh sách sinh viên"
                  />
                  {paginationBar}
                </>
              );
            })()}
          </div>
        )}
      </div>

      <datalist id="class-suggestions-list">
        {classSuggestions.map((cls) => (
          <option key={cls} value={cls} />
        ))}
      </datalist>

      <Modal
        open={createOpen}
        onClose={() => {
          if (!creating) setCreateOpen(false);
        }}
        title="Tạo tài khoản sinh viên"
        size="lg"
      >
        <form onSubmit={handleCreateStudent} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Họ và tên"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nguyễn Văn A"
              required
            />
            <Select
              label="Giới tính (tùy chọn)"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender | '')}
              options={GENDER_OPTIONS}
            />
            <Input
              label="Ngày sinh (tùy chọn)"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
            />
            <Input
              label="Mã sinh viên (tùy chọn)"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="VD: 61112600002, 5111..., N811..."
              hint="Nhập mã sinh viên (6–20 ký tự), 7 số cuối, hoặc để trống hệ thống tự cấp."
            />
            <Input
              label="Lớp học"
              list="class-suggestions-list"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="VD: 10A4 hoặc UDPM26A-01"
              hint="Chọn lớp có sẵn hoặc nhập tên mới; sinh viên sẽ tự động được xếp vào lớp học và xem được TKB."
            />
            <Input
              label="Hệ đào tạo"
              value={educationSystem}
              onChange={(e) => setEducationSystem(e.target.value)}
              placeholder="VD: CAO ĐẲNG CHÍNH QUY / 9+ 7 MÔN"
            />
            <Input
              label="Ngành đào tạo"
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              placeholder="VD: Công nghệ thông tin (UDPM)"
            />
            <Input
              label="Khóa"
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              placeholder="VD: K26"
            />
            <Input
              label="Tư vấn tuyển sinh"
              value={admissionsAdvisor}
              onChange={(e) => setAdmissionsAdvisor(e.target.value)}
              placeholder="Họ tên cán bộ tư vấn"
            />
          </div>

          <div className="rounded-lg bg-surface-page p-4 text-xs font-normal text-ink-secondary">
            {emailPreview ? (
              <span>
                Email đăng nhập dự kiến:{' '}
                <strong className="font-semibold text-brand-navy">{emailPreview}</strong>
              </span>
            ) : (
              <span>
                Email sinh viên sẽ được tự động tạo từ tên + 8 số cuối mã sinh viên với đuôi{' '}
                <strong className="font-semibold text-brand-navy">
                  @caodangvietmyhanoi.edu.vn
                </strong>
                . Mật khẩu ban đầu dùng mật khẩu mặc định của hệ thống.
              </span>
            )}
          </div>

          {(duplicateStudentOwner || duplicateEmailOwner) && (
            <div className="flex flex-col gap-2 rounded-lg border border-status-dangerBorder bg-status-dangerBg p-3 text-xs text-status-dangerText">
              <p className="font-semibold">
                {duplicateStudentOwner
                  ? `Mã sinh viên ${duplicateStudentOwner.student_code} đã thuộc về ${duplicateStudentOwner.full_name} (${duplicateStudentOwner.email}).`
                  : `Email dự kiến ${emailPreview} đã thuộc về ${duplicateEmailOwner?.full_name}.`}
              </p>
              <div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setStudentCode('')}
                >
                  Xóa mã để hệ thống tự cấp mã mới
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={creating}
              disabled={Boolean(duplicateStudentOwner || duplicateEmailOwner)}
            >
              Tạo sinh viên
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        onClose={() => {
          if (!editSaving) setEditing(null);
        }}
        title="Chỉnh sửa hồ sơ & gán lớp"
        size="md"
      >
        {editing && (
          <form onSubmit={handleSaveEdit} className="flex flex-col gap-4">
            <div className="rounded-lg bg-surface-page p-4 text-xs font-normal text-ink-secondary">
              <p>
                Email: <strong className="text-ink-primary">{editing.email}</strong>
              </p>
              <p className="mt-2">
                Mã sinh viên:{' '}
                <strong className="text-brand-navy">{editing.student_code || '—'}</strong>
              </p>
            </div>

            <Input
              label="Họ và tên"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Giới tính"
                value={editGender}
                onChange={(e) => setEditGender(e.target.value as Gender | '')}
                options={GENDER_OPTIONS}
              />
              <Input
                label="Ngày sinh"
                type="date"
                value={editDob}
                onChange={(e) => setEditDob(e.target.value)}
              />
              <Input
                label="Hệ đào tạo"
                value={editEducationSystem}
                onChange={(e) => setEditEducationSystem(e.target.value)}
              />
              <Input
                label="Ngành đào tạo"
                value={editMajor}
                onChange={(e) => setEditMajor(e.target.value)}
              />
              <Input
                label="Khóa"
                value={editCohort}
                onChange={(e) => setEditCohort(e.target.value)}
              />
              <Input
                label="Trạng thái học tập"
                value={editAcademicStatus}
                onChange={(e) => setEditAcademicStatus(e.target.value)}
                placeholder="VD: Đang học, Bảo lưu, Thôi học..."
              />
            </div>
            <Input
              label="Lớp học"
              list="class-suggestions-list"
              value={editClass}
              onChange={(e) => setEditClass(e.target.value)}
              placeholder="VD: CNTT-K18A"
              hint="Chọn lớp có sẵn hoặc nhập tên mới; sinh viên sẽ tự động được xếp vào lớp học và xem được TKB."
            />
            <Input
              label="Tư vấn tuyển sinh"
              value={editAdvisor}
              onChange={(e) => setEditAdvisor(e.target.value)}
            />

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button
                variant="secondary"
                onClick={() => setEditing(null)}
                disabled={editSaving}
              >
                Hủy
              </Button>
              <Button type="submit" variant="navy" loading={editSaving}>
                Lưu thay đổi
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleConfirmDelete}
        loading={deletingLoading}
        confirmVariant="danger"
        confirmLabel="Xóa sinh viên"
        title="Xác nhận xóa sinh viên"
        message={
          deleting
            ? `Bạn chắc chắn muốn xóa vĩnh viễn tài khoản sinh viên ${deleting.full_name}${
                deleting.student_code ? ` (${deleting.student_code})` : ''
              }? Toàn bộ ghi danh lớp học và bài nộp liên quan sẽ bị xóa và không thể khôi phục.`
            : ''
        }
      />
      <StudentImportModal
        open={importOpen}
        existingStudents={students}
        onClose={() => setImportOpen(false)}
        onImported={loadData}
      />
    </Layout>
  );
}
