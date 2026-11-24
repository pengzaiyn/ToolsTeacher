import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  downloadTimetableTemplate,
  parseTimetableCsvText,
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
import { FileDropzone } from '@/components/ui/FileDropzone';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

export function TimetableUpload() {
  const toast = useToast();
  const navigate = useNavigate();

  const [sourceMode, setSourceMode] = useState<'file' | 'paste'>('file');
  const [fileName, setFileName] = useState<string>('');
  const [csvText, setCsvText] = useState<string>('');
  const [parsed, setParsed] = useState<ParsedTimetableResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [fileSize, setFileSize] = useState<number | undefined>(undefined);
  const [lastFile, setLastFile] = useState<File | null>(null);

  async function processSelectedFile(file: File) {
    setLastFile(file);
    setParsing(true);
    setFileName(file.name);
    setFileSize(file.size);
    try {
      let result: ParsedTimetableResult;
      if (/\.csv$/i.test(file.name)) {
        const text = await file.text();
        result = parseTimetableCsvText(text);
      } else {
        const buffer = await file.arrayBuffer();
        result = parseTimetableWorkbook(buffer);
      }
      setParsed(result);
      if (result.errors.length === 0 && result.entries.length > 0) {
        const semInfo =
          result.semesters.length > 0 ? ` (${result.semesters.length} kỳ học)` : '';
        toast.info(`Đã đọc ${result.entries.length} buổi học${semInfo} từ ${file.name}`);
      } else if (result.errors.length > 0) {
        toast.error(`Phát hiện ${result.errors.length} lỗi trong file`);
      }
    } catch {
      setParsed({
        entries: [],
        errors: ['Không đọc được file. Vui lòng kiểm tra đúng định dạng .xlsx, .xls hoặc .csv'],
        classes: [],
        semesters: [],
        format: 'school',
        totalRows: 0,
      });
      toast.error('Không đọc được file thời khóa biểu');
    } finally {
      setParsing(false);
    }
  }

  function handleParsePastedCsv() {
    if (!csvText.trim()) {
      toast.error('Vui lòng dán nội dung CSV thời khóa biểu trước');
      return;
    }
    setParsing(true);
    setFileName('thoi-khoa-bieu-dan-truc-tiep.csv');
    try {
      const result = parseTimetableCsvText(csvText);
      setParsed(result);
      if (result.errors.length === 0 && result.entries.length > 0) {
        toast.success(
          `Đã phân tích ${result.entries.length} buổi học (${result.semesters.length} kỳ học)`
        );
      } else if (result.errors.length > 0) {
        toast.error(`Phát hiện ${result.errors.length} lỗi trong dữ liệu dán`);
      }
    } catch {
      toast.error('Không phân tích được dữ liệu dán');
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
      key: 'semester',
      header: 'Học kỳ',
      render: (row) => (
        <Badge tone="navy">{row.semester || '—'}</Badge>
      ),
    },
    {
      key: 'class_name',
      header: 'Lớp',
      render: (row) => <span className="font-bold text-brand-navy">{row.class_name}</span>,
    },
    {
      key: 'subject',
      header: 'Môn học',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-ink-primary">{row.subject}</span>
          {row.is_internship && <Badge tone="warning">Thực tập</Badge>}
        </div>
      ),
    },
    {
      key: 'weekday',
      header: 'Thứ',
      render: (row) => (
        <span className="whitespace-nowrap">
          {row.is_internship ? 'Theo đợt' : weekdayLabel(row.weekday)}
        </span>
      ),
    },
    {
      key: 'time',
      header: 'Giờ học',
      render: (row) => (
        <Badge tone="red">
          {row.is_internship
            ? 'Thực tập'
            : row.time_range ||
              `Tiết ${row.period_start}${row.period_end > row.period_start ? `–${row.period_end}` : ''}`}
        </Badge>
      ),
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
      key: 'room',
      header: 'Phòng',
      render: (row) => <span>{row.room || '—'}</span>,
    },
    {
      key: 'teacher_name',
      header: 'Giảng viên',
      render: (row) => <span>{row.teacher_name || '—'}</span>,
    },
    {
      key: 'exam_date',
      header: 'Dự kiến thi',
      render: (row) => (
        <span className="whitespace-nowrap text-xs font-semibold text-brand-red">
          {row.exam_date ? formatDateVi(row.exam_date) : '—'}
        </span>
      ),
    },
    {
      key: 'credits',
      header: 'Tiết / TC',
      render: (row) => (
        <span className="whitespace-nowrap text-xs text-ink-secondary">
          {row.total_periods ? `${row.total_periods}t` : '—'}
          {row.credits ? ` • ${row.credits} TC` : ''}
        </span>
      ),
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
            <h1 className="text-2xl font-bold text-brand-navy">
              Tải thời khóa biểu theo mẫu Phòng Đào tạo
            </h1>
            <p className="text-sm font-normal text-ink-secondary">
              Hỗ trợ trực tiếp file Excel/CSV 7 kỳ học của từng lớp (HK1, HK2, HK3, HK4, HK5+6+7).
              Hệ thống sẽ thay thế toàn bộ lịch cũ của lớp có trong file và tự đồng bộ sang Lớp học.
            </p>
          </div>

          <Button variant="navy" onClick={downloadTimetableTemplate}>
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Tải file Excel mẫu 7 kỳ</span>
          </Button>
        </div>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6 lg:col-span-2">
            <div className="flex flex-wrap items-center gap-2 border-b border-line pb-4">
              <Button
                size="sm"
                variant={sourceMode === 'file' ? 'navy' : 'secondary'}
                onClick={() => setSourceMode('file')}
              >
                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                <span>Tải file Excel / CSV</span>
              </Button>
              <Button
                size="sm"
                variant={sourceMode === 'paste' ? 'navy' : 'secondary'}
                onClick={() => setSourceMode('paste')}
              >
                <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
                <span>Dán dữ liệu CSV trực tiếp</span>
              </Button>
            </div>

            {sourceMode === 'file' ? (
              <FileDropzone
                accept=".xlsx,.xls,.csv"
                hint="Hỗ trợ .xlsx, .xls, .csv · Tối đa 5.000 dòng mỗi lần tải lên"
                disabled={parsing || uploading}
                fileItem={
                  fileName
                    ? {
                        name: fileName,
                        size: fileSize,
                        status: parsing
                          ? 'uploading'
                          : parsed && parsed.errors.length > 0
                            ? 'error'
                            : 'done',
                        detail: parsing
                          ? 'Đang phân tích file...'
                          : parsed && parsed.errors.length > 0
                            ? `Phát hiện ${parsed.errors.length} lỗi`
                            : parsed
                              ? `${parsed.entries.length} buổi học`
                              : undefined,
                      }
                    : null
                }
                onFileSelect={(file) => void processSelectedFile(file)}
                onRetry={lastFile ? () => void processSelectedFile(lastFile) : undefined}
                onClear={() => {
                  setFileName('');
                  setFileSize(undefined);
                  setLastFile(null);
                  setParsed(null);
                }}
              />
            ) : (
              <div className="flex flex-col gap-3">
                <label htmlFor="timetable-csv-paste" className="text-sm font-semibold text-ink-primary">
                  Dán toàn bộ nội dung CSV mẫu Phòng Đào tạo (HK1 → HK5+6+7)
                </label>
                <textarea
                  id="timetable-csv-paste"
                  rows={8}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="HK1,,,,,,,,,,,,,,&#10;TRƯỜNG CAO ĐẲNG VIỆT MỸ HÀ NỘI,,,,,THỜI KHÓA BIỂU..."
                  className="w-full rounded-lg border border-line-strong bg-surface-page p-3 font-mono text-xs text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
                />
                <div className="flex justify-end">
                  <Button variant="primary" loading={parsing} onClick={handleParsePastedCsv}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Phân tích dữ liệu dán</span>
                  </Button>
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-xl border border-line bg-surface-card p-6">
            <h2 className="mb-4 text-base font-bold text-ink-primary">
              Định dạng hỗ trợ tự động
            </h2>
            <ul className="flex flex-col gap-2 text-xs font-normal text-ink-secondary">
              <li>
                <span className="font-semibold text-ink-primary">Mẫu chuẩn 7 kỳ của trường</span>:
                Đọc nguyên file Phòng Đào tạo gồm HK1, HK2, HK3, HK4 và HK5+6+7 xếp dọc trong 1 sheet
                hoặc nhiều sheet.
              </li>
              <li>
                <span className="font-semibold text-ink-primary">Nhiều thứ trong 1 ô</span>: Tự tách
                các dòng như &ldquo;Thứ Ba / Thứ Năm&rdquo; thành 2 buổi học riêng trên lưới tuần.
              </li>
              <li>
                <span className="font-semibold text-ink-primary">Giờ học &amp; Ngày thi</span>: Giữ
                nguyên giờ học thật (7:30-12:15, 13:00-17:00), Dự kiến ngày thi, Tổng số tiết và Số
                tín chỉ.
              </li>
              <li>
                <span className="font-semibold text-ink-primary">Môn Thực tập</span>: Tự nhận diện
                các đợt Thực tập nhận thức / Thực tập tốt nghiệp không cố định thứ để hiển thị riêng
                trong tuần.
              </li>
              <li>
                <span className="font-semibold text-ink-primary">Định dạng ngày</span>: Hỗ trợ cả
                YYYY-MM-DD và DD/MM/YYYY trong cùng 1 file.
              </li>
            </ul>
          </aside>
        </section>

        {!parsed ? (
          <EmptyState
            icon={FileSpreadsheet}
            title="Chưa có dữ liệu xem trước"
            description="Hãy chọn file Excel/CSV thời khóa biểu 7 kỳ của lớp hoặc dán trực tiếp nội dung CSV để kiểm tra trước khi lưu."
          />
        ) : (
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="navy">
                  {parsed.format === 'school' ? 'Mẫu Phòng Đào tạo' : 'Mẫu bảng phẳng'}
                </Badge>
                <Badge tone="success">Hợp lệ: {parsed.entries.length} buổi</Badge>
                {parsed.errors.length > 0 && (
                  <Badge tone="danger">Lỗi: {parsed.errors.length}</Badge>
                )}
                {parsed.classes.map((cls) => (
                  <Badge key={cls.classKey} tone="neutral">
                    Lớp {cls.className}: {cls.count} buổi
                  </Badge>
                ))}
                {parsed.semesters.map((sem) => (
                  <Badge key={`${sem.className}-${sem.semester}`} tone="navy">
                    {sem.semester}: {sem.count}
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
                  <span>Vui lòng sửa các lỗi sau trước khi tải lên:</span>
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
        confirmVariant="primary"
        confirmLabel="Xác nhận lưu"
        title="Xác nhận cập nhật thời khóa biểu"
        message={
          parsed
            ? `Hệ thống sẽ thay thế toàn bộ thời khóa biểu cũ của ${parsed.classes
                .map((c) => c.className)
                .join(', ')} bằng ${parsed.entries.length} buổi học (${
                parsed.semesters.length
              } kỳ học) mới.`
            : ''
        }
      />
    </Layout>
  );
}
