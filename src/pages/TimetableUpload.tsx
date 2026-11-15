import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  downloadTimetableTemplate,
  parseTimetableWorkbook,
  type ParsedTimetableResult,
} from '@/lib/timetableExcel';
import { formatDateVi, weekdayLabel } from '@/lib/week';
import type { TimetableEntryInput } from '@/types/database';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

export function TimetableUpload() {
  const toast = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedTimetableResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseTimetableWorkbook(buffer);
      setParsed(result);
      if (result.errors.length === 0 && result.entries.length > 0) {
        toast.info(`Đã đọc ${result.entries.length} buổi học từ ${file.name}`);
      } else if (result.errors.length > 0) {
        toast.error(`Phát hiện ${result.errors.length} lỗi trong file Excel`);
      }
    } catch {
      setParsed({
        entries: [],
        errors: ['Không đọc được file Excel. Vui lòng kiểm tra đúng định dạng .xlsx hoặc .xls'],
        classes: [],
        totalRows: 0,
      });
      toast.error('Không đọc được file Excel');
    } finally {
      setParsing(false);
    }
  }

  async function handleConfirmUpload() {
    if (!parsed || parsed.entries.length === 0 || parsed.errors.length > 0) return;

    setUploading(true);
    try {
      const { data, error } = await supabase.rpc('replace_timetable', {
        p_file_name: fileName || 'timetable.xlsx',
        p_entries: parsed.entries,
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success(`Đã cập nhật ${data ?? parsed.entries.length} buổi học thành công`);
      setConfirmOpen(false);
      navigate('/timetable');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tải được thời khóa biểu lên hệ thống');
    } finally {
      setUploading(false);
    }
  }

  const previewColumns: TableColumn<TimetableEntryInput>[] = [
    {
      key: 'class_name',
      header: 'Lớp',
      render: (row) => <span className="font-bold text-brand-navy">{row.class_name}</span>,
    },
    {
      key: 'weekday',
      header: 'Thứ',
      render: (row) => <span className="whitespace-nowrap">{weekdayLabel(row.weekday)}</span>,
    },
    {
      key: 'period',
      header: 'Tiết',
      render: (row) => (
        <Badge tone="navy">
          {row.period_start}
          {row.period_end > row.period_start ? `–${row.period_end}` : ''}
        </Badge>
      ),
    },
    {
      key: 'subject',
      header: 'Môn học',
      render: (row) => <span className="font-semibold text-ink-primary">{row.subject}</span>,
    },
    {
      key: 'teacher_name',
      header: 'Giáo viên',
      render: (row) => <span>{row.teacher_name || '—'}</span>,
    },
    {
      key: 'room',
      header: 'Phòng',
      render: (row) => <span>{row.room || '—'}</span>,
    },
    {
      key: 'dates',
      header: 'Từ ngày – Đến ngày',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-secondary">
          {row.date_from || row.date_to
            ? `${row.date_from ? formatDateVi(row.date_from) : '...'} – ${
                row.date_to ? formatDateVi(row.date_to) : '...'
              }`
            : 'Mọi tuần'}
        </span>
      ),
    },
    {
      key: 'note',
      header: 'Ghi chú',
      render: (row) => <span className="text-xs text-ink-muted">{row.note || '—'}</span>,
    },
  ];

  const canUpload = Boolean(parsed && parsed.entries.length > 0 && parsed.errors.length === 0);

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-2">
            <Link
              to="/timetable"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-navy hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Quay lại thời khóa biểu</span>
            </Link>
            <h1 className="text-2xl font-bold text-brand-navy">Tải thời khóa biểu từ Excel</h1>
            <p className="text-sm font-normal text-ink-secondary">
              Mỗi dòng tương ứng một buổi học. Hệ thống sẽ thay thế toàn bộ lịch cũ của các lớp có
              mặt trong file và tự động đồng bộ danh sách sang Lớp học.
            </p>
          </div>

          <Button variant="navy" onClick={downloadTimetableTemplate}>
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Tải file Excel mẫu</span>
          </Button>
        </div>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface-card p-6 lg:col-span-2">
            <h2 className="mb-4 text-base font-bold text-ink-primary">Chọn file Excel (.xlsx, .xls)</h2>
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-line-strong bg-surface-page p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-redSoft text-brand-red">
                <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-ink-primary">
                  {fileName ? `Đang chọn: ${fileName}` : 'Chưa có file nào được chọn'}
                </p>
                <p className="text-xs font-normal text-ink-muted">
                  Tối đa 5.000 dòng mỗi lần tải lên
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="sr-only"
              />
              <Button
                variant="primary"
                loading={parsing}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>{fileName ? 'Chọn file khác' : 'Chọn file Excel'}</span>
              </Button>
            </div>
          </div>

          <aside className="rounded-xl border border-line bg-surface-card p-6">
            <h2 className="mb-4 text-base font-bold text-ink-primary">Quy chuẩn cột Excel</h2>
            <ul className="flex flex-col gap-2 text-xs font-normal text-ink-secondary">
              <li>
                <span className="font-semibold text-ink-primary">Lớp*</span>: Tên lớp (VD: CNTT-K18A)
              </li>
              <li>
                <span className="font-semibold text-ink-primary">Thứ*</span>: Số 2–8 (8 = Chủ nhật)
                hoặc chữ Thứ 2..CN
              </li>
              <li>
                <span className="font-semibold text-ink-primary">Từ tiết*, Đến tiết*</span>: Số
                nguyên từ 1 đến 15
              </li>
              <li>
                <span className="font-semibold text-ink-primary">Môn học*</span>: Tên môn / học phần
              </li>
              <li>
                <span className="font-semibold text-ink-primary">Giáo viên, Phòng học, Ghi chú</span>
                : Không bắt buộc
              </li>
              <li>
                <span className="font-semibold text-ink-primary">Từ ngày, Đến ngày</span>: Định dạng
                YYYY-MM-DD hoặc DD/MM/YYYY
              </li>
            </ul>
          </aside>
        </section>

        {!parsed ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="Chưa có dữ liệu xem trước"
            description="Hãy tải file Excel mẫu về tham khảo hoặc chọn file Excel thời khóa biểu để kiểm tra trước khi lưu."
          />
        ) : (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="navy">Tổng dòng đọc: {parsed.totalRows}</Badge>
                <Badge tone="success">Hợp lệ: {parsed.entries.length}</Badge>
                {parsed.errors.length > 0 && (
                  <Badge tone="danger">Lỗi: {parsed.errors.length}</Badge>
                )}
                {parsed.classes.map((cls) => (
                  <Badge key={cls.classKey} tone="neutral">
                    {cls.className}: {cls.count} buổi
                  </Badge>
                ))}
              </div>

              <Button
                variant="primary"
                disabled={!canUpload}
                onClick={() => setConfirmOpen(true)}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Lưu thời khóa biểu</span>
              </Button>
            </div>

            {parsed.errors.length > 0 && (
              <div
                role="alert"
                className="flex flex-col gap-2 rounded-xl border border-status-dangerBorder bg-status-dangerBg p-4 text-status-dangerText"
              >
                <div className="flex items-center gap-2 text-sm font-bold">
                  <AlertCircle className="h-5 w-5" aria-hidden="true" />
                  <span>Vui lòng sửa các lỗi sau trong file Excel trước khi tải lên:</span>
                </div>
                <ul className="list-disc space-y-2 pl-6 text-xs font-normal">
                  {parsed.errors.slice(0, 20).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                  {parsed.errors.length > 20 && (
                    <li>... và {parsed.errors.length - 20} lỗi khác</li>
                  )}
                </ul>
              </div>
            )}

            {parsed.entries.length > 0 && (
              <Table
                columns={previewColumns}
                data={parsed.entries}
                rowKey={(_, idx) => String(idx)}
                caption="Xem trước dữ liệu thời khóa biểu"
              />
            )}
          </section>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmUpload}
        loading={uploading}
        confirmVariant="navy"
        confirmLabel="Xác nhận cập nhật"
        title="Xác nhận lưu thời khóa biểu"
        message={
          parsed
            ? `Thao tác này sẽ ghi ${parsed.entries.length} buổi học và thay thế toàn bộ lịch cũ của ${parsed.classes
                .map((c) => c.className)
                .join(', ')}.`
            : ''
        }
      />
    </Layout>
  );
}

