import { type ChangeEvent, type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarClock,
  Check,
  Download,
  Edit3,
  FileSpreadsheet,
  Shuffle,
  Timer,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import { classKey } from '@/lib/classKey';
import {
  downloadStudentListTemplate,
  parseManualStudentList,
  parseStudentWorkbook,
  type KitStudent,
} from '@/lib/classroomKit';
import { isDroppedOutStudent } from '@/lib/roles';
import { fetchAllPages, supabase } from '@/lib/supabase';
import type { CollegeClass, Profile } from '@/types/database';
import { ClassTimerTab } from '@/components/classroom-kit/ClassTimerTab';
import { RandomPickerTab } from '@/components/classroom-kit/RandomPickerTab';
import { TeamBuilderTab } from '@/components/classroom-kit/TeamBuilderTab';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';

type KitTab = 'random' | 'teams' | 'timer';

interface ClassSource {
  key: string;
  name: string;
  subject: string | null;
  students: KitStudent[];
}

type RawEnrollmentRow = {
  class_id: string;
  student: Pick<
    Profile,
    'id' | 'full_name' | 'student_code' | 'class_name' | 'is_active' | 'academic_status'
  > | null;
};

type RawStudentProfile = Pick<
  Profile,
  'id' | 'full_name' | 'student_code' | 'class_name' | 'class_key' | 'is_active' | 'academic_status'
>;

export function ClassroomKit() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const requestedClassKey = searchParams.get('class') ?? '';
  const requestedTab = searchParams.get('tab');
  const initialTab: KitTab =
    requestedTab === 'teams' || requestedTab === 'timer' ? requestedTab : 'random';

  const [loading, setLoading] = useState(true);
  const [classSources, setClassSources] = useState<ClassSource[]>([]);

  const [sourceMode, setSourceMode] = useState<'class' | 'manual'>('class');
  const [selectedClassKey, setSelectedClassKey] = useState<string>('');
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [showAttendanceToggles, setShowAttendanceToggles] = useState(false);
  const [manualText, setManualText] = useState('');
  const [importingExcel, setImportingExcel] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadedExcelInfo, setUploadedExcelInfo] = useState<{
    fileName: string;
    sheetName: string;
    count: number;
  } | null>(null);
  const [confirmClearManual, setConfirmClearManual] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);

  const [activeTab, setActiveTab] = useState<KitTab>(initialTab);

  useEffect(() => {
    if (requestedTab === 'random' || requestedTab === 'teams' || requestedTab === 'timer') {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [clsRes, enrRows, stuRows] = await Promise.all([
        supabase
          .from('classes')
          .select('id, name, class_key, subject')
          .order('name', { ascending: true })
          .returns<Pick<CollegeClass, 'id' | 'name' | 'class_key' | 'subject'>[]>(),
        fetchAllPages<RawEnrollmentRow>((from, to, withCount) =>
          supabase
            .from('enrollments')
            .select(
              'class_id, student:profiles!enrollments_student_id_fkey(id, full_name, student_code, class_name, is_active, academic_status)',
              withCount ? { count: 'exact' } : undefined
            )
            .range(from, to)
            .returns<RawEnrollmentRow[]>()
        ),
        fetchAllPages<RawStudentProfile>((from, to, withCount) =>
          supabase
            .from('profiles')
            .select(
              'id, full_name, student_code, class_name, class_key, is_active, academic_status',
              withCount ? { count: 'exact' } : undefined
            )
            .eq('role', 'student')
            .eq('is_active', true)
            .order('full_name', { ascending: true })
            .range(from, to)
            .returns<RawStudentProfile[]>()
        ),
      ]);

      if (clsRes.error) throw new Error(clsRes.error.message);

      const enrolledByClassId = new Map<string, KitStudent[]>();
      enrRows.forEach((row) => {
        if (!row.student || row.student.is_active === false || isDroppedOutStudent(row.student)) {
          return;
        }
        const list = enrolledByClassId.get(row.class_id) ?? [];
        list.push({
          id: row.student.id,
          name: row.student.full_name,
          code: row.student.student_code,
          className: row.student.class_name,
        });
        enrolledByClassId.set(row.class_id, list);
      });

      const profilesByClassKey = new Map<string, { name: string; students: KitStudent[] }>();
      stuRows.forEach((stu) => {
        if (isDroppedOutStudent(stu)) return;
        const cleanClassName = stu.class_name?.trim() ?? '';
        const key = stu.class_key?.trim() || (cleanClassName ? classKey(cleanClassName) : '');
        if (!key) return;
        const entry = profilesByClassKey.get(key) ?? {
          name: cleanClassName || key,
          students: [],
        };
        entry.students.push({
          id: stu.id,
          name: stu.full_name,
          code: stu.student_code,
          className: cleanClassName || entry.name,
        });
        profilesByClassKey.set(key, entry);
      });

      const mergedMap = new Map<
        string,
        { key: string; name: string; subject: string | null; studentsById: Map<string, KitStudent> }
      >();

      (clsRes.data ?? []).forEach((cls) => {
        const key = cls.class_key?.trim() || classKey(cls.name);
        if (!key) return;
        const bucket = mergedMap.get(key) ?? {
          key,
          name: cls.name,
          subject: cls.subject,
          studentsById: new Map<string, KitStudent>(),
        };

        (enrolledByClassId.get(cls.id) ?? []).forEach((s) => bucket.studentsById.set(s.id, s));
        (profilesByClassKey.get(key)?.students ?? []).forEach((s) =>
          bucket.studentsById.set(s.id, s)
        );

        mergedMap.set(key, bucket);
      });

      profilesByClassKey.forEach((group, key) => {
        if (mergedMap.has(key)) return;
        const studentsById = new Map<string, KitStudent>();
        group.students.forEach((s) => studentsById.set(s.id, s));
        mergedMap.set(key, {
          key,
          name: group.name,
          subject: null,
          studentsById,
        });
      });

      const sources: ClassSource[] = Array.from(mergedMap.values())
        .map((item) => ({
          key: item.key,
          name: item.name,
          subject: item.subject,
          students: Array.from(item.studentsById.values()).sort((a, b) =>
            a.name.localeCompare(b.name, 'vi')
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

      setClassSources(sources);

      if (sources.length === 0) {
        setSourceMode('manual');
        setSelectedClassKey('');
      } else {
        setSourceMode('class');
        setSelectedClassKey((prev) => {
          if (requestedClassKey && sources.some((s) => s.key === requestedClassKey)) {
            return requestedClassKey;
          }
          if (prev && sources.some((s) => s.key === prev)) return prev;
          const firstNonEmpty = sources.find((s) => s.students.length > 0);
          return (firstNonEmpty ?? sources[0]).key;
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không tải được danh sách lớp học');
    } finally {
      setLoading(false);
    }
  }, [requestedClassKey, toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const currentClassSource = useMemo(
    () => classSources.find((c) => c.key === selectedClassKey) ?? null,
    [classSources, selectedClassKey]
  );

  const manualStudents = useMemo(() => parseManualStudentList(manualText), [manualText]);

  const activeStudents = useMemo(() => {
    if (sourceMode === 'manual') return manualStudents;
    if (!currentClassSource) return [];
    return currentClassSource.students.filter((s) => !absentIds.has(s.id));
  }, [sourceMode, manualStudents, currentClassSource, absentIds]);

  const activeSourceLabel =
    sourceMode === 'manual' ? 'Danh sách nhập tay' : currentClassSource?.name ?? 'Lớp học';

  const sourceSignature = useMemo(
    () => `${sourceMode}:${selectedClassKey}:${activeStudents.map((s) => s.id).join(',')}`,
    [sourceMode, selectedClassKey, activeStudents]
  );

  function handleSelectClass(nextKey: string) {
    setSelectedClassKey(nextKey);
    setAbsentIds(new Set());
  }

  function handleTogglePresent(studentId: string) {
    setAbsentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }

  function handleCopyClassToManual() {
    if (!currentClassSource || currentClassSource.students.length === 0) {
      setSourceMode('manual');
      return;
    }
    const lines = currentClassSource.students
      .filter((s) => !absentIds.has(s.id))
      .map((s) => (s.code ? `${s.code} - ${s.name}` : s.name));
    setManualText(lines.join('\n'));
    setUploadedExcelInfo(null);
    setSourceMode('manual');
    toast.info('Đã nạp danh sách sang chế độ chỉnh tay');
  }

  async function importExcelFile(file: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error('Định dạng không hỗ trợ. Vui lòng chọn hoặc kéo thả file .xlsx, .xls hoặc .csv.');
      return;
    }

    setImportingExcel(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = parseStudentWorkbook(buffer);
      if (result.error || result.count === 0) {
        toast.error(result.error ?? 'Không tìm thấy sinh viên hợp lệ trong file Excel.');
        return;
      }

      setManualText(result.linesText);
      setUploadedExcelInfo({
        fileName: file.name,
        sheetName: result.sheetName,
        count: result.count,
      });
      toast.success(`Đã nạp ${result.count} sinh viên từ ${file.name}`);
    } catch {
      toast.error('Không thể đọc file Excel. Vui lòng thử lại với file .xlsx, .xls hoặc .csv.');
    } finally {
      setImportingExcel(false);
    }
  }

  function handleExcelUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void importExcelFile(file);
  }

  function hasDraggedFiles(event: DragEvent<HTMLElement>): boolean {
    return Array.from(event.dataTransfer.types).includes('Files');
  }

  function handleDropzoneDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDraggingFile(true);
  }

  function handleDropzoneDragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleDropzoneDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) {
      setIsDraggingFile(false);
    }
  }

  function handleDropzoneDrop(event: DragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDraggingFile(false);
    if (importingExcel) return;

    const file = event.dataTransfer.files?.[0];
    if (file) {
      void importExcelFile(file);
    }
  }

  function handleConfirmClearManual() {
    setManualText('');
    setUploadedExcelInfo(null);
    setConfirmClearManual(false);
    toast.info('Đã xóa danh sách nhập tay');
  }

  return (
    <Layout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">Điều phối lớp học</h1>
            <p className="text-sm font-normal text-ink-secondary">
              Bộ công cụ đứng lớp: mini game trả bài, chia nhóm và đồng hồ bấm giờ
            </p>
          </div>

          <Link to="/teacher/schedule">
            <Button variant="secondary">
              <CalendarClock className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              <span>Xem lịch dạy cá nhân</span>
            </Button>
          </Link>
        </div>

        {/* Bộ chọn danh sách sinh viên tham gia */}
        <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-card p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={sourceMode === 'class' ? 'navy' : 'secondary'}
                onClick={() => setSourceMode('class')}
                disabled={classSources.length === 0}
              >
                <Users className="h-4 w-4" aria-hidden="true" />
                <span>Chọn từ lớp học</span>
              </Button>
              <Button
                size="sm"
                variant={sourceMode === 'manual' ? 'navy' : 'secondary'}
                onClick={() => setSourceMode('manual')}
              >
                <Edit3 className="h-4 w-4" aria-hidden="true" />
                <span>Nhập / dán danh sách</span>
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={activeStudents.length > 0 ? 'navy' : 'neutral'}>
                Đang tham gia: {activeStudents.length} sinh viên
              </Badge>
            </div>
          </div>

          {loading ? (
            <LoadingState message="Đang nạp danh sách lớp và sinh viên..." />
          ) : sourceMode === 'class' ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-end">
                <Select
                  label="Lớp học"
                  value={selectedClassKey}
                  onChange={(e) => handleSelectClass(e.target.value)}
                  options={classSources.map((src) => ({
                    value: src.key,
                    label: `${src.name}${src.subject ? ` — ${src.subject}` : ''} (${src.students.length} SV)`,
                  }))}
                />

                <div className="flex flex-wrap items-center gap-2">
                  {currentClassSource && currentClassSource.students.length > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowAttendanceToggles((v) => !v)}
                    >
                      <span>
                        {showAttendanceToggles
                          ? 'Thu gọn danh sách lớp'
                          : `Lọc sinh viên có mặt (${activeStudents.length}/${currentClassSource.students.length})`}
                      </span>
                    </Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={handleCopyClassToManual}>
                    Chỉnh tay danh sách
                  </Button>
                </div>
              </div>

              {currentClassSource && currentClassSource.students.length === 0 && (
                <p className="text-sm font-normal text-ink-muted">
                  Lớp {currentClassSource.name} hiện chưa có sinh viên nào trong hệ thống. Bạn có
                  thể chuyển sang mục &quot;Nhập / dán danh sách&quot; để dùng ngay.
                </p>
              )}

              {showAttendanceToggles && currentClassSource && currentClassSource.students.length > 0 && (
                <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-page p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink-secondary">
                      Bấm vào tên sinh viên để tạm bỏ qua nếu bạn đó vắng mặt hôm nay:
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setAbsentIds(new Set())}
                        disabled={absentIds.size === 0}
                      >
                        Chọn tất cả
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setAbsentIds(new Set(currentClassSource.students.map((s) => s.id)))
                        }
                        disabled={activeStudents.length === 0}
                      >
                        Bỏ chọn hết
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {currentClassSource.students.map((stu) => {
                      const present = !absentIds.has(stu.id);
                      return (
                        <button
                          key={stu.id}
                          type="button"
                          onClick={() => handleTogglePresent(stu.id)}
                          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-semibold transition-colors ${
                            present
                              ? 'border-brand-navy/30 bg-brand-navySoft text-brand-navy'
                              : 'border-line bg-surface-card text-ink-muted line-through'
                          }`}
                        >
                          {present && <Check className="h-4 w-4 text-brand-red" aria-hidden="true" />}
                          <span>{stu.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <label htmlFor="manual-students-input" className="text-sm font-semibold text-ink-primary">
                  Danh sách sinh viên (mỗi dòng một sinh viên)
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={excelInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelUpload}
                    className="hidden"
                    aria-label="Chọn file Excel danh sách sinh viên"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={importingExcel}
                    onClick={() => excelInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                    <span>Tải file Excel lên</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={importingExcel}
                    onClick={() => {
                      downloadStudentListTemplate();
                      toast.info('Đã tải file Excel mẫu');
                    }}
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Tải file mẫu</span>
                  </Button>
                  {manualText.trim().length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={importingExcel}
                      onClick={() => setConfirmClearManual(true)}
                    >
                      <Trash2 className="h-4 w-4 text-brand-red" aria-hidden="true" />
                      <span>Xóa danh sách</span>
                    </Button>
                  )}
                </div>
              </div>

              {uploadedExcelInfo && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-subtle px-4 py-2 text-xs text-ink-secondary">
                  <FileSpreadsheet className="h-4 w-4 shrink-0 text-brand-navy" aria-hidden="true" />
                  <span>
                    Đã nạp từ <strong className="font-semibold text-ink-primary">{uploadedExcelInfo.fileName}</strong>
                    {uploadedExcelInfo.sheetName ? ` (trang "${uploadedExcelInfo.sheetName}")` : ''} ·{' '}
                    <strong className="font-semibold text-brand-navy">{uploadedExcelInfo.count} sinh viên</strong>. Thầy cô có
                    thể sửa trực tiếp bên dưới.
                  </span>
                </div>
              )}

              <div
                className="relative"
                onDragEnter={handleDropzoneDragEnter}
                onDragOver={handleDropzoneDragOver}
                onDragLeave={handleDropzoneDragLeave}
                onDrop={handleDropzoneDrop}
              >
                <textarea
                  id="manual-students-input"
                  rows={5}
                  value={manualText}
                  disabled={importingExcel}
                  onChange={(e) => {
                    setManualText(e.target.value);
                    if (uploadedExcelInfo) setUploadedExcelInfo(null);
                  }}
                  placeholder={
                    'Hướng dẫn:\n- Nhập hoặc dán danh sách, mỗi dòng một sinh viên (Họ và tên hoặc MSV - Họ và tên).\n- Hoặc kéo thả trực tiếp file Excel (.xlsx, .xls, .csv) vào khung này để nạp nhanh.'
                  }
                  className={`w-full rounded-lg border bg-surface-card p-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted transition-colors focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20 ${
                    isDraggingFile ? 'border-brand-navy' : 'border-line-strong'
                  }`}
                />

                {isDraggingFile && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-brand-navy bg-brand-navySoft/95 p-4 text-center">
                    <FileSpreadsheet className="h-8 w-8 text-brand-navy" aria-hidden="true" />
                    <span className="text-sm font-semibold text-brand-navy">
                      Thả file Excel (.xlsx, .xls, .csv) vào đây để nạp danh sách
                    </span>
                  </div>
                )}
              </div>
              <span className="text-xs font-normal text-ink-muted">
                Hỗ trợ file Excel có cột Họ và tên (hoặc tách Họ đệm + Tên), tùy chọn cột Mã sinh viên / MSV.
              </span>
            </div>
          )}
        </section>

        {/* Thanh chuyển 3 tiện ích */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Công cụ điều phối lớp học">
          <Button
            role="tab"
            aria-selected={activeTab === 'random'}
            variant={activeTab === 'random' ? 'navy' : 'secondary'}
            onClick={() => setActiveTab('random')}
          >
            <Shuffle className="h-4 w-4" aria-hidden="true" />
            <span>Mini game trả bài</span>
          </Button>
          <Button
            role="tab"
            aria-selected={activeTab === 'teams'}
            variant={activeTab === 'teams' ? 'navy' : 'secondary'}
            onClick={() => setActiveTab('teams')}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>Chia nhóm</span>
          </Button>
          <Button
            role="tab"
            aria-selected={activeTab === 'timer'}
            variant={activeTab === 'timer' ? 'navy' : 'secondary'}
            onClick={() => setActiveTab('timer')}
          >
            <Timer className="h-4 w-4" aria-hidden="true" />
            <span>Đếm giờ</span>
          </Button>
        </div>

        {/* Giữ các tab cùng gắn trên cây DOM để chuyển tab không làm mất bộ đếm giờ hoặc nhóm đã chia */}
        <div className={activeTab === 'random' ? '' : 'hidden'}>
          <RandomPickerTab
            students={activeStudents}
            sourceLabel={activeSourceLabel}
            sourceSignature={sourceSignature}
          />
        </div>
        <div className={activeTab === 'teams' ? '' : 'hidden'}>
          <TeamBuilderTab
            students={activeStudents}
            sourceLabel={activeSourceLabel}
            sourceSignature={sourceSignature}
          />
        </div>
        <div className={activeTab === 'timer' ? '' : 'hidden'}>
          <ClassTimerTab />
        </div>
      </div>

      <ConfirmDialog
        open={confirmClearManual}
        onClose={() => setConfirmClearManual(false)}
        onConfirm={handleConfirmClearManual}
        title="Xóa danh sách nhập tay?"
        message="Toàn bộ danh sách sinh viên đang có trong ô nhập tay sẽ bị xóa. Bạn có chắc muốn tiếp tục?"
        confirmLabel="Xóa danh sách"
        cancelLabel="Giữ lại"
        confirmVariant="danger"
      />
    </Layout>
  );
}

