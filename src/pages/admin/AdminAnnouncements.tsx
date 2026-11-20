import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Eye,
  Globe,
  Megaphone,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import {
  buildAnnouncementInsertPayload,
  getAnnouncementAudienceMeta,
  resolveAnnouncementTargetType,
} from '@/lib/announcements';
import {
  classifyAnnouncementWithAI,
  quickClassifyAnnouncement,
  type AnnouncementSeverity,
} from '@/lib/announcementClassifier';
import { formatClassActionError, formatDateTimeVi } from '@/lib/classStorage';
import { supabase } from '@/lib/supabase';
import type {
  Announcement,
  AnnouncementTargetType,
  CollegeClass,
  Profile,
} from '@/types/database';
import { Layout } from '@/components/Layout';
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

type TargetFilter = 'all_scopes' | AnnouncementTargetType;
type SeverityFilter = 'all' | AnnouncementSeverity;

interface TargetOptionCard {
  value: AnnouncementTargetType;
  label: string;
  description: string;
  icon: typeof Globe;
}

const TARGET_CARDS: TargetOptionCard[] = [
  {
    value: 'all',
    label: 'Toàn trường',
    description: 'Tất cả sinh viên và giảng viên',
    icon: Globe,
  },
  {
    value: 'class',
    label: 'Riêng một lớp',
    description: 'Sinh viên và GV của lớp được chọn',
    icon: BookOpen,
  },
  {
    value: 'all_teachers',
    label: 'Toàn bộ giáo viên',
    description: 'Nội bộ giảng viên, SV không thấy',
    icon: Users,
  },
  {
    value: 'teacher',
    label: 'Riêng một giáo viên',
    description: 'Gửi đích danh tới 1 giảng viên',
    icon: UserCheck,
  },
];

