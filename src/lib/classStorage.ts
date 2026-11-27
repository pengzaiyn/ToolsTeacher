import { supabase } from '@/lib/supabase';

export const MAX_MATERIAL_BYTES = 50 * 1024 * 1024; // 50 MB theo cấu hình bucket materials
export const MAX_SUBMISSION_BYTES = 25 * 1024 * 1024; // 25 MB theo cấu hình bucket submissions

export function sanitizeStorageFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const dotIdx = trimmed.lastIndexOf('.');
  const base = dotIdx > 0 ? trimmed.slice(0, dotIdx) : trimmed;
  const ext = dotIdx > 0 ? trimmed.slice(dotIdx).toLowerCase().replace(/[^a-z0-9.]/g, '') : '';
  const safeBase = base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

  return `${safeBase || 'tep'}${ext}`;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDateTimeVi(iso?: string | null): string {
  if (!iso) return 'Không giới hạn';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

const IMAGE_EXT_REGEX = /\.(jpe?g|png|webp|gif|bmp|svg|heic|heif|avif)(?:$|\?)/i;

export function isImageStoragePath(pathOrName?: string | null): boolean {
  if (!pathOrName) return false;
  return IMAGE_EXT_REGEX.test(pathOrName.trim());
}

export function isImageFile(file: Pick<File, 'name' | 'type'>): boolean {
  if (file.type && file.type.toLowerCase().startsWith('image/')) return true;
  return isImageStoragePath(file.name);
}

export async function getPrivateBucketSignedUrl(
  bucket: 'materials' | 'submissions',
  pathOrUrl: string,
  expiresInSeconds = 600
): Promise<string> {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(pathOrUrl, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error('Không tạo được liên kết tải file, vui lòng thử lại');
  }

  return data.signedUrl;
}

export async function openPrivateBucketFile(
  bucket: 'materials' | 'submissions',
  pathOrUrl: string
): Promise<void> {
  const signedUrl = await getPrivateBucketSignedUrl(bucket, pathOrUrl, 300);
  window.open(signedUrl, '_blank', 'noopener,noreferrer');
}

export function formatClassActionError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!message) return fallback;
  const lower = message.toLowerCase();
  if (lower.includes('classes_class_key_uidx') || lower.includes('duplicate key')) {
    return 'Tên lớp học này đã tồn tại trong hệ thống.';
  }
  if (lower.includes('null value in column "teacher_id"') || lower.includes('not-null constraint')) {
    return 'CSDL Supabase chưa cho phép để trống giáo viên phụ trách. Vui lòng chạy migration supabase/migrations/20261115000002_nullable_class_teacher.sql trong SQL Editor.';
  }
  if (lower.includes('row-level security') || lower.includes('violates row-level security')) {
    return 'Thao tác bị từ chối (có thể đã hết thời gian nộp bài hoặc bạn không có quyền thực hiện).';
  }
  return message;
}

