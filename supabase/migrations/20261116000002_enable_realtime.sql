-- Bật Supabase Realtime (postgres_changes) cho các bảng nghiệp vụ chính.
-- Lưu ý: Không thêm assignment_keys để giữ bí mật đáp án.
-- Chạy file này trong Supabase Dashboard -> SQL Editor nếu chưa áp dụng qua MCP.

DO $$
DECLARE
  t text;
  target_tables text[] := ARRAY[
    'announcements',
    'timetable_uploads',
    'timetable_entries',
    'classes',
    'enrollments',
    'materials',
    'assignments',
    'submissions',
    'grades',
    'attendance_sessions',
    'attendance_records',
    'class_gradebook_settings',
    'profiles'
  ];
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END
$$;