export function AdminAnnouncements() {
  const { user } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<Announcement[]>([]);
  const [classes, setClasses] = useState<Pick<CollegeClass, 'id' | 'name' | 'subject'>[]>([]);
  const [teachers, setTeachers] = useState<Pick<Profile, 'id' | 'full_name' | 'email' | 'is_active'>[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all_scopes');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targetType, setTargetType] = useState<AnnouncementTargetType>('all');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [aiChecking, setAiChecking] = useState(false);
  const [aiPreviewSeverity, setAiPreviewSeverity] = useState<AnnouncementSeverity | null>(null);

  const [viewTarget, setViewTarget] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const [annRes, clsRes, teacherRes] = await Promise.all([
          supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false })
            .returns<Announcement[]>(),
          supabase
            .from('classes')
            .select('id, name, subject')
            .order('name', { ascending: true })
            .returns<Pick<CollegeClass, 'id' | 'name' | 'subject'>[]>(),
          supabase
            .from('profiles')
            .select('id, full_name, email, is_active')
            .eq('role', 'teacher')
            .order('full_name', { ascending: true })
            .returns<Pick<Profile, 'id' | 'full_name' | 'email' | 'is_active'>[]>(),
        ]);

        if (annRes.error) throw new Error(annRes.error.message);
        if (clsRes.error) throw new Error(clsRes.error.message);
        if (teacherRes.error) throw new Error(teacherRes.error.message);

        setItems(annRes.data ?? []);
        setClasses(clsRes.data ?? []);
        setTeachers(teacherRes.data ?? []);
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được danh sách thông báo');
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
    channelName: 'admin-announcements-realtime',
    tables: [{ table: 'announcements' }],
    onRefresh: () => loadData(true),
  });

  const classMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) map.set(c.id, c.name);
    return map;
  }, [classes]);

  const teacherMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of teachers) map.set(t.id, t.full_name);
    return map;
  }, [teachers]);

  const stats = useMemo(() => {
    let all = 0;
    let byClass = 0;
    let forTeachers = 0;
    for (const item of items) {
      const t = resolveAnnouncementTargetType(item);
      if (t === 'all') all += 1;
      else if (t === 'class') byClass += 1;
      else forTeachers += 1;
    }
    return {
      total: items.length,
      all,
      byClass,
      forTeachers,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const t = resolveAnnouncementTargetType(item);
      if (targetFilter !== 'all_scopes' && t !== targetFilter) return false;

      const severity = quickClassifyAnnouncement(item.title, item.content);
      if (severityFilter !== 'all' && severity !== severityFilter) return false;

      if (!q) return true;
      const clsName = item.class_id ? classMap.get(item.class_id) ?? '' : '';
      const teacherName = item.target_user_id ? teacherMap.get(item.target_user_id) ?? '' : '';
      return (
        item.title.toLowerCase().includes(q) ||
        (item.content ?? '').toLowerCase().includes(q) ||
        clsName.toLowerCase().includes(q) ||
        teacherName.toLowerCase().includes(q)
      );
    });
  }, [items, search, targetFilter, severityFilter, classMap, teacherMap]);

  const quickPreviewSeverity = useMemo(
    () => quickClassifyAnnouncement(title, content),
    [title, content]
  );
  const effectivePreviewSeverity = aiPreviewSeverity ?? quickPreviewSeverity;

  const classOptions = useMemo(
    () =>
      classes.map((c) => ({
        value: c.id,
        label: c.subject ? `${c.name} — ${c.subject}` : c.name,
      })),
    [classes]
  );

  const teacherOptions = useMemo(
    () =>
      teachers
        .filter((t) => t.is_active)
        .map((t) => ({
          value: t.id,
          label: `${t.full_name} (${t.email})`,
        })),
    [teachers]
  );

  function resetForm() {
    setTargetType('all');
    setSelectedClassId('');
    setSelectedTeacherId('');
    setTitle('');
    setContent('');
    setAiPreviewSeverity(null);
  }

  async function handleCheckWithAI() {
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề trước khi kiểm tra bằng AI');
      return;
    }
    setAiChecking(true);
    try {
      const result = await classifyAnnouncementWithAI(title.trim(), content.trim() || null);
      setAiPreviewSeverity(result);
      toast.info(
        result === 'warning'
          ? 'AI đánh giá đây là thông báo CẢNH BÁO (hiện khung đỏ khi gửi)'
          : 'AI đánh giá đây là thông báo BÌNH THƯỜNG'
      );
    } finally {
      setAiChecking(false);
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!user) return;

    const built = buildAnnouncementInsertPayload({
      targetType,
      classId: selectedClassId,
      targetUserId: selectedTeacherId,
      title,
      content,
      createdBy: user.id,
    });

    if (!built.ok) {
      toast.error(built.error);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('announcements').insert(built.payload);
      if (error) throw new Error(error.message);
      toast.success('Đã đăng thông báo thành công');
      setCreateOpen(false);
      resetForm();
      await loadData(true);
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không đăng được thông báo'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', deleteTarget.id);
      if (error) throw new Error(error.message);
      toast.success('Đã xóa thông báo');
      setDeleteTarget(null);
      if (viewTarget?.id === deleteTarget.id) setViewTarget(null);
      await loadData(true);
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không xóa được thông báo'));
    } finally {
      setDeleting(false);
    }
  }

  const columns: TableColumn<Announcement>[] = [
    {
      key: 'title',
      header: 'Thông báo',
      render: (item) => {
        const isWarning = quickClassifyAnnouncement(item.title, item.content) === 'warning';
        return (
          <div className="flex max-w-md flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink-primary">{item.title}</span>
              {isWarning && (
                <Badge tone="danger" className="gap-1">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  <span>Cảnh báo</span>
                </Badge>
              )}
            </div>
            {item.content && (
              <p className="line-clamp-2 text-xs font-normal text-ink-secondary">{item.content}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'audience',
      header: 'Phạm vi nhận',
      render: (item) => {
        const meta = getAnnouncementAudienceMeta(item, {
          className: item.class_id ? classMap.get(item.class_id) : null,
          teacherName: item.target_user_id ? teacherMap.get(item.target_user_id) : null,
        });
        return <Badge tone={meta.tone}>{meta.label}</Badge>;
      },
    },
    {
      key: 'created_at',
      header: 'Thời gian đăng',
      render: (item) => (
        <span className="whitespace-nowrap text-xs font-normal text-ink-secondary">
          {formatDateTimeVi(item.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      className: 'text-right',
      render: (item) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setViewTarget(item)}
            aria-label={`Xem thông báo ${item.title}`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            <span>Xem</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setDeleteTarget(item)}
            aria-label={`Xóa thông báo ${item.title}`}
          >
            <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
            <span>Xóa</span>
          </Button>
        </div>
      ),
    },
  ];

  const viewAudienceMeta = viewTarget
    ? getAnnouncementAudienceMeta(viewTarget, {
        className: viewTarget.class_id ? classMap.get(viewTarget.class_id) : null,
        teacherName: viewTarget.target_user_id ? teacherMap.get(viewTarget.target_user_id) : null,
      })
    : null;

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Quản lý thông báo</h1>
            <p className="mt-1 text-sm font-normal text-ink-secondary">
              Đăng và điều phối thông báo cho toàn trường, riêng từng lớp học hoặc đội ngũ giảng viên.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Đăng thông báo</span>
          </Button>
        </div>

        {/* Thống kê nhanh */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-line bg-surface-card p-4">
            <p className="text-xs font-semibold text-ink-muted">Tổng thông báo</p>
            <p className="mt-2 text-2xl font-bold text-brand-navy">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-card p-4">
            <p className="text-xs font-semibold text-ink-muted">Toàn trường</p>
            <p className="mt-2 text-2xl font-bold text-status-successText">{stats.all}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-card p-4">
            <p className="text-xs font-semibold text-ink-muted">Riêng lớp học</p>
            <p className="mt-2 text-2xl font-bold text-brand-navy">{stats.byClass}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-card p-4">
            <p className="text-xs font-semibold text-ink-muted">Dành cho giáo viên</p>
            <p className="mt-2 text-2xl font-bold text-brand-red">{stats.forTeachers}</p>
          </div>
        </div>

        {/* Bộ lọc */}
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-line bg-surface-card p-4 md:grid-cols-12">
          <div className="relative md:col-span-6">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tiêu đề, nội dung, tên lớp hoặc giáo viên..."
              aria-label="Tìm kiếm thông báo"
              className="h-10 w-full rounded-lg border border-line-strong bg-surface-card pl-10 pr-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>
          <div className="md:col-span-3">
            <Select
              aria-label="Lọc theo phạm vi nhận"
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value as TargetFilter)}
              options={[
                { value: 'all_scopes', label: 'Tất cả phạm vi' },
                { value: 'all', label: 'Toàn trường' },
                { value: 'class', label: 'Riêng lớp học' },
                { value: 'all_teachers', label: 'Toàn bộ giáo viên' },
                { value: 'teacher', label: 'Riêng một giáo viên' },
              ]}
            />
          </div>
          <div className="md:col-span-3">
            <Select
              aria-label="Lọc theo mức độ"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
              options={[
                { value: 'all', label: 'Tất cả mức độ' },
                { value: 'warning', label: 'Cảnh báo' },
                { value: 'normal', label: 'Thông báo thường' },
              ]}
            />
          </div>
        </div>

        {/* Bảng danh sách */}
        {loading ? (
          <LoadingState message="Đang tải danh sách thông báo..." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Chưa có thông báo nào"
            description={
              items.length === 0
                ? 'Nhấn "Đăng thông báo" để gửi thông báo đầu tiên tới toàn trường, lớp học hoặc giáo viên.'
                : 'Không có thông báo nào khớp với bộ lọc hiện tại.'
            }
          />
        ) : (
          <Table columns={columns} data={filtered} rowKey={(item) => item.id} />
        )}
      </div>

      {/* Modal tạo thông báo */}
      <Modal
        open={createOpen}
        onClose={() => {
          if (!saving) setCreateOpen(false);
        }}
        title="Đăng thông báo mới"
        size="lg"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink-primary">
              Đối tượng nhận thông báo <span className="text-brand-red">*</span>
            </span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TARGET_CARDS.map((opt) => {
                const Icon = opt.icon;
                const active = targetType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setTargetType(opt.value);
                      if (opt.value !== 'class') setSelectedClassId('');
                      if (opt.value !== 'teacher') setSelectedTeacherId('');
                    }}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                      active
                        ? 'border-brand-red bg-brand-redSoft/40'
                        : 'border-line bg-surface-card hover:border-line-strong hover:bg-surface-page'
                    }`}
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        active
                          ? 'bg-brand-red text-white'
                          : 'bg-surface-subtle text-brand-navy'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink-primary">{opt.label}</p>
                      <p className="mt-1 text-xs font-normal text-ink-secondary">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {targetType === 'class' && (
            <Select
              label="Chọn lớp học"
              required
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              placeholder="-- Chọn lớp nhận thông báo --"
              options={classOptions}
              hint={
                classOptions.length === 0
                  ? 'Chưa có lớp học nào trong hệ thống.'
                  : 'Sinh viên và giảng viên của lớp này sẽ nhận được thông báo ngay lập tức.'
              }
            />
          )}

          {targetType === 'teacher' && (
            <Select
              label="Chọn giáo viên"
              required
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              placeholder="-- Chọn giáo viên nhận thông báo --"
              options={teacherOptions}
              hint={
                teacherOptions.length === 0
                  ? 'Chưa có tài khoản giáo viên nào đang hoạt động.'
                  : 'Chỉ giảng viên được chọn và Hiệu trưởng mới xem được thông báo này.'
              }
            />
          )}

          <Input
            label="Tiêu đề"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setAiPreviewSeverity(null);
            }}
            placeholder="Ví dụ: Lịch nghỉ lễ hoặc CẢNH BÁO hạn nộp điểm..."
            required
          />

          <div className="flex flex-col gap-2">
            <label htmlFor="admin-ann-content" className="text-sm font-semibold text-ink-primary">
              Nội dung chi tiết
            </label>
            <textarea
              id="admin-ann-content"
              rows={5}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setAiPreviewSeverity(null);
              }}
              placeholder="Nhập nội dung thông báo..."
              className="w-full rounded-lg border border-line-strong bg-surface-card p-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>

          {/* Xem trước phân loại AI */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface-page p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-ink-secondary">
                Phân loại hiển thị popup:
              </span>
              {effectivePreviewSeverity === 'warning' ? (
                <Badge tone="danger" className="gap-1">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  <span>Cảnh báo (Khung đỏ & rung nhẹ)</span>
                </Badge>
              ) : (
                <Badge tone="navy">Thông báo thường</Badge>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleCheckWithAI}
              loading={aiChecking}
              disabled={!title.trim()}
            >
              <Sparkles className="h-4 w-4 text-brand-red" aria-hidden="true" />
              <span>Kiểm tra bằng AI</span>
            </Button>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              <Megaphone className="h-4 w-4" aria-hidden="true" />
              <span>Đăng thông báo</span>
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal xem chi tiết thông báo */}
      <Modal
        open={Boolean(viewTarget)}
        onClose={() => setViewTarget(null)}
        title="Chi tiết thông báo"
        size="md"
        footer={
          <>
            {viewTarget && (
              <Button
                variant="danger"
                onClick={() => {
                  setDeleteTarget(viewTarget);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Xóa thông báo</span>
              </Button>
            )}
            <Button variant="secondary" onClick={() => setViewTarget(null)}>
              Đóng
            </Button>
          </>
        }
      >
        {viewTarget && viewAudienceMeta && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={viewAudienceMeta.tone}>{viewAudienceMeta.label}</Badge>
              {quickClassifyAnnouncement(viewTarget.title, viewTarget.content) === 'warning' && (
                <Badge tone="danger" className="gap-1">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  <span>Cảnh báo</span>
                </Badge>
              )}
              <span className="text-xs font-normal text-ink-muted">
                {formatDateTimeVi(viewTarget.created_at)}
              </span>
            </div>
            <h3 className="text-lg font-bold text-ink-primary">{viewTarget.title}</h3>
            {viewTarget.content ? (
              <p className="whitespace-pre-line text-sm font-normal leading-relaxed text-ink-secondary">
                {viewTarget.content}
              </p>
            ) : (
              <p className="text-sm font-normal italic text-ink-muted">Không có nội dung bổ sung.</p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        confirmLabel="Xóa thông báo"
        title="Xác nhận xóa thông báo"
        message={`Bạn chắc chắn muốn xóa thông báo "${deleteTarget?.title ?? ''}"? Hành động này không thể hoàn tác.`}
      />
    </Layout>
  );
}

