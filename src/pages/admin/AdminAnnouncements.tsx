import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { supabase } from '@/lib/supabase';
import { formatDateVi } from '@/lib/week';
import type { Announcement } from '@/types/database';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

export function AdminAnnouncements() {
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
          .is('class_id', null)
          .order('created_at', { ascending: false })
          .returns<Announcement[]>();

        if (error) throw new Error(error.message);
        setItems(data ?? []);
      } catch (err) {
        if (!silent) {
          toast.error(err instanceof Error ? err.message : 'Không tải được thông báo');
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh({
    channelName: 'admin-announcements-realtime',
    tables: [{ table: 'announcements' }],
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
        class_id: null,
        title: title.trim(),
        content: content.trim() || null,
        created_by: user.id,
      });
      if (error) throw new Error(error.message);
      toast.success('Đã đăng thông báo toàn trường');
      setCreateOpen(false);
      setTitle('');
      setContent('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tạo được thông báo');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw new Error(error.message);
      toast.success('Đã xóa thông báo');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không xóa được thông báo');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Thông báo toàn trường</h1>
            <p className="text-sm font-normal text-ink-secondary">
              Thông báo hiển thị trên trung tâm công cụ cho giáo viên và sinh viên
            </p>
          </div>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Đăng thông báo</span>
          </Button>
        </div>

        {loading ? (
          <LoadingState message="Đang tải thông báo..." />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Chưa có thông báo nào"
            description="Nhấn Đăng thông báo để gửi thông tin tới toàn trường."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <article
                key={item.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-line bg-surface-card p-6 sm:flex-row sm:items-start"
              >
                <div className="flex flex-col gap-2">
                  <h2 className="text-base font-bold text-ink-primary">{item.title}</h2>
                  {item.content && (
                    <p className="whitespace-pre-line text-sm font-normal text-ink-secondary">
                      {item.content}
                    </p>
                  )}
                  <span className="text-xs font-normal text-ink-muted">
                    Ngày đăng: {formatDateVi(item.created_at)}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDeleteTarget(item)}
                  aria-label="Xóa thông báo"
                >
                  <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                  <span>Xóa</span>
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => {
          if (!saving) setCreateOpen(false);
        }}
        title="Đăng thông báo toàn trường"
      >
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            label="Tiêu đề"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="ann-content" className="text-sm font-semibold text-ink-primary">
              Nội dung
            </label>
            <textarea
              id="ann-content"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung thông báo..."
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
    </Layout>
  );
}

