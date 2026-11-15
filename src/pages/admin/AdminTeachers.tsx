import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Pencil, Plus, Search, UserCheck } from 'lucide-react';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { isValidSchoolEmail, normalizeTeacherEmail, SCHOOL_DOMAIN } from '@/lib/email';
import { manageUsers, supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import { AccountActions } from '@/components/AccountActions';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

export function AdminTeachers() {
  const toast = useToast();

  const [teachers, setTeachers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [fullName, setFullName] = useState('');
  const [subject, setSubject] = useState('');

  const [editing, setEditing] = useState<Profile | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSubject, setEditSubject] = useState('');

  const loadTeachers = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('role', 'teacher')
          .order('created_at', { ascending: false })
          .returns<Profile[]>();
        if (error) throw new Error(error.message);
        setTeachers(data ?? []);
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được danh sách giáo viên');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void loadTeachers();
  }, [loadTeachers]);

  useRealtimeRefresh({
    channelName: 'admin-teachers-realtime',
    tables: [{ table: 'profiles' }],
    onRefresh: () => loadTeachers(true),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teachers.filter((t) => {
      if (statusFilter === 'active' && !t.is_active) return false;
      if (statusFilter === 'inactive' && t.is_active) return false;
      if (!q) return true;
      return (
        t.full_name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        (t.subject ?? '').toLowerCase().includes(q)
      );
    });
  }, [teachers, search, statusFilter]);

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
      await loadTeachers();
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
      await loadTeachers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không lưu được thông tin');
    } finally {
      setEditSaving(false);
    }
  }

  const columns: TableColumn<Profile>[] = [
    {
      key: 'teacher',
      header: 'Giáo viên',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-ink-primary">{row.full_name}</span>
          <span className="text-xs font-normal text-ink-muted">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'subject',
      header: 'Chủ nhiệm môn',
      render: (row) => (
        <span className="text-sm font-normal text-ink-secondary">{row.subject || '—'}</span>
      ),
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
          <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
            <Pencil className="h-4 w-4 text-brand-navy" aria-hidden="true" />
            <span>Sửa</span>
          </Button>
          <AccountActions account={row} onUpdated={loadTeachers} />
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Quản lý giáo viên</h1>
            <p className="text-sm font-normal text-ink-secondary">
              Cấp tài khoản giảng viên bằng email nhà trường và quản lý quyền truy cập
            </p>
          </div>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Thêm giáo viên</span>
          </Button>
        </div>

        <section className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface-card p-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label htmlFor="teacher-search" className="mb-2 block text-sm font-semibold text-ink-primary">
              Tìm kiếm giáo viên
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
                placeholder="Tên, email, chủ nhiệm môn..."
                className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              />
            </div>
          </div>

          <Select
            label="Trạng thái"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            options={[
              { value: 'all', label: 'Tất cả' },
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'inactive', label: 'Đã khóa' },
            ]}
          />
        </section>

        {loading ? (
          <LoadingState message="Đang tải danh sách giáo viên..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="Chưa có giáo viên phù hợp"
            description={
              teachers.length === 0
                ? 'Nhấn "Thêm giáo viên" để tạo tài khoản giảng viên.'
                : 'Không tìm thấy giáo viên khớp bộ lọc.'
            }
          />
        ) : (
          <Table
            columns={columns}
            data={filtered}
            rowKey={(row) => row.id}
            caption="Danh sách giáo viên"
          />
        )}
      </div>

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
            label="Chủ nhiệm môn"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="VD: Ứng dụng phần mềm (UDPM)"
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
              label="Chủ nhiệm môn"
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="VD: Ứng dụng phần mềm (UDPM)"
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
    </Layout>
  );
}

