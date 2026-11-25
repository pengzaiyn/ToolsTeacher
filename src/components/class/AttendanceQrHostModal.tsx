import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  Clock,
  Copy,
  Maximize2,
  Minimize2,
  Play,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Square,
  Users,
} from 'lucide-react';
import { isValidAvatarUrl } from '@/lib/avatar';
import { callAttendanceQr, supabase } from '@/lib/supabase';
import { formatDateVi } from '@/lib/week';
import type { AttendanceRecord, AttendanceSession, Enrollment } from '@/types/database';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

interface AttendanceQrHostModalProps {
  open: boolean;
  onClose: () => void;
  className: string;
  session: AttendanceSession | null;
  enrollments: Enrollment[];
  onUpdated: () => void | Promise<void>;
}

const ROTATE_SECONDS = 15;

function formatTimeHms(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AttendanceQrHostModal({
  open,
  onClose,
  className,
  session,
  enrollments,
  onUpdated,
}: AttendanceQrHostModalProps) {
  const toast = useToast();

  const [isActive, setIsActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [lateAfterMinutes, setLateAfterMinutes] = useState<number>(15);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(ROTATE_SECONDS);
  const [fullscreen, setFullscreen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [liveRecords, setLiveRecords] = useState<AttendanceRecord[]>([]);

  const issuedAtRef = useRef<number>(0);
  const rotatingRef = useRef<boolean>(false);

  const studentById = useMemo(() => {
    const map = new Map<string, Enrollment['student']>();
    for (const enr of enrollments) {
      map.set(enr.student_id, enr.student);
    }
    return map;
  }, [enrollments]);

  const loadSessionRecords = useCallback(async () => {
    if (!session) return;
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('session_id', session.id)
      .returns<AttendanceRecord[]>();
    if (!error && data) {
      setLiveRecords(data);
    }
  }, [session]);

  useEffect(() => {
    if (!open || !session) return;
    void loadSessionRecords();
  }, [open, session, loadSessionRecords]);

  // Lắng nghe Realtime khi sinh viên quét QR thành công
  useEffect(() => {
    if (!open || !session) return;
    const channel = supabase
      .channel(`qr-host-session-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `session_id=eq.${session.id}`,
        },
        () => {
          void loadSessionRecords();
          void onUpdated();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [open, session, loadSessionRecords, onUpdated]);

  // Render ảnh QR kích thước lớn dễ quét từ cuối lớp
  useEffect(() => {
    if (!qrToken) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    const scanUrl = `${window.location.origin}/attendance-scan?p=${encodeURIComponent(qrToken)}`;
    QRCode.toDataURL(scanUrl, {
      width: 440,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#1A365D',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [qrToken]);

  const rotateToken = useCallback(async () => {
    if (!session || rotatingRef.current) return;
    rotatingRef.current = true;
    setRotating(true);
    try {
      const res = await callAttendanceQr({
        action: 'rotate',
        session_id: session.id,
      });
      if (res.qrToken) {
        issuedAtRef.current = Date.now();
        setQrToken(res.qrToken);
        setSecondsLeft(ROTATE_SECONDS);
        setErrorMsg(null);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không xoay được mã QR mới';
      setErrorMsg(msg);
      if (msg.includes('kết thúc') || msg.includes('hết thời gian')) {
        setIsActive(false);
        setQrToken(null);
      }
    } finally {
      rotatingRef.current = false;
      setRotating(false);
    }
  }, [session]);

  // Đồng hồ đếm ngược 15s & tự xoay mã QR mới
  useEffect(() => {
    if (!open || !isActive || !session) return;
    const timer = window.setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - issuedAtRef.current) / 1000);
      const rem = Math.max(0, ROTATE_SECONDS - elapsedSec);
      setSecondsLeft(rem);
      if (rem <= 0) {
        void rotateToken();
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [open, isActive, session, rotateToken]);

  async function handleStartQr() {
    if (!session) return;
    setStarting(true);
    setErrorMsg(null);
    try {
      const res = await callAttendanceQr({
        action: 'start',
        session_id: session.id,
        late_after_minutes: lateAfterMinutes,
      });
      if (res.qrToken) {
        issuedAtRef.current = Date.now();
        setQrToken(res.qrToken);
        setSecondsLeft(ROTATE_SECONDS);
        setIsActive(true);
        await loadSessionRecords();
        await onUpdated();
        toast.success('Đã phát mã QR điểm danh động (tự đổi mỗi 15 giây)');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không khởi tạo được QR điểm danh';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  }

  async function handleStopQr() {
    if (!session) return;
    setStopping(true);
    try {
      await callAttendanceQr({
        action: 'stop',
        session_id: session.id,
      });
      setIsActive(false);
      setQrToken(null);
      setQrDataUrl(null);
      toast.success('Đã kết thúc phiên điểm danh QR');
      await loadSessionRecords();
      await onUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Không đóng được phiên QR');
    } finally {
      setStopping(false);
    }
  }

  function handleCloseModal() {
    if (isActive && session) {
      void callAttendanceQr({ action: 'stop', session_id: session.id }).catch(() => {});
    }
    setIsActive(false);
    setQrToken(null);
    setQrDataUrl(null);
    setFullscreen(false);
    onClose();
  }

  // Chỉ hiển thị những sinh viên đã thực sự quét mã QR trong buổi học này
  const checkedInFeed = useMemo(() => {
    return liveRecords
      .filter(
        (r) =>
          r.checkin_method === 'qr' &&
          (r.status === 'present' || r.status === 'late')
      )
      .map((r) => ({
        record: r,
        student: studentById.get(r.student_id) ?? null,
        timestamp: r.checkin_time || r.updated_at,
      }))
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }, [liveRecords, studentById]);

  function handleCopyScanLink() {
    if (!qrToken) return;
    const scanUrl = `${window.location.origin}/attendance-scan?p=${encodeURIComponent(qrToken)}`;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(scanUrl);
      toast.success('Đã sao chép link QR hiện tại (hiệu lực 20 giây)');
    }
  }

  const presentOrLateCount = checkedInFeed.length;
  const totalStudents = enrollments.length;
  const progressPct = Math.min(100, Math.max(0, (secondsLeft / ROTATE_SECONDS) * 100));

  if (!session) return null;

  return (
    <Modal
      open={open}
      onClose={handleCloseModal}
      title={`Điểm danh QR động · ${className}`}
      size="lg"
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-page p-4">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-brand-navy">
                {formatDateVi(session.session_date)} — {session.title}
              </span>
              {session.subject && <Badge tone="navy">{session.subject}</Badge>}
              {isActive ? (
                <Badge tone="success">Đang phát QR (đổi mã 15s)</Badge>
              ) : (
                <Badge tone="neutral">Chưa phát mã</Badge>
              )}
            </div>
            <p className="text-xs text-ink-secondary">
              Chống chụp màn hình gửi Zalo: mỗi mã QR gắn chữ ký HMAC-SHA256 chỉ sống tối đa 20 giây
              và mỗi điện thoại chỉ điểm danh được 1 tài khoản.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isActive && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-ink-secondary">
                <span>Tính đi muộn sau:</span>
                <select
                  value={lateAfterMinutes}
                  onChange={(e) => setLateAfterMinutes(Number(e.target.value))}
                  className="h-9 rounded-lg border border-line-strong bg-surface-card px-2 text-xs font-semibold text-ink-primary focus:border-brand-navy focus:outline-none"
                >
                  <option value={10}>10 phút</option>
                  <option value={15}>15 phút</option>
                  <option value={20}>20 phút</option>
                  <option value={30}>30 phút</option>
                  <option value={45}>45 phút</option>
                </select>
              </label>
            )}

            <Button
              size="sm"
              variant="secondary"
              onClick={() => setFullscreen((v) => !v)}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4 text-brand-navy" aria-hidden="true" />
              )}
              <span>{fullscreen ? 'Thu gọn' : 'Phóng to'}</span>
            </Button>

            {!isActive ? (
              <Button variant="primary" loading={starting} onClick={() => void handleStartQr()}>
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>Bắt đầu điểm danh</span>
              </Button>
            ) : (
              <Button variant="secondary" loading={stopping} onClick={() => void handleStopQr()}>
                <Square className="h-4 w-4 text-brand-red" aria-hidden="true" />
                <span>Kết thúc điểm danh</span>
              </Button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-status-dangerBorder bg-status-dangerBg p-3 text-xs font-semibold text-status-dangerText"
          >
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Cột trái: Khung chiếu mã QR lớn + thanh đếm ngược 15 giây */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface-card p-6 lg:col-span-7">
            {isActive && qrDataUrl ? (
              <div className="flex w-full flex-col items-center gap-4">
                <div className="relative rounded-2xl border-2 border-brand-navy/20 bg-white p-4 shadow-sm">
                  <img
                    src={qrDataUrl}
                    alt="Mã QR điểm danh động"
                    className={
                      fullscreen
                        ? 'h-80 w-80 object-contain sm:h-96 sm:w-96'
                        : 'h-64 w-64 object-contain sm:h-72 sm:w-72'
                    }
                  />
                </div>

                <div className="w-full max-w-sm">
                  <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                    <span className="inline-flex items-center gap-1.5 text-brand-navy">
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${rotating ? 'animate-spin' : ''}`}
                        aria-hidden="true"
                      />
                      <span>Tự động đổi mã sau {secondsLeft}s</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleCopyScanLink}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy hover:underline"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Sao chép link QR</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void rotateToken()}
                        disabled={rotating}
                        className="text-xs font-semibold text-brand-red hover:underline disabled:opacity-50"
                      >
                        Đổi mã ngay
                      </button>
                    </div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                    <div
                      className="h-full rounded-full bg-brand-red transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-brand-navySoft/60 px-3.5 py-2 text-xs font-semibold text-brand-navy">
                  <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Sinh viên vào mục <strong>Quét QR điểm danh</strong> trên AVC Connect để quét
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-navySoft text-brand-navy">
                  <QrCode className="h-8 w-8" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-ink-primary">
                  Sẵn sàng chiếu mã QR điểm danh
                </h3>
                <p className="max-w-sm text-xs text-ink-secondary">
                  Bấm <strong>Bắt đầu điểm danh</strong> để tạo mã QR động xoay vòng mỗi 15 giây trên
                  màn hình máy chiếu.
                </p>
                <Button variant="primary" loading={starting} onClick={() => void handleStartQr()}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>Bắt đầu điểm danh</span>
                </Button>
              </div>
            )}
          </div>

          {/* Cột phải: Bảng Realtime sinh viên vừa quét thành công */}
          <div className="flex flex-col rounded-2xl border border-line bg-surface-card p-5 lg:col-span-5">
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-brand-navy" aria-hidden="true" />
                <span className="text-sm font-bold text-ink-primary">Đã điểm danh (Realtime)</span>
              </div>
              <Badge tone="navy">
                {presentOrLateCount}/{totalStudents} SV
              </Badge>
            </div>

            {checkedInFeed.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-12 text-center">
                <Clock className="h-7 w-7 text-ink-muted" aria-hidden="true" />
                <p className="text-xs font-semibold text-ink-secondary">
                  Chưa có sinh viên nào quét mã
                </p>
                <p className="text-xs text-ink-muted">
                  Khi sinh viên quét thành công, tên và ảnh sẽ hiện ngay tại đây.
                </p>
              </div>
            ) : (
              <div className="flex max-h-80 flex-col divide-y divide-line overflow-y-auto pr-1">
                {checkedInFeed.map(({ record, student, timestamp }) => {
                  const fullName = student?.full_name ?? 'Sinh viên';
                  const code = student?.student_code ?? '';
                  const avatarUrl = student?.avatar_url ?? null;
                  const hasAvatar = isValidAvatarUrl(avatarUrl);
                  const initials = fullName
                    .trim()
                    .split(/\s+/)
                    .slice(-2)
                    .map((w) => w[0]?.toUpperCase() ?? '')
                    .join('');

                  return (
                    <div
                      key={record.id}
                      className="flex items-center justify-between gap-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        {hasAvatar ? (
                          <img
                            src={avatarUrl!}
                            alt={fullName}
                            className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-line"
                          />
                        ) : (
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navySoft text-xs font-bold text-brand-navy">
                            {initials || 'SV'}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-xs font-bold text-ink-primary">{fullName}</p>
                          <p className="truncate text-[11px] text-ink-muted">
                            {code || '—'} · {formatTimeHms(timestamp)}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {record.status === 'late' ? (
                          <Badge tone="warning">Đi muộn</Badge>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-status-successBg px-2.5 py-0.5 text-[11px] font-semibold text-status-successText">
                            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                            <span>Có mặt</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
