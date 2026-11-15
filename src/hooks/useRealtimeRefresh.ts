import { useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface RealtimeTableWatch {
  table: string;
  event?: '*' | 'INSERT' | 'UPDATE' | 'DELETE';
  filter?: string;
}

interface UseRealtimeRefreshOptions {
  channelName: string;
  tables: RealtimeTableWatch[];
  onRefresh: () => void | Promise<void>;
  enabled?: boolean;
  debounceMs?: number;
}

export function useRealtimeRefresh({
  channelName,
  tables,
  onRefresh,
  enabled = true,
  debounceMs = 400,
}: UseRealtimeRefreshOptions) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const tablesSignature = useMemo(
    () =>
      tables
        .map((t) => `${t.table}:${t.event ?? '*'}:${t.filter ?? ''}`)
        .join('|'),
    [tables]
  );

  useEffect(() => {
    if (!enabled || !tablesSignature) return;

    let timerId: number | null = null;
    const channel = supabase.channel(channelName);

    const scheduleRefresh = () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      timerId = window.setTimeout(() => {
        timerId = null;
        void onRefreshRef.current();
      }, debounceMs);
    };

    tables.forEach((item) => {
      channel.on(
        'postgres_changes',
        {
          event: (item.event ?? '*') as '*',
          schema: 'public',
          table: item.table,
          ...(item.filter ? { filter: item.filter } : {}),
        },
        scheduleRefresh
      );
    });

    channel.subscribe();

    return () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      void supabase.removeChannel(channel);
    };
  }, [channelName, tablesSignature, enabled, debounceMs]);
}
