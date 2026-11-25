import {
  createClient,
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import type { Gender, Profile } from '@/types/database';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!rawSupabaseUrl || !rawSupabaseAnonKey) {
  throw new Error('Thiếu cấu hình VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong file .env');
}

export const supabaseUrl: string = rawSupabaseUrl;
export const supabaseAnonKey: string = rawSupabaseAnonKey;

export const AUTH_SESSION_INVALIDATED_EVENT = 'avc-auth-session-invalidated';

export const SUPABASE_AUTH_STORAGE_KEY = (() => {
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    return ref ? `sb-${ref}-auth-token` : '';
  } catch {
    return '';
  }
})();

/** Xóa sạch token phiên Supabase còn sót trong localStorage để tránh tự phục hồi sau khi đăng xuất */
export function clearLocalAuthStorage(): void {
  if (typeof window === 'undefined' || !SUPABASE_AUTH_STORAGE_KEY) return;
  try {
    const prefix = SUPABASE_AUTH_STORAGE_KEY;
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && (key === prefix || key.startsWith(`${prefix}-`))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // Bỏ qua nếu trình duyệt chặn localStorage
  }
}

export function notifyAuthSessionInvalidated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_INVALIDATED_EVENT));
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ManageUsersRequest =
  | {
      action: 'create_student';
      full_name: string;
      email?: string;
      gender?: Gender;
      date_of_birth?: string;
      student_code?: string;
      admissions_advisor?: string;
      class_name?: string;
      education_system?: string;
      major?: string;
      cohort?: string;
      initial_cohort?: string;
      academic_status?: string;
      status_reason?: string;
      status_note?: string;
      is_active?: boolean;
    }
  | {
      action: 'create_teacher';
      email: string;
      full_name: string;
      subject?: string;
    }
  | {
      action: 'set_active';
      user_id: string;
      is_active: boolean;
    }
  | {
      action: 'reset_password';
      user_id: string;
    }
  | {
      action: 'delete_student';
      user_id: string;
    };

export type ManageUsersResponse = {
  user?: Profile;
  ok?: boolean;
  is_active?: boolean;
  error?: string;
};

export async function manageUsers(payload: ManageUsersRequest): Promise<ManageUsersResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    notifyAuthSessionInvalidated();
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
  }

  const { data, error } = await supabase.functions.invoke<ManageUsersResponse>('manage-users', {
    body: payload,
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      if (error.context.status === 401) {
        notifyAuthSessionInvalidated();
      }
      try {
        const body = (await error.context.json()) as { error?: string };
        throw new Error(body.error || 'Yêu cầu thất bại, vui lòng thử lại');
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
          throw parseErr;
        }
        throw new Error('Máy chủ trả về lỗi không xác định');
      }
    }
    if (error instanceof FunctionsRelayError) {
      throw new Error('Không thể kết nối tới dịch vụ xử lý tài khoản');
    }
    if (error instanceof FunctionsFetchError) {
      throw new Error('Lỗi mạng khi gọi dịch vụ quản lý tài khoản');
    }
    throw new Error(error.message || 'Thao tác thất bại');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data ?? { ok: true };
}

export type CisSyncRequest =
  | { action: 'status' }
  | { action: 'health' }
  | {
      action: 'sync_page';
      mode?: 'incremental' | 'full';
      cursor?: string | null;
      updated_since?: string | null;
    }
  | {
      action: 'finalize_sync';
      summary: Omit<CisSyncSummary, 'classesCreated'>;
      last_updated_since?: string | null;
    }
  | { action: 'lookup_one'; student_code: string };

export interface CisSkippedStudent {
  studentCode: string;
  fullName: string;
  email?: string;
  className: string | null;
  cohort: string | null;
  major: string | null;
}

export interface CisSyncPageResult {
  fetchedCount: number;
  matchedCount: number;
  updatedCount: number;
  createdCount?: number;
  createdStudents?: CisSkippedStudent[];
  skippedNotOnWeb: number;
  skippedStudents?: CisSkippedStudent[];
  errorCount: number;
  totalRecords: number | null;
  nextCursor: string | null;
  serverTime: string | null;
  newestUpdatedAt: string | null;
  usedUpdatedSince: string | null;
}

