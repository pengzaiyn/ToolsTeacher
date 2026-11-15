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

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type ManageUsersRequest =
  | {
      action: 'create_student';
      full_name: string;
      gender: Gender;
      date_of_birth: string;
      student_code?: string;
      admissions_advisor?: string;
      class_name?: string;
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
    throw new Error('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại');
  }

  const { data, error } = await supabase.functions.invoke<ManageUsersResponse>('manage-users', {
    body: payload,
  });

  if (error) {
    if (error instanceof FunctionsHttpError) {
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

