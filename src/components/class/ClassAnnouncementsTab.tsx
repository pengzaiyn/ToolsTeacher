import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { supabase } from '@/lib/supabase';
import { formatClassActionError, formatDateTimeVi } from '@/lib/classStorage';
import type { Announcement } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

interface ClassAnnouncementsTabProps {
  classId: string;
  canManage: boolean;
}

export function ClassAnnouncementsTab({ classId, canManage }: ClassAnnouncementsTabProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const { data, error } = await supabase
          .from('announcements')
          .select('*')
          .eq('class_id', classId)
          .order('created_at', { ascending: false })
          .returns<Announcement[]>();
        if (error) throw new Error(error.message);
        setItems(data ?? []);
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được thông báo lớp');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [classId, toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh({
    channelName: `class-announcements-${classId}`,
    tables: [{ table: 'announcements', filter: `class_id=eq.${classId}` }],
    onRefresh: () => load(true),
  });

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!user || !title.trim()) {
      toast.error('Vui lòng nhập tiêu đề thông báo');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('announcements').insert({
        class_id: classId,
        title: title.trim(),
        content: content.trim() || null,
        created_by: user.id,
      });
      if (error) throw new Error(error.message);
      toast.success('Đã đăng thông báo lớp');
      setCreateOpen(false);
      setTitle('');
      setContent('');
      await load();
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
      await load();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không xóa được thông báo'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-ink-primary">Thông báo của lớp</h2>
        {canManage && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Đăng thông báo</span>
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState message="Đang tải thông báo lớp..." />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Chưa có thông báo nào"
          description={
            canManage
              ? 'Đăng thông báo đầu tiên để sinh viên trong lớp theo dõi.'
              : 'Lớp học chưa có thông báo nào.'
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-card p-6 sm:flex-row sm:items-start"
            >
              <div className="flex flex-col gap-2">
                <h3 className="text-base font-bold text-ink-primary">{item.title}</h3>
                {item.content && (
                  <p className="whitespace-pre-line text-sm font-normal text-ink-secondary">
                    {item.content}
                  </p>
                )}
                <span className="text-xs font-normal text-ink-muted">
                  Đăng lúc: {formatDateTimeVi(item.created_at)}
                </span>
              </div>
              {canManage && (
                <Button size="sm" variant="secondary" onClick={() => setDeleteTarget(item)}>
                  <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                  <span>Xóa</span>
                </Button>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => {
          if (!saving) setCreateOpen(false);
        }}
        title="Đăng thông báo lớp"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            label="Tiêu đề"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="class-ann-content" className="text-sm font-semibold text-ink-primary">
              Nội dung
            </label>
            <textarea
              id="class-ann-content"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung gửi tới sinh viên trong lớp..."
              className="w-full rounded-lg border border-line-strong bg-surface-card p-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Đăng thông báo
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        confirmLabel="Xóa thông báo"
        title="Xác nhận xóa thông báo"
        message={`Bạn chắc chắn muốn xóa thông báo "${deleteTarget?.title ?? ''}"?`}
      />
    </div>
  );
}

