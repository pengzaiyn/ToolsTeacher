import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Download, FileText, Plus, Trash2, Upload } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  MAX_MATERIAL_BYTES,
  formatClassActionError,
  formatDateTimeVi,
  formatFileSize,
  openPrivateBucketFile,
  sanitizeStorageFileName,
} from '@/lib/classStorage';
import { supabase } from '@/lib/supabase';
import type { Material } from '@/types/database';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/Spinner';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

interface ClassMaterialsTabProps {
  classId: string;
  canManage: boolean;
}

export function ClassMaterialsTab({ classId, canManage }: ClassMaterialsTabProps) {
  const { user } = useAuth();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .eq('class_id', classId)
        .order('created_at', { ascending: false })
        .returns<Material[]>();
      if (error) throw new Error(error.message);
      setMaterials(data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tải được tài liệu');
    } finally {
      setLoading(false);
    }
  }, [classId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function handlePickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MATERIAL_BYTES) {
      toast.error('Dung lượng tài liệu vượt quá giới hạn 50 MB');
      return;
    }
    setSelectedFile(file);
    if (!title.trim()) {
      const base = file.name.replace(/\.[^.]+$/, '');
      setTitle(base);
    }
  }

  async function handleUpload(event: FormEvent) {
    event.preventDefault();
    if (!user || !selectedFile) {
      toast.error('Vui lòng chọn file tài liệu');
      return;
    }
    if (!title.trim()) {
      toast.error('Vui lòng nhập tên tài liệu');
      return;
    }

    setUploading(true);
    const storagePath = `${classId}/${Date.now()}_${sanitizeStorageFileName(selectedFile.name)}`;
    try {
      const { error: upErr } = await supabase.storage
        .from('materials')
        .upload(storagePath, selectedFile, { upsert: false });

      if (upErr) throw new Error(upErr.message);

      const { error: dbErr } = await supabase.from('materials').insert({
        class_id: classId,
        title: title.trim(),
        file_url: storagePath,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        uploaded_by: user.id,
      });

      if (dbErr) {
        await supabase.storage.from('materials').remove([storagePath]);
        throw new Error(dbErr.message);
      }

      toast.success('Đã tải tài liệu lên lớp học');
      setUploadOpen(false);
      setTitle('');
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không tải được tài liệu lên'));
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(material: Material) {
    setDownloadingId(material.id);
    try {
      await openPrivateBucketFile('materials', material.file_url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không mở được tài liệu');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: dbErr } = await supabase
        .from('materials')
        .delete()
        .eq('id', deleteTarget.id);
      if (dbErr) throw new Error(dbErr.message);

      if (!/^https?:\/\//i.test(deleteTarget.file_url)) {
        await supabase.storage.from('materials').remove([deleteTarget.file_url]);
      }

      toast.success('Đã xóa tài liệu');
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(formatClassActionError(err, 'Không xóa được tài liệu'));
    } finally {
      setDeleting(false);
    }
  }

  const columns: TableColumn<Material>[] = [
    {
      key: 'title',
      header: 'Tên tài liệu',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-bold text-ink-primary">{row.title}</span>
          {row.file_name && (
            <span className="text-xs font-normal text-ink-muted">{row.file_name}</span>
          )}
        </div>
      ),
    },
    {
      key: 'size',
      header: 'Dung lượng',
      render: (row) => (
        <span className="whitespace-nowrap text-xs font-normal text-ink-secondary">
          {formatFileSize(row.file_size)}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: 'Ngày đăng',
      render: (row) => (
        <span className="whitespace-nowrap text-xs font-normal text-ink-muted">
          {formatDateTimeVi(row.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            loading={downloadingId === row.id}
            onClick={() => handleDownload(row)}
          >
            <Download className="h-4 w-4 text-brand-navy" aria-hidden="true" />
            <span>Tải về</span>
          </Button>
          {canManage && (
            <Button size="sm" variant="secondary" onClick={() => setDeleteTarget(row)}>
              <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
              <span>Xóa</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-ink-primary">Tài liệu học tập</h2>
        {canManage && (
          <Button variant="primary" onClick={() => setUploadOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Tải tài liệu lên</span>
          </Button>
        )}
      </div>

      {loading ? (
        <LoadingState message="Đang tải danh sách tài liệu..." />
      ) : materials.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Chưa có tài liệu nào"
          description={
            canManage
              ? 'Tải giáo trình, slide bài giảng hoặc tài liệu tham khảo (tối đa 50 MB).'
              : 'Lớp học chưa có tài liệu nào.'
          }
        />
      ) : (
        <Table
          columns={columns}
          data={materials}
          rowKey={(row) => row.id}
          caption="Tài liệu lớp học"
        />
      )}

      <Modal
        open={uploadOpen}
        onClose={() => {
          if (!uploading) setUploadOpen(false);
        }}
        title="Tải tài liệu lên lớp học"
      >
        <form onSubmit={handleUpload} className="flex flex-col gap-4">
          <Input
            label="Tên tài liệu"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Slide Chương 1 - Giới thiệu HTML/CSS"
            required
          />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-ink-primary">
              Chọn file (tối đa 50 MB) <span className="text-brand-red">*</span>
            </label>
            <input
              ref={fileRef}
              type="file"
              onChange={handlePickFile}
              className="sr-only"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-strong bg-surface-page p-4">
              <span className="text-sm font-normal text-ink-secondary">
                {selectedFile
                  ? `${selectedFile.name} (${formatFileSize(selectedFile.size)})`
                  : 'Chưa chọn file'}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>Chọn file</span>
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setUploadOpen(false)} disabled={uploading}>
              Hủy
            </Button>
            <Button type="submit" variant="primary" loading={uploading}>
              Tải lên
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        confirmLabel="Xóa tài liệu"
        title="Xác nhận xóa tài liệu"
        message={`Bạn chắc chắn muốn xóa tài liệu "${deleteTarget?.title ?? ''}"?`}
      />
    </div>
  );
}

