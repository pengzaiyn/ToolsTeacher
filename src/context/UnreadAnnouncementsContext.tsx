import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { canUserReceiveAnnouncement, resolveAnnouncementTargetType } from '@/lib/announcements';
import { supabase } from '@/lib/supabase';
import type { Announcement } from '@/types/database';

interface AnnouncementSummary {
  id: string;
  class_id: string | null;
  target_type?: Announcement['target_type'];
  target_user_id?: string | null;
  created_by?: string | null;
  created_at: string;
}

interface LastSeenMap {
  school: string | null;
  classes: Record<string, string>;
}

interface UnreadAnnouncementsContextValue {
  schoolUnreadCount: number;
  totalClassUnreadCount: number;
  getClassUnreadCount: (classId: string) => number;
  markSchoolSeen: () => void;
  markClassSeen: (classId: string) => void;
}

const EMPTY_LAST_SEEN: LastSeenMap = { school: null, classes: {} };

const UnreadAnnouncementsContext = createContext<UnreadAnnouncementsContextValue>({
  schoolUnreadCount: 0,
  totalClassUnreadCount: 0,
  getClassUnreadCount: () => 0,
  markSchoolSeen: () => undefined,
  markClassSeen: () => undefined,
});

function storageKey(userId: string): string {
  return `avc_ann_last_seen_${userId}`;
}

function readLastSeen(userId: string): LastSeenMap {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return EMPTY_LAST_SEEN;
    const parsed = JSON.parse(raw) as Partial<LastSeenMap>;
    return {
      school: typeof parsed.school === 'string' ? parsed.school : null,
      classes:
        parsed.classes && typeof parsed.classes === 'object'
          ? (parsed.classes as Record<string, string>)
          : {},
    };
  } catch {
    return EMPTY_LAST_SEEN;
  }
}

function writeLastSeen(userId: string, next: LastSeenMap): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage
  }
}

export function UnreadAnnouncementsProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<AnnouncementSummary[]>([]);
  const [lastSeen, setLastSeen] = useState<LastSeenMap>(EMPTY_LAST_SEEN);

  const loadAnnouncements = useCallback(async () => {
    if (!user || !profile) {
      setRows([]);
      return;
    }

    const { data, error } = await supabase
      .from('announcements')
      .select('id, class_id, target_type, target_user_id, created_by, created_at')
      .order('created_at', { ascending: false })
      .limit(250)
      .returns<AnnouncementSummary[]>();

    if (error) return;

    const visible = (data ?? []).filter((item) =>
      canUserReceiveAnnouncement(item, user.id, profile.role)
    );
    setRows(visible);
  }, [user, profile]);

  useEffect(() => {
    if (!user) {
      setLastSeen(EMPTY_LAST_SEEN);
      setRows([]);
      return;
    }
    setLastSeen(readLastSeen(user.id));
    void loadAnnouncements();
  }, [user, loadAnnouncements]);

  useEffect(() => {
    if (!user || !profile) return;

    const channel = supabase
      .channel(`unread-announcements-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          const item = payload.new as Partial<AnnouncementSummary> | null;
          if (!item?.id || !item.created_at) return;
          const normalized: AnnouncementSummary = {
            id: item.id,
            class_id: item.class_id ?? null,
            target_type: item.target_type,
            target_user_id: item.target_user_id ?? null,
            created_by: item.created_by ?? null,
            created_at: item.created_at,
          };
          if (!canUserReceiveAnnouncement(normalized, user.id, profile.role)) return;
          setRows((prev) => {
            if (prev.some((existing) => existing.id === normalized.id)) return prev;
            return [normalized, ...prev].slice(0, 250);
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'announcements' },
        (payload) => {
          const oldItem = payload.old as Partial<AnnouncementSummary> | null;
          if (!oldItem?.id) return;
          setRows((prev) => prev.filter((item) => item.id !== oldItem.id));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, profile]);

  const markSchoolSeen = useCallback(() => {
    if (!user) return;
    let latestMs = Date.now();
    for (const row of rows) {
      if (resolveAnnouncementTargetType(row) !== 'class') {
        const ms = Date.parse(row.created_at) || 0;
        if (ms > latestMs) latestMs = ms;
      }
    }
    const seenIso = new Date(latestMs).toISOString();
    setLastSeen((prev) => {
      const next: LastSeenMap = { ...prev, school: seenIso };
      writeLastSeen(user.id, next);
      return next;
    });
  }, [user, rows]);

  const markClassSeen = useCallback(
    (classId: string) => {
      if (!user || !classId) return;
      let latestMs = Date.now();
      for (const row of rows) {
        if (row.class_id === classId) {
          const ms = Date.parse(row.created_at) || 0;
          if (ms > latestMs) latestMs = ms;
        }
      }
      const seenIso = new Date(latestMs).toISOString();
      setLastSeen((prev) => {
        const next: LastSeenMap = {
          ...prev,
          classes: {
            ...prev.classes,
            [classId]: seenIso,
          },
        };
        writeLastSeen(user.id, next);
        return next;
      });
    },
    [user, rows]
  );

  const computed = useMemo(() => {
    let schoolUnreadCount = 0;
    const classCounts = new Map<string, number>();

    const schoolSeenMs = lastSeen.school ? Date.parse(lastSeen.school) : 0;

    for (const row of rows) {
      // Không tính thông báo do chính người dùng hiện tại vừa đăng là "chưa đọc"
      if (user && row.created_by && row.created_by === user.id) continue;

      const createdMs = Date.parse(row.created_at) || 0;
      const targetType = resolveAnnouncementTargetType(row);

      if (targetType === 'class' && row.class_id) {
        const seenStr = lastSeen.classes[row.class_id];
        const seenMs = seenStr ? Date.parse(seenStr) : 0;
        if (createdMs > seenMs) {
          classCounts.set(row.class_id, (classCounts.get(row.class_id) ?? 0) + 1);
        }
      } else if (createdMs > schoolSeenMs) {
        schoolUnreadCount += 1;
      }
    }

    let totalClassUnreadCount = 0;
    classCounts.forEach((count) => {
      totalClassUnreadCount += count;
    });

    return { schoolUnreadCount, totalClassUnreadCount, classCounts };
  }, [rows, lastSeen, user]);

  const getClassUnreadCount = useCallback(
    (classId: string) => computed.classCounts.get(classId) ?? 0,
    [computed.classCounts]
  );

  const value = useMemo<UnreadAnnouncementsContextValue>(
    () => ({
      schoolUnreadCount: computed.schoolUnreadCount,
      totalClassUnreadCount: computed.totalClassUnreadCount,
      getClassUnreadCount,
      markSchoolSeen,
      markClassSeen,
    }),
    [
      computed.schoolUnreadCount,
      computed.totalClassUnreadCount,
      getClassUnreadCount,
      markSchoolSeen,
      markClassSeen,
    ]
  );

  return (
    <UnreadAnnouncementsContext.Provider value={value}>
      {children}
    </UnreadAnnouncementsContext.Provider>
  );
}

export function useUnreadAnnouncements() {
  return useContext(UnreadAnnouncementsContext);
}

export function UnreadBadge({
  count,
  className = '',
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  return (
    <span
      aria-label={`${label} thông báo chưa đọc`}
      className={`pointer-events-none absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-red px-1 text-[11px] font-bold leading-none text-white ring-2 ring-surface-card ${className}`}
    >
      {label}
    </span>
  );
}

