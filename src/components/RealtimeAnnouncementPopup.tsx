import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Megaphone, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDateTimeVi } from '@/lib/classStorage';
import type { Announcement } from '@/types/database';

interface LiveAnnouncementItem {
  id: string;
  classId: string | null;
  className: string | null;
  title: string;
  content: string | null;
  createdAt: string;
}

const AUTO_DISMISS_MS = 10000;
const MAX_VISIBLE = 4;

export function RealtimeAnnouncementPopup() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<LiveAnnouncementItem[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const timersRef = useRef<Map<string, number>>(new Map());
  const classNameCacheRef = useRef<Map<string, string>>(new Map());

  function dismiss(id: string) {
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function scheduleDismiss(id: string) {
    const existing = timersRef.current.get(id);
    if (existing !== undefined) {
      window.clearTimeout(existing);
    }
    const timer = window.setTimeout(() => {
      timersRef.current.delete(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, AUTO_DISMISS_MS);
    timersRef.current.set(id, timer);
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
          seenIdsRef.current.add(row.id);

          let className: string | null = null;
          if (row.class_id) {
            const cached = classNameCacheRef.current.get(row.class_id);
            if (cached) {
              className = cached;
            } else {
              const { data } = await supabase
                .from('classes')
                .select('name')
                .eq('id', row.class_id)
                .maybeSingle<{ name: string }>();
              if (data?.name) {
                className = data.name;
                classNameCacheRef.current.set(row.class_id, data.name);
              }
            }
          }

          const nextItem: LiveAnnouncementItem = {
            id: row.id,
            classId: row.class_id ?? null,
            className,
            title: row.title,
            content: row.content ?? null,
            createdAt: row.created_at ?? new Date().toISOString(),
          };

          setItems((prev) => [nextItem, ...prev].slice(0, MAX_VISIBLE));
          scheduleDismiss(nextItem.id);
        }
      )
      .subscribe();

    const timersMap = timersRef.current;

    return () => {
      void supabase.removeChannel(channel);
      timersMap.forEach((timer) => window.clearTimeout(timer));
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
      {items.map((item) => (
        <div
          key={item.id}
          onMouseEnter={() => {
            const timer = timersRef.current.get(item.id);
            if (timer !== undefined) {
              window.clearTimeout(timer);
              timersRef.current.delete(item.id);
            }
          }}
          onMouseLeave={() => scheduleDismiss(item.id)}
          className="pointer-events-auto overflow-hidden rounded-xl border border-brand-navy/25 bg-surface-card shadow-lg transition-all"
        >
          <div className="h-1 w-full bg-brand-red" />
          <div className="flex items-start gap-3 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-redSoft text-brand-red">
              <Megaphone className="h-4 w-4" aria-hidden="true" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-brand-red px-2 py-0.5 text-[11px] font-bold text-white">
                    Thông báo mới
                  </span>
                  <span className="rounded-full bg-brand-navySoft px-2 py-0.5 text-[11px] font-semibold text-brand-navy">
                    {item.className ? `Lớp ${item.className}` : 'Toàn trường'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  aria-label="Đóng thông báo"
                  className="shrink-0 rounded p-1 text-ink-muted hover:bg-surface-page hover:text-ink-primary"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <p className="mt-1.5 line-clamp-2 text-sm font-bold text-ink-primary">
                {item.title}
              </p>

              {item.content && (
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs font-normal text-ink-secondary">
                  {item.content}
                </p>
              )}

              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2">
                <span className="text-[11px] text-ink-muted">
                  {formatDateTimeVi(item.createdAt)}
                </span>
                {item.classId && (
                  <button
                    type="button"
                    onClick={() => {
                      dismiss(item.id);
                      navigate(`/classes/${item.classId}?tab=announcements`);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-navy hover:text-brand-red hover:underline"
                  >
                    <span>Xem thông báo</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </aside>
  );
}

