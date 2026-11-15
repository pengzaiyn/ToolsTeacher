import { useEffect, useId, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { drawMathCaptchaCanvas, type MathCaptchaChallenge } from '@/lib/mathCaptcha';

interface MathCaptchaFieldProps {
  challenge: MathCaptchaChallenge;
  value: string;
  onChange: (nextValue: string) => void;
  onRefresh: () => void;
  error?: string | null;
  disabled?: boolean;
}

/** Khung hiển thị CAPTCHA phép tính bằng Canvas kèm nút làm mới và ô nhập kết quả */
export function MathCaptchaField({
  challenge,
  value,
  onChange,
  onRefresh,
  error,
  disabled = false,
}: MathCaptchaFieldProps) {
  const inputId = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const redraw = () => {
      drawMathCaptchaCanvas(canvas, challenge.expression);
    };

    redraw();

    // Vẽ lại khi người dùng chuyển Sáng/Tối hoặc đổi bảng màu tùy chỉnh trên <html>
    const observer = new MutationObserver(() => {
      redraw();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    return () => observer.disconnect();
  }, [challenge.expression, resolvedTheme]);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-semibold text-ink-primary">
        Mã xác minh
        <span className="ml-1 text-brand-red">*</span>
      </label>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="flex shrink-0 items-center gap-2">
          <div className="overflow-hidden rounded-lg border border-line-strong bg-surface-subtle">
            <canvas
              ref={canvasRef}
              width={168}
              height={40}
              role="img"
              aria-label="Hình ảnh phép tính xác minh bảo mật"
              className="block h-10 w-[168px] select-none"
            />
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={disabled}
            title="Đổi phép tính khác"
            aria-label="Đổi phép tính xác minh khác"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-surface-card text-ink-secondary transition-colors hover:border-brand-navy hover:text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Nhập kết quả..."
          required
          className={`h-10 w-full rounded-lg border bg-surface-card px-4 text-sm font-normal text-ink-primary placeholder:text-ink-muted focus:border-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-muted ${
            error ? 'border-brand-red' : 'border-line-strong'
          }`}
        />
      </div>

      {error ? (
        <p className="text-xs font-normal text-brand-red">{error}</p>
      ) : (
        <p className="text-xs font-normal text-ink-muted">
          Nhập kết quả phép tính trong hình để xác minh trước khi đăng nhập.
        </p>
      )}
    </div>
  );
}