export interface CisSyncSummary {
  mode: 'incremental' | 'full';
  pagesFetched: number;
  fetchedCount: number;
  matchedCount: number;
  updatedCount: number;
  createdCount?: number;
  createdStudents?: CisSkippedStudent[];
  skippedNotOnWeb: number;
  skippedStudents?: CisSkippedStudent[];
  errorCount: number;
  classesCreated: number;
  serverTime: string | null;
}

export interface CisSyncResponse {
  ok?: boolean;
  hasLocalToken?: boolean;
  baseUrl?: string;
  apiKeyConfigured?: boolean;
  writeEnabled?: boolean;
  serverTime?: string | null;
  sourceSystem?: string;
  state?: {
    last_synced_at: string | null;
    last_updated_since: string | null;
    last_status: string | null;
    last_summary: CisSyncSummary | { error?: string } | null;
  } | null;
  summary?: CisSyncSummary;
  page?: CisSyncPageResult;
  lastUpdatedSince?: string;
  foundOnCis?: boolean;
  matchedOnWeb?: boolean;
  createdOnWeb?: boolean;
  email?: string;
  studentCode?: string;
  fullName?: string;
  className?: string | null;
  classesCreated?: number;
  message?: string;
  error?: string;
  code?: string;
}

export async function syncCisStudents(payload: CisSyncRequest): Promise<CisSyncResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    notifyAuthSessionInvalidated();
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
  }

  const { data, error } = await supabase.functions.invoke<CisSyncResponse>('sync-cis-students', {
    body: payload,
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await error.context.json()) as { error?: string; code?: string };
        if (error.context.status === 401 && body.code !== 'CIS_UNAUTHORIZED' && body.code !== 'UNAUTHORIZED') {
          notifyAuthSessionInvalidated();
        }
        throw new Error(body.error || 'Đồng bộ CIS thất bại, vui lòng thử lại');
      } catch (parseErr) {
        if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
          throw parseErr;
        }
        if (error.context.status === 401) {
          notifyAuthSessionInvalidated();
        }
        throw new Error('Máy chủ đồng bộ CIS trả về lỗi không xác định');
      }
    }
    if (error instanceof FunctionsRelayError) {
      throw new Error('Không thể kết nối tới Edge Function đồng bộ CIS');
    }
    if (error instanceof FunctionsFetchError) {
      throw new Error('Lỗi mạng khi gọi dịch vụ đồng bộ CIS');
    }
    throw new Error(error.message || 'Thao tác đồng bộ CIS thất bại');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data ?? { ok: true };
}

/** Tải toàn bộ các trang dữ liệu vượt ngưỡng 1.000 dòng bằng Promise.all song song */
export async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
    withCount: boolean
  ) => PromiseLike<{ data: T[] | null; count?: number | null; error: { message: string } | null }>,
  pageSize = 1000
): Promise<T[]> {
  const first = await fetchPage(0, pageSize - 1, true);
  if (first.error) throw new Error(first.error.message);
  const firstRows = first.data ?? [];
  const total = first.count ?? firstRows.length;
  if (firstRows.length < pageSize || total <= pageSize) {
    return firstRows;
  }

  const ranges: Array<[number, number]> = [];
  for (let from = pageSize; from < total; from += pageSize) {
    ranges.push([from, from + pageSize - 1]);
  }

  const all = [...firstRows];
  const concurrency = 2;
  for (let i = 0; i < ranges.length; i += concurrency) {
    const batch = ranges.slice(i, i + concurrency);
    const resList = await Promise.all(batch.map(([from, to]) => fetchPage(from, to, false)));
    for (const res of resList) {
      if (res.error) throw new Error(res.error.message);
      if (res.data) all.push(...res.data);
    }
  }
  return all;
}

