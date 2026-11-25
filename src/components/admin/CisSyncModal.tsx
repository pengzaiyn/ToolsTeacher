import { useEffect, useState } from 'react';
import { CheckCircle2, CloudDownload, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { formatDateTimeVi } from '@/lib/classStorage';
import { syncCisStudents, type CisSyncResponse, type CisSyncSummary } from '@/lib/supabase';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

interface CisSyncModalProps {
  open: boolean;
  onClose: () => void;
  onSynced: () => void | Promise<void>;
}

export function CisSyncModal({ open, onClose, onSynced }: CisSyncModalProps) {
  const toast = useToast();
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [statusData, setStatusData] = useState<CisSyncResponse | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthResult, setHealthResult] = useState<CisSyncResponse | null>(null);
  const [syncingMode, setSyncingMode] = useState<'incremental' | 'full' | null>(null);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<CisSyncSummary | null>(null);
  const [showCreatedList, setShowCreatedList] = useState(false);
  const [lookupCode, setLookupCode] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingStatus(true);
    setErrorMsg(null);
    syncCisStudents({ action: 'status' })
      .then((res) => {
        if (cancelled) return;
        setStatusData(res);
        const rawSummary = res.state?.last_summary;
        if (rawSummary && 'fetchedCount' in rawSummary) {
          setLastSummary(rawSummary);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Không đọc được trạng thái CIS');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function handleCheckHealth() {
    setCheckingHealth(true);
    setErrorMsg(null);
    try {
      const res = await syncCisStudents({ action: 'health' });
      setHealthResult(res);
      toast.success('Kết nối API CIS thành công');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không kết nối được API CIS';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setCheckingHealth(false);
    }
  }

  async function handleRunSync(mode: 'incremental' | 'full') {
    setSyncingMode(mode);
    setErrorMsg(null);
    setSyncProgress('Đang kết nối CIS và đọc trang 1...');

    const totals: Omit<CisSyncSummary, 'classesCreated'> = {
      mode,
      pagesFetched: 0,
      fetchedCount: 0,
      matchedCount: 0,
      updatedCount: 0,
      createdCount: 0,
      createdStudents: [],
      skippedNotOnWeb: 0,
      skippedStudents: [],
      errorCount: 0,
      serverTime: null,
    };

    try {
      let cursor: string | null = null;
      let updatedSince: string | null = null;
      let newestUpdatedAt: string | null = null;

      while (totals.pagesFetched < 60) {
        const pageRes = await syncCisStudents({
          action: 'sync_page',
          mode,
          cursor,
          updated_since: updatedSince,
        });
        const p = pageRes.page;
        if (!p) break;

        totals.pagesFetched += 1;
        totals.fetchedCount += p.fetchedCount;
        totals.matchedCount += p.matchedCount;
        totals.updatedCount += p.updatedCount;
        totals.createdCount = (totals.createdCount ?? 0) + (p.createdCount ?? 0);
        if (p.createdStudents?.length && (totals.createdStudents?.length ?? 0) < 200) {
          const remaining = 200 - (totals.createdStudents?.length ?? 0);
          totals.createdStudents = [
            ...(totals.createdStudents ?? []),
            ...p.createdStudents.slice(0, remaining),
          ];
        }
        totals.skippedNotOnWeb += p.skippedNotOnWeb;
        if (p.skippedStudents?.length && (totals.skippedStudents?.length ?? 0) < 200) {
          const remaining = 200 - (totals.skippedStudents?.length ?? 0);
          totals.skippedStudents = [
            ...(totals.skippedStudents ?? []),
            ...p.skippedStudents.slice(0, remaining),
          ];
        }
        totals.errorCount += p.errorCount;
        if (!totals.serverTime && p.serverTime) totals.serverTime = p.serverTime;
        if (!updatedSince && p.usedUpdatedSince) updatedSince = p.usedUpdatedSince;
        if (p.newestUpdatedAt && (!newestUpdatedAt || p.newestUpdatedAt > newestUpdatedAt)) {
          newestUpdatedAt = p.newestUpdatedAt;
        }

        setLastSummary({ ...totals, classesCreated: 0 });
        setSyncProgress(
          `Đang đồng bộ trang ${totals.pagesFetched} · Đã đọc ${totals.fetchedCount}${
            p.totalRecords ? `/${p.totalRecords}` : ''
          } hồ sơ (${totals.updatedCount} cập nhật, ${totals.createdCount ?? 0} tạo mới)...`
        );

        if (!p.nextCursor) break;
        cursor = p.nextCursor;
      }

      setSyncProgress('Đang xếp sinh viên vào đúng các lớp...');
      const finalRes = await syncCisStudents({
        action: 'finalize_sync',
        summary: totals,
        last_updated_since: newestUpdatedAt ?? totals.serverTime ?? new Date().toISOString(),
      });

      const finalSummary: CisSyncSummary = finalRes.summary ?? {
        ...totals,
        classesCreated: finalRes.classesCreated ?? 0,
      };
      setLastSummary(finalSummary);
      const createdNum = finalSummary.createdCount ?? 0;
      toast.success(
        `Đã cập nhật ${finalSummary.updatedCount} SV${createdNum > 0 ? `, tạo mới ${createdNum} SV` : ''} và đồng bộ ${finalSummary.classesCreated} lớp mới`
      );
      await onSynced();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Đồng bộ CIS thất bại';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSyncingMode(null);
      setSyncProgress(null);
    }
  }

  async function handleLookupOne() {
    const code = lookupCode.trim();
    if (!code) {
      toast.error('Vui lòng nhập mã sinh viên');
      return;
    }
    setLookingUp(true);
    setErrorMsg(null);
    try {
      const res = await syncCisStudents({ action: 'lookup_one', student_code: code });
      if (res.createdOnWeb) {
        toast.success(
          `Đã tạo tài khoản mới cho ${res.fullName || res.studentCode}${res.email ? ` (${res.email})` : ''}${res.className ? ` → Lớp ${res.className}` : ''}`
        );
        setLookupCode('');
        await onSynced();
      } else if (res.matchedOnWeb) {
        toast.success(
          `Đã cập nhật ${res.fullName || res.studentCode}${res.className ? ` → Lớp ${res.className}` : ''}`
        );
        setLookupCode('');
        await onSynced();
      } else {
        toast.info(res.message || 'Không tìm thấy sinh viên trên CIS');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không tra cứu được sinh viên';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLookingUp(false);
    }
  }

  const hasToken = statusData?.hasLocalToken ?? false;
  const busy = Boolean(syncingMode) || checkingHealth || lookingUp;

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title="Đồng bộ hồ sơ & xếp lớp từ CIS"
      size="lg"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-page p-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-ink-primary">Trạng thái khóa API CIS</span>
              {loadingStatus ? (
                <Badge tone="neutral">Đang kiểm tra...</Badge>
              ) : hasToken ? (
                <Badge tone="success">Đã cấu hình CIS_API_TOKEN</Badge>
              ) : (
                <Badge tone="warning">Chưa nạp CIS_API_TOKEN</Badge>
              )}
              {healthResult?.apiKeyConfigured && (
                <Badge tone="success">CIS Online (Chỉ đọc)</Badge>
              )}
            </div>
            <p className="text-xs font-normal text-ink-secondary">
              Tự động cập nhật đầy đủ hồ sơ (SĐT, CCCD, ngày sinh, nơi sinh, khóa, khoa, ngành, lớp),
              tự tạo tài khoản cho sinh viên mới từ CIS và xếp vào đúng lớp.
            </p>
            {statusData?.state?.last_synced_at && (
              <p className="text-xs font-normal text-ink-muted">
                Lần đồng bộ gần nhất: {formatDateTimeVi(statusData.state.last_synced_at)}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            loading={checkingHealth}
            disabled={busy || !hasToken}
            onClick={handleCheckHealth}
          >
            <CheckCircle2 className="h-4 w-4 text-brand-navy" aria-hidden="true" />
            <span>Kiểm tra kết nối</span>
          </Button>
        </div>

        {!loadingStatus && !hasToken && (
          <div className="flex items-start gap-2.5 rounded-xl border border-status-warningBorder bg-status-warningBg p-4 text-xs text-status-warningText">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Để kích hoạt đồng bộ, quản trị kỹ thuật cần thêm biến bí mật{' '}
              <strong>CIS_API_TOKEN</strong> vào <strong>Supabase Edge Function Secrets</strong>{' '}
              (tuyệt đối không đưa khóa vào mã nguồn frontend).
            </span>
          </div>
        )}

        {syncProgress && (
          <div className="rounded-xl border border-brand-navy/20 bg-brand-navySoft/50 px-4 py-3 text-xs font-semibold text-brand-navy">
            {syncProgress}
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-status-dangerBorder bg-status-dangerBg p-4 text-xs font-semibold text-status-dangerText"
          >
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
            variant="primary"
            loading={syncingMode === 'incremental'}
            disabled={busy || !hasToken}
            onClick={() => void handleRunSync('incremental')}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Đồng bộ mới nhất (tăng dần)</span>
          </Button>
          <Button
            variant="navy"
            loading={syncingMode === 'full'}
            disabled={busy || !hasToken}
            onClick={() => void handleRunSync('full')}
          >
            <CloudDownload className="h-4 w-4" aria-hidden="true" />
            <span>Đồng bộ toàn bộ & xếp lớp</span>
          </Button>
        </div>

        <div className="rounded-xl border border-line bg-surface-page p-4">
          <p className="mb-2 text-xs font-bold text-ink-primary">
            Đồng bộ lẻ 1 sinh viên theo Mã sinh viên
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={lookupCode}
              onChange={(e) => setLookupCode(e.target.value)}
              placeholder="Nhập mã sinh viên (VD: 61112420027)..."
              disabled={busy || !hasToken}
              className="h-10 flex-1 rounded-lg border border-line-strong bg-surface-card px-3 text-sm text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none disabled:opacity-60"
            />
            <Button
              variant="secondary"
              loading={lookingUp}
              disabled={busy || !hasToken || !lookupCode.trim()}
              onClick={() => void handleLookupOne()}
            >
              <Search className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              <span>Cập nhật 1 SV</span>
            </Button>
          </div>
        </div>

        {lastSummary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-line bg-surface-card p-3 text-center">
              <div className="text-lg font-bold text-brand-navy">{lastSummary.fetchedCount}</div>
              <div className="text-xs text-ink-muted">Đọc từ CIS</div>
            </div>
            <div className="rounded-xl border border-line bg-surface-card p-3 text-center">
              <div className="text-lg font-bold text-status-successText">
                {lastSummary.updatedCount}
              </div>
              <div className="text-xs text-ink-muted">SV đã cập nhật</div>
            </div>
            <div className="rounded-xl border border-line bg-surface-card p-3 text-center">
              <div className="text-lg font-bold text-brand-red">{lastSummary.classesCreated}</div>
              <div className="text-xs text-ink-muted">Lớp tạo mới</div>
            </div>
            <button
              type="button"
              disabled={!lastSummary.createdStudents?.length}
              onClick={() => setShowCreatedList((v) => !v)}
              className={`rounded-xl border border-line bg-surface-card p-3 text-center transition-colors ${
                lastSummary.createdStudents?.length
                  ? 'cursor-pointer hover:border-brand-navy hover:bg-surface-page'
                  : 'cursor-default'
              }`}
            >
              <div className="text-lg font-bold text-brand-navy">
                {lastSummary.createdCount ?? 0}
              </div>
              <div className="text-xs text-ink-muted">
                SV tạo mới
                {lastSummary.createdStudents?.length ? (showCreatedList ? ' ▲' : ' ▼') : ''}
              </div>
            </button>
          </div>
        )}

        {showCreatedList && lastSummary?.createdStudents && lastSummary.createdStudents.length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface-page p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-ink-primary">
                Danh sách {lastSummary.createdStudents.length} sinh viên vừa được tạo tài khoản từ CIS
              </span>
            </div>
            <div className="max-h-60 overflow-auto rounded-lg border border-line bg-surface-card">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-surface-subtle text-ink-secondary">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Mã SV</th>
                    <th className="px-3 py-2 font-semibold">Họ và tên</th>
                    <th className="px-3 py-2 font-semibold">Email đăng nhập</th>
                    <th className="px-3 py-2 font-semibold">Lớp</th>
                    <th className="px-3 py-2 font-semibold">Khóa / Ngành</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {lastSummary.createdStudents.map((st) => (
                    <tr key={st.studentCode}>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold text-brand-navy">
                        {st.studentCode}
                      </td>
                      <td className="px-3 py-2 font-medium text-ink-primary">{st.fullName}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-secondary">
                        {st.email || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-secondary">
                        {st.className || '—'}
                      </td>
                      <td className="px-3 py-2 text-ink-muted">
                        {[st.cohort, st.major].filter(Boolean).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

