import { type ChangeEvent, type DragEvent, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  XCircle,
} from 'lucide-react';
import { classKey } from '@/lib/classKey';
import {
  downloadStudentImportTemplate,
  parseStudentImportWorkbook,
  type StudentImportParseResult,
  type StudentImportRow,
} from '@/lib/studentImportExcel';
import { manageUsers, supabase } from '@/lib/supabase';
import { formatDateVi } from '@/lib/week';
import type { Gender, Profile } from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useToast } from '@/components/ui/Toast';

export type DuplicateStrategy = 'skip' | 'auto_code' | 'update';

interface StudentImportModalProps {
  open: boolean;
  existingStudents: Profile[];
  onClose: () => void;
  onImported: () => void | Promise<void>;
}

interface ImportFailure {
  rowNumber: number;
  fullName: string;
  reason: string;
}

export function StudentImportModal({
  open,
  existingStudents,
  onClose,
  onImported,
}: StudentImportModalProps) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<StudentImportParseResult | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progressDone, setProgressDone] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [importSummary, setImportSummary] = useState<{
    created: number;
    updated: number;
    skipped: number;
    failures: ImportFailure[];
  } | null>(null);

  const actionablePlan = useMemo(() => {
    if (!parsed) {
      return { createCount: 0, updateCount: 0, skipCount: 0, totalActionable: 0 };
    }

    const cleanRows = parsed.rows.filter((r) => !r.error && r.duplicateType === 'none');
    const dupRows = parsed.rows.filter((r) => !r.error && r.duplicateType !== 'none');

    if (duplicateStrategy === 'skip') {
      return {
        createCount: cleanRows.length,
        updateCount: 0,
        skipCount: dupRows.length + parsed.errorCount,
        totalActionable: cleanRows.length,
      };
    }

    if (duplicateStrategy === 'auto_code') {
      return {
        createCount: cleanRows.length + dupRows.length,
        updateCount: 0,
        skipCount: parsed.errorCount,
        totalActionable: cleanRows.length + dupRows.length,
      };
    }

    const updatableRows = dupRows.filter((r) => Boolean(r.existingStudentId));
    return {
      createCount: cleanRows.length,
      updateCount: updatableRows.length,
      skipCount: dupRows.length - updatableRows.length + parsed.errorCount,
      totalActionable: cleanRows.length + updatableRows.length,
    };
  }, [parsed, duplicateStrategy]);

  function resetState() {
    setFileName('');
    setParsed(null);
    setDuplicateStrategy('skip');
    setImportSummary(null);
    setProgressDone(0);
    setProgressTotal(0);
    setConfirmOpen(false);
  }

  function handleClose() {
    if (importing) return;
    resetState();
    onClose();
  }

  async function processFile(file: File) {
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      toast.error('Vui lòng chọn file Excel (.xlsx hoặc .xls)');
      return;
    }

    setParsing(true);
    setImportSummary(null);
    try {
      const result = await parseStudentImportWorkbook(file, existingStudents);
      setFileName(file.name);
      setParsed(result);
      toast.success(`Đã đọc ${result.rows.length} dòng từ sheet "${result.sheetName}"`);
    } catch (err) {
      setParsed(null);
      setFileName('');
      toast.error(err instanceof Error ? err.message : 'Không đọc được file Excel');
    } finally {
      setParsing(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void processFile(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void processFile(file);
  }

  async function handleConfirmImport() {
    if (!parsed) return;

    const cleanRows = parsed.rows.filter((r) => !r.error && r.duplicateType === 'none');
    const dupRows = parsed.rows.filter((r) => !r.error && r.duplicateType !== 'none');

    type TaskItem =
      | { kind: 'create'; row: StudentImportRow; useAutoCode: boolean }
      | { kind: 'update'; row: StudentImportRow };

    const tasks: TaskItem[] = cleanRows.map((row) => ({
      kind: 'create',
      row,
      useAutoCode: false,
    }));

    if (duplicateStrategy === 'auto_code') {
      dupRows.forEach((row) => {
        tasks.push({ kind: 'create', row, useAutoCode: true });
      });
    } else if (duplicateStrategy === 'update') {
      dupRows.forEach((row) => {
        if (row.existingStudentId) {
          tasks.push({ kind: 'update', row });
        }
      });
    }

    if (tasks.length === 0) return;

    setConfirmOpen(false);
    setImporting(true);
    setProgressDone(0);
    setProgressTotal(tasks.length);

    let created = 0;
    let updated = 0;
    const failures: ImportFailure[] = [];

    for (let i = 0; i < tasks.length; i += 1) {
      const task = tasks[i];
      const { row } = task;
      try {
        if (task.kind === 'create') {
          await manageUsers({
            action: 'create_student',
            full_name: row.fullName,
            gender: row.gender as Gender,
            date_of_birth: row.dateOfBirth,
            student_code: task.useAutoCode ? undefined : row.studentCode || undefined,
            class_name: row.className || undefined,
            admissions_advisor: row.admissionsAdvisor || undefined,
          });
          created += 1;
        } else if (row.existingStudentId) {
          const cleanClass = row.className.trim().replace(/\s+/g, ' ');
          const { error } = await supabase
            .from('profiles')
            .update({
              full_name: row.fullName,
              gender: row.gender as Gender,
              date_of_birth: row.dateOfBirth,
              class_name: cleanClass || null,
              class_key: cleanClass ? classKey(cleanClass) : null,
              admissions_advisor: row.admissionsAdvisor || null,
            })
            .eq('id', row.existingStudentId);

          if (error) throw new Error(error.message);
          updated += 1;
        }
      } catch (err) {
        failures.push({
          rowNumber: row.rowNumber,
          fullName: row.fullName,
          reason: err instanceof Error ? err.message : 'Lỗi không xác định',
        });
      } finally {
        setProgressDone(i + 1);
      }
    }

    setImporting(false);
    setImportSummary({
      created,
      updated,
      skipped: actionablePlan.skipCount,
      failures,
    });

    if (created > 0 || updated > 0) {
      const parts: string[] = [];
      if (created > 0) parts.push(`tạo mới ${created}`);
      if (updated > 0) parts.push(`cập nhật ${updated}`);
      toast.success(`Đã ${parts.join(', ')} hồ sơ sinh viên`);
      await onImported();
    }
    if (failures.length > 0) {
      toast.error(`Có ${failures.length} dòng xử lý không thành công`);
    }
  }

  const previewColumns: TableColumn<StudentImportRow>[] = [
    {
      key: 'row',
      header: 'Dòng',
      className: 'w-16',
      render: (r) => <span className="font-semibold text-ink-muted">{r.rowNumber}</span>,
    },
    {
      key: 'name',
      header: 'Họ và tên',
      render: (r) => <span className="font-semibold text-ink-primary">{r.fullName || '—'}</span>,
    },
    {
      key: 'code',
      header: 'Mã SV',
      render: (r) => (
        <span className="text-xs font-semibold text-brand-navy">
          {r.duplicateType !== 'none' && duplicateStrategy === 'auto_code'
            ? 'Tự cấp mã mới'
            : r.studentCode || 'Tự cấp'}
        </span>
      ),
    },
    {
      key: 'bio',
      header: 'Giới tính / Ngày sinh',
      render: (r) => (
        <span className="text-xs text-ink-secondary">
          {r.gender || '—'} • {r.dateOfBirth ? formatDateVi(r.dateOfBirth) : '—'}
        </span>
      ),
    },
    {
      key: 'class',
      header: 'Lớp',
      render: (r) =>
        r.className ? (
          <Badge tone="navy">{r.className}</Badge>
        ) : (
          <span className="text-xs text-ink-muted">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Kiểm tra',
      render: (r) => {
        if (r.error) {
          return (
            <div className="flex items-start gap-1 text-xs font-semibold text-status-dangerText">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{r.error}</span>
            </div>
          );
        }
        if (r.duplicateType !== 'none') {
          return (
            <div className="flex items-start gap-1 text-xs font-semibold text-status-warningText">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{r.duplicateReason}</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1 text-xs font-semibold text-status-successText">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Hợp lệ</span>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <Modal
        open={open}
        onClose={handleClose}
        title="Thêm sinh viên hàng loạt từ Excel"
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-subtle p-3">
            <div className="text-xs text-ink-secondary">
              Cột bắt buộc: <strong>Họ và tên</strong>, <strong>Giới tính</strong> (Nam/Nữ/Khác),{' '}
              <strong>Ngày sinh</strong>. Tùy chọn: Mã sinh viên, Lớp, Tư vấn tuyển sinh.
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={downloadStudentImportTemplate}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Tải file mẫu</span>
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !importing && fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if ((e.key === 'Enter' || e.key === ' ') && !importing) {
                fileInputRef.current?.click();
              }
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
              dragging
                ? 'border-brand-navy bg-brand-navySoft'
                : 'border-line-strong bg-surface-page hover:border-brand-navy'
            }`}
          >
            <FileSpreadsheet className="h-8 w-8 text-brand-navy" aria-hidden="true" />
            <p className="text-sm font-semibold text-ink-primary">
              {parsing
                ? 'Đang đọc file Excel...'
                : fileName
                  ? `Đã chọn: ${fileName}`
                  : 'Kéo thả file Excel (.xlsx, .xls) vào đây hoặc bấm để chọn file'}
            </p>
            <p className="text-xs text-ink-muted">
              Hỗ trợ trực tiếp file mẫu danh sách sinh viên của trường
            </p>
          </div>

          {parsed && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="navy">Tổng: {parsed.rows.length} dòng</Badge>
                  <Badge tone="success">Tạo mới: {parsed.validCount}</Badge>
                  {parsed.duplicateCount > 0 && (
                    <Badge tone="warning">Trùng mã/email: {parsed.duplicateCount}</Badge>
                  )}
                  {parsed.errorCount > 0 && (
                    <Badge tone="danger">Lỗi dữ liệu: {parsed.errorCount}</Badge>
                  )}
                </div>
              </div>

              {parsed.duplicateCount > 0 && !importSummary && (
                <div className="flex flex-col gap-2 rounded-xl border border-status-warningBorder bg-status-warningBg p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-semibold text-status-warningText">
                      Phát hiện {parsed.duplicateCount} dòng bị trùng mã sinh viên hoặc email. Chọn cách xử lý:
                    </span>
                    <div className="w-full sm:w-72">
                      <Select
                        value={duplicateStrategy}
                        onChange={(e) => setDuplicateStrategy(e.target.value as DuplicateStrategy)}
                        options={[
                          { value: 'skip', label: 'Bỏ qua các dòng bị trùng' },
                          {
                            value: 'auto_code',
                            label: 'Tự cấp mã 6111 mới cho dòng trùng',
                          },
                          {
                            value: 'update',
                            label: 'Cập nhật hồ sơ & lớp cho SV đã có',
                          },
                        ]}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-ink-secondary">
                    {duplicateStrategy === 'skip' &&
                      'Chỉ tạo các sinh viên mới chưa tồn tại; các dòng trùng sẽ được giữ nguyên không đụng tới.'}
                    {duplicateStrategy === 'auto_code' &&
                      'Các dòng bị trùng sẽ được bỏ mã cũ để hệ thống tự động cấp mã sinh viên 6111 mới tiếp theo.'}
                    {duplicateStrategy === 'update' &&
                      'Các sinh viên đã có trên hệ thống sẽ được cập nhật Họ tên, Giới tính, Ngày sinh, Lớp và Tư vấn TS theo file Excel; dòng trùng ngay trong file sẽ bỏ qua.'}
                  </p>
                </div>
              )}

              <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
                <Table
                  columns={previewColumns}
                  data={parsed.rows}
                  rowKey={(r) => String(r.rowNumber)}
                  caption="Xem trước danh sách sinh viên nhập từ Excel"
                />
              </div>
            </div>
          )}

          {importing && (
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-subtle p-4">
              <div className="flex items-center justify-between text-sm font-semibold text-brand-navy">
                <span>Đang xử lý danh sách sinh viên...</span>
                <span>
                  {progressDone} / {progressTotal}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-card">
                <div
                  className="h-full bg-brand-navy transition-all"
                  style={{
                    width: `${progressTotal > 0 ? Math.round((progressDone / progressTotal) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          )}

          {importSummary && (
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-subtle p-4 text-sm">
              <p className="font-semibold text-ink-primary">
                Kết quả xử lý: Tạo mới{' '}
                <span className="text-status-successText">{importSummary.created}</span> • Cập nhật{' '}
                <span className="text-brand-navy">{importSummary.updated}</span> • Bỏ qua{' '}
                <span className="text-ink-muted">{importSummary.skipped}</span> • Lỗi{' '}
                <span className="text-status-dangerText">{importSummary.failures.length}</span>
              </p>
              {importSummary.failures.length > 0 && (
                <ul className="flex max-h-32 flex-col gap-1 overflow-y-auto text-xs text-status-dangerText">
                  {importSummary.failures.map((f) => (
                    <li key={f.rowNumber}>
                      Dòng {f.rowNumber} ({f.fullName}): {f.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button type="button" variant="secondary" disabled={importing} onClick={handleClose}>
              {importSummary ? 'Đóng' : 'Hủy'}
            </Button>
            {parsed && actionablePlan.totalActionable > 0 && !importSummary && (
              <Button
                type="button"
                variant="primary"
                loading={importing}
                onClick={() => setConfirmOpen(true)}
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>
                  Thực hiện ({actionablePlan.createCount > 0 ? `Tạo ${actionablePlan.createCount}` : ''}
                  {actionablePlan.createCount > 0 && actionablePlan.updateCount > 0 ? ' • ' : ''}
                  {actionablePlan.updateCount > 0 ? `Cập nhật ${actionablePlan.updateCount}` : ''})
                </span>
              </Button>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmImport}
        title="Xác nhận nhập sinh viên từ Excel"
        message={`Hệ thống sẽ tạo mới ${actionablePlan.createCount} tài khoản sinh viên${
          actionablePlan.updateCount > 0
            ? `, cập nhật ${actionablePlan.updateCount} hồ sơ đã có`
            : ''
        }${
          actionablePlan.skipCount > 0 ? ` và bỏ qua ${actionablePlan.skipCount} dòng` : ''
        }. Bạn có muốn tiếp tục?`}
        confirmLabel="Xác nhận thực hiện"
        confirmVariant="primary"
      />
    </>
  );
}
