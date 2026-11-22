import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Megaphone, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  canUserReceiveAnnouncement,
  getAnnouncementAudienceMeta,
  resolveAnnouncementTargetType,
} from '@/lib/announcements';
import {
  classifyAnnouncementWithAI,
  quickClassifyAnnouncement,
  type AnnouncementSeverity,
} from '@/lib/announcementClassifier';
import { supabase } from '@/lib/supabase';
import { formatDateTimeVi } from '@/lib/classStorage';
import type { Announcement, AnnouncementTargetType } from '@/types/database';

interface LiveAnnouncementItem {
  id: string;
  targetType: AnnouncementTargetType;
  classId: string | null;
  audienceLabel: string;
  badgeText?: string;
  actionTo?: string;
  actionLabel?: string;
  title: string;
  content: string | null;
  createdAt: string;
  severity: AnnouncementSeverity;
}

interface TimerState {
  timeoutId: number | null;
  startedAt: number;
  remainingMs: number;
}

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 4;

export function RealtimeAnnouncementPopup() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<LiveAnnouncementItem[]>([]);
  const [pausedIds, setPausedIds] = useState<Set<string>>(() => new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, TimerState>>(new Map());
  const classNameCacheRef = useRef<Map<string, string>>(new Map());
  const teacherNameCacheRef = useRef<Map<string, string>>(new Map());

  function clearTimer(id: string) {
    const state = timersRef.current.get(id);
    if (state?.timeoutId !== null && state?.timeoutId !== undefined) {
      window.clearTimeout(state.timeoutId);
    }
    timersRef.current.delete(id);
  }

  function dismiss(id: string) {
    clearTimer(id);
    setPausedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function startCountdown(id: string, durationMs = AUTO_DISMISS_MS) {
    const existing = timersRef.current.get(id);
    if (existing?.timeoutId !== null && existing?.timeoutId !== undefined) {
      window.clearTimeout(existing.timeoutId);
    }
    const safeMs = Math.max(50, durationMs);
    const timeoutId = window.setTimeout(() => {
      dismiss(id);
    }, safeMs);
    timersRef.current.set(id, {
      timeoutId,
      startedAt: Date.now(),
      remainingMs: safeMs,
    });
  }

  function pauseCountdown(id: string) {
    const state = timersRef.current.get(id);
    if (!state || state.timeoutId === null) return;
    window.clearTimeout(state.timeoutId);
    const elapsed = Date.now() - state.startedAt;
    const remainingMs = Math.max(50, state.remainingMs - elapsed);
    timersRef.current.set(id, {
      timeoutId: null,
      startedAt: state.startedAt,
      remainingMs,
    });
    setPausedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  function resumeCountdown(id: string) {
    const state = timersRef.current.get(id);
    setPausedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    startCountdown(id, state ? state.remainingMs : AUTO_DISMISS_MS);
  }

  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase
      .channel(`realtime-announcements-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'announcements',
        },
        async (payload) => {
          const row = payload.new as Partial<Announcement> | null;
          if (!row?.id || !row.title) return;
          if (seenIdsRef.current.has(row.id)) return;

          const normalizedRow = {
            class_id: row.class_id ?? null,
            target_type: row.target_type,
            target_user_id: row.target_user_id ?? null,
          };

          if (!canUserReceiveAnnouncement(normalizedRow, user.id, profile.role)) {
            return;
          }

          seenIdsRef.current.add(row.id);

          const title = row.title;
          const content = row.content ?? null;
          const targetType = resolveAnnouncementTargetType(normalizedRow);
          const initialSeverity = quickClassifyAnnouncement(title, content);

          // Chạy song song: lấy tên lớp / tên giáo viên + gọi AI phân loại mức độ cảnh báo
          const classNamePromise = (async (): Promise<string | null> => {
            if (!row.class_id) return null;
            const cached = classNameCacheRef.current.get(row.class_id);
            if (cached) return cached;
            const { data } = await supabase
              .from('classes')
              .select('name')
              .eq('id', row.class_id)
              .maybeSingle<{ name: string }>();
            if (data?.name) {
              classNameCacheRef.current.set(row.class_id, data.name);
              return data.name;
            }
            return null;
          })();

          const teacherNamePromise = (async (): Promise<string | null> => {
            if (targetType !== 'teacher' || !row.target_user_id) return null;
            if (row.target_user_id === user.id) return null;
            const cached = teacherNameCacheRef.current.get(row.target_user_id);
            if (cached) return cached;
            const { data } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', row.target_user_id)
              .maybeSingle<{ full_name: string }>();
            if (data?.full_name) {
              teacherNameCacheRef.current.set(row.target_user_id, data.full_name);
              return data.full_name;
            }
            return null;
          })();

          const aiSeverityPromise = classifyAnnouncementWithAI(title, content);
          const [className, teacherName] = await Promise.all([
            classNamePromise,
            teacherNamePromise,
          ]);

          const audienceMeta = getAnnouncementAudienceMeta(normalizedRow, {
            className,
            teacherName,
            currentUserId: user.id,
          });

          const nextItem: LiveAnnouncementItem = {
            id: row.id,
            targetType,
            classId: row.class_id ?? null,
            audienceLabel: audienceMeta.label,
            title,
            content,
            createdAt: row.created_at ?? new Date().toISOString(),
            severity: initialSeverity,
          };

          setItems((prev) => [nextItem, ...prev].slice(0, MAX_VISIBLE));
          startCountdown(nextItem.id, AUTO_DISMISS_MS);

          // Cập nhật mức độ cảnh báo theo kết quả AI ngay khi AI phản hồi
          const aiSeverity = await aiSeverityPromise;
          if (aiSeverity !== initialSeverity) {
            setItems((prev) =>
              prev.map((it) => (it.id === nextItem.id ? { ...it, severity: aiSeverity } : it))
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'game_suggestions',
        },
        (payload) => {
          if (profile.role !== 'admin') return;
          const row = payload.new as {
            id?: string;
            major_name?: string;
            game_title?: string;
            description?: string;
            created_by_name?: string;
            created_at?: string;
          } | null;
          if (!row?.id || !row.game_title) return;
          const dedupeId = `suggestion-${row.id}`;
          if (seenIdsRef.current.has(dedupeId)) return;
          seenIdsRef.current.add(dedupeId);

          const nextItem: LiveAnnouncementItem = {
            id: dedupeId,
            targetType: 'all',
            classId: null,
            badgeText: 'Đề xuất trò chơi',
            audienceLabel: row.major_name || 'Ngành học',
            actionTo: '/games?tab=suggestions',
            actionLabel: 'Xem & duyệt',
            title: `${row.game_title}${row.created_by_name ? ` — ${row.created_by_name}` : ''}`,
            content: row.description ?? null,
            createdAt: row.created_at ?? new Date().toISOString(),
            severity: 'normal',
          };

          setItems((prev) => [nextItem, ...prev].slice(0, MAX_VISIBLE));
          startCountdown(nextItem.id, AUTO_DISMISS_MS);
        }
      )
      .subscribe();

    const timersMap = timersRef.current;

    return () => {
      void supabase.removeChannel(channel);
      timersMap.forEach((state) => {
        if (state.timeoutId !== null) window.clearTimeout(state.timeoutId);
      });
      timersMap.clear();
    };
  }, [user, profile]);

  if (items.length === 0) return null;

  return (
    <aside
      aria-label="Thông báo mới thời gian thực"
      aria-live="polite"
      className="pointer-events-none fixed right-4 top-20 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3"
    >
      {items.map((item) => {
        const isPaused = pausedIds.has(item.id);
        const isWarning = item.severity === 'warning';

        return (
          <div
            key={item.id}
            onMouseEnter={() => pauseCountdown(item.id)}
            onMouseLeave={() => resumeCountdown(item.id)}
            className={`avc-announcement-enter pointer-events-auto overflow-hidden rounded-xl border shadow-lg transition-colors duration-300 ${
              isWarning
                ? 'border-status-dangerBorder bg-status-dangerBg'
                : 'border-brand-navy/25 bg-surface-card'
            }`}
          >
            {/* Thanh đếm ngược 5 giây thu dần sang trái */}
            <div className={`h-1.5 w-full ${isWarning ? 'bg-status-dangerBorder/50' : 'bg-brand-redSoft'}`}>
              <div
                className={`avc-announcement-countdown h-full w-full ${
                  isWarning ? 'bg-status-dangerText' : 'bg-brand-red'
                }`}
                style={{
                  animationDuration: `${AUTO_DISMISS_MS}ms`,
                  animationPlayState: isPaused ? 'paused' : 'running',
                }}
              />
            </div>

            <div className="flex items-start gap-3 p-4">
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isWarning
                    ? 'bg-status-dangerText text-white'
                    : 'bg-brand-redSoft text-brand-red'
                }`}
              >
                {isWarning ? (
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Megaphone className="h-4 w-4" aria-hidden="true" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold text-white ${
                        isWarning ? 'bg-status-dangerText' : 'bg-brand-red'
                      }`}
                    >
                      {isWarning ? 'Cảnh báo' : item.badgeText || 'Thông báo mới'}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isWarning
                          ? 'bg-surface-card text-status-dangerText'
                          : 'bg-brand-navySoft text-brand-navy'
                      }`}
                    >
                      {item.audienceLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(item.id)}
                    aria-label="Đóng thông báo"
                    className={`shrink-0 rounded p-1 ${
                      isWarning
                        ? 'text-status-dangerText hover:bg-status-dangerBorder/40'
                        : 'text-ink-muted hover:bg-surface-page hover:text-ink-primary'
                    }`}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <p
                  className={`mt-1.5 line-clamp-2 text-sm font-bold ${
                    isWarning ? 'text-status-dangerText' : 'text-ink-primary'
                  }`}
                >
                  {item.title}
                </p>

                {item.content && (
                  <p
                    className={`mt-1 line-clamp-2 whitespace-pre-line text-xs font-normal ${
                      isWarning ? 'text-status-dangerText/90' : 'text-ink-secondary'
                    }`}
                  >
                    {item.content}
                  </p>
                )}

                <div
                  className={`mt-2.5 flex items-center justify-between gap-2 border-t pt-2 ${
                    isWarning ? 'border-status-dangerBorder/60' : 'border-line'
                  }`}
                >
                  <span
                    className={`text-[11px] ${
                      isWarning ? 'text-status-dangerText/80' : 'text-ink-muted'
                    }`}
                  >
                    {formatDateTimeVi(item.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      dismiss(item.id);
                      if (item.actionTo) {
                        navigate(item.actionTo);
                      } else if (item.classId) {
                        navigate(`/classes/${item.classId}?tab=announcements`);
                      } else {
                        navigate('/tools');
                      }
                    }}
                    className={`inline-flex items-center gap-1 text-xs font-semibold hover:underline ${
                      isWarning
                        ? 'text-status-dangerText'
                        : 'text-brand-navy hover:text-brand-red'
                    }`}
                  >
                    <span>
                      {item.actionLabel || (item.classId ? 'Xem thông báo' : 'Về Trang chủ')}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
