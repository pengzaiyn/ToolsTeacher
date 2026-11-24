// Lucian UX/UI Prompt #032 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#032
import { useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent } from 'react';
import { X } from 'lucide-react';
import { useLanguage, type AppLanguage } from '@/context/LanguageContext';
import './lucian-032.css';

export type DropzoneFileStatus = 'ready' | 'uploading' | 'done' | 'error';

export interface DropzoneFileItem {
  name: string;
  size?: number;
  status: DropzoneFileStatus;
  detail?: string;
}

interface FileDropzoneProps {
  accept?: string;
  hint?: string;
  actionLabel?: string;
  disabled?: boolean;
  compact?: boolean;
  fileItem?: DropzoneFileItem | null;
  onFileSelect: (file: File) => void;
  onClear?: () => void;
  onRetry?: () => void;
}

const EXT_COLORS: Record<string, string> = {
  pdf: '#C8102E',
  xlsx: '#15803D',
  xls: '#15803D',
  csv: '#1A365D',
  doc: '#2563EB',
  docx: '#2563EB',
  ppt: '#EA580C',
  pptx: '#EA580C',
  png: '#0284C7',
  jpg: '#059669',
  jpeg: '#059669',
  webp: '#059669',
  zip: '#6D28D9',
};

const COPY: Record<
  AppLanguage,
  {
    dragPrefix: string;
    browse: string;
    ready: string;
    uploading: string;
    done: string;
    error: string;
    retry: string;
    remove: string;
  }
> = {
  vi: {
    dragPrefix: 'Kéo thả tệp vào đây hoặc',
    browse: 'chọn từ máy',
    ready: 'Sẵn sàng tải lên',
    uploading: 'Đang xử lý...',
    done: 'Đã nạp thành công',
    error: 'Có lỗi khi xử lý tệp',
    retry: 'Thử lại',
    remove: 'Bỏ chọn tệp',
  },
  en: {
    dragPrefix: 'Drag files here or',
    browse: 'browse',
    ready: 'Ready to upload',
    uploading: 'Processing...',
    done: 'Loaded successfully',
    error: 'Failed to process file',
    retry: 'Retry',
    remove: 'Remove file',
  },
  zh: {
    dragPrefix: '将文件拖到此处或',
    browse: '点击选择',
    ready: '准备上传',
    uploading: '正在处理...',
    done: '已加载成功',
    error: '文件处理失败',
    retry: '重试',
    remove: '移除文件',
  },
};

function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function FileDropzone({
  accept,
  hint,
  actionLabel,
  disabled = false,
  compact = false,
  fileItem,
  onFileSelect,
  onClear,
  onRetry,
}: FileDropzoneProps) {
  const { lang } = useLanguage();
  const copy = COPY[lang];
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isOver, setIsOver] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onFileSelect(file);
  }

  function handleDragEnter(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (disabled) return;
    dragDepthRef.current += 1;
    setIsOver(true);
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  function handleDragLeave() {
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsOver(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsOver(false);
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  }

  const ext = (fileItem?.name.split('.').pop() || '').toLowerCase();
  const badgeColor = EXT_COLORS[ext] ?? '#475569';
  const progress =
    fileItem?.status === 'uploading'
      ? 0.65
      : fileItem?.status === 'done' || fileItem?.status === 'ready'
        ? 1
        : fileItem?.status === 'error'
          ? 0.62
          : 0;

  const statusText = fileItem
    ? [
        fileItem.size !== undefined ? formatBytes(fileItem.size) : null,
        fileItem.detail ??
          (fileItem.status === 'uploading'
            ? copy.uploading
            : fileItem.status === 'done'
              ? copy.done
              : fileItem.status === 'error'
                ? copy.error
                : copy.ready),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <div className={`ux u032 ${compact ? 'u032--compact' : ''} ${isOver ? 'is-over' : ''}`}>
      <button
        type="button"
        disabled={disabled}
        className="u032-zone"
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <svg className="u032-dash" aria-hidden="true">
          <rect width="100%" height="100%" rx={compact ? 17 : 21} />
        </svg>
        <span className="u032-orb" aria-hidden="true">
          <svg viewBox="0 0 28 28">
            <path d="M8.5 20.5H7a5 5 0 0 1-.6-10 7 7 0 0 1 13.4-1.6A5.5 5.5 0 0 1 21 20.5h-1.5M14 13v10M10.5 16.5L14 13l3.5 3.5" />
          </svg>
        </span>
        <b>
          {copy.dragPrefix} <em>{actionLabel ?? copy.browse}</em>
        </b>
        {hint && <small>{hint}</small>}
      </button>

      <input
        ref={inputRef}
        className="u032-file"
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleChange}
      />

      {fileItem && (
        <ul className="u032-list" aria-live="polite">
          <li
            className={`u032-row ${
              fileItem.status === 'done' || fileItem.status === 'ready'
                ? 'done'
                : fileItem.status === 'error'
                  ? 'fail'
                  : ''
            }`}
            style={{ '--p': progress } as CSSProperties}
          >
            <span
              className="u032-ic"
              style={{ '--c': badgeColor } as CSSProperties}
              aria-hidden="true"
            >
              {ext.slice(0, 4).toUpperCase() || 'FILE'}
            </span>
            <span className="u032-meta">
              <b>{fileItem.name}</b>
              <small>{statusText}</small>
            </span>

            {fileItem.status === 'uploading' && (
              <span className="u032-st">
                <span className="u032-spin" aria-hidden="true" />
              </span>
            )}

            {(fileItem.status === 'done' || fileItem.status === 'ready') && (
              <span className="u032-st" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="M3.5 8.4l3 3 6-6.4" />
                </svg>
              </span>
            )}

            {fileItem.status === 'error' && onRetry && (
              <button type="button" className="u032-retry" onClick={onRetry}>
                {copy.retry}
              </button>
            )}

            {onClear && fileItem.status !== 'uploading' && (
              <button
                type="button"
                className="u032-clear"
                aria-label={copy.remove}
                onClick={onClear}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}

            <span className="u032-bar" aria-hidden="true" />
          </li>
        </ul>
      )}
    </div>
  );
}

