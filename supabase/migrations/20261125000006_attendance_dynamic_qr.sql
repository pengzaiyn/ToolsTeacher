-- Điểm danh nhanh bằng QR Code Động (Dynamic Rotating QR) chống gian lận:
-- 1. Mở rộng public.attendance_records lưu thời gian quét, phương thức ('manual'/'qr'), IP, User-Agent, Device Hash
-- 2. Tạo bảng public.attendance_qr_sessions lưu secret_key HMAC-SHA256 (khóa kín ở server, không lộ ra client)
-- 3. Tạo bảng public.attendance_qr_used_tokens chống replay token và chặn 1 thiết bị điểm danh hộ nhiều tài khoản
-- 4. Bật Realtime cho public.attendance_records để màn hình chiếu của Giảng viên nhảy tên SV ngay lập tức

-- 1. Bổ sung cột truy vết điểm danh QR vào bảng attendance_records hiện có
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS checkin_time timestamptz,
  ADD COLUMN IF NOT EXISTS checkin_method text NOT NULL DEFAULT 'manual'
    CHECK (checkin_method IN ('manual', 'qr')),
  ADD COLUMN IF NOT EXISTS client_ip text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS device_hash text;

CREATE INDEX IF NOT EXISTS attendance_records_session_checkin_time_idx
  ON public.attendance_records (session_id, checkin_time DESC);

-- 2. Bảng phiên QR động (1-1 với attendance_sessions)
CREATE TABLE IF NOT EXISTS public.attendance_qr_sessions (
  session_id uuid PRIMARY KEY REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  secret_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  late_after_minutes integer NOT NULL DEFAULT 15
    CHECK (late_after_minutes >= 1 AND late_after_minutes <= 180),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  closed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attendance_qr_sessions_class_id_idx
  ON public.attendance_qr_sessions (class_id);

CREATE INDEX IF NOT EXISTS attendance_qr_sessions_teacher_id_idx
  ON public.attendance_qr_sessions (teacher_id);

ALTER TABLE public.attendance_qr_sessions ENABLE ROW LEVEL SECURITY;

-- Khóa hoàn toàn bảng chứa secret_key khỏi anon & authenticated (chỉ Edge Function dùng service_role truy cập)
REVOKE ALL ON TABLE public.attendance_qr_sessions FROM anon, authenticated;

DROP POLICY IF EXISTS "attendance_qr_sessions_service_only" ON public.attendance_qr_sessions;
CREATE POLICY "attendance_qr_sessions_service_only"
  ON public.attendance_qr_sessions
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 3. Bảng lưu token đã sử dụng & dấu vân tay thiết bị trong từng phiên
CREATE TABLE IF NOT EXISTS public.attendance_qr_used_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  device_hash text,
  client_ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id),
  UNIQUE (session_id, token_hash)
);

CREATE INDEX IF NOT EXISTS attendance_qr_used_tokens_session_device_idx
  ON public.attendance_qr_used_tokens (session_id, device_hash)
  WHERE device_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS attendance_qr_used_tokens_student_id_idx
  ON public.attendance_qr_used_tokens (student_id);

ALTER TABLE public.attendance_qr_used_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.attendance_qr_used_tokens FROM anon, authenticated;

DROP POLICY IF EXISTS "attendance_qr_used_tokens_service_only" ON public.attendance_qr_used_tokens;
CREATE POLICY "attendance_qr_used_tokens_service_only"
  ON public.attendance_qr_used_tokens
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- 4. Đảm bảo bảng attendance_records được đưa vào publication supabase_realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'attendance_records'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;
  END IF;
END
$$;

