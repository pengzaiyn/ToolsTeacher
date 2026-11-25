import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  Clock,
  QrCode,
  RefreshCw,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  callAttendanceQr,
  getOrCreateAttendanceDeviceId,
  type AttendanceQrResponse,
} from '@/lib/supabase';
import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

const SCANNER_REGION_ID = 'avc-student-qr-reader';
const ZOOM_PRESETS = [1, 2, 3, 4];

function formatTimeHms(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function StudentQrAttendance() {
  const { profile } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [checkinError, setCheckinError] = useState<string | null>(null);
  const [checkinSuccess, setCheckinSuccess] = useState<AttendanceQrResponse | null>(null);
  const [manualTokenInput, setManualTokenInput] = useState('');

  // Điều khiển thu phóng Camera (Zoom quang học/cảm biến + fallback thu phóng số mượt)
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [maxHardwareZoom, setMaxHardwareZoom] = useState<number>(5);
  const [supportsHardwareZoom, setSupportsHardwareZoom] = useState<boolean>(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingTokenRef = useRef<string | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1);

  const applyCameraZoom = useCallback(
    async (targetZoom: number) => {
      const clamped = Math.min(5, Math.max(1, Number(targetZoom.toFixed(1))));
      setZoomLevel(clamped);

      const inst = scannerRef.current;
      if (!inst || !inst.isScanning) return;

      // 1. Thử dùng zoom phần cứng của ống kính (nét nhất khi ngồi xa)
      if (supportsHardwareZoom) {
        try {
          const hwZoom = Math.min(maxHardwareZoom, clamped);
          await inst.applyVideoConstraints({
            advanced: [{ zoom: hwZoom } as MediaTrackConstraintSet],
          });
          return;
        } catch {
          // Nếu trình duyệt từ chối constraint, chuyển sang CSS transform bên dưới
        }
      }

      // 2. Fallback: Phóng to khung hình video trực tiếp
      const container = document.getElementById(SCANNER_REGION_ID);
      const videoEl = container?.querySelector('video');
      if (videoEl) {
        videoEl.style.transform = clamped > 1 ? `scale(${clamped})` : '';
        videoEl.style.transformOrigin = 'center center';
        videoEl.style.transition = 'transform 120ms ease-out';
      }
    },
    [supportsHardwareZoom, maxHardwareZoom]
  );

  const stopCamera = useCallback(async () => {
    const inst = scannerRef.current;
    scannerRef.current = null;
    setZoomLevel(1);
    setSupportsHardwareZoom(false);
    if (!inst) {
      setScanning(false);
      return;
    }
    try {
      if (inst.isScanning) {
        await inst.stop();
      }
      inst.clear();
    } catch {
      // Bỏ qua lỗi khi đóng camera
    } finally {
      setScanning(false);
    }
  }, []);

  const submitScannedToken = useCallback(
    async (rawToken: string) => {
      const cleaned = rawToken.trim();
      if (!cleaned || processingTokenRef.current === cleaned) return;
      processingTokenRef.current = cleaned;

      setSubmitting(true);
      setCheckinError(null);
      setCheckinSuccess(null);

      await stopCamera();

      try {
        const res = await callAttendanceQr({
          action: 'checkin',
          token: cleaned,
          device_id: getOrCreateAttendanceDeviceId(),
        });
        setCheckinSuccess(res);
        toast.success('Điểm danh QR thành công!');
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Mã QR đã hết hạn, vui lòng nhìn lên bảng quét mã mới!';
        setCheckinError(msg);
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [stopCamera, toast]
  );

  // Tự động điểm danh nếu mở vào /attendance-scan?p=...
  useEffect(() => {
    const urlToken = searchParams.get('p') || searchParams.get('token');
    if (!urlToken) return;
    setSearchParams({}, { replace: true });
    void submitScannedToken(urlToken);
  }, [searchParams, setSearchParams, submitScannedToken]);

  useEffect(() => {
    return () => {
      void stopCamera();
    };
  }, [stopCamera]);

  async function startCamera() {
    setCameraError(null);
    setCheckinError(null);
    setCheckinSuccess(null);
    processingTokenRef.current = null;

    await stopCamera();

    try {
      // Bật bộ giải mã phần cứng BarcodeDetector của Chrome/iOS và chỉ quét đúng chuẩn QR_CODE
      // giúp tốc độ bắt mã nhanh gấp 5-10 lần
      const html5QrCode = new Html5Qrcode(SCANNER_REGION_ID, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      });
      scannerRef.current = html5QrCode;
      setScanning(true);

      await html5QrCode.start(
        {
          facingMode: 'environment',
        },
        {
          fps: 24,
          disableFlip: true,
          aspectRatio: 1.0,
          // Mở rộng vùng quét lên 85% khung hình để không cần căn sát
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.max(220, Math.floor(minEdge * 0.85));
            return { width: boxSize, height: boxSize };
          },
          videoConstraints: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        (decodedText) => {
          void submitScannedToken(decodedText);
        },
        () => {
          // Bỏ qua frame chưa có QR
        }
      );

      // Kiểm tra xem camera điện thoại có hỗ trợ zoom phần cứng không
      try {
        const caps = html5QrCode.getRunningTrackCapabilities() as MediaTrackCapabilities & {
          zoom?: { min?: number; max?: number; step?: number };
        };
        if (caps?.zoom && typeof caps.zoom.max === 'number' && caps.zoom.max > 1) {
          setSupportsHardwareZoom(true);
          setMaxHardwareZoom(Math.min(8, caps.zoom.max));
        }
      } catch {
        setSupportsHardwareZoom(false);
      }
    } catch (err) {
      setScanning(false);
      const raw = err instanceof Error ? err.message : '';
      if (raw.toLowerCase().includes('permission') || raw.toLowerCase().includes('notallowed')) {
        setCameraError(
          'Trình duyệt chưa được cấp quyền Camera. Vui lòng bấm Cho phép (Allow) truy cập Camera trên thanh địa chỉ.'
        );
      } else {
        setCameraError(
          'Không mở được Camera trên thiết bị này. Vui lòng kiểm tra quyền Camera hoặc mở bằng trình duyệt Safari / Chrome.'
        );
      }
    }
  }

  // Hỗ trợ dùng 2 ngón tay chụm/mở (Pinch-to-Zoom) trực tiếp trên khung Camera
  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      pinchStartZoomRef.current = zoomLevel;
    }
  }

  function handleTouchMove(e: TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / pinchStartDistRef.current;
      void applyCameraZoom(pinchStartZoomRef.current * scale);
    }
  }

  function handleTouchEnd() {
    pinchStartDistRef.current = null;
  }

  return (
    <Layout>
      <div className="mx-auto flex max-w-xl flex-col gap-6">
        <div>
          <Link
            to="/tools"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-navy hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Quay lại trung tâm công cụ</span>
          </Link>
        </div>

        <section className="rounded-2xl border border-line bg-surface-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-navySoft text-brand-navy">
                <QrCode className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-brand-navy">Quét QR điểm danh</h1>
                <p className="text-xs text-ink-secondary">
                  Hướng camera điện thoại lên màn hình máy chiếu của giảng viên
                </p>
              </div>
            </div>
            {profile?.student_code && <Badge tone="navy">{profile.student_code}</Badge>}
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl bg-surface-page px-3.5 py-2.5 text-xs text-ink-secondary">
            <ShieldCheck className="h-4 w-4 shrink-0 text-brand-navy" aria-hidden="true" />
            <span>
              Đang đăng nhập: <strong className="text-ink-primary">{profile?.full_name}</strong>
              {profile?.class_name ? ` · Lớp ${profile.class_name}` : ''}
            </span>
          </div>

          {/* Trạng thái điểm danh thành công */}
          {checkinSuccess && (
            <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border-2 border-status-successBorder bg-status-successBg p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-status-successText shadow-sm">
                <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-bold text-status-successText">
                Điểm danh thành công lúc {formatTimeHms(checkinSuccess.checkinTime)}
              </h2>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {checkinSuccess.status === 'late' ? (
                  <Badge tone="warning">Trạng thái: Đi muộn</Badge>
                ) : (
                  <Badge tone="success">Trạng thái: Có mặt</Badge>
                )}
                {checkinSuccess.className && (
                  <Badge tone="navy">Lớp {checkinSuccess.className}</Badge>
                )}
              </div>
              {(checkinSuccess.sessionTitle || checkinSuccess.subject) && (
                <p className="text-xs font-semibold text-status-successText/90">
                  {[checkinSuccess.subject, checkinSuccess.sessionTitle].filter(Boolean).join(' · ')}
                </p>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCheckinSuccess(null);
                  processingTokenRef.current = null;
                }}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Quét buổi học khác</span>
              </Button>
            </div>
          )}

          {/* Trạng thái mã QR hết hạn hoặc lỗi chống gian lận */}
          {checkinError && (
            <div
              role="alert"
              className="mt-5 flex flex-col items-center gap-3 rounded-2xl border-2 border-status-dangerBorder bg-status-dangerBg p-5 text-center"
            >
              <AlertTriangle className="h-10 w-10 text-status-dangerText" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-status-dangerText">{checkinError}</p>
                <p className="text-xs text-status-dangerText/80">
                  Mã QR trên bảng thay đổi mỗi 15 giây (hiệu lực tối đa 20 giây) và không nhận ảnh
                  chụp màn hình gửi qua Zalo.
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => void startCamera()}>
                <Camera className="h-4 w-4" aria-hidden="true" />
                <span>Quét lại mã mới trên bảng</span>
              </Button>
            </div>
          )}

          {cameraError && (
            <div
              role="alert"
              className="mt-5 rounded-xl border border-status-warningBorder bg-status-warningBg p-4 text-xs font-semibold text-status-warningText"
            >
              {cameraError}
            </div>
          )}

          {/* Vùng hiển thị Camera quét QR (hỗ trợ Pinch-to-Zoom 2 ngón tay + Thanh trượt Zoom 1x-5x) */}
          <div className="mt-5 flex flex-col items-center gap-4">
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className={`relative w-full overflow-hidden rounded-2xl border-2 ${
                scanning ? 'border-brand-navy bg-black' : 'border-dashed border-line bg-surface-page'
              }`}
            >
              <div id={SCANNER_REGION_ID} className="w-full overflow-hidden" />

              {!scanning && !checkinSuccess && (
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-navySoft text-brand-navy">
                    <Camera className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-bold text-ink-primary">
                    {submitting ? 'Đang xác thực mã QR...' : 'Nhấn nút bên dưới để mở Camera quét mã'}
                  </p>
                  <p className="max-w-xs text-xs text-ink-muted">
                    Hỗ trợ phóng to Camera từ 1x đến 5x để quét dễ dàng từ cuối lớp học.
                  </p>
                </div>
              )}
            </div>

            {/* Bộ điều khiển phóng to Camera (1x / 2x / 3x / 4x + Thanh kéo mượt) */}
            {scanning && (
              <div className="flex w-full flex-col gap-2.5 rounded-xl border border-line bg-surface-page p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-ink-primary">
                    Phóng to Camera ({zoomLevel.toFixed(1)}x)
                  </span>
                  <div className="flex items-center gap-1.5">
                    {ZOOM_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => void applyCameraZoom(preset)}
                        className={`h-7 rounded-lg px-2.5 text-xs font-bold transition-colors ${
                          Math.abs(zoomLevel - preset) < 0.2
                            ? 'bg-brand-navy text-white'
                            : 'border border-line bg-surface-card text-ink-secondary hover:bg-surface-subtle'
                        }`}
                      >
                        {preset}x
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    aria-label="Thu nhỏ camera"
                    onClick={() => void applyCameraZoom(zoomLevel - 0.5)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-card text-ink-secondary hover:text-brand-navy"
                  >
                    <ZoomOut className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={0.1}
                    value={zoomLevel}
                    onChange={(e) => void applyCameraZoom(Number(e.target.value))}
                    aria-label="Mức phóng to camera"
                    className="h-2 flex-1 cursor-pointer accent-brand-navy"
                  />
                  <button
                    type="button"
                    aria-label="Phóng to camera"
                    onClick={() => void applyCameraZoom(zoomLevel + 0.5)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-card text-ink-secondary hover:text-brand-navy"
                  >
                    <ZoomIn className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              {!scanning ? (
                <Button
                  variant="primary"
                  loading={submitting}
                  onClick={() => void startCamera()}
                  className="w-full sm:w-auto"
                >
                  <Camera className="h-4 w-4" aria-hidden="true" />
                  <span>Mở Camera quét mã</span>
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => void stopCamera()}
                  className="w-full sm:w-auto"
                >
                  <CameraOff className="h-4 w-4 text-brand-red" aria-hidden="true" />
                  <span>Tắt Camera</span>
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-line bg-surface-page p-4">
            <p className="mb-2 text-xs font-bold text-ink-primary">
              Hoặc dán link / mã QR để điểm danh (dùng khi test trên máy tính)
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={manualTokenInput}
                onChange={(e) => setManualTokenInput(e.target.value)}
                placeholder="Dán link hoặc mã QR vừa sao chép..."
                disabled={submitting}
                className="h-10 flex-1 rounded-lg border border-line-strong bg-surface-card px-3 text-xs text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none disabled:opacity-60"
              />
              <Button
                variant="navy"
                size="sm"
                loading={submitting}
                disabled={!manualTokenInput.trim()}
                onClick={() => {
                  const val = manualTokenInput.trim();
                  setManualTokenInput('');
                  processingTokenRef.current = null;
                  void submitScannedToken(val);
                }}
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Xác nhận mã</span>
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-surface-page p-3.5 text-xs text-ink-secondary">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-navy" aria-hidden="true" />
            <span>
              Mẹo: Khi ngồi ở cuối lớp, bạn có thể bấm nút <strong>2x / 3x / 4x</strong> hoặc dùng
              2 ngón tay phóng to khung hình Camera để bắt mã QR từ xa cực nhanh.
            </span>
          </div>
        </section>
      </div>
    </Layout>
  );
}
