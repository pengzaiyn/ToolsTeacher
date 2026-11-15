import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatCountdown, playTimerBeep } from '@/lib/classroomKit';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

const PRESET_MINUTES = [1, 3, 5, 10, 15, 30, 45];

export function ClassTimerTab() {
  const toast = useToast();
  const [activityLabel, setActivityLabel] = useState('');
  const [durationSec, setDurationSec] = useState(300);
  const [remainingSec, setRemainingSec] = useState(300);
  const [customMin, setCustomMin] = useState('5');
  const [customSec, setCustomSec] = useState('0');
  const [running, setRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [projectorOpen, setProjectorOpen] = useState(false);

  const endTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (!projectorOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProjectorOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [projectorOpen]);

  useEffect(() => {
    if (!running) return;
    if (endTimeRef.current === null) {
      endTimeRef.current = Date.now() + remainingSec * 1000;
    }

    const timerId = window.setInterval(() => {
      if (endTimeRef.current === null) return;
      const next = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setRemainingSec(next);
      if (next === 0) {
        endTimeRef.current = null;
        setRunning(false);
        if (soundEnabled) playTimerBeep();
        toast.info(activityLabel.trim() ? `Hết giờ: ${activityLabel.trim()}` : 'Đã hết giờ!');
      }
    }, 200);

    return () => window.clearInterval(timerId);
  }, [running, remainingSec, soundEnabled, activityLabel, toast]);

  function applySeconds(total: number) {
    const clamped = Math.max(1, Math.min(total, 180 * 60));
    endTimeRef.current = null;
    setRunning(false);
    setDurationSec(clamped);
    setRemainingSec(clamped);
    setCustomMin(String(Math.floor(clamped / 60)));
    setCustomSec(String(clamped % 60));
  }

  function handleCustomSubmit(event: FormEvent) {
    event.preventDefault();
    const m = Math.max(0, Number.parseInt(customMin || '0', 10) || 0);
    const s = Math.max(0, Math.min(59, Number.parseInt(customSec || '0', 10) || 0));
    const total = m * 60 + s;
    if (total <= 0) {
      toast.error('Thời gian phải lớn hơn 0 giây');
      return;
    }
    applySeconds(total);
  }

  function handleToggleStartPause() {
    if (remainingSec <= 0) {
      endTimeRef.current = Date.now() + durationSec * 1000;
      setRemainingSec(durationSec);
      setRunning(true);
      return;
    }
    if (running) {
      endTimeRef.current = null;
      setRunning(false);
    } else {
      endTimeRef.current = Date.now() + remainingSec * 1000;
      setRunning(true);
    }
  }

  function handleReset() {
    endTimeRef.current = null;
    setRunning(false);
    setRemainingSec(durationSec);
  }

  const progressPct = durationSec > 0 ? Math.round((remainingSec / durationSec) * 100) : 0;
  const isWarningZone = remainingSec <= 10;

  function renderClockBody(isProjector: boolean) {
    return (
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge tone={remainingSec === 0 ? 'danger' : running ? 'red' : 'navy'}>
            {remainingSec === 0 ? 'Đã hết giờ' : running ? 'Đang đếm ngược' : 'Đang tạm dừng'}
          </Badge>
          {activityLabel.trim() && (
            <span
              className={`font-bold text-ink-primary ${
                isProjector ? 'text-xl sm:text-2xl' : 'text-base'
              }`}
            >
              {activityLabel.trim()}
            </span>
          )}
        </div>

        <p
          className={`font-bold tabular-nums tracking-tight ${
            isWarningZone ? 'text-brand-red' : 'text-brand-navy'
          } ${isProjector ? 'text-7xl sm:text-9xl' : 'text-6xl sm:text-7xl'}`}
        >
          {formatCountdown(remainingSec)}
        </p>

        <div className="h-2 w-full max-w-xl overflow-hidden rounded-full bg-surface-subtle">
          <div
            className={`h-full transition-all duration-300 ${
              isWarningZone ? 'bg-brand-red' : 'bg-brand-navy'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Button variant={running ? 'navy' : 'primary'} onClick={handleToggleStartPause}>
            {running ? (
              <>
                <Pause className="h-4 w-4" aria-hidden="true" />
                <span>Tạm dừng</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>{remainingSec === 0 ? 'Chạy lại' : 'Bắt đầu'}</span>
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Đặt lại</span>
          </Button>
          <Button
            variant="secondary"
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? 'Tắt âm báo' : 'Bật âm báo'}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                <span>Âm báo: Bật</span>
              </>
            ) : (
              <>
                <VolumeX className="h-4 w-4 text-ink-muted" aria-hidden="true" />
                <span>Âm báo: Tắt</span>
              </>
            )}
          </Button>
          <Button variant="secondary" onClick={() => setProjectorOpen((v) => !v)}>
            {isProjector ? (
              <>
                <Minimize2 className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                <span>Thu gọn</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4 text-brand-navy" aria-hidden="true" />
                <span>Chiếu toàn màn hình</span>
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <section className="flex flex-col justify-center rounded-xl border border-line bg-surface-card p-6 sm:p-8 lg:col-span-2">
        {renderClockBody(false)}
      </section>

      <aside className="flex flex-col gap-6 rounded-xl border border-line bg-surface-card p-6">
        <div className="flex items-center gap-2 border-b border-line pb-4">
          <Timer className="h-5 w-5 text-brand-red" aria-hidden="true" />
          <h3 className="text-base font-bold text-brand-navy">Cài đặt đồng hồ</h3>
        </div>

        <Input
          label="Tên hoạt động (hiển thị khi chiếu)"
          value={activityLabel}
          onChange={(e) => setActivityLabel(e.target.value)}
          placeholder="VD: Thảo luận nhóm, Thuyết trình"
        />

        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-ink-primary">Chọn nhanh thời lượng</span>
          <div className="flex flex-wrap gap-2">
            {PRESET_MINUTES.map((min) => {
              const active = durationSec === min * 60;
              return (
                <Button
                  key={min}
                  size="sm"
                  variant={active ? 'navy' : 'secondary'}
                  onClick={() => applySeconds(min * 60)}
                >
                  {min} phút
                </Button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleCustomSubmit} className="flex flex-col gap-4 border-t border-line pt-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Phút"
              type="number"
              min={0}
              max={180}
              value={customMin}
              onChange={(e) => setCustomMin(e.target.value)}
            />
            <Input
              label="Giây"
              type="number"
              min={0}
              max={59}
              value={customSec}
              onChange={(e) => setCustomSec(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary">
            Áp dụng thời gian
          </Button>
        </form>
      </aside>

      {projectorOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-surface-page p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Đồng hồ chiếu toàn màn hình"
        >
          <div className="w-full max-w-4xl rounded-2xl border border-line bg-surface-card p-8 shadow-xl">
            {renderClockBody(true)}
          </div>
        </div>
      )}
    </div>
  );
}

